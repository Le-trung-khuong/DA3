/**
 * src/hooks/useChat.ts
 * Hook trung tâm cho module chat
 * ✅ Sửa remove: bỏ tham số isAdmin
 * ✅ Sửa unpin: thêm userId
 * ✅ Thêm markManyRead để batch
 */

import {
  useState, useEffect, useRef, useCallback, useReducer,
} from "react";
import {
  collection, query, orderBy, limit, where,
  onSnapshot, getDocs, startAfter, DocumentSnapshot,
} from "firebase/firestore";
import { db } from "../utils/config";
import type { ChatMessage } from "../types/chat";
import {
  sendMessage,
  sendMessageWithFile,
  updateMessage,
  deleteMessageByUser,
  reportMessage,
  toggleReaction,
  replyMessage,
  pinMessage,
  unpinMessage,
  markMessageAsRead,
  markMessagesAsRead,
  markRoomAsRead,
} from "../services/chatService";

// ─── Constants ───────────────────────────────────────────────────────────────

const PAGE_SIZE = 30;

// ─── State ───────────────────────────────────────────────────────────────────

interface ChatState {
  messages: ChatMessage[];
  loadingInitial: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  error: Error | null;
}

type ChatAction =
  | { type: "INIT_LOADING" }
  | { type: "INIT_DONE"; messages: ChatMessage[] }
  | { type: "REALTIME_UPDATE"; newMessages: ChatMessage[] }
  | { type: "LOAD_MORE_START" }
  | { type: "LOAD_MORE_DONE"; older: ChatMessage[] }
  | { type: "ERROR"; error: Error };

function chatReducer(state: ChatState, action: ChatAction): ChatState {
  switch (action.type) {
    case "INIT_LOADING":
      return { ...state, loadingInitial: true, error: null };

    case "INIT_DONE":
      return {
        ...state,
        messages: action.messages,
        loadingInitial: false,
        hasMore: action.messages.length >= PAGE_SIZE,
      };

    case "REALTIME_UPDATE": {
      const existingIds = new Set(state.messages.map((m) => m.id));
      const fresh = action.newMessages.filter((m) => !existingIds.has(m.id));
      if (fresh.length === 0) {
        const updated = state.messages.map((m) => {
          const found = action.newMessages.find((n) => n.id === m.id);
          return found ?? m;
        });
        return { ...state, messages: updated };
      }
      return {
        ...state,
        messages: [...state.messages, ...fresh],
      };
    }

    case "LOAD_MORE_START":
      return { ...state, loadingMore: true };

    case "LOAD_MORE_DONE":
      return {
        ...state,
        loadingMore: false,
        hasMore: action.older.length >= PAGE_SIZE,
        messages: [...action.older, ...state.messages],
      };

    case "ERROR":
      return { ...state, loadingInitial: false, loadingMore: false, error: action.error };

    default:
      return state;
  }
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useChat(roomId: string | undefined, currentUserId: string | undefined) {
  const [state, dispatch] = useReducer(chatReducer, {
    messages: [],
    loadingInitial: true,
    loadingMore: false,
    hasMore: true,
    error: null,
  });

  const oldestDocRef = useRef<DocumentSnapshot | null>(null);
  const initDoneRef = useRef(false);

  // ── 1. Load trang đầu + realtime listener ──────────────────────────────
  useEffect(() => {
    if (!roomId) return;

    dispatch({ type: "INIT_LOADING" });
    initDoneRef.current = false;

    const msgCol = collection(db, "chat_rooms", roomId, "messages");
    const q = query(msgCol, orderBy("timestamp", "desc"), limit(PAGE_SIZE));

    const unsub = onSnapshot(
      q,
      (snap) => {
        const docs = snap.docs
          .map((d) => ({ id: d.id, ...d.data() } as ChatMessage))
          .reverse();

        if (!initDoneRef.current) {
          oldestDocRef.current = snap.docs[snap.docs.length - 1] ?? null;
          dispatch({ type: "INIT_DONE", messages: docs });
          initDoneRef.current = true;
        } else {
          dispatch({ type: "REALTIME_UPDATE", newMessages: docs });
        }
      },
      (err) => dispatch({ type: "ERROR", error: err })
    );

    return () => {
      unsub();
      initDoneRef.current = false;
    };
  }, [roomId]);

  // ── 2. Load thêm tin cũ hơn ──────────────────────────────────────────────
  const loadMore = useCallback(async () => {
    if (!roomId || state.loadingMore || !state.hasMore || !oldestDocRef.current) return;

    dispatch({ type: "LOAD_MORE_START" });
    try {
      const msgCol = collection(db, "chat_rooms", roomId, "messages");
      const q = query(
        msgCol,
        orderBy("timestamp", "desc"),
        startAfter(oldestDocRef.current),
        limit(PAGE_SIZE)
      );
      const snap = await getDocs(q);
      const older = snap.docs
        .map((d) => ({ id: d.id, ...d.data() } as ChatMessage))
        .reverse();
      oldestDocRef.current = snap.docs[snap.docs.length - 1] ?? oldestDocRef.current;
      dispatch({ type: "LOAD_MORE_DONE", older });
    } catch (err) {
      dispatch({ type: "ERROR", error: err as Error });
    }
  }, [roomId, state.loadingMore, state.hasMore]);

  // ── 3. Actions ────────────────────────────────────────────────────────────

  const send = useCallback(
    async (text: string, userName: string) => {
      if (!roomId || !currentUserId) return;
      await sendMessage({ roomId, userId: currentUserId, userName, text });
    },
    [roomId, currentUserId]
  );

  const sendFile = useCallback(
    async (file: File, userName: string) => {
      if (!roomId || !currentUserId) return;
      await sendMessageWithFile(roomId, currentUserId, userName, file);
    },
    [roomId, currentUserId]
  );

  const reply = useCallback(
    async (
      text: string,
      userName: string,
      replyTo: string,
      replyToText: string,
      replyToUser: string
    ) => {
      if (!roomId || !currentUserId) return;
      await replyMessage(roomId, currentUserId, userName, text, replyTo, replyToText, replyToUser);
    },
    [roomId, currentUserId]
  );

  const edit = useCallback(
    async (messageId: string, newText: string) => {
      if (!roomId || !currentUserId) return;
      await updateMessage(roomId, messageId, newText, currentUserId);
    },
    [roomId, currentUserId]
  );

  // ✅ FIX: bỏ tham số isAdmin
  const remove = useCallback(
    async (messageId: string) => {
      if (!roomId || !currentUserId) return;
      await deleteMessageByUser(roomId, messageId, currentUserId);
    },
    [roomId, currentUserId]
  );

  const report = useCallback(
    async (messageId: string, reason: string) => {
      if (!roomId || !currentUserId) return;
      await reportMessage(roomId, messageId, currentUserId, reason);
    },
    [roomId, currentUserId]
  );

  const react = useCallback(
    async (messageId: string, emoji: string) => {
      if (!roomId || !currentUserId) return;
      await toggleReaction(roomId, messageId, emoji, currentUserId);
    },
    [roomId, currentUserId]
  );

  // ✅ FIX: pin tự kiểm tra quyền
  const pin = useCallback(
    async (messageId: string) => {
      if (!roomId || !currentUserId) return;
      await pinMessage(roomId, messageId, currentUserId);
    },
    [roomId, currentUserId]
  );

  // ✅ FIX: unpin cần truyền userId
  const unpin = useCallback(
    async (messageId: string) => {
      if (!roomId || !currentUserId) return;
      await unpinMessage(roomId, messageId, currentUserId);
    },
    [roomId, currentUserId]
  );

  const markRead = useCallback(
    async (messageId: string) => {
      if (!roomId || !currentUserId) return;
      await markMessageAsRead(roomId, messageId, currentUserId);
    },
    [roomId, currentUserId]
  );

  // ✅ NEW: batch mark read
  const markManyRead = useCallback(
    async (messageIds: string[]) => {
      if (!roomId || !currentUserId || messageIds.length === 0) return;
      await markMessagesAsRead(roomId, messageIds, currentUserId);
    },
    [roomId, currentUserId]
  );

  const markRoomRead = useCallback(async () => {
    if (!roomId || !currentUserId) return;
    await markRoomAsRead(roomId, currentUserId);
  }, [roomId, currentUserId]);

  return {
    messages: state.messages,
    loadingInitial: state.loadingInitial,
    loadingMore: state.loadingMore,
    hasMore: state.hasMore,
    error: state.error,
    loadMore,
    send,
    sendFile,
    reply,
    edit,
    remove,
    report,
    react,
    pin,
    unpin,
    markRead,
    markManyRead,
    markRoomRead,
  };
}
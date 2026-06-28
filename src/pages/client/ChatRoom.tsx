/**
 * src/pages/client/ChatRoom.tsx
 * Chi tiết phòng chat – tích hợp useChat, useTyping, read receipts, infinite scroll
 * ✅ Thêm permission check cho course community
 * ✅ UI Polish: avatar, typing dots, header badge, polished input, access-denied screen
 */

"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useDocument } from "../../hooks/useFirestore";
import { useAuth } from "../../contexts/AuthContext";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../../utils/config";
import { useChat } from "../../hooks/useChat";
import { useTyping } from "../../hooks/useTyping";
import { useOwnPresence } from "../../hooks/usePresence";
import { canAccessCommunity } from "../../services/chatService";
import { joinRoom, leaveRoom } from "../../services/chatService";
import {
  ArrowLeft,
  Send,
  Flag,
  Loader,
  Hash,
  Users,
  Lock,
  MessageSquare,
  Trash2,
  Edit3,
  Paperclip,
  X,
  AlertTriangle,
  CheckCheck,
  Check,
  Pin,
  PinOff,
  Reply,
  Crown,
} from "lucide-react";
import type { ChatMessage, ChatRoom } from "../../types/chat";

// ─── Helpers ─────────────────────────────────────────────────────────────

const toMillis = (value: any): number => {
  if (!value) return 0;
  if (value instanceof Date) return value.getTime();
  if (typeof value === "object" && typeof value.toDate === "function") {
    return value.toDate().getTime();
  }
  return 0;
};

const timeAgo = (value: any) => {
  const millis = toMillis(value);
  if (millis === 0) return "just now";
  const s = (Date.now() - millis) / 1000;
  if (s < 60) return `${Math.floor(s)}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};

// ─── Avatar helpers ───────────────────────────────────────────────────────

const stringToColor = (str: string): string => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 65%, 48%)`;
};

const stringToColor2 = (str: string): string => {
  let hash = 0;
  const s = str + "2";
  for (let i = 0; i < s.length; i++) {
    hash = s.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = (Math.abs(hash) % 360 + 40) % 360;
  return `hsl(${hue}, 65%, 35%)`;
};

const getUserAvatar = (
  userId: string,
  userName: string,
  photoURL?: string
): React.ReactNode => {
  if (photoURL) {
    return (
      <img
        src={photoURL}
        alt={userName}
        style={{
          width: 34,
          height: 34,
          borderRadius: "50%",
          objectFit: "cover",
          flexShrink: 0,
          border: "2px solid rgba(255,255,255,0.08)",
        }}
      />
    );
  }
  return (
    <div
      style={{
        width: 34,
        height: 34,
        borderRadius: "50%",
        background: `linear-gradient(135deg, ${stringToColor(userId)}, ${stringToColor2(userId)})`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 13,
        fontWeight: 700,
        color: "#fff",
        flexShrink: 0,
        border: "2px solid rgba(255,255,255,0.08)",
        userSelect: "none",
      }}
    >
      {userName.charAt(0).toUpperCase()}
    </div>
  );
};

// ─── Type extension ───────────────────────────────────────────────────────

interface ChatRoomInfo extends ChatRoom {}

// ─── Component ───────────────────────────────────────────────────────────

export default function ChatRoom() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const { currentUser, userProfile } = useAuth();

  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [reporting, setReporting] = useState<{ messageId: string; reason: string } | null>(null);
  const [editingMsg, setEditingMsg] = useState<ChatMessage | null>(null);
  const [editText, setEditText] = useState("");
  const [uploadingFile, setUploadingFile] = useState(false);
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const [isBanned, setIsBanned] = useState(false);
  const [warningCount, setWarningCount] = useState(0);
  const [accessDenied, setAccessDenied] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const loadMoreTriggerRef = useRef<HTMLDivElement>(null);
  const isMountedRef = useRef(true);
  const redirectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useOwnPresence(currentUser?.uid);

  const { data: room, loading: roomLoading, error: roomError } =
    useDocument<ChatRoomInfo>("chat_rooms", roomId);

  useEffect(() => {
    if (!roomId || !currentUser || !room) return;
    const checkAccess = async () => {
      if (room.isPrivate && room.type === "course") {
        const allowed = await canAccessCommunity(
          roomId,
          currentUser.uid,
          userProfile?.role
        );
        if (!allowed) {
          setAccessDenied(true);
          if (redirectTimerRef.current) clearTimeout(redirectTimerRef.current);
          redirectTimerRef.current = setTimeout(() => {
            navigate("/chat", {
              state: { error: "You don't have permission to access this community." },
            });
          }, 2000);
        } else {
          setAccessDenied(false);
        }
      }
    };
    checkAccess();
    return () => {
      if (redirectTimerRef.current) clearTimeout(redirectTimerRef.current);
    };
  }, [room, currentUser, userProfile, roomId, navigate]);

  const {
    messages,
    loadingInitial,
    loadingMore,
    hasMore,
    error: chatError,
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
    markRoomRead,
  } = useChat(roomId, currentUser?.uid);

  const { typingUsers, sendTyping } = useTyping(
    roomId,
    currentUser?.uid,
    userProfile?.displayName || currentUser?.email?.split("@")[0] || "Anonymous"
  );

  useEffect(() => {
    if (!roomId || !currentUser || accessDenied) return;
    const init = async () => {
      try {
        await joinRoom(roomId, currentUser.uid);
      } catch (err) {
        console.error("Join room error:", err);
      }
    };
    init();
    return () => {
      if (!roomId || !currentUser) return;
      leaveRoom(roomId, currentUser.uid).catch(console.error);
    };
  }, [roomId, currentUser, accessDenied]);

  useEffect(() => {
    if (!currentUser) return;
    const userRef = doc(db, "users", currentUser.uid);
    const unsubscribe = onSnapshot(userRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setIsBanned(data.status === "banned" || data.banned === true);
        setWarningCount(data.warningCount || 0);
      }
    });
    return () => unsubscribe();
  }, [currentUser]);

  useEffect(() => {
    if (!loadMoreTriggerRef.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !loadingMore && hasMore) {
          loadMore();
        }
      },
      { root: scrollContainerRef.current, rootMargin: "50px" }
    );
    observer.observe(loadMoreTriggerRef.current);
    return () => observer.disconnect();
  }, [loadMore, loadingMore, hasMore]);

  useEffect(() => {
    if (messages.length > 0 && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  useEffect(() => {
    if (!currentUser || !isMountedRef.current) return;
    const unread = messages.filter(
      (msg) =>
        msg.userId !== currentUser.uid &&
        (!msg.readBy || !msg.readBy.includes(currentUser.uid))
    );
    unread.forEach((msg) => {
      markRead(msg.id).catch(console.error);
    });
  }, [messages, currentUser, markRead]);

  useEffect(() => {
    return () => {
      if (roomId && currentUser?.uid && isMountedRef.current) {
        markRoomRead().catch(console.error);
      }
    };
  }, [roomId, currentUser, markRoomRead]);

  // ── Handlers ──

  const handleSend = async () => {
    if (!newMessage.trim() || !currentUser || sending) return;
    if (isBanned) {
      alert("You are banned from chatting.");
      return;
    }
    setSending(true);
    const userName =
      userProfile?.displayName ||
      currentUser.email?.split("@")[0] ||
      "Anonymous";
    try {
      if (replyingTo) {
        await reply(
          newMessage,
          userName,
          replyingTo.id,
          replyingTo.text,
          replyingTo.userName
        );
        setReplyingTo(null);
      } else {
        await send(newMessage, userName);
      }
      setNewMessage("");
      await sendTyping(false);
    } catch (err) {
      console.error("Send message error:", err);
      alert("Không thể gửi tin nhắn. Vui lòng thử lại.");
    } finally {
      setSending(false);
    }
  };

  const handleTyping = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setNewMessage(value);
    if (value.trim().length > 0) {
      sendTyping(true);
    } else {
      sendTyping(false);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    if (isBanned) {
      alert("You are banned from chatting.");
      return;
    }
    const file = e.target.files[0];
    if (file.size > 10 * 1024 * 1024) {
      alert("File too large (max 10MB).");
      return;
    }
    setUploadingFile(true);
    const userName =
      userProfile?.displayName ||
      currentUser!.email?.split("@")[0] ||
      "Anonymous";
    try {
      await sendFile(file, userName);
    } catch (err) {
      console.error(err);
      alert("Upload failed. Check Cloudinary preset.");
    } finally {
      setUploadingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleReport = async (messageId: string, reason: string) => {
    if (!currentUser) return;
    try {
      await report(messageId, reason);
      alert("Đã báo cáo tin nhắn. Cảm ơn bạn!");
    } catch (err) {
      console.error(err);
      alert("Không thể gửi báo cáo.");
    } finally {
      setReporting(null);
    }
  };

  const handleDeleteMessage = async (msg: ChatMessage) => {
    if (!currentUser) return;
    const confirmMsg = window.confirm("Delete this message permanently?");
    if (!confirmMsg) return;
    try {
      await remove(
        msg.id,
        userProfile?.role === "admin" || userProfile?.role === "moderator"
      );
    } catch (err: any) {
      alert(err.message || "Cannot delete message.");
    }
  };

  const handleEditMessage = (msg: ChatMessage) => {
    setEditingMsg(msg);
    setEditText(msg.text);
  };

  const handleSaveEdit = async () => {
    if (!editingMsg || !currentUser) return;
    if (!editText.trim()) return;
    try {
      await edit(editingMsg.id, editText);
      setEditingMsg(null);
      setEditText("");
    } catch (err: any) {
      alert(err.message || "Cannot edit message.");
    }
  };

  const handlePin = async (msg: ChatMessage) => {
    if (!currentUser) return;
    if (msg.isPinned) {
      await unpin(msg.id);
    } else {
      await pin(msg.id);
    }
  };

  const handleReply = (msg: ChatMessage) => {
    setReplyingTo(msg);
    const textarea = document.querySelector("textarea");
    if (textarea) textarea.focus();
  };

  // ── Message renderer ──

  const renderMessage = (msg: ChatMessage) => {
    const isOwn = msg.userId === currentUser?.uid;
    const isAdmin =
      userProfile?.role === "admin" || userProfile?.role === "moderator";
    const canPin = isAdmin;
    const isPinned = msg.isPinned || false;

    return (
      <div
        key={msg.id}
        style={{
          display: "flex",
          gap: 10,
          flexDirection: isOwn ? "row-reverse" : "row",
          alignItems: "flex-start",
          marginBottom: isPinned ? 20 : 10,
        }}
      >
        {/* Avatar */}
        {getUserAvatar(
          msg.userId,
          msg.userName,
          (msg as any).userAvatar
        )}

        {/* Bubble */}
        <div
          style={{
            maxWidth: "68%",
            background: isOwn
              ? "rgba(108,99,255,0.18)"
              : "rgba(255,255,255,0.05)",
            borderRadius: isOwn ? "16px 4px 16px 16px" : "4px 16px 16px 16px",
            padding: "10px 14px",
            border: isOwn
              ? "1px solid rgba(108,99,255,0.3)"
              : "1px solid rgba(255,255,255,0.08)",
            position: "relative",
            boxShadow: isOwn
              ? "0 2px 8px rgba(108,99,255,0.12)"
              : "0 2px 6px rgba(0,0,0,0.15)",
            ...(isPinned && {
              borderColor: "#F59E0B",
              boxShadow: "0 0 0 2px rgba(245,158,11,0.25)",
            }),
          }}
        >
          {/* Meta row */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 7,
              marginBottom: 5,
              flexWrap: "wrap",
            }}
          >
            <span
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: isOwn ? "#c4c0ff" : "#C7C4D8",
              }}
            >
              {msg.userName}
            </span>
            <span style={{ fontSize: 10, color: "#47464f" }}>
              {timeAgo(msg.timestamp)}
            </span>
            {msg.isEdited && (
              <span style={{ fontSize: 9, color: "#47464f" }}>(edited)</span>
            )}
            {isPinned && (
              <span
                style={{
                  fontSize: 9,
                  color: "#F59E0B",
                  display: "flex",
                  alignItems: "center",
                  gap: 2,
                }}
              >
                <Pin size={10} style={{ display: "inline" }} /> Pinned
              </span>
            )}
            {/* Action buttons */}
            <div style={{ marginLeft: "auto", display: "flex", gap: 3 }}>
              {!isOwn && (
                <button
                  onClick={() => setReporting({ messageId: msg.id, reason: "" })}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "#47464f",
                    padding: 2,
                  }}
                  title="Report"
                >
                  <Flag size={11} />
                </button>
              )}
              {isOwn && (
                <>
                  <button
                    onClick={() => handleEditMessage(msg)}
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      color: "#C7C4D8",
                      padding: 2,
                    }}
                    title="Edit"
                  >
                    <Edit3 size={11} />
                  </button>
                  <button
                    onClick={() => handleDeleteMessage(msg)}
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      color: "#ffb4ab",
                      padding: 2,
                    }}
                    title="Delete"
                  >
                    <Trash2 size={11} />
                  </button>
                </>
              )}
              <button
                onClick={() => handleReply(msg)}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "#6C63FF",
                  padding: 2,
                }}
                title="Reply"
              >
                <Reply size={11} />
              </button>
              {canPin && (
                <button
                  onClick={() => handlePin(msg)}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: msg.isPinned ? "#F59E0B" : "#47464f",
                    padding: 2,
                  }}
                  title={msg.isPinned ? "Unpin" : "Pin"}
                >
                  {msg.isPinned ? <PinOff size={11} /> : <Pin size={11} />}
                </button>
              )}
            </div>
          </div>

          {/* Reply context */}
          {msg.replyTo && msg.replyToText && (
            <div
              style={{
                background: "rgba(255,255,255,0.04)",
                borderRadius: 8,
                padding: "4px 8px",
                marginBottom: 6,
                borderLeft: "3px solid #6C63FF",
                fontSize: 12,
                color: "#9694A8",
              }}
            >
              <span style={{ fontWeight: 600, color: "#c4c0ff" }}>
                @{msg.replyToUser}
              </span>{" "}
              {msg.replyToText}
            </div>
          )}

          {/* Content */}
          {msg.fileUrl ? (
            <div style={{ marginTop: 8 }}>
              {msg.isImage ? (
                <img
                  src={msg.fileUrl}
                  alt="shared"
                  style={{
                    maxWidth: "100%",
                    maxHeight: 200,
                    borderRadius: 8,
                    cursor: "pointer",
                    display: "block",
                  }}
                  onClick={() => window.open(msg.fileUrl)}
                />
              ) : (
                <a
                  href={msg.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    color: "#6C63FF",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <Paperclip size={14} /> {msg.fileName || "Download file"}
                </a>
              )}
            </div>
          ) : (
            <p
              style={{
                fontSize: 14,
                color: "#E4E1EE",
                wordBreak: "break-word",
                whiteSpace: "pre-wrap",
                margin: 0,
              }}
            >
              {msg.text}
            </p>
          )}

          {/* Reactions */}
          {msg.reactions && Object.keys(msg.reactions).length > 0 && (
            <div
              style={{ display: "flex", gap: 5, marginTop: 7, flexWrap: "wrap" }}
            >
              {Object.entries(msg.reactions).map(([emoji, userIds]) => (
                <button
                  key={emoji}
                  onClick={() => react(msg.id, emoji)}
                  style={{
                    background: userIds.includes(currentUser?.uid || "")
                      ? "rgba(108,99,255,0.22)"
                      : "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 12,
                    padding: "2px 8px",
                    fontSize: 12,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  {emoji} {userIds.length}
                </button>
              ))}
            </div>
          )}

          {/* Read receipts */}
          {isOwn && msg.readBy && (
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                alignItems: "center",
                marginTop: 4,
                gap: 2,
              }}
            >
              {msg.readBy.length > 1 ? (
                <CheckCheck size={13} color="#6C63FF" />
              ) : (
                <Check size={13} color="#47464f" />
              )}
              <span style={{ fontSize: 9, color: "#47464f" }}>
                {msg.readBy.length - 1 > 0 && `${msg.readBy.length - 1} read`}
              </span>
            </div>
          )}
        </div>
      </div>
    );
  };

  // ── Early returns ──

  if (roomLoading) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "60vh",
        }}
      >
        <Loader
          size={36}
          color="#6C63FF"
          style={{ animation: "spin 0.8s linear infinite" }}
        />
      </div>
    );
  }

  if (roomError || !room) {
    return (
      <div style={{ textAlign: "center", padding: 60, color: "#C7C4D8" }}>
        <p>Room not found or inaccessible.</p>
        <Link
          to="/chat"
          style={{
            color: "#6C63FF",
            marginTop: 12,
            display: "inline-block",
          }}
        >
          ← Back to chat
        </Link>
      </div>
    );
  }

  if (accessDenied) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          height: "70vh",
          textAlign: "center",
          padding: "24px",
        }}
      >
        {/* Illustration */}
        <div
          style={{
            width: 80,
            height: 80,
            borderRadius: "50%",
            background: "rgba(255,180,171,0.1)",
            border: "2px solid rgba(255,180,171,0.25)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 24,
            boxShadow: "0 0 32px rgba(255,90,90,0.08)",
          }}
        >
          <Lock size={34} color="#ffb4ab" />
        </div>
        <h2
          style={{
            fontSize: 26,
            fontWeight: 800,
            color: "#E4E1EE",
            marginBottom: 10,
            letterSpacing: "-0.5px",
          }}
        >
          Access Denied
        </h2>
        <p
          style={{
            fontSize: 15,
            color: "#9694A8",
            maxWidth: 380,
            lineHeight: 1.65,
            marginBottom: 28,
          }}
        >
          This community is exclusive to enrolled students. Purchase the course
          to unlock access.
        </p>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center" }}>
          <Link
            to="/chat"
            style={{
              padding: "10px 24px",
              borderRadius: 12,
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.1)",
              color: "#C7C4D8",
              textDecoration: "none",
              fontWeight: 600,
              fontSize: 14,
            }}
          >
            ← Back to Chat
          </Link>
          <Link
            to="/courses"
            style={{
              padding: "10px 24px",
              borderRadius: 12,
              background: "linear-gradient(135deg,#6C63FF,#9B59B6)",
              color: "#fff",
              textDecoration: "none",
              fontWeight: 700,
              fontSize: 14,
            }}
          >
            Browse Courses →
          </Link>
        </div>
        <p style={{ fontSize: 12, color: "#47464f", marginTop: 20 }}>
          Redirecting you automatically…
        </p>
      </div>
    );
  }

  const isPremium = room.type === "course" && room.isPrivate;

  // ── Main render ──
  return (
    <div
      style={{
        maxWidth: 1280,
        margin: "0 auto",
        padding: "24px",
        height: "calc(100vh - 64px)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Keyframes */}
      <style>{`
        @keyframes typingDot {
          0%, 60%, 100% { opacity: 0.2; transform: translateY(0); }
          30% { opacity: 1; transform: translateY(-3px); }
        }
      `}</style>

      {/* ── Header ── */}
      <div
        style={{
          marginBottom: 16,
          padding: "14px 20px",
          background: "rgba(26,26,46,0.5)",
          borderRadius: 16,
          border: isPremium
            ? "1px solid rgba(255,215,0,0.15)"
            : "1px solid rgba(255,255,255,0.07)",
          display: "flex",
          alignItems: "center",
          gap: 14,
          flexWrap: "wrap",
        }}
      >
        <Link
          to="/chat"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 5,
            color: "#9694A8",
            textDecoration: "none",
            fontSize: 13,
            fontWeight: 600,
            flexShrink: 0,
          }}
        >
          <ArrowLeft size={16} /> Back
        </Link>

        {/* Room icon */}
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 10,
            background: isPremium
              ? "linear-gradient(135deg,#FFD700,#FFA500)"
              : "linear-gradient(135deg,#6C63FF,#9B59B6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            boxShadow: isPremium
              ? "0 2px 10px rgba(255,215,0,0.25)"
              : "0 2px 10px rgba(108,99,255,0.25)",
          }}
        >
          {isPremium ? (
            <Crown size={18} color="#1a1a2e" />
          ) : (
            <Hash size={18} color="#fff" />
          )}
        </div>

        {/* Name + description */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <h1
              style={{
                fontSize: 18,
                fontWeight: 700,
                color: "#E4E1EE",
                margin: 0,
                letterSpacing: "-0.2px",
              }}
            >
              {room.name}
            </h1>
            {isPremium && (
              <span
                style={{
                  fontSize: 9,
                  fontWeight: 800,
                  letterSpacing: ".07em",
                  color: "#FFD700",
                  background: "rgba(255,215,0,0.12)",
                  padding: "2px 8px",
                  borderRadius: 999,
                }}
              >
                PREMIUM
              </span>
            )}
            {!isPremium && (
              <span
                style={{
                  fontSize: 9,
                  fontWeight: 700,
                  letterSpacing: ".05em",
                  color: "#9694A8",
                  background: "rgba(255,255,255,0.07)",
                  padding: "2px 8px",
                  borderRadius: 999,
                }}
              >
                PUBLIC
              </span>
            )}
            {room.isLocked && (
              <span
                style={{
                  fontSize: 9,
                  fontWeight: 700,
                  color: "#FFB785",
                  background: "rgba(255,183,133,0.1)",
                  padding: "2px 8px",
                  borderRadius: 999,
                  display: "flex",
                  alignItems: "center",
                  gap: 3,
                }}
              >
                <Lock size={9} /> Locked
              </span>
            )}
          </div>
          <p
            style={{
              fontSize: 12,
              color: "#6B6882",
              margin: "2px 0 0",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {room.description}
          </p>
        </div>

        {/* Stats */}
        <div
          style={{
            display: "flex",
            gap: 14,
            fontSize: 12,
            color: "#6B6882",
            flexShrink: 0,
          }}
        >
          <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <Users size={13} /> {room.memberCount}
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <MessageSquare size={13} /> {room.messageCount}
          </span>
        </div>
      </div>

      {/* Warning banner */}
      {warningCount > 0 && (
        <div
          style={{
            background: "rgba(255,183,133,0.1)",
            border: "1px solid rgba(255,183,133,0.25)",
            borderRadius: 10,
            padding: "8px 14px",
            marginBottom: 10,
            display: "flex",
            alignItems: "center",
            gap: 8,
            color: "#FFB785",
            fontSize: 12,
          }}
        >
          <AlertTriangle size={15} />
          You have received {warningCount} warning(s). Further violations may
          lead to a ban.
        </div>
      )}

      {/* Messages container */}
      <div
        ref={scrollContainerRef}
        style={{
          flex: 1,
          overflowY: "auto",
          background: "rgba(15,15,26,0.6)",
          borderRadius: 16,
          border: "1px solid rgba(255,255,255,0.05)",
          padding: "16px",
          marginBottom: 12,
          position: "relative",
          scrollbarWidth: "thin",
          scrollbarColor: "rgba(108,99,255,0.3) transparent",
        }}
      >
        <div ref={loadMoreTriggerRef} style={{ height: 1, marginBottom: 4 }} />
        {loadingMore && (
          <div style={{ textAlign: "center", padding: 8 }}>
            <Loader
              size={18}
              color="#6C63FF"
              style={{ animation: "spin 0.8s linear infinite" }}
            />
          </div>
        )}

        {loadingInitial ? (
          <div style={{ display: "flex", justifyContent: "center", padding: 48 }}>
            <Loader
              size={26}
              color="#6C63FF"
              style={{ animation: "spin 0.8s linear infinite" }}
            />
          </div>
        ) : messages.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: "48px 24px",
              color: "#6B6882",
            }}
          >
            <MessageSquare
              size={28}
              style={{ opacity: 0.25, marginBottom: 10, display: "inline-block" }}
            />
            <p style={{ fontSize: 14 }}>
              No messages yet. Be the first to say something!
            </p>
          </div>
        ) : (
          messages.map(renderMessage)
        )}

        {/* Typing indicator */}
        {typingUsers.length > 0 && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "6px 0 2px",
              color: "#9694A8",
              fontSize: 12,
              fontStyle: "italic",
            }}
          >
            <span>
              {typingUsers.map((t) => t.userName).join(", ")} is typing
            </span>
            <span style={{ display: "flex", gap: 2, alignItems: "flex-end" }}>
              <span
                style={{
                  animation: "typingDot 1.4s infinite",
                  animationDelay: "0s",
                  display: "inline-block",
                  fontSize: 16,
                  lineHeight: 1,
                  color: "#6C63FF",
                }}
              >
                ·
              </span>
              <span
                style={{
                  animation: "typingDot 1.4s infinite",
                  animationDelay: "0.2s",
                  display: "inline-block",
                  fontSize: 16,
                  lineHeight: 1,
                  color: "#6C63FF",
                }}
              >
                ·
              </span>
              <span
                style={{
                  animation: "typingDot 1.4s infinite",
                  animationDelay: "0.4s",
                  display: "inline-block",
                  fontSize: 16,
                  lineHeight: 1,
                  color: "#6C63FF",
                }}
              >
                ·
              </span>
            </span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Reply context bar */}
      {replyingTo && (
        <div
          style={{
            background: "rgba(108,99,255,0.08)",
            border: "1px solid rgba(108,99,255,0.25)",
            borderRadius: 10,
            padding: "8px 14px",
            marginBottom: 8,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span style={{ fontSize: 12, color: "#9694A8" }}>
            Replying to{" "}
            <strong style={{ color: "#c4c0ff" }}>@{replyingTo.userName}</strong>
            : {replyingTo.text.slice(0, 60)}
          </span>
          <button
            onClick={() => setReplyingTo(null)}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "#6B6882",
              padding: 2,
            }}
          >
            <X size={15} />
          </button>
        </div>
      )}

      {/* Input area */}
      {room.isLocked ? (
        <div
          style={{
            background: "rgba(255,183,133,0.07)",
            border: "1px solid rgba(255,183,133,0.2)",
            borderRadius: 12,
            padding: "12px 16px",
            textAlign: "center",
            color: "#FFB785",
            fontSize: 13,
          }}
        >
          This room is locked. You cannot send messages.
        </div>
      ) : (
        <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
          <textarea
            value={newMessage}
            onChange={handleTyping}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder={isBanned ? "You are banned" : "Type your message…"}
            rows={1}
            disabled={isBanned}
            style={{
              flex: 1,
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 12,
              padding: "12px 14px",
              color: "#E4E1EE",
              fontSize: 14,
              resize: "none",
              fontFamily: "Inter,sans-serif",
              outline: "none",
              transition: "border-color 0.2s",
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = isPremium
                ? "rgba(255,215,0,0.3)"
                : "rgba(108,99,255,0.4)";
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)";
            }}
          />
          <div style={{ display: "flex", gap: 8 }}>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              style={{ display: "none" }}
              accept="image/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.*"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isBanned || uploadingFile}
              title="Attach file"
              style={{
                width: 46,
                height: 46,
                borderRadius: 12,
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.09)",
                cursor: isBanned ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#9694A8",
                flexShrink: 0,
              }}
            >
              {uploadingFile ? (
                <Loader
                  size={17}
                  style={{ animation: "spin 0.8s linear infinite" }}
                />
              ) : (
                <Paperclip size={17} />
              )}
            </button>
            <button
              onClick={handleSend}
              disabled={sending || !newMessage.trim() || isBanned}
              style={{
                width: 46,
                height: 46,
                borderRadius: 12,
                background:
                  sending || !newMessage.trim() || isBanned
                    ? "rgba(108,99,255,0.3)"
                    : "linear-gradient(135deg,#6C63FF,#9B59B6)",
                border: "none",
                cursor:
                  sending || !newMessage.trim() || isBanned
                    ? "not-allowed"
                    : "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                opacity: sending || !newMessage.trim() || isBanned ? 0.55 : 1,
                transition: "opacity 0.2s, background 0.2s",
                flexShrink: 0,
                boxShadow:
                  sending || !newMessage.trim() || isBanned
                    ? "none"
                    : "0 4px 12px rgba(108,99,255,0.3)",
              }}
            >
              {sending ? (
                <Loader
                  size={17}
                  color="#fff"
                  style={{ animation: "spin 0.8s linear infinite" }}
                />
              ) : (
                <Send size={17} color="#fff" />
              )}
            </button>
          </div>
        </div>
      )}

      {/* Edit modal */}
      {editingMsg && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.72)",
            backdropFilter: "blur(6px)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
          onClick={(e) =>
            e.target === e.currentTarget && setEditingMsg(null)
          }
        >
          <div
            style={{
              background: "#1a1a2e",
              borderRadius: 20,
              padding: 24,
              maxWidth: 500,
              width: "100%",
              border: "1px solid rgba(108,99,255,0.2)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: 16,
              }}
            >
              <h3 style={{ fontSize: 18, fontWeight: 700, color: "#E4E1EE" }}>
                Edit message
              </h3>
              <button
                onClick={() => setEditingMsg(null)}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "#9694A8",
                }}
              >
                <X size={18} />
              </button>
            </div>
            <textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              rows={3}
              style={{
                width: "100%",
                background: "#0d0d18",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 12,
                padding: "12px",
                color: "#E4E1EE",
                fontSize: 14,
                marginBottom: 20,
                resize: "vertical",
                boxSizing: "border-box",
              }}
            />
            <div style={{ display: "flex", gap: 12 }}>
              <button
                onClick={() => setEditingMsg(null)}
                style={{
                  flex: 1,
                  padding: "10px",
                  borderRadius: 12,
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  color: "#C7C4D8",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={!editText.trim()}
                style={{
                  flex: 1,
                  padding: "10px",
                  borderRadius: 12,
                  background: "linear-gradient(135deg,#6C63FF,#9B59B6)",
                  border: "none",
                  color: "#fff",
                  fontWeight: 700,
                  cursor: editText.trim() ? "pointer" : "not-allowed",
                  opacity: editText.trim() ? 1 : 0.6,
                }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Report modal */}
      {reporting && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.72)",
            backdropFilter: "blur(6px)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
          onClick={(e) =>
            e.target === e.currentTarget && setReporting(null)
          }
        >
          <div
            style={{
              background: "#1a1a2e",
              borderRadius: 20,
              padding: 24,
              maxWidth: 400,
              width: "100%",
              border: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            <h3
              style={{
                fontSize: 18,
                fontWeight: 700,
                color: "#E4E1EE",
                marginBottom: 16,
              }}
            >
              Report message
            </h3>
            <select
              value={reporting.reason}
              onChange={(e) =>
                setReporting({ ...reporting, reason: e.target.value })
              }
              style={{
                width: "100%",
                background: "#0d0d18",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 10,
                padding: "10px",
                color: "#E4E1EE",
                marginBottom: 20,
              }}
            >
              <option value="">Select a reason</option>
              <option value="spam">Spam</option>
              <option value="harassment">Harassment</option>
              <option value="hate_speech">Hate speech</option>
              <option value="inappropriate">Inappropriate content</option>
              <option value="other">Other</option>
            </select>
            <div style={{ display: "flex", gap: 12 }}>
              <button
                onClick={() => setReporting(null)}
                style={{
                  flex: 1,
                  padding: "10px",
                  borderRadius: 12,
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  color: "#C7C4D8",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={() =>
                  reporting.reason &&
                  handleReport(reporting.messageId, reporting.reason)
                }
                disabled={!reporting.reason}
                style={{
                  flex: 1,
                  padding: "10px",
                  borderRadius: 12,
                  background: "linear-gradient(135deg,#6C63FF,#9B59B6)",
                  border: "none",
                  color: "#fff",
                  fontWeight: 700,
                  cursor: reporting.reason ? "pointer" : "not-allowed",
                  opacity: reporting.reason ? 1 : 0.6,
                }}
              >
                Report
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
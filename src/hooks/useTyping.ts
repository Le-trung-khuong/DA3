/**
 * src/hooks/useTyping.ts
 * Hook quản lý typing indicator cho một phòng chat.
 *
 * Cách dùng:
 *   const { typingUsers, sendTyping } = useTyping(roomId, userId, userName);
 *   // Gọi sendTyping(true) khi user nhập, sendTyping(false) khi dừng
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { setTypingStatus, onTypingStatus } from "../services/chatService";
import type { TypingStatus } from "../types/chat";

const DEBOUNCE_STOP_MS = 2500; // tự động tắt typing sau 2.5s không nhập

export function useTyping(
  roomId: string | undefined,
  userId: string | undefined,
  userName: string | undefined
) {
  const [typingUsers, setTypingUsers] = useState<TypingStatus[]>([]);
  const stopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingRef = useRef(false);

  // Lắng nghe typing của người khác
  useEffect(() => {
    if (!roomId || !userId) return;

    const unsub = onTypingStatus(roomId, userId, (users) => {
      setTypingUsers(users);
    });

    return () => unsub();
  }, [roomId, userId]);

  /**
   * Gọi hàm này mỗi khi user nhập ký tự (onChange).
   * isTyping = true → bắt đầu; false → dừng ngay.
   * Có debounce: nếu không gọi lại trong 2.5s thì tự dừng.
   */
  const sendTyping = useCallback(
    async (isTyping: boolean) => {
      if (!roomId || !userId || !userName) return;

      // Xóa timer cũ
      if (stopTimerRef.current) {
        clearTimeout(stopTimerRef.current);
        stopTimerRef.current = null;
      }

      if (isTyping) {
        // Chỉ ghi Firestore nếu chưa đang ở trạng thái typing
        if (!isTypingRef.current) {
          isTypingRef.current = true;
          await setTypingStatus(roomId, userId, userName, true);
        }

        // Đặt timer tự tắt
        stopTimerRef.current = setTimeout(async () => {
          isTypingRef.current = false;
          await setTypingStatus(roomId, userId, userName, false);
        }, DEBOUNCE_STOP_MS);
      } else {
        // Dừng ngay lập tức (khi gửi tin hoặc xóa hết chữ)
        if (isTypingRef.current) {
          isTypingRef.current = false;
          await setTypingStatus(roomId, userId, userName, false);
        }
      }
    },
    [roomId, userId, userName]
  );

  // Cleanup khi unmount: tắt typing
  useEffect(() => {
    return () => {
      if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
      if (roomId && userId && userName && isTypingRef.current) {
        setTypingStatus(roomId, userId, userName, false).catch(console.error);
      }
    };
  }, [roomId, userId, userName]);

  return { typingUsers, sendTyping };
}
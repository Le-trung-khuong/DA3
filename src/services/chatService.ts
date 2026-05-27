/**
 * src/services/chatService.ts
 * Client chat operations
 */

import { db } from "../utils/config";
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  serverTimestamp,
  increment,
} from "firebase/firestore";

export interface SendMessageData {
  roomId: string;
  userId: string;
  userName: string;
  text: string;
}

/**
 * Gửi tin nhắn mới
 */
export async function sendMessage(data: SendMessageData): Promise<void> {
  const { roomId, userId, userName, text } = data;

  const messagesRef = collection(db, "chat_rooms", roomId, "messages");
  await addDoc(messagesRef, {
    userId,
    userName,
    text: text.trim(),
    timestamp: serverTimestamp(),
    isReported: false,
  });

  const roomRef = doc(db, "chat_rooms", roomId);
  await updateDoc(roomRef, {
    lastMessage: text.trim().slice(0, 100),
    lastMessageAt: serverTimestamp(),
    lastMessageUser: userName,
    messageCount: increment(1),
  });
}

/**
 * Báo cáo tin nhắn vi phạm
 */
export async function reportMessage(
  roomId: string,
  messageId: string,
  reporterId: string,
  reason: string
): Promise<void> {
  const msgRef = doc(db, "chat_rooms", roomId, "messages", messageId);
  await updateDoc(msgRef, {
    isReported: true,
    reportReason: reason,
    reportedBy: reporterId,
    reportedAt: serverTimestamp(),
  });

  const roomRef = doc(db, "chat_rooms", roomId);
  await updateDoc(roomRef, {
    reportedCount: increment(1),
  });
}
/**
 * src/services/communityService.ts
 * Community management operations (chat rooms, messages, reports)
 */

import { db } from "../utils/config";
import {
  collection, doc, addDoc, updateDoc, deleteDoc, serverTimestamp,
  increment, writeBatch, getDoc, getDocs, query, where,
} from "firebase/firestore";
import { banUser as banUserService } from "./adminService";

export interface CreateRoomData {
  name: string;
  description: string;
  type: "general" | "study" | "course" | "announcement";
  isActive: boolean;
  isLocked: boolean;
  subject?: string;
  createdBy: string;
}

/**
 * Tạo room mới
 */
export async function createRoom(data: CreateRoomData): Promise<string> {
  const roomRef = await addDoc(collection(db, "chat_rooms"), {
    ...data,
    createdAt: serverTimestamp(),
    memberCount: 0,
    messageCount: 0,
    reportedCount: 0,
    pinned: false,
  });
  return roomRef.id;
}

/**
 * Cập nhật room
 */
export async function updateRoom(
  roomId: string,
  updates: Partial<Omit<CreateRoomData, "createdBy">>
): Promise<void> {
  const roomRef = doc(db, "chat_rooms", roomId);
  await updateDoc(roomRef, { ...updates, updatedAt: serverTimestamp() });
}

/**
 * Xóa room (soft delete: deactivate + lock)
 */
export async function deleteRoom(roomId: string): Promise<void> {
  await updateDoc(doc(db, "chat_rooms", roomId), {
    isActive: false,
    isLocked: true,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Xóa message vĩnh viễn
 */
export async function deleteMessage(roomId: string, messageId: string): Promise<void> {
  const msgRef = doc(db, "chat_rooms", roomId, "messages", messageId);
  await deleteDoc(msgRef);
  // Decrement messageCount in room
  const roomRef = doc(db, "chat_rooms", roomId);
  await updateDoc(roomRef, { messageCount: increment(-1) });
}

/**
 * Cảnh báo user (tăng warningCount)
 */
export async function warnUser(userId: string, reason: string): Promise<void> {
  const userRef = doc(db, "users", userId);
  await updateDoc(userRef, { warningCount: increment(1), updatedAt: serverTimestamp() });
  // Có thể thêm log warning vào subcollection
}

/**
 * Dismiss report (xóa flag reported)
 */
export async function ignoreReport(roomId: string, messageId: string): Promise<void> {
  const msgRef = doc(db, "chat_rooms", roomId, "messages", messageId);
  await updateDoc(msgRef, {
    isReported: false,
    reportReason: null,
    reportedBy: null,
    reportedAt: null,
  });
}

/**
 * Ban user (sử dụng adminService.banUser)
 */
export async function banUser(userId: string, reason: string): Promise<void> {
  await banUserService(userId, reason, false);
}
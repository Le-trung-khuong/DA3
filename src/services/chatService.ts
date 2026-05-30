/**
 * src/services/chatService.ts
 * Client chat operations (Firestore + Cloudinary upload)
 */

import { db } from "../utils/config";
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  increment,
  getDoc,
} from "firebase/firestore";

export interface SendMessageData {
  roomId: string;
  userId: string;
  userName: string;
  text: string;
}

/**
 * Upload file lên Cloudinary, trả về URL và metadata
 */
export async function uploadToCloudinary(file: File): Promise<{
  url: string;
  publicId: string;
  resourceType: string;
  format: string;
  originalName: string;
  size: number;
}> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET);

  const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Cloudinary upload failed: ${errorText}`);
  }

  const data = await response.json();
  return {
    url: data.secure_url,
    publicId: data.public_id,
    resourceType: data.resource_type, // "image", "video", "raw"
    format: data.format,
    originalName: file.name,
    size: file.size,
  };
}

/**
 * Gửi tin nhắn kèm file (hình ảnh hoặc file bất kỳ)
 */
export async function sendMessageWithFile(
  roomId: string,
  userId: string,
  userName: string,
  file: File
): Promise<void> {
  const uploaded = await uploadToCloudinary(file);
  const isImage = uploaded.resourceType === "image";
  const displayText = isImage ? "📷 Image" : "📎 File";

  const messagesRef = collection(db, "chat_rooms", roomId, "messages");
  await addDoc(messagesRef, {
    userId,
    userName,
    text: displayText,
    fileUrl: uploaded.url,
    fileName: uploaded.originalName,
    fileType: uploaded.resourceType,
    isImage,
    timestamp: serverTimestamp(),
    isReported: false,
  });

  const roomRef = doc(db, "chat_rooms", roomId);
  await updateDoc(roomRef, {
    lastMessage: isImage ? "📷 Image" : `📎 ${uploaded.originalName.slice(0, 30)}`,
    lastMessageAt: serverTimestamp(),
    lastMessageUser: userName,
    messageCount: increment(1),
  });
}

/**
 * Gửi tin nhắn văn bản
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

/**
 * Xóa tin nhắn (user hoặc admin)
 */
export async function deleteMessageByUser(
  roomId: string,
  messageId: string,
  currentUserId: string,
  isAdmin: boolean = false
): Promise<void> {
  const msgRef = doc(db, "chat_rooms", roomId, "messages", messageId);
  const msgSnap = await getDoc(msgRef);
  if (!msgSnap.exists()) throw new Error("Message not found");
  const msgData = msgSnap.data();
  if (msgData.userId !== currentUserId && !isAdmin) {
    throw new Error("You can only delete your own messages");
  }
  await deleteDoc(msgRef);
  const roomRef = doc(db, "chat_rooms", roomId);
  await updateDoc(roomRef, { messageCount: increment(-1) });
}

/**
 * Cập nhật nội dung tin nhắn (chủ sở hữu)
 */
export async function updateMessage(
  roomId: string,
  messageId: string,
  newText: string,
  userId: string
): Promise<void> {
  const msgRef = doc(db, "chat_rooms", roomId, "messages", messageId);
  const msgSnap = await getDoc(msgRef);
  if (!msgSnap.exists()) throw new Error("Message not found");
  const msgData = msgSnap.data();
  if (msgData.userId !== userId) throw new Error("You can only edit your own messages");
  await updateDoc(msgRef, {
    text: newText.trim(),
    editedAt: serverTimestamp(),
    isEdited: true,
  });
}
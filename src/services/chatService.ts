/**
 * src/services/chatService.ts
 * Client chat operations (Firestore + Cloudinary upload)
 * ✅ Đã sửa: deleteMessageByUser tự xác định role
 * ✅ Đã thêm assertCanModerate cho pin/unpin
 * ✅ Đã thêm markMessagesAsRead batch
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
  getDocs,
  setDoc,
  arrayUnion,
  arrayRemove,
  onSnapshot,
  query,
  where,
  Unsubscribe,
  writeBatch,
} from "firebase/firestore";
import type { PresenceStatus, TypingStatus } from "../types/chat";
import { checkUserEnrollment } from "./enrollmentService";

// ─── Existing types ──────────────────────────────────────────────────────────

export interface SendMessageData {
  roomId: string;
  userId: string;
  userName: string;
  text: string;
}

// ─── Cloudinary upload ───────────────────────────────────────────────────────

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
  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`,
    { method: "POST", body: formData }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Cloudinary upload failed: ${errorText}`);
  }

  const data = await response.json();
  return {
    url: data.secure_url,
    publicId: data.public_id,
    resourceType: data.resource_type,
    format: data.format,
    originalName: file.name,
    size: file.size,
  };
}

// ─── Core message operations ──────────────────────────────────────────────

export async function sendMessageWithFile(
  roomId: string,
  userId: string,
  userName: string,
  file: File
): Promise<void> {
  const uploaded = await uploadToCloudinary(file);
  const isImage = uploaded.resourceType === "image";
  const displayText = isImage ? "📷 Image" : "📎 File";

  const participants = await getRoomParticipants(roomId);
  const otherUsers = participants.filter((id) => id !== userId);

  const batch = writeBatch(db);
  const roomRef = doc(db, "chat_rooms", roomId);

  otherUsers.forEach((uid) => {
    batch.update(roomRef, {
      [`unreadCount.${uid}`]: increment(1),
    });
  });

  const messagesRef = collection(db, "chat_rooms", roomId, "messages");
  const newMsgRef = doc(messagesRef);
  batch.set(newMsgRef, {
    userId,
    userName,
    text: displayText,
    fileUrl: uploaded.url,
    fileName: uploaded.originalName,
    fileType: uploaded.resourceType,
    isImage,
    timestamp: serverTimestamp(),
    isReported: false,
    readBy: [userId],
  });

  batch.update(roomRef, {
    lastMessage: isImage ? "📷 Image" : `📎 ${uploaded.originalName.slice(0, 30)}`,
    lastMessageAt: serverTimestamp(),
    lastMessageUser: userName,
    messageCount: increment(1),
  });

  await batch.commit();
}

export async function sendMessage(data: SendMessageData): Promise<void> {
  const { roomId, userId, userName, text } = data;

  const participants = await getRoomParticipants(roomId);
  const otherUsers = participants.filter((id) => id !== userId);

  const batch = writeBatch(db);
  const roomRef = doc(db, "chat_rooms", roomId);

  otherUsers.forEach((uid) => {
    batch.update(roomRef, {
      [`unreadCount.${uid}`]: increment(1),
    });
  });

  const messagesRef = collection(db, "chat_rooms", roomId, "messages");
  const newMsgRef = doc(messagesRef);
  batch.set(newMsgRef, {
    userId,
    userName,
    text: text.trim(),
    timestamp: serverTimestamp(),
    isReported: false,
    readBy: [userId],
  });

  batch.update(roomRef, {
    lastMessage: text.trim().slice(0, 100),
    lastMessageAt: serverTimestamp(),
    lastMessageUser: userName,
    messageCount: increment(1),
  });

  await batch.commit();
}

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
  await updateDoc(roomRef, { reportedCount: increment(1) });
}

// ✅ FIX: deleteMessageByUser tự xác định role, không nhận isAdmin từ client
export async function deleteMessageByUser(
  roomId: string,
  messageId: string,
  currentUserId: string
): Promise<void> {
  const msgRef = doc(db, "chat_rooms", roomId, "messages", messageId);
  const msgSnap = await getDoc(msgRef);
  if (!msgSnap.exists()) throw new Error("Message not found");
  const msgData = msgSnap.data();

  // Tự xác định quyền của người gọi
  const isOwner = msgData.userId === currentUserId;
  let isAdmin = false;
  if (!isOwner) {
    const userSnap = await getDoc(doc(db, "users", currentUserId));
    const role = userSnap.exists() ? userSnap.data().role : null;
    isAdmin = role === "admin" || role === "moderator";
  }
  if (!isOwner && !isAdmin) {
    throw new Error("You can only delete your own messages");
  }

  await deleteDoc(msgRef);
  const roomRef = doc(db, "chat_rooms", roomId);
  await updateDoc(roomRef, { messageCount: increment(-1) });
}

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

// ─── Room participants management ──────────────────────────────────────────

export async function joinRoom(roomId: string, userId: string): Promise<void> {
  const roomRef = doc(db, "chat_rooms", roomId);
  await updateDoc(roomRef, {
    participants: arrayUnion(userId),
  });
}

export async function leaveRoom(roomId: string, userId: string): Promise<void> {
  const roomRef = doc(db, "chat_rooms", roomId);
  await updateDoc(roomRef, {
    participants: arrayRemove(userId),
  });
}

export async function getRoomParticipants(roomId: string): Promise<string[]> {
  const roomRef = doc(db, "chat_rooms", roomId);
  const snap = await getDoc(roomRef);
  if (!snap.exists()) return [];
  return snap.data().participants || [];
}

// ─── Typing indicator ───────────────────────────────────────────────────────

export async function setTypingStatus(
  roomId: string,
  userId: string,
  userName: string,
  isTyping: boolean
): Promise<void> {
  const typingRef = doc(db, "chat_rooms", roomId, "typing", userId);
  await setDoc(typingRef, {
    userId,
    userName,
    isTyping,
    timestamp: serverTimestamp(),
  });
}

// ✅ FIX: thêm lọc stale typing
export function onTypingStatus(
  roomId: string,
  currentUserId: string,
  callback: (typingUsers: TypingStatus[]) => void
): Unsubscribe {
  const TYPING_STALE_MS = 5000;
  const typingCol = collection(db, "chat_rooms", roomId, "typing");
  const q = query(typingCol, where("isTyping", "==", true));
  return onSnapshot(q, (snap) => {
    const now = Date.now();
    const typingUsers: TypingStatus[] = snap.docs
      .map((d) => d.data() as TypingStatus)
      .filter((t) => t.userId !== currentUserId)
      .filter((t) => {
        const ts = t.timestamp?.toDate?.().getTime();
        return ts ? now - ts < TYPING_STALE_MS : false;
      });
    callback(typingUsers);
  });
}

// ─── Read receipts ──────────────────────────────────────────────────────────

export async function markMessageAsRead(
  roomId: string,
  messageId: string,
  userId: string
): Promise<void> {
  const msgRef = doc(db, "chat_rooms", roomId, "messages", messageId);
  await updateDoc(msgRef, {
    readBy: arrayUnion(userId),
  });
}

// ✅ NEW: batch mark read
export async function markMessagesAsRead(
  roomId: string,
  messageIds: string[],
  userId: string
): Promise<void> {
  if (messageIds.length === 0) return;
  const batch = writeBatch(db);
  messageIds.forEach((id) => {
    const msgRef = doc(db, "chat_rooms", roomId, "messages", id);
    batch.update(msgRef, { readBy: arrayUnion(userId) });
  });
  await batch.commit();
}

export async function markRoomAsRead(
  roomId: string,
  userId: string
): Promise<void> {
  const roomRef = doc(db, "chat_rooms", roomId);
  await updateDoc(roomRef, {
    [`unreadCount.${userId}`]: 0,
  });
}

// ─── Reactions ──────────────────────────────────────────────────────────────

export async function toggleReaction(
  roomId: string,
  messageId: string,
  emoji: string,
  userId: string
): Promise<void> {
  const msgRef = doc(db, "chat_rooms", roomId, "messages", messageId);
  const msgSnap = await getDoc(msgRef);
  if (!msgSnap.exists()) return;

  const reactions: Record<string, string[]> = msgSnap.data().reactions ?? {};
  const current = reactions[emoji] ?? [];
  const hasReacted = current.includes(userId);

  await updateDoc(msgRef, {
    [`reactions.${emoji}`]: hasReacted
      ? arrayRemove(userId)
      : arrayUnion(userId),
  });
}

// ─── Reply ──────────────────────────────────────────────────────────────────

export async function replyMessage(
  roomId: string,
  userId: string,
  userName: string,
  text: string,
  replyTo: string,
  replyToText: string,
  replyToUser: string
): Promise<void> {
  const participants = await getRoomParticipants(roomId);
  const otherUsers = participants.filter((id) => id !== userId);

  const batch = writeBatch(db);
  const roomRef = doc(db, "chat_rooms", roomId);

  otherUsers.forEach((uid) => {
    batch.update(roomRef, {
      [`unreadCount.${uid}`]: increment(1),
    });
  });

  const messagesRef = collection(db, "chat_rooms", roomId, "messages");
  const newMsgRef = doc(messagesRef);
  batch.set(newMsgRef, {
    userId,
    userName,
    text: text.trim(),
    timestamp: serverTimestamp(),
    isReported: false,
    readBy: [userId],
    replyTo,
    replyToText: replyToText.slice(0, 120),
    replyToUser,
  });

  batch.update(roomRef, {
    lastMessage: text.trim().slice(0, 100),
    lastMessageAt: serverTimestamp(),
    lastMessageUser: userName,
    messageCount: increment(1),
  });

  await batch.commit();
}

// ─── Pin / Unpin (có kiểm tra quyền) ──────────────────────────────────────

async function assertCanModerate(userId: string): Promise<void> {
  const userSnap = await getDoc(doc(db, "users", userId));
  const role = userSnap.exists() ? userSnap.data().role : null;
  if (role !== "admin" && role !== "moderator") {
    throw new Error("Only admins or moderators can perform this action");
  }
}

// ✅ FIX: thêm kiểm tra quyền trước khi pin
export async function pinMessage(
  roomId: string,
  messageId: string,
  userId: string
): Promise<void> {
  await assertCanModerate(userId);
  const msgRef = doc(db, "chat_rooms", roomId, "messages", messageId);
  await updateDoc(msgRef, {
    isPinned: true,
    pinnedBy: userId,
    pinnedAt: serverTimestamp(),
  });
  const roomRef = doc(db, "chat_rooms", roomId);
  await updateDoc(roomRef, { pinnedMessageId: messageId });
}

// ✅ FIX: thêm kiểm tra quyền, thêm tham số userId
export async function unpinMessage(
  roomId: string,
  messageId: string,
  userId: string
): Promise<void> {
  await assertCanModerate(userId);
  const msgRef = doc(db, "chat_rooms", roomId, "messages", messageId);
  await updateDoc(msgRef, { isPinned: false, pinnedBy: null, pinnedAt: null });
  const roomRef = doc(db, "chat_rooms", roomId);
  await updateDoc(roomRef, { pinnedMessageId: null });
}

// ─── Presence ──────────────────────────────────────────────────────────────

export async function updateUserPresence(
  userId: string,
  status: PresenceStatus["status"]
): Promise<void> {
  const presenceRef = doc(db, "presence", userId);
  await setDoc(
    presenceRef,
    { userId, status, lastSeen: serverTimestamp() },
    { merge: true }
  );
}

export function onUserPresence(
  userId: string,
  callback: (presence: PresenceStatus | null) => void
): Unsubscribe {
  const presenceRef = doc(db, "presence", userId);
  return onSnapshot(presenceRef, (snap) => {
    callback(snap.exists() ? (snap.data() as PresenceStatus) : null);
  });
}

// ─── Course Community ──────────────────────────────────────────────────────

export async function createCourseCommunity(
  courseId: string,
  instructorId: string,
  courseName: string,
  courseDescription?: string
): Promise<string> {
  const roomsRef = collection(db, "chat_rooms");
  const q = query(roomsRef, where("courseId", "==", courseId));
  const snap = await getDocs(q);

  if (!snap.empty) {
    return snap.docs[0].id;
  }

  const roomName = `${courseName} Community`;
  const roomDescription = courseDescription || `Community for course: ${courseName}`;

  const roomData = {
    name: roomName,
    description: roomDescription,
    type: "course" as const,
    isActive: true,
    isLocked: false,
    memberCount: 0,
    messageCount: 0,
    reportedCount: 0,
    courseId,
    instructorId,
    isPrivate: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    participants: [instructorId],
    pinned: false,
    lastMessage: "Welcome to the community!",
    lastMessageAt: serverTimestamp(),
    lastMessageUser: "System",
  };

  const docRef = await addDoc(collection(db, "chat_rooms"), roomData);
  return docRef.id;
}

export async function getCourseCommunityRoomId(courseId: string): Promise<string | null> {
  const roomsRef = collection(db, "chat_rooms");
  const q = query(roomsRef, where("courseId", "==", courseId));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  return snap.docs[0].id;
}

export async function canAccessCommunity(
  roomId: string,
  userId: string,
  userRole?: "admin" | "moderator" | "instructor" | "student"
): Promise<boolean> {
  if (userRole === "admin") return true;

  const roomRef = doc(db, "chat_rooms", roomId);
  const roomSnap = await getDoc(roomRef);
  if (!roomSnap.exists()) return false;
  const room = roomSnap.data();

  if (!room.isPrivate) return true;

  if (room.type === "course" && room.courseId) {
    if (room.instructorId === userId) return true;
    return checkUserEnrollment(userId, room.courseId);
  }

  return false;
}
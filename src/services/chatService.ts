/**
 * src/services/chatService.ts
 * Client chat operations (Firestore + Cloudinary upload)
 * Mở rộng: typing indicator, online presence, read receipts,
 *           reactions, reply, pin message, unreadCount increment,
 *           course community
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
  getDocs, // ✅ ĐÃ THÊM getDocs
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

// ─── Core message operations (giữ nguyên và bổ sung unreadCount) ──────────

export async function sendMessageWithFile(
  roomId: string,
  userId: string,
  userName: string,
  file: File
): Promise<void> {
  const uploaded = await uploadToCloudinary(file);
  const isImage = uploaded.resourceType === "image";
  const displayText = isImage ? "📷 Image" : "📎 File";

  // Lấy danh sách participants trừ người gửi
  const participants = await getRoomParticipants(roomId);
  const otherUsers = participants.filter((id) => id !== userId);

  const batch = writeBatch(db);
  const roomRef = doc(db, "chat_rooms", roomId);

  // Tăng unreadCount cho mỗi user khác
  otherUsers.forEach((uid) => {
    batch.update(roomRef, {
      [`unreadCount.${uid}`]: increment(1),
    });
  });

  // Thêm tin nhắn
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

  // Cập nhật room info
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

  // Lấy danh sách participants trừ người gửi
  const participants = await getRoomParticipants(roomId);
  const otherUsers = participants.filter((id) => id !== userId);

  const batch = writeBatch(db);
  const roomRef = doc(db, "chat_rooms", roomId);

  // Tăng unreadCount cho mỗi user khác
  otherUsers.forEach((uid) => {
    batch.update(roomRef, {
      [`unreadCount.${uid}`]: increment(1),
    });
  });

  // Thêm tin nhắn
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

  // Cập nhật room info
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

export async function deleteMessageByUser(
  roomId: string,
  messageId: string,
  currentUserId: string,
  isAdmin = false
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

// ─── NEW: Room participants management ──────────────────────────────────────

/**
 * Thêm userId vào danh sách participants của room (nếu chưa có)
 * Gọi khi user vào phòng chat
 */
export async function joinRoom(roomId: string, userId: string): Promise<void> {
  const roomRef = doc(db, "chat_rooms", roomId);
  await updateDoc(roomRef, {
    participants: arrayUnion(userId),
  });
}

/**
 * Xóa userId khỏi danh sách participants của room
 * Gọi khi user rời phòng (unmount)
 */
export async function leaveRoom(roomId: string, userId: string): Promise<void> {
  const roomRef = doc(db, "chat_rooms", roomId);
  await updateDoc(roomRef, {
    participants: arrayRemove(userId),
  });
}

/**
 * Lấy danh sách participants của room
 */
export async function getRoomParticipants(roomId: string): Promise<string[]> {
  const roomRef = doc(db, "chat_rooms", roomId);
  const snap = await getDoc(roomRef);
  if (!snap.exists()) return [];
  return snap.data().participants || [];
}

// ─── NEW: Typing indicator ───────────────────────────────────────────────────

/**
 * Cập nhật trạng thái đang nhập vào subcollection typing của phòng.
 * Document ID = userId để mỗi user chỉ có 1 doc.
 */
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

/**
 * Lắng nghe realtime danh sách người đang nhập trong phòng.
 * Tự lọc bỏ userId của bản thân và các doc isTyping = false.
 */
export function onTypingStatus(
  roomId: string,
  currentUserId: string,
  callback: (typingUsers: TypingStatus[]) => void
): Unsubscribe {
  const typingCol = collection(db, "chat_rooms", roomId, "typing");
  const q = query(typingCol, where("isTyping", "==", true));

  return onSnapshot(q, (snap) => {
    const typingUsers: TypingStatus[] = snap.docs
      .map((d) => d.data() as TypingStatus)
      .filter((t) => t.userId !== currentUserId);
    callback(typingUsers);
  });
}

// ─── NEW: Read receipts ──────────────────────────────────────────────────────

/**
 * Đánh dấu 1 tin nhắn đã đọc (thêm userId vào readBy array).
 */
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

/**
 * Reset unreadCount của userId trong room về 0
 */
export async function markRoomAsRead(
  roomId: string,
  userId: string
): Promise<void> {
  const roomRef = doc(db, "chat_rooms", roomId);
  await updateDoc(roomRef, {
    [`unreadCount.${userId}`]: 0,
  });
}

// ─── NEW: Reactions ──────────────────────────────────────────────────────────

/**
 * Thêm reaction emoji vào tin nhắn.
 * Nếu user đã react emoji đó rồi → tự động remove (toggle).
 */
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

// ─── NEW: Reply ──────────────────────────────────────────────────────────────

/**
 * Gửi tin nhắn trả lời, kèm snapshot nội dung tin gốc.
 */
export async function replyMessage(
  roomId: string,
  userId: string,
  userName: string,
  text: string,
  replyTo: string,
  replyToText: string,
  replyToUser: string
): Promise<void> {
  // Lấy danh sách participants trừ người gửi
  const participants = await getRoomParticipants(roomId);
  const otherUsers = participants.filter((id) => id !== userId);

  const batch = writeBatch(db);
  const roomRef = doc(db, "chat_rooms", roomId);

  // Tăng unreadCount cho mỗi user khác
  otherUsers.forEach((uid) => {
    batch.update(roomRef, {
      [`unreadCount.${uid}`]: increment(1),
    });
  });

  // Thêm tin nhắn reply
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

  // Cập nhật room info
  batch.update(roomRef, {
    lastMessage: text.trim().slice(0, 100),
    lastMessageAt: serverTimestamp(),
    lastMessageUser: userName,
    messageCount: increment(1),
  });

  await batch.commit();
}

// ─── NEW: Pin message ────────────────────────────────────────────────────────

/**
 * Ghim tin nhắn lên đầu phòng (chỉ admin/moderator).
 */
export async function pinMessage(
  roomId: string,
  messageId: string,
  userId: string
): Promise<void> {
  const msgRef = doc(db, "chat_rooms", roomId, "messages", messageId);
  await updateDoc(msgRef, {
    isPinned: true,
    pinnedBy: userId,
    pinnedAt: serverTimestamp(),
  });
  const roomRef = doc(db, "chat_rooms", roomId);
  await updateDoc(roomRef, { pinnedMessageId: messageId });
}

export async function unpinMessage(
  roomId: string,
  messageId: string
): Promise<void> {
  const msgRef = doc(db, "chat_rooms", roomId, "messages", messageId);
  await updateDoc(msgRef, {
    isPinned: false,
    pinnedBy: null,
    pinnedAt: null,
  });
  const roomRef = doc(db, "chat_rooms", roomId);
  await updateDoc(roomRef, { pinnedMessageId: null });
}

// ─── NEW: Presence ───────────────────────────────────────────────────────────

/**
 * Cập nhật trạng thái online của user vào collection `presence`.
 */
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

/**
 * Lắng nghe presence của 1 userId.
 */
export function onUserPresence(
  userId: string,
  callback: (presence: PresenceStatus | null) => void
): Unsubscribe {
  const presenceRef = doc(db, "presence", userId);
  return onSnapshot(presenceRef, (snap) => {
    callback(snap.exists() ? (snap.data() as PresenceStatus) : null);
  });
}

// ─── NEW: Course Community ───────────────────────────────────────────────────

/**
 * Tạo một course community room.
 * Chỉ được gọi khi course được publish và enableCommunity === true.
 * Đảm bảo không tạo trùng lặp.
 */
export async function createCourseCommunity(
  courseId: string,
  instructorId: string,
  courseName: string,
  courseDescription?: string
): Promise<string> {
  // Kiểm tra xem room đã tồn tại chưa
  const roomsRef = collection(db, "chat_rooms");
  const q = query(roomsRef, where("courseId", "==", courseId));
  const snap = await getDocs(q);

  if (!snap.empty) {
    // Đã có room, trả về id
    return snap.docs[0].id;
  }

  // Tạo room mới
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
    participants: [instructorId], // instructor tự động tham gia
    pinned: false,
    lastMessage: "Welcome to the community!",
    lastMessageAt: serverTimestamp(),
    lastMessageUser: "System",
  };

  const docRef = await addDoc(collection(db, "chat_rooms"), roomData);
  return docRef.id;
}

/**
 * Lấy roomId của course community (nếu có)
 */
export async function getCourseCommunityRoomId(courseId: string): Promise<string | null> {
  const roomsRef = collection(db, "chat_rooms");
  const q = query(roomsRef, where("courseId", "==", courseId));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  return snap.docs[0].id;
}

/**
 * Kiểm tra xem user có quyền truy cập vào một course community không
 */
export async function canAccessCommunity(
  roomId: string,
  userId: string,
  userRole?: "admin" | "moderator" | "instructor" | "student"
): Promise<boolean> {
  // Admin luôn có quyền
  if (userRole === "admin") return true;

  const roomRef = doc(db, "chat_rooms", roomId);
  const roomSnap = await getDoc(roomRef);
  if (!roomSnap.exists()) return false;
  const room = roomSnap.data();

  // Nếu không phải private room, cho phép (public)
  if (!room.isPrivate) return true;

  // Nếu là private course community
  if (room.type === "course" && room.courseId) {
    // Instructor của course có quyền
    if (room.instructorId === userId) return true;

    // Kiểm tra enrollment
    return checkUserEnrollment(userId, room.courseId);
  }

  return false;
}
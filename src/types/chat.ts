// src/types/chat.ts
/**
 * src/types/chat.ts
 * Định nghĩa kiểu dữ liệu cho module Chat
 * Mở rộng: Course Community
 */

import { Timestamp } from "firebase/firestore";

// ─── Message ────────────────────────────────────────────────────────────────

export interface ChatMessage {
  id: string;
  userId: string;
  userName: string;
  text: string;
  timestamp: Timestamp | null;

  // File attachment
  fileUrl?: string;
  fileName?: string;
  fileType?: string;
  isImage?: boolean;

  // Flags
  isReported?: boolean;
  isEdited?: boolean;
  editedAt?: Timestamp | null;

  // Priority-High additions
  readBy?: string[];              // danh sách userId đã đọc

  // Priority-Medium additions
  reactions?: Record<string, string[]>; // emoji → [userId, ...]
  replyTo?: string | null;              // messageId gốc được reply
  replyToText?: string | null;          // snapshot nội dung tin gốc
  replyToUser?: string | null;          // tên người gửi tin gốc
  isPinned?: boolean;
  pinnedBy?: string | null;
  pinnedAt?: Timestamp | null;
}

// ─── Room ────────────────────────────────────────────────────────────────────

export interface ChatRoom {
  id: string;
  name: string;
  description: string;
  type: "general" | "study" | "course" | "announcement";
  isActive: boolean;
  isLocked: boolean;
  memberCount: number;
  messageCount: number;
  lastMessage?: string;
  lastMessageAt?: Timestamp | null;
  lastMessageUser?: string;
  unreadCount?: Record<string, number>;
  participants?: string[];       // danh sách userId đang tham gia
  pinnedMessageId?: string | null;
  
  // 🆕 Course Community fields
  courseId?: string;             // reference đến courses/{courseId}
  instructorId?: string;         // userId của instructor tạo course
  isPrivate?: boolean;           // true cho course community (chỉ enrolled/instructor mới vào được)
  
  // Metadata
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

// ─── Typing ─────────────────────────────────────────────────────────────────

export interface TypingStatus {
  userId: string;
  userName: string;
  isTyping: boolean;
  timestamp: Timestamp | null;
}

// ─── Presence ───────────────────────────────────────────────────────────────

export type OnlineStatus = "online" | "offline" | "away";

export interface PresenceStatus {
  userId: string;
  status: OnlineStatus;
  lastSeen: Timestamp | null;
}

// ─── Subscription ──────────────────────────────────────────────────────────

export type SubscriptionTier = "free" | "pro";

export interface UserSubscription {
  tier: SubscriptionTier;
  expiresAt?: Timestamp | null;
  isActive: boolean;
}
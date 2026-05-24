/**
 * Smart Review — Admin Community Management
 * React + TypeScript + Firebase SDK v9+
 *
 * File: src/pages/admin/CommunityAdmin.tsx
 *
 * Exports:
 *   default CommunityAdmin (tabbed wrapper)
 *   CommunityRoomsAdmin
 *   ReportedMessagesAdmin
 *
 * Production split:
 *   components/admin/community/RoomCard.tsx
 *   components/admin/community/RoomFormDialog.tsx
 *   components/admin/community/MemberList.tsx
 *   components/admin/community/MessagePreviewModal.tsx
 *   components/admin/community/ReportedMessageRow.tsx
 *   hooks/useChatRooms.ts
 *   hooks/useReportedMessages.ts
 *
 * Dependencies: firebase  lucide-react
 */

"use client";

import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  type ReactNode,
} from "react";

// ─── Firebase (uncomment in production) ─────────────────────────────────────
// import { db } from "@/lib/firebase";
// import {
//   collection, query, where, orderBy, onSnapshot, doc,
//   updateDoc, deleteDoc, addDoc, serverTimestamp, increment,
//   getDocs, limit,
// } from "firebase/firestore";

// ─── Lucide icons ─────────────────────────────────────────────────────────────
import {
  Users, MessageSquare, Flag, Shield, Trash2, Eye,
  EyeOff, Plus, Edit3, X, Check, AlertTriangle,
  Search, RefreshCw, Loader, ChevronRight, MoreVertical,
  Hash, Lock, Unlock, Bell, BellOff, Send, Clock,
  CheckCircle, XCircle, AlertOctagon, Info, Copy,
  ArrowLeft, Filter, Radio, Activity,
  UserX, Ban, ShieldAlert, Flame, BarChart2,
  MessageCircle, Zap, Save,
} from "lucide-react";

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

type RoomType    = "general" | "study" | "course" | "announcement";
type ReportAction = "delete" | "warn" | "ignore" | "ban";

interface ChatRoom {
  id: string;
  name: string;
  description: string;
  type: RoomType;
  isActive: boolean;
  isLocked: boolean;
  memberCount: number;
  messageCount: number;
  reportedCount: number;
  lastMessage?: string;
  lastMessageAt?: Date;
  lastMessageUser?: string;
  createdAt: Date;
  pinned: boolean;
  subject?: string;
}

interface RoomMember {
  userId: string;
  displayName: string;
  role: "admin" | "moderator" | "member";
  joinedAt: Date;
  messageCount: number;
  status: "online" | "offline";
}

interface ChatMessage {
  id: string;
  roomId: string;
  roomName: string;
  text: string;
  userId: string;
  userName: string;
  timestamp: Date;
  isReported: boolean;
  reportReason?: string;
  reportedBy?: string;
  reportedAt?: Date;
  attachmentUrl?: string;
  warningCount?: number;
}

interface EditRoomForm {
  name: string;
  description: string;
  type: RoomType;
  isActive: boolean;
  isLocked: boolean;
  subject: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// MOCK DATA
// ═══════════════════════════════════════════════════════════════════════════

const MOCK_ROOMS: ChatRoom[] = [
  { id: "room_001", name: "Luyện thi TOEIC 800+",      description: "Phòng ôn thi TOEIC chuyên sâu cho mục tiêu 800+",           type: "study",        isActive: true,  isLocked: false, memberCount: 247, messageCount: 3_482, reportedCount: 3,  lastMessage: "Cần thêm tài liệu về Listening Part 4", lastMessageAt: new Date(Date.now() - 1000 * 60 * 8),   lastMessageUser: "Minh Tuấn", createdAt: new Date("2024-11-01"), pinned: true,  subject: "IELTS/TOEIC" },
  { id: "room_002", name: "Fullstack Developers VN",   description: "Thảo luận lập trình web fullstack: React, Node, Firebase",   type: "general",      isActive: true,  isLocked: false, memberCount: 891, messageCount: 12_440, reportedCount: 1, lastMessage: "Tailwind v4 có gì mới không anh em?",     lastMessageAt: new Date(Date.now() - 1000 * 60 * 22),  lastMessageUser: "Minh Lê",   createdAt: new Date("2024-10-15"), pinned: true,  subject: "Development" },
  { id: "room_003", name: "IELTS Speaking Practice",   description: "Practice IELTS Speaking with native-like discussions",      type: "study",        isActive: true,  isLocked: false, memberCount: 134, messageCount: 2_210,  reportedCount: 7,  lastMessage: "Let's discuss about environmental issues", lastMessageAt: new Date(Date.now() - 1000 * 60 * 60 * 3), lastMessageUser: "Lan Anh", createdAt: new Date("2024-12-01"), pinned: false, subject: "IELTS" },
  { id: "room_004", name: "Kỹ năng mềm & Mindset",    description: "Chia sẻ kinh nghiệm quản lý thời gian và tư duy phát triển", type: "general",      isActive: true,  isLocked: false, memberCount: 312, messageCount: 4_120,  reportedCount: 0,  lastMessage: "Cách để duy trì động lực học tập mỗi ngày?", lastMessageAt: new Date(Date.now() - 1000 * 60 * 60 * 8), lastMessageUser: "Hoàng Dev", createdAt: new Date("2024-11-20"), pinned: false, subject: "Soft Skills" },
  { id: "room_005", name: "Advanced React Patterns",   description: "Thảo luận khoá học Advanced React – hỏi đáp bài tập",      type: "course",       isActive: true,  isLocked: false, memberCount: 68,  messageCount: 890,    reportedCount: 0,  lastMessage: "Module 3 assignment hint needed",          lastMessageAt: new Date(Date.now() - 1000 * 60 * 60 * 14), lastMessageUser: "Long NP",  createdAt: new Date("2025-01-10"), pinned: false, subject: "Development" },
  { id: "room_006", name: "Thông báo hệ thống",        description: "Kênh thông báo chính thức từ đội ngũ Smart Review",        type: "announcement", isActive: true,  isLocked: true,  memberCount: 12_847, messageCount: 42,  reportedCount: 0,  lastMessage: "Tính năng AI Writing đã được cập nhật!",  lastMessageAt: new Date(Date.now() - 1000 * 60 * 60 * 2),  lastMessageUser: "Admin",     createdAt: new Date("2024-10-01"), pinned: true,  subject: "System" },
  { id: "room_007", name: "Off-topic & Chém gió",      description: "Nơi nói chuyện tự do, không liên quan đến học tập",        type: "general",      isActive: false, isLocked: false, memberCount: 445, messageCount: 8_330,  reportedCount: 12, lastMessage: "**Phòng tạm khóa**",                      lastMessageAt: new Date(Date.now() - 1000 * 60 * 60 * 48), lastMessageUser: "System",    createdAt: new Date("2024-10-05"), pinned: false, subject: "General" },
];

const MOCK_MEMBERS: RoomMember[] = [
  { userId: "u1", displayName: "Minh Tuấn",   role: "admin",     joinedAt: new Date("2024-11-01"), messageCount: 342, status: "online" },
  { userId: "u2", displayName: "Lan Anh",      role: "moderator", joinedAt: new Date("2024-11-05"), messageCount: 218, status: "online" },
  { userId: "u3", displayName: "Hoàng Dev",    role: "member",    joinedAt: new Date("2024-11-10"), messageCount: 95,  status: "offline" },
  { userId: "u4", displayName: "Linh Nguyễn",  role: "member",    joinedAt: new Date("2024-11-15"), messageCount: 67,  status: "online" },
  { userId: "u5", displayName: "Long NP",      role: "member",    joinedAt: new Date("2024-12-01"), messageCount: 43,  status: "offline" },
];

const MOCK_MESSAGES: ChatMessage[] = [
  { id: "msg_001", roomId: "room_007", roomName: "Off-topic & Chém gió",     text: "Link tài liệu crack phần mềm đây anh em: http://crack.xyz/...",       userId: "u_bad1", userName: "spam_user_99",  timestamp: new Date(Date.now() - 1000 * 60 * 30),       isReported: true, reportReason: "spam",        reportedBy: "Lan Anh",    reportedAt: new Date(Date.now() - 1000 * 60 * 25) },
  { id: "msg_002", roomId: "room_003", roomName: "IELTS Speaking Practice",  text: "Bài làm của mày chán vãi ra, không có não học mà cũng đòi thi IELTS", userId: "u_bad2", userName: "angry_user",    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2),   isReported: true, reportReason: "harassment",  reportedBy: "Minh Tuấn",  reportedAt: new Date(Date.now() - 1000 * 60 * 90) },
  { id: "msg_003", roomId: "room_001", roomName: "Luyện thi TOEIC 800+",     text: "Mua chứng chỉ TOEIC giả giá rẻ LH zalo: 0912345678",                  userId: "u_bad3", userName: "cert_seller",   timestamp: new Date(Date.now() - 1000 * 60 * 60 * 5),   isReported: true, reportReason: "fraud",       reportedBy: "Hoàng Dev",  reportedAt: new Date(Date.now() - 1000 * 60 * 60 * 4) },
  { id: "msg_004", roomId: "room_007", roomName: "Off-topic & Chém gió",     text: "ĐM cái app này lỗi hoài, bọn dev kém cỏi vãi",                        userId: "u_bad4", userName: "frustrated_04",  timestamp: new Date(Date.now() - 1000 * 60 * 60 * 10),  isReported: true, reportReason: "hate_speech", reportedBy: "Long NP",    reportedAt: new Date(Date.now() - 1000 * 60 * 60 * 9) },
  { id: "msg_005", roomId: "room_003", roomName: "IELTS Speaking Practice",  text: "Ảnh của con bé X đây, đẹp không (kèm ảnh không phù hợp)",             userId: "u_bad5", userName: "anon_poster",   timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24),  isReported: true, reportReason: "inappropriate", reportedBy: "Linh Nguyễn", reportedAt: new Date(Date.now() - 1000 * 60 * 60 * 23), warningCount: 1 },
  { id: "msg_006", roomId: "room_001", roomName: "Luyện thi TOEIC 800+",     text: "Copy đề thi chính thức TOEIC 2025 đây: [file đính kèm]",              userId: "u_bad6", userName: "exam_leaker",   timestamp: new Date(Date.now() - 1000 * 60 * 60 * 36),  isReported: true, reportReason: "ip_violation", reportedBy: "Minh Tuấn",  reportedAt: new Date(Date.now() - 1000 * 60 * 60 * 35) },
  { id: "msg_007", roomId: "room_007", roomName: "Off-topic & Chém gió",     text: "Crypto guaranteed 500% returns join my telegram NOW!!!",              userId: "u_bad7", userName: "crypto_scam",   timestamp: new Date(Date.now() - 1000 * 60 * 60 * 48),  isReported: true, reportReason: "scam",        reportedBy: "Lan Anh",    reportedAt: new Date(Date.now() - 1000 * 60 * 60 * 47), warningCount: 2 },
];

const MOCK_ROOM_MESSAGES: ChatMessage[] = [
  { id: "rm1", roomId: "room_001", roomName: "Luyện thi TOEIC 800+", text: "Mọi người ơi câu 45 test 2 chọn gì vậy?",           userId: "u1", userName: "Minh Tuấn",  timestamp: new Date(Date.now() - 1000 * 60 * 8),  isReported: false },
  { id: "rm2", roomId: "room_001", roomName: "Luyện thi TOEIC 800+", text: "Câu đó chọn B nha, vì mệnh đề quan hệ...",          userId: "u2", userName: "Lan Anh",    timestamp: new Date(Date.now() - 1000 * 60 * 7),  isReported: false },
  { id: "rm3", roomId: "room_001", roomName: "Luyện thi TOEIC 800+", text: "Thanks! Phần Listening mình vẫn còn yếu lắm 😢",    userId: "u3", userName: "Hoàng Dev",  timestamp: new Date(Date.now() - 1000 * 60 * 5),  isReported: false },
  { id: "rm4", roomId: "room_001", roomName: "Luyện thi TOEIC 800+", text: "Mua chứng chỉ TOEIC giả giá rẻ LH: 0912345678",    userId: "u_bad3", userName: "cert_seller", timestamp: new Date(Date.now() - 1000 * 60 * 60 * 5), isReported: true, reportReason: "fraud" },
  { id: "rm5", roomId: "room_001", roomName: "Luyện thi TOEIC 800+", text: "Có ai có tài liệu đề thi thật không chia sẻ cho mình với", userId: "u4", userName: "Linh Nguyễn", timestamp: new Date(Date.now() - 1000 * 60 * 2), isReported: false },
];

// ═══════════════════════════════════════════════════════════════════════════
// HOOKS
// ═══════════════════════════════════════════════════════════════════════════

function useChatRooms() {
  const [rooms, setRooms]     = useState<ChatRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<Error | null>(null);
  const [lastSync, setLastSync] = useState<Date | null>(null);

  const fetch = useCallback(() => {
    setLoading(true); setError(null);
    // ── REAL FIREBASE ──────────────────────────────────────────────────
    // const q = query(collection(db, "chat_rooms"), orderBy("pinned","desc"), orderBy("lastMessageAt","desc"));
    // const unsub = onSnapshot(q, (snap) => {
    //   setRooms(snap.docs.map((d) => ({ id: d.id, ...d.data(), createdAt: d.data().createdAt?.toDate(), lastMessageAt: d.data().lastMessageAt?.toDate() })) as ChatRoom[]);
    //   setLastSync(new Date()); setLoading(false);
    // }, (err) => { setError(err); setLoading(false); });
    // return () => unsub();
    const t = setTimeout(() => { setRooms(MOCK_ROOMS); setLastSync(new Date()); setLoading(false); }, 800);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => { const c = fetch(); return c; }, [fetch]);
  return { rooms, loading, error, lastSync, refetch: fetch };
}

function useReportedMessages() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    // ── REAL FIREBASE ──────────────────────────────────────────────────
    // const q = query(
    //   collectionGroup(db, "messages"),
    //   where("isReported", "==", true),
    //   orderBy("reportedAt", "desc")
    // );
    // const unsub = onSnapshot(q, (snap) => {
    //   setMessages(snap.docs.map((d) => ({ id: d.id, ...d.data(), timestamp: d.data().timestamp?.toDate(), reportedAt: d.data().reportedAt?.toDate() })) as ChatMessage[]);
    //   setLoading(false);
    // });
    // return () => unsub();
    const t = setTimeout(() => { setMessages(MOCK_MESSAGES); setLoading(false); }, 700);
    return () => clearTimeout(t);
  }, []);

  return { messages, setMessages, loading };
}

function useRoomMessages(roomId: string | null) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading]   = useState(false);

  useEffect(() => {
    if (!roomId) return;
    setLoading(true);
    // ── REAL FIREBASE ──────────────────────────────────────────────────
    // const q = query(collection(db, "chat_rooms", roomId, "messages"), orderBy("timestamp","desc"), limit(100));
    // const unsub = onSnapshot(q, (snap) => {
    //   setMessages(snap.docs.map((d) => ({ id: d.id, ...d.data(), timestamp: d.data().timestamp?.toDate() })) as ChatMessage[]);
    //   setLoading(false);
    // });
    // return () => unsub();
    const t = setTimeout(() => { setMessages(MOCK_ROOM_MESSAGES.filter((m) => m.roomId === roomId)); setLoading(false); }, 500);
    return () => clearTimeout(t);
  }, [roomId]);

  return { messages, loading };
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

const fmtNum = (n: number) => new Intl.NumberFormat("en-US", { notation: "compact" }).format(n);
const fmtDate = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
const timeAgo = (d: Date) => {
  const s = (Date.now() - d.getTime()) / 1000;
  if (s < 60)    return `${Math.floor(s)}s ago`;
  if (s < 3600)  return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};

const REPORT_REASON_CFG: Record<string, { label: string; color: string; bg: string; Icon: React.ElementType }> = {
  spam:          { label: "Spam",            color: "#FFB785", bg: "rgba(255,183,133,.14)", Icon: Zap       },
  harassment:    { label: "Harassment",      color: "#ffb4ab", bg: "rgba(255,180,171,.14)", Icon: UserX     },
  hate_speech:   { label: "Hate Speech",     color: "#ffb4ab", bg: "rgba(255,180,171,.14)", Icon: AlertOctagon },
  fraud:         { label: "Fraud/Scam",      color: "#ff6b6b", bg: "rgba(255,107,107,.14)", Icon: Ban       },
  inappropriate: { label: "Inappropriate",   color: "#FFB785", bg: "rgba(255,183,133,.14)", Icon: Flag      },
  ip_violation:  { label: "IP Violation",    color: "#c4c0ff", bg: "rgba(196,192,255,.14)", Icon: Shield    },
  scam:          { label: "Scam",            color: "#ff6b6b", bg: "rgba(255,107,107,.14)", Icon: ShieldAlert },
};

const ROOM_TYPE_CFG: Record<RoomType, { label: string; color: string; bg: string; Icon: React.ElementType }> = {
  general:      { label: "General",      color: "#c4c0ff", bg: "rgba(196,192,255,.1)", Icon: Hash },
  study:        { label: "Study",        color: "#45f1c5", bg: "rgba(69,241,197,.1)",  Icon: BarChart2 },
  course:       { label: "Course",       color: "#6C63FF", bg: "rgba(108,99,255,.1)",  Icon: MessageCircle },
  announcement: { label: "Announcement", color: "#FFD700", bg: "rgba(255,215,0,.1)",   Icon: Bell },
};

// ═══════════════════════════════════════════════════════════════════════════
// SHARED STYLES
// ═══════════════════════════════════════════════════════════════════════════

const IS: React.CSSProperties = {
  width: "100%", background: "#0d0d18",
  border: "1px solid rgba(255,255,255,.08)", borderRadius: 10,
  padding: "9px 12px", color: "#E4E1EE", fontSize: 13,
  outline: "none", fontFamily: "Inter,sans-serif", transition: "border-color .2s",
};

function focusBorder(e: React.FocusEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
  e.target.style.borderColor = "rgba(108,99,255,.55)";
}
function blurBorder(e: React.FocusEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
  e.target.style.borderColor = "rgba(255,255,255,.08)";
}

// ═══════════════════════════════════════════════════════════════════════════
// TOAST
// ═══════════════════════════════════════════════════════════════════════════

interface Toast { id: string; msg: string; type: "success" | "error" | "warning" | "info"; }
function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const add = useCallback((msg: string, type: Toast["type"] = "success") => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t, { id, msg, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3400);
  }, []);
  return { toasts, add };
}
function ToastContainer({ toasts }: { toasts: Toast[] }) {
  const c = { success: "#45f1c5", error: "#ffb4ab", warning: "#FFB785", info: "#c4c0ff" };
  return (
    <div style={{ position: "fixed", bottom: 24, right: 24, zIndex: 99999, display: "flex", flexDirection: "column", gap: 10 }}>
      {toasts.map((t) => (
        <div key={t.id} style={{ background: "rgba(26,26,46,.97)", border: `1px solid ${c[t.type]}40`, borderRadius: 14, padding: "11px 18px", color: c[t.type], fontSize: 13, fontWeight: 700, fontFamily: "Inter,sans-serif", boxShadow: `0 8px 30px rgba(0,0,0,.5)`, animation: "slideInR .3s ease", maxWidth: 360 }}>
          {t.msg}
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// RoomCard
// ═══════════════════════════════════════════════════════════════════════════

interface RoomCardProps {
  room: ChatRoom;
  onEdit: (r: ChatRoom) => void;
  onViewMessages: (r: ChatRoom) => void;
  onToggleActive: (r: ChatRoom) => void;
  onToggleLock: (r: ChatRoom) => void;
  onDelete: (r: ChatRoom) => void;
}

function RoomCard({ room, onEdit, onViewMessages, onToggleActive, onToggleLock, onDelete }: RoomCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const tc = ROOM_TYPE_CFG[room.type];
  const TypeIcon = tc.Icon;

  useEffect(() => {
    const h = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  return (
    <div style={{
      background: "rgba(26,26,46,.65)", border: `1px solid ${room.reportedCount > 0 ? "rgba(255,180,171,.2)" : "rgba(255,255,255,.06)"}`,
      borderRadius: 18, padding: "16px 18px", backdropFilter: "blur(14px)",
      transition: "all .2s", position: "relative",
      boxShadow: room.pinned ? "0 0 20px rgba(108,99,255,.1)" : undefined,
      opacity: room.isActive ? 1 : .65,
    }}
      onMouseOver={(e) => (e.currentTarget.style.borderColor = room.reportedCount > 0 ? "rgba(255,180,171,.35)" : "rgba(255,255,255,.12)")}
      onMouseOut={(e)  => (e.currentTarget.style.borderColor = room.reportedCount > 0 ? "rgba(255,180,171,.2)" : "rgba(255,255,255,.06)")}
    >
      {/* Pinned tag */}
      {room.pinned && (
        <div style={{ position: "absolute", top: -1, left: 18, background: "linear-gradient(135deg,#6C63FF,#9B59B6)", color: "#fff", fontSize: 9, fontWeight: 800, padding: "2px 8px", borderRadius: "0 0 6px 6px", letterSpacing: ".08em", textTransform: "uppercase" }}>
          Pinned
        </div>
      )}

      <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
        {/* Room icon */}
        <div style={{ width: 46, height: 46, borderRadius: 13, background: tc.bg, border: `1px solid ${tc.color}30`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: room.pinned ? 10 : 0 }}>
          <TypeIcon size={20} color={tc.color} />
        </div>

        {/* Content */}
        <div style={{ flex: 1, minWidth: 0, marginTop: room.pinned ? 10 : 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
            <span style={{ fontSize: 15, fontWeight: 800, color: "#E4E1EE", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              #{room.name}
            </span>
            {/* Status badges */}
            {!room.isActive && (
              <span style={{ padding: "2px 8px", borderRadius: 999, background: "rgba(176,174,192,.12)", border: "1px solid rgba(176,174,192,.25)", fontSize: 10, fontWeight: 700, color: "#B0AEC0" }}>Inactive</span>
            )}
            {room.isLocked && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 3, padding: "2px 8px", borderRadius: 999, background: "rgba(255,183,133,.12)", border: "1px solid rgba(255,183,133,.3)", fontSize: 10, fontWeight: 700, color: "#FFB785" }}>
                <Lock size={9} /> Locked
              </span>
            )}
            {room.reportedCount > 0 && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 9px", borderRadius: 999, background: "rgba(255,180,171,.14)", border: "1px solid rgba(255,180,171,.3)", fontSize: 10, fontWeight: 800, color: "#ffb4ab" }}>
                <Flag size={9} /> {room.reportedCount} reports
              </span>
            )}
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 8px", borderRadius: 8, background: tc.bg, fontSize: 10, fontWeight: 700, color: tc.color }}>
              {tc.label}
            </span>
          </div>

          <p style={{ fontSize: 12, color: "#C7C4D8", marginBottom: 10, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {room.description}
          </p>

          {/* Stats row */}
          <div style={{ display: "flex", gap: 14, fontSize: 11, color: "#C7C4D8", flexWrap: "wrap" }}>
            <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <Users size={11} /> {fmtNum(room.memberCount)} members
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <MessageSquare size={11} /> {fmtNum(room.messageCount)} msgs
            </span>
            {room.lastMessage && (
              <span style={{ display: "flex", alignItems: "center", gap: 4, flex: 1, minWidth: 0 }}>
                <Clock size={11} />
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {room.lastMessageUser}: {room.lastMessage}
                </span>
              </span>
            )}
            {room.lastMessageAt && (
              <span style={{ flexShrink: 0, color: "#47464f" }}>{timeAgo(room.lastMessageAt)}</span>
            )}
          </div>
        </div>

        {/* Action buttons */}
        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
          <button onClick={() => onViewMessages(room)} title="View messages"
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 12px", borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: "pointer", background: "rgba(108,99,255,.12)", border: "1px solid rgba(108,99,255,.28)", color: "#c4c0ff", transition: "all .15s" }}
            onMouseOver={(e) => (e.currentTarget.style.background = "rgba(108,99,255,.22)")}
            onMouseOut={(e)  => (e.currentTarget.style.background = "rgba(108,99,255,.12)")}
          >
            <Eye size={13} /> View
          </button>
          <button onClick={() => onEdit(room)} title="Edit room"
            style={{ width: 34, height: 34, borderRadius: 10, background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.09)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#C7C4D8", transition: "all .15s" }}
            onMouseOver={(e) => { e.currentTarget.style.color = "#e3dfff"; }}
            onMouseOut={(e)  => { e.currentTarget.style.color = "#C7C4D8"; }}
          >
            <Edit3 size={14} />
          </button>

          {/* Overflow menu */}
          <div ref={menuRef} style={{ position: "relative" }}>
            <button onClick={() => setMenuOpen((p) => !p)}
              style={{ width: 34, height: 34, borderRadius: 10, background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.09)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#C7C4D8" }}>
              <MoreVertical size={14} />
            </button>
            {menuOpen && (
              <div style={{ position: "absolute", top: "calc(100% + 6px)", right: 0, zIndex: 50, background: "rgba(26,26,46,.97)", border: "1px solid rgba(255,255,255,.1)", borderRadius: 14, padding: "6px", boxShadow: "0 8px 30px rgba(0,0,0,.5)", minWidth: 180, animation: "fadeDown .18s ease" }}>
                {[
                  { Icon: room.isActive ? EyeOff : Eye, label: room.isActive ? "Deactivate" : "Activate", color: "#C7C4D8", action: () => { onToggleActive(room); setMenuOpen(false); } },
                  { Icon: room.isLocked ? Unlock : Lock, label: room.isLocked ? "Unlock room" : "Lock room", color: "#FFB785", action: () => { onToggleLock(room); setMenuOpen(false); } },
                  { Icon: Trash2, label: "Delete room", color: "#ffb4ab", action: () => { onDelete(room); setMenuOpen(false); } },
                ].map(({ Icon, label, color, action }) => (
                  <button key={label} onClick={action}
                    style={{ width: "100%", display: "flex", alignItems: "center", gap: 9, padding: "9px 12px", borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: "pointer", background: "none", border: "none", color, textAlign: "left", transition: "background .15s" }}
                    onMouseOver={(e) => (e.currentTarget.style.background = "rgba(255,255,255,.06)")}
                    onMouseOut={(e)  => (e.currentTarget.style.background = "none")}
                  >
                    <Icon size={14} /> {label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// RoomFormDialog
// ═══════════════════════════════════════════════════════════════════════════

interface RoomFormDialogProps {
  room?: ChatRoom | null;
  onSave: (form: EditRoomForm, id?: string) => Promise<void>;
  onClose: () => void;
}

function RoomFormDialog({ room, onSave, onClose }: RoomFormDialogProps) {
  const isEdit = Boolean(room);
  const [form, setForm] = useState<EditRoomForm>({
    name:        room?.name        ?? "",
    description: room?.description ?? "",
    type:        room?.type        ?? "general",
    isActive:    room?.isActive    ?? true,
    isLocked:    room?.isLocked    ?? false,
    subject:     room?.subject     ?? "",
  });
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof EditRoomForm>(k: K, v: EditRoomForm[K]) => setForm((f) => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    await onSave(form, room?.id);
    setSaving(false);
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.65)", backdropFilter: "blur(6px)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={{ width: "100%", maxWidth: 480, background: "rgba(26,26,46,.97)", border: "1px solid rgba(255,255,255,.09)", borderRadius: 24, boxShadow: "0 24px 80px rgba(0,0,0,.6)", animation: "scaleIn .2s ease" }}>
        {/* Header */}
        <div style={{ padding: "18px 24px", borderBottom: "1px solid rgba(255,255,255,.07)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <h2 style={{ fontSize: 17, fontWeight: 800, color: "#E4E1EE" }}>{isEdit ? "Edit Room" : "Create Room"}</h2>
            <p style={{ fontSize: 11, color: "#9B59B6" }}>{isEdit ? `Firestore: chat_rooms/${room!.id}` : "Adds doc to chat_rooms collection"}</p>
          </div>
          <button onClick={onClose} style={{ background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.09)", borderRadius: 10, width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#C7C4D8" }}>
            <X size={15} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#C7C4D8", textTransform: "uppercase", letterSpacing: ".07em", marginBottom: 7 }}>Room name *</label>
            <div style={{ position: "relative" }}>
              <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#C7C4D8", fontSize: 15, fontWeight: 700 }}>#</span>
              <input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="room-name" style={{ ...IS, paddingLeft: 26 }} onFocus={focusBorder} onBlur={blurBorder} />
            </div>
          </div>

          <div>
            <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#C7C4D8", textTransform: "uppercase", letterSpacing: ".07em", marginBottom: 7 }}>Description</label>
            <textarea value={form.description} onChange={(e) => set("description", e.target.value)} rows={2} placeholder="What's this room about?" style={{ ...IS, resize: "vertical" }} onFocus={focusBorder} onBlur={blurBorder} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#C7C4D8", textTransform: "uppercase", letterSpacing: ".07em", marginBottom: 7 }}>Type</label>
              <select value={form.type} onChange={(e) => set("type", e.target.value as RoomType)} style={IS} onFocus={focusBorder} onBlur={blurBorder}>
                <option value="general">General</option>
                <option value="study">Study Group</option>
                <option value="course">Course Room</option>
                <option value="announcement">Announcement</option>
              </select>
            </div>
            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#C7C4D8", textTransform: "uppercase", letterSpacing: ".07em", marginBottom: 7 }}>Subject</label>
              <input value={form.subject} onChange={(e) => set("subject", e.target.value)} placeholder="e.g. IELTS, React…" style={IS} onFocus={focusBorder} onBlur={blurBorder} />
            </div>
          </div>

          {/* Status toggles */}
          <div style={{ display: "flex", gap: 10 }}>
            {([
              { key: "isActive" as const,  labelOn: "Active",   labelOff: "Inactive", colorOn: "#45f1c5", colorOff: "#B0AEC0" },
              { key: "isLocked" as const,  labelOn: "Locked",   labelOff: "Unlocked", colorOn: "#FFB785", colorOff: "#C7C4D8" },
            ]).map(({ key, labelOn, labelOff, colorOn, colorOff }) => {
              const on = form[key] as boolean;
              return (
                <button key={key} onClick={() => set(key, !on as never)}
                  style={{ flex: 1, padding: "10px", borderRadius: 12, fontSize: 13, fontWeight: 700, cursor: "pointer", transition: "all .15s", background: on ? `${colorOn}18` : "rgba(255,255,255,.04)", border: `1px solid ${on ? colorOn + "40" : "rgba(255,255,255,.08)"}`, color: on ? colorOn : colorOff }}>
                  {on ? labelOn : labelOff}
                </button>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: "14px 24px", borderTop: "1px solid rgba(255,255,255,.07)", display: "flex", gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, padding: "11px", borderRadius: 12, fontSize: 13, fontWeight: 600, cursor: "pointer", background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.09)", color: "#C7C4D8" }}>
            Cancel
          </button>
          <button onClick={handleSave} disabled={!form.name.trim() || saving}
            style={{ flex: 2, padding: "11px", borderRadius: 12, fontSize: 13, fontWeight: 800, cursor: saving ? "wait" : "pointer", background: form.name.trim() ? "linear-gradient(135deg,#6C63FF,#9B59B6)" : "rgba(255,255,255,.04)", border: "none", color: form.name.trim() ? "#fff" : "#47464f", boxShadow: form.name.trim() ? "0 0 18px rgba(108,99,255,.3)" : "none", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            {saving ? <><Loader size={14} style={{ animation: "spin .8s linear infinite" }} /> Saving…</> : <><Save size={14} /> {isEdit ? "Save changes" : "Create room"}</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MemberList
// ═══════════════════════════════════════════════════════════════════════════

interface MemberListProps { members: RoomMember[]; roomName: string; onClose: () => void; }
function MemberList({ members, roomName, onClose }: MemberListProps) {
  const ROLE_CFG = {
    admin:     { color: "#FFD700", bg: "rgba(255,215,0,.14)" },
    moderator: { color: "#45f1c5", bg: "rgba(69,241,197,.12)" },
    member:    { color: "#C7C4D8", bg: "rgba(255,255,255,.05)" },
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.65)", backdropFilter: "blur(6px)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={{ width: "100%", maxWidth: 420, background: "rgba(26,26,46,.97)", border: "1px solid rgba(255,255,255,.09)", borderRadius: 24, overflow: "hidden", animation: "scaleIn .2s ease" }}>
        <div style={{ padding: "18px 22px", borderBottom: "1px solid rgba(255,255,255,.07)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 800, color: "#E4E1EE" }}>#{roomName} Members</h2>
            <p style={{ fontSize: 11, color: "#9B59B6" }}>{members.length} members total</p>
          </div>
          <button onClick={onClose} style={{ background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.09)", borderRadius: 10, width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#C7C4D8" }}>
            <X size={14} />
          </button>
        </div>
        <div style={{ padding: "10px", maxHeight: 400, overflowY: "auto" }}>
          {members.map((m) => {
            const rc = ROLE_CFG[m.role];
            return (
              <div key={m.userId} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", borderRadius: 12, transition: "background .15s" }}
                onMouseOver={(e) => (e.currentTarget.style.background = "rgba(255,255,255,.04)")}
                onMouseOut={(e)  => (e.currentTarget.style.background = "transparent")}>
                <div style={{ position: "relative" }}>
                  <div style={{ width: 38, height: 38, borderRadius: "50%", background: "linear-gradient(135deg,#6C63FF,#9B59B6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 800, color: "#fff" }}>
                    {m.displayName.charAt(0)}
                  </div>
                  <div style={{ position: "absolute", bottom: 0, right: 0, width: 11, height: 11, borderRadius: "50%", background: m.status === "online" ? "#45f1c5" : "#47464f", border: "2px solid #1a1a2e" }} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#E4E1EE" }}>{m.displayName}</div>
                  <div style={{ fontSize: 11, color: "#C7C4D8" }}>{m.messageCount} messages · Joined {fmtDate(m.joinedAt)}</div>
                </div>
                <span style={{ padding: "2px 9px", borderRadius: 999, background: rc.bg, color: rc.color, fontSize: 10, fontWeight: 800 }}>
                  {m.role}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MessagePreviewModal
// ═══════════════════════════════════════════════════════════════════════════

interface MessagePreviewModalProps {
  room: ChatRoom;
  messages: ChatMessage[];
  loading: boolean;
  onClose: () => void;
  onDeleteMsg: (msg: ChatMessage) => void;
}

function MessagePreviewModal({ room, messages, loading, onClose, onDeleteMsg }: MessagePreviewModalProps) {
  const [showReported, setShowReported] = useState(false);
  const displayed = showReported ? messages.filter((m) => m.isReported) : messages;

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.65)", backdropFilter: "blur(6px)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={{ width: "100%", maxWidth: 600, maxHeight: "88vh", background: "rgba(26,26,46,.97)", border: "1px solid rgba(255,255,255,.09)", borderRadius: 24, display: "flex", flexDirection: "column", overflow: "hidden", animation: "scaleIn .2s ease" }}>
        {/* Header */}
        <div style={{ padding: "18px 22px", borderBottom: "1px solid rgba(255,255,255,.07)", display: "flex", alignItems: "center", gap: 12 }}>
          <Hash size={18} color="#6C63FF" />
          <div style={{ flex: 1 }}>
            <h2 style={{ fontSize: 16, fontWeight: 800, color: "#E4E1EE" }}>{room.name}</h2>
            <p style={{ fontSize: 11, color: "#9B59B6" }}>chat_rooms/{room.id}/messages</p>
          </div>
          <button onClick={() => setShowReported((p) => !p)}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: "pointer", background: showReported ? "rgba(255,180,171,.15)" : "rgba(255,255,255,.05)", border: `1px solid ${showReported ? "rgba(255,180,171,.3)" : "rgba(255,255,255,.09)"}`, color: showReported ? "#ffb4ab" : "#C7C4D8" }}>
            <Flag size={12} /> {showReported ? "Show all" : `Reported (${messages.filter((m) => m.isReported).length})`}
          </button>
          <button onClick={onClose} style={{ background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.09)", borderRadius: 10, width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#C7C4D8" }}>
            <X size={15} />
          </button>
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: "auto", padding: "14px 18px", display: "flex", flexDirection: "column", gap: 10 }}>
          {loading
            ? <div style={{ display: "flex", justifyContent: "center", padding: 40 }}><Loader size={24} color="#6C63FF" style={{ animation: "spin .8s linear infinite" }} /></div>
            : displayed.map((msg) => (
              <div key={msg.id} style={{ display: "flex", gap: 10, padding: "10px 12px", borderRadius: 12, background: msg.isReported ? "rgba(255,180,171,.08)" : "rgba(255,255,255,.025)", border: `1px solid ${msg.isReported ? "rgba(255,180,171,.22)" : "rgba(255,255,255,.06)"}` }}>
                <div style={{ width: 34, height: 34, borderRadius: "50%", background: msg.isReported ? "linear-gradient(135deg,#ff6b6b,#ffb4ab)" : "linear-gradient(135deg,#6C63FF,#9B59B6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800, color: "#fff", flexShrink: 0 }}>
                  {msg.userName.charAt(0).toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 12, fontWeight: 800, color: msg.isReported ? "#ffb4ab" : "#E4E1EE" }}>{msg.userName}</span>
                    {msg.isReported && (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 3, padding: "1px 7px", borderRadius: 999, background: "rgba(255,180,171,.16)", border: "1px solid rgba(255,180,171,.28)", color: "#ffb4ab", fontSize: 9, fontWeight: 800 }}>
                        <Flag size={8} /> {msg.reportReason}
                      </span>
                    )}
                    <span style={{ fontSize: 10, color: "#47464f", marginLeft: "auto" }}>{timeAgo(msg.timestamp)}</span>
                  </div>
                  <p style={{ fontSize: 13, color: msg.isReported ? "#ffb4ab" : "#C7C4D8", lineHeight: 1.5 }}>{msg.text}</p>
                </div>
                {msg.isReported && (
                  <button onClick={() => onDeleteMsg(msg)} title="Delete message"
                    style={{ width: 30, height: 30, borderRadius: 8, background: "rgba(255,180,171,.1)", border: "1px solid rgba(255,180,171,.22)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#ffb4ab", flexShrink: 0, alignSelf: "flex-start" }}>
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            ))
          }
          {!loading && displayed.length === 0 && (
            <div style={{ textAlign: "center", padding: 40, color: "#47464f" }}>
              <MessageSquare size={32} style={{ margin: "0 auto 10px" }} />
              <p style={{ fontSize: 13 }}>No {showReported ? "reported " : ""}messages</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ReportedMessageRow
// ═══════════════════════════════════════════════════════════════════════════

interface DeleteConfirmProps { msg: ChatMessage; onConfirm: () => void; onCancel: () => void; }
function DeleteConfirmDialog({ msg, onConfirm, onCancel }: DeleteConfirmProps) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.7)", backdropFilter: "blur(6px)", zIndex: 99999, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
      onClick={(e) => e.target === e.currentTarget && onCancel()}>
      <div style={{ width: "100%", maxWidth: 420, background: "rgba(26,26,46,.97)", border: "1px solid rgba(255,180,171,.25)", borderRadius: 22, padding: 28, animation: "scaleIn .2s ease" }}>
        <div style={{ width: 52, height: 52, borderRadius: "50%", background: "rgba(255,180,171,.12)", border: "1px solid rgba(255,180,171,.3)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 18px" }}>
          <Trash2 size={24} color="#ffb4ab" />
        </div>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#E4E1EE", textAlign: "center", marginBottom: 10 }}>Delete Message?</h2>
        <p style={{ fontSize: 13, color: "#C7C4D8", textAlign: "center", lineHeight: 1.6, marginBottom: 8 }}>
          Permanently delete this message from <strong style={{ color: "#e3dfff" }}>#{msg.roomName}</strong>?
        </p>
        <div style={{ background: "rgba(255,180,171,.07)", border: "1px solid rgba(255,180,171,.18)", borderRadius: 10, padding: "10px 14px", marginBottom: 20, fontSize: 13, color: "#ffb4ab", fontStyle: "italic" }}>
          "{msg.text.length > 120 ? msg.text.slice(0, 120) + "…" : msg.text}"
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onCancel} style={{ flex: 1, padding: "11px", borderRadius: 12, fontSize: 13, fontWeight: 600, cursor: "pointer", background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.09)", color: "#C7C4D8" }}>Cancel</button>
          <button onClick={onConfirm} style={{ flex: 2, padding: "11px", borderRadius: 12, fontSize: 13, fontWeight: 800, cursor: "pointer", background: "rgba(255,180,171,.18)", border: "1px solid rgba(255,180,171,.35)", color: "#ffb4ab", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            <Trash2 size={14} /> Delete permanently
          </button>
        </div>
      </div>
    </div>
  );
}

interface ReportedMessageRowProps {
  msg: ChatMessage;
  onDelete: (msg: ChatMessage) => void;
  onWarn: (msg: ChatMessage) => void;
  onIgnore: (msg: ChatMessage) => void;
  onBan: (msg: ChatMessage) => void;
}

function ReportedMessageRow({ msg, onDelete, onWarn, onIgnore, onBan }: ReportedMessageRowProps) {
  const reasonCfg = REPORT_REASON_CFG[msg.reportReason ?? "spam"] ?? REPORT_REASON_CFG.spam;
  const ReasonIcon = reasonCfg.Icon;

  return (
    <div style={{ background: "rgba(255,180,171,.04)", border: "1px solid rgba(255,180,171,.15)", borderRadius: 18, padding: "16px 18px", transition: "all .2s" }}
      onMouseOver={(e) => (e.currentTarget.style.borderColor = "rgba(255,180,171,.28)")}
      onMouseOut={(e)  => (e.currentTarget.style.borderColor = "rgba(255,180,171,.15)")}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
        {/* Author avatar */}
        <div style={{ width: 42, height: 42, borderRadius: "50%", background: "linear-gradient(135deg,#ff6b6b,#ffb4ab)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 800, color: "#fff", flexShrink: 0 }}>
          {msg.userName.charAt(0).toUpperCase()}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Meta row */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 8 }}>
            <span style={{ fontSize: 14, fontWeight: 800, color: "#ffb4ab" }}>{msg.userName}</span>
            <ChevronRight size={12} color="#47464f" />
            <span style={{ fontSize: 12, color: "#C7C4D8", display: "flex", alignItems: "center", gap: 4 }}>
              <Hash size={11} /> {msg.roomName}
            </span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 10px", borderRadius: 999, background: reasonCfg.bg, border: `1px solid ${reasonCfg.color}35`, color: reasonCfg.color, fontSize: 10, fontWeight: 800 }}>
              <ReasonIcon size={10} /> {reasonCfg.label}
            </span>
            {(msg.warningCount ?? 0) > 0 && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 9px", borderRadius: 999, background: "rgba(255,183,133,.14)", color: "#FFB785", fontSize: 10, fontWeight: 800 }}>
                <AlertTriangle size={9} /> {msg.warningCount} warning{(msg.warningCount ?? 0) > 1 ? "s" : ""}
              </span>
            )}
            <span style={{ fontSize: 11, color: "#47464f", marginLeft: "auto" }}>{timeAgo(msg.timestamp)}</span>
          </div>

          {/* Message content */}
          <div style={{ background: "rgba(255,180,171,.07)", border: "1px solid rgba(255,180,171,.15)", borderRadius: 10, padding: "10px 14px", marginBottom: 10, fontSize: 13, color: "#ffb4ab", lineHeight: 1.6, fontStyle: "italic" }}>
            "{msg.text}"
          </div>

          {/* Report meta */}
          <div style={{ fontSize: 11, color: "#C7C4D8", marginBottom: 12, display: "flex", gap: 16, flexWrap: "wrap" }}>
            <span>Reported by <strong style={{ color: "#E4E1EE" }}>{msg.reportedBy}</strong></span>
            {msg.reportedAt && <span>{timeAgo(msg.reportedAt)}</span>}
            <code style={{ fontSize: 10, color: "#9B59B6", background: "rgba(108,99,255,.1)", padding: "1px 5px", borderRadius: 4 }}>msg/{msg.id}</code>
          </div>

          {/* Action buttons */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button onClick={() => onDelete(msg)}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 10, fontSize: 12, fontWeight: 800, cursor: "pointer", background: "rgba(255,180,171,.14)", border: "1px solid rgba(255,180,171,.3)", color: "#ffb4ab", transition: "all .15s" }}
              onMouseOver={(e) => (e.currentTarget.style.background = "rgba(255,180,171,.25)")}
              onMouseOut={(e)  => (e.currentTarget.style.background = "rgba(255,180,171,.14)")}>
              <Trash2 size={12} /> Delete message
            </button>
            <button onClick={() => onWarn(msg)}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 10, fontSize: 12, fontWeight: 800, cursor: "pointer", background: "rgba(255,183,133,.12)", border: "1px solid rgba(255,183,133,.28)", color: "#FFB785", transition: "all .15s" }}
              onMouseOver={(e) => (e.currentTarget.style.background = "rgba(255,183,133,.22)")}
              onMouseOut={(e)  => (e.currentTarget.style.background = "rgba(255,183,133,.12)")}>
              <AlertTriangle size={12} /> Warn user
            </button>
            <button onClick={() => onBan(msg)}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: "pointer", background: "rgba(255,107,107,.1)", border: "1px solid rgba(255,107,107,.25)", color: "#ff6b6b", transition: "all .15s" }}
              onMouseOver={(e) => (e.currentTarget.style.background = "rgba(255,107,107,.2)")}
              onMouseOut={(e)  => (e.currentTarget.style.background = "rgba(255,107,107,.1)")}>
              <Ban size={12} /> Ban user
            </button>
            <button onClick={() => onIgnore(msg)}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: "pointer", background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.09)", color: "#C7C4D8", transition: "all .15s" }}
              onMouseOver={(e) => (e.currentTarget.style.background = "rgba(255,255,255,.08)")}
              onMouseOut={(e)  => (e.currentTarget.style.background = "rgba(255,255,255,.04)")}>
              <EyeOff size={12} /> Dismiss
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// CommunityRoomsAdmin
// ═══════════════════════════════════════════════════════════════════════════

function CommunityRoomsAdmin({ toast }: { toast: (m: string, t?: Toast["type"]) => void }) {
  const { rooms, loading, error, lastSync, refetch } = useChatRooms();

  const [search, setSearch]             = useState("");
  const [filterType, setFilterType]     = useState<RoomType | "all">("all");
  const [filterActive, setFilterActive] = useState<boolean | "all">("all");

  const [formRoom, setFormRoom]         = useState<ChatRoom | null | undefined>(undefined);
  const [memberRoom, setMemberRoom]     = useState<ChatRoom | null>(null);
  const [msgRoom, setMsgRoom]           = useState<ChatRoom | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ChatMessage | null>(null);

  const { messages: roomMsgs, loading: msgLoading } = useRoomMessages(msgRoom?.id ?? null);

  const filtered = useMemo(() => {
    let r = rooms;
    if (search) r = r.filter((room) => room.name.toLowerCase().includes(search.toLowerCase()) || room.description.toLowerCase().includes(search.toLowerCase()));
    if (filterType !== "all") r = r.filter((room) => room.type === filterType);
    if (filterActive !== "all") r = r.filter((room) => room.isActive === filterActive);
    return r;
  }, [rooms, search, filterType, filterActive]);

  const handleSaveRoom = async (form: EditRoomForm, id?: string) => {
    // ── FIREBASE ──────────────────────────────────────────────────────
    // if (id) { await updateDoc(doc(db, "chat_rooms", id), { ...form, updatedAt: serverTimestamp() }); }
    // else { await addDoc(collection(db, "chat_rooms"), { ...form, createdAt: serverTimestamp(), messageCount: 0, memberCount: 0 }); }
    await new Promise((r) => setTimeout(r, 700));
    toast(id ? `Room "${form.name}" updated ✓` : `Room "#${form.name}" created ✓`);
    setFormRoom(undefined);
    refetch();
  };

  const handleToggleActive = async (room: ChatRoom) => {
    // await updateDoc(doc(db, "chat_rooms", room.id), { isActive: !room.isActive });
    toast(`Room "${room.name}" ${room.isActive ? "deactivated" : "activated"}`, room.isActive ? "warning" : "success");
    refetch();
  };

  const handleToggleLock = async (room: ChatRoom) => {
    // await updateDoc(doc(db, "chat_rooms", room.id), { isLocked: !room.isLocked });
    toast(`Room ${room.isLocked ? "unlocked" : "locked"} ✓`);
    refetch();
  };

  const handleDeleteMsg = async (msg: ChatMessage) => {
    // await deleteDoc(doc(db, "chat_rooms", msg.roomId, "messages", msg.id));
    await new Promise((r) => setTimeout(r, 600));
    toast("Message deleted from Firestore", "error");
    setDeleteTarget(null);
  };

  const totalReported = rooms.reduce((s, r) => s + r.reportedCount, 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Header strip */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 14 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: "#E4E1EE" }}>Community Rooms</h2>
          <p style={{ fontSize: 13, color: "#C7C4D8" }}>
            Firestore: <code style={{ background: "rgba(108,99,255,.12)", padding: "1px 5px", borderRadius: 4, color: "#c4c0ff" }}>chat_rooms</code>
            {lastSync && <span style={{ marginLeft: 10, color: "#45f1c5" }}>· Live {lastSync.toLocaleTimeString()}</span>}
          </p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={refetch} style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 16px", borderRadius: 12, fontSize: 13, fontWeight: 600, cursor: "pointer", background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.09)", color: "#C7C4D8" }}>
            <RefreshCw size={14} />
          </button>
          <button onClick={() => setFormRoom(null)}
            style={{ display: "flex", alignItems: "center", gap: 7, padding: "9px 18px", borderRadius: 12, fontSize: 13, fontWeight: 800, cursor: "pointer", background: "linear-gradient(135deg,#6C63FF,#9B59B6)", border: "none", color: "#fff", boxShadow: "0 0 18px rgba(108,99,255,.28)" }}>
            <Plus size={15} /> New Room
          </button>
        </div>
      </div>

      {/* Summary stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
        {[
          { label: "Total Rooms",    val: rooms.length, color: "#c4c0ff", glow: "rgba(196,192,255,.08)" },
          { label: "Active",         val: rooms.filter((r) => r.isActive).length, color: "#45f1c5", glow: "rgba(69,241,197,.08)" },
          { label: "Total Members",  val: fmtNum(rooms.reduce((s, r) => s + r.memberCount, 0)), color: "#FFB785", glow: "rgba(255,183,133,.08)" },
          { label: "Reported Msgs",  val: totalReported, color: totalReported > 0 ? "#ffb4ab" : "#47464f", glow: totalReported > 0 ? "rgba(255,180,171,.1)" : "rgba(0,0,0,.04)" },
        ].map(({ label, val, color, glow }) => (
          <div key={label} style={{ background: "rgba(26,26,46,.65)", border: "1px solid rgba(255,255,255,.06)", borderRadius: 16, padding: "16px 18px", boxShadow: `0 4px 20px ${glow}`, backdropFilter: "blur(12px)" }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#C7C4D8", textTransform: "uppercase", letterSpacing: ".07em", marginBottom: 6 }}>{label}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color }}>{val}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <div style={{ position: "relative", flex: "1 1 220px", maxWidth: 360 }}>
          <Search size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#C7C4D8" }} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search rooms…" style={{ ...IS, paddingLeft: 34 }} onFocus={focusBorder} onBlur={blurBorder} />
        </div>
        {(["all", "general", "study", "course", "announcement"] as const).map((t) => (
          <button key={t} onClick={() => setFilterType(t as any)}
            style={{ padding: "8px 14px", borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: "pointer", transition: "all .15s", background: filterType === t ? "linear-gradient(135deg,#6C63FF,#9B59B6)" : "rgba(255,255,255,.04)", border: filterType === t ? "1px solid rgba(108,99,255,.35)" : "1px solid rgba(255,255,255,.08)", color: filterType === t ? "#fff" : "#C7C4D8" }}>
            {t === "all" ? "All" : ROOM_TYPE_CFG[t as RoomType].label}
          </button>
        ))}
        <button onClick={() => setFilterActive((p) => p === "all" ? true : p === true ? false : "all")}
          style={{ padding: "8px 14px", borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: "pointer", background: filterActive !== "all" ? "rgba(69,241,197,.12)" : "rgba(255,255,255,.04)", border: filterActive !== "all" ? "1px solid rgba(69,241,197,.3)" : "1px solid rgba(255,255,255,.08)", color: filterActive !== "all" ? "#45f1c5" : "#C7C4D8" }}>
          {filterActive === "all" ? "All status" : filterActive ? "Active only" : "Inactive only"}
        </button>
        <span style={{ marginLeft: "auto", fontSize: 12, color: "#C7C4D8", alignSelf: "center" }}>
          {loading ? "Loading…" : `${filtered.length} rooms`}
        </span>
      </div>

      {/* Room list */}
      {loading
        ? Array.from({ length: 4 }).map((_, i) => (
            <div key={i} style={{ height: 100, borderRadius: 18, background: "linear-gradient(90deg,#1f1f2c 25%,#2a2935 50%,#1f1f2c 75%)", backgroundSize: "200% 100%", animation: "shimmer 1.4s infinite" }} />
          ))
        : filtered.map((room) => (
            <RoomCard key={room.id} room={room}
              onEdit={(r) => setFormRoom(r)}
              onViewMessages={(r) => setMsgRoom(r)}
              onToggleActive={handleToggleActive}
              onToggleLock={handleToggleLock}
              onDelete={(r) => toast(`Room "${r.name}" deleted`, "error")}
            />
          ))
      }

      {/* Dialogs */}
      {formRoom !== undefined && (
        <RoomFormDialog room={formRoom} onSave={handleSaveRoom} onClose={() => setFormRoom(undefined)} />
      )}
      {memberRoom && (
        <MemberList members={MOCK_MEMBERS} roomName={memberRoom.name} onClose={() => setMemberRoom(null)} />
      )}
      {msgRoom && (
        <MessagePreviewModal room={msgRoom} messages={roomMsgs} loading={msgLoading} onClose={() => setMsgRoom(null)}
          onDeleteMsg={(msg) => setDeleteTarget(msg)} />
      )}
      {deleteTarget && (
        <DeleteConfirmDialog msg={deleteTarget} onConfirm={() => handleDeleteMsg(deleteTarget)} onCancel={() => setDeleteTarget(null)} />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ReportedMessagesAdmin
// ═══════════════════════════════════════════════════════════════════════════

function ReportedMessagesAdmin({ toast }: { toast: (m: string, t?: Toast["type"]) => void }) {
  const { messages, setMessages, loading } = useReportedMessages();
  const [filter, setFilter] = useState<string>("all");
  const [deleteTarget, setDeleteTarget] = useState<ChatMessage | null>(null);

  const reasons = useMemo(() => Array.from(new Set(messages.map((m) => m.reportReason ?? "spam"))), [messages]);

  const filtered = useMemo(() =>
    filter === "all" ? messages : messages.filter((m) => m.reportReason === filter),
    [messages, filter]
  );

  const handleDelete = async (msg: ChatMessage) => {
    // await deleteDoc(doc(db, "chat_rooms", msg.roomId, "messages", msg.id));
    await new Promise((r) => setTimeout(r, 600));
    setMessages((prev) => prev.filter((m) => m.id !== msg.id));
    toast("Message permanently deleted from Firestore", "error");
    setDeleteTarget(null);
  };

  const handleWarn = async (msg: ChatMessage) => {
    // await updateDoc(doc(db, "users", msg.userId), { warningCount: increment(1) });
    // await updateDoc(doc(db, "chat_rooms", msg.roomId, "messages", msg.id), { isReported: false, reportReason: null });
    await new Promise((r) => setTimeout(r, 500));
    setMessages((prev) => prev.filter((m) => m.id !== msg.id));
    toast(`Warning sent to ${msg.userName} · users/${msg.userId}/warnings updated`, "warning");
  };

  const handleIgnore = async (msg: ChatMessage) => {
    // await updateDoc(doc(db, "chat_rooms", msg.roomId, "messages", msg.id), { isReported: false, reportReason: null, reportedBy: null });
    await new Promise((r) => setTimeout(r, 400));
    setMessages((prev) => prev.filter((m) => m.id !== msg.id));
    toast(`Report dismissed — message cleared`, "info");
  };

  const handleBan = async (msg: ChatMessage) => {
    // await updateDoc(doc(db, "users", msg.userId), { status: "banned", bannedAt: serverTimestamp() });
    await new Promise((r) => setTimeout(r, 500));
    setMessages((prev) => prev.filter((m) => m.id !== msg.id));
    toast(`User ${msg.userName} banned ✓`, "warning");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 14 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: "#E4E1EE" }}>Reported Messages</h2>
          <p style={{ fontSize: 13, color: "#C7C4D8" }}>
            Firestore: <code style={{ background: "rgba(255,180,171,.1)", padding: "1px 5px", borderRadius: 4, color: "#ffb4ab" }}>messages where isReported == true</code>
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 10, background: "rgba(255,180,171,.1)", border: "1px solid rgba(255,180,171,.25)", color: "#ffb4ab", fontSize: 12, fontWeight: 800 }}>
          <Flag size={13} /> {messages.length} pending review
        </div>
      </div>

      {/* Reason filter chips */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button onClick={() => setFilter("all")}
          style={{ padding: "7px 14px", borderRadius: 999, fontSize: 11, fontWeight: 700, cursor: "pointer", background: filter === "all" ? "linear-gradient(135deg,#6C63FF,#9B59B6)" : "rgba(255,255,255,.04)", border: filter === "all" ? "1px solid rgba(108,99,255,.3)" : "1px solid rgba(255,255,255,.08)", color: filter === "all" ? "#fff" : "#C7C4D8" }}>
          All ({messages.length})
        </button>
        {reasons.map((r) => {
          const cfg = REPORT_REASON_CFG[r] ?? REPORT_REASON_CFG.spam;
          const cnt = messages.filter((m) => m.reportReason === r).length;
          return (
            <button key={r} onClick={() => setFilter(r)}
              style={{ display: "flex", alignItems: "center", gap: 5, padding: "7px 14px", borderRadius: 999, fontSize: 11, fontWeight: 700, cursor: "pointer", background: filter === r ? cfg.bg : "rgba(255,255,255,.04)", border: `1px solid ${filter === r ? cfg.color + "50" : "rgba(255,255,255,.08)"}`, color: filter === r ? cfg.color : "#C7C4D8" }}>
              {cnt} {cfg.label}
            </button>
          );
        })}
      </div>

      {/* Reported messages list */}
      {loading
        ? Array.from({ length: 3 }).map((_, i) => (
            <div key={i} style={{ height: 160, borderRadius: 18, background: "linear-gradient(90deg,#1f1f2c 25%,#2a2935 50%,#1f1f2c 75%)", backgroundSize: "200% 100%", animation: "shimmer 1.4s infinite" }} />
          ))
        : filtered.length === 0
        ? (
          <div style={{ textAlign: "center", padding: 60, background: "rgba(26,26,46,.5)", borderRadius: 20, border: "1px solid rgba(255,255,255,.06)" }}>
            <CheckCircle size={40} color="#45f1c5" style={{ margin: "0 auto 14px" }} />
            <p style={{ fontSize: 16, fontWeight: 700, color: "#E4E1EE" }}>No reports to review</p>
            <p style={{ fontSize: 13, color: "#C7C4D8" }}>All reported messages have been resolved.</p>
          </div>
        )
        : filtered.map((msg) => (
          <ReportedMessageRow key={msg.id} msg={msg}
            onDelete={(m) => setDeleteTarget(m)}
            onWarn={handleWarn}
            onIgnore={handleIgnore}
            onBan={handleBan}
          />
        ))
      }

      {deleteTarget && (
        <DeleteConfirmDialog msg={deleteTarget} onConfirm={() => handleDelete(deleteTarget)} onCancel={() => setDeleteTarget(null)} />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN: CommunityAdmin (tabbed wrapper)
// ═══════════════════════════════════════════════════════════════════════════

export default function CommunityAdmin() {
  const [tab, setTab] = useState<"rooms" | "reports">("rooms");
  const { toasts, add: toast } = useToast();

  return (
    <div style={{ minHeight: "100vh", background: "#0F0F1A", color: "#E4E1EE", fontFamily: "Inter,sans-serif", backgroundImage: "radial-gradient(circle at 5% 0%, rgba(108,99,255,.06) 0%, transparent 55%)" }}>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        @keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}
        @keyframes fadeDown{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:translateY(0)}}
        @keyframes scaleIn{from{opacity:0;transform:scale(.93)}to{opacity:1;transform:scale(1)}}
        @keyframes slideInR{from{opacity:0;transform:translateX(20px)}to{opacity:1;transform:translateX(0)}}
        @keyframes spin{to{transform:rotate(360deg)}}
        input,select,textarea,button{font-family:Inter,sans-serif;}
        ::-webkit-scrollbar{width:5px;} ::-webkit-scrollbar-track{background:#0F0F1A;} ::-webkit-scrollbar-thumb{background:#2a292d;border-radius:10px;}
      `}</style>

      {/* Header */}
      <header style={{ position: "sticky", top: 0, zIndex: 50, background: "rgba(15,15,26,.92)", backdropFilter: "blur(18px)", borderBottom: "1px solid rgba(255,255,255,.06)" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "12px 24px", display: "flex", alignItems: "center", gap: 16 }}>
          <button style={{ display: "flex", alignItems: "center", gap: 7, background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.08)", borderRadius: 10, padding: "8px 14px", color: "#C7C4D8", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            <ArrowLeft size={14} /> Admin
          </button>
          <div style={{ fontSize: 13, color: "#C7C4D8", display: "flex", alignItems: "center", gap: 8 }}>
            Admin <ChevronRight size={13} /> <span style={{ color: "#e3dfff", fontWeight: 700 }}>Community</span>
          </div>
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "#45f1c5", fontWeight: 700 }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#45f1c5", display: "inline-block", animation: "pulse 2s infinite" }} />
            Live · onSnapshot
          </div>
        </div>
      </header>

      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "28px 24px", display: "flex", flexDirection: "column", gap: 22 }}>
        {/* Tab bar */}
        <div style={{ display: "flex", gap: 4, background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.06)", borderRadius: 14, padding: 5, maxWidth: 480 }}>
          {([
            { id: "rooms",   label: "Chat Rooms",        Icon: Hash,  badge: null },
            { id: "reports", label: "Reported Messages",  Icon: Flag,  badge: MOCK_MESSAGES.length },
          ] as const).map(({ id, label, Icon, badge }) => (
            <button key={id} onClick={() => setTab(id)}
              style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "10px 14px", borderRadius: 10, fontSize: 13, fontWeight: 800, cursor: "pointer", transition: "all .2s", background: tab === id ? "linear-gradient(135deg,#6C63FF,#9B59B6)" : "transparent", border: tab === id ? "1px solid rgba(108,99,255,.3)" : "1px solid transparent", color: tab === id ? "#fff" : "#C7C4D8", boxShadow: tab === id ? "0 0 16px rgba(108,99,255,.25)" : "none" }}>
              <Icon size={14} /> {label}
              {badge !== null && badge > 0 && (
                <span style={{ background: tab === id ? "rgba(255,255,255,.25)" : "rgba(255,180,171,.3)", color: tab === id ? "#fff" : "#ffb4ab", fontSize: 10, fontWeight: 800, padding: "1px 7px", borderRadius: 999 }}>
                  {badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div style={{ animation: "fadeDown .25s ease" }}>
          {tab === "rooms"   && <CommunityRoomsAdmin   toast={toast} />}
          {tab === "reports" && <ReportedMessagesAdmin  toast={toast} />}
        </div>
      </div>

      <ToastContainer toasts={toasts} />
    </div>
  );
}

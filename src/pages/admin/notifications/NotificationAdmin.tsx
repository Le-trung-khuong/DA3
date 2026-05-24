/**
 * Smart Review — Admin Notification Manager
 * React + TypeScript + Firebase SDK v9+
 *
 * File: src/pages/admin/NotificationAdmin.tsx
 *
 * Exports:
 *   default → NotificationAdmin (tabbed: List + Form)
 *   NotificationListAdmin
 *   NotificationFormAdmin
 *
 * Firestore collection: `notifications`
 * Fields: title, content, type, target, targetValue,
 *         scheduledAt, status, createdBy, createdAt, sentAt
 *
 * Production split:
 *   hooks/useNotifications.ts
 *   hooks/useUsers.ts
 *   components/admin/notifications/NotificationTable.tsx
 *   components/admin/notifications/NotificationForm.tsx
 *   components/admin/notifications/UserMultiSelect.tsx
 *   components/admin/notifications/SendConfirmDialog.tsx
 *   components/admin/notifications/StatusBadge.tsx
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
  type ChangeEvent,
} from "react";

// ─── Firebase (uncomment in production) ─────────────────────────────────────
// import { db } from "@/lib/firebase";
// import {
//   collection, query, orderBy, onSnapshot, doc, addDoc, updateDoc,
//   deleteDoc, serverTimestamp, Timestamp, where, getDocs,
// } from "firebase/firestore";

// ─── Lucide icons ─────────────────────────────────────────────────────────────
import {
  Bell, Plus, Send, Save, Trash2, Eye, X, Check,
  Filter, Search, RefreshCw, AlertTriangle, Clock,
  Users, Layers, Zap, Megaphone, Settings, Calendar,
  ChevronDown, ChevronLeft, ChevronRight, ArrowLeft,
  CheckCircle, PauseCircle, XCircle, Loader, Info,
  BarChart2, User, Mail, Shield, Crown, BookOpen,
} from "lucide-react";

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

type NotifType   = "system" | "promotion" | "course_update";
type NotifStatus = "draft" | "sent" | "scheduled";
type NotifTarget = "all" | "level" | "specific_users";

interface Notification {
  id: string;
  title: string;
  content: string;
  type: NotifType;
  target: NotifTarget;
  targetValue?: string | string[]; // level number as string | array of userIds
  scheduledAt?: Date | null;
  status: NotifStatus;
  createdBy: string;
  createdAt: Date;
  sentAt?: Date | null;
  recipientCount?: number;
}

interface AppUser {
  uid: string;
  displayName: string;
  email: string;
  level: number;
  role: string;
  status: string;
  xp: number;
}

interface NotificationFormData {
  title: string;
  content: string;
  type: NotifType;
  target: NotifTarget;
  targetLevel: string;
  targetUserIds: string[];
  scheduleMode: "now" | "scheduled";
  scheduledAt: string; // ISO datetime-local string
}

// ═══════════════════════════════════════════════════════════════════════════
// MOCK DATA
// ═══════════════════════════════════════════════════════════════════════════

const now = new Date();
const daysAgo = (d: number) => new Date(now.getTime() - d * 864e5);

const MOCK_NOTIFICATIONS: Notification[] = [
  { id: "n1",  title: "Bảo trì hệ thống ngày 30/5",      content: "Hệ thống sẽ bảo trì từ 2:00 AM – 4:00 AM ngày 30/5. Trong thời gian này dịch vụ tạm thời không khả dụng.", type: "system",        target: "all",            status: "sent",      createdBy: "admin@sr.io",  createdAt: daysAgo(3), sentAt: daysAgo(3), recipientCount: 12800 },
  { id: "n2",  title: "Giảm 40% khóa học Design tháng 6", content: "Ưu đãi đặc biệt tháng 6: Tất cả khóa học Design giảm ngay 40%. Áp dụng đến hết 30/6/2025.",            type: "promotion",     target: "all",            status: "sent",      createdBy: "admin@sr.io",  createdAt: daysAgo(7), sentAt: daysAgo(7), recipientCount: 12800 },
  { id: "n3",  title: "Khóa TypeScript đã cập nhật",      content: "Module 4 của khóa TypeScript for React Developers đã được cập nhật với 3 bài giảng mới.",                type: "course_update", target: "specific_users", targetValue: ["uid_0001","uid_0016"], status: "sent", createdBy: "instructor@sr.io", createdAt: daysAgo(1), sentAt: daysAgo(1), recipientCount: 2 },
  { id: "n4",  title: "Thử thách tháng 6 đã bắt đầu!",   content: "Hoàn thành 20 bài học trong tháng 6 để nhận badge đặc biệt và 500 XP bonus. Bắt đầu ngay!",              type: "promotion",     target: "level",          targetValue: "10",  status: "scheduled", createdBy: "admin@sr.io",  createdAt: daysAgo(0), scheduledAt: new Date(now.getTime() + 2 * 864e5), recipientCount: 3400 },
  { id: "n5",  title: "Nháp: Tính năng AI mới",            content: "Smart Review sẽ ra mắt tính năng AI quiz generation vào tháng 7. Hãy đón chờ!",                          type: "system",        target: "all",            status: "draft",     createdBy: "admin@sr.io",  createdAt: daysAgo(0), recipientCount: 0 },
  { id: "n6",  title: "Giảm 50% cho học viên Premium",    content: "Học viên có level ≥ 20 nhận ưu đãi độc quyền giảm 50% tất cả khóa học cao cấp.",                        type: "promotion",     target: "level",          targetValue: "20",  status: "sent",      createdBy: "admin@sr.io",  createdAt: daysAgo(14), sentAt: daysAgo(14), recipientCount: 1240 },
  { id: "n7",  title: "Streak 7 ngày – Chúc mừng!",       content: "Bạn đã học liên tục 7 ngày. Nhận thêm 100 XP bonus và tiếp tục chuỗi streak của bạn!",                   type: "system",        target: "level",          targetValue: "1",   status: "scheduled", createdBy: "system",       createdAt: daysAgo(0), scheduledAt: new Date(now.getTime() + 864e5), recipientCount: 0 },
];

const MOCK_USERS: AppUser[] = [
  { uid: "uid_0001", displayName: "Hoàng Tuấn",      email: "hoang@gmail.com",    level: 42, role: "student",    status: "active", xp: 12200 },
  { uid: "uid_0002", displayName: "Linh Nguyễn",     email: "linh@gmail.com",     level: 38, role: "student",    status: "active", xp: 8450  },
  { uid: "uid_0003", displayName: "Mai Văn",          email: "mai@example.com",    level: 35, role: "student",    status: "active", xp: 7900  },
  { uid: "uid_0004", displayName: "Sarah Drasner",    email: "sarah@edu.io",       level: 60, role: "instructor", status: "active", xp: 28000 },
  { uid: "uid_0005", displayName: "Phạm Quân Đức",   email: "quan@gmail.com",     level: 22, role: "student",    status: "active", xp: 5800  },
  { uid: "uid_0006", displayName: "Nguyễn Mai Vy",   email: "vy@gmail.com",       level: 19, role: "student",    status: "active", xp: 4200  },
  { uid: "uid_0007", displayName: "Trần Linh Nhi",   email: "nhi@gmail.com",      level: 31, role: "student",    status: "active", xp: 6700  },
  { uid: "uid_0008", displayName: "Lê Minh Huy",     email: "huy@gmail.com",      level: 28, role: "student",    status: "active", xp: 5400  },
  { uid: "uid_0009", displayName: "Võ Thị Hoa",      email: "hoa@edu.io",         level: 48, role: "instructor", status: "active", xp: 16500 },
  { uid: "uid_0010", displayName: "Bích Nguyễn",     email: "bich@gmail.com",     level: 15, role: "student",    status: "active", xp: 3100  },
  { uid: "uid_0011", displayName: "Mod Đình Long",   email: "mod@sr.io",          level: 55, role: "moderator",  status: "active", xp: 18000 },
  { uid: "uid_0016", displayName: "Lê Trung Khương", email: "khuong@gmail.com",   level: 33, role: "student",    status: "active", xp: 7200  },
];

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

const fmtDate = (d: Date) =>
  d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
const fmtRelative = (d: Date) => {
  const s = (Date.now() - d.getTime()) / 1000;
  if (s < 60)    return "vừa xong";
  if (s < 3600)  return `${Math.floor(s / 60)}p trước`;
  if (s < 86400) return `${Math.floor(s / 3600)}h trước`;
  return `${Math.floor(s / 86400)}d trước`;
};
const fmtNum = (n: number) => new Intl.NumberFormat("vi-VN").format(n);
const isFuture = (d: Date) => d.getTime() > Date.now();

const TYPE_CFG: Record<NotifType, { label: string; color: string; bg: string; border: string; Icon: React.ElementType }> = {
  system:        { label: "Hệ thống",    color: "#c4c0ff", bg: "rgba(196,192,255,.12)", border: "rgba(196,192,255,.28)", Icon: Settings  },
  promotion:     { label: "Khuyến mãi",  color: "#FFB785", bg: "rgba(255,183,133,.12)", border: "rgba(255,183,133,.28)", Icon: Zap        },
  course_update: { label: "Khóa học",    color: "#45f1c5", bg: "rgba(69,241,197,.12)",  border: "rgba(69,241,197,.28)",  Icon: BookOpen   },
};

const STATUS_CFG: Record<NotifStatus, { label: string; color: string; bg: string; border: string; Icon: React.ElementType }> = {
  sent:      { label: "Đã gửi",   color: "#45f1c5", bg: "rgba(69,241,197,.12)",  border: "rgba(69,241,197,.28)",  Icon: CheckCircle },
  draft:     { label: "Nháp",     color: "#C7C4D8", bg: "rgba(199,196,208,.08)", border: "rgba(199,196,208,.2)",  Icon: PauseCircle },
  scheduled: { label: "Đã lên lịch", color: "#FFB785", bg: "rgba(255,183,133,.12)", border: "rgba(255,183,133,.28)", Icon: Clock },
};

const TARGET_CFG: Record<NotifTarget, { label: string; Icon: React.ElementType }> = {
  all:            { label: "Tất cả",        Icon: Users  },
  level:          { label: "Theo cấp độ",   Icon: BarChart2 },
  specific_users: { label: "Người dùng cụ thể", Icon: User },
};

const ROLE_GRADS: Record<string, string> = {
  student:    "linear-gradient(135deg,#6C63FF,#9B59B6)",
  instructor: "linear-gradient(135deg,#00D4AA,#0F9E7B)",
  moderator:  "linear-gradient(135deg,#FFB785,#FF8C42)",
  admin:      "linear-gradient(135deg,#FFD700,#FF8C42)",
};

function initials(name: string) {
  return name.split(" ").map((w) => w[0]?.toUpperCase() ?? "").slice(0, 2).join("");
}

// ═══════════════════════════════════════════════════════════════════════════
// SHARED STYLES
// ═══════════════════════════════════════════════════════════════════════════

const IS: React.CSSProperties = {
  width: "100%", background: "#0c0b16",
  border: "1px solid rgba(255,255,255,.08)",
  borderRadius: 12, padding: "10px 14px",
  color: "#E4E1EE", fontSize: 13,
  outline: "none", fontFamily: "'DM Sans', sans-serif",
  transition: "border-color .2s, box-shadow .2s",
};
const LABEL: React.CSSProperties = {
  display: "block", fontSize: 11, fontWeight: 700,
  color: "#C7C4D8", letterSpacing: ".07em",
  textTransform: "uppercase", marginBottom: 7,
};
function onFocus(e: React.FocusEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
  e.target.style.borderColor = "rgba(108,99,255,.55)";
  e.target.style.boxShadow   = "0 0 0 3px rgba(108,99,255,.1)";
}
function onBlur(e: React.FocusEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
  e.target.style.borderColor = "rgba(255,255,255,.08)";
  e.target.style.boxShadow   = "none";
}

// ═══════════════════════════════════════════════════════════════════════════
// TOAST
// ═══════════════════════════════════════════════════════════════════════════

interface Toast { id: string; msg: string; type: "success" | "error" | "info" | "warning"; }
function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const add = useCallback((msg: string, type: Toast["type"] = "success") => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t, { id, msg, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500);
  }, []);
  return { toasts, add };
}
function ToastContainer({ toasts }: { toasts: Toast[] }) {
  const c: Record<string, string> = { success: "#45f1c5", error: "#ffb4ab", info: "#c4c0ff", warning: "#FFB785" };
  return (
    <div style={{ position: "fixed", bottom: 24, right: 24, zIndex: 99999, display: "flex", flexDirection: "column", gap: 10, pointerEvents: "none" }}>
      {toasts.map((t) => (
        <div key={t.id} style={{ background: "rgba(15,13,24,.98)", border: `1px solid ${c[t.type]}40`, borderRadius: 14, padding: "11px 18px", color: c[t.type], fontSize: 13, fontWeight: 600, fontFamily: "'DM Sans', sans-serif", boxShadow: `0 8px 30px rgba(0,0,0,.5)`, maxWidth: 360, animation: "slideInRight .25s ease" }}>
          {t.msg}
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT: StatusBadge
// ═══════════════════════════════════════════════════════════════════════════

function StatusBadge({ status }: { status: NotifStatus }) {
  const c = STATUS_CFG[status];
  const Icon = c.Icon;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 999, background: c.bg, border: `1px solid ${c.border}`, color: c.color, fontSize: 11, fontWeight: 700 }}>
      <Icon size={10} /> {c.label}
    </span>
  );
}

function TypeBadge({ type }: { type: NotifType }) {
  const c = TYPE_CFG[type];
  const Icon = c.Icon;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 9px", borderRadius: 8, background: c.bg, color: c.color, fontSize: 10, fontWeight: 700 }}>
      <Icon size={10} /> {c.label}
    </span>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT: UserMultiSelect
// ═══════════════════════════════════════════════════════════════════════════

interface UserMultiSelectProps {
  users: AppUser[];
  selected: string[];
  onChange: (ids: string[]) => void;
}

function UserMultiSelect({ users, selected, onChange }: UserMultiSelectProps) {
  const [search, setSearch] = useState("");
  const [open, setOpen]     = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = users.filter(
    (u) =>
      u.displayName.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase())
  );

  const toggle = (uid: string) => {
    onChange(selected.includes(uid) ? selected.filter((x) => x !== uid) : [...selected, uid]);
  };

  const selectedUsers = users.filter((u) => selected.includes(u.uid));

  return (
    <div ref={ref} style={{ position: "relative" }}>
      {/* Selected chips */}
      <div
        onClick={() => setOpen((p) => !p)}
        style={{ minHeight: 44, background: "#0c0b16", border: `1px solid ${open ? "rgba(108,99,255,.55)" : "rgba(255,255,255,.08)"}`, borderRadius: 12, padding: "8px 12px", cursor: "pointer", display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center", transition: "border-color .2s", boxShadow: open ? "0 0 0 3px rgba(108,99,255,.1)" : "none" }}
      >
        {selectedUsers.length === 0
          ? <span style={{ fontSize: 13, color: "#47464f" }}>Chọn người dùng…</span>
          : selectedUsers.map((u) => (
              <span key={u.uid} style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 8px", borderRadius: 999, background: "rgba(108,99,255,.15)", border: "1px solid rgba(108,99,255,.3)", fontSize: 11, fontWeight: 600, color: "#c4c0ff" }}>
                {u.displayName}
                <button onClick={(e) => { e.stopPropagation(); toggle(u.uid); }} style={{ background: "none", border: "none", cursor: "pointer", color: "#9B59B6", padding: 0, display: "flex" }}>
                  <X size={10} />
                </button>
              </span>
            ))
        }
        <ChevronDown size={13} color="#C7C4D8" style={{ marginLeft: "auto", transition: "transform .2s", transform: open ? "rotate(180deg)" : "rotate(0)" }} />
      </div>

      {/* Dropdown */}
      {open && (
        <div style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0, zIndex: 200, background: "rgba(18,16,28,.98)", border: "1px solid rgba(255,255,255,.1)", borderRadius: 14, boxShadow: "0 16px 40px rgba(0,0,0,.5)", overflow: "hidden" }}>
          <div style={{ padding: 10, borderBottom: "1px solid rgba(255,255,255,.07)" }}>
            <div style={{ position: "relative" }}>
              <Search size={13} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#C7C4D8" }} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Tìm người dùng…"
                autoFocus
                style={{ ...IS, paddingLeft: 32, fontSize: 12, borderRadius: 10 }}
                onFocus={onFocus} onBlur={onBlur}
              />
            </div>
          </div>
          <div style={{ maxHeight: 220, overflowY: "auto" }}>
            {filtered.length === 0
              ? <div style={{ padding: "16px", textAlign: "center", fontSize: 12, color: "#47464f" }}>Không tìm thấy</div>
              : filtered.map((u) => {
                  const isSelected = selected.includes(u.uid);
                  return (
                    <div key={u.uid} onClick={() => toggle(u.uid)}
                      style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 14px", cursor: "pointer", background: isSelected ? "rgba(108,99,255,.1)" : "transparent", transition: "background .15s" }}
                      onMouseOver={(e) => { if (!isSelected) e.currentTarget.style.background = "rgba(255,255,255,.04)"; }}
                      onMouseOut={(e)  => { if (!isSelected) e.currentTarget.style.background = "transparent"; }}
                    >
                      <div style={{ width: 30, height: 30, borderRadius: "50%", background: ROLE_GRADS[u.role] ?? ROLE_GRADS.student, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, color: "#fff", flexShrink: 0 }}>
                        {initials(u.displayName)}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: "#E4E1EE", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.displayName}</div>
                        <div style={{ fontSize: 10, color: "#C7C4D8", opacity: .7 }}>{u.email} · Lv.{u.level}</div>
                      </div>
                      <div style={{ width: 18, height: 18, borderRadius: 5, background: isSelected ? "linear-gradient(135deg,#6C63FF,#9B59B6)" : "rgba(255,255,255,.06)", border: `1px solid ${isSelected ? "rgba(108,99,255,.5)" : "rgba(255,255,255,.15)"}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        {isSelected && <Check size={11} color="#fff" />}
                      </div>
                    </div>
                  );
                })
            }
          </div>
          <div style={{ padding: "8px 14px", borderTop: "1px solid rgba(255,255,255,.07)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 11, color: "#C7C4D8" }}>{selected.length} đã chọn</span>
            {selected.length > 0 && (
              <button onClick={() => onChange([])} style={{ fontSize: 11, color: "#ffb4ab", background: "none", border: "none", cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>
                Xóa tất cả
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT: SendConfirmDialog
// ═══════════════════════════════════════════════════════════════════════════

interface SendConfirmDialogProps {
  form: NotificationFormData;
  users: AppUser[];
  onConfirm: () => void;
  onCancel: () => void;
}

function SendConfirmDialog({ form, users, onConfirm, onCancel }: SendConfirmDialogProps) {
  const isScheduled = form.scheduleMode === "scheduled";
  const color  = isScheduled ? "#FFB785" : "#45f1c5";
  const accent = isScheduled ? "rgba(255,183,133,.15)" : "rgba(69,241,197,.12)";
  const border = isScheduled ? "rgba(255,183,133,.3)"  : "rgba(69,241,197,.28)";

  const targetLabel =
    form.target === "all" ? "Tất cả người dùng" :
    form.target === "level" ? `Người dùng Lv.${form.targetLevel}+` :
    `${form.targetUserIds.length} người dùng được chọn`;

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.72)", backdropFilter: "blur(8px)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
      onClick={(e) => e.target === e.currentTarget && onCancel()}>
      <div style={{ width: "100%", maxWidth: 440, background: "rgba(15,13,24,.98)", border: `1px solid ${border}`, borderRadius: 24, padding: 32, boxShadow: `0 24px 80px rgba(0,0,0,.6)`, animation: "scaleIn .2s ease" }}>
        {/* Icon */}
        <div style={{ width: 56, height: 56, borderRadius: "50%", background: accent, border: `1px solid ${border}`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
          {isScheduled ? <Clock size={26} color={color} /> : <Send size={26} color={color} />}
        </div>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: "#E4E1EE", textAlign: "center", marginBottom: 8, fontFamily: "'DM Sans', sans-serif" }}>
          {isScheduled ? "Xác nhận lên lịch?" : "Xác nhận gửi ngay?"}
        </h2>
        <p style={{ fontSize: 13, color: "#C7C4D8", textAlign: "center", lineHeight: 1.7, marginBottom: 20, fontFamily: "'DM Sans', sans-serif" }}>
          {isScheduled
            ? <>Thông báo sẽ được gửi lúc <strong style={{ color }}>{new Date(form.scheduledAt).toLocaleString("vi-VN")}</strong></>
            : <>Thông báo sẽ được <strong style={{ color }}>gửi ngay lập tức</strong> đến {targetLabel}</>
          }
        </p>

        {/* Summary card */}
        <div style={{ background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.08)", borderRadius: 14, padding: "14px 16px", marginBottom: 20, display: "flex", flexDirection: "column", gap: 8 }}>
          {[
            ["Tiêu đề",    form.title || "(trống)"],
            ["Loại",       TYPE_CFG[form.type].label],
            ["Đối tượng",  targetLabel],
          ].map(([k, v]) => (
            <div key={k} style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "#C7C4D8", textTransform: "uppercase", letterSpacing: ".06em" }}>{k}</span>
              <span style={{ fontSize: 12, color: "#E4E1EE", fontWeight: 600 }}>{v}</span>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onCancel} style={{ flex: 1, padding: "12px", borderRadius: 14, fontSize: 13, fontWeight: 600, cursor: "pointer", background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.1)", color: "#C7C4D8", fontFamily: "'DM Sans', sans-serif" }}>
            Hủy
          </button>
          <button onClick={onConfirm} style={{ flex: 2, padding: "12px", borderRadius: 14, fontSize: 13, fontWeight: 700, cursor: "pointer", background: accent, border: `1px solid ${border}`, color, fontFamily: "'DM Sans', sans-serif", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            {isScheduled ? <><Clock size={14} /> Lên lịch</> : <><Send size={14} /> Gửi ngay</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT: NotificationDetailModal
// ═══════════════════════════════════════════════════════════════════════════

function NotificationDetailModal({ notif, onClose }: { notif: Notification; onClose: () => void }) {
  const tc = TYPE_CFG[notif.type];
  const TIcon = tc.Icon;
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.72)", backdropFilter: "blur(8px)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={{ width: "100%", maxWidth: 500, background: "rgba(15,13,24,.98)", border: "1px solid rgba(255,255,255,.08)", borderRadius: 24, boxShadow: "0 24px 80px rgba(0,0,0,.6)", animation: "scaleIn .2s ease" }}>
        <div style={{ padding: "20px 24px", borderBottom: "1px solid rgba(255,255,255,.07)", display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: tc.bg, border: `1px solid ${tc.border}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <TIcon size={18} color={tc.color} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#E4E1EE", fontFamily: "'DM Sans', sans-serif" }}>{notif.title}</div>
            <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
              <TypeBadge type={notif.type} />
              <StatusBadge status={notif.status} />
            </div>
          </div>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 10, background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.08)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#C7C4D8" }}>
            <X size={15} />
          </button>
        </div>
        <div style={{ padding: "20px 24px" }}>
          <div style={{ fontSize: 13, color: "#C7C4D8", lineHeight: 1.7, marginBottom: 20, padding: "14px", background: "rgba(255,255,255,.03)", borderRadius: 12, border: "1px solid rgba(255,255,255,.06)" }}>
            {notif.content}
          </div>
          {[
            ["Đối tượng", TARGET_CFG[notif.target].label + (notif.targetValue ? ` (Lv.${notif.targetValue}+)` : "")],
            ["Người tạo", notif.createdBy],
            ["Ngày tạo",  fmtDate(notif.createdAt)],
            ...(notif.sentAt ? [["Đã gửi", fmtDate(notif.sentAt)]] : []),
            ...(notif.scheduledAt ? [["Lên lịch", fmtDate(notif.scheduledAt)]] : []),
            ["Đã gửi đến", notif.recipientCount ? fmtNum(notif.recipientCount) + " người" : "–"],
          ].map(([k, v]) => (
            <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "9px 0", borderBottom: "1px solid rgba(255,255,255,.05)" }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "#C7C4D8", textTransform: "uppercase", letterSpacing: ".06em" }}>{k}</span>
              <span style={{ fontSize: 12, color: "#E4E1EE", fontWeight: 600 }}>{v}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT: NotificationTable
// ═══════════════════════════════════════════════════════════════════════════

interface NotificationTableProps {
  notifications: Notification[];
  loading: boolean;
  onView:   (n: Notification) => void;
  onDelete: (n: Notification) => void;
}

function NotificationTable({ notifications, loading, onView, onDelete }: NotificationTableProps) {
  const thStyle: React.CSSProperties = { padding: "10px 16px", textAlign: "left", background: "rgba(255,255,255,.02)", borderBottom: "1px solid rgba(255,255,255,.06)", fontSize: 10, fontWeight: 700, color: "#C7C4D8", letterSpacing: ".07em", textTransform: "uppercase" };

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 780 }}>
        <thead>
          <tr>
            <th style={thStyle}>Thông báo</th>
            <th style={thStyle}>Loại</th>
            <th style={thStyle}>Trạng thái</th>
            <th style={thStyle}>Đối tượng</th>
            <th style={thStyle}>Đã gửi / Lên lịch</th>
            <th style={thStyle}>Người tạo</th>
            <th style={{ ...thStyle, textAlign: "center" }}>Thao tác</th>
          </tr>
        </thead>
        <tbody>
          {loading
            ? Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} style={{ borderBottom: "1px solid rgba(255,255,255,.04)" }}>
                  {[220, 90, 100, 110, 120, 130, 80].map((_, j) => (
                    <td key={j} style={{ padding: "14px 16px" }}>
                      <div style={{ height: 14, width: "75%", borderRadius: 7, background: "linear-gradient(90deg,#1a1828 25%,#242236 50%,#1a1828 75%)", backgroundSize: "200% 100%", animation: "shimmer 1.4s infinite" }} />
                    </td>
                  ))}
                </tr>
              ))
            : notifications.length === 0
            ? (
              <tr><td colSpan={7} style={{ padding: 56, textAlign: "center" }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
                  <Bell size={32} color="#47464f" />
                  <p style={{ fontSize: 14, fontWeight: 600, color: "#C7C4D8" }}>Chưa có thông báo nào</p>
                </div>
              </td></tr>
            )
            : notifications.map((n) => {
                const tc = TYPE_CFG[n.type];
                const TI = tc.Icon;
                const tgt = TARGET_CFG[n.target];
                const TgtI = tgt.Icon;
                return (
                  <tr key={n.id}
                    style={{ borderBottom: "1px solid rgba(255,255,255,.04)", transition: "background .15s" }}
                    onMouseOver={(e) => ((e.currentTarget as HTMLTableRowElement).style.background = "rgba(255,255,255,.025)")}
                    onMouseOut={(e)  => ((e.currentTarget as HTMLTableRowElement).style.background = "transparent")}
                  >
                    {/* Title */}
                    <td style={{ padding: "12px 16px", maxWidth: 240 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#E4E1EE", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: 4 }}>{n.title}</div>
                      <div style={{ fontSize: 11, color: "#C7C4D8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", opacity: .7 }}>{n.content.slice(0, 60)}…</div>
                    </td>
                    {/* Type */}
                    <td style={{ padding: "12px 16px" }}><TypeBadge type={n.type} /></td>
                    {/* Status */}
                    <td style={{ padding: "12px 16px" }}><StatusBadge status={n.status} /></td>
                    {/* Target */}
                    <td style={{ padding: "12px 16px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "#C7C4D8" }}>
                        <TgtI size={12} />
                        <span>{tgt.label}</span>
                      </div>
                      {n.targetValue && typeof n.targetValue === "string" && (
                        <div style={{ fontSize: 10, color: "#47464f", marginTop: 3 }}>Lv. {n.targetValue}+</div>
                      )}
                      {n.recipientCount != null && n.recipientCount > 0 && (
                        <div style={{ fontSize: 10, color: "#45f1c5", marginTop: 3 }}>{fmtNum(n.recipientCount)} người nhận</div>
                      )}
                    </td>
                    {/* Time */}
                    <td style={{ padding: "12px 16px" }}>
                      {n.sentAt
                        ? <><div style={{ fontSize: 11, color: "#45f1c5" }}>{fmtRelative(n.sentAt)}</div><div style={{ fontSize: 10, color: "#47464f" }}>{fmtDate(n.sentAt)}</div></>
                        : n.scheduledAt
                        ? <><div style={{ fontSize: 11, color: "#FFB785" }}>🕐 {fmtRelative(n.scheduledAt)}</div><div style={{ fontSize: 10, color: "#47464f" }}>{fmtDate(n.scheduledAt)}</div></>
                        : <span style={{ fontSize: 11, color: "#47464f" }}>–</span>
                      }
                    </td>
                    {/* Creator */}
                    <td style={{ padding: "12px 16px" }}>
                      <div style={{ fontSize: 11, color: "#C7C4D8" }}>{n.createdBy}</div>
                      <div style={{ fontSize: 10, color: "#47464f", marginTop: 2 }}>{fmtRelative(n.createdAt)}</div>
                    </td>
                    {/* Actions */}
                    <td style={{ padding: "12px 16px", textAlign: "center" }}>
                      <div style={{ display: "flex", gap: 5, justifyContent: "center" }}>
                        <button title="Xem chi tiết" onClick={() => onView(n)}
                          style={{ width: 30, height: 30, borderRadius: 8, background: "rgba(108,99,255,.08)", border: "1px solid rgba(108,99,255,.2)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#6C63FF", transition: "background .15s" }}
                          onMouseOver={(e) => (e.currentTarget.style.background = "rgba(108,99,255,.18)")}
                          onMouseOut={(e)  => (e.currentTarget.style.background = "rgba(108,99,255,.08)")}>
                          <Eye size={13} />
                        </button>
                        <button title="Xóa" onClick={() => onDelete(n)}
                          style={{ width: 30, height: 30, borderRadius: 8, background: "rgba(255,180,171,.07)", border: "1px solid rgba(255,180,171,.18)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#ffb4ab", transition: "background .15s" }}
                          onMouseOver={(e) => (e.currentTarget.style.background = "rgba(255,180,171,.17)")}
                          onMouseOut={(e)  => (e.currentTarget.style.background = "rgba(255,180,171,.07)")}>
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
          }
        </tbody>
      </table>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT: NotificationListAdmin
// ═══════════════════════════════════════════════════════════════════════════

interface NotificationListAdminProps {
  onCreateNew: () => void;
  toast: (msg: string, type?: Toast["type"]) => void;
}

function NotificationListAdmin({ onCreateNew, toast }: NotificationListAdminProps) {
  const [localNotifs, setLocalNotifs] = useState<Notification[]>(MOCK_NOTIFICATIONS);
  const [loading, setLoading]         = useState(true);
  const [statusFilter, setStatusFilter] = useState<NotifStatus | "all">("all");
  const [typeFilter,   setTypeFilter]   = useState<NotifType | "all">("all");
  const [search, setSearch]             = useState("");
  const [viewTarget, setViewTarget]     = useState<Notification | null>(null);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 7;

  // Simulate Firestore onSnapshot
  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 750);
    // ── REAL FIREBASE ─────────────────────────────────────────────────
    // const q = query(collection(db, "notifications"), orderBy("createdAt", "desc"));
    // const unsub = onSnapshot(q, (snap) => {
    //   const data = snap.docs.map((d) => ({
    //     id: d.id, ...d.data(),
    //     createdAt: d.data().createdAt?.toDate(),
    //     sentAt: d.data().sentAt?.toDate() ?? null,
    //     scheduledAt: d.data().scheduledAt?.toDate() ?? null,
    //   })) as Notification[];
    //   setLocalNotifs(data); setLoading(false);
    // });
    // return () => unsub();
    return () => clearTimeout(t);
  }, []);

  const filtered = useMemo(() => {
    let data = [...localNotifs];
    if (statusFilter !== "all") data = data.filter((n) => n.status === statusFilter);
    if (typeFilter   !== "all") data = data.filter((n) => n.type   === typeFilter);
    if (search) data = data.filter((n) => n.title.toLowerCase().includes(search.toLowerCase()) || n.content.toLowerCase().includes(search.toLowerCase()));
    return data;
  }, [localNotifs, statusFilter, typeFilter, search]);

  const paged = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, page]);

  const handleDelete = (n: Notification) => {
    // ── REAL FIREBASE ─────────────────────────────────────────────────
    // await deleteDoc(doc(db, "notifications", n.id));
    setLocalNotifs((prev) => prev.filter((x) => x.id !== n.id));
    toast(`Đã xóa "${n.title}"`, "info");
  };

  const stats = useMemo(() => ({
    total: localNotifs.length,
    sent:  localNotifs.filter((n) => n.status === "sent").length,
    sched: localNotifs.filter((n) => n.status === "scheduled").length,
    draft: localNotifs.filter((n) => n.status === "draft").length,
  }), [localNotifs]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Stats strip */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12 }}>
        {[
          { label: "Tổng",        val: stats.total, color: "#c4c0ff", glow: "rgba(196,192,255,.08)" },
          { label: "Đã gửi",      val: stats.sent,  color: "#45f1c5", glow: "rgba(69,241,197,.08)"  },
          { label: "Đã lên lịch", val: stats.sched, color: "#FFB785", glow: "rgba(255,183,133,.08)" },
          { label: "Nháp",        val: stats.draft, color: "#C7C4D8", glow: "rgba(199,196,208,.06)" },
        ].map(({ label, val, color, glow }) => (
          <div key={label} style={{ background: "rgba(22,20,34,.7)", border: "1px solid rgba(255,255,255,.06)", borderRadius: 16, padding: "14px 16px", backdropFilter: "blur(12px)", boxShadow: `0 4px 16px ${glow}` }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#C7C4D8", letterSpacing: ".07em", textTransform: "uppercase", marginBottom: 6 }}>{label}</div>
            <div style={{ fontSize: 24, fontWeight: 800, color }}>{val}</div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        {/* Search */}
        <div style={{ position: "relative", flex: "1 1 240px", maxWidth: 380 }}>
          <Search size={13} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#C7C4D8" }} />
          <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Tìm tiêu đề, nội dung…"
            style={{ ...IS, paddingLeft: 34 }} onFocus={onFocus} onBlur={onBlur} />
          {search && <button onClick={() => setSearch("")} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#C7C4D8" }}><X size={12} /></button>}
        </div>
        {/* Status filter */}
        <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value as any); setPage(1); }}
          style={{ ...IS, width: "auto", minWidth: 140 }} onFocus={onFocus} onBlur={onBlur}>
          <option value="all">Tất cả trạng thái</option>
          <option value="sent">Đã gửi</option>
          <option value="scheduled">Đã lên lịch</option>
          <option value="draft">Nháp</option>
        </select>
        {/* Type filter */}
        <select value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value as any); setPage(1); }}
          style={{ ...IS, width: "auto", minWidth: 150 }} onFocus={onFocus} onBlur={onBlur}>
          <option value="all">Tất cả loại</option>
          <option value="system">Hệ thống</option>
          <option value="promotion">Khuyến mãi</option>
          <option value="course_update">Khóa học</option>
        </select>
        <span style={{ marginLeft: "auto", fontSize: 12, color: "#C7C4D8", whiteSpace: "nowrap" }}>{filtered.length} thông báo</span>
        {/* Create button */}
        <button onClick={onCreateNew}
          style={{ display: "flex", alignItems: "center", gap: 7, padding: "10px 20px", borderRadius: 12, fontSize: 13, fontWeight: 700, cursor: "pointer", background: "linear-gradient(135deg,#6C63FF,#9B59B6)", border: "none", color: "#fff", boxShadow: "0 0 18px rgba(108,99,255,.28)", whiteSpace: "nowrap", transition: "opacity .2s" }}
          onMouseOver={(e) => (e.currentTarget.style.opacity = ".88")}
          onMouseOut={(e)  => (e.currentTarget.style.opacity = "1")}>
          <Plus size={15} /> Tạo thông báo mới
        </button>
      </div>

      {/* Table */}
      <div style={{ background: "rgba(22,20,34,.7)", borderRadius: 20, border: "1px solid rgba(255,255,255,.06)", overflow: "hidden" }}>
        <NotificationTable notifications={paged} loading={loading} onView={setViewTarget} onDelete={handleDelete} />
        {!loading && filtered.length > 0 && (
          <div style={{ padding: "14px 20px", borderTop: "1px solid rgba(255,255,255,.05)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 12, color: "#C7C4D8" }}>
              {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} / {filtered.length}
            </span>
            <div style={{ display: "flex", gap: 5 }}>
              <button disabled={page === 1} onClick={() => setPage((p) => p - 1)}
                style={{ width: 30, height: 30, borderRadius: 8, border: "1px solid rgba(255,255,255,.08)", background: "rgba(255,255,255,.04)", color: page === 1 ? "#47464f" : "#C7C4D8", cursor: page === 1 ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <ChevronLeft size={14} />
              </button>
              {Array.from({ length: Math.ceil(filtered.length / PAGE_SIZE) }, (_, i) => i + 1).map((p) => (
                <button key={p} onClick={() => setPage(p)}
                  style={{ width: 30, height: 30, borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer", background: p === page ? "linear-gradient(135deg,#6C63FF,#9B59B6)" : "rgba(255,255,255,.04)", border: p === page ? "none" : "1px solid rgba(255,255,255,.08)", color: p === page ? "#fff" : "#C7C4D8", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {p}
                </button>
              ))}
              <button disabled={page === Math.ceil(filtered.length / PAGE_SIZE)} onClick={() => setPage((p) => p + 1)}
                style={{ width: 30, height: 30, borderRadius: 8, border: "1px solid rgba(255,255,255,.08)", background: "rgba(255,255,255,.04)", color: page === Math.ceil(filtered.length / PAGE_SIZE) ? "#47464f" : "#C7C4D8", cursor: page === Math.ceil(filtered.length / PAGE_SIZE) ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      {viewTarget && <NotificationDetailModal notif={viewTarget} onClose={() => setViewTarget(null)} />}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT: NotificationFormAdmin
// ═══════════════════════════════════════════════════════════════════════════

interface NotificationFormAdminProps {
  onBack:  () => void;
  onSaved: (status: NotifStatus) => void;
  toast:   (msg: string, type?: Toast["type"]) => void;
}

const defaultForm = (): NotificationFormData => ({
  title: "",
  content: "",
  type: "system",
  target: "all",
  targetLevel: "1",
  targetUserIds: [],
  scheduleMode: "now",
  scheduledAt: new Date(Date.now() + 3600000).toISOString().slice(0, 16),
});

function NotificationFormAdmin({ onBack, onSaved, toast }: NotificationFormAdminProps) {
  const [form, setForm]         = useState<NotificationFormData>(defaultForm());
  const [errors, setErrors]     = useState<Partial<Record<keyof NotificationFormData | "general", string>>>({});
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<"send" | "schedule" | "draft" | null>(null);
  const [saving, setSaving]     = useState(false);
  const charCount = form.content.length;

  const set = <K extends keyof NotificationFormData>(k: K, v: NotificationFormData[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => ({ ...e, [k]: undefined }));
  };

  const validate = () => {
    const e: typeof errors = {};
    if (!form.title.trim())   e.title   = "Tiêu đề không được để trống";
    if (form.title.length > 120) e.title = "Tiêu đề tối đa 120 ký tự";
    if (!form.content.trim()) e.content = "Nội dung không được để trống";
    if (form.content.length > 500) e.content = "Nội dung tối đa 500 ký tự";
    if (form.target === "level" && (!form.targetLevel || isNaN(Number(form.targetLevel)))) e.targetLevel = "Vui lòng nhập cấp độ hợp lệ";
    if (form.target === "specific_users" && form.targetUserIds.length === 0) e.targetUserIds = "Vui lòng chọn ít nhất 1 người dùng";
    if (form.scheduleMode === "scheduled") {
      const d = new Date(form.scheduledAt);
      if (isNaN(d.getTime())) e.scheduledAt = "Ngày giờ không hợp lệ";
      if (d.getTime() <= Date.now()) e.scheduledAt = "Thời gian phải ở tương lai";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const triggerAction = (action: "send" | "schedule" | "draft") => {
    if (action !== "draft" && !validate()) return;
    if (action === "draft") {
      if (!form.title.trim()) { setErrors({ title: "Cần có tiêu đề để lưu nháp" }); return; }
    }
    if (action === "draft") { executeSave("draft"); return; }
    setPendingAction(action);
    setConfirmOpen(true);
  };

  const executeSave = async (status: NotifStatus) => {
    setSaving(true);
    setConfirmOpen(false);

    const payload = {
      title:       form.title.trim(),
      content:     form.content.trim(),
      type:        form.type,
      target:      form.target,
      targetValue: form.target === "level" ? form.targetLevel
                 : form.target === "specific_users" ? form.targetUserIds
                 : null,
      status,
      createdBy:   "admin@smartreview.io",
      // createdAt: serverTimestamp(),
      // sentAt:    status === "sent"       ? serverTimestamp() : null,
      // scheduledAt: status === "scheduled" ? Timestamp.fromDate(new Date(form.scheduledAt)) : null,
    };

    // ── REAL FIREBASE ─────────────────────────────────────────────────
    // const ref = await addDoc(collection(db, "notifications"), payload);
    // if (status === "sent") {
    //   // Optionally trigger Cloud Function to send FCM:
    //   // await httpsCallable(functions, "sendNotification")({ notificationId: ref.id });
    // }
    // ── MOCK ─────────────────────────────────────────────────────────
    await new Promise((r) => setTimeout(r, 900));
    setSaving(false);

    const messages: Record<NotifStatus, string> = {
      sent:      `✅ Thông báo "${payload.title}" đã gửi thành công!`,
      draft:     `💾 Đã lưu nháp "${payload.title}"`,
      scheduled: `⏰ Đã lên lịch "${payload.title}" vào ${new Date(form.scheduledAt).toLocaleString("vi-VN")}`,
    };
    toast(messages[status], status === "sent" ? "success" : status === "draft" ? "info" : "warning");
    onSaved(status);
  };

  const typeOpts: { value: NotifType; label: string; desc: string; Icon: React.ElementType; color: string }[] = [
    { value: "system",        label: "Hệ thống",   desc: "Bảo trì, cập nhật tính năng",  Icon: Settings, color: "#c4c0ff" },
    { value: "promotion",     label: "Khuyến mãi", desc: "Ưu đãi, giảm giá, sự kiện",   Icon: Zap,      color: "#FFB785" },
    { value: "course_update", label: "Khóa học",   desc: "Nội dung mới, bài giảng thêm", Icon: BookOpen, color: "#45f1c5" },
  ];

  const estimatedCount = useMemo(() => {
    if (form.target === "all")            return 12800;
    if (form.target === "level")          return Math.max(0, 12800 - Number(form.targetLevel || 0) * 320);
    if (form.target === "specific_users") return form.targetUserIds.length;
    return 0;
  }, [form.target, form.targetLevel, form.targetUserIds]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      {/* Form header */}
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <button onClick={onBack} style={{ display: "flex", alignItems: "center", gap: 7, padding: "8px 14px", borderRadius: 11, fontSize: 13, fontWeight: 600, cursor: "pointer", background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.1)", color: "#C7C4D8" }}>
          <ArrowLeft size={14} /> Quay lại
        </button>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: "#E4E1EE" }}>Tạo thông báo mới</h2>
          <p style={{ fontSize: 11, color: "#C7C4D8", marginTop: 2 }}>Firestore: <code style={{ color: "#c4c0ff", background: "rgba(108,99,255,.1)", padding: "1px 6px", borderRadius: 4, fontSize: 10 }}>notifications</code> collection</p>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 20, alignItems: "start" }}>
        {/* LEFT: Main form */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Card: Basic info */}
          <div style={{ background: "rgba(22,20,34,.7)", border: "1px solid rgba(255,255,255,.07)", borderRadius: 20, overflow: "hidden" }}>
            <div style={{ padding: "14px 20px", borderBottom: "1px solid rgba(255,255,255,.06)", display: "flex", alignItems: "center", gap: 10, background: "rgba(255,255,255,.02)" }}>
              <div style={{ width: 32, height: 32, borderRadius: 9, background: "rgba(108,99,255,.14)", border: "1px solid rgba(108,99,255,.24)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Bell size={15} color="#6C63FF" />
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#E4E1EE" }}>Nội dung thông báo</div>
                <div style={{ fontSize: 11, color: "#C7C4D8" }}>Tiêu đề và nội dung hiển thị đến người dùng</div>
              </div>
            </div>
            <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Title */}
              <div>
                <label style={LABEL}>Tiêu đề <span style={{ color: "#ffb4ab" }}>*</span></label>
                <input value={form.title} onChange={(e) => set("title", e.target.value)}
                  placeholder="e.g. Bảo trì hệ thống ngày 30/5"
                  style={{ ...IS, fontSize: 14, fontWeight: 600 }}
                  onFocus={onFocus} onBlur={onBlur} />
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 5 }}>
                  {errors.title ? <span style={{ fontSize: 11, color: "#ffb4ab" }}>⚠ {errors.title}</span> : <span />}
                  <span style={{ fontSize: 10, color: form.title.length > 100 ? "#ffb4ab" : "#47464f" }}>{form.title.length}/120</span>
                </div>
              </div>

              {/* Content */}
              <div>
                <label style={LABEL}>Nội dung <span style={{ color: "#ffb4ab" }}>*</span></label>
                <textarea value={form.content} onChange={(e) => set("content", e.target.value)} rows={4}
                  placeholder="Mô tả chi tiết thông báo…"
                  style={{ ...IS, resize: "vertical" }}
                  onFocus={onFocus} onBlur={onBlur} />
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 5 }}>
                  {errors.content ? <span style={{ fontSize: 11, color: "#ffb4ab" }}>⚠ {errors.content}</span> : <span />}
                  <span style={{ fontSize: 10, color: charCount > 450 ? "#ffb4ab" : "#47464f" }}>{charCount}/500</span>
                </div>
              </div>
            </div>
          </div>

          {/* Card: Type */}
          <div style={{ background: "rgba(22,20,34,.7)", border: "1px solid rgba(255,255,255,.07)", borderRadius: 20, overflow: "hidden" }}>
            <div style={{ padding: "14px 20px", borderBottom: "1px solid rgba(255,255,255,.06)", display: "flex", alignItems: "center", gap: 10, background: "rgba(255,255,255,.02)" }}>
              <div style={{ width: 32, height: 32, borderRadius: 9, background: "rgba(108,99,255,.14)", border: "1px solid rgba(108,99,255,.24)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Layers size={15} color="#6C63FF" />
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#E4E1EE" }}>Loại thông báo</div>
            </div>
            <div style={{ padding: 20, display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}>
              {typeOpts.map(({ value, label, desc, Icon, color }) => {
                const active = form.type === value;
                return (
                  <button key={value} onClick={() => set("type", value)}
                    style={{ padding: "14px 12px", borderRadius: 14, cursor: "pointer", textAlign: "left", transition: "all .15s", background: active ? `${color}14` : "rgba(255,255,255,.03)", border: `1px solid ${active ? `${color}40` : "rgba(255,255,255,.07)"}`, boxShadow: active ? `0 0 16px ${color}18` : "none" }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: active ? `${color}22` : "rgba(255,255,255,.05)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 10 }}>
                      <Icon size={17} color={active ? color : "#C7C4D8"} />
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: active ? color : "#E4E1EE", marginBottom: 4 }}>{label}</div>
                    <div style={{ fontSize: 10, color: "#C7C4D8", lineHeight: 1.5 }}>{desc}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Card: Target */}
          <div style={{ background: "rgba(22,20,34,.7)", border: "1px solid rgba(255,255,255,.07)", borderRadius: 20, overflow: "hidden" }}>
            <div style={{ padding: "14px 20px", borderBottom: "1px solid rgba(255,255,255,.06)", display: "flex", alignItems: "center", gap: 10, background: "rgba(255,255,255,.02)" }}>
              <div style={{ width: 32, height: 32, borderRadius: 9, background: "rgba(108,99,255,.14)", border: "1px solid rgba(108,99,255,.24)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Users size={15} color="#6C63FF" />
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#E4E1EE" }}>Đối tượng nhận</div>
                <div style={{ fontSize: 11, color: "#C7C4D8" }}>Xác định ai sẽ nhận thông báo này</div>
              </div>
            </div>
            <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Target radio buttons */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
                {(["all", "level", "specific_users"] as NotifTarget[]).map((t) => {
                  const cfg = TARGET_CFG[t];
                  const TI = cfg.Icon;
                  const active = form.target === t;
                  return (
                    <button key={t} onClick={() => set("target", t)}
                      style={{ padding: "10px 12px", borderRadius: 12, cursor: "pointer", textAlign: "left", transition: "all .15s", background: active ? "rgba(108,99,255,.14)" : "rgba(255,255,255,.03)", border: `1px solid ${active ? "rgba(108,99,255,.4)" : "rgba(255,255,255,.07)"}`, display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ width: 28, height: 28, borderRadius: 8, background: active ? "rgba(108,99,255,.2)" : "rgba(255,255,255,.05)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <TI size={14} color={active ? "#c4c0ff" : "#C7C4D8"} />
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 700, color: active ? "#c4c0ff" : "#C7C4D8" }}>{cfg.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Level input */}
              {form.target === "level" && (
                <div style={{ animation: "fadeDown .2s ease" }}>
                  <label style={LABEL}>Cấp độ tối thiểu <span style={{ color: "#ffb4ab" }}>*</span></label>
                  <div style={{ display: "flex", gap: 8 }}>
                    <input type="number" min={1} max={99} value={form.targetLevel}
                      onChange={(e) => set("targetLevel", e.target.value)}
                      style={{ ...IS, maxWidth: 120 }}
                      onFocus={onFocus} onBlur={onBlur} />
                    <div style={{ display: "flex", alignItems: "center", padding: "0 14px", background: "rgba(108,99,255,.08)", border: "1px solid rgba(108,99,255,.2)", borderRadius: 12, fontSize: 12, color: "#c4c0ff", fontWeight: 600 }}>
                      ~{fmtNum(estimatedCount)} người nhận
                    </div>
                  </div>
                  {errors.targetLevel && <p style={{ fontSize: 11, color: "#ffb4ab", marginTop: 5 }}>⚠ {errors.targetLevel}</p>}
                </div>
              )}

              {/* User multi-select */}
              {form.target === "specific_users" && (
                <div style={{ animation: "fadeDown .2s ease" }}>
                  <label style={LABEL}>Chọn người dùng cụ thể <span style={{ color: "#ffb4ab" }}>*</span></label>
                  <UserMultiSelect users={MOCK_USERS} selected={form.targetUserIds} onChange={(ids) => set("targetUserIds", ids)} />
                  {errors.targetUserIds && <p style={{ fontSize: 11, color: "#ffb4ab", marginTop: 5 }}>⚠ {errors.targetUserIds}</p>}
                </div>
              )}
            </div>
          </div>

          {/* Card: Scheduling */}
          <div style={{ background: "rgba(22,20,34,.7)", border: "1px solid rgba(255,255,255,.07)", borderRadius: 20, overflow: "hidden" }}>
            <div style={{ padding: "14px 20px", borderBottom: "1px solid rgba(255,255,255,.06)", display: "flex", alignItems: "center", gap: 10, background: "rgba(255,255,255,.02)" }}>
              <div style={{ width: 32, height: 32, borderRadius: 9, background: "rgba(108,99,255,.14)", border: "1px solid rgba(108,99,255,.24)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Calendar size={15} color="#6C63FF" />
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#E4E1EE" }}>Thời gian gửi</div>
            </div>
            <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {(["now", "scheduled"] as const).map((m) => {
                  const active = form.scheduleMode === m;
                  return (
                    <button key={m} onClick={() => set("scheduleMode", m)}
                      style={{ padding: "12px", borderRadius: 12, cursor: "pointer", textAlign: "center", transition: "all .15s", background: active ? (m === "now" ? "rgba(69,241,197,.12)" : "rgba(255,183,133,.12)") : "rgba(255,255,255,.03)", border: `1px solid ${active ? (m === "now" ? "rgba(69,241,197,.35)" : "rgba(255,183,133,.35)") : "rgba(255,255,255,.07)"}`, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                      {m === "now" ? <Send size={14} color={active ? "#45f1c5" : "#C7C4D8"} /> : <Clock size={14} color={active ? "#FFB785" : "#C7C4D8"} />}
                      <span style={{ fontSize: 13, fontWeight: 700, color: active ? (m === "now" ? "#45f1c5" : "#FFB785") : "#C7C4D8" }}>
                        {m === "now" ? "Gửi ngay" : "Lên lịch"}
                      </span>
                    </button>
                  );
                })}
              </div>
              {form.scheduleMode === "scheduled" && (
                <div style={{ animation: "fadeDown .2s ease" }}>
                  <label style={LABEL}>Ngày & giờ gửi <span style={{ color: "#ffb4ab" }}>*</span></label>
                  <input type="datetime-local" value={form.scheduledAt}
                    onChange={(e) => set("scheduledAt", e.target.value)}
                    min={new Date().toISOString().slice(0, 16)}
                    style={{ ...IS }}
                    onFocus={onFocus} onBlur={onBlur} />
                  {errors.scheduledAt && <p style={{ fontSize: 11, color: "#ffb4ab", marginTop: 5 }}>⚠ {errors.scheduledAt}</p>}
                  <p style={{ fontSize: 11, color: "#C7C4D8", marginTop: 6, display: "flex", alignItems: "center", gap: 5 }}>
                    <Info size={11} />
                    Cloud Function sẽ tự động gửi FCM đúng giờ
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT: Preview + Actions sidebar */}
        <div style={{ position: "sticky", top: 80, display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Preview card */}
          <div style={{ background: "rgba(22,20,34,.7)", border: "1px solid rgba(255,255,255,.07)", borderRadius: 18, overflow: "hidden" }}>
            <div style={{ padding: "12px 16px", borderBottom: "1px solid rgba(255,255,255,.06)", fontSize: 11, fontWeight: 700, color: "#C7C4D8", textTransform: "uppercase", letterSpacing: ".07em" }}>
              Preview
            </div>
            <div style={{ padding: 16 }}>
              {/* Phone mockup notification */}
              <div style={{ background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.1)", borderRadius: 14, padding: "12px 14px", display: "flex", gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: TYPE_CFG[form.type].bg, border: `1px solid ${TYPE_CFG[form.type].border}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  {React.createElement(TYPE_CFG[form.type].Icon, { size: 16, color: TYPE_CFG[form.type].color })}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#E4E1EE", marginBottom: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {form.title || <span style={{ color: "#47464f" }}>Tiêu đề thông báo…</span>}
                  </div>
                  <div style={{ fontSize: 11, color: "#C7C4D8", lineHeight: 1.6, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
                    {form.content || <span style={{ color: "#47464f" }}>Nội dung thông báo…</span>}
                  </div>
                  <div style={{ fontSize: 10, color: "#47464f", marginTop: 5, display: "flex", gap: 8 }}>
                    <span>Smart Review</span>
                    <span>· Vừa xong</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Estimate */}
          <div style={{ background: "rgba(22,20,34,.7)", border: "1px solid rgba(255,255,255,.07)", borderRadius: 18, padding: 16 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#C7C4D8", letterSpacing: ".07em", textTransform: "uppercase", marginBottom: 12 }}>Ước tính</div>
            {[
              { label: "Người nhận", val: `~${fmtNum(estimatedCount)}`, color: "#45f1c5" },
              { label: "Loại",       val: TYPE_CFG[form.type].label, color: TYPE_CFG[form.type].color },
              { label: "Đối tượng", val: TARGET_CFG[form.target].label, color: "#c4c0ff" },
              { label: "Phương thức", val: "Firebase FCM", color: "#FFB785" },
            ].map(({ label, val, color }) => (
              <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: "1px solid rgba(255,255,255,.05)" }}>
                <span style={{ fontSize: 11, color: "#C7C4D8" }}>{label}</span>
                <span style={{ fontSize: 11, fontWeight: 700, color }}>{val}</span>
              </div>
            ))}
          </div>

          {/* Action buttons */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {/* Send now / Schedule */}
            <button onClick={() => triggerAction(form.scheduleMode === "now" ? "send" : "schedule")}
              disabled={saving}
              style={{ width: "100%", padding: "12px", borderRadius: 14, fontSize: 14, fontWeight: 800, cursor: saving ? "wait" : "pointer", background: form.scheduleMode === "now" ? "linear-gradient(135deg,#6C63FF,#9B59B6)" : "linear-gradient(135deg,#FFB785,#FF8C42)", border: "none", color: "#fff", boxShadow: "0 0 20px rgba(108,99,255,.25)", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, opacity: saving ? .75 : 1, transition: "opacity .2s" }}>
              {saving
                ? <><Loader size={15} style={{ animation: "spin .8s linear infinite" }} /> Đang xử lý…</>
                : form.scheduleMode === "now"
                ? <><Send size={15} /> Gửi ngay</>
                : <><Clock size={15} /> Lên lịch</>
              }
            </button>
            {/* Save draft */}
            <button onClick={() => triggerAction("draft")} disabled={saving}
              style={{ width: "100%", padding: "10px", borderRadius: 14, fontSize: 13, fontWeight: 600, cursor: "pointer", background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.1)", color: "#C7C4D8", display: "flex", alignItems: "center", justifyContent: "center", gap: 7, opacity: saving ? .5 : 1 }}>
              <Save size={14} /> Lưu nháp
            </button>
            {/* Firebase path */}
            <div style={{ padding: "10px 12px", background: "rgba(108,99,255,.06)", border: "1px solid rgba(108,99,255,.16)", borderRadius: 12 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#9B59B6", marginBottom: 4 }}>FIRESTORE PATH</div>
              <code style={{ fontSize: 10, color: "#c4c0ff", lineHeight: 1.8 }}>
                notifications/<span style={{ color: "#45f1c5" }}>{"{"}"new_id"{"}"}</span>
              </code>
            </div>
          </div>
        </div>
      </div>

      {/* Confirm dialog */}
      {confirmOpen && (
        <SendConfirmDialog
          form={form}
          users={MOCK_USERS}
          onConfirm={() => executeSave(pendingAction === "schedule" ? "scheduled" : "sent")}
          onCancel={() => { setConfirmOpen(false); setPendingAction(null); }}
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN: NotificationAdmin (tabbed container)
// ═══════════════════════════════════════════════════════════════════════════

export default function NotificationAdmin() {
  const [view, setView] = useState<"list" | "form">("list");
  const { toasts, add: addToast } = useToast();

  const handleSaved = (status: NotifStatus) => {
    setView("list");
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0A090F", color: "#E4E1EE", fontFamily: "'DM Sans', sans-serif", backgroundImage: "radial-gradient(ellipse at 0% 0%, rgba(108,99,255,.07) 0%, transparent 55%), radial-gradient(ellipse at 100% 100%, rgba(255,183,133,.04) 0%, transparent 55%)" }}>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;600;700;800&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes scaleIn{from{opacity:0;transform:scale(.94)}to{opacity:1;transform:scale(1)}}
        @keyframes slideInRight{from{opacity:0;transform:translateX(20px)}to{opacity:1;transform:translateX(0)}}
        @keyframes fadeDown{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:translateY(0)}}
        @keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}
        input,select,textarea,button{font-family:'DM Sans',sans-serif;}
        input[type="datetime-local"]::-webkit-calendar-picker-indicator{filter:invert(0.6);}
        ::-webkit-scrollbar{width:5px;height:5px;}
        ::-webkit-scrollbar-track{background:#0A090F;}
        ::-webkit-scrollbar-thumb{background:#2a2935;border-radius:10px;}
      `}</style>

      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "28px 24px", display: "flex", flexDirection: "column", gap: 24 }}>

        {/* Page header */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 44, height: 44, borderRadius: 13, background: "linear-gradient(135deg,#6C63FF,#9B59B6)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 22px rgba(108,99,255,.32)" }}>
            <Bell size={22} color="#fff" />
          </div>
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 800, color: "#E4E1EE", letterSpacing: "-.02em" }}>
              {view === "list" ? "Quản lý Thông báo" : "Tạo Thông báo Mới"}
            </h1>
            <p style={{ fontSize: 12, color: "#C7C4D8", marginTop: 2 }}>
              Firestore: <code style={{ background: "rgba(108,99,255,.12)", padding: "1px 6px", borderRadius: 5, fontSize: 11, color: "#c4c0ff" }}>notifications</code> · FCM Push Notifications
            </p>
          </div>
        </div>

        {/* Tab indicator */}
        <div style={{ display: "flex", gap: 4, background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.06)", borderRadius: 12, padding: 4, width: "fit-content" }}>
          {[
            { id: "list", label: "Danh sách", Icon: Bell },
            { id: "form", label: "Tạo mới",   Icon: Plus },
          ].map(({ id, label, Icon }) => (
            <button key={id} onClick={() => setView(id as any)}
              style={{ display: "flex", alignItems: "center", gap: 7, padding: "8px 16px", borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: "pointer", transition: "all .2s", background: view === id ? "linear-gradient(135deg,#6C63FF,#9B59B6)" : "transparent", border: view === id ? "1px solid rgba(108,99,255,.3)" : "1px solid transparent", color: view === id ? "#fff" : "#C7C4D8", boxShadow: view === id ? "0 0 14px rgba(108,99,255,.25)" : "none" }}>
              <Icon size={14} /> {label}
            </button>
          ))}
        </div>

        {/* Content */}
        {view === "list"
          ? <NotificationListAdmin onCreateNew={() => setView("form")} toast={addToast} />
          : <NotificationFormAdmin onBack={() => setView("list")} onSaved={handleSaved} toast={addToast} />
        }
      </div>

      <ToastContainer toasts={toasts} />
    </div>
  );
}

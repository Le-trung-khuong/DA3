/**
 * Smart Review — Admin Notification Manager
 * File: src/pages/admin/notifications/NotificationAdmin.tsx
 */

"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { db } from "../../../utils/config";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { deleteNotification } from "../../../services/notificationService";
import {
  Bell,
  Plus,
  Send,
  Save,
  Trash2,
  Eye,
  X,
  Check,
  Filter,
  Search,
  RefreshCw,
  AlertTriangle,
  Clock,
  Users,
  Layers,
  Zap,
  Settings,
  Calendar,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
  CheckCircle,
  PauseCircle,
  XCircle,
  Loader,
  Info,
  BarChart2,
  User,
  BookOpen,
} from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────

type NotifType = "system" | "promotion" | "course_update";
type NotifStatus = "draft" | "sent" | "scheduled";
type NotifTarget = "all" | "specific_users";

interface Notification {
  id: string;
  title: string;
  content: string;
  type: NotifType;
  target: NotifTarget;
  targetValue?: string | string[];
  scheduledAt?: Date | null;
  status: NotifStatus;
  createdBy: string;
  createdAt: Date;
  sentAt?: Date | null;
  recipientCount?: number;
}

interface AppUser {
  uid: string;
  name: string;
  email: string;
  xp: number;
  totalXP: number;
  role: string;
  status: string;
}

interface NotificationFormData {
  title: string;
  content: string;
  type: NotifType;
  target: NotifTarget;
  targetUserIds: string[];
  scheduleMode: "now" | "scheduled";
  scheduledAt: string;
}

// ─────────────────────────────────────────────────────────────────────────
// MOCK USERS (sẽ thay bằng dữ liệu thật từ Firestore)
// ─────────────────────────────────────────────────────────────────────────

const MOCK_USERS: AppUser[] = [
  { uid: "uid_0001", name: "Hoàng Tuấn", email: "hoang@gmail.com", xp: 12200, totalXP: 12200, role: "student", status: "active" },
  { uid: "uid_0002", name: "Linh Nguyễn", email: "linh@gmail.com", xp: 8450, totalXP: 8450, role: "student", status: "active" },
  { uid: "uid_0003", name: "Mai Văn", email: "mai@example.com", xp: 7900, totalXP: 7900, role: "student", status: "active" },
  { uid: "uid_0004", name: "Sarah Drasner", email: "sarah@edu.io", xp: 28000, totalXP: 28000, role: "instructor", status: "active" },
  { uid: "uid_0005", name: "Phạm Quân Đức", email: "quan@gmail.com", xp: 5800, totalXP: 5800, role: "student", status: "active" },
  { uid: "uid_0006", name: "Nguyễn Mai Vy", email: "vy@gmail.com", xp: 4200, totalXP: 4200, role: "student", status: "active" },
  { uid: "uid_0007", name: "Trần Linh Nhi", email: "nhi@gmail.com", xp: 6700, totalXP: 6700, role: "student", status: "active" },
  { uid: "uid_0008", name: "Lê Minh Huy", email: "huy@gmail.com", xp: 5400, totalXP: 5400, role: "student", status: "active" },
  { uid: "uid_0009", name: "Võ Thị Hoa", email: "hoa@edu.io", xp: 16500, totalXP: 16500, role: "instructor", status: "active" },
  { uid: "uid_0010", name: "Bích Nguyễn", email: "bich@gmail.com", xp: 3100, totalXP: 3100, role: "student", status: "active" },
  { uid: "uid_0011", name: "Mod Đình Long", email: "mod@sr.io", xp: 18000, totalXP: 18000, role: "moderator", status: "active" },
  { uid: "uid_0016", name: "Lê Trung Khương", email: "khuong@gmail.com", xp: 7200, totalXP: 7200, role: "student", status: "active" },
];

// ─────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────

const fmtDate = (d: Date) => d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
const fmtRelative = (d: Date) => {
  const s = (Date.now() - d.getTime()) / 1000;
  if (s < 60) return "vừa xong";
  if (s < 3600) return `${Math.floor(s / 60)}p trước`;
  if (s < 86400) return `${Math.floor(s / 3600)}h trước`;
  return `${Math.floor(s / 86400)}d trước`;
};
const fmtNum = (n: number) => new Intl.NumberFormat("vi-VN").format(n);

const TYPE_CFG: Record<NotifType, { label: string; color: string; bg: string; border: string; Icon: React.ElementType }> = {
  system: { label: "Hệ thống", color: "#c4c0ff", bg: "rgba(196,192,255,.12)", border: "rgba(196,192,255,.28)", Icon: Settings },
  promotion: { label: "Khuyến mãi", color: "#FFB785", bg: "rgba(255,183,133,.12)", border: "rgba(255,183,133,.28)", Icon: Zap },
  course_update: { label: "Khóa học", color: "#45f1c5", bg: "rgba(69,241,197,.12)", border: "rgba(69,241,197,.28)", Icon: BookOpen },
};

const STATUS_CFG: Record<NotifStatus, { label: string; color: string; bg: string; border: string; Icon: React.ElementType }> = {
  sent: { label: "Đã gửi", color: "#45f1c5", bg: "rgba(69,241,197,.12)", border: "rgba(69,241,197,.28)", Icon: CheckCircle },
  draft: { label: "Nháp", color: "#C7C4D8", bg: "rgba(199,196,208,.08)", border: "rgba(199,196,208,.2)", Icon: PauseCircle },
  scheduled: { label: "Đã lên lịch", color: "#FFB785", bg: "rgba(255,183,133,.12)", border: "rgba(255,183,133,.28)", Icon: Clock },
};

const TARGET_CFG: Record<NotifTarget, { label: string; Icon: React.ElementType }> = {
  all: { label: "Tất cả", Icon: Users },
  specific_users: { label: "Người dùng cụ thể", Icon: User },
};

const ROLE_GRADS: Record<string, string> = {
  student: "linear-gradient(135deg,#6C63FF,#9B59B6)",
  instructor: "linear-gradient(135deg,#00D4AA,#0F9E7B)",
  moderator: "linear-gradient(135deg,#FFB785,#FF8C42)",
  admin: "linear-gradient(135deg,#FFD700,#FF8C42)",
};

function initials(name: string) {
  return name.split(" ").map((w) => w[0]?.toUpperCase() ?? "").slice(0, 2).join("");
}

// ─────────────────────────────────────────────────────────────────────────
// SHARED STYLES
// ─────────────────────────────────────────────────────────────────────────

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
  e.target.style.boxShadow = "0 0 0 3px rgba(108,99,255,.1)";
}
function onBlur(e: React.FocusEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
  e.target.style.borderColor = "rgba(255,255,255,.08)";
  e.target.style.boxShadow = "none";
}

// ─────────────────────────────────────────────────────────────────────────
// TOAST
// ─────────────────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────────────────
// COMPONENTS
// ─────────────────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────────────────
// UserMultiSelect
// ─────────────────────────────────────────────────────────────────────────

interface UserMultiSelectProps {
  users: AppUser[];
  selected: string[];
  onChange: (ids: string[]) => void;
}

function UserMultiSelect({ users, selected, onChange }: UserMultiSelectProps) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
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
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase())
  );

  const toggle = (uid: string) => {
    onChange(selected.includes(uid) ? selected.filter((x) => x !== uid) : [...selected, uid]);
  };

  const selectedUsers = users.filter((u) => selected.includes(u.uid));

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <div
        onClick={() => setOpen((p) => !p)}
        style={{ minHeight: 44, background: "#0c0b16", border: `1px solid ${open ? "rgba(108,99,255,.55)" : "rgba(255,255,255,.08)"}`, borderRadius: 12, padding: "8px 12px", cursor: "pointer", display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center", transition: "border-color .2s", boxShadow: open ? "0 0 0 3px rgba(108,99,255,.1)" : "none" }}
      >
        {selectedUsers.length === 0
          ? <span style={{ fontSize: 13, color: "#47464f" }}>Chọn người dùng…</span>
          : selectedUsers.map((u) => (
              <span key={u.uid} style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 8px", borderRadius: 999, background: "rgba(108,99,255,.15)", border: "1px solid rgba(108,99,255,.3)", fontSize: 11, fontWeight: 600, color: "#c4c0ff" }}>
                {u.name}
                <button onClick={(e) => { e.stopPropagation(); toggle(u.uid); }} style={{ background: "none", border: "none", cursor: "pointer", color: "#9B59B6", padding: 0, display: "flex" }}>
                  <X size={10} />
                </button>
              </span>
            ))
        }
        <ChevronDown size={13} color="#C7C4D8" style={{ marginLeft: "auto", transition: "transform .2s", transform: open ? "rotate(180deg)" : "rotate(0)" }} />
      </div>

      {open && (
        <div style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0, zIndex: 200, background: "rgba(18,16,28,.98)", border: "1px solid rgba(255,255,255,.1)", borderRadius: 14, boxShadow: "0 16px 40px rgba(0,0,0,.5)", overflow: "hidden" }}>
          <div style={{ padding: 10, borderBottom: "1px solid rgba(255,255,255,.07)" }}>
            <div style={{ position: "relative" }}>
              <Search size={13} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#C7C4D8" }} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Tìm theo tên hoặc email"
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
                        {initials(u.name)}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: "#E4E1EE", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.name}</div>
                        <div style={{ fontSize: 10, color: "#C7C4D8", opacity: .7 }}>{u.email}</div>
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

// ─────────────────────────────────────────────────────────────────────────
// SendConfirmDialog
// ─────────────────────────────────────────────────────────────────────────

interface SendConfirmDialogProps {
  form: NotificationFormData;
  users: AppUser[];
  onConfirm: () => void;
  onCancel: () => void;
}

function SendConfirmDialog({ form, users, onConfirm, onCancel }: SendConfirmDialogProps) {
  const isScheduled = form.scheduleMode === "scheduled";
  const color = isScheduled ? "#FFB785" : "#45f1c5";
  const accent = isScheduled ? "rgba(255,183,133,.15)" : "rgba(69,241,197,.12)";
  const border = isScheduled ? "rgba(255,183,133,.3)" : "rgba(69,241,197,.28)";

  const targetLabel =
    form.target === "all" ? "Tất cả người dùng" :
      `${form.targetUserIds.length} người dùng được chọn`;

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.72)", backdropFilter: "blur(8px)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
      onClick={(e) => e.target === e.currentTarget && onCancel()}>
      <div style={{ width: "100%", maxWidth: 440, background: "rgba(15,13,24,.98)", border: `1px solid ${border}`, borderRadius: 24, padding: 32, boxShadow: `0 24px 80px rgba(0,0,0,.6)`, animation: "scaleIn .2s ease" }}>
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
        <div style={{ background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.08)", borderRadius: 14, padding: "14px 16px", marginBottom: 20, display: "flex", flexDirection: "column", gap: 8 }}>
          {[
            ["Tiêu đề", form.title || "(trống)"],
            ["Loại", TYPE_CFG[form.type].label],
            ["Đối tượng", targetLabel],
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

// ─────────────────────────────────────────────────────────────────────────
// NotificationDetailModal
// ─────────────────────────────────────────────────────────────────────────

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
            ["Đối tượng", TARGET_CFG[notif.target].label],
            ["Người tạo", notif.createdBy],
            ["Ngày tạo", fmtDate(notif.createdAt)],
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

// ─────────────────────────────────────────────────────────────────────────
// NotificationTable
// ─────────────────────────────────────────────────────────────────────────

interface NotificationTableProps {
  notifications: Notification[];
  loading: boolean;
  onView: (n: Notification) => void;
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
                    <td style={{ padding: "12px 16px", maxWidth: 240 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#E4E1EE", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: 4 }}>{n.title}</div>
                      <div style={{ fontSize: 11, color: "#C7C4D8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", opacity: .7 }}>{n.content.slice(0, 60)}…</div>
                    </td>
                    <td style={{ padding: "12px 16px" }}><TypeBadge type={n.type} /></td>
                    <td style={{ padding: "12px 16px" }}><StatusBadge status={n.status} /></td>
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
                    <td style={{ padding: "12px 16px" }}>
                      {n.sentAt
                        ? <><div style={{ fontSize: 11, color: "#45f1c5" }}>{fmtRelative(n.sentAt)}</div><div style={{ fontSize: 10, color: "#47464f" }}>{fmtDate(n.sentAt)}</div></>
                        : n.scheduledAt
                        ? <><div style={{ fontSize: 11, color: "#FFB785" }}>🕐 {fmtRelative(n.scheduledAt)}</div><div style={{ fontSize: 10, color: "#47464f" }}>{fmtDate(n.scheduledAt)}</div></>
                        : <span style={{ fontSize: 11, color: "#47464f" }}>–</span>
                      }
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <div style={{ fontSize: 11, color: "#C7C4D8" }}>{n.createdBy}</div>
                      <div style={{ fontSize: 10, color: "#47464f", marginTop: 2 }}>{fmtRelative(n.createdAt)}</div>
                    </td>
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

// ─────────────────────────────────────────────────────────────────────────
// NotificationListAdmin
// ─────────────────────────────────────────────────────────────────────────

interface NotificationListAdminProps {
  onCreateNew: () => void;
  toast: (msg: string, type?: Toast["type"]) => void;
}

function NotificationListAdmin({ onCreateNew, toast }: NotificationListAdminProps) {
  const [localNotifs, setLocalNotifs] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<NotifStatus | "all">("all");
  const [typeFilter, setTypeFilter] = useState<NotifType | "all">("all");
  const [search, setSearch] = useState("");
  const [viewTarget, setViewTarget] = useState<Notification | null>(null);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 7;

  useEffect(() => {
    const q = query(collection(db, "notifications"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const data = snap.docs.map((d) => {
          const docData = d.data();
          return {
            id: d.id,
            title: docData.title || "",
            content: docData.body || docData.content || "",
            type: (docData.type === "system" || docData.type === "promotion" || docData.type === "course_update") ? docData.type : "system",
            target: docData.target === "all" ? "all" : "specific_users",
            targetValue: docData.targetValue,
            status: (docData.status === "sent" || docData.status === "scheduled" || docData.status === "draft") ? docData.status : "sent",
            createdBy: docData.createdBy || "admin",
            createdAt: docData.createdAt?.toDate() || new Date(),
            sentAt: docData.sentAt?.toDate() || null,
            scheduledAt: docData.scheduledAt?.toDate() || null,
            recipientCount: docData.recipientCount,
          } as Notification;
        });
        setLocalNotifs(data);
        setLoading(false);
      },
      (err) => {
        console.error("Error loading notifications:", err);
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  const filtered = useMemo(() => {
    let data = [...localNotifs];
    if (statusFilter !== "all") data = data.filter((n) => n.status === statusFilter);
    if (typeFilter !== "all") data = data.filter((n) => n.type === typeFilter);
    if (search) data = data.filter((n) => n.title.toLowerCase().includes(search.toLowerCase()) || n.content.toLowerCase().includes(search.toLowerCase()));
    return data;
  }, [localNotifs, statusFilter, typeFilter, search]);

  const paged = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, page]);

  const handleDelete = async (n: Notification) => {
    if (window.confirm(`Bạn có chắc muốn xóa thông báo "${n.title}"?`)) {
      try {
        await deleteNotification(n.id);
        toast(`Đã xóa "${n.title}"`, "info");
      } catch (error) {
        console.error("Delete failed:", error);
        toast("Xóa thất bại, vui lòng thử lại", "error");
      }
    }
  };

  const stats = useMemo(() => ({
    total: localNotifs.length,
    sent: localNotifs.filter((n) => n.status === "sent").length,
    sched: localNotifs.filter((n) => n.status === "scheduled").length,
    draft: localNotifs.filter((n) => n.status === "draft").length,
  }), [localNotifs]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12 }}>
        {[
          { label: "Tổng", val: stats.total, color: "#c4c0ff", glow: "rgba(196,192,255,.08)" },
          { label: "Đã gửi", val: stats.sent, color: "#45f1c5", glow: "rgba(69,241,197,.08)" },
          { label: "Đã lên lịch", val: stats.sched, color: "#FFB785", glow: "rgba(255,183,133,.08)" },
          { label: "Nháp", val: stats.draft, color: "#C7C4D8", glow: "rgba(199,196,208,.06)" },
        ].map(({ label, val, color, glow }) => (
          <div key={label} style={{ background: "rgba(22,20,34,.7)", border: "1px solid rgba(255,255,255,.06)", borderRadius: 16, padding: "14px 16px", backdropFilter: "blur(12px)", boxShadow: `0 4px 16px ${glow}` }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#C7C4D8", letterSpacing: ".07em", textTransform: "uppercase", marginBottom: 6 }}>{label}</div>
            <div style={{ fontSize: 24, fontWeight: 800, color }}>{val}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ position: "relative", flex: "1 1 240px", maxWidth: 380 }}>
          <Search size={13} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#C7C4D8" }} />
          <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Tìm tiêu đề, nội dung…"
            style={{ ...IS, paddingLeft: 34 }} onFocus={onFocus} onBlur={onBlur} />
          {search && <button onClick={() => setSearch("")} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#C7C4D8" }}><X size={12} /></button>}
        </div>

        <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value as any); setPage(1); }}
          style={{ ...IS, width: "auto", minWidth: 140 }} onFocus={onFocus} onBlur={onBlur}>
          <option value="all">Tất cả trạng thái</option>
          <option value="sent">Đã gửi</option>
          <option value="scheduled">Đã lên lịch</option>
          <option value="draft">Nháp</option>
        </select>

        <select value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value as any); setPage(1); }}
          style={{ ...IS, width: "auto", minWidth: 150 }} onFocus={onFocus} onBlur={onBlur}>
          <option value="all">Tất cả loại</option>
          <option value="system">Hệ thống</option>
          <option value="promotion">Khuyến mãi</option>
          <option value="course_update">Khóa học</option>
        </select>

        <span style={{ marginLeft: "auto", fontSize: 12, color: "#C7C4D8", whiteSpace: "nowrap" }}>{filtered.length} thông báo</span>

        <button onClick={onCreateNew}
          style={{ display: "flex", alignItems: "center", gap: 7, padding: "10px 20px", borderRadius: 12, fontSize: 13, fontWeight: 700, cursor: "pointer", background: "linear-gradient(135deg,#6C63FF,#9B59B6)", border: "none", color: "#fff", boxShadow: "0 0 18px rgba(108,99,255,.28)", whiteSpace: "nowrap", transition: "opacity .2s" }}
          onMouseOver={(e) => (e.currentTarget.style.opacity = ".88")}
          onMouseOut={(e)  => (e.currentTarget.style.opacity = "1")}>
          <Plus size={15} /> Tạo thông báo mới
        </button>
      </div>

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

// ─────────────────────────────────────────────────────────────────────────
// NotificationFormAdmin
// ─────────────────────────────────────────────────────────────────────────

interface NotificationFormAdminProps {
  onBack: () => void;
  onSaved: (status: NotifStatus) => void;
  toast: (msg: string, type?: Toast["type"]) => void;
}

const defaultForm = (): NotificationFormData => ({
  title: "",
  content: "",
  type: "system",
  target: "all",
  targetUserIds: [],
  scheduleMode: "now",
  scheduledAt: new Date(Date.now() + 3600000).toISOString().slice(0, 16),
});

function NotificationFormAdmin({ onBack, onSaved, toast }: NotificationFormAdminProps) {
  const [form, setForm] = useState<NotificationFormData>(defaultForm());
  const [errors, setErrors] = useState<Partial<Record<keyof NotificationFormData | "general", string>>>({});
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<"send" | "schedule" | "draft" | null>(null);
  const [saving, setSaving] = useState(false);
  const charCount = form.content.length;

  const set = <K extends keyof NotificationFormData>(k: K, v: NotificationFormData[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => ({ ...e, [k]: undefined }));
  };

  const validate = () => {
    const e: typeof errors = {};
    if (!form.title.trim()) e.title = "Tiêu đề không được để trống";
    if (form.title.length > 120) e.title = "Tiêu đề tối đa 120 ký tự";
    if (!form.content.trim()) e.content = "Nội dung không được để trống";
    if (form.content.length > 500) e.content = "Nội dung tối đa 500 ký tự";
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

    try {
      let notificationType: "system" | "admin_announcement" | "course_enrolled" | "refund" | "payment_success" | "payment_failed" | "admin_warning" = "system";
      if (form.type === "system") notificationType = "system";
      else if (form.type === "promotion") notificationType = "admin_announcement";
      else if (form.type === "course_update") notificationType = "course_enrolled";

      const saveOne = async (userId: string) => {
        const notificationData = {
          userId: userId,
          type: notificationType,
          title: form.title.trim(),
          body: form.content.trim(),
          link: null,
          isRead: false,
          createdAt: serverTimestamp(),
          status: status,
          scheduledAt: status === "scheduled" ? Timestamp.fromDate(new Date(form.scheduledAt)) : null,
          metadata: { target: form.target },
        };
        await addDoc(collection(db, "notifications"), notificationData);
      };

      if (form.target === "all") {
        await saveOne("all");
      } else if (form.target === "specific_users") {
        for (const uid of form.targetUserIds) {
          await saveOne(uid);
        }
      }

      setSaving(false);
      const messages: Record<NotifStatus, string> = {
        sent: `✅ Thông báo "${form.title.trim()}" đã ${status === "sent" ? "gửi" : "lưu"} thành công!`,
        draft: `💾 Đã lưu nháp "${form.title.trim()}"`,
        scheduled: `⏰ Đã lên lịch "${form.title.trim()}" vào ${new Date(form.scheduledAt).toLocaleString("vi-VN")}`,
      };
      toast(messages[status], status === "sent" ? "success" : status === "draft" ? "info" : "warning");
      onSaved(status);
    } catch (error) {
      console.error("Error saving notification:", error);
      toast("Lỗi khi lưu thông báo. Vui lòng thử lại.", "error");
      setSaving(false);
    }
  };

  const typeOpts: { value: NotifType; label: string; desc: string; Icon: React.ElementType; color: string }[] = [
    { value: "system", label: "Hệ thống", desc: "Bảo trì, cập nhật tính năng", Icon: Settings, color: "#c4c0ff" },
    { value: "promotion", label: "Khuyến mãi", desc: "Ưu đãi, giảm giá, sự kiện", Icon: Zap, color: "#FFB785" },
    { value: "course_update", label: "Khóa học", desc: "Nội dung mới, bài giảng thêm", Icon: BookOpen, color: "#45f1c5" },
  ];

  const targetOptions: { value: NotifTarget; label: string; Icon: React.ElementType }[] = [
    { value: "all", label: "Tất cả người dùng", Icon: Users },
    { value: "specific_users", label: "Người dùng cụ thể", Icon: User },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
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
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Basic info */}
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

          {/* Type */}
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

          {/* Target */}
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
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 8 }}>
                {targetOptions.map((t) => {
                  const active = form.target === t.value;
                  return (
                    <button key={t.value} onClick={() => set("target", t.value)}
                      style={{ padding: "10px 12px", borderRadius: 12, cursor: "pointer", textAlign: "left", transition: "all .15s", background: active ? "rgba(108,99,255,.14)" : "rgba(255,255,255,.03)", border: `1px solid ${active ? "rgba(108,99,255,.4)" : "rgba(255,255,255,.07)"}`, display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ width: 28, height: 28, borderRadius: 8, background: active ? "rgba(108,99,255,.2)" : "rgba(255,255,255,.05)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <t.Icon size={14} color={active ? "#c4c0ff" : "#C7C4D8"} />
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 700, color: active ? "#c4c0ff" : "#C7C4D8" }}>{t.label}</span>
                    </button>
                  );
                })}
              </div>

              {form.target === "specific_users" && (
                <div>
                  <label style={LABEL}>Chọn người dùng cụ thể <span style={{ color: "#ffb4ab" }}>*</span></label>
                  <UserMultiSelect users={MOCK_USERS} selected={form.targetUserIds} onChange={(ids) => set("targetUserIds", ids)} />
                  {errors.targetUserIds && <p style={{ fontSize: 11, color: "#ffb4ab", marginTop: 5 }}>⚠ {errors.targetUserIds}</p>}
                </div>
              )}
            </div>
          </div>

          {/* Scheduling */}
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
                <div>
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
          <div style={{ background: "rgba(22,20,34,.7)", border: "1px solid rgba(255,255,255,.07)", borderRadius: 18, overflow: "hidden" }}>
            <div style={{ padding: "12px 16px", borderBottom: "1px solid rgba(255,255,255,.06)", fontSize: 11, fontWeight: 700, color: "#C7C4D8", textTransform: "uppercase", letterSpacing: ".07em" }}>
              Preview
            </div>
            <div style={{ padding: 16 }}>
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

          <div style={{ background: "rgba(22,20,34,.7)", border: "1px solid rgba(255,255,255,.07)", borderRadius: 18, padding: 16 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#C7C4D8", letterSpacing: ".07em", textTransform: "uppercase", marginBottom: 12 }}>Thông tin</div>
            {[
              { label: "Loại", val: TYPE_CFG[form.type].label, color: TYPE_CFG[form.type].color },
              { label: "Đối tượng", val: form.target === "all" ? "Tất cả" : `${form.targetUserIds.length} người dùng`, color: "#c4c0ff" },
              { label: "Phương thức", val: "Firestore realtime", color: "#FFB785" },
            ].map(({ label, val, color }) => (
              <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: "1px solid rgba(255,255,255,.05)" }}>
                <span style={{ fontSize: 11, color: "#C7C4D8" }}>{label}</span>
                <span style={{ fontSize: 11, fontWeight: 700, color }}>{val}</span>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
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
            <button onClick={() => triggerAction("draft")} disabled={saving}
              style={{ width: "100%", padding: "10px", borderRadius: 14, fontSize: 13, fontWeight: 600, cursor: "pointer", background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.1)", color: "#C7C4D8", display: "flex", alignItems: "center", justifyContent: "center", gap: 7, opacity: saving ? .5 : 1 }}>
              <Save size={14} /> Lưu nháp
            </button>
            <div style={{ padding: "10px 12px", background: "rgba(108,99,255,.06)", border: "1px solid rgba(108,99,255,.16)", borderRadius: 12 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#9B59B6", marginBottom: 4 }}>FIRESTORE PATH</div>
              <code style={{ fontSize: 10, color: "#c4c0ff", lineHeight: 1.8 }}>
                notifications/<span style={{ color: "#45f1c5" }}>{"{"}"new_id"{"}"}</span>
              </code>
            </div>
          </div>
        </div>
      </div>

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

// ─────────────────────────────────────────────────────────────────────────
// MAIN: NotificationAdmin
// ─────────────────────────────────────────────────────────────────────────

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
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 44, height: 44, borderRadius: 13, background: "linear-gradient(135deg,#6C63FF,#9B59B6)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 22px rgba(108,99,255,.32)" }}>
            <Bell size={22} color="#fff" />
          </div>
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 800, color: "#E4E1EE", letterSpacing: "-.02em" }}>
              {view === "list" ? "Quản lý Thông báo" : "Tạo Thông báo Mới"}
            </h1>
            <p style={{ fontSize: 12, color: "#C7C4D8", marginTop: 2 }}>
              Firestore: <code style={{ background: "rgba(108,99,255,.12)", padding: "1px 6px", borderRadius: 5, fontSize: 11, color: "#c4c0ff" }}>notifications</code> · Realtime onSnapshot
            </p>
          </div>
        </div>

        <div style={{ display: "flex", gap: 4, background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.06)", borderRadius: 12, padding: 4, width: "fit-content" }}>
          {[
            { id: "list", label: "Danh sách", Icon: Bell },
            { id: "form", label: "Tạo mới", Icon: Plus },
          ].map(({ id, label, Icon }) => (
            <button key={id} onClick={() => setView(id as any)}
              style={{ display: "flex", alignItems: "center", gap: 7, padding: "8px 16px", borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: "pointer", transition: "all .2s", background: view === id ? "linear-gradient(135deg,#6C63FF,#9B59B6)" : "transparent", border: view === id ? "1px solid rgba(108,99,255,.3)" : "1px solid transparent", color: view === id ? "#fff" : "#C7C4D8", boxShadow: view === id ? "0 0 14px rgba(108,99,255,.25)" : "none" }}>
              <Icon size={14} /> {label}
            </button>
          ))}
        </div>

        {view === "list"
          ? <NotificationListAdmin onCreateNew={() => setView("form")} toast={addToast} />
          : <NotificationFormAdmin onBack={() => setView("list")} onSaved={handleSaved} toast={addToast} />
        }
      </div>

      <ToastContainer toasts={toasts} />
    </div>
  );
}
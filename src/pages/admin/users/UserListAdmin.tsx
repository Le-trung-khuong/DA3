/**
 * Smart Review — Admin User List
 * React + TypeScript + Firebase SDK v9+
 *
 * File: src/pages/admin/UserListAdmin.tsx
 *
 * Features:
 *   - Realtime onSnapshot listener from Firestore `users` collection
 *   - Search by email / displayName (client-side filter)
 *   - Pagination (client-side for demo; swap for cursor-based in prod)
 *   - Ban / Unban user (updates `status` field in Firestore)
 *   - Reset password (Firebase Auth sendPasswordResetEmail)
 *   - View Details modal
 *   - BanConfirmDialog, ResetPasswordButton, UserTableRow components
 *   - useUsers custom hook
 *
 * Production split:
 *   hooks/useUsers.ts
 *   components/admin/users/UserTableRow.tsx
 *   components/admin/users/BanConfirmDialog.tsx
 *   components/admin/users/ResetPasswordButton.tsx
 *   components/admin/users/UserDetailModal.tsx
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
// import { db, auth } from "@/lib/firebase";
// import {
//   collection, query, orderBy, onSnapshot, doc, updateDoc, serverTimestamp,
// } from "firebase/firestore";
// import { sendPasswordResetEmail } from "firebase/auth";

// ─── Lucide icons ────────────────────────────────────────────────────────────
import {
  Search,
  Shield,
  ShieldOff,
  RotateCcw,
  Eye,
  ChevronLeft,
  ChevronRight,
  X,
  AlertTriangle,
  CheckCircle,
  XCircle,
  RefreshCw,
  Users,
  UserCheck,
  UserX,
  Zap,
  Star,
  Calendar,
  Mail,
  Clock,
  Crown,
  Loader,
  Filter,
  ArrowUpDown,
  MoreVertical,
  Activity,
  LogIn,
  Copy,
  Check,
} from "lucide-react";

import { useAuth } from "../../../hooks/useAuth";

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

type UserStatus = "active" | "banned" | "suspended";
type UserRole = "student" | "instructor" | "admin" | "moderator";

interface AppUser {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  level: number;
  xp: number;
  status: UserStatus;
  role: UserRole;
  createdAt: Date;
  lastLogin: Date;
  currentStreak?: number;
  totalLessons?: number;
}

interface UseUsersOptions {
  search: string;
  statusFilter: UserStatus | "all";
  roleFilter: UserRole | "all";
  sortField: "createdAt" | "lastLogin" | "xp" | "displayName";
  sortDir: "asc" | "desc";
  page: number;
  pageSize: number;
}

interface UseUsersReturn {
  users: AppUser[];
  total: number;
  loading: boolean;
  error: Error | null;
  refetch: () => void;
}

// ═══════════════════════════════════════════════════════════════════════════
// MOCK DATA
// ═══════════════════════════════════════════════════════════════════════════

const buildMock = (): AppUser[] => {
  const now = new Date();
  const raw: Omit<AppUser, "uid" | "createdAt" | "lastLogin">[] = [
    { email: "hoang.tuan@gmail.com",   displayName: "Hoàng Tuấn",      level: 42, xp: 12200, status: "active",    role: "student",    currentStreak: 14, totalLessons: 312 },
    { email: "linh.nguyen@gmail.com",  displayName: "Linh Nguyễn",     level: 38, xp: 8450,  status: "active",    role: "student",    currentStreak: 7,  totalLessons: 218 },
    { email: "mai.van@example.com",    displayName: "Mai Văn",          level: 35, xp: 7900,  status: "active",    role: "student",    currentStreak: 3,  totalLessons: 190 },
    { email: "sarah.drasner@edu.io",   displayName: "Sarah Drasner",    level: 60, xp: 28000, status: "active",    role: "instructor", currentStreak: 30, totalLessons: 820 },
    { email: "pham.quan@gmail.com",    displayName: "Phạm Quân Đức",   level: 22, xp: 5800,  status: "active",    role: "student",    currentStreak: 0,  totalLessons: 98  },
    { email: "nguyen.vy@gmail.com",    displayName: "Nguyễn Mai Vy",   level: 19, xp: 4200,  status: "active",    role: "student",    currentStreak: 2,  totalLessons: 76  },
    { email: "spammer99@spam.io",      displayName: "Spam Account",     level: 1,  xp: 0,     status: "banned",    role: "student",    currentStreak: 0,  totalLessons: 0   },
    { email: "tran.linh@gmail.com",    displayName: "Trần Linh Nhi",   level: 31, xp: 6700,  status: "active",    role: "student",    currentStreak: 5,  totalLessons: 145 },
    { email: "admin@smartreview.io",   displayName: "Super Admin",      level: 99, xp: 99999, status: "active",    role: "admin",      currentStreak: 365,totalLessons: 9999},
    { email: "bich.nguyen@gmail.com",  displayName: "Bích Nguyễn",     level: 15, xp: 3100,  status: "active",    role: "student",    currentStreak: 1,  totalLessons: 55  },
    { email: "troll.user@anon.com",    displayName: "Troll User 42",    level: 3,  xp: 120,   status: "banned",    role: "student",    currentStreak: 0,  totalLessons: 3   },
    { email: "moderator@sr.io",        displayName: "Mod Đình Long",    level: 55, xp: 18000, status: "active",    role: "moderator",  currentStreak: 21, totalLessons: 500 },
    { email: "huy.le@gmail.com",       displayName: "Lê Minh Huy",     level: 28, xp: 5400,  status: "active",    role: "student",    currentStreak: 4,  totalLessons: 122 },
    { email: "instructor2@edu.io",     displayName: "Võ Thị Hoa",      level: 48, xp: 16500, status: "active",    role: "instructor", currentStreak: 18, totalLessons: 620 },
    { email: "suspended.user@x.com",   displayName: "Suspended Test",   level: 5,  xp: 800,   status: "suspended", role: "student",    currentStreak: 0,  totalLessons: 12  },
    { email: "khuong.le@gmail.com",    displayName: "Lê Trung Khương", level: 33, xp: 7200,  status: "active",    role: "student",    currentStreak: 9,  totalLessons: 165 },
  ];
  return raw.map((u, i) => ({
    ...u,
    uid: `uid_${String(i + 1).padStart(4, "0")}`,
    createdAt: new Date(now.getTime() - (i + 1) * 1000 * 60 * 60 * 24 * (7 + i * 3)),
    lastLogin: new Date(now.getTime() - i * 1000 * 60 * 60 * (1 + i * 2)),
  }));
};

const ALL_USERS = buildMock();

// ═══════════════════════════════════════════════════════════════════════════
// CUSTOM HOOK: useUsers
// ═══════════════════════════════════════════════════════════════════════════

function useUsers(opts: UseUsersOptions): UseUsersReturn {
  const [allUsers, setAllUsers] = useState<AppUser[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<Error | null>(null);

  const refetch = useCallback(() => {
    setLoading(true);
    setError(null);

    // ── REAL FIREBASE ─────────────────────────────────────────────────
    // const q = query(collection(db, "users"), orderBy("createdAt", "desc"));
    // const unsub = onSnapshot(q,
    //   (snap) => {
    //     const data = snap.docs.map((d) => ({
    //       uid: d.id,
    //       ...d.data(),
    //       createdAt: d.data().createdAt?.toDate() ?? new Date(),
    //       lastLogin: d.data().lastLogin?.toDate() ?? new Date(),
    //     })) as AppUser[];
    //     setAllUsers(data);
    //     setLoading(false);
    //   },
    //   (err) => { setError(err); setLoading(false); }
    // );
    // return () => unsub();
    // ── MOCK ─────────────────────────────────────────────────────────
    const t = setTimeout(() => {
      setAllUsers(ALL_USERS);
      setLoading(false);
    }, 700);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const cleanup = refetch();
    return cleanup;
  }, [refetch]);

  const filtered = useMemo(() => {
    let data = [...allUsers];
    const q = opts.search.toLowerCase();
    if (q) {
      data = data.filter(
        (u) =>
          u.displayName.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          u.uid.toLowerCase().includes(q)
      );
    }
    if (opts.statusFilter !== "all") {
      data = data.filter((u) => u.status === opts.statusFilter);
    }
    if (opts.roleFilter !== "all") {
      data = data.filter((u) => u.role === opts.roleFilter);
    }
    data.sort((a, b) => {
      const dir = opts.sortDir === "asc" ? 1 : -1;
      if (opts.sortField === "displayName") return dir * a.displayName.localeCompare(b.displayName);
      if (opts.sortField === "xp")          return dir * (a.xp - b.xp);
      const aDate = opts.sortField === "createdAt" ? a.createdAt : a.lastLogin;
      const bDate = opts.sortField === "createdAt" ? b.createdAt : b.lastLogin;
      return dir * (aDate.getTime() - bDate.getTime());
    });
    return data;
  }, [allUsers, opts]);

  const paged = useMemo(() => {
    const start = (opts.page - 1) * opts.pageSize;
    return filtered.slice(start, start + opts.pageSize);
  }, [filtered, opts.page, opts.pageSize]);

  return { users: paged, total: filtered.length, loading, error, refetch };
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

const fmtDate  = (d: Date) => d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
const fmtRelative = (d: Date) => {
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)   return "vừa xong";
  if (mins < 60)  return `${mins}p trước`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)   return `${hrs}h trước`;
  const days = Math.floor(hrs / 24);
  return `${days}d trước`;
};
const fmtNum = (n: number) => new Intl.NumberFormat("vi-VN").format(n);

const STATUS_CFG: Record<UserStatus, { label: string; color: string; bg: string; border: string; dot: string }> = {
  active:    { label: "Active",     color: "#45f1c5", bg: "rgba(69,241,197,.12)",  border: "rgba(69,241,197,.28)",  dot: "#45f1c5" },
  banned:    { label: "Banned",     color: "#ffb4ab", bg: "rgba(255,180,171,.12)", border: "rgba(255,180,171,.28)", dot: "#ffb4ab" },
  suspended: { label: "Suspended",  color: "#FFB785", bg: "rgba(255,183,133,.12)", border: "rgba(255,183,133,.28)", dot: "#FFB785" },
};

const ROLE_CFG: Record<UserRole, { label: string; color: string; bg: string; Icon: React.ElementType }> = {
  student:    { label: "Student",    color: "#c4c0ff", bg: "rgba(196,192,255,.10)", Icon: Users    },
  instructor: { label: "Instructor", color: "#45f1c5", bg: "rgba(69,241,197,.10)", Icon: UserCheck },
  moderator:  { label: "Moderator",  color: "#FFB785", bg: "rgba(255,183,133,.10)", Icon: Shield  },
  admin:      { label: "Admin",      color: "#FFD700", bg: "rgba(255,215,0,.12)",   Icon: Crown   },
};

function initials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0]?.toUpperCase() ?? "")
    .slice(0, 2)
    .join("");
}

const AVATAR_GRADS = [
  "linear-gradient(135deg,#6C63FF,#9B59B6)",
  "linear-gradient(135deg,#00D4AA,#0F9E7B)",
  "linear-gradient(135deg,#FFB785,#FF8C42)",
  "linear-gradient(135deg,#45f1c5,#00A878)",
  "linear-gradient(135deg,#c4c0ff,#6C63FF)",
  "linear-gradient(135deg,#FFD700,#FF8C42)",
];
const gradFor = (uid: string) => AVATAR_GRADS[uid.charCodeAt(uid.length - 1) % AVATAR_GRADS.length];

// ═══════════════════════════════════════════════════════════════════════════
// SHARED INPUT STYLE
// ═══════════════════════════════════════════════════════════════════════════

const IS: React.CSSProperties = {
  background: "#0d0d18",
  border: "1px solid rgba(255,255,255,.08)",
  borderRadius: 12,
  padding: "9px 14px",
  color: "#E4E1EE",
  fontSize: 13,
  outline: "none",
  fontFamily: "'Sora', sans-serif",
  transition: "border-color .2s, box-shadow .2s",
};

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT: ResetPasswordButton
// ═══════════════════════════════════════════════════════════════════════════

interface ResetPasswordButtonProps {
  email: string;
  displayName: string;
}

function ResetPasswordButton({ email, displayName }: ResetPasswordButtonProps) {
  const [state, setState] = useState<"idle" | "loading" | "sent" | "error">("idle");
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  const handleReset = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (state === "loading") return;
    setState("loading");

    try {
      // ── REAL FIREBASE ─────────────────────────────────────────────
      // await sendPasswordResetEmail(auth, email);
      // ── MOCK ─────────────────────────────────────────────────────
      await new Promise((r) => setTimeout(r, 800));
      setState("sent");
      timerRef.current = setTimeout(() => setState("idle"), 3000);
    } catch {
      setState("error");
      timerRef.current = setTimeout(() => setState("idle"), 3000);
    }
  };

  React.useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  const cfg = {
    idle:    { icon: <RotateCcw size={12} />,  label: "Reset",  color: "#C7C4D8", bg: "rgba(255,255,255,.05)", border: "rgba(255,255,255,.1)" },
    loading: { icon: <Loader size={12} style={{ animation: "spin .8s linear infinite" }} />, label: "...", color: "#C7C4D8", bg: "rgba(255,255,255,.05)", border: "rgba(255,255,255,.1)" },
    sent:    { icon: <Check size={12} />,       label: "Sent!",  color: "#45f1c5", bg: "rgba(69,241,197,.1)",  border: "rgba(69,241,197,.25)" },
    error:   { icon: <X size={12} />,           label: "Fail",   color: "#ffb4ab", bg: "rgba(255,180,171,.1)", border: "rgba(255,180,171,.25)" },
  }[state];

  return (
    <button
      title={`Send password reset to ${email}`}
      onClick={handleReset}
      style={{
        display: "flex", alignItems: "center", gap: 4,
        padding: "5px 10px", borderRadius: 8,
        fontSize: 11, fontWeight: 700, cursor: "pointer",
        background: cfg.bg, border: `1px solid ${cfg.border}`,
        color: cfg.color, transition: "all .2s",
        fontFamily: "'Sora', sans-serif",
      }}
    >
      {cfg.icon} {cfg.label}
    </button>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT: BanConfirmDialog
// ═══════════════════════════════════════════════════════════════════════════

interface BanConfirmDialogProps {
  user: AppUser;
  action: "ban" | "unban";
  onConfirm: () => void;
  onCancel: () => void;
}

function BanConfirmDialog({ user, action, onConfirm, onCancel }: BanConfirmDialogProps) {
  const isBan = action === "ban";
  const color  = isBan ? "#ffb4ab" : "#45f1c5";
  const accent = isBan ? "rgba(255,180,171,.18)" : "rgba(69,241,197,.14)";
  const border = isBan ? "rgba(255,180,171,.3)"  : "rgba(69,241,197,.3)";

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.7)", backdropFilter: "blur(8px)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
      onClick={(e) => e.target === e.currentTarget && onCancel()}
    >
      <div style={{ width: "100%", maxWidth: 420, background: "rgba(20,19,30,.98)", border: `1px solid ${border}`, borderRadius: 24, padding: 32, boxShadow: `0 24px 80px rgba(0,0,0,.6), 0 0 40px ${isBan ? "rgba(255,180,171,.08)" : "rgba(69,241,197,.08)"}`, animation: "scaleIn .2s ease" }}>
        <div style={{ width: 56, height: 56, borderRadius: "50%", background: accent, border: `1px solid ${border}`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
          {isBan ? <ShieldOff size={26} color={color} /> : <Shield size={26} color={color} />}
        </div>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: "#E4E1EE", textAlign: "center", marginBottom: 10, fontFamily: "'Sora', sans-serif" }}>
          {isBan ? "Ban người dùng?" : "Gỡ ban người dùng?"}
        </h2>
        <p style={{ fontSize: 13, color: "#C7C4D8", textAlign: "center", lineHeight: 1.7, marginBottom: 24, fontFamily: "'Sora', sans-serif" }}>
          {isBan ? (
            <>Tài khoản <strong style={{ color: "#E4E1EE" }}>{user.displayName}</strong> (<code style={{ color: color, fontSize: 11 }}>{user.email}</code>) sẽ bị <strong style={{ color }}>cấm đăng nhập</strong>. Token hiện tại sẽ bị thu hồi qua Cloud Function.</>
          ) : (
            <>Tài khoản <strong style={{ color: "#E4E1EE" }}>{user.displayName}</strong> sẽ được <strong style={{ color }}>khôi phục</strong> và có thể đăng nhập lại bình thường.</>
          )}
        </p>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onCancel} style={{ flex: 1, padding: "12px", borderRadius: 14, fontSize: 13, fontWeight: 600, cursor: "pointer", background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.1)", color: "#C7C4D8", fontFamily: "'Sora', sans-serif" }}>
            Hủy
          </button>
          <button onClick={onConfirm} style={{ flex: 2, padding: "12px", borderRadius: 14, fontSize: 13, fontWeight: 700, cursor: "pointer", background: accent, border: `1px solid ${border}`, color, fontFamily: "'Sora', sans-serif", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, transition: "all .2s" }}>
            {isBan ? <><ShieldOff size={15} /> Xác nhận Ban</> : <><Shield size={15} /> Gỡ Ban</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT: UserDetailModal
// ═══════════════════════════════════════════════════════════════════════════

function UserDetailModal({ user, onClose }: { user: AppUser; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const sCfg = STATUS_CFG[user.status];
  const rCfg = ROLE_CFG[user.role];
  const RoleIcon = rCfg.Icon;

  const copyUid = () => {
    navigator.clipboard.writeText(user.uid).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.7)", backdropFilter: "blur(8px)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={{ width: "100%", maxWidth: 520, maxHeight: "92vh", overflowY: "auto", background: "rgba(20,19,30,.98)", border: "1px solid rgba(255,255,255,.08)", borderRadius: 24, boxShadow: "0 24px 80px rgba(0,0,0,.6)", animation: "scaleIn .2s ease" }}>
        {/* Header */}
        <div style={{ padding: "20px 24px", borderBottom: "1px solid rgba(255,255,255,.07)", display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 48, height: 48, borderRadius: "50%", background: gradFor(user.uid), display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 800, color: "#fff", flexShrink: 0 }}>
            {user.photoURL ? <img src={user.photoURL} alt="" style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" }} /> : initials(user.displayName)}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 17, fontWeight: 700, color: "#E4E1EE", fontFamily: "'Sora', sans-serif" }}>{user.displayName}</div>
            <div style={{ fontSize: 12, color: "#C7C4D8", marginTop: 2 }}>{user.email}</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 999, background: sCfg.bg, border: `1px solid ${sCfg.border}`, color: sCfg.color, fontSize: 11, fontWeight: 700 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: sCfg.dot, display: "inline-block" }} />
              {sCfg.label}
            </span>
          </div>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 10, background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.08)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#C7C4D8" }}>
            <X size={15} />
          </button>
        </div>

        {/* Stat grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, padding: "16px 24px" }}>
          {[
            { icon: <Zap size={14} color="#FFB785" />, label: "Total XP", value: fmtNum(user.xp), color: "#FFB785" },
            { icon: <Star size={14} color="#c4c0ff" />, label: "Level",   value: `Lv. ${user.level}`, color: "#c4c0ff" },
            { icon: <Activity size={14} color="#45f1c5" />, label: "Streak", value: `${user.currentStreak ?? 0}d`, color: "#45f1c5" },
          ].map(({ icon, label, value, color }) => (
            <div key={label} style={{ background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.06)", borderRadius: 14, padding: "12px 14px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>{icon}<span style={{ fontSize: 10, fontWeight: 700, color: "#C7C4D8", textTransform: "uppercase", letterSpacing: ".06em" }}>{label}</span></div>
              <div style={{ fontSize: 20, fontWeight: 800, color, fontFamily: "'Sora', sans-serif" }}>{value}</div>
            </div>
          ))}
        </div>

        {/* Details */}
        <div style={{ padding: "0 24px 24px", display: "flex", flexDirection: "column", gap: 0 }}>
          {[
            ["UID", <span style={{ display: "flex", alignItems: "center", gap: 6 }}><code style={{ color: "#c4c0ff", fontSize: 11, background: "rgba(108,99,255,.1)", padding: "2px 6px", borderRadius: 5 }}>{user.uid}</code><button onClick={copyUid} style={{ background: "none", border: "none", cursor: "pointer", color: "#C7C4D8", padding: 0 }}>{copied ? <Check size={11} color="#45f1c5" /> : <Copy size={11} />}</button></span>],
            ["Email",         <span style={{ color: "#E4E1EE", fontSize: 13 }}>{user.email}</span>],
            ["Role",          <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "2px 9px", borderRadius: 8, background: rCfg.bg, color: rCfg.color, fontSize: 11, fontWeight: 700 }}><RoleIcon size={11} />{rCfg.label}</span>],
            ["Lessons",       <span style={{ color: "#E4E1EE", fontSize: 13 }}>{fmtNum(user.totalLessons ?? 0)} bài học</span>],
            ["Registered",    <span style={{ color: "#E4E1EE", fontSize: 13 }}>{fmtDate(user.createdAt)}</span>],
            ["Last login",    <span style={{ color: "#E4E1EE", fontSize: 13 }}>{fmtDate(user.lastLogin)} · {fmtRelative(user.lastLogin)}</span>],
          ].map(([k, v]) => (
            <div key={k as string} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid rgba(255,255,255,.05)" }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "#C7C4D8", textTransform: "uppercase", letterSpacing: ".06em" }}>{k}</span>
              {v}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT: UserTableRow
// ═══════════════════════════════════════════════════════════════════════════

interface UserTableRowProps {
  user: AppUser;
  onBanToggle: (user: AppUser) => void;
  onViewDetail: (user: AppUser) => void;
}

function UserTableRow({ user, onBanToggle, onViewDetail }: UserTableRowProps) {
  const sCfg = STATUS_CFG[user.status];
  const rCfg = ROLE_CFG[user.role];
  const RIcon = rCfg.Icon;
  const isBanned = user.status === "banned";

  return (
    <tr
      style={{ borderBottom: "1px solid rgba(255,255,255,.04)", transition: "background .15s", cursor: "default" }}
      onMouseOver={(e) => ((e.currentTarget as HTMLTableRowElement).style.background = "rgba(255,255,255,.025)")}
      onMouseOut={(e)  => ((e.currentTarget as HTMLTableRowElement).style.background = "transparent")}
    >
      {/* Avatar + Name */}
      <td style={{ padding: "12px 16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: "50%", background: gradFor(user.uid), display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800, color: "#fff", flexShrink: 0, filter: isBanned ? "grayscale(.8)" : "none", opacity: isBanned ? .6 : 1 }}>
            {user.photoURL
              ? <img src={user.photoURL} alt="" style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" }} />
              : initials(user.displayName)}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: isBanned ? "#8A8796" : "#E4E1EE", fontFamily: "'Sora', sans-serif", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 160 }}>
              {user.displayName}
            </div>
            <div style={{ fontSize: 11, color: "#C7C4D8", marginTop: 2, opacity: .7 }}>{user.email}</div>
          </div>
        </div>
      </td>

      {/* Role */}
      <td style={{ padding: "12px 16px" }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 9px", borderRadius: 8, background: rCfg.bg, color: rCfg.color, fontSize: 10, fontWeight: 700 }}>
          <RIcon size={10} /> {rCfg.label}
        </span>
      </td>

      {/* Level + XP */}
      <td style={{ padding: "12px 16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: "rgba(196,192,255,.12)", border: "1px solid rgba(196,192,255,.22)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, color: "#c4c0ff" }}>
            {user.level}
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#FFB785", display: "flex", alignItems: "center", gap: 3 }}>
              <Zap size={10} fill="#FFB785" /> {fmtNum(user.xp)}
            </div>
          </div>
        </div>
      </td>

      {/* Streak */}
      <td style={{ padding: "12px 16px" }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: user.currentStreak ? "#FFB785" : "#47464f", display: "flex", alignItems: "center", gap: 4 }}>
          🔥 {user.currentStreak ?? 0}d
        </span>
      </td>

      {/* Status */}
      <td style={{ padding: "12px 16px" }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 999, background: sCfg.bg, border: `1px solid ${sCfg.border}`, color: sCfg.color, fontSize: 11, fontWeight: 700 }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: sCfg.dot }} />
          {sCfg.label}
        </span>
      </td>

      {/* Last Login */}
      <td style={{ padding: "12px 16px" }}>
        <div style={{ fontSize: 11, color: "#C7C4D8" }}>{fmtRelative(user.lastLogin)}</div>
        <div style={{ fontSize: 10, color: "#47464f", marginTop: 2 }}>{fmtDate(user.lastLogin)}</div>
      </td>

      {/* Actions */}
      <td style={{ padding: "12px 16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 5, flexWrap: "nowrap" }}>
          {/* View */}
          <button
            title="Xem chi tiết"
            onClick={() => onViewDetail(user)}
            style={{ width: 30, height: 30, borderRadius: 8, background: "rgba(108,99,255,.08)", border: "1px solid rgba(108,99,255,.2)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#6C63FF", transition: "background .15s" }}
            onMouseOver={(e) => (e.currentTarget.style.background = "rgba(108,99,255,.18)")}
            onMouseOut={(e)  => (e.currentTarget.style.background = "rgba(108,99,255,.08)")}
          >
            <Eye size={13} />
          </button>

          {/* Reset password */}
          <ResetPasswordButton email={user.email} displayName={user.displayName} />

          {/* Ban / Unban */}
          <button
            title={isBanned ? "Gỡ ban" : "Ban user"}
            onClick={(e) => { e.stopPropagation(); onBanToggle(user); }}
            style={{
              width: 30, height: 30, borderRadius: 8,
              background: isBanned ? "rgba(69,241,197,.08)"    : "rgba(255,180,171,.08)",
              border:     isBanned ? "1px solid rgba(69,241,197,.2)" : "1px solid rgba(255,180,171,.2)",
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer",
              color: isBanned ? "#45f1c5" : "#ffb4ab",
              transition: "background .15s",
            }}
            onMouseOver={(e) => (e.currentTarget.style.background = isBanned ? "rgba(69,241,197,.18)" : "rgba(255,180,171,.18)")}
            onMouseOut={(e)  => (e.currentTarget.style.background = isBanned ? "rgba(69,241,197,.08)" : "rgba(255,180,171,.08)")}
          >
            {isBanned ? <Shield size={13} /> : <ShieldOff size={13} />}
          </button>
        </div>
      </td>
    </tr>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT: Pagination
// ═══════════════════════════════════════════════════════════════════════════

interface PaginationProps { page: number; pageSize: number; total: number; onPage: (p: number) => void; }
function Pagination({ page, pageSize, total, onPage }: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (total === 0) return null;
  const pages: (number | "…")[] = [];
  if (totalPages <= 7) for (let i = 1; i <= totalPages; i++) pages.push(i);
  else {
    pages.push(1);
    if (page > 3) pages.push("…");
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i);
    if (page < totalPages - 2) pages.push("…");
    pages.push(totalPages);
  }
  const btnBase: React.CSSProperties = { width: 32, height: 32, borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Sora', sans-serif", transition: "all .15s" };

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
      <span style={{ fontSize: 12, color: "#C7C4D8" }}>
        <strong style={{ color: "#E4E1EE" }}>{(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)}</strong> / <strong style={{ color: "#E4E1EE" }}>{total}</strong> người dùng
      </span>
      <div style={{ display: "flex", gap: 5 }}>
        <button disabled={page === 1} onClick={() => onPage(page - 1)} style={{ ...btnBase, background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.08)", color: page === 1 ? "#47464f" : "#C7C4D8", cursor: page === 1 ? "not-allowed" : "pointer" }}><ChevronLeft size={15} /></button>
        {pages.map((p, i) => p === "…"
          ? <span key={`e${i}`} style={{ width: 32, textAlign: "center", color: "#47464f", fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center" }}>…</span>
          : <button key={p} onClick={() => onPage(p)} style={{ ...btnBase, background: p === page ? "linear-gradient(135deg,#6C63FF,#9B59B6)" : "rgba(255,255,255,.04)", border: p === page ? "1px solid rgba(108,99,255,.4)" : "1px solid rgba(255,255,255,.08)", color: p === page ? "#fff" : "#C7C4D8", boxShadow: p === page ? "0 0 12px rgba(108,99,255,.3)" : "none" }}>{p}</button>
        )}
        <button disabled={page === totalPages} onClick={() => onPage(page + 1)} style={{ ...btnBase, background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.08)", color: page === totalPages ? "#47464f" : "#C7C4D8", cursor: page === totalPages ? "not-allowed" : "pointer" }}><ChevronRight size={15} /></button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT: Toast
// ═══════════════════════════════════════════════════════════════════════════

interface Toast { id: string; msg: string; type: "success" | "error" | "info" | "warning"; }
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
  const colors: Record<Toast["type"], string> = { success: "#45f1c5", error: "#ffb4ab", info: "#c4c0ff", warning: "#FFB785" };
  return (
    <div style={{ position: "fixed", bottom: 24, right: 24, zIndex: 99999, display: "flex", flexDirection: "column", gap: 10 }}>
      {toasts.map((t) => (
        <div key={t.id} style={{ background: "rgba(20,19,30,.98)", border: `1px solid ${colors[t.type]}40`, borderRadius: 14, padding: "11px 18px", color: colors[t.type], fontSize: 13, fontWeight: 600, fontFamily: "'Sora', sans-serif", boxShadow: `0 8px 30px rgba(0,0,0,.4)`, maxWidth: 340, animation: "slideInRight .25s ease" }}>
          {t.msg}
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN: UserListAdmin
// ═══════════════════════════════════════════════════════════════════════════

const PAGE_SIZE = 8;

export default function UserListAdmin() {
  const [search,       setSearch]       = useState("");
  const [statusFilter, setStatusFilter] = useState<UserStatus | "all">("all");
  const [roleFilter,   setRoleFilter]   = useState<UserRole | "all">("all");
  const [sortField,    setSortField]    = useState<UseUsersOptions["sortField"]>("createdAt");
  const [sortDir,      setSortDir]      = useState<"asc" | "desc">("desc");
  const [page,         setPage]         = useState(1);
  const [filtersOpen,  setFiltersOpen]  = useState(false);

  const [banTarget,    setBanTarget]    = useState<AppUser | null>(null);
  const [banAction,    setBanAction]    = useState<"ban" | "unban">("ban");
  const [viewTarget,   setViewTarget]   = useState<AppUser | null>(null);
  const [localUsers,   setLocalUsers]   = useState<AppUser[]>([]);

  const { toasts, add: addToast } = useToast();

  const opts: UseUsersOptions = { search, statusFilter, roleFilter, sortField, sortDir, page, pageSize: PAGE_SIZE };
  const { users, total, loading, error, refetch } = useUsers(opts);

  // Merge local overrides (ban/unban done optimistically)
  const displayedUsers = useMemo(() =>
    users.map((u) => localUsers.find((l) => l.uid === u.uid) ?? u),
    [users, localUsers]
  );

  // Reset page on filter change
  useEffect(() => { setPage(1); }, [search, statusFilter, roleFilter]);

  const handleSort = (field: UseUsersOptions["sortField"]) => {
    if (sortField === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortField(field); setSortDir("desc"); }
  };

  const openBan = (user: AppUser) => {
    setBanAction(user.status === "banned" ? "unban" : "ban");
    setBanTarget(user);
  };

  const confirmBan = async () => {
    if (!banTarget) return;
    const newStatus: UserStatus = banAction === "ban" ? "banned" : "active";
    // ── REAL FIREBASE ─────────────────────────────────────────────────
    // await updateDoc(doc(db, "users", banTarget.uid), { status: newStatus, updatedAt: serverTimestamp() });
    // If banAction === "ban": call Cloud Function to revoke tokens
    // ── MOCK ─────────────────────────────────────────────────────────
    setLocalUsers((prev) => {
      const existing = prev.find((l) => l.uid === banTarget.uid);
      if (existing) return prev.map((l) => l.uid === banTarget.uid ? { ...l, status: newStatus } : l);
      return [...prev, { ...banTarget, status: newStatus }];
    });
    addToast(
      banAction === "ban" ? `Đã ban "${banTarget.displayName}"` : `Đã gỡ ban "${banTarget.displayName}"`,
      banAction === "ban" ? "warning" : "success"
    );
    setBanTarget(null);
  };

  // Summary stats
  const summaryStats = useMemo(() => {
    const src = [...ALL_USERS, ...localUsers.filter((l) => !ALL_USERS.find((u) => u.uid === l.uid))].map((u) => {
      const override = localUsers.find((l) => l.uid === u.uid);
      return override ?? u;
    });
    return {
      total:   src.length,
      active:  src.filter((u) => u.status === "active").length,
      banned:  src.filter((u) => u.status === "banned").length,
      admins:  src.filter((u) => u.role === "admin" || u.role === "moderator").length,
    };
  }, [localUsers]);

  const thStyle: React.CSSProperties = { padding: "10px 16px", textAlign: "left", background: "rgba(255,255,255,.02)", borderBottom: "1px solid rgba(255,255,255,.06)", fontSize: 10, fontWeight: 700, color: "#C7C4D8", letterSpacing: ".07em", textTransform: "uppercase" };

  return (
    <div style={{ minHeight: "100vh", background: "#0A090F", color: "#E4E1EE", fontFamily: "'Sora', sans-serif", backgroundImage: "radial-gradient(ellipse at 0% 0%, rgba(108,99,255,.07) 0%, transparent 50%), radial-gradient(ellipse at 100% 100%, rgba(0,212,170,.04) 0%, transparent 50%)" }}>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700;800&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes scaleIn{from{opacity:0;transform:scale(.94)}to{opacity:1;transform:scale(1)}}
        @keyframes slideInRight{from{opacity:0;transform:translateX(20px)}to{opacity:1;transform:translateX(0)}}
        @keyframes fadeDown{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:translateY(0)}}
        @keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}
        input,select,button{font-family:'Sora',sans-serif;}
        ::-webkit-scrollbar{width:5px;height:5px;}
        ::-webkit-scrollbar-track{background:#0A090F;}
        ::-webkit-scrollbar-thumb{background:#2a2935;border-radius:10px;}
      `}</style>

      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "28px 24px", display: "flex", flexDirection: "column", gap: 22 }}>

        {/* ── PAGE HEADER ───────────────────────────────────────────── */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 14 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: "linear-gradient(135deg,#6C63FF,#9B59B6)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 20px rgba(108,99,255,.3)" }}>
                <Users size={20} color="#fff" />
              </div>
              <h1 style={{ fontSize: 26, fontWeight: 800, color: "#E4E1EE", letterSpacing: "-.02em" }}>User Management</h1>
            </div>
            <p style={{ fontSize: 12, color: "#C7C4D8" }}>
              Firestore: <code style={{ background: "rgba(108,99,255,.12)", padding: "1px 6px", borderRadius: 5, fontSize: 11, color: "#c4c0ff" }}>users</code> collection · Realtime <code style={{ background: "rgba(69,241,197,.1)", padding: "1px 6px", borderRadius: 5, fontSize: 11, color: "#45f1c5" }}>onSnapshot</code>
            </p>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={refetch} style={{ display: "flex", alignItems: "center", gap: 7, padding: "10px 16px", borderRadius: 12, fontSize: 13, fontWeight: 600, cursor: "pointer", background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.08)", color: "#C7C4D8", transition: "all .2s" }}
              onMouseOver={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,.2)"; e.currentTarget.style.color = "#e3dfff"; }}
              onMouseOut={(e)  => { e.currentTarget.style.borderColor = "rgba(255,255,255,.08)"; e.currentTarget.style.color = "#C7C4D8"; }}>
              <RefreshCw size={14} /> Refresh
            </button>
          </div>
        </div>

        {/* ── STAT STRIP ───────────────────────────────────────────── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12 }}>
          {[
            { label: "Total Users",    value: summaryStats.total,   Icon: Users,     glow: "rgba(196,192,255,.08)", accent: "#c4c0ff" },
            { label: "Active",         value: summaryStats.active,  Icon: UserCheck, glow: "rgba(69,241,197,.08)",  accent: "#45f1c5" },
            { label: "Banned",         value: summaryStats.banned,  Icon: UserX,     glow: "rgba(255,180,171,.08)", accent: "#ffb4ab" },
            { label: "Staff / Admins", value: summaryStats.admins,  Icon: Crown,     glow: "rgba(255,215,0,.08)",   accent: "#FFD700" },
          ].map(({ label, value, Icon, glow, accent }) => (
            <div key={label} style={{ background: "rgba(26,22,40,.7)", border: "1px solid rgba(255,255,255,.06)", borderRadius: 18, padding: "16px 18px", display: "flex", alignItems: "center", gap: 14, backdropFilter: "blur(12px)", boxShadow: `0 4px 20px ${glow}`, transition: "transform .2s" }}
              onMouseOver={(e) => (e.currentTarget.style.transform = "translateY(-2px)")}
              onMouseOut={(e)  => (e.currentTarget.style.transform = "translateY(0)")}>
              <div style={{ width: 38, height: 38, borderRadius: 11, background: glow, border: `1px solid ${accent}28`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Icon size={18} color={accent} />
              </div>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#C7C4D8", letterSpacing: ".07em", textTransform: "uppercase", marginBottom: 3 }}>{label}</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: "#E4E1EE" }}>{value}</div>
              </div>
            </div>
          ))}
        </div>

        {/* ── SEARCH + FILTERS ─────────────────────────────────────── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            {/* Search */}
            <div style={{ position: "relative", flex: "1 1 280px", maxWidth: 420 }}>
              <Search size={14} style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", color: "#C7C4D8", pointerEvents: "none" }} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Tìm theo tên, email, UID…"
                style={{ ...IS, width: "100%", paddingLeft: 38 }}
                onFocus={(e) => { e.target.style.borderColor = "rgba(108,99,255,.5)"; e.target.style.boxShadow = "0 0 0 3px rgba(108,99,255,.1)"; }}
                onBlur={(e)  => { e.target.style.borderColor = "rgba(255,255,255,.08)"; e.target.style.boxShadow = "none"; }}
              />
              {search && (
                <button onClick={() => setSearch("")} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#C7C4D8" }}><X size={13} /></button>
              )}
            </div>

            {/* Filter toggle */}
            <button onClick={() => setFiltersOpen((p) => !p)} style={{ display: "flex", alignItems: "center", gap: 7, padding: "9px 16px", borderRadius: 12, fontSize: 13, fontWeight: 600, cursor: "pointer", background: filtersOpen ? "rgba(108,99,255,.15)" : "rgba(255,255,255,.04)", border: filtersOpen ? "1px solid rgba(108,99,255,.35)" : "1px solid rgba(255,255,255,.08)", color: filtersOpen ? "#c4c0ff" : "#C7C4D8", transition: "all .2s" }}>
              <Filter size={14} /> Bộ lọc
              {(statusFilter !== "all" || roleFilter !== "all") && (
                <span style={{ width: 18, height: 18, borderRadius: "50%", background: "linear-gradient(135deg,#6C63FF,#9B59B6)", fontSize: 9, fontWeight: 800, color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                  {[statusFilter !== "all", roleFilter !== "all"].filter(Boolean).length}
                </span>
              )}
            </button>

            <span style={{ marginLeft: "auto", fontSize: 12, color: "#C7C4D8", fontWeight: 600 }}>
              {loading ? "Loading…" : `${total} người dùng`}
            </span>
          </div>

          {filtersOpen && (
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap", padding: 16, background: "rgba(26,22,40,.6)", border: "1px solid rgba(255,255,255,.06)", borderRadius: 16, animation: "fadeDown .2s ease" }}>
              {/* Status filter */}
              <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                <label style={{ fontSize: 10, fontWeight: 700, color: "#C7C4D8", letterSpacing: ".07em", textTransform: "uppercase" }}>Status</label>
                <div style={{ display: "flex", gap: 6 }}>
                  {(["all", "active", "banned", "suspended"] as const).map((s) => (
                    <button key={s} onClick={() => setStatusFilter(s)} style={{ padding: "5px 12px", borderRadius: 999, fontSize: 11, fontWeight: 700, cursor: "pointer", transition: "all .15s", background: statusFilter === s ? "linear-gradient(135deg,#6C63FF,#9B59B6)" : "rgba(255,255,255,.05)", border: statusFilter === s ? "1px solid rgba(108,99,255,.4)" : "1px solid rgba(255,255,255,.08)", color: statusFilter === s ? "#fff" : "#C7C4D8" }}>
                      {s === "all" ? "Tất cả" : STATUS_CFG[s]?.label ?? s}
                    </button>
                  ))}
                </div>
              </div>
              {/* Role filter */}
              <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                <label style={{ fontSize: 10, fontWeight: 700, color: "#C7C4D8", letterSpacing: ".07em", textTransform: "uppercase" }}>Role</label>
                <div style={{ display: "flex", gap: 6 }}>
                  {(["all", "student", "instructor", "moderator", "admin"] as const).map((r) => (
                    <button key={r} onClick={() => setRoleFilter(r)} style={{ padding: "5px 12px", borderRadius: 999, fontSize: 11, fontWeight: 700, cursor: "pointer", transition: "all .15s", background: roleFilter === r ? "linear-gradient(135deg,#6C63FF,#9B59B6)" : "rgba(255,255,255,.05)", border: roleFilter === r ? "1px solid rgba(108,99,255,.4)" : "1px solid rgba(255,255,255,.08)", color: roleFilter === r ? "#fff" : "#C7C4D8" }}>
                      {r === "all" ? "Tất cả" : ROLE_CFG[r]?.label ?? r}
                    </button>
                  ))}
                </div>
              </div>
              {(statusFilter !== "all" || roleFilter !== "all") && (
                <div style={{ alignSelf: "flex-end" }}>
                  <button onClick={() => { setStatusFilter("all"); setRoleFilter("all"); }} style={{ display: "flex", alignItems: "center", gap: 5, padding: "7px 14px", borderRadius: 10, fontSize: 12, fontWeight: 600, cursor: "pointer", background: "rgba(255,180,171,.08)", border: "1px solid rgba(255,180,171,.22)", color: "#ffb4ab" }}>
                    <X size={12} /> Xóa lọc
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── TABLE ────────────────────────────────────────────────── */}
        {error ? (
          <div style={{ background: "rgba(255,180,171,.07)", border: "1px solid rgba(255,180,171,.2)", borderRadius: 18, padding: 40, display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
            <AlertTriangle size={32} color="#ffb4ab" />
            <p style={{ fontSize: 15, fontWeight: 700, color: "#E4E1EE" }}>Không thể tải dữ liệu</p>
            <p style={{ fontSize: 13, color: "#C7C4D8" }}>{error.message}</p>
            <button onClick={refetch} style={{ display: "flex", alignItems: "center", gap: 7, padding: "10px 20px", borderRadius: 12, fontSize: 13, fontWeight: 700, cursor: "pointer", background: "linear-gradient(135deg,#6C63FF,#9B59B6)", border: "none", color: "#fff" }}>
              <RefreshCw size={14} /> Thử lại
            </button>
          </div>
        ) : (
          <div style={{ background: "rgba(26,22,40,.7)", borderRadius: 20, border: "1px solid rgba(255,255,255,.06)", overflow: "hidden" }}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 820 }}>
                <thead>
                  <tr>
                    <th style={thStyle}>
                      <button onClick={() => handleSort("displayName")} style={{ background: "none", border: "none", cursor: "pointer", color: "#C7C4D8", fontSize: 10, fontWeight: 700, letterSpacing: ".07em", textTransform: "uppercase", display: "flex", alignItems: "center", gap: 5 }}>
                        Người dùng <ArrowUpDown size={10} style={{ opacity: sortField === "displayName" ? 1 : .4 }} />
                      </button>
                    </th>
                    <th style={thStyle}>Role</th>
                    <th style={thStyle}>
                      <button onClick={() => handleSort("xp")} style={{ background: "none", border: "none", cursor: "pointer", color: "#C7C4D8", fontSize: 10, fontWeight: 700, letterSpacing: ".07em", textTransform: "uppercase", display: "flex", alignItems: "center", gap: 5 }}>
                        Lv / XP <ArrowUpDown size={10} style={{ opacity: sortField === "xp" ? 1 : .4 }} />
                      </button>
                    </th>
                    <th style={thStyle}>Streak</th>
                    <th style={thStyle}>Status</th>
                    <th style={thStyle}>
                      <button onClick={() => handleSort("lastLogin")} style={{ background: "none", border: "none", cursor: "pointer", color: "#C7C4D8", fontSize: 10, fontWeight: 700, letterSpacing: ".07em", textTransform: "uppercase", display: "flex", alignItems: "center", gap: 5 }}>
                        Last Login <ArrowUpDown size={10} style={{ opacity: sortField === "lastLogin" ? 1 : .4 }} />
                      </button>
                    </th>
                    <th style={{ ...thStyle, textAlign: "center" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading
                    ? Array.from({ length: PAGE_SIZE }).map((_, i) => (
                        <tr key={i} style={{ borderBottom: "1px solid rgba(255,255,255,.04)" }}>
                          {[180, 90, 90, 70, 90, 100, 100].map((w, j) => (
                            <td key={j} style={{ padding: "14px 16px" }}>
                              <div style={{ height: 14, width: "75%", borderRadius: 7, background: "linear-gradient(90deg,#1c1b2a 25%,#26243a 50%,#1c1b2a 75%)", backgroundSize: "200% 100%", animation: "shimmer 1.4s infinite" }} />
                            </td>
                          ))}
                        </tr>
                      ))
                    : displayedUsers.length === 0
                    ? (
                        <tr>
                          <td colSpan={7} style={{ padding: 60, textAlign: "center" }}>
                            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
                              <div style={{ width: 60, height: 60, borderRadius: "50%", background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.08)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                <Users size={26} color="#47464f" />
                              </div>
                              <p style={{ fontSize: 15, fontWeight: 600, color: "#C7C4D8" }}>Không tìm thấy người dùng</p>
                              <p style={{ fontSize: 13, color: "#47464f" }}>Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm</p>
                            </div>
                          </td>
                        </tr>
                      )
                    : displayedUsers.map((user) => (
                        <UserTableRow
                          key={user.uid}
                          user={user}
                          onBanToggle={openBan}
                          onViewDetail={setViewTarget}
                        />
                      ))
                  }
                </tbody>
              </table>
            </div>

            {!loading && displayedUsers.length > 0 && (
              <div style={{ padding: "16px 20px", borderTop: "1px solid rgba(255,255,255,.05)" }}>
                <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPage={setPage} />
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── MODALS ──────────────────────────────────────────────────── */}
      {banTarget && (
        <BanConfirmDialog
          user={banTarget}
          action={banAction}
          onConfirm={confirmBan}
          onCancel={() => setBanTarget(null)}
        />
      )}
      {viewTarget && (
        <UserDetailModal user={viewTarget} onClose={() => setViewTarget(null)} />
      )}

      <ToastContainer toasts={toasts} />
    </div>
  );
}

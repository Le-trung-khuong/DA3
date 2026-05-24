/**
 * Smart Review — Admin User Detail View
 * React + TypeScript + Firebase SDK v9+
 *
 * File: src/pages/admin/users/UserDetailAdmin.tsx
 *
 * Route: /admin/users/:userId
 *
 * Production split:
 *   hooks/useDocument.ts
 *   hooks/useCollection.ts
 *   components/admin/user-detail/UserInfoForm.tsx
 *   components/admin/user-detail/ProgressCourseList.tsx
 *   components/admin/user-detail/AchievementGrid.tsx
 *   components/admin/user-detail/XPHistoryChart.tsx
 *   components/admin/user-detail/TransactionTable.tsx
 *
 * Dependencies: firebase  lucide-react  recharts
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
import { useParams, useNavigate } from "react-router-dom";

// ─── Import custom hooks từ thư mục hooks ─────────────────────────────────────
import { useDocument, useCollection } from "../../../hooks/useFirestore";

// ─── Recharts ────────────────────────────────────────────────────────────────
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, ReferenceLine,
} from "recharts";

// ─── Lucide icons ─────────────────────────────────────────────────────────────
import {
  ArrowLeft, Save, User, Mail, Phone, Shield,
  Zap, Star, Flame, Clock, BookOpen, Trophy,
  DollarSign, CreditCard, ChevronRight, CheckCircle,
  Lock, Unlock, AlertTriangle, Loader, RefreshCw,
  Activity, TrendingUp, Target, Award, Crown,
  Edit3, X, Check, Info, Copy, ExternalLink,
  BarChart2, Calendar, Layers, ChevronDown,
  ShieldOff, MoreVertical, Trash2,
} from "lucide-react";

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

type UserRole   = "student" | "instructor" | "moderator" | "admin";
type UserStatus = "active" | "banned" | "suspended";
type TxType     = "purchase" | "refund" | "bonus";
type TxStatus   = "completed" | "pending" | "failed";

interface AppUser {
  id: string;
  displayName: string;
  email: string;
  phone?: string;
  photoURL?: string;
  role: UserRole;
  status: UserStatus;
  level: number;
  totalXP: number;
  currentStreak: number;
  longestStreak: number;
  dailyGoalMinutes: number;
  createdAt: Date;
  lastActiveAt: Date;
  fcmToken?: string;
  learningStyle?: string;
  bio?: string;
}

interface Enrollment {
  id: string;
  courseId: string;
  courseTitle: string;
  courseThumbnail?: string;
  courseCategory: string;
  progress: number; // 0-100
  lessonsCompleted: number;
  totalLessons: number;
  lastStudied: Date;
  enrolledAt: Date;
  completed: boolean;
  xpEarned: number;
}

interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  color: string;
  unlockedAt?: Date;
  isUnlocked: boolean;
  xpReward: number;
  condition: string;
}

interface XPLogEntry {
  id: string;
  activityType: "lesson_complete" | "daily_streak" | "achievement" | "bonus" | "quiz_pass";
  xpAmount: number;
  description: string;
  courseTitle?: string;
  timestamp: Date;
}

interface Transaction {
  id: string;
  type: TxType;
  status: TxStatus;
  amount: number;
  courseTitle: string;
  courseId: string;
  paymentMethod: string;
  createdAt: Date;
}

interface EditableUserFields {
  displayName: string;
  phone: string;
  role: UserRole;
  status: UserStatus;
  level: number;
  totalXP: number;
  dailyGoalMinutes: number;
  bio: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// MOCK DATA
// ═══════════════════════════════════════════════════════════════════════════

const MOCK_USER: AppUser = {
  id: "uid_0042",
  displayName: "Lê Trung Khương",
  email: "khuong.le@smartreview.io",
  phone: "+84 090 1234 567",
  role: "student",
  status: "active",
  level: 33,
  totalXP: 7_200,
  currentStreak: 9,
  longestStreak: 21,
  dailyGoalMinutes: 30,
  createdAt: new Date("2024-10-15"),
  lastActiveAt: new Date(Date.now() - 1000 * 60 * 45),
  learningStyle: "Visual",
  bio: "Học lập trình để xây dựng sản phẩm thật. Đang học React + Firebase.",
};

const MOCK_ENROLLMENTS: Enrollment[] = [
  { id: "e1", courseId: "c1", courseTitle: "Advanced React Patterns & Performance", courseCategory: "Development", progress: 68, lessonsCompleted: 23, totalLessons: 34, lastStudied: new Date(Date.now() - 1000 * 60 * 50), enrolledAt: new Date("2025-01-10"), completed: false, xpEarned: 1750 },
  { id: "e2", courseId: "c2", courseTitle: "UI/UX Design Systems from Scratch",      courseCategory: "Design",      progress: 100, lessonsCompleted: 28, totalLessons: 28, lastStudied: new Date("2025-02-28"), enrolledAt: new Date("2024-12-05"), completed: true, xpEarned: 2100 },
  { id: "e3", courseId: "c3", courseTitle: "TypeScript for React Developers",         courseCategory: "Development", progress: 31, lessonsCompleted: 10, totalLessons: 33, lastStudied: new Date(Date.now() - 1000 * 60 * 60 * 36), enrolledAt: new Date("2025-03-01"), completed: false, xpEarned: 750 },
  { id: "e4", courseId: "c4", courseTitle: "Python Machine Learning Bootcamp",        courseCategory: "Data Science",progress: 5,  lessonsCompleted: 2,  totalLessons: 40, lastStudied: new Date(Date.now() - 1000 * 60 * 60 * 72), enrolledAt: new Date("2025-04-10"), completed: false, xpEarned: 100 },
];

const MOCK_ACHIEVEMENTS: Achievement[] = [
  { id: "a1", title: "First Step",      description: "Complete your first lesson",        icon: "🎯", color: "#45f1c5", isUnlocked: true,  unlockedAt: new Date("2024-10-16"), xpReward: 50,   condition: "lessons >= 1"    },
  { id: "a2", title: "Week Warrior",    description: "Study 7 days in a row",             icon: "🔥", color: "#FFB785", isUnlocked: true,  unlockedAt: new Date("2024-11-02"), xpReward: 200,  condition: "streak >= 7"     },
  { id: "a3", title: "Speed Reader",    description: "Complete 5 lessons in one day",     icon: "⚡", color: "#6C63FF", isUnlocked: true,  unlockedAt: new Date("2025-01-14"), xpReward: 150,  condition: "daily_lessons >= 5" },
  { id: "a4", title: "Course Master",   description: "Complete an entire course",         icon: "🏆", color: "#FFD700", isUnlocked: true,  unlockedAt: new Date("2025-02-28"), xpReward: 500,  condition: "completed_courses >= 1" },
  { id: "a5", title: "Night Owl",       description: "Study after midnight",              icon: "🦉", color: "#9B59B6", isUnlocked: true,  unlockedAt: new Date("2025-03-10"), xpReward: 75,   condition: "midnight_session" },
  { id: "a6", title: "XP Collector",   description: "Earn 5,000 total XP",              icon: "💎", color: "#c4c0ff", isUnlocked: true,  unlockedAt: new Date("2025-03-22"), xpReward: 300,  condition: "total_xp >= 5000" },
  { id: "a7", title: "Social Learner",  description: "Join 3 community rooms",           icon: "👥", color: "#45f1c5", isUnlocked: false, xpReward: 100,  condition: "rooms >= 3"      },
  { id: "a8", title: "Perfectionist",   description: "Score 100% on any quiz",           icon: "🎖️", color: "#FFB785", isUnlocked: false, xpReward: 250,  condition: "quiz_perfect"    },
  { id: "a9", title: "The Grind",       description: "Study for 30 consecutive days",    icon: "⚔️", color: "#ff6b6b", isUnlocked: false, xpReward: 1000, condition: "streak >= 30"    },
  { id:"a10", title: "Top Scholar",     description: "Reach Level 50",                   icon: "👑", color: "#FFD700", isUnlocked: false, xpReward: 2000, condition: "level >= 50"     },
];

const MOCK_XP_LOG: XPLogEntry[] = [
  { id: "x1",  activityType: "lesson_complete", xpAmount: 75,  description: "Completed: Concurrent Rendering",    courseTitle: "Advanced React",  timestamp: new Date(Date.now() - 1000 * 60 * 50)     },
  { id: "x2",  activityType: "daily_streak",    xpAmount: 50,  description: "9-day streak bonus",                 timestamp: new Date(Date.now() - 1000 * 60 * 60 * 6) },
  { id: "x3",  activityType: "lesson_complete", xpAmount: 100, description: "Completed quiz: Performance Audit",  courseTitle: "Advanced React",  timestamp: new Date(Date.now() - 1000 * 60 * 60 * 8) },
  { id: "x4",  activityType: "quiz_pass",       xpAmount: 150, description: "Perfect score on Module 2 quiz",     courseTitle: "Advanced React",  timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24) },
  { id: "x5",  activityType: "lesson_complete", xpAmount: 75,  description: "Completed: Component Architecture",  courseTitle: "Advanced React",  timestamp: new Date(Date.now() - 1000 * 60 * 60 * 28) },
  { id: "x6",  activityType: "achievement",     xpAmount: 300, description: "Achievement unlocked: XP Collector", timestamp: new Date("2025-03-22") },
  { id: "x7",  activityType: "lesson_complete", xpAmount: 50,  description: "Completed: TS Generics",            courseTitle: "TypeScript React", timestamp: new Date("2025-03-20") },
  { id: "x8",  activityType: "daily_streak",    xpAmount: 50,  description: "7-day streak bonus",                timestamp: new Date("2025-03-18") },
];

const MOCK_XP_CHART = [
  { date: "Oct",  xp: 320,  cumulative: 320  },
  { date: "Nov",  xp: 780,  cumulative: 1100 },
  { date: "Dec",  xp: 640,  cumulative: 1740 },
  { date: "Jan",  xp: 1250, cumulative: 2990 },
  { date: "Feb",  xp: 2100, cumulative: 5090 },
  { date: "Mar",  xp: 1380, cumulative: 6470 },
  { date: "Apr",  xp: 730,  cumulative: 7200 },
];

const MOCK_TRANSACTIONS: Transaction[] = [
  { id: "tx1", type: "purchase", status: "completed", amount: 89,  courseTitle: "Advanced React Patterns",       courseId: "c1", paymentMethod: "Visa •••• 8842", createdAt: new Date("2025-01-10") },
  { id: "tx2", type: "purchase", status: "completed", amount: 65,  courseTitle: "UI/UX Design Systems",          courseId: "c2", paymentMethod: "Smart Pay Wallet", createdAt: new Date("2024-12-05") },
  { id: "tx3", type: "purchase", status: "completed", amount: 79,  courseTitle: "TypeScript for React Devs",     courseId: "c3", paymentMethod: "Visa •••• 8842", createdAt: new Date("2025-03-01") },
  { id: "tx4", type: "purchase", status: "completed", amount: 149, courseTitle: "Python ML Bootcamp",            courseId: "c4", paymentMethod: "Visa •••• 8842", createdAt: new Date("2025-04-10") },
  { id: "tx5", type: "refund",   status: "completed", amount: -45, courseTitle: "Growth Hacking Essentials",     courseId: "c5", paymentMethod: "Smart Pay Wallet", createdAt: new Date("2025-02-14") },
];

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

const fmtDate = (d: Date) => d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
const fmtNum  = (n: number) => new Intl.NumberFormat("en-US", { notation: "compact" }).format(n);
const fmtMoney = (n: number) => (n < 0 ? `-$${Math.abs(n)}` : `$${n}`);
const timeAgo = (d: Date) => {
  const s = (Date.now() - d.getTime()) / 1000;
  if (s < 60)   return `${Math.floor(s)}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};

const XP_ACTIVITY_CFG = {
  lesson_complete: { label: "Lesson",      color: "#6C63FF", bg: "rgba(108,99,255,.14)" },
  daily_streak:    { label: "Streak",      color: "#FFB785", bg: "rgba(255,183,133,.14)" },
  achievement:     { label: "Achievement", color: "#FFD700", bg: "rgba(255,215,0,.14)"  },
  bonus:           { label: "Bonus",       color: "#45f1c5", bg: "rgba(69,241,197,.14)" },
  quiz_pass:       { label: "Quiz",        color: "#c4c0ff", bg: "rgba(196,192,255,.14)" },
};

const ROLE_CFG: Record<UserRole, { label: string; color: string; bg: string; Icon: React.ElementType }> = {
  student:    { label: "Student",    color: "#c4c0ff", bg: "rgba(196,192,255,.1)", Icon: BookOpen },
  instructor: { label: "Instructor", color: "#45f1c5", bg: "rgba(69,241,197,.1)",  Icon: Award   },
  moderator:  { label: "Moderator",  color: "#FFB785", bg: "rgba(255,183,133,.1)", Icon: Shield  },
  admin:      { label: "Admin",      color: "#FFD700", bg: "rgba(255,215,0,.1)",   Icon: Crown   },
};

const STATUS_CFG: Record<UserStatus, { label: string; color: string; bg: string; border: string }> = {
  active:    { label: "Active",    color: "#45f1c5", bg: "rgba(69,241,197,.12)",  border: "rgba(69,241,197,.28)"  },
  banned:    { label: "Banned",    color: "#ffb4ab", bg: "rgba(255,180,171,.12)", border: "rgba(255,180,171,.28)" },
  suspended: { label: "Suspended", color: "#FFB785", bg: "rgba(255,183,133,.12)", border: "rgba(255,183,133,.28)" },
};

function initials(name: string) {
  return name.split(" ").map((w) => w[0]?.toUpperCase() ?? "").slice(0, 2).join("");
}

const AVATAR_GRADS = [
  "linear-gradient(135deg,#6C63FF,#9B59B6)",
  "linear-gradient(135deg,#00D4AA,#0F9E7B)",
  "linear-gradient(135deg,#FFB785,#FF8C42)",
  "linear-gradient(135deg,#45f1c5,#00A878)",
  "linear-gradient(135deg,#c4c0ff,#6C63FF)",
  "linear-gradient(135deg,#FFD700,#FF8C42)",
];

// ═══════════════════════════════════════════════════════════════════════════
// SHARED STYLES
// ═══════════════════════════════════════════════════════════════════════════

const IS: React.CSSProperties = {
  width: "100%", background: "#0d0d18",
  border: "1px solid rgba(255,255,255,.08)",
  borderRadius: 10, padding: "9px 12px",
  color: "#E4E1EE", fontSize: 13,
  outline: "none", fontFamily: "Inter,sans-serif",
  transition: "border-color .2s, box-shadow .2s",
};

function focusBorder(e: React.FocusEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
  e.target.style.borderColor = "rgba(108,99,255,.55)";
  e.target.style.boxShadow   = "0 0 0 3px rgba(108,99,255,.12)";
}
function blurBorder(e: React.FocusEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
  e.target.style.borderColor = "rgba(255,255,255,.08)";
  e.target.style.boxShadow   = "none";
}

const LABEL: React.CSSProperties = {
  display: "block", fontSize: 11, fontWeight: 700,
  color: "#C7C4D8", letterSpacing: ".07em",
  textTransform: "uppercase", marginBottom: 6,
};

// ═══════════════════════════════════════════════════════════════════════════
// TOAST (local version)
// ═══════════════════════════════════════════════════════════════════════════

interface Toast { id: string; msg: string; type: "success" | "error" | "info"; }
function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const add = useCallback((msg: string, type: Toast["type"] = "success") => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t, { id, msg, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
  }, []);
  return { toasts, add };
}
function ToastContainer({ toasts }: { toasts: Toast[] }) {
  const c = { success: "#45f1c5", error: "#ffb4ab", info: "#c4c0ff" };
  return (
    <div style={{ position: "fixed", bottom: 24, right: 24, zIndex: 99999, display: "flex", flexDirection: "column", gap: 10 }}>
      {toasts.map((t) => (
        <div key={t.id} style={{ background: "rgba(26,26,46,.97)", border: `1px solid ${c[t.type]}40`, borderRadius: 14, padding: "11px 18px", color: c[t.type], fontSize: 13, fontWeight: 700, fontFamily: "Inter,sans-serif", boxShadow: `0 8px 30px rgba(0,0,0,.5)`, animation: "slideInR .3s ease", maxWidth: 340 }}>
          {t.msg}
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION WRAPPER
// ═══════════════════════════════════════════════════════════════════════════

function Section({ title, subtitle, icon: Icon, children, action, glow }: {
  title: string; subtitle?: string;
  icon: React.ElementType; children: ReactNode;
  action?: ReactNode; glow?: string;
}) {
  return (
    <div style={{ background: "rgba(26,26,46,.65)", border: "1px solid rgba(255,255,255,.06)", borderRadius: 22, overflow: "hidden", backdropFilter: "blur(14px)", boxShadow: glow ? `0 4px 28px ${glow}` : undefined }}>
      <div style={{ padding: "15px 22px", borderBottom: "1px solid rgba(255,255,255,.06)", display: "flex", alignItems: "center", gap: 12, background: "rgba(255,255,255,.02)" }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(108,99,255,.14)", border: "1px solid rgba(108,99,255,.24)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Icon size={17} color="#6C63FF" />
        </div>
        <div style={{ flex: 1 }}>
          <h3 style={{ fontSize: 14, fontWeight: 800, color: "#E4E1EE", margin: 0 }}>{title}</h3>
          {subtitle && <p style={{ fontSize: 11, color: "#C7C4D8", margin: 0 }}>{subtitle}</p>}
        </div>
        {action}
      </div>
      <div style={{ padding: 20 }}>{children}</div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// USER INFO FORM
// ═══════════════════════════════════════════════════════════════════════════

interface UserInfoFormProps {
  user: AppUser;
  isAdmin: boolean;
  onSave: (fields: Partial<EditableUserFields>) => Promise<void>;
}

function UserInfoForm({ user, isAdmin, onSave }: UserInfoFormProps) {
  const [form, setForm] = useState<EditableUserFields>({
    displayName: user.displayName,
    phone:       user.phone ?? "",
    role:        user.role,
    status:      user.status,
    level:       user.level,
    totalXP:     user.totalXP,
    dailyGoalMinutes: user.dailyGoalMinutes,
    bio:         user.bio ?? "",
  });
  const [saving, setSaving]   = useState(false);
  const [dirty, setDirty]     = useState(false);

  const set = <K extends keyof EditableUserFields>(k: K, v: EditableUserFields[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    setDirty(true);
  };

  const handleSave = async () => {
    setSaving(true);
    await onSave(form);
    setSaving(false);
    setDirty(false);
  };

  const statusCfg = STATUS_CFG[form.status];
  const roleCfg   = ROLE_CFG[form.role];
  const RoleIcon  = roleCfg.Icon;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {/* Avatar + quick identity */}
      <div style={{ display: "flex", alignItems: "center", gap: 20, padding: "20px", background: "rgba(108,99,255,.06)", border: "1px solid rgba(108,99,255,.18)", borderRadius: 18 }}>
        <div style={{ position: "relative", flexShrink: 0 }}>
          <div style={{ width: 80, height: 80, borderRadius: "50%", background: "linear-gradient(135deg,#6C63FF,#9B59B6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, fontWeight: 900, color: "#fff", border: "3px solid rgba(196,192,255,.4)", boxShadow: "0 0 24px rgba(108,99,255,.3)" }}>
            {user.photoURL
              ? <img src={user.photoURL} alt="" style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" }} />
              : user.displayName.charAt(0).toUpperCase()
            }
          </div>
          <div style={{ position: "absolute", bottom: 2, right: 2, width: 20, height: 20, borderRadius: "50%", background: "#45f1c5", border: "2px solid #0F0F1A", boxShadow: "0 0 8px rgba(69,241,197,.6)" }} />
        </div>

        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: "#E4E1EE", marginBottom: 5 }}>{form.displayName || "—"}</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 10px", borderRadius: 999, background: roleCfg.bg, color: roleCfg.color, fontSize: 11, fontWeight: 700 }}>
              <RoleIcon size={10} /> {roleCfg.label}
            </span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 10px", borderRadius: 999, background: statusCfg.bg, border: `1px solid ${statusCfg.border}`, color: statusCfg.color, fontSize: 11, fontWeight: 700 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: statusCfg.color, flexShrink: 0 }} />
              {statusCfg.label}
            </span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 10px", borderRadius: 999, background: "rgba(255,183,133,.1)", color: "#FFB785", fontSize: 11, fontWeight: 700 }}>
              ⚡ Lv. {form.level}
            </span>
          </div>
        </div>

        <div style={{ fontSize: 11, color: "#9B59B6", textAlign: "right" }}>
          <code style={{ background: "rgba(108,99,255,.1)", padding: "3px 8px", borderRadius: 6, color: "#c4c0ff", fontSize: 10 }}>{user.id}</code>
          <div style={{ fontSize: 10, color: "#C7C4D8", marginTop: 4 }}>Firestore: users/{user.id}</div>
        </div>
      </div>

      {/* Form grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div>
          <label style={LABEL}><User size={11} style={{ display: "inline", marginRight: 5 }} />Display Name</label>
          <input value={form.displayName} onChange={(e) => set("displayName", e.target.value)} style={IS} onFocus={focusBorder} onBlur={blurBorder} />
        </div>

        <div>
          <label style={LABEL}><Mail size={11} style={{ display: "inline", marginRight: 5 }} />Email (read-only)</label>
          <div style={{ position: "relative" }}>
            <input value={user.email} readOnly style={{ ...IS, color: "#C7C4D8", cursor: "not-allowed", background: "#0a0a12" }} />
            <Lock size={12} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", color: "#47464f" }} />
          </div>
          <p style={{ fontSize: 10, color: "#47464f", marginTop: 4 }}>Email is managed by Firebase Auth</p>
        </div>

        <div>
          <label style={LABEL}><Phone size={11} style={{ display: "inline", marginRight: 5 }} />Phone</label>
          <input value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+84..." style={IS} onFocus={focusBorder} onBlur={blurBorder} />
        </div>

        <div>
          <label style={LABEL}><Target size={11} style={{ display: "inline", marginRight: 5 }} />Daily Goal (minutes)</label>
          <select value={form.dailyGoalMinutes} onChange={(e) => set("dailyGoalMinutes", Number(e.target.value))} style={IS} onFocus={focusBorder} onBlur={blurBorder}>
            {[5, 10, 15, 20, 30, 45, 60].map((m) => <option key={m} value={m}>{m} minutes</option>)}
          </select>
        </div>

        <div style={{ gridColumn: "1 / -1" }}>
          <label style={LABEL}>Bio</label>
          <textarea value={form.bio} onChange={(e) => set("bio", e.target.value)} rows={2} placeholder="Short bio…" style={{ ...IS, resize: "vertical" }} onFocus={focusBorder} onBlur={blurBorder} />
        </div>
      </div>

      {/* Admin-only section */}
      <div style={{ padding: 16, background: "rgba(255,215,0,.05)", border: "1px solid rgba(255,215,0,.18)", borderRadius: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
          <Crown size={14} color="#FFD700" />
          <span style={{ fontSize: 12, fontWeight: 800, color: "#FFD700", letterSpacing: ".05em", textTransform: "uppercase" }}>Admin-only fields</span>
          {!isAdmin && <Lock size={12} color="#47464f" />}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 14, opacity: isAdmin ? 1 : .45, pointerEvents: isAdmin ? "auto" : "none" }}>
          <div>
            <label style={LABEL}>Role</label>
            <select value={form.role} onChange={(e) => set("role", e.target.value as UserRole)} style={IS} onFocus={focusBorder} onBlur={blurBorder}>
              <option value="student">Student</option>
              <option value="instructor">Instructor</option>
              <option value="moderator">Moderator</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          <div>
            <label style={LABEL}>Status</label>
            <select value={form.status} onChange={(e) => set("status", e.target.value as UserStatus)} style={IS} onFocus={focusBorder} onBlur={blurBorder}>
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
              <option value="banned">Banned</option>
            </select>
          </div>

          <div>
            <label style={LABEL}>Level</label>
            <input type="number" min={1} max={999} value={form.level} onChange={(e) => set("level", Number(e.target.value))} style={IS} onFocus={focusBorder} onBlur={blurBorder} />
          </div>

          <div>
            <label style={LABEL}>Total XP</label>
            <input type="number" min={0} value={form.totalXP} onChange={(e) => set("totalXP", Number(e.target.value))} style={IS} onFocus={focusBorder} onBlur={blurBorder} />
          </div>
        </div>

        {!isAdmin && <p style={{ fontSize: 11, color: "#47464f", marginTop: 10 }}>You need admin role to modify these fields.</p>}
      </div>

      {/* Save button */}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 12 }}>
        {dirty && (
          <button onClick={() => { setForm({ displayName: user.displayName, phone: user.phone ?? "", role: user.role, status: user.status, level: user.level, totalXP: user.totalXP, dailyGoalMinutes: user.dailyGoalMinutes, bio: user.bio ?? "" }); setDirty(false); }}
            style={{ padding: "10px 18px", borderRadius: 12, fontSize: 13, fontWeight: 600, cursor: "pointer", background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.1)", color: "#C7C4D8" }}>
            Discard
          </button>
        )}
        <button
          onClick={handleSave}
          disabled={!dirty || saving}
          style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "10px 22px", borderRadius: 12, fontSize: 13, fontWeight: 800,
            cursor: (!dirty || saving) ? "not-allowed" : "pointer",
            background: dirty ? "linear-gradient(135deg,#6C63FF,#9B59B6)" : "rgba(255,255,255,.04)",
            border: "none", color: dirty ? "#fff" : "#47464f",
            boxShadow: dirty ? "0 0 20px rgba(108,99,255,.28)" : "none",
            opacity: saving ? .75 : 1, transition: "all .2s",
          }}
        >
          {saving ? <><Loader size={14} style={{ animation: "spin .8s linear infinite" }} /> Saving…</> : <><Save size={14} /> Save changes</>}
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// PROGRESS COURSE LIST
// ═══════════════════════════════════════════════════════════════════════════

function ProgressCourseList({ enrollments, loading }: { enrollments: Enrollment[]; loading: boolean }) {
  if (loading) return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} style={{ height: 74, borderRadius: 14, background: "linear-gradient(90deg,#1f1f2c 25%,#2a2935 50%,#1f1f2c 75%)", backgroundSize: "200% 100%", animation: "shimmer 1.4s infinite" }} />
      ))}
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {enrollments.map((e) => {
        const catColors: Record<string, string> = {
          "Development": "#6C63FF", "Design": "#45f1c5",
          "Data Science": "#FFB785", "Language": "#c4c0ff",
        };
        const accent = catColors[e.courseCategory] ?? "#C7C4D8";

        return (
          <div key={e.id} style={{ background: "rgba(255,255,255,.025)", border: "1px solid rgba(255,255,255,.07)", borderRadius: 16, padding: "14px 16px", transition: "background .15s" }}
            onMouseOver={(e2) => (e2.currentTarget.style.background = "rgba(255,255,255,.04)")}
            onMouseOut={(e2)  => (e2.currentTarget.style.background = "rgba(255,255,255,.025)")}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
              <div style={{ width: 44, height: 44, borderRadius: 10, background: `${accent}22`, border: `1px solid ${accent}40`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <BookOpen size={18} color={accent} />
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#E4E1EE", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
                    {e.courseTitle}
                  </span>
                  {e.completed
                    ? <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 8px", borderRadius: 999, background: "rgba(69,241,197,.12)", border: "1px solid rgba(69,241,197,.28)", color: "#45f1c5", fontSize: 10, fontWeight: 700, flexShrink: 0 }}>
                        <CheckCircle size={9} /> Done
                      </span>
                    : <span style={{ fontSize: 12, fontWeight: 800, color: accent }}>{e.progress}%</span>
                  }
                </div>

                <div style={{ width: "100%", height: 5, borderRadius: 99, background: "rgba(255,255,255,.08)", overflow: "hidden", marginBottom: 8 }}>
                  <div style={{ height: "100%", width: `${e.progress}%`, background: e.completed ? "linear-gradient(90deg,#45f1c5,#00A878)" : `linear-gradient(90deg,#6C63FF,${accent})`, borderRadius: 99, transition: "width .6s ease" }} />
                </div>

                <div style={{ display: "flex", gap: 14, fontSize: 11, color: "#C7C4D8" }}>
                  <span>{e.lessonsCompleted}/{e.totalLessons} lessons</span>
                  <span style={{ display: "flex", alignItems: "center", gap: 3 }}><Zap size={10} color="#FFB785" /> +{e.xpEarned} XP</span>
                  <span style={{ display: "flex", alignItems: "center", gap: 3 }}><Clock size={10} /> {timeAgo(e.lastStudied)}</span>
                </div>
              </div>
            </div>
          </div>
        );
      })}

      {enrollments.length === 0 && (
        <div style={{ textAlign: "center", padding: 32, color: "#47464f" }}>
          <BookOpen size={32} style={{ margin: "0 auto 10px" }} />
          <p style={{ fontSize: 13 }}>No enrolled courses yet</p>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ACHIEVEMENT GRID
// ═══════════════════════════════════════════════════════════════════════════

function AchievementGrid({ achievements }: { achievements: Achievement[] }) {
  const [hoverId, setHoverId] = useState<string | null>(null);

  const unlocked = achievements.filter((a) => a.isUnlocked).length;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
        <div style={{ flex: 1, height: 5, borderRadius: 99, background: "rgba(255,255,255,.08)", overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${(unlocked / achievements.length) * 100}%`, background: "linear-gradient(90deg,#6C63FF,#00D4AA)", borderRadius: 99 }} />
        </div>
        <span style={{ fontSize: 12, fontWeight: 700, color: "#C7C4D8", flexShrink: 0 }}>
          {unlocked}/{achievements.length} unlocked
        </span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12 }}>
        {achievements.map((a) => (
          <div
            key={a.id}
            onMouseOver={() => setHoverId(a.id)}
            onMouseOut={() => setHoverId(null)}
            style={{
              position: "relative", borderRadius: 16,
              padding: "16px 10px", textAlign: "center",
              background: a.isUnlocked ? `${a.color}10` : "rgba(255,255,255,.025)",
              border: `1px solid ${a.isUnlocked ? `${a.color}35` : "rgba(255,255,255,.07)"}`,
              filter: a.isUnlocked ? "none" : "grayscale(.9)",
              opacity: a.isUnlocked ? 1 : .5,
              cursor: "default", transition: "all .2s",
              transform: hoverId === a.id ? "scale(1.04)" : "scale(1)",
              boxShadow: hoverId === a.id && a.isUnlocked ? `0 0 20px ${a.color}30` : "none",
            }}
          >
            <div style={{ width: 48, height: 48, borderRadius: "50%", background: a.isUnlocked ? `linear-gradient(135deg,${a.color}44,${a.color}22)` : "rgba(255,255,255,.05)", border: `2px solid ${a.isUnlocked ? a.color + "55" : "rgba(255,255,255,.08)"}`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 8px", fontSize: 22, boxShadow: a.isUnlocked ? `0 0 14px ${a.color}30` : "none" }}>
              {a.icon}
            </div>

            <div style={{ fontSize: 10, fontWeight: 800, color: a.isUnlocked ? "#E4E1EE" : "#47464f", lineHeight: 1.3, marginBottom: 4 }}>
              {a.title}
            </div>

            <div style={{ fontSize: 10, fontWeight: 700, color: a.isUnlocked ? "#FFB785" : "#47464f", display: "flex", alignItems: "center", justifyContent: "center", gap: 3 }}>
              <Zap size={9} /> +{a.xpReward}
            </div>

            {a.isUnlocked && a.unlockedAt && (
              <div style={{ fontSize: 9, color: "#C7C4D8", marginTop: 4 }}>
                {fmtDate(a.unlockedAt)}
              </div>
            )}
            {!a.isUnlocked && (
              <Lock size={12} color="#47464f" style={{ margin: "4px auto 0" }} />
            )}

            {hoverId === a.id && (
              <div style={{ position: "absolute", bottom: "calc(100% + 8px)", left: "50%", transform: "translateX(-50%)", background: "rgba(26,26,46,.97)", border: "1px solid rgba(255,255,255,.1)", borderRadius: 10, padding: "8px 12px", zIndex: 20, width: 160, textAlign: "left", boxShadow: "0 8px 24px rgba(0,0,0,.5)", pointerEvents: "none" }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#E4E1EE", marginBottom: 4 }}>{a.title}</div>
                <div style={{ fontSize: 11, color: "#C7C4D8", lineHeight: 1.5 }}>{a.description}</div>
                <div style={{ fontSize: 10, color: "#47464f", marginTop: 4, fontFamily: "monospace" }}>{a.condition}</div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// XP HISTORY CHART
// ═══════════════════════════════════════════════════════════════════════════

const XPTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "rgba(26,26,46,.97)", border: "1px solid rgba(255,255,255,.08)", borderRadius: 12, padding: "10px 14px", fontSize: 12 }}>
      <p style={{ color: "#C7C4D8", marginBottom: 6, fontWeight: 700 }}>{label}</p>
      <p style={{ color: "#6C63FF" }}>+{payload[0]?.value} XP this month</p>
      <p style={{ color: "#45f1c5", marginTop: 2 }}>{payload[1]?.value} XP total</p>
    </div>
  );
};

function XPHistoryChart({ chartData, logs, loading }: { chartData: typeof MOCK_XP_CHART; logs: XPLogEntry[]; loading: boolean }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <div style={{ display: "flex", gap: 16, marginBottom: 12 }}>
          <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "#C7C4D8" }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: "#6C63FF", display: "inline-block" }} /> Monthly XP
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "#C7C4D8" }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: "#45f1c5", display: "inline-block" }} /> Cumulative
          </span>
        </div>
        <ResponsiveContainer width="100%" height={180}>
          <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
            <defs>
              <linearGradient id="gXP"  x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#6C63FF" stopOpacity={.3} />
                <stop offset="95%" stopColor="#6C63FF" stopOpacity={0}  />
              </linearGradient>
              <linearGradient id="gCum" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#45f1c5" stopOpacity={.2} />
                <stop offset="95%" stopColor="#45f1c5" stopOpacity={0}  />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.04)" vertical={false} />
            <XAxis dataKey="date" tick={{ fill: "#C7C4D8", fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: "#C7C4D8", fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip content={<XPTooltip />} cursor={{ stroke: "rgba(255,255,255,.08)" }} />
            <Area type="monotone" dataKey="xp"         stroke="#6C63FF" strokeWidth={2} fill="url(#gXP)"  dot={false} activeDot={{ r: 5, fill: "#6C63FF", stroke: "#0F0F1A", strokeWidth: 2 }} />
            <Area type="monotone" dataKey="cumulative" stroke="#45f1c5" strokeWidth={2} fill="url(#gCum)" dot={false} activeDot={{ r: 5, fill: "#45f1c5", stroke: "#0F0F1A", strokeWidth: 2 }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#C7C4D8", marginBottom: 12, textTransform: "uppercase", letterSpacing: ".06em", display: "flex", alignItems: "center", gap: 6 }}>
          <Activity size={13} /> Recent Activity
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 260, overflowY: "auto" }}>
          {loading
            ? Array.from({ length: 5 }).map((_, i) => (
                <div key={i} style={{ height: 44, borderRadius: 10, background: "linear-gradient(90deg,#1f1f2c 25%,#2a2935 50%,#1f1f2c 75%)", backgroundSize: "200% 100%", animation: "shimmer 1.4s infinite" }} />
              ))
            : logs.map((log) => {
                const cfg = XP_ACTIVITY_CFG[log.activityType];
                return (
                  <div key={log.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: 10, background: "rgba(255,255,255,.022)", border: "1px solid rgba(255,255,255,.06)" }}>
                    <span style={{ display: "inline-flex", alignItems: "center", padding: "3px 8px", borderRadius: 999, background: cfg.bg, color: cfg.color, fontSize: 10, fontWeight: 700, flexShrink: 0 }}>
                      {cfg.label}
                    </span>
                    <span style={{ flex: 1, fontSize: 12, color: "#C7C4D8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {log.description}
                    </span>
                    <span style={{ fontSize: 12, fontWeight: 800, color: "#45f1c5", flexShrink: 0 }}>+{log.xpAmount}</span>
                    <span style={{ fontSize: 10, color: "#47464f", flexShrink: 0, minWidth: 52, textAlign: "right" }}>{timeAgo(log.timestamp)}</span>
                  </div>
                );
              })
          }
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TRANSACTION TABLE
// ═══════════════════════════════════════════════════════════════════════════

function TransactionTable({ transactions, loading }: { transactions: Transaction[]; loading: boolean }) {
  const TX_CFG: Record<TxType, { label: string; color: string; bg: string }> = {
    purchase: { label: "Purchase", color: "#6C63FF", bg: "rgba(108,99,255,.14)" },
    refund:   { label: "Refund",   color: "#ffb4ab", bg: "rgba(255,180,171,.14)" },
    bonus:    { label: "Bonus",    color: "#45f1c5", bg: "rgba(69,241,197,.14)"  },
  };
  const ST_CFG: Record<TxStatus, { label: string; color: string }> = {
    completed: { label: "Completed", color: "#45f1c5" },
    pending:   { label: "Pending",   color: "#FFB785" },
    failed:    { label: "Failed",    color: "#ffb4ab"  },
  };

  const total = transactions.reduce((s, t) => s + t.amount, 0);

  return (
    <div>
      <div style={{ display: "flex", gap: 16, marginBottom: 16, padding: "12px 16px", background: "rgba(108,99,255,.07)", border: "1px solid rgba(108,99,255,.18)", borderRadius: 14 }}>
        {[
          { label: "Total Spent",  val: `$${transactions.filter((t) => t.type === "purchase").reduce((s, t) => s + t.amount, 0)}`, color: "#c4c0ff" },
          { label: "Refunds",     val: `$${Math.abs(transactions.filter((t) => t.type === "refund").reduce((s, t) => s + t.amount, 0))}`, color: "#ffb4ab" },
          { label: "Net Revenue", val: `$${total}`, color: "#45f1c5" },
          { label: "Courses Purchased", val: transactions.filter((t) => t.type === "purchase").length, color: "#FFB785" },
        ].map(({ label, val, color }) => (
          <div key={label} style={{ flex: 1, textAlign: "center" }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#C7C4D8", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 4 }}>{label}</div>
            <div style={{ fontSize: 18, fontWeight: 800, color }}>{val}</div>
          </div>
        ))}
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 600 }}>
          <thead>
            <tr>
              {["Transaction ID", "Course", "Type", "Amount", "Method", "Status", "Date"].map((h) => (
                <th key={h} style={{ padding: "9px 12px", textAlign: "left", background: "rgba(255,255,255,.02)", borderBottom: "1px solid rgba(255,255,255,.06)", fontSize: 10, fontWeight: 700, color: "#C7C4D8", letterSpacing: ".07em", textTransform: "uppercase" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid rgba(255,255,255,.04)" }}>
                    {Array.from({ length: 7 }).map((_, j) => (
                      <td key={j} style={{ padding: "12px" }}>
                        <div style={{ height: 14, borderRadius: 7, background: "linear-gradient(90deg,#1f1f2c 25%,#2a2935 50%,#1f1f2c 75%)", backgroundSize: "200% 100%", animation: "shimmer 1.4s infinite" }} />
                      </td>
                    ))}
                  </tr>
                ))
              : transactions.map((tx) => {
                  const tc = TX_CFG[tx.type];
                  const sc = ST_CFG[tx.status];
                  return (
                    <tr key={tx.id}
                      style={{ borderBottom: "1px solid rgba(255,255,255,.04)", transition: "background .15s" }}
                      onMouseOver={(e) => ((e.currentTarget as HTMLTableRowElement).style.background = "rgba(255,255,255,.025)")}
                      onMouseOut={(e)  => ((e.currentTarget as HTMLTableRowElement).style.background = "transparent")}
                    >
                      <td style={{ padding: "11px 12px" }}>
                        <code style={{ fontSize: 10, color: "#9B59B6", background: "rgba(108,99,255,.1)", padding: "2px 6px", borderRadius: 5 }}>{tx.id}</code>
                      </td>
                      <td style={{ padding: "11px 12px", fontSize: 12, fontWeight: 600, color: "#E4E1EE", maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {tx.courseTitle}
                      </td>
                      <td style={{ padding: "11px 12px" }}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 9px", borderRadius: 999, background: tc.bg, color: tc.color, fontSize: 10, fontWeight: 700 }}>
                          {tc.label}
                        </span>
                      </td>
                      <td style={{ padding: "11px 12px", fontSize: 14, fontWeight: 800, color: tx.amount < 0 ? "#ffb4ab" : "#45f1c5" }}>
                        {fmtMoney(tx.amount)}
                      </td>
                      <td style={{ padding: "11px 12px", fontSize: 11, color: "#C7C4D8" }}>
                        <span style={{ display: "flex", alignItems: "center", gap: 4 }}><CreditCard size={11} /> {tx.paymentMethod}</span>
                      </td>
                      <td style={{ padding: "11px 12px" }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: sc.color }}>{sc.label}</span>
                      </td>
                      <td style={{ padding: "11px 12px", fontSize: 11, color: "#C7C4D8" }}>
                        {fmtDate(tx.createdAt)}
                      </td>
                    </tr>
                  );
                })
            }
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// QUICK STATS BAR
// ═══════════════════════════════════════════════════════════════════════════

function QuickStats({ user, enrollCount }: { user: AppUser; enrollCount: number }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 12 }}>
      {[
        { Icon: Zap,     label: "Total XP",     val: fmtNum(user.totalXP),        color: "#FFB785", glow: "rgba(255,183,133,.1)"  },
        { Icon: BarChart2, label: "Level",       val: `Lv. ${user.level}`,        color: "#e3dfff", glow: "rgba(227,223,255,.08)" },
        { Icon: Flame,   label: "Streak",        val: `${user.currentStreak}d`,   color: "#ff6b6b", glow: "rgba(255,107,107,.08)" },
        { Icon: BookOpen, label: "Courses",      val: enrollCount,                color: "#45f1c5", glow: "rgba(69,241,197,.08)"  },
        { Icon: Target,  label: "Daily Goal",    val: `${user.dailyGoalMinutes}m`,color: "#6C63FF", glow: "rgba(108,99,255,.1)"   },
        { Icon: Trophy,  label: "Best Streak",   val: `${user.longestStreak}d`,   color: "#FFD700", glow: "rgba(255,215,0,.08)"   },
      ].map(({ Icon, label, val, color, glow }) => (
        <div key={label} style={{ background: "rgba(26,26,46,.65)", border: "1px solid rgba(255,255,255,.06)", borderRadius: 16, padding: "14px", backdropFilter: "blur(12px)", boxShadow: `0 4px 20px ${glow}`, display: "flex", flexDirection: "column", gap: 8, transition: "transform .2s" }}
          onMouseOver={(e) => (e.currentTarget.style.transform = "translateY(-2px)")}
          onMouseOut={(e)  => (e.currentTarget.style.transform = "translateY(0)")}>
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <div style={{ width: 30, height: 30, borderRadius: 9, background: `${color}22`, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Icon size={15} color={color} />
            </div>
            <span style={{ fontSize: 10, fontWeight: 700, color: "#C7C4D8", letterSpacing: ".07em", textTransform: "uppercase" }}>{label}</span>
          </div>
          <span style={{ fontSize: 22, fontWeight: 900, color, letterSpacing: "-.02em" }}>{val}</span>
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TABS
// ═══════════════════════════════════════════════════════════════════════════

const TABS = [
  { id: "info",         label: "User Info",   Icon: User      },
  { id: "courses",      label: "Courses",     Icon: BookOpen  },
  { id: "achievements", label: "Achievements",Icon: Trophy    },
  { id: "xp",          label: "XP History",  Icon: TrendingUp },
  { id: "transactions", label: "Transactions",Icon: DollarSign },
] as const;
type TabId = typeof TABS[number]["id"];

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export default function UserDetailAdmin() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const isAdmin = true; // mock, thay bằng useIsAdmin() nếu có auth context

  const [activeTab, setActiveTab] = useState<TabId>("info");
  const { toasts, add: toast } = useToast();

  // Redirect nếu không có userId
  useEffect(() => {
    if (!userId) navigate("/admin/users");
  }, [userId, navigate]);

  // ── Firebase hooks (dùng userId từ params) ─────────────────────────────
  const { data: user, loading: uLoading, error: uError, lastSync, refetch } =
    useDocument<AppUser>("users", userId ?? "", MOCK_USER, 900);

  const { data: enrollments, loading: eLoading } =
    useCollection<Enrollment>("enrollments", { userId: userId ?? "" }, MOCK_ENROLLMENTS, 800);

  const { data: xpLogs, loading: xLoading } =
    useCollection<XPLogEntry>("xp_logs", { userId: userId ?? "" }, MOCK_XP_LOG, 750);

  const { data: achievements } =
    useCollection<Achievement>("achievements", { userId: userId ?? "" }, MOCK_ACHIEVEMENTS, 700);

  const { data: transactions, loading: tLoading } =
    useCollection<Transaction>("transactions", { userId: userId ?? "" }, MOCK_TRANSACTIONS, 850);

  // Derived
  const totalSpent = useMemo(
    () => transactions.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0),
    [transactions]
  );

  // ── Save handler (firebase update) ──────────────────────────────────────
  const handleSave = useCallback(async (fields: Partial<EditableUserFields>) => {
    // ── REAL FIREBASE ─────────────────────────────────────────────────────
    // await updateDoc(doc(db, "users", userId), { ...fields, updatedAt: serverTimestamp() });
    // ── MOCK ─────────────────────────────────────────────────────────────
    await new Promise((r) => setTimeout(r, 900));
    toast(`User "${fields.displayName ?? user?.displayName}" updated ✓`);
  }, [userId, user, toast]);

  // ─────────────────────────────────────────────────────────────────────
  // LOADING / ERROR
  // ─────────────────────────────────────────────────────────────────────
  if (uLoading) {
    return (
      <div style={{ minHeight: "100vh", background: "#0F0F1A", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Inter,sans-serif" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
          <div style={{ width: 56, height: 56, borderRadius: "50%", background: "rgba(108,99,255,.15)", border: "1px solid rgba(108,99,255,.3)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Loader size={26} color="#6C63FF" style={{ animation: "spin .8s linear infinite" }} />
          </div>
          <p style={{ fontSize: 15, fontWeight: 600, color: "#C7C4D8" }}>Loading user from Firestore…</p>
          <code style={{ fontSize: 11, color: "#9B59B6" }}>users/{userId}</code>
        </div>
      </div>
    );
  }

  if (uError || !user) {
    return (
      <div style={{ minHeight: "100vh", background: "#0F0F1A", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Inter,sans-serif" }}>
        <div style={{ textAlign: "center" }}>
          <AlertTriangle size={40} color="#ffb4ab" style={{ margin: "0 auto 14px" }} />
          <p style={{ fontSize: 16, fontWeight: 700, color: "#E4E1EE", marginBottom: 8 }}>User not found</p>
          <p style={{ fontSize: 13, color: "#C7C4D8", marginBottom: 20 }}>{uError?.message}</p>
          <button onClick={refetch} style={{ display: "flex", alignItems: "center", gap: 8, margin: "0 auto", padding: "10px 20px", borderRadius: 12, fontSize: 13, fontWeight: 700, cursor: "pointer", background: "linear-gradient(135deg,#6C63FF,#9B59B6)", border: "none", color: "#fff" }}>
            <RefreshCw size={14} /> Retry
          </button>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────
  // MAIN RENDER
  // ─────────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: "100vh", background: "#0F0F1A", color: "#E4E1EE", fontFamily: "Inter,sans-serif", backgroundImage: "radial-gradient(circle at 5% 0%, rgba(108,99,255,.06) 0%, transparent 55%)" }}>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        @keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}
        @keyframes fadeDown{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:translateY(0)}}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes slideInR{from{opacity:0;transform:translateX(20px)}to{opacity:1;transform:translateX(0)}}
        input,select,textarea,button{font-family:Inter,sans-serif;}
        ::-webkit-scrollbar{width:5px;height:5px;} ::-webkit-scrollbar-track{background:#0F0F1A;} ::-webkit-scrollbar-thumb{background:#2a292d;border-radius:10px;}
      `}</style>

      {/* ── STICKY HEADER ──────────────────────────────────────────────── */}
      <header style={{ position: "sticky", top: 0, zIndex: 50, background: "rgba(15,15,26,.92)", backdropFilter: "blur(18px)", borderBottom: "1px solid rgba(255,255,255,.06)" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "12px 24px", display: "flex", alignItems: "center", gap: 16 }}>
          <button onClick={() => navigate("/admin/users")} style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.08)", borderRadius: 10, padding: "8px 14px", color: "#C7C4D8", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            <ArrowLeft size={14} /> Users
          </button>

          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#C7C4D8" }}>
            <span>Admin</span>
            <ChevronRight size={13} />
            <span>Users</span>
            <ChevronRight size={13} />
            <span style={{ color: "#e3dfff", fontWeight: 700 }}>{user.displayName}</span>
          </div>

          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12 }}>
            {lastSync && (
              <span style={{ fontSize: 11, color: "#45f1c5", display: "flex", alignItems: "center", gap: 5, fontWeight: 700 }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#45f1c5", display: "inline-block", animation: "pulse 2s infinite" }} />
                Live · {lastSync.toLocaleTimeString()}
              </span>
            )}
            <button onClick={refetch} style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 10, fontSize: 12, fontWeight: 600, cursor: "pointer", background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.08)", color: "#C7C4D8" }}>
              <RefreshCw size={13} /> Refresh
            </button>
            <button style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 10, fontSize: 12, fontWeight: 600, cursor: "pointer", background: "rgba(255,180,171,.08)", border: "1px solid rgba(255,180,171,.2)", color: "#ffb4ab" }}>
              <ShieldOff size={13} /> {user.status === "banned" ? "Unban" : "Ban"} User
            </button>
          </div>
        </div>
      </header>

      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "28px 24px", display: "flex", flexDirection: "column", gap: 24 }}>

        {/* ── QUICK STATS ──────────────────────────────────────────────── */}
        <QuickStats user={user} enrollCount={enrollments.length} />

        {/* ── TABS ─────────────────────────────────────────────────────── */}
        <div style={{ display: "flex", gap: 4, background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.06)", borderRadius: 14, padding: 5 }}>
          {TABS.map(({ id, label, Icon }) => {
            const badges: Partial<Record<TabId, number>> = {
              courses: enrollments.length,
              achievements: achievements.filter((a) => a.isUnlocked).length,
              transactions: transactions.length,
            };
            return (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                style={{
                  flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  padding: "10px 12px", borderRadius: 10, fontSize: 13, fontWeight: 700,
                  cursor: "pointer", transition: "all .2s", position: "relative",
                  background: activeTab === id ? "linear-gradient(135deg,#6C63FF,#9B59B6)" : "transparent",
                  border: activeTab === id ? "1px solid rgba(108,99,255,.3)" : "1px solid transparent",
                  color: activeTab === id ? "#fff" : "#C7C4D8",
                  boxShadow: activeTab === id ? "0 0 16px rgba(108,99,255,.25)" : "none",
                }}
              >
                <Icon size={14} /> {label}
                {badges[id] !== undefined && (
                  <span style={{ background: activeTab === id ? "rgba(255,255,255,.25)" : "rgba(108,99,255,.3)", color: activeTab === id ? "#fff" : "#c4c0ff", fontSize: 10, fontWeight: 800, padding: "1px 7px", borderRadius: 999 }}>
                    {badges[id]}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* ── TAB CONTENT ──────────────────────────────────────────────── */}

        {activeTab === "info" && (
          <div style={{ animation: "fadeDown .25s ease" }}>
            <Section title="User Profile" subtitle={`Firestore: users/${user.id} · ${isAdmin ? "Admin edit enabled" : "Read-only"}`} icon={User}
              action={
                <div style={{ display: "flex", gap: 8 }}>
                  <span style={{ fontSize: 11, color: "#C7C4D8", display: "flex", alignItems: "center", gap: 5 }}>
                    <Calendar size={11} /> Joined {fmtDate(user.createdAt)}
                  </span>
                  <span style={{ fontSize: 11, color: "#45f1c5", display: "flex", alignItems: "center", gap: 5 }}>
                    <Activity size={11} /> Active {timeAgo(user.lastActiveAt)}
                  </span>
                </div>
              }
            >
              <UserInfoForm user={user} isAdmin={isAdmin} onSave={handleSave} />
            </Section>
          </div>
        )}

        {activeTab === "courses" && (
          <div style={{ animation: "fadeDown .25s ease" }}>
            <Section
              title="Enrolled Courses"
              subtitle={`${enrollments.length} courses · Firestore: enrollments where userId == "${userId}"`}
              icon={BookOpen}
              action={
                <div style={{ display: "flex", gap: 10, fontSize: 12 }}>
                  <span style={{ color: "#45f1c5", fontWeight: 700 }}>{enrollments.filter((e) => e.completed).length} completed</span>
                  <span style={{ color: "#C7C4D8" }}>·</span>
                  <span style={{ color: "#FFB785", fontWeight: 700 }}>${totalSpent} spent</span>
                </div>
              }
            >
              <ProgressCourseList enrollments={enrollments} loading={eLoading} />
            </Section>
          </div>
        )}

        {activeTab === "achievements" && (
          <div style={{ animation: "fadeDown .25s ease" }}>
            <Section
              title="Achievements"
              subtitle={`Firestore: users/${userId}/achievements · ${achievements.filter((a) => a.isUnlocked).length}/${achievements.length} unlocked`}
              icon={Trophy}
            >
              <AchievementGrid achievements={achievements} />
            </Section>
          </div>
        )}

        {activeTab === "xp" && (
          <div style={{ animation: "fadeDown .25s ease" }}>
            <Section
              title="XP History"
              subtitle={`Firestore: xp_logs where userId == "${userId}" · orderBy timestamp desc`}
              icon={TrendingUp}
              action={
                <span style={{ fontSize: 12, fontWeight: 800, color: "#FFB785" }}>
                  Total: {fmtNum(user.totalXP)} XP
                </span>
              }
            >
              <XPHistoryChart chartData={MOCK_XP_CHART} logs={xpLogs} loading={xLoading} />
            </Section>
          </div>
        )}

        {activeTab === "transactions" && (
          <div style={{ animation: "fadeDown .25s ease" }}>
            <Section
              title="Transaction History"
              subtitle={`Firestore: transactions where userId == "${userId}"`}
              icon={DollarSign}
            >
              <TransactionTable transactions={transactions} loading={tLoading} />
            </Section>
          </div>
        )}

      </div>

      <ToastContainer toasts={toasts} />
    </div>
  );
}
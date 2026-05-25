/**
 * Smart Review — Admin User Detail View (Firestore Realtime)
 * File: src/pages/admin/users/UserDetailAdmin.tsx
 * Route: /admin/users/:userId
 */

"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  doc,
  updateDoc,
  serverTimestamp,
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  type DocumentData,
} from "firebase/firestore";
import { db } from "../../../utils/config";
import { banUser, restoreUser, updateUserRole, sendResetPasswordEmail } from "../../../services/adminService";

// Icons
import {
  ArrowLeft,
  Save,
  User,
  Mail,
  Phone,
  Shield,
  Zap,
  Star,
  Flame,
  Clock,
  BookOpen,
  Trophy,
  DollarSign,
  CreditCard,
  ChevronRight,
  CheckCircle,
  Lock,
  Unlock,
  AlertTriangle,
  Loader,
  RefreshCw,
  Activity,
  TrendingUp,
  Target,
  Award,
  Crown,
  Edit3,
  X,
  Info,
  Copy,
  BarChart2,
  Calendar,
  Layers,
  ShieldOff,
} from "lucide-react";

// Recharts
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

// ==================== TYPES ====================
type UserRole = "student" | "instructor" | "moderator" | "admin";
type UserStatus = "active" | "banned" | "suspended";
type TxType = "purchase" | "refund" | "bonus";
type TxStatus = "completed" | "pending" | "failed";

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
  bio?: string;
}

interface Enrollment {
  id: string;
  courseId: string;
  courseTitle: string;
  courseCategory: string;
  progress: number;
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

// ==================== HELPERS ====================
const fmtDate = (d: Date) => d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
const fmtNum = (n: number) => new Intl.NumberFormat("en-US", { notation: "compact" }).format(n);
const fmtMoney = (n: number) => (n < 0 ? `-$${Math.abs(n)}` : `$${n}`);
const timeAgo = (d: Date) => {
  const s = (Date.now() - d.getTime()) / 1000;
  if (s < 60) return `${Math.floor(s)}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};

const XP_ACTIVITY_CFG = {
  lesson_complete: { label: "Lesson", color: "#6C63FF", bg: "rgba(108,99,255,.14)" },
  daily_streak: { label: "Streak", color: "#FFB785", bg: "rgba(255,183,133,.14)" },
  achievement: { label: "Achievement", color: "#FFD700", bg: "rgba(255,215,0,.14)" },
  bonus: { label: "Bonus", color: "#45f1c5", bg: "rgba(69,241,197,.14)" },
  quiz_pass: { label: "Quiz", color: "#c4c0ff", bg: "rgba(196,192,255,.14)" },
};

const ROLE_CFG: Record<UserRole, { label: string; color: string; bg: string; Icon: React.ElementType }> = {
  student: { label: "Student", color: "#c4c0ff", bg: "rgba(196,192,255,.1)", Icon: BookOpen },
  instructor: { label: "Instructor", color: "#45f1c5", bg: "rgba(69,241,197,.1)", Icon: Award },
  moderator: { label: "Moderator", color: "#FFB785", bg: "rgba(255,183,133,.1)", Icon: Shield },
  admin: { label: "Admin", color: "#FFD700", bg: "rgba(255,215,0,.1)", Icon: Crown },
};

const STATUS_CFG: Record<UserStatus, { label: string; color: string; bg: string; border: string }> = {
  active: { label: "Active", color: "#45f1c5", bg: "rgba(69,241,197,.12)", border: "rgba(69,241,197,.28)" },
  banned: { label: "Banned", color: "#ffb4ab", bg: "rgba(255,180,171,.12)", border: "rgba(255,180,171,.28)" },
  suspended: { label: "Suspended", color: "#FFB785", bg: "rgba(255,183,133,.12)", border: "rgba(255,183,133,.28)" },
};

function initials(name: string) {
  return name.split(" ").map((w) => w[0]?.toUpperCase() || "").slice(0, 2).join("");
}

// ==================== TOAST ====================
interface Toast {
  id: string;
  msg: string;
  type: "success" | "error" | "info";
}
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
        <div key={t.id} style={{ background: "rgba(26,26,46,.97)", border: `1px solid ${c[t.type]}40`, borderRadius: 14, padding: "11px 18px", color: c[t.type], fontSize: 13, fontWeight: 700, fontFamily: "Inter,sans-serif", boxShadow: `0 8px 30px rgba(0,0,0,.5)`, maxWidth: 340 }}>
          {t.msg}
        </div>
      ))}
    </div>
  );
}

// ==================== SECTION COMPONENT ====================
function Section({
  title,
  subtitle,
  icon: Icon,
  children,
  action,
}: {
  title: string;
  subtitle?: string;
  icon: React.ElementType;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div style={{ background: "rgba(26,26,46,.65)", border: "1px solid rgba(255,255,255,.06)", borderRadius: 22, overflow: "hidden", backdropFilter: "blur(14px)" }}>
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

// ==================== USER INFO FORM ====================
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

function UserInfoForm({
  user,
  isAdmin,
  onSave,
}: {
  user: AppUser;
  isAdmin: boolean;
  onSave: (fields: Partial<EditableUserFields>) => Promise<void>;
}) {
  const [form, setForm] = useState<EditableUserFields>({
    displayName: user.displayName,
    phone: user.phone || "",
    role: user.role,
    status: user.status,
    level: user.level,
    totalXP: user.totalXP,
    dailyGoalMinutes: user.dailyGoalMinutes,
    bio: user.bio || "",
  });
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

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
  const roleCfg = ROLE_CFG[form.role];
  const RoleIcon = roleCfg.Icon;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {/* Avatar + identity */}
      <div style={{ display: "flex", alignItems: "center", gap: 20, padding: "20px", background: "rgba(108,99,255,.06)", border: "1px solid rgba(108,99,255,.18)", borderRadius: 18 }}>
        <div style={{ position: "relative", flexShrink: 0 }}>
          <div
            style={{
              width: 80,
              height: 80,
              borderRadius: "50%",
              background: "linear-gradient(135deg,#6C63FF,#9B59B6)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 28,
              fontWeight: 900,
              color: "#fff",
              border: "3px solid rgba(196,192,255,.4)",
              boxShadow: "0 0 24px rgba(108,99,255,.3)",
            }}
          >
            {user.photoURL ? <img src={user.photoURL} alt="" style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" }} /> : user.displayName.charAt(0).toUpperCase()}
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
          <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#C7C4D8", marginBottom: 6 }}>Display Name</label>
          <input value={form.displayName} onChange={(e) => set("displayName", e.target.value)} style={{ width: "100%", background: "#0d0d18", border: "1px solid rgba(255,255,255,.08)", borderRadius: 10, padding: "9px 12px", color: "#E4E1EE", fontSize: 13 }} />
        </div>

        <div>
          <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#C7C4D8", marginBottom: 6 }}>Email (read-only)</label>
          <div style={{ position: "relative" }}>
            <input value={user.email} readOnly style={{ width: "100%", background: "#0a0a12", border: "1px solid rgba(255,255,255,.08)", borderRadius: 10, padding: "9px 12px", color: "#C7C4D8", cursor: "not-allowed" }} />
            <Lock size={12} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", color: "#47464f" }} />
          </div>
        </div>

        <div>
          <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#C7C4D8", marginBottom: 6 }}>Phone</label>
          <input value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+84..." style={{ width: "100%", background: "#0d0d18", border: "1px solid rgba(255,255,255,.08)", borderRadius: 10, padding: "9px 12px", color: "#E4E1EE", fontSize: 13 }} />
        </div>

        <div>
          <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#C7C4D8", marginBottom: 6 }}>Daily Goal (minutes)</label>
          <select value={form.dailyGoalMinutes} onChange={(e) => set("dailyGoalMinutes", Number(e.target.value))} style={{ width: "100%", background: "#0d0d18", border: "1px solid rgba(255,255,255,.08)", borderRadius: 10, padding: "9px 12px", color: "#E4E1EE" }}>
            {[5, 10, 15, 20, 30, 45, 60].map((m) => (
              <option key={m} value={m}>
                {m} minutes
              </option>
            ))}
          </select>
        </div>

        <div style={{ gridColumn: "1 / -1" }}>
          <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#C7C4D8", marginBottom: 6 }}>Bio</label>
          <textarea value={form.bio} onChange={(e) => set("bio", e.target.value)} rows={2} placeholder="Short bio…" style={{ width: "100%", background: "#0d0d18", border: "1px solid rgba(255,255,255,.08)", borderRadius: 10, padding: "9px 12px", color: "#E4E1EE", resize: "vertical" }} />
        </div>
      </div>

      {/* Admin-only fields */}
      <div style={{ padding: 16, background: "rgba(255,215,0,.05)", border: "1px solid rgba(255,215,0,.18)", borderRadius: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
          <Crown size={14} color="#FFD700" />
          <span style={{ fontSize: 12, fontWeight: 800, color: "#FFD700", textTransform: "uppercase" }}>Admin-only fields</span>
          {!isAdmin && <Lock size={12} color="#47464f" />}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, opacity: isAdmin ? 1 : 0.45, pointerEvents: isAdmin ? "auto" : "none" }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: "#C7C4D8", marginBottom: 6 }}>Role</label>
            <select value={form.role} onChange={(e) => set("role", e.target.value as UserRole)} style={{ width: "100%", background: "#0d0d18", border: "1px solid rgba(255,255,255,.08)", borderRadius: 10, padding: "9px 12px", color: "#E4E1EE" }}>
              <option value="student">Student</option>
              <option value="instructor">Instructor</option>
              <option value="moderator">Moderator</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: "#C7C4D8", marginBottom: 6 }}>Status</label>
            <select value={form.status} onChange={(e) => set("status", e.target.value as UserStatus)} style={{ width: "100%", background: "#0d0d18", border: "1px solid rgba(255,255,255,.08)", borderRadius: 10, padding: "9px 12px", color: "#E4E1EE" }}>
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
              <option value="banned">Banned</option>
            </select>
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: "#C7C4D8", marginBottom: 6 }}>Level</label>
            <input type="number" min={1} max={999} value={form.level} onChange={(e) => set("level", Number(e.target.value))} style={{ width: "100%", background: "#0d0d18", border: "1px solid rgba(255,255,255,.08)", borderRadius: 10, padding: "9px 12px", color: "#E4E1EE" }} />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: "#C7C4D8", marginBottom: 6 }}>Total XP</label>
            <input type="number" min={0} value={form.totalXP} onChange={(e) => set("totalXP", Number(e.target.value))} style={{ width: "100%", background: "#0d0d18", border: "1px solid rgba(255,255,255,.08)", borderRadius: 10, padding: "9px 12px", color: "#E4E1EE" }} />
          </div>
        </div>
      </div>

      {/* Save button */}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 12 }}>
        {dirty && (
          <button
            onClick={() => {
              setForm({
                displayName: user.displayName,
                phone: user.phone || "",
                role: user.role,
                status: user.status,
                level: user.level,
                totalXP: user.totalXP,
                dailyGoalMinutes: user.dailyGoalMinutes,
                bio: user.bio || "",
              });
              setDirty(false);
            }}
            style={{ padding: "10px 18px", borderRadius: 12, fontSize: 13, fontWeight: 600, cursor: "pointer", background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.1)", color: "#C7C4D8" }}
          >
            Discard
          </button>
        )}
        <button
          onClick={handleSave}
          disabled={!dirty || saving}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "10px 22px",
            borderRadius: 12,
            fontSize: 13,
            fontWeight: 800,
            cursor: !dirty || saving ? "not-allowed" : "pointer",
            background: dirty ? "linear-gradient(135deg,#6C63FF,#9B59B6)" : "rgba(255,255,255,.04)",
            border: "none",
            color: dirty ? "#fff" : "#47464f",
            boxShadow: dirty ? "0 0 20px rgba(108,99,255,.28)" : "none",
          }}
        >
          {saving ? <Loader size={14} style={{ animation: "spin .8s linear infinite" }} /> : <Save size={14} />}
          {saving ? "Saving..." : "Save changes"}
        </button>
      </div>
    </div>
  );
}

// ==================== PROGRESS COURSE LIST ====================
function ProgressCourseList({ enrollments, loading }: { enrollments: Enrollment[]; loading: boolean }) {
  if (loading)
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {[1, 2, 3].map((i) => (
          <div key={i} style={{ height: 74, borderRadius: 14, background: "linear-gradient(90deg,#1f1f2c 25%,#2a2935 50%,#1f1f2c 75%)", backgroundSize: "200% 100%", animation: "shimmer 1.4s infinite" }} />
        ))}
      </div>
    );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {enrollments.map((e) => {
        const catColors: Record<string, string> = {
          Development: "#6C63FF",
          Design: "#45f1c5",
          "Data Science": "#FFB785",
          Language: "#c4c0ff",
        };
        const accent = catColors[e.courseCategory] || "#C7C4D8";
        return (
          <div key={e.id} style={{ background: "rgba(255,255,255,.025)", border: "1px solid rgba(255,255,255,.07)", borderRadius: 16, padding: "14px 16px" }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
              <div style={{ width: 44, height: 44, borderRadius: 10, background: `${accent}22`, border: `1px solid ${accent}40`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <BookOpen size={18} color={accent} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#E4E1EE", flex: 1 }}>{e.courseTitle}</span>
                  {e.completed ? (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 8px", borderRadius: 999, background: "rgba(69,241,197,.12)", border: "1px solid rgba(69,241,197,.28)", color: "#45f1c5", fontSize: 10, fontWeight: 700 }}>
                      <CheckCircle size={9} /> Done
                    </span>
                  ) : (
                    <span style={{ fontSize: 12, fontWeight: 800, color: accent }}>{e.progress}%</span>
                  )}
                </div>
                <div style={{ width: "100%", height: 5, borderRadius: 99, background: "rgba(255,255,255,.08)", overflow: "hidden", marginBottom: 8 }}>
                  <div style={{ height: "100%", width: `${e.progress}%`, background: e.completed ? "linear-gradient(90deg,#45f1c5,#00A878)" : `linear-gradient(90deg,#6C63FF,${accent})`, borderRadius: 99 }} />
                </div>
                <div style={{ display: "flex", gap: 14, fontSize: 11, color: "#C7C4D8" }}>
                  <span>
                    {e.lessonsCompleted}/{e.totalLessons} lessons
                  </span>
                  <span style={{ display: "flex", alignItems: "center", gap: 3 }}>
                    <Zap size={10} color="#FFB785" /> +{e.xpEarned} XP
                  </span>
                  <span style={{ display: "flex", alignItems: "center", gap: 3 }}>
                    <Clock size={10} /> {timeAgo(e.lastStudied)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        );
      })}
      {enrollments.length === 0 && (
        <div style={{ textAlign: "center", padding: 32, color: "#47464f" }}>
          <BookOpen size={32} style={{ margin: "0 auto 10px" }} />
          <p>No enrolled courses yet</p>
        </div>
      )}
    </div>
  );
}

// ==================== ACHIEVEMENT GRID ====================
function AchievementGrid({ achievements }: { achievements: Achievement[] }) {
  const unlocked = achievements.filter((a) => a.isUnlocked).length;
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
        <div style={{ flex: 1, height: 5, borderRadius: 99, background: "rgba(255,255,255,.08)", overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${(unlocked / achievements.length) * 100}%`, background: "linear-gradient(90deg,#6C63FF,#00D4AA)", borderRadius: 99 }} />
        </div>
        <span style={{ fontSize: 12, fontWeight: 700, color: "#C7C4D8" }}>
          {unlocked}/{achievements.length} unlocked
        </span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12 }}>
        {achievements.map((a) => (
          <div
            key={a.id}
            style={{
              padding: "16px 10px",
              textAlign: "center",
              background: a.isUnlocked ? `${a.color}10` : "rgba(255,255,255,.025)",
              border: `1px solid ${a.isUnlocked ? `${a.color}35` : "rgba(255,255,255,.07)"}`,
              filter: a.isUnlocked ? "none" : "grayscale(.9)",
              opacity: a.isUnlocked ? 1 : 0.5,
              borderRadius: 16,
            }}
          >
            <div style={{ fontSize: 22, marginBottom: 8 }}>{a.icon}</div>
            <div style={{ fontSize: 10, fontWeight: 800, color: a.isUnlocked ? "#E4E1EE" : "#47464f" }}>{a.title}</div>
            <div style={{ fontSize: 10, fontWeight: 700, color: a.isUnlocked ? "#FFB785" : "#47464f", display: "flex", alignItems: "center", justifyContent: "center", gap: 3 }}>
              <Zap size={9} /> +{a.xpReward}
            </div>
            {a.isUnlocked && a.unlockedAt && <div style={{ fontSize: 9, color: "#C7C4D8", marginTop: 4 }}>{fmtDate(a.unlockedAt)}</div>}
            {!a.isUnlocked && <Lock size={12} color="#47464f" style={{ margin: "4px auto 0" }} />}
          </div>
        ))}
      </div>
    </div>
  );
}

// ==================== XP HISTORY CHART ====================
function XPHistoryChart({ chartData, logs, loading }: { chartData: { date: string; xp: number; cumulative: number }[]; logs: XPLogEntry[]; loading: boolean }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <div style={{ display: "flex", gap: 16, marginBottom: 12 }}>
          <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "#C7C4D8" }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: "#6C63FF" }} /> Monthly XP
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "#C7C4D8" }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: "#45f1c5" }} /> Cumulative
          </span>
        </div>
        <ResponsiveContainer width="100%" height={180}>
          <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
            <defs>
              <linearGradient id="gXP" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#6C63FF" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#6C63FF" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gCum" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#45f1c5" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#45f1c5" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.04)" vertical={false} />
            <XAxis dataKey="date" tick={{ fill: "#C7C4D8", fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: "#C7C4D8", fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                return (
                  <div style={{ background: "rgba(26,26,46,.97)", border: "1px solid rgba(255,255,255,.08)", borderRadius: 12, padding: "10px 14px", fontSize: 12 }}>
                    <p style={{ color: "#C7C4D8", marginBottom: 6, fontWeight: 700 }}>{label}</p>
                    <p style={{ color: "#6C63FF" }}>+{payload[0]?.value} XP this month</p>
                    <p style={{ color: "#45f1c5", marginTop: 2 }}>{payload[1]?.value} XP total</p>
                  </div>
                );
              }}
            />
            <Area type="monotone" dataKey="xp" stroke="#6C63FF" strokeWidth={2} fill="url(#gXP)" dot={false} />
            <Area type="monotone" dataKey="cumulative" stroke="#45f1c5" strokeWidth={2} fill="url(#gCum)" dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#C7C4D8", marginBottom: 12, textTransform: "uppercase", display: "flex", alignItems: "center", gap: 6 }}>
          <Activity size={13} /> Recent Activity
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 260, overflowY: "auto" }}>
          {loading
            ? [1, 2, 3, 4, 5].map((i) => <div key={i} style={{ height: 44, borderRadius: 10, background: "linear-gradient(90deg,#1f1f2c 25%,#2a2935 50%,#1f1f2c 75%)", backgroundSize: "200% 100%", animation: "shimmer 1.4s infinite" }} />)
            : logs.map((log) => {
                const cfg = XP_ACTIVITY_CFG[log.activityType];
                return (
                  <div key={log.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: 10, background: "rgba(255,255,255,.022)", border: "1px solid rgba(255,255,255,.06)" }}>
                    <span style={{ padding: "3px 8px", borderRadius: 999, background: cfg.bg, color: cfg.color, fontSize: 10, fontWeight: 700 }}>{cfg.label}</span>
                    <span style={{ flex: 1, fontSize: 12, color: "#C7C4D8", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{log.description}</span>
                    <span style={{ fontSize: 12, fontWeight: 800, color: "#45f1c5" }}>+{log.xpAmount}</span>
                    <span style={{ fontSize: 10, color: "#47464f", minWidth: 52, textAlign: "right" }}>{timeAgo(log.timestamp)}</span>
                  </div>
                );
              })}
        </div>
      </div>
    </div>
  );
}

// ==================== TRANSACTION TABLE ====================
function TransactionTable({ transactions, loading }: { transactions: Transaction[]; loading: boolean }) {
  const TX_CFG = {
    purchase: { label: "Purchase", color: "#6C63FF", bg: "rgba(108,99,255,.14)" },
    refund: { label: "Refund", color: "#ffb4ab", bg: "rgba(255,180,171,.14)" },
    bonus: { label: "Bonus", color: "#45f1c5", bg: "rgba(69,241,197,.14)" },
  };
  const ST_CFG = {
    completed: { label: "Completed", color: "#45f1c5" },
    pending: { label: "Pending", color: "#FFB785" },
    failed: { label: "Failed", color: "#ffb4ab" },
  };
  return (
    <div>
      <div style={{ display: "flex", gap: 16, marginBottom: 16, padding: "12px 16px", background: "rgba(108,99,255,.07)", borderRadius: 14 }}>
        {[
          { label: "Total Spent", val: `$${transactions.filter((t) => t.type === "purchase").reduce((s, t) => s + t.amount, 0)}`, color: "#c4c0ff" },
          { label: "Refunds", val: `$${Math.abs(transactions.filter((t) => t.type === "refund").reduce((s, t) => s + t.amount, 0))}`, color: "#ffb4ab" },
          { label: "Net Revenue", val: `$${transactions.reduce((s, t) => s + t.amount, 0)}`, color: "#45f1c5" },
          { label: "Courses Purchased", val: transactions.filter((t) => t.type === "purchase").length, color: "#FFB785" },
        ].map(({ label, val, color }) => (
          <div key={label} style={{ flex: 1, textAlign: "center" }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#C7C4D8", marginBottom: 4 }}>{label}</div>
            <div style={{ fontSize: 18, fontWeight: 800, color }}>{val}</div>
          </div>
        ))}
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 600 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid rgba(255,255,255,.06)" }}>
              {["Transaction ID", "Course", "Type", "Amount", "Method", "Status", "Date"].map((h) => (
                <th key={h} style={{ padding: "9px 12px", textAlign: "left", fontSize: 10, fontWeight: 700, color: "#C7C4D8" }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading
              ? [1, 2, 3, 4].map((i) => (
                  <tr key={i} style={{ borderBottom: "1px solid rgba(255,255,255,.04)" }}>
                    {[1, 2, 3, 4, 5, 6, 7].map((j) => (
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
                    <tr key={tx.id} style={{ borderBottom: "1px solid rgba(255,255,255,.04)" }}>
                      <td style={{ padding: "11px 12px" }}>
                        <code style={{ fontSize: 10, color: "#9B59B6", background: "rgba(108,99,255,.1)", padding: "2px 6px", borderRadius: 5 }}>{tx.id}</code>
                      </td>
                      <td style={{ padding: "11px 12px", fontSize: 12, fontWeight: 600, color: "#E4E1EE" }}>{tx.courseTitle}</td>
                      <td style={{ padding: "11px 12px" }}>
                        <span style={{ padding: "3px 9px", borderRadius: 999, background: tc.bg, color: tc.color, fontSize: 10, fontWeight: 700 }}>{tc.label}</span>
                      </td>
                      <td style={{ padding: "11px 12px", fontSize: 14, fontWeight: 800, color: tx.amount < 0 ? "#ffb4ab" : "#45f1c5" }}>{fmtMoney(tx.amount)}</td>
                      <td style={{ padding: "11px 12px", fontSize: 11, color: "#C7C4D8" }}>
                        <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                          <CreditCard size={11} /> {tx.paymentMethod}
                        </span>
                      </td>
                      <td style={{ padding: "11px 12px" }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: sc.color }}>{sc.label}</span>
                      </td>
                      <td style={{ padding: "11px 12px", fontSize: 11, color: "#C7C4D8" }}>{fmtDate(tx.createdAt)}</td>
                    </tr>
                  );
                })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ==================== QUICK STATS BAR ====================
function QuickStats({ user, enrollCount }: { user: AppUser; enrollCount: number }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 12 }}>
      {[
        { Icon: Zap, label: "Total XP", val: fmtNum(user.totalXP), color: "#FFB785" },
        { Icon: BarChart2, label: "Level", val: `Lv. ${user.level}`, color: "#e3dfff" },
        { Icon: Flame, label: "Streak", val: `${user.currentStreak}d`, color: "#ff6b6b" },
        { Icon: BookOpen, label: "Courses", val: enrollCount, color: "#45f1c5" },
        { Icon: Target, label: "Daily Goal", val: `${user.dailyGoalMinutes}m`, color: "#6C63FF" },
        { Icon: Trophy, label: "Best Streak", val: `${user.longestStreak}d`, color: "#FFD700" },
      ].map(({ Icon, label, val, color }) => (
        <div
          key={label}
          style={{ background: "rgba(26,26,46,.65)", border: "1px solid rgba(255,255,255,.06)", borderRadius: 16, padding: "14px", display: "flex", flexDirection: "column", gap: 8 }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <div style={{ width: 30, height: 30, borderRadius: 9, background: `${color}22`, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Icon size={15} color={color} />
            </div>
            <span style={{ fontSize: 10, fontWeight: 700, color: "#C7C4D8", textTransform: "uppercase" }}>{label}</span>
          </div>
          <span style={{ fontSize: 22, fontWeight: 900, color }}>{val}</span>
        </div>
      ))}
    </div>
  );
}

// ==================== TABS ====================
const TABS = [
  { id: "info", label: "User Info", Icon: User },
  { id: "courses", label: "Courses", Icon: BookOpen },
  { id: "achievements", label: "Achievements", Icon: Trophy },
  { id: "xp", label: "XP History", Icon: TrendingUp },
  { id: "transactions", label: "Transactions", Icon: DollarSign },
] as const;
type TabId = (typeof TABS)[number]["id"];

// ==================== MAIN COMPONENT ====================
export default function UserDetailAdmin() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabId>("info");
  const { toasts, add: toast } = useToast();

  // State for user data (realtime)
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastSync, setLastSync] = useState<Date | null>(null);

  // Related collections
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [enrollLoading, setEnrollLoading] = useState(true);
  const [xpLogs, setXpLogs] = useState<XPLogEntry[]>([]);
  const [xpLoading, setXpLoading] = useState(true);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [txLoading, setTxLoading] = useState(true);

  // Determine if current logged-in user is admin (you can get from auth context)
  const isAdmin = true; // TODO: replace with useIsAdmin() from auth

  // Redirect if no userId
  useEffect(() => {
    if (!userId) navigate("/admin/users");
  }, [userId, navigate]);

  // Realtime user document
  useEffect(() => {
    if (!userId) return;
    const userRef = doc(db, "users", userId);
    const unsubscribe = onSnapshot(
      userRef,
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          setUser({
            id: snap.id,
            displayName: data.displayName || data.name || "No name",
            email: data.email || "",
            phone: data.phone || "",
            photoURL: data.photoURL || null,
            role: data.role || "student",
            status: data.status || "active",
            level: data.level || 1,
            totalXP: data.totalXP || 0,
            currentStreak: data.currentStreak || 0,
            longestStreak: data.longestStreak || 0,
            dailyGoalMinutes: data.dailyGoalMinutes || 30,
            createdAt: data.createdAt?.toDate() || new Date(),
            lastActiveAt: data.lastActiveAt?.toDate() || new Date(),
            bio: data.bio || "",
          });
          setLastSync(new Date());
        } else {
          setError("User not found");
        }
        setLoading(false);
      },
      (err) => {
        console.error("UserDetail snapshot error:", err);
        setError(err.message);
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, [userId]);

  // Realtime enrollments (assuming subcollection or separate collection with userId field)
  useEffect(() => {
    if (!userId) return;
    const q = query(collection(db, "enrollments"), where("userId", "==", userId), orderBy("enrolledAt", "desc"));
    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        const data = snap.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
          lastStudied: doc.data().lastStudied?.toDate() || new Date(),
          enrolledAt: doc.data().enrolledAt?.toDate() || new Date(),
        })) as Enrollment[];
        setEnrollments(data);
        setEnrollLoading(false);
      },
      (err) => {
        console.error("Enrollments error:", err);
        setEnrollLoading(false);
      }
    );
    return () => unsubscribe();
  }, [userId]);

  // Realtime XP logs
  useEffect(() => {
    if (!userId) return;
    const q = query(collection(db, "xp_logs"), where("userId", "==", userId), orderBy("timestamp", "desc"), limit(50));
    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        const data = snap.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
          timestamp: doc.data().timestamp?.toDate() || new Date(),
        })) as XPLogEntry[];
        setXpLogs(data);
        setXpLoading(false);
      },
      (err) => {
        console.error("XP logs error:", err);
        setXpLoading(false);
      }
    );
    return () => unsubscribe();
  }, [userId]);

  // Realtime achievements (assume subcollection or separate)
  useEffect(() => {
    if (!userId) return;
    const q = query(collection(db, "achievements"), where("userId", "==", userId));
    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        const data = snap.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
          unlockedAt: doc.data().unlockedAt?.toDate(),
        })) as Achievement[];
        setAchievements(data);
      },
      (err) => console.error("Achievements error:", err)
    );
    return () => unsubscribe();
  }, [userId]);

  // Realtime transactions
  useEffect(() => {
    if (!userId) return;
    const q = query(collection(db, "transactions"), where("userId", "==", userId), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        const data = snap.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate() || new Date(),
        })) as Transaction[];
        setTransactions(data);
        setTxLoading(false);
      },
      (err) => {
        console.error("Transactions error:", err);
        setTxLoading(false);
      }
    );
    return () => unsubscribe();
  }, [userId]);

  // Build XP chart data (mock for now, but you can aggregate from xpLogs)
  const xpChartData = useMemo(() => {
    // Generate last 6 months from logs or fallback
    const months = ["Oct", "Nov", "Dec", "Jan", "Feb", "Mar", "Apr"];
    let cumulative = 0;
    return months.map((month, idx) => {
      const monthly = xpLogs.filter((log) => log.timestamp.toLocaleString("default", { month: "short" }) === month).reduce((s, l) => s + l.xpAmount, 0);
      cumulative += monthly;
      return { date: month, xp: monthly, cumulative };
    });
  }, [xpLogs]);

  // Save handler
  const handleSave = useCallback(
    async (fields: Partial<EditableUserFields>) => {
      if (!userId) return;
      try {
        const updateData: any = { ...fields, updatedAt: serverTimestamp() };
        // Convert xp -> totalXP if needed
        if (fields.totalXP !== undefined) updateData.totalXP = fields.totalXP;
        if (fields.displayName !== undefined) updateData.displayName = fields.displayName;
        if (fields.phone !== undefined) updateData.phone = fields.phone;
        if (fields.role !== undefined) updateData.role = fields.role;
        if (fields.status !== undefined) updateData.status = fields.status;
        if (fields.level !== undefined) updateData.level = fields.level;
        if (fields.dailyGoalMinutes !== undefined) updateData.dailyGoalMinutes = fields.dailyGoalMinutes;
        if (fields.bio !== undefined) updateData.bio = fields.bio;

        await updateDoc(doc(db, "users", userId), updateData);
        toast(`User "${fields.displayName || user?.displayName}" updated ✓`);
      } catch (err: any) {
        toast(`Update failed: ${err.message}`, "error");
      }
    },
    [userId, user, toast]
  );

  // Ban/unban from detail page
  const handleBanToggle = async () => {
    if (!user) return;
    if (user.status === "banned") {
      await restoreUser(user.id);
      toast("User unbanned", "success");
    } else {
      await banUser(user.id, "Banned from detail page", false);
      toast("User banned", "warning");
    }
  };

  if (loading)
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "80vh" }}>
        <Loader size={32} style={{ animation: "spin 1s linear infinite" }} color="#6C63FF" />
      </div>
    );
  if (error || !user)
    return (
      <div style={{ textAlign: "center", padding: 40, color: "#ffb4ab" }}>
        <AlertTriangle size={32} /> <p>{error || "User not found"}</p>
        <button onClick={() => navigate("/admin/users")} style={{ marginTop: 16 }}>
          ← Back to users
        </button>
      </div>
    );

  return (
    <div style={{ minHeight: "100vh", background: "#0F0F1A", color: "#E4E1EE", fontFamily: "Inter,sans-serif" }}>
      <style>
        {`
          @keyframes spin { to { transform: rotate(360deg); } }
          @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
        `}
      </style>

      {/* Sticky header */}
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 50,
          background: "rgba(15,15,26,.92)",
          backdropFilter: "blur(18px)",
          borderBottom: "1px solid rgba(255,255,255,.06)",
        }}
      >
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "12px 24px", display: "flex", alignItems: "center", gap: 16 }}>
          <button
            onClick={() => navigate("/admin/users")}
            style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.08)", borderRadius: 10, padding: "8px 14px", color: "#C7C4D8", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
          >
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
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#45f1c5", display: "inline-block" }} />
                Live · {lastSync.toLocaleTimeString()}
              </span>
            )}
            <button
              onClick={handleBanToggle}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "7px 14px",
                borderRadius: 10,
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                background: user.status === "banned" ? "rgba(69,241,197,.08)" : "rgba(255,180,171,.08)",
                border: user.status === "banned" ? "1px solid rgba(69,241,197,.2)" : "1px solid rgba(255,180,171,.2)",
                color: user.status === "banned" ? "#45f1c5" : "#ffb4ab",
              }}
            >
              <ShieldOff size={13} /> {user.status === "banned" ? "Unban" : "Ban"} User
            </button>
          </div>
        </div>
      </header>

      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "28px 24px", display: "flex", flexDirection: "column", gap: 24 }}>
        <QuickStats user={user} enrollCount={enrollments.length} />

        {/* Tabs */}
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
                  flex: 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  padding: "10px 12px",
                  borderRadius: 10,
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: "pointer",
                  background: activeTab === id ? "linear-gradient(135deg,#6C63FF,#9B59B6)" : "transparent",
                  border: activeTab === id ? "1px solid rgba(108,99,255,.3)" : "1px solid transparent",
                  color: activeTab === id ? "#fff" : "#C7C4D8",
                  boxShadow: activeTab === id ? "0 0 16px rgba(108,99,255,.25)" : "none",
                }}
              >
                <Icon size={14} /> {label}
                {badges[id] !== undefined && (
                  <span
                    style={{
                      background: activeTab === id ? "rgba(255,255,255,.25)" : "rgba(108,99,255,.3)",
                      color: activeTab === id ? "#fff" : "#c4c0ff",
                      fontSize: 10,
                      fontWeight: 800,
                      padding: "1px 7px",
                      borderRadius: 999,
                    }}
                  >
                    {badges[id]}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Tab content */}
        {activeTab === "info" && (
          <div>
            <Section
              title="User Profile"
              subtitle={`Firestore: users/${user.id} · ${isAdmin ? "Admin edit enabled" : "Read-only"}`}
              icon={User}
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
          <Section title="Enrolled Courses" subtitle={`${enrollments.length} courses`} icon={BookOpen}>
            <ProgressCourseList enrollments={enrollments} loading={enrollLoading} />
          </Section>
        )}

        {activeTab === "achievements" && (
          <Section title="Achievements" subtitle={`${achievements.filter((a) => a.isUnlocked).length}/${achievements.length} unlocked`} icon={Trophy}>
            <AchievementGrid achievements={achievements} />
          </Section>
        )}

        {activeTab === "xp" && (
          <Section title="XP History" subtitle="From xp_logs collection" icon={TrendingUp} action={<span>Total: {fmtNum(user.totalXP)} XP</span>}>
            <XPHistoryChart chartData={xpChartData} logs={xpLogs} loading={xpLoading} />
          </Section>
        )}

        {activeTab === "transactions" && (
          <Section title="Transaction History" subtitle={`${transactions.length} transactions`} icon={DollarSign}>
            <TransactionTable transactions={transactions} loading={txLoading} />
          </Section>
        )}
      </div>
      <ToastContainer toasts={toasts} />
    </div>
  );
}
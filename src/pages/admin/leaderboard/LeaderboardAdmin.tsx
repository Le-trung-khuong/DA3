/**
 * Smart Review — Admin Leaderboard Manager
 * React + TypeScript + Firebase SDK v9+
 *
 * File: src/pages/admin/LeaderboardAdmin.tsx
 *
 * Features:
 *   - Realtime top-100 leaderboard (all-time XP + this month)
 *   - Virtual scroll via windowed list (manual implementation)
 *   - Adjust XP (Firebase transaction → users.xp + xp_logs entry)
 *   - XP history per user (from xp_logs)
 *   - Event control cards (Double XP Week, etc.)
 *   - Event toggle → updates events collection
 *   - Active event badge + countdown timer
 *
 * Firestore:
 *   users           → { uid, displayName, xp, level, ... }
 *   xp_logs         → { userId, amount, reason, createdAt }
 *   events          → { name, type, isActive, multiplier, startDate, endDate }
 *
 * Production split:
 *   hooks/useLeaderboard.ts
 *   hooks/useXPLogs.ts
 *   hooks/useEvents.ts
 *   components/admin/leaderboard/LeaderboardTable.tsx
 *   components/admin/leaderboard/XPAdjustmentModal.tsx
 *   components/admin/leaderboard/XPHistoryModal.tsx
 *   components/admin/leaderboard/EventControlCard.tsx
 *
 * Dependencies: firebase  lucide-react
 */

"use client";

import React, {
  useState, useEffect, useCallback, useMemo,
  useRef, type ReactNode,
} from "react";

// ─── Firebase (uncomment in production) ─────────────────────────────────────
// import { db } from "@/lib/firebase";
// import {
//   collection, query, orderBy, limit, onSnapshot,
//   doc, runTransaction, addDoc, updateDoc,
//   serverTimestamp, Timestamp, where, getDocs,
// } from "firebase/firestore";

// ─── Lucide icons ─────────────────────────────────────────────────────────────
import {
  Zap, Trophy, Crown, Star, TrendingUp, TrendingDown,
  Flame, Plus, Minus, History, Calendar, Clock,
  RefreshCw, AlertTriangle, Loader, X, Check,
  ChevronDown, Users, Activity, Edit3, BarChart2,
  Sparkles, Shield, Play, Pause, Settings,
  ChevronLeft, ChevronRight, Info, Save,
} from "lucide-react";

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

interface LeaderboardUser {
  uid: string;
  displayName: string;
  email: string;
  photoURL?: string;
  xp: number;
  level: number;
  currentStreak: number;
  role: string;
  monthlyXP?: number; // computed from xp_logs
  rank?: number;
  prevRank?: number;
}

interface XPLogEntry {
  id: string;
  userId: string;
  amount: number;
  reason: string;
  createdAt: Date;
  adminNote?: string;
  activityType: "admin_adjust" | "lesson_complete" | "daily_streak" | "achievement" | "quiz_pass" | "bonus";
}

interface GameEvent {
  id: string;
  name: string;
  type: "double_xp" | "triple_xp" | "streak_bonus" | "flash_sale" | "custom";
  isActive: boolean;
  multiplier: number;
  startDate: Date;
  endDate: Date;
  description: string;
  color: string;
  icon: string;
}

type LeaderboardTab = "alltime" | "monthly";
type SortMode = "xp" | "level" | "streak";

// ═══════════════════════════════════════════════════════════════════════════
// MOCK DATA
// ═══════════════════════════════════════════════════════════════════════════

const now = new Date();
const daysAgo  = (d: number) => new Date(now.getTime() - d * 864e5);
const daysLater = (d: number) => new Date(now.getTime() + d * 864e5);

const RAW_USERS: Omit<LeaderboardUser, "rank" | "prevRank">[] = [
  { uid: "u001", displayName: "Hoàng Tuấn",       email: "hoang@gmail.com",    xp: 28400, level: 55, currentStreak: 21, role: "student",    monthlyXP: 3200 },
  { uid: "u002", displayName: "Sarah Drasner",     email: "sarah@edu.io",       xp: 24800, level: 50, currentStreak: 30, role: "instructor", monthlyXP: 2800 },
  { uid: "u003", displayName: "Linh Nguyễn",       email: "linh@gmail.com",     xp: 21200, level: 44, currentStreak: 14, role: "student",    monthlyXP: 3800 },
  { uid: "u004", displayName: "Mod Đình Long",     email: "mod@sr.io",          xp: 19600, level: 42, currentStreak: 18, role: "moderator",  monthlyXP: 2100 },
  { uid: "u005", displayName: "Võ Thị Hoa",        email: "hoa@edu.io",         xp: 17100, level: 38, currentStreak: 10, role: "instructor", monthlyXP: 1900 },
  { uid: "u006", displayName: "Lê Trung Khương",   email: "khuong@gmail.com",   xp: 14500, level: 35, currentStreak:  9, role: "student",    monthlyXP: 2600 },
  { uid: "u007", displayName: "Trần Linh Nhi",     email: "nhi@gmail.com",      xp: 12800, level: 32, currentStreak:  7, role: "student",    monthlyXP: 1500 },
  { uid: "u008", displayName: "Mai Văn",            email: "mai@example.com",    xp: 11500, level: 30, currentStreak:  5, role: "student",    monthlyXP: 1200 },
  { uid: "u009", displayName: "Ngô Phạm Viết Long",email: "long@gmail.com",     xp: 10200, level: 28, currentStreak:  3, role: "student",    monthlyXP: 1800 },
  { uid: "u010", displayName: "Phạm Quân Đức",     email: "quan@gmail.com",     xp:  9400, level: 26, currentStreak:  4, role: "student",    monthlyXP:  900 },
  { uid: "u011", displayName: "Nguyễn Mai Vy",     email: "vy@gmail.com",       xp:  8200, level: 24, currentStreak:  2, role: "student",    monthlyXP: 1100 },
  { uid: "u012", displayName: "Bích Nguyễn",       email: "bich@gmail.com",     xp:  7600, level: 22, currentStreak:  6, role: "student",    monthlyXP:  800 },
  { uid: "u013", displayName: "Lê Minh Huy",       email: "huy@gmail.com",      xp:  6900, level: 20, currentStreak:  1, role: "student",    monthlyXP:  650 },
  { uid: "u014", displayName: "Cao Thị Lan",       email: "lan@gmail.com",      xp:  5800, level: 18, currentStreak:  0, role: "student",    monthlyXP:  420 },
  { uid: "u015", displayName: "Đặng Văn Khoa",     email: "khoa@gmail.com",     xp:  4900, level: 16, currentStreak:  8, role: "student",    monthlyXP:  980 },
  ...Array.from({ length: 85 }, (_, i) => ({
    uid: `u${String(i + 16).padStart(3, "0")}`,
    displayName: `Học viên ${i + 16}`,
    email: `user${i + 16}@example.com`,
    xp: Math.max(200, 4500 - (i + 1) * 45),
    level: Math.max(1, 15 - Math.floor(i / 6)),
    currentStreak: Math.floor(Math.random() * 10),
    role: "student",
    monthlyXP: Math.max(50, 900 - (i + 1) * 9),
  })),
];

const MOCK_USERS: LeaderboardUser[] = RAW_USERS.map((u, i) => ({ ...u, rank: i + 1, prevRank: i + 1 + (Math.random() > 0.5 ? 1 : -1) * Math.floor(Math.random() * 3) }));

const MOCK_XP_LOGS: XPLogEntry[] = [
  { id: "xl1", userId: "u001", amount:  150, reason: "Hoàn thành bài: Concurrent Rendering",  activityType: "lesson_complete", createdAt: daysAgo(0) },
  { id: "xl2", userId: "u001", amount:   50, reason: "Streak 21 ngày liên tiếp",               activityType: "daily_streak",    createdAt: daysAgo(0) },
  { id: "xl3", userId: "u001", amount:  500, reason: "Admin: Thưởng tham gia beta test",        activityType: "admin_adjust",    createdAt: daysAgo(1), adminNote: "Beta tester reward" },
  { id: "xl4", userId: "u001", amount: -200, reason: "Admin: Điều chỉnh điểm sai",             activityType: "admin_adjust",    createdAt: daysAgo(2), adminNote: "Fixed duplicate XP" },
  { id: "xl5", userId: "u001", amount:  200, reason: "Perfect score: Module 3 Quiz",            activityType: "quiz_pass",       createdAt: daysAgo(3) },
  { id: "xl6", userId: "u001", amount:  300, reason: "Achievement: XP Collector",               activityType: "achievement",     createdAt: daysAgo(7) },
  { id: "xl7", userId: "u002", amount:  250, reason: "Hoàn thành Module: State Management",    activityType: "lesson_complete", createdAt: daysAgo(0) },
  { id: "xl8", userId: "u003", amount: 1000, reason: "Admin: Bonus tháng xuất sắc",            activityType: "admin_adjust",    createdAt: daysAgo(2), adminNote: "Monthly top performer" },
];

const MOCK_EVENTS: GameEvent[] = [
  { id: "ev1", name: "Double XP Week", type: "double_xp", isActive: true,  multiplier: 2, startDate: daysAgo(2),  endDate: daysLater(5),  description: "Tất cả XP từ bài học được nhân đôi", color: "#45f1c5", icon: "⚡" },
  { id: "ev2", name: "Streak Bonus",   type: "streak_bonus", isActive: false, multiplier: 1.5, startDate: daysAgo(10), endDate: daysAgo(3), description: "Streak bonus +50% cho tất cả người dùng", color: "#FFB785", icon: "🔥" },
  { id: "ev3", name: "Flash Triple XP",type: "triple_xp",  isActive: false, multiplier: 3, startDate: daysLater(7), endDate: daysLater(8), description: "24 giờ XP nhân 3 – Sắp ra mắt!", color: "#c4c0ff", icon: "💎" },
];

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

const fmtNum = (n: number) => new Intl.NumberFormat("vi-VN").format(n);
const fmtDate = (d: Date) => d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
const fmtRelative = (d: Date) => {
  const s = (Date.now() - d.getTime()) / 1000;
  if (s < 60)    return "vừa xong";
  if (s < 3600)  return `${Math.floor(s / 60)}p trước`;
  if (s < 86400) return `${Math.floor(s / 3600)}h trước`;
  return `${Math.floor(s / 86400)}d trước`;
};

const ROLE_GRAD: Record<string, string> = {
  student:    "linear-gradient(135deg,#6C63FF,#9B59B6)",
  instructor: "linear-gradient(135deg,#00D4AA,#0F9E7B)",
  moderator:  "linear-gradient(135deg,#FFB785,#FF8C42)",
  admin:      "linear-gradient(135deg,#FFD700,#FF8C42)",
};
function initials(n: string) {
  return n.split(" ").map((w) => w[0]?.toUpperCase() ?? "").slice(0, 2).join("");
}

const ACTIVITY_CFG = {
  admin_adjust:    { label: "Admin",      color: "#c4c0ff", bg: "rgba(196,192,255,.14)" },
  lesson_complete: { label: "Bài học",    color: "#6C63FF", bg: "rgba(108,99,255,.14)"  },
  daily_streak:    { label: "Streak",     color: "#FFB785", bg: "rgba(255,183,133,.14)" },
  achievement:     { label: "Thành tích", color: "#FFD700", bg: "rgba(255,215,0,.14)"   },
  quiz_pass:       { label: "Quiz",       color: "#45f1c5", bg: "rgba(69,241,197,.14)"  },
  bonus:           { label: "Bonus",      color: "#ff6b6b", bg: "rgba(255,107,107,.14)" },
};

const MEDAL: Record<number, { bg: string; color: string; shadow: string; emoji: string }> = {
  1: { bg: "linear-gradient(135deg,#FFD700,#FFA500)", color: "#fff", shadow: "0 0 20px rgba(255,215,0,.4)",  emoji: "🥇" },
  2: { bg: "linear-gradient(135deg,#C0C0C0,#A8A8A8)", color: "#fff", shadow: "0 0 14px rgba(192,192,192,.3)", emoji: "🥈" },
  3: { bg: "linear-gradient(135deg,#CD7F32,#A0522D)", color: "#fff", shadow: "0 0 14px rgba(205,127,50,.3)",  emoji: "🥉" },
};

function useCountdown(endDate: Date) {
  const [remaining, setRemaining] = useState<string>("");
  useEffect(() => {
    const tick = () => {
      const diff = endDate.getTime() - Date.now();
      if (diff <= 0) { setRemaining("Đã kết thúc"); return; }
      const d = Math.floor(diff / 864e5);
      const h = Math.floor((diff % 864e5) / 36e5);
      const m = Math.floor((diff % 36e5) / 6e4);
      const s = Math.floor((diff % 6e4) / 1e3);
      setRemaining(d > 0 ? `${d}d ${h}h ${m}m` : `${h}h ${m}m ${s}s`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [endDate]);
  return remaining;
}

// ═══════════════════════════════════════════════════════════════════════════
// SHARED STYLES
// ═══════════════════════════════════════════════════════════════════════════

const IS: React.CSSProperties = {
  width: "100%", background: "#0c0b16",
  border: "1px solid rgba(255,255,255,.08)",
  borderRadius: 12, padding: "10px 14px",
  color: "#E4E1EE", fontSize: 13,
  outline: "none", fontFamily: "'Space Grotesk', sans-serif",
  transition: "border-color .2s, box-shadow .2s",
};
const fo = (e: React.FocusEvent<any>) => { e.target.style.borderColor="rgba(108,99,255,.55)"; e.target.style.boxShadow="0 0 0 3px rgba(108,99,255,.1)"; };
const bl = (e: React.FocusEvent<any>) => { e.target.style.borderColor="rgba(255,255,255,.08)"; e.target.style.boxShadow="none"; };

// ═══════════════════════════════════════════════════════════════════════════
// TOAST
// ═══════════════════════════════════════════════════════════════════════════

interface Toast { id: string; msg: string; type: "success"|"error"|"info"|"warning"; }
function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const add = useCallback((msg: string, type: Toast["type"] = "success") => {
    const id = Math.random().toString(36).slice(2);
    setToasts(t => [...t, { id, msg, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3500);
  }, []);
  return { toasts, add };
}
function ToastContainer({ toasts }: { toasts: Toast[] }) {
  const c: Record<string, string> = { success:"#45f1c5", error:"#ffb4ab", info:"#c4c0ff", warning:"#FFB785" };
  return (
    <div style={{ position:"fixed", bottom:24, right:24, zIndex:99999, display:"flex", flexDirection:"column", gap:10, pointerEvents:"none" }}>
      {toasts.map(t => (
        <div key={t.id} style={{ background:"rgba(12,11,22,.98)", border:`1px solid ${c[t.type]}40`, borderRadius:14, padding:"11px 18px", color:c[t.type], fontSize:13, fontWeight:600, boxShadow:`0 8px 30px rgba(0,0,0,.5)`, maxWidth:360, animation:"slideInR .25s ease" }}>
          {t.msg}
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT: XPAdjustmentModal
// ═══════════════════════════════════════════════════════════════════════════

interface XPAdjustmentModalProps {
  user: LeaderboardUser;
  activeEvent?: GameEvent | null;
  onConfirm: (amount: number, reason: string) => Promise<void>;
  onClose: () => void;
}

function XPAdjustmentModal({ user, activeEvent, onConfirm, onClose }: XPAdjustmentModalProps) {
  const [amount,  setAmount]  = useState("");
  const [reason,  setReason]  = useState("");
  const [mode,    setMode]    = useState<"add" | "sub">("add");
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState("");

  const finalAmount = mode === "add" ? Math.abs(Number(amount)) : -Math.abs(Number(amount));
  const newXP = user.xp + finalAmount;
  const isValid = amount !== "" && !isNaN(Number(amount)) && Number(amount) > 0 && reason.trim().length >= 3;

  const handleSubmit = async () => {
    if (!isValid) { setError("Nhập số XP và lý do (≥3 ký tự)"); return; }
    setSaving(true);
    try {
      await onConfirm(finalAmount, reason.trim());
      onClose();
    } catch (e: any) {
      setError(e.message ?? "Lỗi không xác định");
      setSaving(false);
    }
  };

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.72)", backdropFilter:"blur(8px)", zIndex:9999, display:"flex", alignItems:"center", justifyContent:"center", padding:20 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ width:"100%", maxWidth:420, background:"rgba(12,11,22,.98)", border:"1px solid rgba(255,255,255,.1)", borderRadius:24, boxShadow:"0 24px 80px rgba(0,0,0,.6)", animation:"scaleIn .2s ease", overflow:"hidden" }}>
        {/* Header */}
        <div style={{ padding:"18px 22px", borderBottom:"1px solid rgba(255,255,255,.07)", display:"flex", alignItems:"center", gap:12 }}>
          <div style={{ width:40, height:40, borderRadius:12, background:"linear-gradient(135deg,#6C63FF,#9B59B6)", display:"flex", alignItems:"center", justifyContent:"center" }}>
            <Zap size={18} color="#fff" />
          </div>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:15, fontWeight:700, color:"#E4E1EE" }}>Điều chỉnh XP</div>
            <div style={{ fontSize:11, color:"#C7C4D8", marginTop:1 }}>Firebase Transaction → users.xp + xp_logs</div>
          </div>
          <button onClick={onClose} style={{ width:30, height:30, borderRadius:9, background:"rgba(255,255,255,.05)", border:"1px solid rgba(255,255,255,.08)", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", color:"#C7C4D8" }}>
            <X size={14} />
          </button>
        </div>

        <div style={{ padding:22, display:"flex", flexDirection:"column", gap:16 }}>
          {/* User card */}
          <div style={{ display:"flex", alignItems:"center", gap:12, padding:"12px 14px", background:"rgba(255,255,255,.03)", border:"1px solid rgba(255,255,255,.07)", borderRadius:14 }}>
            <div style={{ width:38, height:38, borderRadius:"50%", background:ROLE_GRAD[user.role] ?? ROLE_GRAD.student, display:"flex", alignItems:"center", justifyContent:"center", fontSize:13, fontWeight:800, color:"#fff", flexShrink:0 }}>
              {initials(user.displayName)}
            </div>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:13, fontWeight:700, color:"#E4E1EE" }}>{user.displayName}</div>
              <div style={{ fontSize:11, color:"#C7C4D8" }}>{user.email}</div>
            </div>
            <div style={{ textAlign:"right" }}>
              <div style={{ fontSize:16, fontWeight:800, color:"#FFB785", display:"flex", alignItems:"center", gap:4 }}>
                <Zap size={13} fill="#FFB785" />{fmtNum(user.xp)}
              </div>
              <div style={{ fontSize:10, color:"#C7C4D8" }}>Lv. {user.level}</div>
            </div>
          </div>

          {/* Active event warning */}
          {activeEvent && (
            <div style={{ display:"flex", gap:8, padding:"10px 12px", background:`${activeEvent.color}14`, border:`1px solid ${activeEvent.color}35`, borderRadius:12 }}>
              <Sparkles size={14} color={activeEvent.color} style={{ flexShrink:0, marginTop:1 }} />
              <span style={{ fontSize:11, color:activeEvent.color, lineHeight:1.6 }}>
                <strong>{activeEvent.name}</strong> đang hoạt động (x{activeEvent.multiplier}). XP thực tế = số nhập × {activeEvent.multiplier}.
              </span>
            </div>
          )}

          {/* Mode toggle */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
            {(["add","sub"] as const).map(m => (
              <button key={m} onClick={() => setMode(m)}
                style={{ padding:"10px", borderRadius:12, cursor:"pointer", fontWeight:700, fontSize:13, display:"flex", alignItems:"center", justifyContent:"center", gap:7, transition:"all .15s", background:mode===m?(m==="add"?"rgba(69,241,197,.14)":"rgba(255,180,171,.14)"):"rgba(255,255,255,.04)", border:`1px solid ${mode===m?(m==="add"?"rgba(69,241,197,.35)":"rgba(255,180,171,.35)"):"rgba(255,255,255,.07)"}`, color:mode===m?(m==="add"?"#45f1c5":"#ffb4ab"):"#C7C4D8" }}>
                {m==="add" ? <><Plus size={14} /> Cộng XP</> : <><Minus size={14} /> Trừ XP</>}
              </button>
            ))}
          </div>

          {/* Amount input */}
          <div>
            <label style={{ fontSize:11, fontWeight:700, color:"#C7C4D8", letterSpacing:".07em", textTransform:"uppercase", display:"block", marginBottom:7 }}>
              Số XP <span style={{ color:"#ffb4ab" }}>*</span>
            </label>
            <div style={{ position:"relative" }}>
              <span style={{ position:"absolute", left:12, top:"50%", transform:"translateY(-50%)", fontWeight:800, fontSize:16, color:mode==="add"?"#45f1c5":"#ffb4ab" }}>
                {mode === "add" ? "+" : "−"}
              </span>
              <input type="number" min={1} max={99999} value={amount}
                onChange={e => { setAmount(e.target.value); setError(""); }}
                placeholder="0" autoFocus
                style={{ ...IS, paddingLeft:32, fontSize:16, fontWeight:700 }}
                onFocus={fo} onBlur={bl} />
            </div>
            {/* Preview new XP */}
            {amount && !isNaN(Number(amount)) && (
              <div style={{ display:"flex", alignItems:"center", gap:6, marginTop:6, fontSize:12, color:"#C7C4D8" }}>
                <span>Sau điều chỉnh:</span>
                <span style={{ fontWeight:800, color: newXP >= user.xp ? "#45f1c5" : "#ffb4ab" }}>
                  {fmtNum(user.xp)} → {fmtNum(Math.max(0, newXP))} XP
                </span>
                {newXP < 0 && <span style={{ color:"#ffb4ab", fontSize:11 }}>(tối thiểu 0)</span>}
              </div>
            )}
          </div>

          {/* Reason */}
          <div>
            <label style={{ fontSize:11, fontWeight:700, color:"#C7C4D8", letterSpacing:".07em", textTransform:"uppercase", display:"block", marginBottom:7 }}>
              Lý do <span style={{ color:"#ffb4ab" }}>*</span>
            </label>
            <input value={reason} onChange={e => { setReason(e.target.value); setError(""); }}
              placeholder="e.g. Thưởng tham gia beta test, Điều chỉnh lỗi hệ thống…"
              style={IS} onFocus={fo} onBlur={bl} />
          </div>

          {error && <p style={{ fontSize:12, color:"#ffb4ab", display:"flex", alignItems:"center", gap:6 }}><AlertTriangle size={13} /> {error}</p>}

          {/* Info */}
          <div style={{ padding:"10px 12px", background:"rgba(108,99,255,.07)", border:"1px solid rgba(108,99,255,.18)", borderRadius:12, fontSize:11, color:"#9B59B6", display:"flex", gap:8, alignItems:"flex-start" }}>
            <Info size={12} style={{ flexShrink:0, marginTop:1 }} />
            <div>Firebase Transaction: cập nhật <code style={{ color:"#c4c0ff" }}>users/{user.uid}/xp</code> đồng thời ghi <code style={{ color:"#c4c0ff" }}>xp_logs</code> để tránh race condition.</div>
          </div>

          {/* Actions */}
          <div style={{ display:"flex", gap:10 }}>
            <button onClick={onClose} style={{ flex:1, padding:"11px", borderRadius:13, fontSize:13, fontWeight:600, cursor:"pointer", background:"rgba(255,255,255,.05)", border:"1px solid rgba(255,255,255,.1)", color:"#C7C4D8" }}>
              Hủy
            </button>
            <button onClick={handleSubmit} disabled={!isValid || saving}
              style={{ flex:2, padding:"11px", borderRadius:13, fontSize:13, fontWeight:800, cursor:(!isValid||saving)?"not-allowed":"pointer", background:isValid?"linear-gradient(135deg,#6C63FF,#9B59B6)":"rgba(255,255,255,.04)", border:"none", color:isValid?"#fff":"#47464f", boxShadow:isValid?"0 0 18px rgba(108,99,255,.28)":"none", display:"flex", alignItems:"center", justifyContent:"center", gap:8, opacity:saving?.75:1, transition:"all .2s" }}>
              {saving ? <><Loader size={14} style={{ animation:"spin .8s linear infinite" }} /> Đang lưu…</> : <><Save size={14} /> Xác nhận</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT: XPHistoryModal
// ═══════════════════════════════════════════════════════════════════════════

function XPHistoryModal({ user, logs, onClose }: { user: LeaderboardUser; logs: XPLogEntry[]; onClose: () => void }) {
  const userLogs = useMemo(() => logs.filter(l => l.userId === user.uid).sort((a,b) => b.createdAt.getTime() - a.createdAt.getTime()), [logs, user.uid]);
  const totalPositive = userLogs.reduce((s,l) => l.amount > 0 ? s + l.amount : s, 0);
  const totalNegative = userLogs.reduce((s,l) => l.amount < 0 ? s + Math.abs(l.amount) : s, 0);

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.72)", backdropFilter:"blur(8px)", zIndex:9999, display:"flex", alignItems:"center", justifyContent:"center", padding:20 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ width:"100%", maxWidth:560, maxHeight:"88vh", display:"flex", flexDirection:"column", background:"rgba(12,11,22,.98)", border:"1px solid rgba(255,255,255,.08)", borderRadius:24, boxShadow:"0 24px 80px rgba(0,0,0,.6)", animation:"scaleIn .2s ease", overflow:"hidden" }}>
        {/* Header */}
        <div style={{ padding:"18px 22px", borderBottom:"1px solid rgba(255,255,255,.07)", display:"flex", alignItems:"center", gap:12, flexShrink:0 }}>
          <div style={{ width:40, height:40, borderRadius:"50%", background:ROLE_GRAD[user.role] ?? ROLE_GRAD.student, display:"flex", alignItems:"center", justifyContent:"center", fontSize:13, fontWeight:800, color:"#fff" }}>
            {initials(user.displayName)}
          </div>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:15, fontWeight:700, color:"#E4E1EE" }}>Lịch sử XP — {user.displayName}</div>
            <div style={{ fontSize:11, color:"#C7C4D8" }}>{userLogs.length} giao dịch · <code style={{ color:"#c4c0ff", fontSize:10 }}>xp_logs where userId == "{user.uid}"</code></div>
          </div>
          <button onClick={onClose} style={{ width:30, height:30, borderRadius:9, background:"rgba(255,255,255,.05)", border:"1px solid rgba(255,255,255,.08)", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", color:"#C7C4D8" }}>
            <X size={14} />
          </button>
        </div>

        {/* Summary */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:10, padding:"14px 22px", borderBottom:"1px solid rgba(255,255,255,.06)", flexShrink:0 }}>
          {[
            { label:"Tổng XP",     val:`+${fmtNum(totalPositive)}`, color:"#45f1c5" },
            { label:"Đã trừ",      val:`-${fmtNum(totalNegative)}`, color:"#ffb4ab" },
            { label:"Hiện tại",    val:fmtNum(user.xp),             color:"#FFB785" },
          ].map(({ label, val, color }) => (
            <div key={label} style={{ background:"rgba(255,255,255,.03)", borderRadius:12, padding:"10px 12px" }}>
              <div style={{ fontSize:10, fontWeight:700, color:"#C7C4D8", letterSpacing:".07em", textTransform:"uppercase", marginBottom:4 }}>{label}</div>
              <div style={{ fontSize:17, fontWeight:800, color }}>{val}</div>
            </div>
          ))}
        </div>

        {/* Log list */}
        <div style={{ flex:1, overflowY:"auto", padding:"14px 22px", display:"flex", flexDirection:"column", gap:8 }}>
          {userLogs.length === 0
            ? <div style={{ textAlign:"center", padding:40, color:"#47464f" }}><History size={28} style={{ margin:"0 auto 10px" }} /><p>Chưa có giao dịch XP</p></div>
            : userLogs.map(log => {
                const cfg = ACTIVITY_CFG[log.activityType] ?? ACTIVITY_CFG.bonus;
                const isPos = log.amount >= 0;
                return (
                  <div key={log.id} style={{ display:"flex", alignItems:"flex-start", gap:10, padding:"11px 13px", background:"rgba(255,255,255,.025)", border:"1px solid rgba(255,255,255,.06)", borderRadius:13 }}>
                    <span style={{ display:"inline-flex", alignItems:"center", padding:"3px 8px", borderRadius:999, background:cfg.bg, color:cfg.color, fontSize:9, fontWeight:700, flexShrink:0, marginTop:1, whiteSpace:"nowrap" }}>
                      {cfg.label}
                    </span>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:12, fontWeight:600, color:"#E4E1EE", marginBottom:2 }}>{log.reason}</div>
                      {log.adminNote && <div style={{ fontSize:11, color:"#C7C4D8", fontStyle:"italic" }}>"{log.adminNote}"</div>}
                      <div style={{ fontSize:10, color:"#47464f", marginTop:2 }}>{fmtDate(log.createdAt)}</div>
                    </div>
                    <div style={{ fontSize:14, fontWeight:800, color:isPos?"#45f1c5":"#ffb4ab", flexShrink:0, whiteSpace:"nowrap" }}>
                      {isPos ? "+" : ""}{fmtNum(log.amount)}
                    </div>
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
// COMPONENT: EventControlCard
// ═══════════════════════════════════════════════════════════════════════════

interface EventControlCardProps {
  event: GameEvent;
  onToggle: (event: GameEvent, active: boolean) => Promise<void>;
}

function EventControlCard({ event, onToggle }: EventControlCardProps) {
  const [loading, setLoading] = useState(false);
  const countdown = useCountdown(event.endDate);
  const isUpcoming = event.startDate.getTime() > Date.now();
  const isExpired  = event.endDate.getTime() < Date.now();

  const handleToggle = async () => {
    setLoading(true);
    try { await onToggle(event, !event.isActive); }
    finally { setLoading(false); }
  };

  const stateColor = event.isActive ? event.color : isUpcoming ? "#c4c0ff" : "#47464f";

  return (
    <div style={{ background:"rgba(22,20,34,.7)", border:`1px solid ${event.isActive ? event.color + "35" : "rgba(255,255,255,.07)"}`, borderRadius:20, padding:18, backdropFilter:"blur(12px)", boxShadow:event.isActive?`0 0 24px ${event.color}18`:undefined, transition:"all .3s", display:"flex", flexDirection:"column", gap:14 }}>
      {/* Header row */}
      <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:10 }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ width:42, height:42, borderRadius:13, background:event.isActive?`${event.color}22`:"rgba(255,255,255,.05)", border:`1px solid ${event.isActive?event.color+"40":"rgba(255,255,255,.08)"}`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:20, transition:"all .3s" }}>
            {event.icon}
          </div>
          <div>
            <div style={{ fontSize:14, fontWeight:700, color:"#E4E1EE" }}>{event.name}</div>
            <div style={{ fontSize:11, color:stateColor, fontWeight:600, marginTop:2 }}>
              {event.isActive ? "🟢 Đang chạy" : isUpcoming ? "🔵 Sắp diễn ra" : isExpired ? "⚫ Đã kết thúc" : "⚪ Tắt"}
            </div>
          </div>
        </div>

        {/* Toggle switch */}
        <button onClick={handleToggle} disabled={loading || isExpired}
          title={event.isActive ? "Tắt sự kiện" : "Bật sự kiện"}
          style={{ position:"relative", width:48, height:26, borderRadius:99, cursor:(loading||isExpired)?"not-allowed":"pointer", background:event.isActive?`linear-gradient(135deg,${event.color},${event.color}99)`:"rgba(255,255,255,.1)", border:`1px solid ${event.isActive?event.color+"60":"rgba(255,255,255,.15)"}`, padding:0, transition:"all .3s", flexShrink:0, boxShadow:event.isActive?`0 0 12px ${event.color}40`:undefined }}>
          {loading
            ? <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center" }}><Loader size={12} color="#fff" style={{ animation:"spin .8s linear infinite" }} /></div>
            : <div style={{ position:"absolute", top:3, width:20, height:20, borderRadius:"50%", background:"#fff", transition:"left .3s, box-shadow .3s", left:event.isActive?24:3, boxShadow:event.isActive?`0 0 8px ${event.color}60`:"0 1px 4px rgba(0,0,0,.4)" }} />
          }
        </button>
      </div>

      {/* Description */}
      <p style={{ fontSize:12, color:"#C7C4D8", lineHeight:1.6, margin:0 }}>{event.description}</p>

      {/* Multiplier badge */}
      <div style={{ display:"flex", alignItems:"center", gap:8 }}>
        <div style={{ padding:"4px 12px", borderRadius:999, background:`${event.color}18`, border:`1px solid ${event.color}35`, fontSize:12, fontWeight:800, color:event.color }}>
          ×{event.multiplier} XP
        </div>
        {event.isActive && !isExpired && (
          <div style={{ display:"flex", alignItems:"center", gap:5, fontSize:11, color:"#C7C4D8" }}>
            <Clock size={11} /> Còn lại: <strong style={{ color:event.color }}>{countdown}</strong>
          </div>
        )}
        {isUpcoming && (
          <div style={{ fontSize:11, color:"#c4c0ff" }}>
            Bắt đầu: {fmtDate(event.startDate)}
          </div>
        )}
      </div>

      {/* Time range */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
        {[
          { label:"Bắt đầu", val:fmtDate(event.startDate) },
          { label:"Kết thúc", val:fmtDate(event.endDate)  },
        ].map(({ label, val }) => (
          <div key={label} style={{ background:"rgba(255,255,255,.03)", border:"1px solid rgba(255,255,255,.06)", borderRadius:10, padding:"8px 10px" }}>
            <div style={{ fontSize:9, fontWeight:700, color:"#C7C4D8", letterSpacing:".07em", textTransform:"uppercase", marginBottom:3 }}>{label}</div>
            <div style={{ fontSize:10, color:"#E4E1EE", fontWeight:600 }}>{val}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT: LeaderboardTable (virtualized)
// ═══════════════════════════════════════════════════════════════════════════

const ROW_H = 60;
const VISIBLE = 12;

interface LeaderboardTableProps {
  users: LeaderboardUser[];
  loading: boolean;
  tab: LeaderboardTab;
  onAdjust: (u: LeaderboardUser) => void;
  onHistory: (u: LeaderboardUser) => void;
}

function LeaderboardTable({ users, loading, tab, onAdjust, onHistory }: LeaderboardTableProps) {
  const [scrollTop, setScrollTop] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const totalH = users.length * ROW_H;
  const start  = Math.floor(scrollTop / ROW_H);
  const end    = Math.min(users.length, start + VISIBLE + 2);
  const visibleUsers = users.slice(start, end);

  const thS: React.CSSProperties = { padding:"10px 16px", textAlign:"left", background:"rgba(255,255,255,.02)", borderBottom:"1px solid rgba(255,255,255,.06)", fontSize:10, fontWeight:700, color:"#C7C4D8", letterSpacing:".07em", textTransform:"uppercase", position:"sticky", top:0, zIndex:5 };

  return (
    <div style={{ background:"rgba(22,20,34,.7)", borderRadius:20, border:"1px solid rgba(255,255,255,.06)", overflow:"hidden" }}>
      {/* Sticky header */}
      <table style={{ width:"100%", borderCollapse:"collapse", tableLayout:"fixed" }}>
        <colgroup>
          <col style={{ width:64 }}/>
          <col style={{ width:"auto" }}/>
          <col style={{ width:120 }}/>
          <col style={{ width:120 }}/>
          <col style={{ width:90 }}/>
          <col style={{ width:110 }}/>
        </colgroup>
        <thead>
          <tr>
            <th style={thS}>Hạng</th>
            <th style={thS}>Người dùng</th>
            <th style={thS}>{tab === "alltime" ? "Tổng XP" : "XP tháng này"}</th>
            <th style={thS}>Level / Streak</th>
            <th style={thS}>Role</th>
            <th style={{ ...thS, textAlign:"center" }}>Thao tác</th>
          </tr>
        </thead>
      </table>

      {/* Virtualized scroll area */}
      <div ref={containerRef}
        style={{ height: Math.min(VISIBLE * ROW_H, totalH || 240), overflowY:"auto", position:"relative" }}
        onScroll={e => setScrollTop((e.target as HTMLDivElement).scrollTop)}>
        {loading ? (
          <div style={{ display:"flex", flexDirection:"column", gap:0 }}>
            {Array.from({ length: 8 }).map((_,i) => (
              <div key={i} style={{ height:ROW_H, display:"flex", alignItems:"center", gap:14, padding:"0 16px", borderBottom:"1px solid rgba(255,255,255,.04)" }}>
                <div style={{ width:36, height:16, borderRadius:8, background:"linear-gradient(90deg,#1a1828 25%,#242236 50%,#1a1828 75%)", backgroundSize:"200% 100%", animation:"shimmer 1.4s infinite", flexShrink:0 }}/>
                <div style={{ width:200, height:14, borderRadius:7, background:"linear-gradient(90deg,#1a1828 25%,#242236 50%,#1a1828 75%)", backgroundSize:"200% 100%", animation:"shimmer 1.4s infinite" }}/>
              </div>
            ))}
          </div>
        ) : users.length === 0 ? (
          <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", height:200, gap:12 }}>
            <Trophy size={32} color="#47464f" /><p style={{ color:"#C7C4D8", fontSize:14 }}>Chưa có dữ liệu</p>
          </div>
        ) : (
          <div style={{ height:totalH, position:"relative" }}>
            <table style={{ width:"100%", borderCollapse:"collapse", tableLayout:"fixed", position:"absolute", top: start * ROW_H }}>
              <colgroup>
                <col style={{ width:64 }}/>
                <col style={{ width:"auto" }}/>
                <col style={{ width:120 }}/>
                <col style={{ width:120 }}/>
                <col style={{ width:90 }}/>
                <col style={{ width:110 }}/>
              </colgroup>
              <tbody>
                {visibleUsers.map((u, idx) => {
                  const rank    = start + idx + 1;
                  const xpVal   = tab === "alltime" ? u.xp : (u.monthlyXP ?? 0);
                  const medal   = MEDAL[rank];
                  const rankDiff = u.prevRank != null ? u.prevRank - rank : 0;

                  return (
                    <tr key={u.uid}
                      style={{ borderBottom:"1px solid rgba(255,255,255,.04)", transition:"background .15s", height:ROW_H }}
                      onMouseOver={e => ((e.currentTarget as HTMLTableRowElement).style.background="rgba(255,255,255,.025)")}
                      onMouseOut={e  => ((e.currentTarget as HTMLTableRowElement).style.background="transparent")}>

                      {/* Rank */}
                      <td style={{ padding:"0 16px", verticalAlign:"middle" }}>
                        {medal ? (
                          <div style={{ width:34, height:34, borderRadius:"50%", background:medal.bg, display:"flex", alignItems:"center", justifyContent:"center", fontSize:16, boxShadow:medal.shadow }}>
                            {medal.emoji}
                          </div>
                        ) : (
                          <div style={{ display:"flex", flexDirection:"column", alignItems:"center" }}>
                            <span style={{ fontSize:13, fontWeight:700, color:rank<=10?"#c4c0ff":"#C7C4D8" }}>#{rank}</span>
                            {rankDiff !== 0 && (
                              <span style={{ fontSize:9, fontWeight:700, color:rankDiff>0?"#45f1c5":"#ffb4ab", display:"flex", alignItems:"center" }}>
                                {rankDiff>0 ? <TrendingUp size={9}/> : <TrendingDown size={9}/>} {Math.abs(rankDiff)}
                              </span>
                            )}
                          </div>
                        )}
                      </td>

                      {/* User */}
                      <td style={{ padding:"0 16px", verticalAlign:"middle" }}>
                        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                          <div style={{ width:36, height:36, borderRadius:"50%", background:ROLE_GRAD[u.role]??ROLE_GRAD.student, display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, fontWeight:800, color:"#fff", flexShrink:0 }}>
                            {initials(u.displayName)}
                          </div>
                          <div style={{ minWidth:0 }}>
                            <div style={{ fontSize:13, fontWeight:700, color:"#E4E1EE", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{u.displayName}</div>
                            <div style={{ fontSize:10, color:"#C7C4D8", opacity:.7 }}>{u.email}</div>
                          </div>
                        </div>
                      </td>

                      {/* XP */}
                      <td style={{ padding:"0 16px", verticalAlign:"middle" }}>
                        <div style={{ fontSize:14, fontWeight:800, color:"#FFB785", display:"flex", alignItems:"center", gap:4 }}>
                          <Zap size={12} fill="#FFB785"/>{fmtNum(xpVal)}
                        </div>
                      </td>

                      {/* Level + Streak */}
                      <td style={{ padding:"0 16px", verticalAlign:"middle" }}>
                        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                          <span style={{ padding:"2px 8px", borderRadius:8, background:"rgba(196,192,255,.12)", color:"#c4c0ff", fontSize:11, fontWeight:800 }}>Lv.{u.level}</span>
                          {u.currentStreak > 0 && (
                            <span style={{ fontSize:11, fontWeight:700, color:"#FFB785", display:"flex", alignItems:"center", gap:3 }}>
                              🔥{u.currentStreak}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Role */}
                      <td style={{ padding:"0 16px", verticalAlign:"middle" }}>
                        <span style={{ fontSize:10, fontWeight:700, color:"#C7C4D8", background:"rgba(255,255,255,.06)", padding:"2px 8px", borderRadius:6 }}>
                          {u.role}
                        </span>
                      </td>

                      {/* Actions */}
                      <td style={{ padding:"0 16px", textAlign:"center", verticalAlign:"middle" }}>
                        <div style={{ display:"flex", gap:5, justifyContent:"center" }}>
                          <button title="Điều chỉnh XP" onClick={() => onAdjust(u)}
                            style={{ width:30, height:30, borderRadius:8, background:"rgba(108,99,255,.08)", border:"1px solid rgba(108,99,255,.22)", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", color:"#6C63FF", transition:"background .15s" }}
                            onMouseOver={e=>(e.currentTarget.style.background="rgba(108,99,255,.2)")}
                            onMouseOut={e =>(e.currentTarget.style.background="rgba(108,99,255,.08)")}>
                            <Edit3 size={13}/>
                          </button>
                          <button title="Lịch sử XP" onClick={() => onHistory(u)}
                            style={{ width:30, height:30, borderRadius:8, background:"rgba(69,241,197,.06)", border:"1px solid rgba(69,241,197,.2)", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", color:"#45f1c5", transition:"background .15s" }}
                            onMouseOver={e=>(e.currentTarget.style.background="rgba(69,241,197,.16)")}
                            onMouseOut={e =>(e.currentTarget.style.background="rgba(69,241,197,.06)")}>
                            <History size={13}/>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Footer count */}
      {!loading && users.length > 0 && (
        <div style={{ padding:"10px 16px", borderTop:"1px solid rgba(255,255,255,.05)", fontSize:11, color:"#C7C4D8", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <span>Top <strong style={{ color:"#E4E1EE" }}>{users.length}</strong> người dùng · Virtual scroll</span>
          <span style={{ fontSize:10, color:"#47464f" }}>onSnapshot · orderBy xp desc · limit 100</span>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN: LeaderboardAdmin
// ═══════════════════════════════════════════════════════════════════════════

export default function LeaderboardAdmin() {
  const [tab,        setTab]        = useState<LeaderboardTab>("alltime");
  const [sortMode,   setSortMode]   = useState<SortMode>("xp");
  const [search,     setSearch]     = useState("");
  const [loading,    setLoading]    = useState(true);
  const [users,      setUsers]      = useState<LeaderboardUser[]>([]);
  const [xpLogs,     setXpLogs]     = useState<XPLogEntry[]>(MOCK_XP_LOGS);
  const [events,     setEvents]     = useState<GameEvent[]>(MOCK_EVENTS);
  const [adjustTarget,  setAdjustTarget]  = useState<LeaderboardUser | null>(null);
  const [historyTarget, setHistoryTarget] = useState<LeaderboardUser | null>(null);
  const { toasts, add: addToast } = useToast();

  // Simulate Firestore onSnapshot
  useEffect(() => {
    setLoading(true);
    // ── REAL FIREBASE ─────────────────────────────────────────────────
    // const q = query(collection(db, "users"), orderBy("xp", "desc"), limit(100));
    // const unsub = onSnapshot(q, (snap) => {
    //   setUsers(snap.docs.map((d, i) => ({ uid: d.id, ...d.data(), rank: i+1 })) as LeaderboardUser[]);
    //   setLoading(false);
    // });
    // return () => unsub();
    const t = setTimeout(() => { setUsers(MOCK_USERS); setLoading(false); }, 800);
    return () => clearTimeout(t);
  }, []);

  // Derived: displayed list
  const displayedUsers = useMemo(() => {
    let src = [...users];
    if (tab === "monthly") src = src.sort((a,b) => (b.monthlyXP??0) - (a.monthlyXP??0)).map((u,i) => ({ ...u, rank: i+1 }));
    if (sortMode === "level")  src = [...src].sort((a,b) => b.level - a.level);
    if (sortMode === "streak") src = [...src].sort((a,b) => b.currentStreak - a.currentStreak);
    if (search) src = src.filter(u => u.displayName.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase()));
    return src;
  }, [users, tab, sortMode, search]);

  const activeEvent = useMemo(() => events.find(e => e.isActive && e.endDate.getTime() > Date.now() && e.startDate.getTime() <= Date.now()), [events]);

  // Stats
  const stats = useMemo(() => ({
    totalXP:    users.reduce((s,u) => s + u.xp, 0),
    monthlyXP:  users.reduce((s,u) => s + (u.monthlyXP??0), 0),
    topStreak:  users.reduce((max,u) => Math.max(max, u.currentStreak), 0),
    avgLevel:   users.length ? Math.round(users.reduce((s,u) => s + u.level, 0) / users.length) : 0,
  }), [users]);

  // XP Adjust handler
  const handleAdjustXP = useCallback(async (amount: number, reason: string) => {
    if (!adjustTarget) return;
    const uid = adjustTarget.uid;

    // ── REAL FIREBASE TRANSACTION ──────────────────────────────────────
    // await runTransaction(db, async (tx) => {
    //   const userRef = doc(db, "users", uid);
    //   const snap = await tx.get(userRef);
    //   if (!snap.exists()) throw new Error("User not found");
    //   const currentXP = snap.data().xp ?? 0;
    //   tx.update(userRef, {
    //     xp: Math.max(0, currentXP + amount),
    //     updatedAt: serverTimestamp(),
    //   });
    //   const logRef = doc(collection(db, "xp_logs"));
    //   tx.set(logRef, {
    //     userId: uid,
    //     amount,
    //     reason,
    //     activityType: "admin_adjust",
    //     adminNote: reason,
    //     createdBy: "admin@smartreview.io",
    //     createdAt: serverTimestamp(),
    //   });
    // });
    // ── MOCK ─────────────────────────────────────────────────────────
    await new Promise(r => setTimeout(r, 800));
    setUsers(prev => prev.map(u => u.uid === uid
      ? { ...u, xp: Math.max(0, u.xp + amount), level: Math.max(1, u.level + (amount > 0 ? Math.floor(amount / 500) : 0)) }
      : u
    ).sort((a,b) => b.xp - a.xp).map((u,i) => ({ ...u, rank:i+1 })));
    setXpLogs(prev => [{
      id: `xl_${Date.now()}`, userId: uid, amount, reason,
      activityType: "admin_adjust", adminNote: reason, createdAt: new Date(),
    }, ...prev]);
    addToast(`${amount>0?"+":""}${fmtNum(amount)} XP cho ${adjustTarget.displayName}`, amount>0?"success":"warning");
  }, [adjustTarget, addToast]);

  // Event toggle handler
  const handleEventToggle = useCallback(async (event: GameEvent, active: boolean) => {
    // ── REAL FIREBASE ─────────────────────────────────────────────────
    // await updateDoc(doc(db, "events", event.id), {
    //   isActive: active,
    //   updatedAt: serverTimestamp(),
    // });
    // If activating, trigger Cloud Function to set xp multiplier:
    // await httpsCallable(functions, "setXPMultiplier")({ eventId: event.id, active });
    // ── MOCK ─────────────────────────────────────────────────────────
    await new Promise(r => setTimeout(r, 600));
    setEvents(prev => prev.map(e => e.id === event.id ? { ...e, isActive: active } : e));
    addToast(`${event.name} ${active?"đã bật":"đã tắt"} (x${event.multiplier} XP)`, active?"success":"info");
  }, [addToast]);

  const podiumUsers = useMemo(() => {
    const src = tab === "alltime"
      ? [...users].sort((a,b) => b.xp - a.xp)
      : [...users].sort((a,b) => (b.monthlyXP??0) - (a.monthlyXP??0));
    return [src[1], src[0], src[2]].filter(Boolean); // 2nd, 1st, 3rd for visual podium
  }, [users, tab]);

  return (
    <div style={{ minHeight:"100vh", background:"#09080F", color:"#E4E1EE", fontFamily:"'Space Grotesk', sans-serif", backgroundImage:"radial-gradient(ellipse at 10% 0%, rgba(108,99,255,.09) 0%, transparent 50%), radial-gradient(ellipse at 90% 100%, rgba(255,215,0,.04) 0%, transparent 50%)" }}>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;600;700;800&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes scaleIn{from{opacity:0;transform:scale(.94)}to{opacity:1;transform:scale(1)}}
        @keyframes slideInR{from{opacity:0;transform:translateX(20px)}to{opacity:1;transform:translateX(0)}}
        @keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
        @keyframes fadeDown{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:translateY(0)}}
        input,select,textarea,button{font-family:'Space Grotesk',sans-serif;}
        ::-webkit-scrollbar{width:5px;height:5px;}
        ::-webkit-scrollbar-track{background:#09080F;}
        ::-webkit-scrollbar-thumb{background:#2a2935;border-radius:10px;}
      `}</style>

      <div style={{ maxWidth:1280, margin:"0 auto", padding:"28px 24px", display:"flex", flexDirection:"column", gap:24 }}>

        {/* ── PAGE HEADER ──────────────────────────────────────────── */}
        <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", flexWrap:"wrap", gap:14 }}>
          <div style={{ display:"flex", alignItems:"center", gap:14 }}>
            <div style={{ width:46, height:46, borderRadius:14, background:"linear-gradient(135deg,#6C63FF,#9B59B6)", display:"flex", alignItems:"center", justifyContent:"center", boxShadow:"0 0 24px rgba(108,99,255,.35)" }}>
              <Trophy size={22} color="#fff"/>
            </div>
            <div>
              <h1 style={{ fontSize:26, fontWeight:800, letterSpacing:"-.02em" }}>Leaderboard Admin</h1>
              <p style={{ fontSize:12, color:"#C7C4D8", marginTop:2 }}>
                Firestore: <code style={{ background:"rgba(108,99,255,.12)", padding:"1px 6px", borderRadius:4, fontSize:11, color:"#c4c0ff" }}>users</code> · <code style={{ background:"rgba(69,241,197,.1)", padding:"1px 6px", borderRadius:4, fontSize:11, color:"#45f1c5" }}>xp_logs</code> · <code style={{ background:"rgba(255,215,0,.1)", padding:"1px 6px", borderRadius:4, fontSize:11, color:"#FFD700" }}>events</code>
              </p>
            </div>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            {activeEvent && (
              <div style={{ display:"flex", alignItems:"center", gap:7, padding:"7px 14px", background:`${activeEvent.color}14`, border:`1px solid ${activeEvent.color}35`, borderRadius:12 }}>
                <span style={{ fontSize:14 }}>{activeEvent.icon}</span>
                <span style={{ fontSize:12, fontWeight:700, color:activeEvent.color }}>{activeEvent.name} Đang hoạt động</span>
                <span style={{ width:7, height:7, borderRadius:"50%", background:activeEvent.color, display:"inline-block", animation:"pulse 1.5s infinite" }}/>
              </div>
            )}
            <button onClick={() => { setLoading(true); setTimeout(() => setLoading(false), 600); }}
              style={{ display:"flex", alignItems:"center", gap:7, padding:"9px 16px", borderRadius:11, fontSize:13, fontWeight:600, cursor:"pointer", background:"rgba(255,255,255,.04)", border:"1px solid rgba(255,255,255,.08)", color:"#C7C4D8", transition:"all .2s" }}
              onMouseOver={e=>{e.currentTarget.style.color="#e3dfff"; e.currentTarget.style.borderColor="rgba(255,255,255,.2)";}}
              onMouseOut={e =>{e.currentTarget.style.color="#C7C4D8"; e.currentTarget.style.borderColor="rgba(255,255,255,.08)";}}>
              <RefreshCw size={14}/> Refresh
            </button>
          </div>
        </div>

        {/* ── STAT STRIP ───────────────────────────────────────────── */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12 }}>
          {[
            { icon:<Zap size={17} color="#FFB785"/>,     label:"Tổng XP",       val:fmtNum(stats.totalXP),    color:"#FFB785", glow:"rgba(255,183,133,.08)" },
            { icon:<TrendingUp size={17} color="#45f1c5"/>, label:"XP tháng này",  val:fmtNum(stats.monthlyXP),  color:"#45f1c5", glow:"rgba(69,241,197,.08)"  },
            { icon:<Flame size={17} color="#ff6b6b"/>,   label:"Streak cao nhất", val:`${stats.topStreak} ngày`, color:"#ff6b6b", glow:"rgba(255,107,107,.08)"  },
            { icon:<Star size={17} color="#c4c0ff"/>,    label:"Level trung bình",val:`Lv. ${stats.avgLevel}`,  color:"#c4c0ff", glow:"rgba(196,192,255,.08)" },
          ].map(({ icon, label, val, color, glow }) => (
            <div key={label} style={{ background:"rgba(22,20,34,.7)", border:"1px solid rgba(255,255,255,.06)", borderRadius:18, padding:"16px 18px", backdropFilter:"blur(12px)", boxShadow:`0 4px 18px ${glow}`, display:"flex", alignItems:"center", gap:14, transition:"transform .2s" }}
              onMouseOver={e=>(e.currentTarget.style.transform="translateY(-2px)")}
              onMouseOut={e =>(e.currentTarget.style.transform="translateY(0)")}>
              <div style={{ width:38, height:38, borderRadius:11, background:glow, border:`1px solid ${color}28`, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>{icon}</div>
              <div>
                <div style={{ fontSize:10, fontWeight:700, color:"#C7C4D8", letterSpacing:".07em", textTransform:"uppercase", marginBottom:3 }}>{label}</div>
                <div style={{ fontSize:21, fontWeight:800, color }}>{val}</div>
              </div>
            </div>
          ))}
        </div>

        {/* ── MAIN LAYOUT: Table + Events sidebar ──────────────────── */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 320px", gap:20, alignItems:"start" }}>

          {/* LEFT: Leaderboard */}
          <div style={{ display:"flex", flexDirection:"column", gap:16 }}>

            {/* Podium */}
            {!loading && podiumUsers.length >= 3 && (
              <div style={{ background:"rgba(22,20,34,.7)", border:"1px solid rgba(255,255,255,.07)", borderRadius:20, padding:"20px 16px 0", overflow:"hidden" }}>
                <div style={{ display:"flex", justifyContent:"center", alignItems:"flex-end", gap:8, paddingBottom:0 }}>
                  {podiumUsers.map((u, idx) => {
                    const podiumRank  = [2, 1, 3][idx];
                    const medal       = MEDAL[podiumRank];
                    const heights     = [90, 120, 70];
                    const barH        = heights[idx];
                    const xpVal       = tab === "alltime" ? u.xp : (u.monthlyXP ?? 0);
                    return (
                      <div key={u.uid} style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:6, flex:1, maxWidth:160 }}>
                        <div style={{ fontSize:18 }}>{medal.emoji}</div>
                        <div style={{ width:44, height:44, borderRadius:"50%", background:ROLE_GRAD[u.role]??ROLE_GRAD.student, display:"flex", alignItems:"center", justifyContent:"center", fontSize:14, fontWeight:800, color:"#fff", border:`3px solid ${medal.bg}`, boxShadow:medal.shadow }}>
                          {initials(u.displayName)}
                        </div>
                        <div style={{ fontSize:11, fontWeight:700, color:"#E4E1EE", textAlign:"center", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", width:"100%", padding:"0 4px" }}>{u.displayName}</div>
                        <div style={{ fontSize:12, fontWeight:800, color:"#FFB785", display:"flex", alignItems:"center", gap:3 }}><Zap size={10} fill="#FFB785"/>{fmtNum(xpVal)}</div>
                        <div style={{ width:"100%", height:barH, borderRadius:"10px 10px 0 0", background:medal.bg, opacity:.85, boxShadow:medal.shadow, display:"flex", alignItems:"flex-start", justifyContent:"center", paddingTop:8 }}>
                          <span style={{ fontSize:18, fontWeight:900, color:"#fff", opacity:.9 }}>#{podiumRank}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Tabs + Search + Sort */}
            <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
              <div style={{ display:"flex", alignItems:"center", gap:10, flexWrap:"wrap" }}>
                {/* Tabs */}
                <div style={{ display:"flex", gap:3, background:"rgba(255,255,255,.04)", border:"1px solid rgba(255,255,255,.07)", borderRadius:12, padding:4 }}>
                  {([
                    { id:"alltime", label:"🏆 Tổng cộng" },
                    { id:"monthly", label:"📅 Tháng này" },
                  ] as const).map(({ id, label }) => (
                    <button key={id} onClick={() => setTab(id)}
                      style={{ padding:"7px 14px", borderRadius:9, fontSize:12, fontWeight:700, cursor:"pointer", transition:"all .2s", background:tab===id?"linear-gradient(135deg,#6C63FF,#9B59B6)":"transparent", border:tab===id?"1px solid rgba(108,99,255,.3)":"1px solid transparent", color:tab===id?"#fff":"#C7C4D8", boxShadow:tab===id?"0 0 12px rgba(108,99,255,.22)":"none" }}>
                      {label}
                    </button>
                  ))}
                </div>

                {/* Sort */}
                <div style={{ display:"flex", gap:6, marginLeft:"auto" }}>
                  {([
                    { id:"xp",     label:"XP"     },
                    { id:"level",  label:"Level"  },
                    { id:"streak", label:"Streak" },
                  ] as const).map(({ id, label }) => (
                    <button key={id} onClick={() => setSortMode(id)}
                      style={{ padding:"6px 12px", borderRadius:8, fontSize:11, fontWeight:700, cursor:"pointer", transition:"all .15s", background:sortMode===id?"rgba(196,192,255,.15)":"rgba(255,255,255,.04)", border:`1px solid ${sortMode===id?"rgba(196,192,255,.35)":"rgba(255,255,255,.07)"}`, color:sortMode===id?"#c4c0ff":"#C7C4D8" }}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Search */}
              <div style={{ position:"relative" }}>
                <Search size={13} style={{ position:"absolute", left:13, top:"50%", transform:"translateY(-50%)", color:"#C7C4D8" }}/>
                <input value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Tìm theo tên, email…"
                  style={{ ...IS, paddingLeft:36 }} onFocus={fo} onBlur={bl}/>
                {search && <button onClick={() => setSearch("")} style={{ position:"absolute", right:12, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", cursor:"pointer", color:"#C7C4D8" }}><X size={12}/></button>}
              </div>
            </div>

            {/* Table */}
            <LeaderboardTable
              users={displayedUsers}
              loading={loading}
              tab={tab}
              onAdjust={setAdjustTarget}
              onHistory={setHistoryTarget}
            />
          </div>

          {/* RIGHT: Events + Quick stats sidebar */}
          <div style={{ display:"flex", flexDirection:"column", gap:16, position:"sticky", top:20 }}>
            {/* Events header */}
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
              <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                <Sparkles size={16} color="#FFD700"/>
                <h3 style={{ fontSize:15, fontWeight:700, color:"#E4E1EE" }}>Sự kiện XP</h3>
              </div>
              <code style={{ fontSize:10, color:"#9B59B6", background:"rgba(108,99,255,.1)", padding:"2px 7px", borderRadius:5 }}>events</code>
            </div>

            {events.map(event => (
              <EventControlCard key={event.id} event={event} onToggle={handleEventToggle}/>
            ))}

            {/* XP log legend */}
            <div style={{ background:"rgba(22,20,34,.7)", border:"1px solid rgba(255,255,255,.07)", borderRadius:18, padding:16 }}>
              <div style={{ fontSize:11, fontWeight:700, color:"#C7C4D8", letterSpacing:".07em", textTransform:"uppercase", marginBottom:12 }}>Loại XP</div>
              <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                {Object.entries(ACTIVITY_CFG).map(([key, cfg]) => (
                  <div key={key} style={{ display:"flex", alignItems:"center", gap:8 }}>
                    <span style={{ padding:"2px 8px", borderRadius:999, background:cfg.bg, color:cfg.color, fontSize:10, fontWeight:700, minWidth:80, textAlign:"center" }}>{cfg.label}</span>
                    <span style={{ fontSize:11, color:"#C7C4D8", opacity:.7 }}>
                      {key === "admin_adjust" ? "Admin tay" : key === "lesson_complete" ? "Hoàn thành bài" : key === "daily_streak" ? "Streak hàng ngày" : key === "achievement" ? "Thành tích" : key === "quiz_pass" ? "Quiz hoàn thành" : "Bonus"}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Firebase info */}
            <div style={{ background:"rgba(108,99,255,.06)", border:"1px solid rgba(108,99,255,.18)", borderRadius:16, padding:"14px 16px" }}>
              <div style={{ fontSize:10, fontWeight:700, color:"#9B59B6", marginBottom:8, letterSpacing:".07em", textTransform:"uppercase" }}>Firebase Logic</div>
              <code style={{ fontSize:10, color:"#c4c0ff", lineHeight:2, display:"block" }}>
                {"// XP adjustment:\n"}
                runTransaction(db, async (tx) {"{"}<br/>
                &nbsp;&nbsp;tx.update(userRef, {"{"} xp {"}"});<br/>
                &nbsp;&nbsp;tx.set(logRef, xpLog);<br/>
                {"}"})
              </code>
            </div>
          </div>
        </div>
      </div>

      {/* ── MODALS ──────────────────────────────────────────────────── */}
      {adjustTarget && (
        <XPAdjustmentModal
          user={adjustTarget}
          activeEvent={activeEvent}
          onConfirm={handleAdjustXP}
          onClose={() => setAdjustTarget(null)}
        />
      )}
      {historyTarget && (
        <XPHistoryModal
          user={historyTarget}
          logs={xpLogs}
          onClose={() => setHistoryTarget(null)}
        />
      )}

      <ToastContainer toasts={toasts}/>
    </div>
  );
}

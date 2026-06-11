/**
 * Smart Review — Admin Leaderboard Manager
 * All-time + Monthly XP leaderboard
 */

"use client";

import React, { useState, useCallback, useMemo, useEffect } from "react";
import { orderBy, limit } from "firebase/firestore";
import { useCollection } from "../../../hooks/useFirestore";
import { updateUserXP } from "../../../services/adminService";
import { useEvents } from "../../../hooks/useEvents";
import { getAllUsersMonthlyXP } from "../../../services/monthlyXPService";

import {
  Zap,
  Trophy,
  Flame,
  Plus,
  Minus,
  History,
  Edit3,
  RefreshCw,
  AlertTriangle,
  Loader,
  X,
  Search,
  Save,
} from "lucide-react";

// ============ TYPES ============
interface LeaderboardUser {
  uid: string;
  displayName: string;
  email: string;
  xp: number;
  level: number;
  currentStreak: number;
  role: string;
  rank?: number;
}

interface MonthlyUser {
  userId: string;
  displayName: string;
  email: string;
  monthlyXP: number;
}

const fmtNum = (n: number) => new Intl.NumberFormat("vi-VN").format(n);
const fmtDate = (d: Date) => d.toLocaleDateString("vi-VN");

const ROLE_GRAD: Record<string, string> = {
  student: "linear-gradient(135deg,#6C63FF,#9B59B6)",
  instructor: "linear-gradient(135deg,#00D4AA,#0F9E7B)",
  moderator: "linear-gradient(135deg,#FFB785,#FF8C42)",
  admin: "linear-gradient(135deg,#FFD700,#FF8C42)",
};

function initials(n: string) {
  return n
    .split(" ")
    .map((w) => w[0]?.toUpperCase() || "")
    .slice(0, 2)
    .join("");
}

const MEDAL: Record<number, { bg: string; emoji: string }> = {
  1: { bg: "linear-gradient(135deg,#FFD700,#FFA500)", emoji: "🥇" },
  2: { bg: "linear-gradient(135deg,#C0C0C0,#A8A8A8)", emoji: "🥈" },
  3: { bg: "linear-gradient(135deg,#CD7F32,#A0522D)", emoji: "🥉" },
};

// ============ TOAST ============
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
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500);
  }, []);
  return { toasts, add };
}
function ToastContainer({ toasts }: { toasts: Toast[] }) {
  const c = { success: "#45f1c5", error: "#ffb4ab", info: "#c4c0ff" };
  return (
    <div
      style={{
        position: "fixed",
        bottom: 24,
        right: 24,
        zIndex: 99999,
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          style={{
            background: "rgba(12,11,22,.98)",
            border: `1px solid ${c[t.type]}40`,
            borderRadius: 14,
            padding: "11px 18px",
            color: c[t.type],
            fontSize: 13,
            fontWeight: 600,
            boxShadow: "0 8px 30px rgba(0,0,0,.5)",
          }}
        >
          {t.msg}
        </div>
      ))}
    </div>
  );
}

// ============ XP ADJUSTMENT MODAL (with validation) ============
const MAX_ADJUSTMENT = 10000;

function XPAdjustmentModal({
  user,
  onConfirm,
  onClose,
}: {
  user: LeaderboardUser;
  onConfirm: (amount: number, reason: string) => Promise<void>;
  onClose: () => void;
}) {
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [mode, setMode] = useState<"add" | "sub">("add");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const finalAmount = mode === "add" ? Math.abs(Number(amount)) : -Math.abs(Number(amount));
  const numAmount = Number(amount);
  const isValid =
    amount !== "" && !isNaN(numAmount) && numAmount > 0 && reason.trim().length >= 3;

  const handleSubmit = async () => {
    if (!isValid) {
      setError("Nhập số XP và lý do (≥3 ký tự)");
      return;
    }
    if (numAmount > MAX_ADJUSTMENT) {
      setError(`Không thể điều chỉnh quá ${MAX_ADJUSTMENT} XP một lần`);
      return;
    }
    if (mode === "sub" && user.xp - numAmount < 0) {
      setError("XP không thể âm");
      return;
    }
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
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,.72)",
        backdropFilter: "blur(8px)",
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 420,
          background: "rgba(12,11,22,.98)",
          border: "1px solid rgba(255,255,255,.1)",
          borderRadius: 24,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "18px 22px",
            borderBottom: "1px solid rgba(255,255,255,.07)",
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              background: "linear-gradient(135deg,#6C63FF,#9B59B6)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Zap size={18} color="#fff" />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#E4E1EE" }}>Điều chỉnh XP</div>
            <div style={{ fontSize: 11, color: "#C7C4D8" }}>
              Firebase Transaction → users.xp + xp_logs
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 30,
              height: 30,
              borderRadius: 9,
              background: "rgba(255,255,255,.05)",
              border: "1px solid rgba(255,255,255,.08)",
              cursor: "pointer",
              color: "#C7C4D8",
            }}
          >
            <X size={14} />
          </button>
        </div>
        <div style={{ padding: 22, display: "flex", flexDirection: "column", gap: 16 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "12px 14px",
              background: "rgba(255,255,255,.03)",
              borderRadius: 14,
            }}
          >
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: "50%",
                background: ROLE_GRAD[user.role] ?? ROLE_GRAD.student,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 13,
                fontWeight: 800,
                color: "#fff",
              }}
            >
              {initials(user.displayName)}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#E4E1EE" }}>
                {user.displayName}
              </div>
              <div style={{ fontSize: 11, color: "#C7C4D8" }}>{user.email}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: "#FFB785" }}>
                {fmtNum(user.xp)} XP
              </div>
              <div style={{ fontSize: 10, color: "#C7C4D8" }}>Lv. {user.level}</div>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {(["add", "sub"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                style={{
                  padding: "10px",
                  borderRadius: 12,
                  cursor: "pointer",
                  fontWeight: 700,
                  fontSize: 13,
                  background:
                    mode === m
                      ? m === "add"
                        ? "rgba(69,241,197,.14)"
                        : "rgba(255,180,171,.14)"
                      : "rgba(255,255,255,.04)",
                  border: `1px solid ${
                    mode === m
                      ? m === "add"
                        ? "rgba(69,241,197,.35)"
                        : "rgba(255,180,171,.35)"
                      : "rgba(255,255,255,.07)"
                  }`,
                  color: mode === m ? (m === "add" ? "#45f1c5" : "#ffb4ab") : "#C7C4D8",
                }}
              >
                {m === "add" ? (
                  <>
                    <Plus size={14} /> Cộng XP
                  </>
                ) : (
                  <>
                    <Minus size={14} /> Trừ XP
                  </>
                )}
              </button>
            ))}
          </div>

          <div>
            <label
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: "#C7C4D8",
                textTransform: "uppercase",
                marginBottom: 7,
              }}
            >
              Số XP
            </label>
            <div style={{ position: "relative" }}>
              <span
                style={{
                  position: "absolute",
                  left: 12,
                  top: "50%",
                  transform: "translateY(-50%)",
                  fontWeight: 800,
                  fontSize: 16,
                  color: mode === "add" ? "#45f1c5" : "#ffb4ab",
                }}
              >
                {mode === "add" ? "+" : "−"}
              </span>
              <input
                type="number"
                min={1}
                max={MAX_ADJUSTMENT}
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value);
                  setError("");
                }}
                placeholder="0"
                autoFocus
                style={{
                  width: "100%",
                  background: "#0c0b16",
                  border: "1px solid rgba(255,255,255,.08)",
                  borderRadius: 12,
                  padding: "10px 14px 10px 32px",
                  color: "#E4E1EE",
                  fontSize: 16,
                  fontWeight: 700,
                }}
              />
            </div>
          </div>

          <div>
            <label
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: "#C7C4D8",
                textTransform: "uppercase",
                marginBottom: 7,
              }}
            >
              Lý do
            </label>
            <input
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                setError("");
              }}
              placeholder="e.g. Thưởng tham gia beta test..."
              style={{
                width: "100%",
                background: "#0c0b16",
                border: "1px solid rgba(255,255,255,.08)",
                borderRadius: 12,
                padding: "10px 14px",
                color: "#E4E1EE",
              }}
            />
          </div>

          {error && (
            <p style={{ fontSize: 12, color: "#ffb4ab" }}>
              ⚠ {error}
            </p>
          )}

          <div style={{ display: "flex", gap: 10 }}>
            <button
              onClick={onClose}
              style={{
                flex: 1,
                padding: "11px",
                borderRadius: 13,
                background: "rgba(255,255,255,.05)",
                border: "1px solid rgba(255,255,255,.1)",
                color: "#C7C4D8",
                cursor: "pointer",
              }}
            >
              Hủy
            </button>
            <button
              onClick={handleSubmit}
              disabled={!isValid || saving}
              style={{
                flex: 2,
                padding: "11px",
                borderRadius: 13,
                fontSize: 13,
                fontWeight: 800,
                cursor: !isValid || saving ? "not-allowed" : "pointer",
                background: isValid
                  ? "linear-gradient(135deg,#6C63FF,#9B59B6)"
                  : "rgba(255,255,255,.04)",
                border: "none",
                color: isValid ? "#fff" : "#47464f",
              }}
            >
              {saving ? (
                <Loader size={14} style={{ animation: "spin .8s linear infinite" }} />
              ) : (
                <Save size={14} />
              )}{" "}
              Xác nhận
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============ XP HISTORY MODAL (giữ nguyên, chỉ thay đổi nhỏ) ============
function XPHistoryModal({ user, onClose }: { user: LeaderboardUser; onClose: () => void }) {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLogs = async () => {
      setLoading(true);
      try {
        const { collection, query, where, orderBy, getDocs, limit } = await import(
          "firebase/firestore"
        );
        const { db } = await import("../../../utils/config");
        const q = query(
          collection(db, "xp_logs"),
          where("userId", "==", user.uid),
          orderBy("timestamp", "desc"),
          limit(50)
        );
        const snapshot = await getDocs(q);
        setLogs(
          snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
            createdAt: doc.data().timestamp?.toDate() || new Date(),
          }))
        );
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchLogs();
  }, [user.uid]);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,.72)",
        backdropFilter: "blur(8px)",
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 560,
          maxHeight: "80vh",
          display: "flex",
          flexDirection: "column",
          background: "rgba(12,11,22,.98)",
          border: "1px solid rgba(255,255,255,.08)",
          borderRadius: 24,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "18px 22px",
            borderBottom: "1px solid rgba(255,255,255,.07)",
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: "50%",
              background: ROLE_GRAD[user.role] ?? ROLE_GRAD.student,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 13,
              fontWeight: 800,
              color: "#fff",
            }}
          >
            {initials(user.displayName)}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#E4E1EE" }}>
              Lịch sử XP — {user.displayName}
            </div>
            <div style={{ fontSize: 11, color: "#C7C4D8" }}>Từ xp_logs collection</div>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 30,
              height: 30,
              borderRadius: 9,
              background: "rgba(255,255,255,.05)",
              border: "1px solid rgba(255,255,255,.08)",
              cursor: "pointer",
              color: "#C7C4D8",
            }}
          >
            <X size={14} />
          </button>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "14px 22px" }}>
          {loading ? (
            <div style={{ textAlign: "center", padding: 40 }}>
              <Loader size={24} color="#6C63FF" style={{ animation: "spin .8s linear infinite" }} />
            </div>
          ) : logs.length === 0 ? (
            <div style={{ textAlign: "center", padding: 40, color: "#47464f" }}>
              <History size={28} />
              <p>Chưa có giao dịch XP</p>
            </div>
          ) : (
            logs.map((log) => (
              <div
                key={log.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 12px",
                  borderBottom: "1px solid rgba(255,255,255,.05)",
                }}
              >
                <span
                  style={{
                    padding: "2px 8px",
                    borderRadius: 999,
                    background: "rgba(69,241,197,.12)",
                    color: "#45f1c5",
                    fontSize: 10,
                    fontWeight: 700,
                  }}
                >
                  {log.activityType === "lesson_complete" ? "Bài học" : "Admin"}
                </span>
                <div style={{ flex: 1, fontSize: 13, color: "#C7C4D8" }}>{log.reason}</div>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: log.amount > 0 ? "#45f1c5" : "#ffb4ab",
                  }}
                >
                  {log.amount > 0 ? `+${log.amount}` : log.amount}
                </div>
                <div style={{ fontSize: 10, color: "#47464f" }}>{fmtDate(log.createdAt)}</div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ============ LEADERBOARD TABLE (generic) ============
interface TableUser {
  uid: string;
  displayName: string;
  email: string;
  xp: number;
  level?: number;
  currentStreak?: number;
  role?: string;
}

function LeaderboardTable({
  users,
  loading,
  xpLabel,
  onAdjust,
  onHistory,
}: {
  users: TableUser[];
  loading: boolean;
  xpLabel: string;
  onAdjust: (u: any) => void;
  onHistory: (u: any) => void;
}) {
  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: 40 }}>
        <Loader size={28} color="#6C63FF" style={{ animation: "spin .8s linear infinite" }} />
      </div>
    );
  }

  if (users.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: 60, color: "#C7C4D8" }}>
        <Trophy size={32} style={{ marginBottom: 12, opacity: 0.5 }} />
        <p>Không có dữ liệu</p>
      </div>
    );
  }

  return (
    <div
      style={{
        background: "rgba(22,20,34,.7)",
        borderRadius: 20,
        border: "1px solid rgba(255,255,255,.06)",
        overflow: "auto",
      }}
    >
      <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 700 }}>
        <thead>
          <tr style={{ borderBottom: "1px solid rgba(255,255,255,.06)" }}>
            <th style={{ padding: "12px 16px", textAlign: "left", width: 70 }}>Hạng</th>
            <th style={{ padding: "12px 16px", textAlign: "left" }}>Người dùng</th>
            <th style={{ padding: "12px 16px", textAlign: "right" }}>{xpLabel}</th>
            <th style={{ padding: "12px 16px", textAlign: "center" }}>Level / Streak</th>
            <th style={{ padding: "12px 16px", textAlign: "center", width: 100 }}>Thao tác</th>
           </tr>
        </thead>
        <tbody>
          {users.map((u, idx) => {
            const rank = idx + 1;
            const medal = MEDAL[rank];
            return (
              <tr key={u.uid} style={{ borderBottom: "1px solid rgba(255,255,255,.04)" }}>
                <td style={{ padding: "12px 16px" }}>
                  {medal ? (
                    <span style={{ fontSize: 24 }}>{medal.emoji}</span>
                  ) : (
                    <span style={{ fontWeight: 700, color: rank <= 10 ? "#c4c0ff" : "#C7C4D8" }}>
                      #{rank}
                    </span>
                  )}
                 </td>
                <td style={{ padding: "12px 16px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: "50%",
                        background: ROLE_GRAD[u.role || "student"],
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 14,
                        fontWeight: 700,
                        color: "#fff",
                      }}
                    >
                      {initials(u.displayName)}
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, color: "#E4E1EE" }}>{u.displayName}</div>
                      <div style={{ fontSize: 11, color: "#C7C4D8" }}>{u.email}</div>
                    </div>
                  </div>
                 </td>
                <td style={{ padding: "12px 16px", textAlign: "right", fontWeight: 800, color: "#FFB785" }}>
                  {fmtNum(u.xp)} {xpLabel === "XP (tháng này)" ? "XP" : "XP"}
                 </td>
                <td style={{ padding: "12px 16px", textAlign: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                    {u.level && (
                      <span
                        style={{
                          padding: "2px 8px",
                          borderRadius: 8,
                          background: "rgba(196,192,255,.12)",
                          color: "#c4c0ff",
                          fontSize: 11,
                        }}
                      >
                        Lv.{u.level}
                      </span>
                    )}
                    {u.currentStreak && u.currentStreak > 0 && (
                      <span style={{ fontSize: 11, color: "#FFB785" }}>🔥 {u.currentStreak}</span>
                    )}
                  </div>
                 </td>
                <td style={{ padding: "12px 16px", textAlign: "center" }}>
                  <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
                    <button
                      onClick={() => onAdjust(u)}
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 8,
                        background: "rgba(108,99,255,.08)",
                        border: "1px solid rgba(108,99,255,.2)",
                        cursor: "pointer",
                        color: "#6C63FF",
                      }}
                    >
                      <Edit3 size={14} />
                    </button>
                    <button
                      onClick={() => onHistory(u)}
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 8,
                        background: "rgba(69,241,197,.06)",
                        border: "1px solid rgba(69,241,197,.2)",
                        cursor: "pointer",
                        color: "#45f1c5",
                      }}
                    >
                      <History size={14} />
                    </button>
                  </div>
                 </td>
               </tr>
            );
          })}
        </tbody>
       </table>
      <div
        style={{
          padding: "12px 16px",
          borderTop: "1px solid rgba(255,255,255,.05)",
          fontSize: 11,
          color: "#C7C4D8",
          display: "flex",
          justifyContent: "space-between",
        }}
      >
        <span>Top {users.length} người dùng</span>
        <code style={{ fontSize: 10, color: "#47464f" }}>
          {xpLabel === "XP (tháng này)" ? "· monthly aggregated" : "· users collection"}
        </code>
      </div>
    </div>
  );
}

// ============ MAIN ============
export default function LeaderboardAdmin() {
  const [activeTab, setActiveTab] = useState<"alltime" | "monthly">("alltime");
  const [search, setSearch] = useState("");
  const [adjustTarget, setAdjustTarget] = useState<LeaderboardUser | null>(null);
  const [historyTarget, setHistoryTarget] = useState<LeaderboardUser | null>(null);
  const { toasts, add: addToast } = useToast();
  const { activeEvent } = useEvents();

  // All-time data (real-time)
  const {
    data: usersData,
    loading: allTimeLoading,
    error: allTimeError,
    refetch,
  } = useCollection<any>("users", [orderBy("totalXP", "desc"), limit(100)]);

  const allTimeUsers: LeaderboardUser[] = useMemo(() => {
    if (!usersData) return [];
    return usersData.map((doc, idx) => ({
      uid: doc.id,
      displayName: doc.displayName || doc.name || "Unknown",
      email: doc.email || "",
      xp: doc.totalXP ?? 0,
      level: doc.level ?? 1,
      currentStreak: doc.currentStreak ?? 0,
      role: doc.role ?? "student",
      rank: idx + 1,
    }));
  }, [usersData]);

  // Monthly data (fetch on tab change)
  const [monthlyUsers, setMonthlyUsers] = useState<MonthlyUser[]>([]);
  const [monthlyLoading, setMonthlyLoading] = useState(false);
  const [monthlyError, setMonthlyError] = useState<string | null>(null);

  useEffect(() => {
    if (activeTab === "monthly") {
      setMonthlyLoading(true);
      getAllUsersMonthlyXP(100)
        .then((data) => {
          setMonthlyUsers(data);
          setMonthlyError(null);
        })
        .catch((err) => {
          console.error("Failed to fetch monthly XP:", err);
          setMonthlyError(err.message);
        })
        .finally(() => setMonthlyLoading(false));
    }
  }, [activeTab]);

  // Filter logic
  const filteredAllTime = useMemo(() => {
    if (!search) return allTimeUsers;
    const s = search.toLowerCase();
    return allTimeUsers.filter(
      (u) => u.displayName.toLowerCase().includes(s) || u.email.toLowerCase().includes(s)
    );
  }, [allTimeUsers, search]);

  const filteredMonthly = useMemo(() => {
    if (!search) return monthlyUsers;
    const s = search.toLowerCase();
    return monthlyUsers.filter(
      (u) => u.displayName.toLowerCase().includes(s) || u.email.toLowerCase().includes(s)
    );
  }, [monthlyUsers, search]);

  const handleAdjustXP = useCallback(
    async (amount: number, reason: string) => {
      if (!adjustTarget) return;
      try {
        const result = await updateUserXP(adjustTarget.uid, amount, reason);
        if (!result.success) throw new Error(result.message);
        addToast(
          `${amount > 0 ? "+" : ""}${fmtNum(amount)} XP cho ${adjustTarget.displayName}`,
          amount > 0 ? "success" : "info"
        );
      } catch (err: any) {
        addToast(err.message || "Lỗi khi cập nhật XP", "error");
      }
      setAdjustTarget(null);
    },
    [adjustTarget, addToast]
  );

  const currentLoading = activeTab === "alltime" ? allTimeLoading : monthlyLoading;
  const currentError = activeTab === "alltime" ? allTimeError : monthlyError;
  const currentUsers = activeTab === "alltime" ? filteredAllTime : filteredMonthly;

  const tableUsers = activeTab === "alltime"
    ? filteredAllTime
    : filteredMonthly.map((u) => ({
        uid: u.userId,
        displayName: u.displayName,
        email: u.email,
        xp: u.monthlyXP,
        level: 0,
        currentStreak: 0,
        role: "student",
      }));

  return (
    <div style={{ minHeight: "100vh", background: "#0F0F1A", color: "#E4E1EE" }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes slideInR { from { opacity: 0; transform: translateX(20px); } to { opacity: 1; transform: translateX(0); } }
      `}</style>
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "28px 24px", display: "flex", flexDirection: "column", gap: 24 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 14,
          }}
        >
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 800, display: "flex", alignItems: "center", gap: 12 }}>
              <div
                style={{
                  width: 46,
                  height: 46,
                  borderRadius: 14,
                  background: "linear-gradient(135deg,#6C63FF,#9B59B6)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Trophy size={22} color="#fff" />
              </div>
              Quản lý Bảng xếp hạng
            </h1>
            <p style={{ color: "#C7C4D8", marginTop: 4 }}>
              Firestore: all-time (users) · monthly (xp_logs aggregated)
            </p>
          </div>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            {activeEvent && (
              <div
                style={{
                  background: `${activeEvent.color}20`,
                  border: `1px solid ${activeEvent.color}50`,
                  borderRadius: 20,
                  padding: "6px 14px",
                  fontSize: 13,
                  fontWeight: 600,
                  color: activeEvent.color,
                }}
              >
                🎉 {activeEvent.name} ×{activeEvent.multiplier}
              </div>
            )}
            <button
              onClick={refetch}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 16px",
                borderRadius: 12,
                background: "rgba(255,255,255,.04)",
                border: "1px solid rgba(255,255,255,.08)",
                color: "#C7C4D8",
                cursor: "pointer",
              }}
            >
              <RefreshCw size={14} /> Làm mới
            </button>
          </div>
        </div>

        {/* Tab switcher */}
        <div
          style={{
            display: "flex",
            gap: 8,
            background: "rgba(255,255,255,.03)",
            borderRadius: 14,
            padding: 4,
            width: "fit-content",
          }}
        >
          <button
            onClick={() => setActiveTab("alltime")}
            style={{
              padding: "8px 24px",
              borderRadius: 12,
              fontSize: 14,
              fontWeight: 700,
              cursor: "pointer",
              background:
                activeTab === "alltime" ? "linear-gradient(135deg,#6C63FF,#9B59B6)" : "transparent",
              border: activeTab === "alltime" ? "1px solid rgba(108,99,255,.3)" : "1px solid transparent",
              color: activeTab === "alltime" ? "#fff" : "#C7C4D8",
            }}
          >
            🏆 Tổng cộng
          </button>
          <button
            onClick={() => setActiveTab("monthly")}
            style={{
              padding: "8px 24px",
              borderRadius: 12,
              fontSize: 14,
              fontWeight: 700,
              cursor: "pointer",
              background:
                activeTab === "monthly" ? "linear-gradient(135deg,#6C63FF,#9B59B6)" : "transparent",
              border: activeTab === "monthly" ? "1px solid rgba(108,99,255,.3)" : "1px solid transparent",
              color: activeTab === "monthly" ? "#fff" : "#C7C4D8",
            }}
          >
            📅 Tháng này
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ position: "relative", maxWidth: 320 }}>
            <Search
              size={14}
              style={{
                position: "absolute",
                left: 12,
                top: "50%",
                transform: "translateY(-50%)",
                color: "#C7C4D8",
              }}
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm theo tên hoặc email..."
              style={{
                width: "100%",
                background: "#0d0d18",
                border: "1px solid rgba(255,255,255,.08)",
                borderRadius: 12,
                padding: "10px 12px 10px 34px",
                color: "#E4E1EE",
              }}
            />
          </div>

          {currentError ? (
            <div style={{ textAlign: "center", padding: 60, color: "#ffb4ab" }}>
              <AlertTriangle size={48} />
              <p>{(currentError as any)?.message || "Lỗi tải dữ liệu"}</p>
              {activeTab === "alltime" && (
                <button
                  onClick={refetch}
                  style={{
                    marginTop: 16,
                    padding: "8px 20px",
                    borderRadius: 12,
                    background: "linear-gradient(135deg,#6C63FF,#9B59B6)",
                    border: "none",
                    color: "#fff",
                    cursor: "pointer",
                  }}
                >
                  Thử lại
                </button>
              )}
              {activeTab === "monthly" && (
                <button
                  onClick={() => setActiveTab("monthly")}
                  style={{
                    marginTop: 16,
                    padding: "8px 20px",
                    borderRadius: 12,
                    background: "linear-gradient(135deg,#6C63FF,#9B59B6)",
                    border: "none",
                    color: "#fff",
                    cursor: "pointer",
                  }}
                >
                  Tải lại
                </button>
              )}
            </div>
          ) : (
            <LeaderboardTable
              users={tableUsers}
              loading={currentLoading}
              xpLabel={activeTab === "alltime" ? "Tổng XP" : "XP (tháng này)"}
              onAdjust={activeTab === "alltime" ? setAdjustTarget : () => {}}
              onHistory={setHistoryTarget}
            />
          )}
        </div>
      </div>

      {adjustTarget && (
        <XPAdjustmentModal user={adjustTarget} onConfirm={handleAdjustXP} onClose={() => setAdjustTarget(null)} />
      )}
      {historyTarget && <XPHistoryModal user={historyTarget} onClose={() => setHistoryTarget(null)} />}
      <ToastContainer toasts={toasts} />
    </div>
  );
}
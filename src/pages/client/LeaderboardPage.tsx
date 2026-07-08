// src/pages/client/LeaderboardPage.tsx
import React, { useMemo, useState, useEffect, useRef } from "react";
import { useCollection } from "../../hooks/useFirestore";
import { orderBy, limit } from "firebase/firestore";
import { useAuth } from "../../contexts/AuthContext";
import { Trophy, Zap, Flame, Search, Loader, Crown, Sparkles } from "lucide-react";
import { getLevelInfo } from "../../services/levelService";
import { LevelBadge } from "../../components/common/LevelBadge";
import { checkAndUnlockAchievementsLegacy } from "../../services/achievementService";

interface LeaderboardUser {
  uid: string;
  displayName: string;
  email: string;
  photoURL?: string;
  totalXP: number;
  currentStreak: number;
  role: string;
}

const ROLE_GRAD: Record<string, string> = {
  student: "linear-gradient(135deg,#6C63FF,#9B59B6)",
  instructor: "linear-gradient(135deg,#00D4AA,#0F9E7B)",
  moderator: "linear-gradient(135deg,#FFB785,#FF8C42)",
  admin: "linear-gradient(135deg,#FFD700,#FF8C42)",
};

function initials(name: string) {
  return name.split(" ").map((w) => w[0]?.toUpperCase() || "").slice(0, 2).join("");
}

const fmtNum = (n: number) => new Intl.NumberFormat().format(n);

export default function LeaderboardPage() {
  const { currentUser } = useAuth();
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"xp" | "streak">("xp");
  const hasTriggeredRank = useRef(false);

  const {
    data: usersData,
    loading,
    error,
  } = useCollection<any>(
    "users",
    [orderBy(sortBy === "xp" ? "totalXP" : "currentStreak", "desc"), limit(100)]
  );

  const users: LeaderboardUser[] = useMemo(() => {
    if (!usersData) return [];
    return usersData.map((doc) => ({
      uid: doc.id,
      displayName: doc.displayName || doc.name || "Unknown",
      email: doc.email || "",
      photoURL: doc.photoURL,
      totalXP: doc.totalXP || 0,
      currentStreak: doc.currentStreak || 0,
      role: doc.role || "student",
    }));
  }, [usersData]);

  const filtered = useMemo(() => {
    if (!search) return users;
    const lower = search.toLowerCase();
    return users.filter(
      (u) => u.displayName.toLowerCase().includes(lower) || u.email.toLowerCase().includes(lower)
    );
  }, [users, search]);

  const currentUserId = currentUser?.uid;
  const currentUserRank = useMemo(() => {
    const idx = filtered.findIndex((u) => u.uid === currentUserId);
    return idx !== -1 ? idx + 1 : null;
  }, [filtered, currentUserId]);

  useEffect(() => {
    if (!currentUser || currentUserRank === null || hasTriggeredRank.current) return;
    const rank = currentUserRank;
    const thresholds = [1, 3, 10];
    for (const th of thresholds) {
      if (rank <= th) {
        checkAndUnlockAchievementsLegacy(currentUser.uid, "leaderboard_rank", th, { leaderboardRank: rank });
        hasTriggeredRank.current = true;
        break;
      }
    }
  }, [currentUser, currentUserRank]);

  if (loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", height: "60vh", gap: 16 }}>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <div style={{
          width: 52, height: 52, borderRadius: 16,
          background: "linear-gradient(135deg,#6C63FF,#9B59B6)",
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 0 28px rgba(108,99,255,0.4)",
          animation: "spin 1.5s linear infinite",
        }}>
          <Loader size={24} color="#fff" />
        </div>
        <span style={{ fontSize: 13, color: "#C7C4D8", fontWeight: 600 }}>Đang tải bảng xếp hạng...</span>
      </div>
    );
  }
  if (error) return <div style={{ padding: 24, color: "#ffb4ab" }}>Error: {error.message}</div>;

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto", padding: "24px" }}>
      <style>{`
        @keyframes spin    { to { transform: rotate(360deg); } }
        @keyframes fadeUp  { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
        @keyframes glow    { 0%,100%{box-shadow:0 0 20px rgba(255,215,0,0.3)} 50%{box-shadow:0 0 35px rgba(255,215,0,0.6)} }
      `}</style>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <Sparkles size={14} color="#FFD700" />
            <span style={{ fontSize: 11, fontWeight: 800, color: "#FFB785", textTransform: "uppercase", letterSpacing: ".1em" }}>Hall of Fame</span>
          </div>
          <h1 style={{ fontSize: 32, fontWeight: 900, color: "#E4E1EE", display: "flex", alignItems: "center", gap: 10, letterSpacing: "-.02em", margin: "0 0 4px" }}>
            <Trophy size={30} color="#FFD700" style={{ filter: "drop-shadow(0 0 8px rgba(255,215,0,0.5))" }} /> Leaderboard
          </h1>
          <p style={{ color: "#C7C4D8", fontSize: 13, margin: 0 }}>Top học viên theo {sortBy === "xp" ? "Tổng XP" : "Streak liên tục"}</p>
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          <button
            onClick={() => setSortBy("xp")}
            style={{
              padding: "8px 16px",
              borderRadius: 40,
              background: sortBy === "xp" ? "linear-gradient(135deg,#6C63FF,#9B59B6)" : "rgba(255,255,255,0.05)",
              border: "none",
              color: sortBy === "xp" ? "#fff" : "#C7C4D8",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            🏆 XP
          </button>
          <button
            onClick={() => setSortBy("streak")}
            style={{
              padding: "8px 16px",
              borderRadius: 40,
              background: sortBy === "streak" ? "linear-gradient(135deg,#6C63FF,#9B59B6)" : "rgba(255,255,255,0.05)",
              border: "none",
              color: sortBy === "streak" ? "#fff" : "#C7C4D8",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            🔥 Streak
          </button>
        </div>
      </div>

      <div style={{ position: "relative", marginBottom: 24 }}>
        <Search size={16} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#C7C4D8" }} />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or email..."
          style={{
            width: "100%",
            background: "rgba(26,26,46,0.6)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 40,
            padding: "12px 16px 12px 40px",
            color: "#E4E1EE",
          }}
        />
      </div>

      {/* Podium top 3 */}
      {filtered.length >= 3 && !search && (
        <div style={{ display: "flex", justifyContent: "center", alignItems: "flex-end", gap: 16, marginBottom: 32, padding: "0 8px" }}>
          {[1, 0, 2].map((podiumIdx) => {
            const u = filtered[podiumIdx];
            if (!u) return null;
            const podiumRank = podiumIdx + 1;
            const heights = [140, 180, 110];
            const medals = ["🥈", "🥇", "🥉"];
            const colors = ["#C0C0C0","#FFD700","#CD7F32"];
            const glows  = ["rgba(192,192,192,0.3)","rgba(255,215,0,0.4)","rgba(205,127,50,0.3)"];
            const h = heights[podiumIdx];
            const isFirst = podiumIdx === 0;
            const levelI = getLevelInfo(u.totalXP);
            return (
              <div key={u.uid} style={{ flex: 1, maxWidth: 220, display: "flex", flexDirection: "column", alignItems: "center", gap: 10, animation: "fadeUp .5s ease" }}>
                {isFirst && <Crown size={22} color="#FFD700" style={{ filter: "drop-shadow(0 0 8px rgba(255,215,0,0.7))" }} />}
                <div style={{
                  width: 60, height: 60, borderRadius: "50%",
                  background: ROLE_GRAD[u.role] || ROLE_GRAD.student,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 20, fontWeight: 800, color: "#fff",
                  border: `3px solid ${colors[podiumIdx]}`,
                  boxShadow: `0 0 20px ${glows[podiumIdx]}`,
                  animation: isFirst ? "glow 2s ease infinite" : "none",
                }}>{initials(u.displayName)}</div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#E4E1EE" }}>{u.displayName}</div>
                  <div style={{ fontSize: 11, color: "#C7C4D8" }}>{fmtNum(u.totalXP)} XP</div>
                </div>
                <div style={{
                  width: "100%", height: h,
                  background: `linear-gradient(to top, ${colors[podiumIdx]}22, ${colors[podiumIdx]}08)`,
                  border: `1px solid ${colors[podiumIdx]}40`,
                  borderRadius: "12px 12px 0 0",
                  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4,
                }}>
                  <span style={{ fontSize: 32 }}>{medals[podiumIdx]}</span>
                  <span style={{ fontSize: 15, fontWeight: 800, color: colors[podiumIdx] }}>#{podiumRank}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div style={{ background: "rgba(26,26,46,0.6)", borderRadius: 24, border: "1px solid rgba(255,255,255,0.06)", overflow: "hidden" }}>
        {filtered.map((user, idx) => {
          const rank = idx + 1;
          let medalEmoji = "";
          if (rank === 1) medalEmoji = "🥇";
          else if (rank === 2) medalEmoji = "🥈";
          else if (rank === 3) medalEmoji = "🥉";
          const isCurrentUser = user.uid === currentUserId;
          const levelInfo = getLevelInfo(user.totalXP);

          return (
            <div
              key={user.uid}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 16,
                padding: "14px 20px",
                borderBottom: "1px solid rgba(255,255,255,0.05)",
                background: isCurrentUser ? "rgba(108,99,255,0.15)" : "transparent",
                transition: "background 0.2s",
                borderLeft: isCurrentUser ? "3px solid #6C63FF" : "none",
              }}
            >
              <div style={{ width: 50, textAlign: "center", fontWeight: 700, fontSize: 18 }}>
                {medalEmoji ? <span style={{ fontSize: 24 }}>{medalEmoji}</span> : `#${rank}`}
              </div>
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: "50%",
                  background: ROLE_GRAD[user.role] || ROLE_GRAD.student,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 18,
                  fontWeight: 800,
                  color: "#fff",
                  flexShrink: 0,
                }}
              >
                {initials(user.displayName)}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, color: "#E4E1EE" }}>{user.displayName}</div>
                <div style={{ fontSize: 12, color: "#C7C4D8" }}>{user.role}</div>
              </div>
              <div style={{ textAlign: "right", minWidth: 100 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 5, justifyContent: "flex-end" }}>
                  <Zap size={14} fill="#FFB785" color="#FFB785" />
                  <span style={{ fontWeight: 800, color: "#FFB785" }}>{fmtNum(user.totalXP)} XP</span>
                </div>
                <div style={{ fontSize: 12, color: "#C7C4D8", display: "flex", alignItems: "center", gap: 5, justifyContent: "flex-end" }}>
                  <Flame size={12} color="#ff6b6b" /> {user.currentStreak} days
                </div>
              </div>
              <LevelBadge
                level={levelInfo.level}
                title={levelInfo.title}
                icon={levelInfo.icon}
                color={levelInfo.color}
                size="sm"
              />
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div style={{ textAlign: "center", padding: 40, color: "#C7C4D8" }}>No users found</div>
        )}
      </div>

      {currentUserRank && (
        <div
          style={{
            marginTop: 24,
            padding: "14px 20px",
            background: "rgba(108,99,255,0.15)",
            borderRadius: 40,
            textAlign: "center",
            border: "1px solid rgba(108,99,255,0.3)",
          }}
        >
          🔥 Your rank: <strong>#{currentUserRank}</strong> out of {filtered.length} learners
        </div>
      )}
    </div>
  );
}
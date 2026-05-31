/**
 * UserStatsCards.tsx
 * Displays user statistics: total users, new users, premium users, top XP users
 */

import React, { useEffect, useState } from "react";
import { Users, UserPlus, Crown, Award, Loader, RefreshCw, Trophy } from "lucide-react";
import { getUserStats, getTopUsers, type TopUser } from "../../../../services/analyticsService";

const formatNumber = (value: number) => value.toLocaleString();

interface StatCardProps {
  title: string;
  value: string;
  subtext?: string;
  icon: React.ElementType;
  color: string;
  bgGlow: string;
}

function StatCard({ title, value, subtext, icon: Icon, color, bgGlow }: StatCardProps) {
  return (
    <div
      style={{
        background: "rgba(26,26,46,.65)",
        border: `1px solid ${color}30`,
        borderRadius: 20,
        padding: "18px 20px",
        backdropFilter: "blur(12px)",
        boxShadow: `0 4px 20px ${bgGlow}`,
        transition: "transform 0.2s",
      }}
      onMouseOver={(e) => (e.currentTarget.style.transform = "translateY(-2px)")}
      onMouseOut={(e) => (e.currentTarget.style.transform = "translateY(0)")}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            background: `${color}18`,
            border: `1px solid ${color}30`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon size={18} color={color} />
        </div>
        <span style={{ fontSize: 12, fontWeight: 700, color: "#C7C4D8", letterSpacing: ".07em", textTransform: "uppercase" }}>
          {title}
        </span>
      </div>
      <div style={{ fontSize: 28, fontWeight: 800, color: color, marginBottom: 4 }}>{value}</div>
      {subtext && <div style={{ fontSize: 12, color: "#C7C4D8" }}>{subtext}</div>}
    </div>
  );
}

function TopUserRow({ user, rank }: { user: TopUser; rank: number }) {
  const getRankColor = () => {
    if (rank === 1) return "#FFD700";
    if (rank === 2) return "#C0C0C0";
    if (rank === 3) return "#CD7F32";
    return "#C7C4D8";
  };

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "10px 0",
        borderBottom: "1px solid rgba(255,255,255,.04)",
      }}
    >
      <div style={{ width: 28, textAlign: "center" }}>
        {rank <= 3 ? (
          <Trophy size={16} color={getRankColor()} />
        ) : (
          <span style={{ fontSize: 12, color: "#C7C4D8", fontWeight: 600 }}>{rank}</span>
        )}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 600, color: "#E4E1EE" }}>{user.displayName}</div>
        <div style={{ fontSize: 11, color: "#C7C4D8" }}>{user.email}</div>
      </div>
      <div style={{ textAlign: "right" }}>
        <div style={{ fontWeight: 700, color: "#45f1c5" }}>
          {new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(user.totalSpent)}
        </div>
        <div style={{ fontSize: 11, color: "#FFB785" }}>{formatNumber(user.totalXP)} XP</div>
      </div>
    </div>
  );
}

export default function UserStatsCards() {
  const [userStats, setUserStats] = useState<{
    totalUsers: number;
    newUsersLast30Days: number;
    premiumUsers: number;
    avgXP: number;
  } | null>(null);
  const [topUsers, setTopUsers] = useState<TopUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [stats, top] = await Promise.all([getUserStats(), getTopUsers(5)]);
      setUserStats(stats);
      setTopUsers(top);
    } catch (err) {
      console.error("Failed to fetch user stats:", err);
      setError("Không thể tải thống kê người dùng");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  if (loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16 }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              style={{
                height: 120,
                borderRadius: 20,
                background: "linear-gradient(90deg,#1f1f2c 25%,#2a2935 50%,#1f1f2c 75%)",
                backgroundSize: "200% 100%",
                animation: "shimmer 1.4s infinite",
              }}
            />
          ))}
        </div>
        <div
          style={{
            background: "rgba(26,26,46,.65)",
            borderRadius: 20,
            border: "1px solid rgba(255,255,255,.06)",
            padding: 24,
            minHeight: 300,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Loader size={32} color="#6C63FF" style={{ animation: "spin 0.8s linear infinite" }} />
        </div>
      </div>
    );
  }

  if (error || !userStats) {
    return (
      <div
        style={{
          background: "rgba(26,26,46,.65)",
          borderRadius: 20,
          border: "1px solid rgba(255,255,255,.06)",
          padding: 24,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 16,
          minHeight: 400,
        }}
      >
        <p style={{ color: "#ffb4ab" }}>{error || "Không có dữ liệu"}</p>
        <button
          onClick={fetchData}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 20px",
            borderRadius: 12,
            background: "linear-gradient(135deg,#6C63FF,#9B59B6)",
            border: "none",
            color: "#fff",
            cursor: "pointer",
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          <RefreshCw size={14} /> Thử lại
        </button>
      </div>
    );
  }

  const cards = [
    {
      title: "Tổng người dùng",
      value: formatNumber(userStats.totalUsers),
      subtext: "từ Firestore",
      icon: Users,
      color: "#6C63FF",
      bgGlow: "rgba(108,99,255,.1)",
    },
    {
      title: "Người dùng mới",
      value: formatNumber(userStats.newUsersLast30Days),
      subtext: "30 ngày qua",
      icon: UserPlus,
      color: "#45f1c5",
      bgGlow: "rgba(69,241,197,.08)",
    },
    {
      title: "Người dùng trả phí",
      value: formatNumber(userStats.premiumUsers),
      subtext: "đã mua ít nhất 1 khóa học",
      icon: Crown,
      color: "#FFB785",
      bgGlow: "rgba(255,183,133,.08)",
    },
    {
      title: "XP trung bình",
      value: formatNumber(userStats.avgXP),
      subtext: "mỗi người dùng",
      icon: Award,
      color: "#c4c0ff",
      bgGlow: "rgba(196,192,255,.08)",
    },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16 }}>
        {cards.map((card) => (
          <StatCard key={card.title} {...card} />
        ))}
      </div>

      <div
        style={{
          background: "rgba(26,26,46,.65)",
          borderRadius: 20,
          border: "1px solid rgba(255,255,255,.06)",
          overflow: "hidden",
          backdropFilter: "blur(12px)",
        }}
      >
        <div
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid rgba(255,255,255,.06)",
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: "rgba(108,99,255,.15)",
              border: "1px solid rgba(108,99,255,.25)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Trophy size={18} color="#6C63FF" />
          </div>
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: "#E4E1EE" }}>Top chi tiêu</h3>
            <p style={{ fontSize: 11, color: "#C7C4D8" }}>Người dùng có tổng chi tiêu cao nhất</p>
          </div>
        </div>
        <div style={{ padding: "4px 20px" }}>
          {topUsers.length === 0 ? (
            <div style={{ textAlign: "center", padding: 40, color: "#C7C4D8" }}>
              <p>Chưa có người dùng nào mua khóa học</p>
            </div>
          ) : (
            topUsers.map((user, idx) => <TopUserRow key={user.uid} user={user} rank={idx + 1} />)
          )}
        </div>
      </div>
    </div>
  );
}
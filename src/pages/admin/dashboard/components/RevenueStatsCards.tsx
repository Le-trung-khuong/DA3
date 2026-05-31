/**
 * RevenueStatsCards.tsx
 * Displays revenue summary cards (today, month, year, total)
 * Fetches data via analyticsService
 */

import React, { useEffect, useState } from "react";
import { DollarSign, TrendingUp, Calendar, Award } from "lucide-react";
import { getRevenueStats, type RevenueStats } from "../../../../services/analyticsService";

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(value);
};

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

export default function RevenueStatsCards() {
  const [stats, setStats] = useState<RevenueStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchStats() {
      try {
        setLoading(true);
        const data = await getRevenueStats();
        setStats(data);
        setError(null);
      } catch (err) {
        console.error("Failed to fetch revenue stats:", err);
        setError("Không thể tải dữ liệu doanh thu");
      } finally {
        setLoading(false);
      }
    }
    fetchStats();
  }, []);

  if (loading) {
    return (
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
    );
  }

  if (error || !stats) {
    return (
      <div style={{ padding: 20, textAlign: "center", color: "#ffb4ab" }}>
        <p>{error || "No data"}</p>
      </div>
    );
  }

  const cards = [
    {
      title: "Hôm nay",
      value: formatCurrency(stats.todayRevenue),
      subtext: `${stats.todayCount} giao dịch`,
      icon: Calendar,
      color: "#FFB785",
      bgGlow: "rgba(255,183,133,.08)",
    },
    {
      title: "Tháng này",
      value: formatCurrency(stats.monthlyRevenue),
      subtext: `${stats.monthlyCount} giao dịch`,
      icon: TrendingUp,
      color: "#45f1c5",
      bgGlow: "rgba(69,241,197,.08)",
    },
    {
      title: "Năm nay",
      value: formatCurrency(stats.yearlyRevenue),
      subtext: `${stats.yearlyCount} giao dịch`,
      icon: Award,
      color: "#c4c0ff",
      bgGlow: "rgba(196,192,255,.08)",
    },
    {
      title: "Tổng doanh thu",
      value: formatCurrency(stats.totalRevenue),
      subtext: `${stats.totalCount} giao dịch thành công`,
      icon: DollarSign,
      color: "#6C63FF",
      bgGlow: "rgba(108,99,255,.1)",
    },
  ];

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16 }}>
      {cards.map((card) => (
        <StatCard key={card.title} {...card} />
      ))}
    </div>
  );
}
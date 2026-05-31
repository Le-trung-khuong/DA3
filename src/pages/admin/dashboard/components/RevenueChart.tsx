/**
 * RevenueChart.tsx
 * Line chart for revenue trend (7 days / 30 days / 12 months)
 * Uses recharts library
 */

import React, { useEffect, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { Calendar, TrendingUp, BarChart3, Loader } from "lucide-react";
import { getRevenueTrend, type RevenuePoint } from "../../../../services/analyticsService";

type Period = "7days" | "30days" | "12months";

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(value);
};

const formatShortDate = (dateStr: string) => {
  const parts = dateStr.split("-");
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}`;
  }
  return dateStr;
};

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ value: number; payload: RevenuePoint }>;
  label?: string;
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (active && payload && payload.length) {
    return (
      <div
        style={{
          background: "rgba(26,26,46,.97)",
          border: "1px solid rgba(108,99,255,.3)",
          borderRadius: 12,
          padding: "10px 16px",
          backdropFilter: "blur(12px)",
        }}
      >
        <p style={{ color: "#C7C4D8", fontSize: 12, marginBottom: 6 }}>{label}</p>
        <p style={{ color: "#45f1c5", fontSize: 14, fontWeight: 700 }}>
          Doanh thu: {formatCurrency(payload[0].value)}
        </p>
        <p style={{ color: "#FFB785", fontSize: 12, marginTop: 4 }}>
          Giao dịch: {payload[0].payload.count}
        </p>
      </div>
    );
  }
  return null;
}

interface RevenueChartProps {
  period?: Period;
  onPeriodChange?: (period: Period) => void;
}

export default function RevenueChart({ period = "30days", onPeriodChange }: RevenueChartProps) {
  const [data, setData] = useState<RevenuePoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activePeriod, setActivePeriod] = useState<Period>(period);

  const fetchData = async (p: Period) => {
    setLoading(true);
    setError(null);
    try {
      let days = 30;
      if (p === "7days") days = 7;
      if (p === "30days") days = 30;
      if (p === "12months") {
        // For 12 months, we need special handling
        const allData = await getRevenueTrend(365);
        // Aggregate by month
        const monthMap = new Map<string, { revenue: number; count: number }>();
        allData.forEach((point) => {
          const month = point.date.substring(0, 7); // YYYY-MM
          const existing = monthMap.get(month) || { revenue: 0, count: 0 };
          existing.revenue += point.revenue;
          existing.count += point.count;
          monthMap.set(month, existing);
        });
        const monthData = Array.from(monthMap.entries())
          .map(([date, { revenue, count }]) => ({ date, revenue, count }))
          .sort((a, b) => a.date.localeCompare(b.date))
          .slice(-12);
        setData(monthData);
        setLoading(false);
        return;
      }
      const trendData = await getRevenueTrend(days);
      setData(trendData);
    } catch (err) {
      console.error("Failed to fetch revenue trend:", err);
      setError("Không thể tải dữ liệu xu hướng doanh thu");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(activePeriod);
  }, [activePeriod]);

  const handlePeriodChange = (newPeriod: Period) => {
    setActivePeriod(newPeriod);
    if (onPeriodChange) onPeriodChange(newPeriod);
  };

  const getPeriodLabel = (p: Period) => {
    switch (p) {
      case "7days": return "7 ngày qua";
      case "30days": return "30 ngày qua";
      case "12months": return "12 tháng qua";
      default: return "30 ngày qua";
    }
  };

  const formatXAxis = (value: string) => {
    if (activePeriod === "12months") {
      const parts = value.split("-");
      if (parts.length === 2) {
        return `Th ${parts[1]}`;
      }
      return value;
    }
    return formatShortDate(value);
  };

  if (loading) {
    return (
      <div
        style={{
          background: "rgba(26,26,46,.65)",
          borderRadius: 20,
          border: "1px solid rgba(255,255,255,.06)",
          padding: 24,
          minHeight: 380,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <Loader size={32} color="#6C63FF" style={{ animation: "spin 0.8s linear infinite" }} />
          <p style={{ color: "#C7C4D8", marginTop: 16 }}>Đang tải dữ liệu...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        style={{
          background: "rgba(26,26,46,.65)",
          borderRadius: 20,
          border: "1px solid rgba(255,255,255,.06)",
          padding: 24,
          minHeight: 380,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div style={{ textAlign: "center", color: "#ffb4ab" }}>
          <BarChart3 size={32} />
          <p style={{ marginTop: 12 }}>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        background: "rgba(26,26,46,.65)",
        borderRadius: 20,
        border: "1px solid rgba(255,255,255,.06)",
        padding: 20,
        backdropFilter: "blur(12px)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 20,
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
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
            <TrendingUp size={18} color="#6C63FF" />
          </div>
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: "#E4E1EE" }}>Xu hướng doanh thu</h3>
            <p style={{ fontSize: 11, color: "#C7C4D8" }}>{getPeriodLabel(activePeriod)}</p>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, background: "rgba(255,255,255,.03)", borderRadius: 12, padding: 4 }}>
          {(["7days", "30days", "12months"] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => handlePeriodChange(p)}
              style={{
                padding: "6px 16px",
                borderRadius: 10,
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
                transition: "all 0.15s",
                background: activePeriod === p ? "linear-gradient(135deg,#6C63FF,#9B59B6)" : "transparent",
                border: activePeriod === p ? "1px solid rgba(108,99,255,.3)" : "1px solid transparent",
                color: activePeriod === p ? "#fff" : "#C7C4D8",
              }}
            >
              {p === "7days" && "7 ngày"}
              {p === "30days" && "30 ngày"}
              {p === "12months" && "12 tháng"}
            </button>
          ))}
        </div>
      </div>

      <ResponsiveContainer width="100%" height={320}>
        <LineChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#45f1c5" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#45f1c5" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.04)" vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fill: "#C7C4D8", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={formatXAxis}
            interval={activePeriod === "7days" ? 0 : activePeriod === "30days" ? 3 : 1}
          />
          <YAxis
            tick={{ fill: "#C7C4D8", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(value) => formatCurrency(value)}
            width={80}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ stroke: "rgba(108,99,255,.3)", strokeWidth: 1 }} />
          <Legend
            wrapperStyle={{ fontSize: 12, color: "#C7C4D8", paddingTop: 16 }}
            formatter={(value) => <span style={{ color: "#C7C4D8" }}>Doanh thu</span>}
          />
          <Line
            type="monotone"
            dataKey="revenue"
            name="Doanh thu"
            stroke="#45f1c5"
            strokeWidth={2.5}
            dot={{ fill: "#45f1c5", stroke: "#0F0F1A", strokeWidth: 2, r: 4 }}
            activeDot={{ r: 6, fill: "#45f1c5", stroke: "#fff", strokeWidth: 2 }}
            fill="url(#revenueGradient)"
          />
        </LineChart>
      </ResponsiveContainer>

      <div
        style={{
          marginTop: 16,
          paddingTop: 12,
          borderTop: "1px solid rgba(255,255,255,.06)",
          display: "flex",
          justifyContent: "space-between",
          fontSize: 11,
          color: "#47464f",
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <Calendar size={12} /> Dữ liệu từ giao dịch thành công
        </span>
        <span>Tổng doanh thu {activePeriod === "12months" ? "12 tháng" : activePeriod === "30days" ? "30 ngày" : "7 ngày"} qua</span>
      </div>
    </div>
  );
}
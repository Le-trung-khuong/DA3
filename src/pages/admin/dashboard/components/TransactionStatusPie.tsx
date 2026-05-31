/**
 * TransactionStatusPie.tsx
 * Pie chart for transaction status distribution
 * Uses recharts library
 */

import React, { useEffect, useState } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { CreditCard, Loader } from "lucide-react";
import { getTransactionStats, type TransactionStats } from "../../../../services/analyticsService";

const STATUS_CONFIG: Record<
  keyof TransactionStats,
  { label: string; color: string; bg: string; icon: React.ElementType }
> = {
  pending: { label: "Chờ thanh toán", color: "#FFB785", bg: "rgba(255,183,133,.12)", icon: CreditCard },
  processing: { label: "Đang xử lý", color: "#c4c0ff", bg: "rgba(196,192,255,.12)", icon: CreditCard },
  success: { label: "Thành công", color: "#45f1c5", bg: "rgba(69,241,197,.12)", icon: CreditCard },
  failed: { label: "Thất bại", color: "#ffb4ab", bg: "rgba(255,180,171,.12)", icon: CreditCard },
  refunded: { label: "Hoàn tiền", color: "#B0AEC0", bg: "rgba(176,174,192,.12)", icon: CreditCard },
  cancelled: { label: "Đã hủy", color: "#47464f", bg: "rgba(71,70,79,.12)", icon: CreditCard },
};

interface PieDataItem {
  name: string;
  value: number;
  color: string;
  statusKey: keyof TransactionStats;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    payload: PieDataItem;
    value: number;
    percent: number;
  }>;
}

function CustomTooltip({ active, payload }: CustomTooltipProps) {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const percent = (payload[0].value / (payload[0].payload.total || 1)) * 100;
    return (
      <div
        style={{
          background: "rgba(26,26,46,.97)",
          border: `1px solid ${data.color}40`,
          borderRadius: 12,
          padding: "10px 16px",
          backdropFilter: "blur(12px)",
        }}
      >
        <p style={{ color: data.color, fontSize: 13, fontWeight: 700, marginBottom: 4 }}>
          {data.name}
        </p>
        <p style={{ color: "#E4E1EE", fontSize: 20, fontWeight: 800 }}>
          {data.value.toLocaleString()}
        </p>
        <p style={{ color: "#C7C4D8", fontSize: 11, marginTop: 2 }}>{percent.toFixed(1)}%</p>
      </div>
    );
  }
  return null;
}

export default function TransactionStatusPie() {
  const [data, setData] = useState<PieDataItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    async function fetchStats() {
      try {
        setLoading(true);
        const stats = await getTransactionStats();
        const pieData: PieDataItem[] = Object.entries(stats).map(([key, value]) => ({
          name: STATUS_CONFIG[key as keyof TransactionStats]?.label || key,
          value: value,
          color: STATUS_CONFIG[key as keyof TransactionStats]?.color || "#C7C4D8",
          statusKey: key as keyof TransactionStats,
        }));
        setData(pieData.filter((item) => item.value > 0));
        setTotal(Object.values(stats).reduce((a, b) => a + b, 0));
        setError(null);
      } catch (err) {
        console.error("Failed to fetch transaction stats:", err);
        setError("Không thể tải thống kê giao dịch");
      } finally {
        setLoading(false);
      }
    }
    fetchStats();
  }, []);

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
          <p style={{ color: "#C7C4D8", marginTop: 16 }}>Đang tải thống kê...</p>
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
          <CreditCard size={32} />
          <p style={{ marginTop: 12 }}>{error}</p>
        </div>
      </div>
    );
  }

  if (data.length === 0 || total === 0) {
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
        <div style={{ textAlign: "center", color: "#C7C4D8" }}>
          <CreditCard size={32} opacity={0.5} />
          <p style={{ marginTop: 12 }}>Chưa có giao dịch nào</p>
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
        height: "100%",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
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
          <CreditCard size={18} color="#6C63FF" />
        </div>
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: "#E4E1EE" }}>Phân bố giao dịch</h3>
          <p style={{ fontSize: 11, color: "#C7C4D8" }}>Tổng số: {total.toLocaleString()} giao dịch</p>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={280}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={90}
            paddingAngle={2}
            dataKey="value"
            labelLine={false}
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} stroke="rgba(0,0,0,.2)" strokeWidth={2} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ fontSize: 11, color: "#C7C4D8" }}
            formatter={(value, entry: any) => {
              const percent = ((entry.payload.value / total) * 100).toFixed(1);
              return `${value} (${percent}%)`;
            }}
          />
        </PieChart>
      </ResponsiveContainer>

      <div
        style={{
          marginTop: 16,
          paddingTop: 12,
          borderTop: "1px solid rgba(255,255,255,.06)",
          display: "flex",
          flexWrap: "wrap",
          gap: 12,
          justifyContent: "center",
        }}
      >
        {data.map((item) => (
          <div key={item.statusKey} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 10, height: 10, borderRadius: 3, background: item.color }} />
            <span style={{ fontSize: 11, color: "#C7C4D8" }}>
              {item.name}: <strong style={{ color: item.color }}>{item.value}</strong>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
/**
 * src/components/admin/TransactionAnalyticsCards.tsx
 * Hiển thị thống kê nhanh về giao dịch
 */

import React from "react";
import { DollarSign, CheckCircle, XCircle, RefreshCw, TrendingUp } from "lucide-react";

interface TransactionAnalyticsCardsProps {
  total: number;
  success: number;
  failed: number;
  refunded: number;
  totalRevenue: number;
  loading?: boolean;
}

const fmtMoney = (n: number) => new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(n);
const fmtNumber = (n: number) => n.toLocaleString();

export default function TransactionAnalyticsCards({
  total,
  success,
  failed,
  refunded,
  totalRevenue,
  loading,
}: TransactionAnalyticsCardsProps) {
  const cards = [
    { label: "Tổng GD", value: fmtNumber(total), icon: DollarSign, color: "#c4c0ff", bg: "rgba(196,192,255,0.1)" },
    { label: "Thành công", value: fmtNumber(success), icon: CheckCircle, color: "#45f1c5", bg: "rgba(69,241,197,0.1)" },
    { label: "Thất bại", value: fmtNumber(failed), icon: XCircle, color: "#ffb4ab", bg: "rgba(255,180,171,0.1)" },
    { label: "Hoàn tiền", value: fmtNumber(refunded), icon: RefreshCw, color: "#FFB785", bg: "rgba(255,183,133,0.1)" },
    { label: "Doanh thu", value: fmtMoney(totalRevenue), icon: TrendingUp, color: "#45f1c5", bg: "rgba(69,241,197,0.1)" },
  ];

  if (loading) {
    return (
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 16 }}>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} style={{ height: 100, borderRadius: 20, background: "rgba(26,26,46,0.6)", animation: "pulse 1.5s infinite" }} />
        ))}
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 16 }}>
      {cards.map((card) => (
        <div
          key={card.label}
          style={{
            background: "rgba(26,26,46,0.7)",
            border: `1px solid ${card.color}30`,
            borderRadius: 20,
            padding: "16px 18px",
            backdropFilter: "blur(12px)",
            transition: "transform 0.2s",
          }}
          onMouseOver={(e) => (e.currentTarget.style.transform = "translateY(-2px)")}
          onMouseOut={(e) => (e.currentTarget.style.transform = "translateY(0)")}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 12,
                background: card.bg,
                border: `1px solid ${card.color}40`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <card.icon size={18} color={card.color} />
            </div>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#C7C4D8", letterSpacing: "0.07em", textTransform: "uppercase" }}>
              {card.label}
            </span>
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: card.color }}>{card.value}</div>
        </div>
      ))}
    </div>
  );
}
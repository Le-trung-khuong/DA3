/**
 * src/pages/admin/transactions/TransactionDetailModal.tsx
 * Modal hiển thị chi tiết giao dịch, có nút refund (nếu success)
 */

import React from "react";
import { X, DollarSign, User, BookOpen, Calendar, CreditCard, Info } from "lucide-react";
import type { Transaction } from "../../../types/transaction";

interface TransactionDetailModalProps {
  transaction: Transaction;
  onClose: () => void;
  onRefund?: (tx: Transaction) => void;
}

const fmtDate = (timestamp: any) => {
  if (!timestamp) return "—";
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return date.toLocaleString("en-US", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
};

const fmtMoney = (amount: number) => new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(amount);

const STATUS_COLOR: Record<string, string> = {
  success: "#45f1c5",
  pending: "#FFB785",
  failed: "#ffb4ab",
  refunded: "#B0AEC0",
  cancelled: "#47464f",
};

export default function TransactionDetailModal({ transaction, onClose, onRefund }: TransactionDetailModalProps) {
  const statusColor = STATUS_COLOR[transaction.status] || "#C7C4D8";

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.8)",
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
          maxWidth: 560,
          width: "100%",
          background: "rgba(26,22,40,0.98)",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 28,
          boxShadow: "0 24px 80px rgba(0,0,0,0.6)",
          animation: "scaleIn 0.2s ease",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "18px 24px",
            borderBottom: "1px solid rgba(255,255,255,0.08)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 800, color: "#E4E1EE" }}>Transaction Details</h2>
            <code style={{ fontSize: 11, color: "#c4c0ff", background: "rgba(108,99,255,0.12)", padding: "2px 8px", borderRadius: 6 }}>
              {transaction.id}
            </code>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 34,
              height: 34,
              borderRadius: 10,
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.08)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#C7C4D8",
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ display: "flex", gap: 12, alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 16,
                  background: "linear-gradient(135deg,#6C63FF,#9B59B6)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <DollarSign size={24} color="#fff" />
              </div>
              <div>
                <div style={{ fontSize: 12, color: "#C7C4D8" }}>Total amount</div>
                <div style={{ fontSize: 28, fontWeight: 800, color: "#45f1c5" }}>{fmtMoney(transaction.amount)}</div>
              </div>
            </div>
            <div
              style={{
                padding: "6px 14px",
                borderRadius: 20,
                background: `${statusColor}18`,
                border: `1px solid ${statusColor}30`,
                color: statusColor,
                fontSize: 13,
                fontWeight: 700,
                textTransform: "uppercase",
              }}
            >
              {transaction.status}
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <InfoRow icon={<User size={14} />} label="User" value={transaction.userName} sub={transaction.userEmail} />
            <InfoRow icon={<BookOpen size={14} />} label="Course" value={transaction.courseName} sub={`ID: ${transaction.courseId}`} />
            <InfoRow icon={<CreditCard size={14} />} label="Payment method" value={transaction.paymentMethod} />
            <InfoRow icon={<Calendar size={14} />} label="Created at" value={fmtDate(transaction.createdAt)} />
            {transaction.paidAt && <InfoRow icon={<Calendar size={14} />} label="Paid at" value={fmtDate(transaction.paidAt)} />}
            {transaction.refundedAt && (
              <InfoRow icon={<Calendar size={14} />} label="Refunded at" value={fmtDate(transaction.refundedAt)} sub={transaction.refundReason} />
            )}
          </div>

          {transaction.status === "success" && onRefund && (
            <button
              onClick={() => onRefund(transaction)}
              style={{
                marginTop: 8,
                padding: "10px 16px",
                borderRadius: 14,
                fontSize: 13,
                fontWeight: 700,
                cursor: "pointer",
                background: "rgba(255,180,171,0.12)",
                border: "1px solid rgba(255,180,171,0.3)",
                color: "#ffb4ab",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
              }}
            >
              <span>⟳</span> Refund this transaction
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function InfoRow({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub?: string }) {
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
      <div style={{ marginTop: 2, color: "#6C63FF" }}>{icon}</div>
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#C7C4D8", letterSpacing: "0.05em", textTransform: "uppercase" }}>{label}</div>
        <div style={{ fontSize: 14, fontWeight: 600, color: "#E4E1EE" }}>{value}</div>
        {sub && <div style={{ fontSize: 11, color: "#C7C4D8", marginTop: 2 }}>{sub}</div>}
      </div>
    </div>
  );
}
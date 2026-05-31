/**
 * Smart Review — Admin Transaction List (Firestore Realtime)
 * File: src/pages/admin/transactions/TransactionListAdmin.tsx
 * 
 * Features:
 *   - Realtime onSnapshot via useTransactions hook
 *   - Filter by status, search (client‑side)
 *   - Pagination
 *   - Refund with Firebase batch write
 *   - Export to CSV
 *   - Transaction detail modal
 *   - Analytics cards (total, success, failed, refunded, revenue)
 */

"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useAuth } from "../../../contexts/AuthContext";
import { useTransactions } from "../../../hooks/useTransactions";
import { refundTransaction, exportTransactionsToCSV } from "../../../services/transactionService";
import TransactionDetailModal from "./TransactionDetailModal";
import TransactionAnalyticsCards from "../../../components/admin/TransactionAnalyticsCards";
import {
  Search,
  ChevronLeft,
  ChevronRight,
  X,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  DollarSign,
  Ban,
  Send,
  Loader,
  Download,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────
type TxStatus = "pending" | "processing" | "success" | "failed" | "refunded" | "cancelled";

interface Transaction {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  courseId: string;
  courseName: string;
  amount: number;
  status: TxStatus;
  paymentMethod: string;
  createdAt: any;
  paidAt?: any;
  refundedAt?: any;
  refundReason?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────
const fmtDate = (timestamp: any) => {
  if (!timestamp) return "—";
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
};
const fmtMoney = (n: number) => new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(n);

const STATUS_CFG: Record<TxStatus, { label: string; color: string; bg: string; border: string; Icon: React.ElementType }> = {
  success:    { label: "Success",    color: "#45f1c5", bg: "rgba(69,241,197,.12)",  border: "rgba(69,241,197,.28)",  Icon: CheckCircle },
  pending:    { label: "Pending",    color: "#FFB785", bg: "rgba(255,183,133,.12)", border: "rgba(255,183,133,.28)", Icon: Clock },
  processing: { label: "Processing", color: "#c4c0ff", bg: "rgba(196,192,255,.12)", border: "rgba(196,192,255,.28)", Icon: Loader },
  failed:     { label: "Failed",     color: "#ffb4ab", bg: "rgba(255,180,171,.12)", border: "rgba(255,180,171,.28)", Icon: XCircle },
  refunded:   { label: "Refunded",   color: "#B0AEC0", bg: "rgba(176,174,192,.12)", border: "rgba(176,174,192,.22)", Icon: AlertTriangle },
  cancelled:  { label: "Cancelled",  color: "#47464f", bg: "rgba(71,70,79,.12)",    border: "rgba(71,70,79,.22)",    Icon: X },
};

// ─── Toast (local) ───────────────────────────────────────────────────────
interface Toast { id: string; msg: string; type: "success" | "error" | "info" | "warning"; }
function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const add = useCallback((msg: string, type: Toast["type"] = "success") => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t, { id, msg, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3400);
  }, []);
  return { toasts, add };
}
function ToastContainer({ toasts }: { toasts: Toast[] }) {
  const c = { success: "#45f1c5", error: "#ffb4ab", info: "#c4c0ff", warning: "#FFB785" };
  return (
    <div style={{ position: "fixed", bottom: 24, right: 24, zIndex: 99999, display: "flex", flexDirection: "column", gap: 10 }}>
      {toasts.map((t) => (
        <div key={t.id} style={{ background: "rgba(26,26,46,.97)", border: `1px solid ${c[t.type]}40`, borderRadius: 14, padding: "11px 18px", color: c[t.type], fontSize: 13, fontWeight: 700, fontFamily: "Inter,sans-serif", boxShadow: `0 8px 30px rgba(0,0,0,.5)`, animation: "slideInR .3s ease", maxWidth: 360 }}>
          {t.msg}
        </div>
      ))}
    </div>
  );
}

// ─── Pagination Component ─────────────────────────────────────────────────
interface PaginationProps { page: number; total: number; pageSize: number; onPage: (p: number) => void; }
function Pagination({ page, total, pageSize, onPage }: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (total === 0) return null;
  const pages: (number | "…")[] = [];
  if (totalPages <= 7) for (let i = 1; i <= totalPages; i++) pages.push(i);
  else {
    pages.push(1);
    if (page > 3) pages.push("…");
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i);
    if (page < totalPages - 2) pages.push("…");
    pages.push(totalPages);
  }
  const btnBase: React.CSSProperties = { width: 32, height: 32, borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all .15s" };
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
      <span style={{ fontSize: 12, color: "#C7C4D8" }}>
        <strong style={{ color: "#E4E1EE" }}>{(page-1)*pageSize+1}–{Math.min(page*pageSize, total)}</strong> / {total}
      </span>
      <div style={{ display: "flex", gap: 5 }}>
        <button disabled={page===1} onClick={()=>onPage(page-1)} style={{...btnBase, background:"rgba(255,255,255,.04)", border:"1px solid rgba(255,255,255,.08)", color: page===1?"#47464f":"#C7C4D8", cursor: page===1?"not-allowed":"pointer"}}><ChevronLeft size={14}/></button>
        {pages.map((p,i)=> p==="…"
          ? <span key={`e${i}`} style={{width:32, textAlign:"center", color:"#47464f", display:"flex", alignItems:"center", justifyContent:"center"}}>…</span>
          : <button key={p} onClick={()=>onPage(p)} style={{...btnBase, background:p===page?"linear-gradient(135deg,#6C63FF,#9B59B6)":"rgba(255,255,255,.04)", border:p===page?"1px solid rgba(108,99,255,.4)":"1px solid rgba(255,255,255,.08)", color:p===page?"#fff":"#C7C4D8", boxShadow:p===page?"0 0 12px rgba(108,99,255,.3)":"none"}}>{p}</button>
        )}
        <button disabled={page===totalPages} onClick={()=>onPage(page+1)} style={{...btnBase, background:"rgba(255,255,255,.04)", border:"1px solid rgba(255,255,255,.08)", color: page===totalPages?"#47464f":"#C7C4D8", cursor: page===totalPages?"not-allowed":"pointer"}}><ChevronRight size={14}/></button>
      </div>
    </div>
  );
}

// ─── Refund Confirm Dialog ────────────────────────────────────────────────
interface RefundConfirmDialogProps { transaction: Transaction; onConfirm: (reason: string) => Promise<void>; onCancel: () => void; }
function RefundConfirmDialog({ transaction, onConfirm, onCancel }: RefundConfirmDialogProps) {
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const handleConfirm = async () => {
    if (!reason.trim()) { setError("Vui lòng nhập lý do hoàn tiền"); return; }
    setLoading(true); setError("");
    try { await onConfirm(reason); onCancel(); } catch (err: any) { setError(err.message || "Lỗi khi hoàn tiền"); } finally { setLoading(false); }
  };
  const accent = "#ffb4ab";
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.7)", backdropFilter: "blur(6px)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }} onClick={(e) => e.target === e.currentTarget && !loading && onCancel()}>
      <div style={{ width: "100%", maxWidth: 420, background: "rgba(26,26,46,.98)", border: `1px solid ${accent}40`, borderRadius: 24, padding: 28, animation: "scaleIn .2s ease" }}>
        <div style={{ width: 56, height: 56, borderRadius: "50%", background: `${accent}18`, border: `1px solid ${accent}50`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}><Ban size={26} color={accent} /></div>
        <h2 style={{ fontSize: 20, fontWeight: 800, color: "#E4E1EE", textAlign: "center", marginBottom: 12 }}>Xác nhận hoàn tiền</h2>
        <p style={{ fontSize: 13, color: "#C7C4D8", textAlign: "center", lineHeight: 1.6, marginBottom: 20 }}>
          Hoàn tiền cho giao dịch <strong>{transaction.id}</strong><br />{transaction.userName} – {fmtMoney(transaction.amount)}
        </p>
        <textarea value={reason} onChange={(e) => { setReason(e.target.value); setError(""); }} rows={2} placeholder="Lý do hoàn tiền..." style={{ width: "100%", background: "#0d0d18", border: "1px solid rgba(255,255,255,.1)", borderRadius: 12, padding: "10px 12px", color: "#E4E1EE", fontSize: 13, resize: "vertical" }} autoFocus />
        {error && <p style={{ fontSize: 11, color: "#ffb4ab", marginTop: 6 }}>⚠ {error}</p>}
        <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
          <button onClick={onCancel} disabled={loading} style={{ flex:1, padding: "11px", borderRadius: 14, background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.1)", color: "#C7C4D8", cursor: loading?"not-allowed":"pointer" }}>Hủy</button>
          <button onClick={handleConfirm} disabled={loading} style={{ flex:2, padding: "11px", borderRadius: 14, background: loading ? "rgba(255,180,171,.2)" : "linear-gradient(135deg,#ff6b6b,#ffb4ab)", border: "none", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            {loading ? <><Loader size={14} style={{ animation: "spin .8s linear infinite" }} /> Đang xử lý…</> : <><Send size={14} /> Xác nhận hoàn tiền</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────
const PAGE_SIZE = 10;

export default function TransactionListAdmin() {
  const { currentUser, userProfile } = useAuth();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<TxStatus | "all">("all");
  const [page, setPage] = useState(1);
  const [refundTarget, setRefundTarget] = useState<Transaction | null>(null);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const { toasts, add: addToast } = useToast();

  const { transactions, loading, error } = useTransactions({
    status: statusFilter === "all" ? undefined : statusFilter,
  });

  // Client-side filtering + pagination
  const filtered = useMemo(() => {
    let data = [...transactions];
    if (search) {
      const s = search.toLowerCase();
      data = data.filter(tx => tx.userName?.toLowerCase().includes(s) || tx.userEmail?.toLowerCase().includes(s) || tx.courseName?.toLowerCase().includes(s) || tx.id.toLowerCase().includes(s));
    }
    return data;
  }, [transactions, search]);

  const paged = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, page]);

  useEffect(() => { setPage(1); }, [search, statusFilter]);

  const handleRefund = async (tx: Transaction, reason: string) => {
    if (!currentUser) throw new Error("Not authenticated");
    await refundTransaction(tx.id, reason, currentUser.uid, currentUser.email || "admin");
    addToast(`Refunded ${fmtMoney(tx.amount)} for "${tx.courseName}"`, "success");
  };

  const handleExportCSV = () => {
    exportTransactionsToCSV(filtered);
    addToast(`Exported ${filtered.length} transactions`, "info");
  };

  const summaryStats = useMemo(() => {
    const success = transactions.filter(t => t.status === "success");
    const failed = transactions.filter(t => t.status === "failed");
    const refunded = transactions.filter(t => t.status === "refunded");
    const totalRevenue = success.reduce((s, t) => s + t.amount, 0);
    return {
      total: transactions.length,
      success: success.length,
      failed: failed.length,
      refunded: refunded.length,
      totalRevenue,
    };
  }, [transactions]);

  if (error) {
    return (
      <div style={{ background: "rgba(255,180,171,.07)", border: "1px solid rgba(255,180,171,.2)", borderRadius: 18, padding: 40, display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
        <AlertTriangle size={32} color="#ffb4ab" />
        <p style={{ fontSize: 15, fontWeight: 700, color: "#E4E1EE" }}>Failed to load transactions</p>
        <p style={{ fontSize: 13, color: "#C7C4D8" }}>{error.message}</p>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#0A090F", color: "#E4E1EE", fontFamily: "Inter,sans-serif" }}>
      <style>{`
        @keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}
        @keyframes scaleIn{from{opacity:0;transform:scale(.94)}to{opacity:1;transform:scale(1)}}
        @keyframes slideInR{from{opacity:0;transform:translateX(20px)}to{opacity:1;transform:translateX(0)}}
        @keyframes spin{to{transform:rotate(360deg)}}
      `}</style>
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "28px 24px", display: "flex", flexDirection: "column", gap: 22 }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 14 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: "linear-gradient(135deg,#6C63FF,#9B59B6)", display: "flex", alignItems: "center", justifyContent: "center" }}><DollarSign size={20} color="#fff" /></div>
              <h1 style={{ fontSize: 26, fontWeight: 800, color: "#E4E1EE" }}>Transaction Management</h1>
            </div>
            <p style={{ fontSize: 12, color: "#C7C4D8" }}>Firestore: <code style={{ background: "rgba(108,99,255,.12)", padding: "1px 6px", borderRadius: 5 }}>transactions</code> · Realtime onSnapshot</p>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={handleExportCSV} style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 16px", borderRadius: 12, background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.08)", color: "#C7C4D8", cursor: "pointer" }}><Download size={14} /> Export CSV</button>
          </div>
        </div>

        {/* Analytics Cards */}
        <TransactionAnalyticsCards
          total={summaryStats.total}
          success={summaryStats.success}
          failed={summaryStats.failed}
          refunded={summaryStats.refunded}
          totalRevenue={summaryStats.totalRevenue}
          loading={loading}
        />

        {/* Filters */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
          <div style={{ position: "relative", flex: "1 1 280px", maxWidth: 420 }}>
            <Search size={14} style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", color: "#C7C4D8" }} />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm theo tên, email, khóa học, ID..." style={{ width: "100%", background: "#0d0d18", border: "1px solid rgba(255,255,255,.08)", borderRadius: 12, padding: "9px 12px 9px 38px", color: "#E4E1EE", fontSize: 13, outline: "none" }} />
            {search && <button onClick={() => setSearch("")} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#C7C4D8" }}><X size={13} /></button>}
          </div>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)} style={{ background: "#0d0d18", border: "1px solid rgba(255,255,255,.08)", borderRadius: 12, padding: "9px 12px", color: "#E4E1EE", fontSize: 13 }}>
            <option value="all">Tất cả trạng thái</option>
            <option value="success">Success</option>
            <option value="pending">Pending</option>
            <option value="processing">Processing</option>
            <option value="failed">Failed</option>
            <option value="refunded">Refunded</option>
          </select>
          <span style={{ marginLeft: "auto", fontSize: 12, color: "#C7C4D8" }}>{loading ? "Loading..." : `${filtered.length} giao dịch`}</span>
        </div>

        {/* Transactions Table */}
        <div style={{ background: "rgba(26,22,40,.7)", borderRadius: 20, border: "1px solid rgba(255,255,255,.06)", overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 780 }}>
              <thead>
                <tr>
                  <th style={{ padding: "10px 16px", textAlign: "left", background: "rgba(255,255,255,.02)", borderBottom: "1px solid rgba(255,255,255,.06)", fontSize: 10, fontWeight: 700, color: "#C7C4D8" }}>ID</th>
                  <th style={{ padding: "10px 16px", textAlign: "left", background: "rgba(255,255,255,.02)", borderBottom: "1px solid rgba(255,255,255,.06)", fontSize: 10, fontWeight: 700, color: "#C7C4D8" }}>Người dùng / Khóa học</th>
                  <th style={{ padding: "10px 16px", textAlign: "left", background: "rgba(255,255,255,.02)", borderBottom: "1px solid rgba(255,255,255,.06)", fontSize: 10, fontWeight: 700, color: "#C7C4D8" }}>Số tiền</th>
                  <th style={{ padding: "10px 16px", textAlign: "left", background: "rgba(255,255,255,.02)", borderBottom: "1px solid rgba(255,255,255,.06)", fontSize: 10, fontWeight: 700, color: "#C7C4D8" }}>Trạng thái</th>
                  <th style={{ padding: "10px 16px", textAlign: "left", background: "rgba(255,255,255,.02)", borderBottom: "1px solid rgba(255,255,255,.06)", fontSize: 10, fontWeight: 700, color: "#C7C4D8" }}>Ngày tạo</th>
                  <th style={{ padding: "10px 16px", textAlign: "center", background: "rgba(255,255,255,.02)", borderBottom: "1px solid rgba(255,255,255,.06)", fontSize: 10, fontWeight: 700, color: "#C7C4D8" }}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {loading ? Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}><td colSpan={6} style={{ padding: "12px 16px" }}><div style={{ height: 14, width: "100%", borderRadius: 7, background: "linear-gradient(90deg,#1f1f2c 25%,#2a2935 50%,#1f1f2c 75%)", backgroundSize: "200% 100%", animation: "shimmer 1.4s infinite" }} /></td></tr>
                )) : paged.length === 0 ? (
                  <tr><td colSpan={6} style={{ padding: 60, textAlign: "center" }}><div><DollarSign size={32} color="#47464f" /><p>Không có giao dịch</p></div></td></tr>
                ) : paged.map((tx) => {
                  const cfg = STATUS_CFG[tx.status as TxStatus] || STATUS_CFG.pending;
                  const Icon = cfg.Icon;
                  return (
                    <tr key={tx.id} style={{ borderBottom: "1px solid rgba(255,255,255,.04)", cursor: "pointer" }} onClick={() => setSelectedTransaction(tx)}>
                      <td style={{ padding: "12px 16px" }}><code style={{ fontSize: 11, background: "rgba(108,99,255,.1)", padding: "2px 6px", borderRadius: 5, color: "#c4c0ff" }}>{tx.id.slice(-8)}</code></td>
                      <td style={{ padding: "12px 16px" }}><div><span style={{ fontWeight: 700 }}>{tx.userName}</span><div style={{ fontSize: 11, color: "#C7C4D8" }}>{tx.courseName}</div></div></td>
                      <td style={{ padding: "12px 16px" }}><span style={{ fontWeight: 800, color: "#45f1c5" }}>{fmtMoney(tx.amount)}</span></td>
                      <td style={{ padding: "12px 16px" }}><span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 10px", borderRadius: 999, background: cfg.bg, border: `1px solid ${cfg.border}`, color: cfg.color, fontSize: 11, fontWeight: 700 }}><Icon size={10} /> {cfg.label}</span></td>
                      <td style={{ padding: "12px 16px", fontSize: 12, color: "#C7C4D8" }}>{fmtDate(tx.createdAt)}</td>
                      <td style={{ padding: "12px 16px", textAlign: "center" }} onClick={(e) => e.stopPropagation()}>
                        {tx.status === "success" && <button onClick={() => setRefundTarget(tx)} style={{ padding: "5px 12px", borderRadius: 8, fontSize: 11, fontWeight: 700, background: "rgba(255,180,171,.12)", border: "1px solid rgba(255,180,171,.3)", color: "#ffb4ab", cursor: "pointer" }}><Ban size={12} /> Refund</button>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {!loading && paged.length > 0 && <div style={{ padding: "16px 20px", borderTop: "1px solid rgba(255,255,255,.05)" }}><Pagination page={page} total={filtered.length} pageSize={PAGE_SIZE} onPage={setPage} /></div>}
        </div>
      </div>
      {refundTarget && <RefundConfirmDialog transaction={refundTarget} onConfirm={async (reason) => { await handleRefund(refundTarget, reason); setRefundTarget(null); }} onCancel={() => setRefundTarget(null)} />}
      {selectedTransaction && <TransactionDetailModal transaction={selectedTransaction} onClose={() => setSelectedTransaction(null)} onRefund={(tx) => { setSelectedTransaction(null); setRefundTarget(tx); }} />}
      <ToastContainer toasts={toasts} />
    </div>
  );
}
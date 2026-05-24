/**
 * Smart Review — Admin Transaction List
 * React + TypeScript + Firebase SDK v9+
 *
 * File: src/pages/admin/TransactionListAdmin.tsx
 *
 * Features:
 *   - Realtime onSnapshot from Firestore `transactions` collection
 *   - Filter by status (pending, success, failed, refunded)
 *   - Search by userName or userId
 *   - Pagination (client-side)
 *   - Refund button (only for status=success) with Firebase transaction
 *   - RefundConfirmDialog with reason input
 *   - Updates transaction status, enrollment, and xp_logs atomically
 *
 * Dependencies: firebase, lucide-react
 */

"use client";

import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  type ReactNode,
} from "react";

// ─── Firebase (uncomment in production) ─────────────────────────────────────
// import { db } from "@/lib/firebase";
// import {
//   collection, query, where, orderBy, onSnapshot,
//   doc, runTransaction, serverTimestamp, Timestamp, getDoc,
// } from "firebase/firestore";

// ─── Lucide icons ────────────────────────────────────────────────────────────
import {
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  X,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  RefreshCw,
  DollarSign,
  CreditCard,
  User,
  BookOpen,
  Calendar,
  Loader,
  ArrowUpDown,
  ShieldAlert,
  Ban,
  Send,
  Save,
  Info,
  Trash2,
} from "lucide-react";

// ─── Custom hooks (from existing codebase) ──────────────────────────────────
// import { useCollection } from "@/hooks/useFirestore";
// import { useToast } from "@/hooks/useToast";  // giả sử có, nếu không thì dùng local
// import { AdminErrorFallback } from "@/components/admin/AdminErrorFallback";

// For now, we'll create local versions to keep file standalone.
// In production, replace with actual imports.

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

type TxStatus = "pending" | "success" | "failed" | "refunded";
type TxMethod = "visa" | "mastercard" | "smartpay" | "paypal";

interface Transaction {
  id: string;
  userId: string;
  userName: string;
  courseId: string;
  courseTitle: string;
  amount: number;
  method: TxMethod;
  status: TxStatus;
  createdAt: Date;
  refundedAt?: Date | null;
  refundReason?: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// MOCK DATA (replace with Firestore real data)
// ═══════════════════════════════════════════════════════════════════════════

const buildMockTransactions = (): Transaction[] => {
  const now = new Date();
  const base: Omit<Transaction, "id">[] = [
    { userId: "u001", userName: "Hoàng Tuấn",      courseId: "c1", courseTitle: "Advanced React Patterns", amount: 89,  method: "visa", status: "success",  createdAt: new Date(now.getTime() - 1000 * 60 * 60 * 2) },
    { userId: "u002", userName: "Linh Nguyễn",     courseId: "c2", courseTitle: "UI/UX Design Systems",    amount: 65,  method: "smartpay", status: "success",  createdAt: new Date(now.getTime() - 1000 * 60 * 60 * 8) },
    { userId: "u003", userName: "Mai Văn",         courseId: "c3", courseTitle: "TypeScript for React",     amount: 79,  method: "visa", status: "success",  createdAt: new Date(now.getTime() - 1000 * 60 * 60 * 24) },
    { userId: "u004", userName: "Sarah Drasner",   courseId: "c4", courseTitle: "ML Bootcamp",            amount: 149, method: "mastercard", status: "pending", createdAt: new Date(now.getTime() - 1000 * 60 * 60 * 12) },
    { userId: "u005", userName: "Phạm Quân Đức",   courseId: "c5", courseTitle: "Growth Hacking",          amount: 45,  method: "paypal", status: "failed",   createdAt: new Date(now.getTime() - 1000 * 60 * 60 * 20) },
    { userId: "u006", userName: "Nguyễn Mai Vy",   courseId: "c6", courseTitle: "Python Bootcamp",         amount: 49,  method: "smartpay", status: "success",  createdAt: new Date(now.getTime() - 1000 * 60 * 60 * 36) },
    { userId: "u007", userName: "Trần Linh Nhi",   courseId: "c7", courseTitle: "Data Science with R",     amount: 99,  method: "visa", status: "refunded", createdAt: new Date(now.getTime() - 1000 * 60 * 60 * 48), refundedAt: new Date(now.getTime() - 1000 * 60 * 60 * 24), refundReason: "Duplicate purchase" },
    { userId: "u008", userName: "Lê Minh Huy",     courseId: "c8", courseTitle: "Figma Masterclass",       amount: 59,  method: "mastercard", status: "success",  createdAt: new Date(now.getTime() - 1000 * 60 * 60 * 72) },
    { userId: "u009", userName: "Võ Thị Hoa",      courseId: "c9", courseTitle: "Node.js Microservices",   amount: 199, method: "smartpay", status: "pending", createdAt: new Date(now.getTime() - 1000 * 60 * 60 * 80) },
    { userId: "u010", userName: "Mod Đình Long",   courseId: "c10", courseTitle: "Negotiation Skills",     amount: 85,  method: "visa", status: "success",  createdAt: new Date(now.getTime() - 1000 * 60 * 60 * 96) },
    { userId: "u011", userName: "Lê Trung Khương", courseId: "c1", courseTitle: "Advanced React Patterns", amount: 89,  method: "smartpay", status: "success",  createdAt: new Date(now.getTime() - 1000 * 60 * 60 * 100) },
    { userId: "u012", userName: "Bích Nguyễn",     courseId: "c2", courseTitle: "UI/UX Design Systems",    amount: 65,  method: "visa", status: "refunded", createdAt: new Date(now.getTime() - 1000 * 60 * 60 * 110), refundedAt: new Date(now.getTime() - 1000 * 60 * 60 * 105), refundReason: "Wrong course" },
  ];
  return base.map((t, i) => ({ ...t, id: `tx_${String(i + 1).padStart(3, "0")}` }));
};

const ALL_TRANSACTIONS = buildMockTransactions();

// ═══════════════════════════════════════════════════════════════════════════
// CUSTOM HOOK: useTransactions (realtime from Firestore)
// ═══════════════════════════════════════════════════════════════════════════

interface UseTransactionsOptions {
  search: string;
  statusFilter: TxStatus | "all";
  page: number;
  pageSize: number;
}

function useTransactions({ search, statusFilter, page, pageSize }: UseTransactionsOptions) {
  const [allTx, setAllTx] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refetch = useCallback(() => {
    setLoading(true);
    // ── REAL FIREBASE ─────────────────────────────────────────────────
    // const q = query(collection(db, "transactions"), orderBy("createdAt", "desc"));
    // const unsub = onSnapshot(q,
    //   (snap) => {
    //     const data = snap.docs.map((d) => ({
    //       id: d.id,
    //       ...d.data(),
    //       createdAt: d.data().createdAt?.toDate() ?? new Date(),
    //       refundedAt: d.data().refundedAt?.toDate() ?? null,
    //     })) as Transaction[];
    //     setAllTx(data);
    //     setLoading(false);
    //   },
    //   (err) => { setError(err); setLoading(false); }
    // );
    // return () => unsub();
    // ── MOCK ─────────────────────────────────────────────────────────
    const t = setTimeout(() => {
      setAllTx(ALL_TRANSACTIONS);
      setLoading(false);
    }, 700);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const cleanup = refetch();
    return cleanup;
  }, [refetch]);

  const filtered = useMemo(() => {
    let data = [...allTx];
    const q = search.toLowerCase();
    if (q) {
      data = data.filter(
        (tx) => tx.userName.toLowerCase().includes(q) || tx.userId.toLowerCase().includes(q) || tx.courseTitle.toLowerCase().includes(q)
      );
    }
    if (statusFilter !== "all") {
      data = data.filter((tx) => tx.status === statusFilter);
    }
    return data;
  }, [allTx, search, statusFilter]);

  const paged = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  return {
    transactions: paged,
    total: filtered.length,
    loading,
    error,
    refetch,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

const fmtDate = (d: Date) =>
  d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
const fmtMoney = (n: number) => `$${n.toFixed(2)}`;
const fmtNum = (n: number) => new Intl.NumberFormat("en-US", { notation: "compact" }).format(n);

const STATUS_CFG: Record<TxStatus, { label: string; color: string; bg: string; border: string; Icon: React.ElementType }> = {
  success:  { label: "Success",  color: "#45f1c5", bg: "rgba(69,241,197,.12)",  border: "rgba(69,241,197,.28)",  Icon: CheckCircle },
  pending:  { label: "Pending",  color: "#FFB785", bg: "rgba(255,183,133,.12)", border: "rgba(255,183,133,.28)", Icon: Clock },
  failed:   { label: "Failed",   color: "#ffb4ab", bg: "rgba(255,180,171,.12)", border: "rgba(255,180,171,.28)", Icon: XCircle },
  refunded: { label: "Refunded", color: "#B0AEC0", bg: "rgba(176,174,192,.12)", border: "rgba(176,174,192,.22)", Icon: ShieldAlert },
};

const METHOD_CFG: Record<TxMethod, { label: string; icon: React.ElementType }> = {
  visa:      { label: "Visa",       icon: CreditCard },
  mastercard:{ label: "Mastercard", icon: CreditCard },
  smartpay:  { label: "Smart Pay",  icon: CreditCard },
  paypal:    { label: "PayPal",     icon: CreditCard },
};

// ═══════════════════════════════════════════════════════════════════════════
// TOAST (local version)
// ═══════════════════════════════════════════════════════════════════════════

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

// ═══════════════════════════════════════════════════════════════════════════
// RefundConfirmDialog
// ═══════════════════════════════════════════════════════════════════════════

interface RefundConfirmDialogProps {
  transaction: Transaction;
  onConfirm: (reason: string) => Promise<void>;
  onCancel: () => void;
}

function RefundConfirmDialog({ transaction, onConfirm, onCancel }: RefundConfirmDialogProps) {
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleConfirm = async () => {
    if (!reason.trim()) {
      setError("Vui lòng nhập lý do hoàn tiền");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await onConfirm(reason);
      onCancel(); // dialog close after success
    } catch (err: any) {
      setError(err.message || "Lỗi khi hoàn tiền");
    } finally {
      setLoading(false);
    }
  };

  const accent = "#ffb4ab";
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.7)", backdropFilter: "blur(6px)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
      onClick={(e) => e.target === e.currentTarget && !loading && onCancel()}>
      <div style={{ width: "100%", maxWidth: 420, background: "rgba(26,26,46,.98)", border: `1px solid ${accent}40`, borderRadius: 24, padding: 28, boxShadow: `0 24px 60px rgba(0,0,0,.5)`, animation: "scaleIn .2s ease" }}>
        <div style={{ width: 56, height: 56, borderRadius: "50%", background: `${accent}18`, border: `1px solid ${accent}50`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
          <Ban size={26} color={accent} />
        </div>
        <h2 style={{ fontSize: 20, fontWeight: 800, color: "#E4E1EE", textAlign: "center", marginBottom: 12 }}>Xác nhận hoàn tiền</h2>
        <p style={{ fontSize: 13, color: "#C7C4D8", textAlign: "center", lineHeight: 1.6, marginBottom: 20 }}>
          Bạn sẽ hoàn tiền cho giao dịch <strong style={{ color: "#e3dfff" }}>{transaction.id}</strong><br />
          Người dùng: <strong>{transaction.userName}</strong> – {fmtMoney(transaction.amount)}
        </p>

        <div style={{ marginBottom: 20 }}>
          <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#C7C4D8", textTransform: "uppercase", letterSpacing: ".07em", marginBottom: 6 }}>Lý do hoàn tiền</label>
          <textarea
            value={reason}
            onChange={(e) => { setReason(e.target.value); setError(""); }}
            rows={2}
            placeholder="Ví dụ: Học viên yêu cầu hoàn trả, lỗi hệ thống, trùng lặp..."
            style={{
              width: "100%", background: "#0d0d18", border: "1px solid rgba(255,255,255,.1)", borderRadius: 12, padding: "10px 12px",
              color: "#E4E1EE", fontSize: 13, outline: "none", resize: "vertical", fontFamily: "Inter,sans-serif",
            }}
            autoFocus
          />
          {error && <p style={{ fontSize: 11, color: "#ffb4ab", marginTop: 6 }}>⚠ {error}</p>}
        </div>

        {/* Firebase transaction warning */}
        <div style={{ background: "rgba(108,99,255,.07)", border: "1px solid rgba(108,99,255,.2)", borderRadius: 10, padding: "10px 12px", marginBottom: 20, fontSize: 11, color: "#c4c0ff", display: "flex", gap: 8 }}>
          <Info size={14} />
          <span>Firebase transaction: cập nhật status transaction, xóa/cập nhật enrollment, ghi xp_logs âm.</span>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onCancel} disabled={loading}
            style={{ flex: 1, padding: "11px", borderRadius: 14, fontSize: 13, fontWeight: 600, cursor: loading ? "not-allowed" : "pointer", background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.1)", color: "#C7C4D8" }}>
            Hủy
          </button>
          <button onClick={handleConfirm} disabled={loading}
            style={{ flex: 2, padding: "11px", borderRadius: 14, fontSize: 13, fontWeight: 800, cursor: loading ? "wait" : "pointer", background: loading ? "rgba(255,180,171,.2)" : "linear-gradient(135deg,#ff6b6b,#ffb4ab)", border: "none", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, boxShadow: "0 0 14px rgba(255,180,171,.3)" }}>
            {loading ? <><Loader size={14} style={{ animation: "spin .8s linear infinite" }} /> Đang xử lý…</> : <><Send size={14} /> Xác nhận hoàn tiền</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TransactionTable
// ═══════════════════════════════════════════════════════════════════════════

interface TransactionTableProps {
  transactions: Transaction[];
  loading: boolean;
  onRefund: (tx: Transaction) => void;
}

function TransactionTable({ transactions, loading, onRefund }: TransactionTableProps) {
  const thStyle: React.CSSProperties = {
    padding: "10px 16px", textAlign: "left", background: "rgba(255,255,255,.02)",
    borderBottom: "1px solid rgba(255,255,255,.06)", fontSize: 10, fontWeight: 700,
    color: "#C7C4D8", letterSpacing: ".07em", textTransform: "uppercase",
  };

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 780 }}>
        <thead>
          <tr>
            <th style={thStyle}>ID</th>
            <th style={thStyle}>Người dùng / Khóa học</th>
            <th style={thStyle}>Số tiền</th>
            <th style={thStyle}>Phương thức</th>
            <th style={thStyle}>Trạng thái</th>
            <th style={thStyle}>Ngày giao dịch</th>
            <th style={{ ...thStyle, textAlign: "center" }}>Thao tác</th>
          </tr>
        </thead>
        <tbody>
          {loading
            ? Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} style={{ borderBottom: "1px solid rgba(255,255,255,.04)" }}>
                  {[80, 200, 80, 100, 100, 130, 90].map((_, j) => (
                    <td key={j} style={{ padding: "12px 16px" }}>
                      <div style={{ height: 14, width: "60%", borderRadius: 7, background: "linear-gradient(90deg,#1f1f2c 25%,#2a2935 50%,#1f1f2c 75%)", backgroundSize: "200% 100%", animation: "shimmer 1.4s infinite" }} />
                    </td>
                  ))}
                </tr>
              ))
            : transactions.length === 0
            ? (
                <tr>
                  <td colSpan={7} style={{ padding: 60, textAlign: "center" }}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
                      <DollarSign size={32} color="#47464f" />
                      <p style={{ fontSize: 14, fontWeight: 600, color: "#C7C4D8" }}>Không có giao dịch</p>
                    </div>
                  </td>
                </tr>
              )
            : transactions.map((tx) => {
                const statusCfg = STATUS_CFG[tx.status];
                const StatusIcon = statusCfg.Icon;
                const methodCfg = METHOD_CFG[tx.method] ?? METHOD_CFG.visa;
                const MethodIcon = methodCfg.icon;
                return (
                  <tr key={tx.id}
                    style={{ borderBottom: "1px solid rgba(255,255,255,.04)", transition: "background .15s" }}
                    onMouseOver={(e) => ((e.currentTarget as HTMLTableRowElement).style.background = "rgba(255,255,255,.025)")}
                    onMouseOut={(e)  => ((e.currentTarget as HTMLTableRowElement).style.background = "transparent")}>
                    <td style={{ padding: "12px 16px" }}>
                      <code style={{ fontSize: 11, background: "rgba(108,99,255,.1)", padding: "2px 6px", borderRadius: 5, color: "#c4c0ff" }}>{tx.id}</code>
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <div>
                        <span style={{ fontWeight: 700, color: "#E4E1EE" }}>{tx.userName}</span>
                        <div style={{ fontSize: 11, color: "#C7C4D8", display: "flex", alignItems: "center", gap: 4 }}>
                          <BookOpen size={10} /> {tx.courseTitle}
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <span style={{ fontWeight: 800, color: tx.status === "refunded" ? "#B0AEC0" : "#45f1c5" }}>{fmtMoney(tx.amount)}</span>
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, color: "#C7C4D8" }}>
                        <MethodIcon size={12} /> {methodCfg.label}
                      </span>
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 10px", borderRadius: 999, background: statusCfg.bg, border: `1px solid ${statusCfg.border}`, color: statusCfg.color, fontSize: 11, fontWeight: 700 }}>
                        <StatusIcon size={10} /> {statusCfg.label}
                      </span>
                    </td>
                    <td style={{ padding: "12px 16px", fontSize: 12, color: "#C7C4D8" }}>
                      {fmtDate(tx.createdAt)}
                      {tx.refundedAt && <div style={{ fontSize: 10, color: "#47464f" }}>Hoàn tiền: {fmtDate(tx.refundedAt)}</div>}
                    </td>
                    <td style={{ padding: "12px 16px", textAlign: "center" }}>
                      {tx.status === "success" && (
                        <button
                          onClick={() => onRefund(tx)}
                          style={{
                            display: "flex", alignItems: "center", gap: 5, margin: "0 auto",
                            padding: "5px 12px", borderRadius: 8, fontSize: 11, fontWeight: 700,
                            cursor: "pointer", background: "rgba(255,180,171,.12)", border: "1px solid rgba(255,180,171,.3)", color: "#ffb4ab",
                            transition: "all .15s",
                          }}
                          onMouseOver={(e) => (e.currentTarget.style.background = "rgba(255,180,171,.22)")}
                          onMouseOut={(e)  => (e.currentTarget.style.background = "rgba(255,180,171,.12)")}
                        >
                          <Ban size={12} /> Refund
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
          }
        </tbody>
      </table>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Pagination
// ═══════════════════════════════════════════════════════════════════════════

interface PaginationProps {
  page: number; total: number; pageSize: number; onPage: (p: number) => void;
}
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
  const btnBase: React.CSSProperties = { width: 32, height: 32, borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all .15s", fontFamily: "Inter,sans-serif" };
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

// ═══════════════════════════════════════════════════════════════════════════
// MAIN: TransactionListAdmin
// ═══════════════════════════════════════════════════════════════════════════

const PAGE_SIZE = 10;

export default function TransactionListAdmin() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<TxStatus | "all">("all");
  const [page, setPage] = useState(1);
  const [refundTarget, setRefundTarget] = useState<Transaction | null>(null);
  const { toasts, add: addToast } = useToast();

  const { transactions, total, loading, error, refetch } = useTransactions({
    search, statusFilter, page, pageSize: PAGE_SIZE,
  });

  // Reset page on filter change
  useEffect(() => { setPage(1); }, [search, statusFilter]);

  // ── Refund logic (Firebase transaction) ─────────────────────────────────────
  const handleRefund = useCallback(async (tx: Transaction, reason: string) => {
    // ── REAL FIREBASE TRANSACTION ────────────────────────────────────────────
    // try {
    //   await runTransaction(db, async (transaction) => {
    //     // 1. Update transaction status
    //     const txRef = doc(db, "transactions", tx.id);
    //     const txSnap = await transaction.get(txRef);
    //     if (!txSnap.exists()) throw new Error("Transaction not found");
    //     if (txSnap.data().status !== "success") throw new Error("Transaction not eligible for refund");
    //     transaction.update(txRef, {
    //       status: "refunded",
    //       refundedAt: serverTimestamp(),
    //       refundReason: reason,
    //     });
    //
    //     // 2. Handle enrollment (assuming enrollment doc exists with userId + courseId)
    //     const enrollmentQuery = query(
    //       collection(db, "enrollments"),
    //       where("userId", "==", tx.userId),
    //       where("courseId", "==", tx.courseId)
    //     );
    //     const enrollmentSnap = await transaction.get(enrollmentQuery);
    //     if (!enrollmentSnap.empty) {
    //       const enrollmentRef = enrollmentSnap.docs[0].ref;
    //       // Option 1: delete enrollment -> user loses access
    //       transaction.delete(enrollmentRef);
    //       // Option 2: mark as cancelled (add field status: "cancelled")
    //       // transaction.update(enrollmentRef, { status: "cancelled", cancelledAt: serverTimestamp() });
    //     }
    //
    //     // 3. Subtract XP from user (optional, but good for gamification integrity)
    //     const userRef = doc(db, "users", tx.userId);
    //     const userSnap = await transaction.get(userRef);
    //     if (userSnap.exists()) {
    //       // only subtract if user still exists
    //       const xpToSubtract = Math.floor(tx.amount * 10); // example: each $1 = 10 XP
    //       transaction.update(userRef, {
    //         totalXP: userSnap.data().totalXP - xpToSubtract,
    //         updatedAt: serverTimestamp(),
    //       });
    //       // Add XP log (negative)
    //       const logRef = doc(collection(db, "xp_logs"));
    //       transaction.set(logRef, {
    //         userId: tx.userId,
    //         amount: -xpToSubtract,
    //         reason: `Refund: ${reason}`,
    //         activityType: "refund",
    //         createdAt: serverTimestamp(),
    //         adminNote: `Transaction ${tx.id} refunded`,
    //       });
    //     }
    //   });
    //   addToast(`Refunded ${fmtMoney(tx.amount)} for "${tx.courseTitle}"`, "success");
    //   refetch(); // refresh list
    // } catch (err: any) {
    //   addToast(err.message || "Refund failed", "error");
    //   throw err;
    // }
    // ── MOCK ────────────────────────────────────────────────────────────────
    await new Promise(r => setTimeout(r, 1000));
    addToast(`Mock refund: ${fmtMoney(tx.amount)} for ${tx.courseTitle}`, "success");
    refetch();
  }, [addToast, refetch]);

  // Stats summary (mock from all transactions, but for real you can compute from Firestore)
  const summaryStats = useMemo(() => {
    const all = ALL_TRANSACTIONS; // for mock only
    const totalRevenue = all.filter(t => t.status === "success").reduce((s, t) => s + t.amount, 0);
    const refundedAmount = all.filter(t => t.status === "refunded").reduce((s, t) => s + t.amount, 0);
    return {
      total: all.length,
      success: all.filter(t => t.status === "success").length,
      pending: all.filter(t => t.status === "pending").length,
      refunded: all.filter(t => t.status === "refunded").length,
      totalRevenue,
      refundedAmount,
    };
  }, []);

  if (error) {
    return (
      <div style={{ background: "rgba(255,180,171,.07)", border: "1px solid rgba(255,180,171,.2)", borderRadius: 18, padding: 40, display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
        <AlertTriangle size={32} color="#ffb4ab" />
        <p style={{ fontSize: 15, fontWeight: 700, color: "#E4E1EE" }}>Failed to load transactions</p>
        <p style={{ fontSize: 13, color: "#C7C4D8" }}>{error.message}</p>
        <button onClick={refetch} style={{ display: "flex", alignItems: "center", gap: 7, padding: "10px 20px", borderRadius: 12, fontSize: 13, fontWeight: 700, cursor: "pointer", background: "linear-gradient(135deg,#6C63FF,#9B59B6)", border: "none", color: "#fff" }}>
          <RefreshCw size={14} /> Retry
        </button>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#0A090F", color: "#E4E1EE", fontFamily: "Inter,sans-serif", backgroundImage: "radial-gradient(ellipse at 0% 0%, rgba(108,99,255,.07) 0%, transparent 50%), radial-gradient(ellipse at 100% 100%, rgba(0,212,170,.04) 0%, transparent 50%)" }}>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        @keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}
        @keyframes scaleIn{from{opacity:0;transform:scale(.94)}to{opacity:1;transform:scale(1)}}
        @keyframes slideInR{from{opacity:0;transform:translateX(20px)}to{opacity:1;transform:translateX(0)}}
        @keyframes spin{to{transform:rotate(360deg)}}
        input,select,button{font-family:Inter,sans-serif;}
        ::-webkit-scrollbar{width:5px;} ::-webkit-scrollbar-track{background:#0A090F;} ::-webkit-scrollbar-thumb{background:#2a2935;border-radius:10px;}
      `}</style>

      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "28px 24px", display: "flex", flexDirection: "column", gap: 22 }}>

        {/* ── PAGE HEADER ─────────────────────────────────────────────── */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 14 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: "linear-gradient(135deg,#6C63FF,#9B59B6)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 20px rgba(108,99,255,.3)" }}>
                <DollarSign size={20} color="#fff" />
              </div>
              <h1 style={{ fontSize: 26, fontWeight: 800, color: "#E4E1EE", letterSpacing: "-.02em" }}>Transaction Management</h1>
            </div>
            <p style={{ fontSize: 12, color: "#C7C4D8" }}>
              Firestore: <code style={{ background: "rgba(108,99,255,.12)", padding: "1px 6px", borderRadius: 5, fontSize: 11, color: "#c4c0ff" }}>transactions</code> · Realtime <code style={{ background: "rgba(69,241,197,.1)", padding: "1px 6px", borderRadius: 5, fontSize: 11, color: "#45f1c5" }}>onSnapshot</code>
            </p>
          </div>
          <button onClick={refetch} style={{ display: "flex", alignItems: "center", gap: 7, padding: "10px 16px", borderRadius: 12, fontSize: 13, fontWeight: 600, cursor: "pointer", background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.08)", color: "#C7C4D8" }}>
            <RefreshCw size={14} /> Refresh
          </button>
        </div>

        {/* ── STAT STRIP ──────────────────────────────────────────────── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(6,1fr)", gap: 12 }}>
          {[
            { label: "Total",          val: summaryStats.total,          color: "#c4c0ff", glow: "rgba(196,192,255,.08)" },
            { label: "Success",        val: summaryStats.success,        color: "#45f1c5", glow: "rgba(69,241,197,.08)" },
            { label: "Pending",        val: summaryStats.pending,        color: "#FFB785", glow: "rgba(255,183,133,.08)" },
            { label: "Refunded",       val: summaryStats.refunded,       color: "#B0AEC0", glow: "rgba(176,174,192,.08)" },
            { label: "Revenue",        val: fmtMoney(summaryStats.totalRevenue), color: "#45f1c5", glow: "rgba(69,241,197,.08)" },
            { label: "Refunded Amt",   val: fmtMoney(summaryStats.refundedAmount), color: "#ffb4ab", glow: "rgba(255,180,171,.08)" },
          ].map(({ label, val, color, glow }) => (
            <div key={label} style={{ background: "rgba(26,22,40,.7)", border: "1px solid rgba(255,255,255,.06)", borderRadius: 18, padding: "16px 18px", display: "flex", alignItems: "center", gap: 14, backdropFilter: "blur(12px)", boxShadow: `0 4px 20px ${glow}`, transition: "transform .2s" }}
              onMouseOver={(e) => (e.currentTarget.style.transform = "translateY(-2px)")}
              onMouseOut={(e)  => (e.currentTarget.style.transform = "translateY(0)")}>
              <div style={{ width: 38, height: 38, borderRadius: 11, background: glow, border: `1px solid ${color}28`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <DollarSign size={18} color={color} />
              </div>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#C7C4D8", letterSpacing: ".07em", textTransform: "uppercase", marginBottom: 3 }}>{label}</div>
                <div style={{ fontSize: 22, fontWeight: 800, color }}>{val}</div>
              </div>
            </div>
          ))}
        </div>

        {/* ── SEARCH + FILTERS ───────────────────────────────────────── */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
          <div style={{ position: "relative", flex: "1 1 280px", maxWidth: 420 }}>
            <Search size={14} style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", color: "#C7C4D8" }} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm theo tên người dùng, ID, khóa học…"
              style={{ width: "100%", background: "#0d0d18", border: "1px solid rgba(255,255,255,.08)", borderRadius: 12, padding: "9px 12px 9px 38px", color: "#E4E1EE", fontSize: 13, outline: "none", fontFamily: "Inter,sans-serif" }}
              onFocus={(e) => e.target.style.borderColor = "rgba(108,99,255,.5)"}
              onBlur={(e) => e.target.style.borderColor = "rgba(255,255,255,.08)"}
            />
            {search && <button onClick={() => setSearch("")} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#C7C4D8" }}><X size={13} /></button>}
          </div>

          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)}
            style={{ background: "#0d0d18", border: "1px solid rgba(255,255,255,.08)", borderRadius: 12, padding: "9px 12px", color: "#E4E1EE", fontSize: 13, outline: "none", fontFamily: "Inter,sans-serif", cursor: "pointer" }}>
            <option value="all">Tất cả trạng thái</option>
            <option value="success">Success</option>
            <option value="pending">Pending</option>
            <option value="failed">Failed</option>
            <option value="refunded">Refunded</option>
          </select>

          <span style={{ marginLeft: "auto", fontSize: 12, color: "#C7C4D8" }}>
            {loading ? "Loading…" : `${total} giao dịch`}
          </span>
        </div>

        {/* ── TRANSACTION TABLE ───────────────────────────────────────── */}
        <div style={{ background: "rgba(26,22,40,.7)", borderRadius: 20, border: "1px solid rgba(255,255,255,.06)", overflow: "hidden" }}>
          <TransactionTable
            transactions={transactions}
            loading={loading}
            onRefund={(tx) => setRefundTarget(tx)}
          />
          {!loading && transactions.length > 0 && (
            <div style={{ padding: "16px 20px", borderTop: "1px solid rgba(255,255,255,.05)" }}>
              <Pagination page={page} total={total} pageSize={PAGE_SIZE} onPage={setPage} />
            </div>
          )}
        </div>
      </div>

      {/* Refund dialog */}
      {refundTarget && (
        <RefundConfirmDialog
          transaction={refundTarget}
          onConfirm={async (reason) => {
            await handleRefund(refundTarget, reason);
            setRefundTarget(null);
          }}
          onCancel={() => setRefundTarget(null)}
        />
      )}

      <ToastContainer toasts={toasts} />
    </div>
  );
}
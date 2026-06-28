// src/pages/instructor/InstructorEarnings.tsx
/**
 * Instructor Earnings – Doanh thu từ khóa học
 * Sử dụng dữ liệu từ transactions và enrollments
 */

import React, { useState, useEffect, useMemo } from "react";
import { useAuth } from "../../contexts/AuthContext";
import {
  collection,
  query,
  where,
  getDocs,
  onSnapshot,
  orderBy,
  Timestamp,
} from "firebase/firestore";
import { db } from "../../utils/config";
import {
  DollarSign,
  TrendingUp,
  Calendar,
  Download,
  RefreshCw,
  Loader,
  ChevronLeft,
  ChevronRight,
  Clock,
  Users,
  BookOpen,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

// ─── Types ──────────────────────────────────────────────────────────────
interface Transaction {
  id: string;
  userId: string;
  courseId: string;
  courseTitle: string;
  amount: number;
  status: "completed" | "pending" | "failed";
  createdAt: Date;
  paymentMethod: string;
}

interface Course {
  id: string;
  title: string;
  totalStudents: number;
  price: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────
const fmtCurrency = (n: number) =>
  new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(n);
const fmtDate = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
const fmtNum = (n: number) => new Intl.NumberFormat("en-US", { notation: "compact" }).format(n);

// ─── Main Component ──────────────────────────────────────────────────────
export default function InstructorEarnings() {
  const { currentUser } = useAuth();
  const uid = currentUser?.uid;

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [timeRange, setTimeRange] = useState<"all" | "6m" | "12m">("all");

  // ─── Lấy danh sách khóa học của instructor ────────────────────────────
  useEffect(() => {
    if (!uid) return;
    const q = query(collection(db, "courses"), where("instructorId", "==", uid));
    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const list: Course[] = snapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            title: data.title || "Untitled",
            totalStudents: data.totalStudents || 0,
            price: data.price || 0,
          };
        });
        setCourses(list);
      },
      (err) => {
        console.error("Courses error:", err);
      }
    );
    return () => unsub();
  }, [uid]);

  // ─── Lấy transactions của instructor ───────────────────────────────────
  useEffect(() => {
    if (!uid) return;
    const fetchTransactions = async () => {
      if (courses.length === 0) {
        setTransactions([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const allTx: Transaction[] = [];
        for (const course of courses) {
          const q = query(
            collection(db, "transactions"),
            where("courseId", "==", course.id),
            where("status", "==", "completed")
          );
          const snap = await getDocs(q);
          snap.forEach((doc) => {
            const data = doc.data();
            allTx.push({
              id: doc.id,
              userId: data.userId,
              courseId: data.courseId,
              courseTitle: data.courseTitle || course.title,
              amount: data.amount || 0,
              status: data.status || "completed",
              createdAt: data.createdAt?.toDate?.() || new Date(),
              paymentMethod: data.paymentMethod || "Unknown",
            });
          });
        }
        setTransactions(allTx);
      } catch (err: any) { // ✅ Sửa lỗi: ép kiểu any hoặc xử lý unknown
        console.error("Transactions error:", err);
        setError(err?.message || "Failed to load transactions");
      } finally {
        setLoading(false);
      }
    };

    fetchTransactions();
  }, [courses, uid]);

  // ─── Lọc theo thời gian ──────────────────────────────────────────────
  const filteredTransactions = useMemo(() => {
    if (timeRange === "all") return transactions;
    const now = new Date();
    const months = timeRange === "6m" ? 6 : 12;
    const cutoff = new Date(now.getFullYear(), now.getMonth() - months, 1);
    return transactions.filter((tx) => tx.createdAt >= cutoff);
  }, [transactions, timeRange]);

  // ─── Stats ─────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const totalRevenue = filteredTransactions.reduce((sum, tx) => sum + tx.amount, 0);
    const totalCourses = courses.length;
    const totalStudents = courses.reduce((sum, c) => sum + c.totalStudents, 0);
    return { totalRevenue, totalCourses, totalStudents, txCount: filteredTransactions.length };
  }, [filteredTransactions, courses]);

  // ─── Chart data ────────────────────────────────────────────────────────
  const chartData = useMemo(() => {
    const map = new Map<string, number>();
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = d.toLocaleString("default", { month: "short" });
      map.set(key, 0);
    }

    filteredTransactions.forEach((tx) => {
      const monthKey = tx.createdAt.toLocaleString("default", { month: "short" });
      if (map.has(monthKey)) {
        map.set(monthKey, (map.get(monthKey) || 0) + tx.amount);
      }
    });

    return Array.from(map.entries()).map(([month, revenue]) => ({ month, revenue }));
  }, [filteredTransactions]);

  // ─── Pagination ────────────────────────────────────────────────────────
  const PAGE_SIZE = 10;
  const totalPages = Math.ceil(filteredTransactions.length / PAGE_SIZE);
  const paginated = filteredTransactions.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  if (loading && transactions.length === 0) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: 60 }}>
        <Loader size={32} color="#6C63FF" style={{ animation: "spin 1s linear infinite" }} />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "#ffb4ab" }}>
        <p>Error loading earnings: {error}</p>
        <button
          onClick={() => window.location.reload()}
          style={{
            marginTop: 16,
            padding: "8px 20px",
            borderRadius: 10,
            background: "rgba(108,99,255,.2)",
            border: "none",
            color: "#c4c0ff",
            cursor: "pointer",
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: 24, color: "#E4E1EE", minHeight: "100vh" }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700 }}>Earnings</h1>
          <p style={{ color: "#C7C4D8", fontSize: 13 }}>
            {stats.txCount} transactions · {courses.length} courses
          </p>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value as any)}
            style={{
              background: "#0d0d18",
              border: "1px solid rgba(255,255,255,.08)",
              borderRadius: 10,
              padding: "8px 14px",
              color: "#E4E1EE",
            }}
          >
            <option value="all">All Time</option>
            <option value="6m">Last 6 Months</option>
            <option value="12m">Last 12 Months</option>
          </select>
          <button
            onClick={() => window.location.reload()}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "8px 14px",
              borderRadius: 10,
              background: "rgba(255,255,255,.05)",
              border: "1px solid rgba(255,255,255,.08)",
              color: "#C7C4D8",
              cursor: "pointer",
            }}
          >
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16, marginBottom: 24 }}>
        {[
          { label: "Total Revenue", value: fmtCurrency(stats.totalRevenue), icon: DollarSign, color: "#45f1c5" },
          { label: "Total Students", value: fmtNum(stats.totalStudents), icon: Users, color: "#FFB785" },
          { label: "Total Courses", value: stats.totalCourses, icon: BookOpen, color: "#c4c0ff" },
        ].map(({ label, value, icon: Icon, color }) => (
          <div
            key={label}
            style={{
              background: "rgba(26,26,46,.7)",
              borderRadius: 16,
              padding: 18,
              display: "flex",
              alignItems: "center",
              gap: 14,
              border: "1px solid rgba(255,255,255,.06)",
            }}
          >
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                background: `${color}20`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Icon size={20} color={color} />
            </div>
            <div>
              <div style={{ fontSize: 11, color: "#C7C4D8", fontWeight: 600 }}>{label}</div>
              <div style={{ fontSize: 24, fontWeight: 800, color }}>{value}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Chart */}
      {chartData.length > 0 && (
        <div
          style={{
            background: "rgba(26,26,46,.65)",
            borderRadius: 20,
            padding: 20,
            border: "1px solid rgba(255,255,255,.06)",
            marginBottom: 24,
          }}
        >
          <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
            <TrendingUp size={18} color="#6C63FF" /> Revenue Trend
          </h3>
          <div style={{ height: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6C63FF" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#6C63FF" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.04)" vertical={false} />
                <XAxis dataKey="month" tick={{ fill: "#C7C4D8", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#C7C4D8", fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ background: "#1a1a2e", border: "1px solid rgba(108,99,255,0.3)", borderRadius: 12 }}
                  labelStyle={{ color: "#E4E1EE" }}
                  formatter={(value: any) => fmtCurrency(value)}
                />
                <Area type="monotone" dataKey="revenue" stroke="#6C63FF" strokeWidth={2} fill="url(#revGrad)" dot={{ fill: "#6C63FF", r: 3 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Transactions Table */}
      <div
        style={{
          background: "rgba(26,26,46,.65)",
          borderRadius: 20,
          padding: 20,
          border: "1px solid rgba(255,255,255,.06)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700 }}>Transactions</h3>
          <span style={{ fontSize: 12, color: "#C7C4D8" }}>
            {filteredTransactions.length} transactions
          </span>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 600 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(255,255,255,.06)" }}>
                <th style={{ padding: "10px 12px", textAlign: "left", fontSize: 11, color: "#C7C4D8" }}>Course</th>
                <th style={{ padding: "10px 12px", textAlign: "left", fontSize: 11, color: "#C7C4D8" }}>Date</th>
                <th style={{ padding: "10px 12px", textAlign: "left", fontSize: 11, color: "#C7C4D8" }}>Method</th>
                <th style={{ padding: "10px 12px", textAlign: "right", fontSize: 11, color: "#C7C4D8" }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {paginated.map((tx) => (
                <tr key={tx.id} style={{ borderBottom: "1px solid rgba(255,255,255,.04)" }}>
                  <td style={{ padding: "10px 12px", fontSize: 13, fontWeight: 600 }}>{tx.courseTitle}</td>
                  <td style={{ padding: "10px 12px", fontSize: 12, color: "#C7C4D8" }}>{fmtDate(tx.createdAt)}</td>
                  <td style={{ padding: "10px 12px", fontSize: 12, color: "#C7C4D8" }}>{tx.paymentMethod}</td>
                  <td style={{ padding: "10px 12px", fontSize: 14, fontWeight: 700, color: "#45f1c5", textAlign: "right" }}>
                    {fmtCurrency(tx.amount)}
                  </td>
                </tr>
              ))}
              {paginated.length === 0 && (
                <tr>
                  <td colSpan={4} style={{ padding: 24, textAlign: "center", color: "#C7C4D8" }}>
                    No transactions found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {filteredTransactions.length > 0 && (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 16 }}>
            <span style={{ fontSize: 12, color: "#C7C4D8" }}>
              {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filteredTransactions.length)} of {filteredTransactions.length}
            </span>
            <div style={{ display: "flex", gap: 6 }}>
              <button
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  background: "rgba(255,255,255,.04)",
                  border: "1px solid rgba(255,255,255,.08)",
                  cursor: page === 1 ? "not-allowed" : "pointer",
                  color: page === 1 ? "#47464f" : "#C7C4D8",
                }}
              >
                <ChevronLeft size={14} />
              </button>
              <span style={{ padding: "0 12px", fontSize: 13 }}>
                {page} / {totalPages}
              </span>
              <button
                disabled={page === totalPages}
                onClick={() => setPage((p) => p + 1)}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  background: "rgba(255,255,255,.04)",
                  border: "1px solid rgba(255,255,255,.08)",
                  cursor: page === totalPages ? "not-allowed" : "pointer",
                  color: page === totalPages ? "#47464f" : "#C7C4D8",
                }}
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
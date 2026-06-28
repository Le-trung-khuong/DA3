// src/pages/instructor/InstructorDashboard.tsx
/**
 * Instructor Dashboard – Tổng quan khóa học, học viên, doanh thu
 * Sử dụng dữ liệu realtime từ Firestore
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
  limit,
  Timestamp,
} from "firebase/firestore";
import { db } from "../../utils/config";
import {
  BookOpen,
  Users,
  DollarSign,
  TrendingUp,
  Clock,
  Calendar,
  Star,
  ChevronRight,
  Loader,
  Eye,
  Plus,
  RefreshCw,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  BarChart,
  Bar,
} from "recharts";

// ─── Type ────────────────────────────────────────────────────────────────
interface Course {
  id: string;
  title: string;
  price: number;
  status: "published" | "draft" | "archived";
  totalStudents: number;
  rating: number;
  totalDurationHours: number;
  createdAt: Date;
  updatedAt: Date;
}

interface Enrollment {
  id: string;
  userId: string;
  courseId: string;
  enrolledAt: Date;
  progress: number;
}

interface DashboardStats {
  totalCourses: number;
  publishedCourses: number;
  totalStudents: number;
  totalRevenue: number;
  averageRating: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────
const fmtCurrency = (n: number) =>
  n === 0 ? "Free" : new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(n);
const fmtNum = (n: number) => new Intl.NumberFormat("en-US", { notation: "compact" }).format(n);
const fmtDate = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric" });

// ─── Main Component ──────────────────────────────────────────────────────
export default function InstructorDashboard() {
  const { currentUser } = useAuth();
  const uid = currentUser?.uid;

  const [courses, setCourses] = useState<Course[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ─── Fetch courses của instructor ─────────────────────────────────────
  useEffect(() => {
    if (!uid) return;

    const q = query(
      collection(db, "courses"),
      where("instructorId", "==", uid),
      orderBy("createdAt", "desc")
    );

    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const list: Course[] = snapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            title: data.title || "Untitled",
            price: data.price || 0,
            status: data.status || "draft",
            totalStudents: data.totalStudents || 0,
            rating: data.rating || 0,
            totalDurationHours: data.totalDurationHours || 0,
            createdAt: data.createdAt?.toDate?.() || new Date(),
            updatedAt: data.updatedAt?.toDate?.() || new Date(),
          };
        });
        setCourses(list);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error("Instructor courses error:", err);
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [uid]);

  // ─── Fetch enrollments cho các khóa học của instructor ────────────────
  useEffect(() => {
    if (!uid || courses.length === 0) {
      setEnrollments([]);
      return;
    }

    const courseIds = courses.map((c) => c.id);
    // Firestore "in" query limit 10, nhưng tạm thời dùng vòng lặp hoặc lấy tất cả
    // Cách đơn giản: query tất cả enrollments với điều kiện courseId in danh sách
    // Nhưng Firestore không hỗ trợ "in" với số lượng lớn, nên ta dùng hàm getDocs nhiều lần
    const fetchEnrollments = async () => {
      try {
        const allEnrollments: Enrollment[] = [];
        for (const cid of courseIds) {
          const q = query(
            collection(db, "enrollments"),
            where("courseId", "==", cid),
            where("isActive", "==", true)
          );
          const snap = await getDocs(q);
          snap.forEach((doc) => {
            const data = doc.data();
            allEnrollments.push({
              id: doc.id,
              userId: data.userId,
              courseId: data.courseId,
              enrolledAt: data.enrolledAt?.toDate?.() || new Date(),
              progress: data.progress || 0,
            });
          });
        }
        setEnrollments(allEnrollments);
      } catch (err) {
        console.error("Enrollments fetch error:", err);
      }
    };

    fetchEnrollments();
  }, [courses]);

  // ─── Stats ─────────────────────────────────────────────────────────────
  const stats = useMemo<DashboardStats>(() => {
    const totalCourses = courses.length;
    const publishedCourses = courses.filter((c) => c.status === "published").length;
    const totalStudents = courses.reduce((sum, c) => sum + (c.totalStudents || 0), 0);
    const totalRevenue = courses
      .filter((c) => c.status === "published")
      .reduce((sum, c) => sum + c.price * (c.totalStudents || 0), 0);
    const ratings = courses.filter((c) => c.rating > 0);
    const avgRating = ratings.length
      ? ratings.reduce((sum, c) => sum + c.rating, 0) / ratings.length
      : 0;
    return { totalCourses, publishedCourses, totalStudents, totalRevenue, averageRating: avgRating };
  }, [courses]);

  // ─── Chart data: revenue theo tháng ────────────────────────────────────
  const chartData = useMemo(() => {
    const map = new Map<string, number>();
    // Giả định revenue theo tháng từ courses (hoặc từ transactions)
    // Ở đây ta tính từ enrollments: mỗi enrollment được coi là một giao dịch thành công
    // Nhưng không có thông tin revenue từ enrollment, nên ta dùng giá của course
    // Thực tế nên lấy từ transactions, nhưng demo ta dùng enrollments * course price
    const enrollmentMap = new Map<string, { count: number; revenue: number }>();
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = d.toLocaleString("default", { month: "short" });
      enrollmentMap.set(key, { count: 0, revenue: 0 });
    }

    enrollments.forEach((enr) => {
      const monthKey = enr.enrolledAt.toLocaleString("default", { month: "short" });
      const course = courses.find((c) => c.id === enr.courseId);
      if (course && enrollmentMap.has(monthKey)) {
        const entry = enrollmentMap.get(monthKey)!;
        entry.count += 1;
        entry.revenue += course.price;
      }
    });

    return Array.from(enrollmentMap.entries()).map(([month, data]) => ({
      month,
      students: data.count,
      revenue: data.revenue,
    }));
  }, [enrollments, courses]);

  // ─── Recent courses ────────────────────────────────────────────────────
  const recentCourses = useMemo(() => {
    return courses.slice(0, 5);
  }, [courses]);

  if (loading && courses.length === 0) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: 60 }}>
        <Loader size={32} color="#6C63FF" style={{ animation: "spin 1s linear infinite" }} />
      </div>
    );
  }

  return (
    <div style={{ padding: 24, color: "#E4E1EE" }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700 }}>Instructor Dashboard</h1>
          <p style={{ color: "#C7C4D8", fontSize: 13 }}>
            {courses.length} courses · {stats.publishedCourses} published
          </p>
        </div>
        <button
          onClick={() => window.location.reload()}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "8px 16px",
            borderRadius: 10,
            background: "rgba(255,255,255,.05)",
            border: "1px solid rgba(255,255,255,.08)",
            color: "#C7C4D8",
            cursor: "pointer",
          }}
        >
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Stats Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16, marginBottom: 24 }}>
        {[
          { label: "Total Courses", value: stats.totalCourses, icon: BookOpen, color: "#c4c0ff" },
          { label: "Published", value: stats.publishedCourses, icon: TrendingUp, color: "#45f1c5" },
          { label: "Students", value: fmtNum(stats.totalStudents), icon: Users, color: "#FFB785" },
          { label: "Total Revenue", value: fmtCurrency(stats.totalRevenue), icon: DollarSign, color: "#6C63FF" },
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
            <TrendingUp size={18} color="#6C63FF" /> Revenue & Students (last 6 months)
          </h3>
          <div style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.04)" vertical={false} />
                <XAxis dataKey="month" tick={{ fill: "#C7C4D8", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#C7C4D8", fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ background: "#1a1a2e", border: "1px solid rgba(108,99,255,0.3)", borderRadius: 12 }}
                  labelStyle={{ color: "#E4E1EE" }}
                  formatter={(value: any, name: string) => [
                    name === "revenue" ? fmtCurrency(value) : value,
                    name === "revenue" ? "Revenue" : "Students",
                  ]}
                />
                <Bar dataKey="students" fill="#6C63FF" radius={[4, 4, 0, 0]} />
                <Bar dataKey="revenue" fill="#45f1c5" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Recent Courses */}
      <div
        style={{
          background: "rgba(26,26,46,.65)",
          borderRadius: 20,
          padding: 20,
          border: "1px solid rgba(255,255,255,.06)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700 }}>Recent Courses</h3>
          <button
            onClick={() => (window.location.href = "/instructor/courses")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              background: "none",
              border: "none",
              color: "#6C63FF",
              cursor: "pointer",
              fontWeight: 600,
              fontSize: 12,
            }}
          >
            View all <ChevronRight size={14} />
          </button>
        </div>
        {recentCourses.length === 0 ? (
          <div style={{ textAlign: "center", padding: 20, color: "#C7C4D8" }}>
            <BookOpen size={24} style={{ marginBottom: 8, opacity: 0.5 }} />
            <p>You haven't created any courses yet.</p>
            <button
              onClick={() => (window.location.href = "/admin/courses/new")}
              style={{
                marginTop: 12,
                padding: "8px 20px",
                borderRadius: 10,
                background: "linear-gradient(135deg,#6C63FF,#9B59B6)",
                border: "none",
                color: "#fff",
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              + Create Course
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {recentCourses.map((course) => (
              <div
                key={course.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  padding: "12px 16px",
                  background: "rgba(255,255,255,.025)",
                  borderRadius: 14,
                  border: "1px solid rgba(255,255,255,.06)",
                }}
              >
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 8,
                    background: "rgba(108,99,255,.12)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <BookOpen size={18} color="#6C63FF" />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, color: "#E4E1EE" }}>{course.title}</div>
                  <div style={{ fontSize: 11, color: "#C7C4D8", display: "flex", gap: 12 }}>
                    <span>{fmtCurrency(course.price)}</span>
                    <span>{course.totalStudents} students</span>
                    <span>⭐ {course.rating.toFixed(1)}</span>
                  </div>
                </div>
                <div
                  style={{
                    padding: "3px 10px",
                    borderRadius: 999,
                    fontSize: 10,
                    fontWeight: 700,
                    background:
                      course.status === "published"
                        ? "rgba(69,241,197,.12)"
                        : course.status === "draft"
                        ? "rgba(255,183,133,.12)"
                        : "rgba(176,174,192,.12)",
                    color:
                      course.status === "published"
                        ? "#45f1c5"
                        : course.status === "draft"
                        ? "#FFB785"
                        : "#B0AEC0",
                  }}
                >
                  {course.status}
                </div>
                <button
                  onClick={() => (window.location.href = `/admin/courses/${course.id}/edit`)}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    background: "rgba(108,99,255,.08)",
                    border: "1px solid rgba(108,99,255,.2)",
                    cursor: "pointer",
                    color: "#6C63FF",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Eye size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
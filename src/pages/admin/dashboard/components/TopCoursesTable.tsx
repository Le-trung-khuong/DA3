/**
 * TopCoursesTable.tsx
 * Displays top courses by revenue, sales, or rating
 */

import React, { useEffect, useState } from "react";
import { Crown, TrendingUp, Star, Users, DollarSign, Loader, RefreshCw } from "lucide-react";
import { getTopCourses, type TopCourse } from "../../../../services/analyticsService";

type SortBy = "revenue" | "sold" | "rating";

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(value);
};

const formatNumber = (value: number) => value.toLocaleString();

interface TopCoursesTableProps {
  limit?: number;
}

export default function TopCoursesTable({ limit = 10 }: TopCoursesTableProps) {
  const [courses, setCourses] = useState<TopCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortBy>("revenue");

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getTopCourses(limit);
      setCourses(data);
    } catch (err) {
      console.error("Failed to fetch top courses:", err);
      setError("Không thể tải danh sách khóa học");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [limit]);

  const sortedCourses = [...courses].sort((a, b) => {
    if (sortBy === "revenue") return b.totalRevenue - a.totalRevenue;
    if (sortBy === "sold") return b.totalSold - a.totalSold;
    return b.rating - a.rating;
  });

  const getRankIcon = (index: number) => {
    if (index === 0) return <Crown size={16} color="#FFD700" />;
    if (index === 1) return <Crown size={14} color="#C0C0C0" />;
    if (index === 2) return <Crown size={12} color="#CD7F32" />;
    return <span style={{ width: 20, textAlign: "center", fontSize: 12, fontWeight: 600, color: "#C7C4D8" }}>
      {index + 1}
    </span>;
  };

  if (loading) {
    return (
      <div
        style={{
          background: "rgba(26,26,46,.65)",
          borderRadius: 20,
          border: "1px solid rgba(255,255,255,.06)",
          padding: 24,
          minHeight: 400,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <Loader size={32} color="#6C63FF" style={{ animation: "spin 0.8s linear infinite" }} />
          <p style={{ color: "#C7C4D8", marginTop: 16 }}>Đang tải khóa học...</p>
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
          minHeight: 400,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 16,
        }}
      >
        <p style={{ color: "#ffb4ab" }}>{error}</p>
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

  if (courses.length === 0) {
    return (
      <div
        style={{
          background: "rgba(26,26,46,.65)",
          borderRadius: 20,
          border: "1px solid rgba(255,255,255,.06)",
          padding: 24,
          minHeight: 400,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div style={{ textAlign: "center", color: "#C7C4D8" }}>
          <TrendingUp size={32} opacity={0.5} />
          <p style={{ marginTop: 12 }}>Chưa có khóa học nào được bán</p>
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
          justifyContent: "space-between",
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
            <Crown size={18} color="#6C63FF" />
          </div>
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: "#E4E1EE" }}>Top khóa học</h3>
            <p style={{ fontSize: 11, color: "#C7C4D8" }}>Theo doanh thu, lượt mua và đánh giá</p>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, background: "rgba(255,255,255,.03)", borderRadius: 12, padding: 4 }}>
          {[
            { key: "revenue", label: "Doanh thu", icon: DollarSign },
            { key: "sold", label: "Lượt bán", icon: Users },
            { key: "rating", label: "Đánh giá", icon: Star },
          ].map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setSortBy(key as SortBy)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "6px 14px",
                borderRadius: 10,
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
                transition: "all 0.15s",
                background: sortBy === key ? "linear-gradient(135deg,#6C63FF,#9B59B6)" : "transparent",
                border: sortBy === key ? "1px solid rgba(108,99,255,.3)" : "1px solid transparent",
                color: sortBy === key ? "#fff" : "#C7C4D8",
              }}
            >
              <Icon size={12} /> {label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 600 }}>
          <thead>
            <tr>
              <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 10, fontWeight: 700, color: "#C7C4D8", borderBottom: "1px solid rgba(255,255,255,.06)" }}>#</th>
              <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 10, fontWeight: 700, color: "#C7C4D8", borderBottom: "1px solid rgba(255,255,255,.06)" }}>Khóa học</th>
              <th style={{ padding: "12px 16px", textAlign: "right", fontSize: 10, fontWeight: 700, color: "#C7C4D8", borderBottom: "1px solid rgba(255,255,255,.06)" }}>Giá</th>
              <th style={{ padding: "12px 16px", textAlign: "right", fontSize: 10, fontWeight: 700, color: "#C7C4D8", borderBottom: "1px solid rgba(255,255,255,.06)" }}>Lượt bán</th>
              <th style={{ padding: "12px 16px", textAlign: "right", fontSize: 10, fontWeight: 700, color: "#C7C4D8", borderBottom: "1px solid rgba(255,255,255,.06)" }}>Doanh thu</th>
              <th style={{ padding: "12px 16px", textAlign: "center", fontSize: 10, fontWeight: 700, color: "#C7C4D8", borderBottom: "1px solid rgba(255,255,255,.06)" }}>Đánh giá</th>
            </tr>
          </thead>
          <tbody>
            {sortedCourses.slice(0, limit).map((course, idx) => (
              <tr
                key={course.id}
                style={{ borderBottom: "1px solid rgba(255,255,255,.04)", transition: "background 0.15s" }}
                onMouseOver={(e) => (e.currentTarget.style.background = "rgba(255,255,255,.02)")}
                onMouseOut={(e) => (e.currentTarget.style.background = "transparent")}
              >
                <td style={{ padding: "14px 16px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    {getRankIcon(idx)}
                  </div>
                </td>
                <td style={{ padding: "14px 16px" }}>
                  <div>
                    <div style={{ fontWeight: 600, color: "#E4E1EE" }}>{course.title}</div>
                    <div style={{ fontSize: 11, color: "#C7C4D8" }}>ID: {course.id.slice(-8)}</div>
                  </div>
                </td>
                <td style={{ padding: "14px 16px", textAlign: "right", fontWeight: 600, color: "#45f1c5" }}>
                  {course.price === 0 ? "Miễn phí" : formatCurrency(course.price)}
                </td>
                <td style={{ padding: "14px 16px", textAlign: "right", color: "#E4E1EE" }}>
                  {formatNumber(course.totalSold)}
                </td>
                <td style={{ padding: "14px 16px", textAlign: "right", fontWeight: 700, color: "#FFB785" }}>
                  {formatCurrency(course.totalRevenue)}
                </td>
                <td style={{ padding: "14px 16px", textAlign: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 4, justifyContent: "center" }}>
                    <Star size={12} color="#FFB785" fill="#FFB785" />
                    <span style={{ fontWeight: 600, color: "#E4E1EE" }}>{course.rating.toFixed(1)}</span>
                    <span style={{ fontSize: 10, color: "#C7C4D8" }}>({formatNumber(course.ratingCount)})</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div
        style={{
          padding: "12px 20px",
          borderTop: "1px solid rgba(255,255,255,.06)",
          fontSize: 11,
          color: "#47464f",
          display: "flex",
          justifyContent: "space-between",
        }}
      >
        <span>Dữ liệu từ giao dịch thành công và đánh giá</span>
        <span>Hiển thị {Math.min(limit, sortedCourses.length)}/{courses.length} khóa học</span>
      </div>
    </div>
  );
}
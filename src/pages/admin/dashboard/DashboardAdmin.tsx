/**
 * DashboardAdmin.tsx
 * Main admin dashboard aggregating all analytics components
 * Route: /admin/dashboard
 */

import React, { useState } from "react";
import { LayoutGrid, TrendingUp, DollarSign, Users, BookOpen, RefreshCw } from "lucide-react";
import RevenueStatsCards from "./components/RevenueStatsCards";
import RevenueChart from "./components/RevenueChart";
import TransactionStatusPie from "./components/TransactionStatusPie";
import TopCoursesTable from "./components/TopCoursesTable";
import UserStatsCards from "./components/UserStatsCards";
import LearningHeatmap from "../../../components/admin/LearningHeatmap";

export default function DashboardAdmin() {
  const [refreshKey, setRefreshKey] = useState(0);

  const handleRefresh = () => {
    setRefreshKey((prev) => prev + 1);
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0F0F1A", color: "#E4E1EE", fontFamily: "Inter,sans-serif" }}>
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>

      <div style={{ maxWidth: 1400, margin: "0 auto", padding: "28px 24px" }}>
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 28,
            flexWrap: "wrap",
            gap: 16,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 16,
                background: "linear-gradient(135deg,#6C63FF,#9B59B6)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 0 20px rgba(108,99,255,.3)",
              }}
            >
              <LayoutGrid size={24} color="#fff" />
            </div>
            <div>
              <h1 style={{ fontSize: 28, fontWeight: 800, color: "#E4E1EE", letterSpacing: "-.02em" }}>
                Analytics Dashboard
              </h1>
              <p style={{ fontSize: 13, color: "#C7C4D8", marginTop: 4 }}>
                Tổng quan doanh thu, giao dịch, khóa học và người dùng
              </p>
            </div>
          </div>
          <button
            onClick={handleRefresh}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "10px 20px",
              borderRadius: 12,
              background: "rgba(255,255,255,.05)",
              border: "1px solid rgba(255,255,255,.08)",
              color: "#C7C4D8",
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 600,
              transition: "all 0.15s",
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.background = "rgba(255,255,255,.1)";
              e.currentTarget.style.color = "#e3dfff";
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.background = "rgba(255,255,255,.05)";
              e.currentTarget.style.color = "#C7C4D8";
            }}
          >
            <RefreshCw size={14} /> Refresh dữ liệu
          </button>
        </div>

        {/* Revenue Stats Cards */}
        <div style={{ marginBottom: 24 }} key={`revenue-stats-${refreshKey}`}>
          <RevenueStatsCards />
        </div>

        {/* Row 1: Revenue Chart + Transaction Status */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "2fr 1fr",
            gap: 20,
            marginBottom: 24,
          }}
        >
          <div key={`revenue-chart-${refreshKey}`}>
            <RevenueChart />
          </div>
          <div key={`tx-status-${refreshKey}`}>
            <TransactionStatusPie />
          </div>
        </div>

        {/* Row 2: Top Courses + User Stats */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 20,
            marginBottom: 24,
          }}
        >
          <div key={`top-courses-${refreshKey}`}>
            <TopCoursesTable limit={8} />
          </div>
          <div key={`user-stats-${refreshKey}`}>
            <UserStatsCards />
          </div>
        </div>

        {/* Row 3: Learning Heatmap */}
        <div key={`heatmap-${refreshKey}`} style={{ marginBottom: 24 }}>
          <LearningHeatmap />
        </div>

        {/* Footer note */}
        <div
          style={{
            marginTop: 20,
            padding: "16px 20px",
            background: "rgba(26,26,46,.4)",
            borderRadius: 16,
            border: "1px solid rgba(255,255,255,.04)",
            fontSize: 12,
            color: "#47464f",
            textAlign: "center",
          }}
        >
          <span>📊 Dữ liệu được tổng hợp từ Firestore • transactions (success), users, courses, enrollments, reviews</span>
        </div>
      </div>
    </div>
  );
}
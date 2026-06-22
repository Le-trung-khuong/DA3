// src/layout/LayoutClient.tsx
/**
 * src/layout/LayoutClient.tsx
 * Layout cho phía người học (course player, catalog)
 * Thêm nút Admin Dashboard nếu user có role admin
 * Tích hợp Floating Pomodoro Widget
 */

"use client";

import React from "react";
import { Outlet, Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { BookOpen, LogOut, Home, MessageSquare, Trophy, Bell, UserCircle, Shield } from "lucide-react";
import NotificationBell from "../components/client/NotificationBell";
import { FloatingPomodoroWidget } from "../components/FloatingPomodoroWidget/FloatingPomodoroWidget";

export default function LayoutClient() {
  const { currentUser, userProfile, logout } = useAuth();
  const navigate = useNavigate();
  const isAdmin = userProfile?.role === "admin";

  const handleLogout = async () => {
    await logout();
    navigate("/");
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0F0F1A", fontFamily: "Inter, sans-serif" }}>
      <style>
        {`
          @keyframes fadeDown {
            from { opacity: 0; transform: translateY(-8px); }
            to { opacity: 1; transform: translateY(0); }
          }
        `}
      </style>
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 40,
          background: "rgba(15,15,26,0.92)",
          backdropFilter: "blur(18px)",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <div
          style={{
            maxWidth: 1280,
            margin: "0 auto",
            padding: "12px 24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 24,
          }}
        >
          {/* Logo */}
          <Link to="/" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none" }}>
            <div
              style={{
                width: 32,
                height: 32,
                background: "linear-gradient(135deg,#6C63FF,#9B59B6)",
                borderRadius: 8,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <span style={{ fontSize: 16, fontWeight: 800, color: "#fff" }}>SR</span>
            </div>
            <span style={{ fontSize: 18, fontWeight: 700, color: "#E4E1EE" }}>Smart Review</span>
          </Link>

          {/* Navigation */}
          <nav style={{ display: "flex", gap: 24, alignItems: "center" }}>
            <Link
              to="/"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                color: "#C7C4D8",
                textDecoration: "none",
                fontSize: 14,
                fontWeight: 600,
              }}
            >
              <Home size={16} /> Home
            </Link>
            <Link
              to="/courses"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                color: "#C7C4D8",
                textDecoration: "none",
                fontSize: 14,
                fontWeight: 600,
              }}
            >
              <BookOpen size={16} /> Courses
            </Link>
            <Link
              to="/leaderboard"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                color: "#C7C4D8",
                textDecoration: "none",
                fontSize: 14,
                fontWeight: 600,
              }}
            >
              <Trophy size={16} /> Leaderboard
            </Link>
            <Link
              to="/chat"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                color: "#C7C4D8",
                textDecoration: "none",
                fontSize: 14,
                fontWeight: 600,
              }}
            >
              <MessageSquare size={16} /> Chat
            </Link>
            <Link
              to="/notifications"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                color: "#C7C4D8",
                textDecoration: "none",
                fontSize: 14,
                fontWeight: 600,
              }}
            >
              <Bell size={16} /> Notifications
            </Link>
            <Link
              to="/profile"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                color: "#C7C4D8",
                textDecoration: "none",
                fontSize: 14,
                fontWeight: 600,
              }}
            >
              <UserCircle size={16} /> Profile
            </Link>

            {/* Nút Admin Dashboard chỉ hiển thị nếu user có role admin */}
            {isAdmin && (
              <Link
                to="/admin/dashboard"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  background: "rgba(108,99,255,0.15)",
                  padding: "6px 12px",
                  borderRadius: 20,
                  color: "#c4c0ff",
                  textDecoration: "none",
                  fontSize: 13,
                  fontWeight: 700,
                  transition: "background 0.15s",
                }}
                onMouseOver={(e) => (e.currentTarget.style.background = "rgba(108,99,255,0.25)")}
                onMouseOut={(e) => (e.currentTarget.style.background = "rgba(108,99,255,0.15)")}
              >
                <Shield size={14} /> Admin
              </Link>
            )}
          </nav>

          {/* Notification Bell + User menu */}
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <NotificationBell />

            {currentUser ? (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: "50%",
                      background: "linear-gradient(135deg,#6C63FF,#9B59B6)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 14,
                      fontWeight: 700,
                      color: "#fff",
                    }}
                  >
                    {userProfile?.displayName?.[0]?.toUpperCase() || currentUser.email?.[0]?.toUpperCase() || "U"}
                  </div>
                  <span style={{ fontSize: 13, color: "#E4E1EE" }}>
                    {userProfile?.displayName || currentUser.email?.split("@")[0]}
                  </span>
                </div>
                <button
                  onClick={handleLogout}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: 10,
                    padding: "6px 12px",
                    fontSize: 12,
                    fontWeight: 600,
                    color: "#C7C4D8",
                    cursor: "pointer",
                    transition: "all 0.2s",
                  }}
                  onMouseOver={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.1)")}
                  onMouseOut={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.05)")}
                >
                  <LogOut size={14} /> Logout
                </button>
              </>
            ) : (
              <Link
                to="/admin/login"
                style={{
                  background: "linear-gradient(135deg,#6C63FF,#9B59B6)",
                  padding: "6px 16px",
                  borderRadius: 10,
                  fontSize: 13,
                  fontWeight: 700,
                  color: "#fff",
                  textDecoration: "none",
                }}
              >
                Sign In
              </Link>
            )}
          </div>
        </div>
      </header>

      <main>
        <Outlet />
      </main>

      <footer
        style={{
          borderTop: "1px solid rgba(255,255,255,0.06)",
          padding: "24px",
          textAlign: "center",
          fontSize: 12,
          color: "#47464f",
        }}
      >
        © 2026 Smart Review. All rights reserved.
      </footer>

      {/* Floating Pomodoro Widget - xuất hiện trên mọi trang */}
      <FloatingPomodoroWidget />
    </div>
  );
}
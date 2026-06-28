// src/layout/LayoutClient.tsx

"use client";

import React from "react";
import { Outlet, Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import {
  BookOpen,
  LogOut,
  Home,
  MessageSquare,
  Trophy,
  Bell,
  UserCircle,
  Shield,
  GraduationCap,
} from "lucide-react";
import NotificationBell from "../components/client/NotificationBell";
import { FloatingPomodoroWidget } from "../components/FloatingPomodoroWidget/FloatingPomodoroWidget";
import { PresenceUpdater } from "../components/common/PresenceUpdater"; // ✅ THÊM

export default function LayoutClient() {
  const { currentUser, userProfile, logout } = useAuth();
  const navigate = useNavigate();

  const isAdmin = userProfile?.role === "admin";
  const isInstructor = userProfile?.role === "instructor";
  const showInstructorPortal = isAdmin || isInstructor;

  const handleLogout = async () => {
    await logout();
    navigate("/");
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0F0F1A", fontFamily: "Inter, sans-serif" }}>
      {/* ✅ THÊM PresenceUpdater - giúp cập nhật online/offline trên toàn bộ app */}
      <PresenceUpdater />

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
            flexWrap: "wrap",
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
          <nav style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
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

            {/* Nút Instructor Portal */}
            {showInstructorPortal && (
              <Link
                to="/instructor/dashboard"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  background: "rgba(69,241,197,0.12)",
                  padding: "6px 12px",
                  borderRadius: 20,
                  color: "#45f1c5",
                  textDecoration: "none",
                  fontSize: 13,
                  fontWeight: 700,
                  transition: "background 0.15s",
                  border: "1px solid rgba(69,241,197,0.2)",
                }}
                onMouseOver={(e) => (e.currentTarget.style.background = "rgba(69,241,197,0.22)")}
                onMouseOut={(e) => (e.currentTarget.style.background = "rgba(69,241,197,0.12)")}
              >
                <GraduationCap size={14} /> Instructor
              </Link>
            )}

            {/* Nút Admin Dashboard */}
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
                  border: "1px solid rgba(108,99,255,0.2)",
                }}
                onMouseOver={(e) => (e.currentTarget.style.background = "rgba(108,99,255,0.25)")}
                onMouseOut={(e) => (e.currentTarget.style.background = "rgba(108,99,255,0.15)")}
              >
                <Shield size={14} /> Admin
              </Link>
            )}
          </nav>

          {/* User menu */}
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
                to="/login"
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

      <FloatingPomodoroWidget />
    </div>
  );
}
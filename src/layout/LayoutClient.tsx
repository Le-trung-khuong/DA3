// src/layout/LayoutClient.tsx
"use client";

import React from "react";
import { Outlet, Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useNotifications } from "../hooks/useNotifications";
import { useLevel } from "../hooks/useLevel";
import { LevelBadge } from "../components/common/LevelBadge";
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
import { PresenceUpdater } from "../components/common/PresenceUpdater";

export default function LayoutClient() {
  const { currentUser, userProfile, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const { unreadCount } = useNotifications(currentUser?.uid);
  const totalUnread = unreadCount || 0;

  const levelInfo = useLevel(userProfile?.totalXP);

  const isAdmin = userProfile?.role === "admin";
  const isInstructor = userProfile?.role === "instructor";
  const showInstructorPortal = isAdmin || isInstructor;

  const handleLogout = async () => {
    await logout();
    navigate("/");
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0F0F1A", fontFamily: "Inter, sans-serif" }}>
      <PresenceUpdater />

      <style>
        {`
          @keyframes fadeIn {
            from { opacity: 0; transform: translateY(-4px); }
            to { opacity: 1; transform: translateY(0); }
          }
        `}
      </style>

      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 100,
          background: "rgba(15, 15, 26, 0.8)",
          backdropFilter: "blur(12px)",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <div
          style={{
            maxWidth: 1280,
            margin: "0 auto",
            padding: "0 24px",
            height: 64,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          {/* Logo */}
          <Link
            to="/"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              textDecoration: "none",
              color: "#fff",
              fontWeight: 800,
              fontSize: 18,
              letterSpacing: "-0.5px",
            }}
          >
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: "linear-gradient(135deg, #6C63FF, #9B59B6)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 4px 12px rgba(108,99,255,0.3)",
              }}
            >
              <GraduationCap size={18} color="#fff" />
            </div>
            <span style={{ fontSize: 18, fontWeight: 900, letterSpacing: "-.02em" }}>
              <span style={{ background: "linear-gradient(90deg,#E4E1EE,#C7C4D8)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Smart</span>
              <span style={{ background: "linear-gradient(135deg,#6C63FF,#9B59B6)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Review</span>
            </span>
          </Link>

          {/* Navigation */}
          <nav style={{ display: "flex", alignItems: "center", gap: 24 }}>
            <Link to="/"
              style={{
                display: "flex", alignItems: "center", gap: 6,
                color: location.pathname === "/" ? "#a89fff" : "#C7C4D8",
                textDecoration: "none", fontSize: 14, fontWeight: 700,
                padding: "4px 10px", borderRadius: 8, transition: "all .15s",
                borderBottom: location.pathname === "/" ? "2px solid #6C63FF" : "2px solid transparent",
              }}
              onMouseOver={(e) => { if (location.pathname !== "/") e.currentTarget.style.color = "#fff"; }}
              onMouseOut={(e) => { if (location.pathname !== "/") e.currentTarget.style.color = "#C7C4D8"; }}
            >
              <Home size={16} /> Home
            </Link>
            <Link to="/courses"
              style={{
                display: "flex", alignItems: "center", gap: 6,
                color: location.pathname.startsWith("/courses") ? "#a89fff" : "#C7C4D8",
                textDecoration: "none", fontSize: 14, fontWeight: 700,
                padding: "4px 10px", borderRadius: 8, transition: "all .15s",
                borderBottom: location.pathname.startsWith("/courses") ? "2px solid #6C63FF" : "2px solid transparent",
              }}
              onMouseOver={(e) => { if (!location.pathname.startsWith("/courses")) e.currentTarget.style.color = "#fff"; }}
              onMouseOut={(e) => { if (!location.pathname.startsWith("/courses")) e.currentTarget.style.color = "#C7C4D8"; }}
            >
              <BookOpen size={16} /> Courses
            </Link>
            <Link to="/leaderboard"
              style={{
                display: "flex", alignItems: "center", gap: 6,
                color: location.pathname === "/leaderboard" ? "#a89fff" : "#C7C4D8",
                textDecoration: "none", fontSize: 14, fontWeight: 700,
                padding: "4px 10px", borderRadius: 8, transition: "all .15s",
                borderBottom: location.pathname === "/leaderboard" ? "2px solid #6C63FF" : "2px solid transparent",
              }}
              onMouseOver={(e) => { if (location.pathname !== "/leaderboard") e.currentTarget.style.color = "#fff"; }}
              onMouseOut={(e) => { if (location.pathname !== "/leaderboard") e.currentTarget.style.color = "#C7C4D8"; }}
            >
              <Trophy size={16} /> Leaderboard
            </Link>

            {/* Chat with badge */}
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
                position: "relative",
                transition: "color 0.2s",
              }}
              onMouseOver={(e) => (e.currentTarget.style.color = "#fff")}
              onMouseOut={(e) => (e.currentTarget.style.color = "#C7C4D8")}
            >
              <MessageSquare size={16} />
              Chat
              {totalUnread > 0 && (
                <span style={{
                  position: "absolute",
                  top: -6,
                  right: -14,
                  background: "#EF4444",
                  color: "#fff",
                  fontSize: 9,
                  fontWeight: 700,
                  padding: "1px 6px",
                  borderRadius: 999,
                  minWidth: 18,
                  textAlign: "center",
                  boxShadow: "0 2px 6px rgba(239,68,68,0.4)",
                  animation: "fadeIn 0.2s ease",
                }}>
                  {totalUnread > 9 ? "9+" : totalUnread}
                </span>
              )}
            </Link>
          </nav>

          {/* Right Side */}
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            {showInstructorPortal && (
              <Link
                to="/admin/dashboard"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  background: "rgba(108,99,255,0.1)",
                  border: "1px solid rgba(108,99,255,0.2)",
                  padding: "6px 12px",
                  borderRadius: 8,
                  color: "#6C63FF",
                  fontSize: 13,
                  fontWeight: 600,
                  textDecoration: "none",
                  transition: "all 0.2s",
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.background = "rgba(108,99,255,0.15)";
                  e.currentTarget.style.borderColor = "rgba(108,99,255,0.3)";
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.background = "rgba(108,99,255,0.1)";
                  e.currentTarget.style.borderColor = "rgba(108,99,255,0.2)";
                }}
              >
                <Shield size={14} /> Instructor Portal
              </Link>
            )}

            {currentUser ? (
              <>
                <NotificationBell />
                <Link
                  to="/profile"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    textDecoration: "none",
                    color: "#E4E1EE",
                  }}
                >
                  {currentUser.photoURL ? (
                    <img
                      src={currentUser.photoURL}
                      alt="Avatar"
                      style={{ width: 32, height: 32, borderRadius: "50%", objectFit: "cover", border: "2px solid rgba(255,255,255,0.1)" }}
                    />
                  ) : (
                    <UserCircle size={32} color="#C7C4D8" />
                  )}
                </Link>

                <LevelBadge
                  level={levelInfo.level}
                  title={levelInfo.title}
                  icon={levelInfo.icon}
                  color={levelInfo.color}
                  size="sm"
                />

                <button
                  onClick={handleLogout}
                  style={{
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: 8,
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
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

      <footer style={{
        borderTop: "1px solid rgba(255,255,255,0.05)",
        padding: "28px 0", marginTop: 48,
        background: "rgba(15,15,26,0.6)", backdropFilter: "blur(12px)",
      }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "0 24px", display: "flex", flexWrap: "wrap", gap: 20, alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 24, height: 24, borderRadius: 6, background: "linear-gradient(135deg,#6C63FF,#9B59B6)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <GraduationCap size={13} color="#fff" />
            </div>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#47464f" }}>SmartReview LMS</span>
          </div>
          <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
            {([["Trang chủ","/"],["Khóa học","/courses"],["Bảng xếp hạng","/leaderboard"],["Chat","/chat"]] as [string,string][]).map(([label,to]) => (
              <Link key={to} to={to} style={{ fontSize: 12, color: "#47464f", textDecoration: "none", transition: "color .15s" }}
                onMouseOver={e => (e.currentTarget.style.color = "#C7C4D8")}
                onMouseOut={e => (e.currentTarget.style.color = "#47464f")}
              >{label}</Link>
            ))}
          </div>
          <span style={{ fontSize: 12, color: "#47464f" }}>
            &copy; {new Date().getFullYear()} SmartReview LMS · All rights reserved
          </span>
        </div>
      </footer>

      <FloatingPomodoroWidget />
    </div>
  );
}
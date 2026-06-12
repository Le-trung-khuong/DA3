/**
 * src/components/client/NotificationBell.tsx
 * Notification bell icon with badge and dropdown menu
 * Displays unread count and recent notifications in realtime
 */

import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, Check, CheckCheck, X, MessageSquare, DollarSign, AlertTriangle, Info, Star, Users } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { useNotifications } from "../../hooks/useNotifications";
import { claimAchievement } from "../../services/achievementService";
import type { Notification } from "../../types/notification";

const getNotificationIcon = (type: string) => {
  switch (type) {
    case "payment_success":
    case "refund":
      return <DollarSign size={14} color="#45f1c5" />;
    case "admin_warning":
      return <AlertTriangle size={14} color="#ffb4ab" />;
    case "course_enrolled":
      return <Star size={14} color="#FFB785" />;
    case "community_message":
      return <MessageSquare size={14} color="#6C63FF" />;
    case "admin_announcement":
      return <Users size={14} color="#c4c0ff" />;
    case "achievement_unlocked":
      return <Star size={14} color="#FFD700" />;
    default:
      return <Info size={14} color="#C7C4D8" />;
  }
};

const formatTimeAgo = (timestamp: any): string => {
  if (!timestamp) return "just now";
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};

interface NotificationBellProps {
  notificationsPath?: string;
}

export default function NotificationBell({ notificationsPath = "/notifications" }: NotificationBellProps) {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { notifications, unreadCount, markAsRead, markAllAsRead, refresh } = useNotifications(currentUser?.uid);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.isRead) {
      await markAsRead(notification.id);
    }
    setIsOpen(false);
    if (notification.link) {
      navigate(notification.link);
    }
  };

  const handleClaim = async (notification: Notification) => {
    if (!currentUser) return;
    const achievementId = notification.metadata?.achievementId;
    if (!achievementId) return;

    const result = await claimAchievement(currentUser.uid, achievementId);
    if (result.success) {
      setToast({ msg: `🎉 +${result.xpEarned} XP claimed!`, type: "success" });
      await markAsRead(notification.id);
      refresh(); // refresh notification list
      setTimeout(() => setToast(null), 3000);
    } else {
      setToast({ msg: result.message || "Failed to claim", type: "error" });
      setTimeout(() => setToast(null), 3000);
    }
  };

  const recentNotifications = notifications.slice(0, 5);
  const hasUnread = unreadCount > 0;

  return (
    <div style={{ position: "relative" }} ref={dropdownRef}>
      {/* Toast */}
      {toast && (
        <div style={{
          position: "fixed",
          bottom: 24,
          right: 24,
          zIndex: 10000,
          background: toast.type === "success" ? "#45f1c5" : "#ffb4ab",
          color: "#0F0F1A",
          padding: "10px 18px",
          borderRadius: 12,
          fontSize: 13,
          fontWeight: 700,
          animation: "fadeInUp 0.2s ease",
        }}>
          {toast.msg}
        </div>
      )}

      {/* Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 40,
          height: 40,
          borderRadius: 10,
          background: "rgba(255,255,255,0.05)",
          border: "1px solid rgba(255,255,255,0.08)",
          cursor: "pointer",
          transition: "all 0.2s",
          color: "#C7C4D8",
        }}
        onMouseOver={(e) => {
          e.currentTarget.style.background = "rgba(255,255,255,0.1)";
          e.currentTarget.style.color = "#e3dfff";
        }}
        onMouseOut={(e) => {
          e.currentTarget.style.background = "rgba(255,255,255,0.05)";
          e.currentTarget.style.color = "#C7C4D8";
        }}
      >
        <Bell size={18} />
        {hasUnread && (
          <span
            style={{
              position: "absolute",
              top: -4,
              right: -4,
              minWidth: 18,
              height: 18,
              borderRadius: 999,
              background: "linear-gradient(135deg,#ff6b6b,#ffb4ab)",
              color: "#fff",
              fontSize: 10,
              fontWeight: 800,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "0 5px",
              boxShadow: "0 0 8px rgba(255,107,107,0.5)",
            }}
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            right: 0,
            width: 380,
            maxWidth: "calc(100vw - 32px)",
            background: "rgba(26,26,46,0.98)",
            backdropFilter: "blur(16px)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 16,
            boxShadow: "0 20px 40px rgba(0,0,0,0.4), 0 0 0 1px rgba(108,99,255,0.1)",
            overflow: "hidden",
            zIndex: 1000,
            animation: "notificationSlideDown 0.2s ease",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "12px 16px",
              borderBottom: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            <span style={{ fontSize: 14, fontWeight: 700, color: "#E4E1EE" }}>
              Notifications
              {unreadCount > 0 && (
                <span
                  style={{
                    marginLeft: 8,
                    padding: "2px 8px",
                    borderRadius: 999,
                    background: "rgba(255,107,107,0.15)",
                    fontSize: 11,
                    fontWeight: 700,
                    color: "#ffb4ab",
                  }}
                >
                  {unreadCount} new
                </span>
              )}
            </span>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                  background: "none",
                  border: "none",
                  fontSize: 11,
                  fontWeight: 600,
                  color: "#6C63FF",
                  cursor: "pointer",
                  padding: "4px 8px",
                  borderRadius: 8,
                  transition: "background 0.15s",
                }}
                onMouseOver={(e) => (e.currentTarget.style.background = "rgba(108,99,255,0.1)")}
                onMouseOut={(e) => (e.currentTarget.style.background = "transparent")}
              >
                <CheckCheck size={12} /> Mark all read
              </button>
            )}
          </div>

          <div style={{ maxHeight: 400, overflowY: "auto" }}>
            {notifications.length === 0 ? (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "40px 20px",
                  gap: 12,
                }}
              >
                <Bell size={32} color="#47464f" />
                <p style={{ fontSize: 13, color: "#C7C4D8", textAlign: "center" }}>
                  No notifications yet
                </p>
              </div>
            ) : (
              recentNotifications.map((notification) => {
                const isAchievementUnlocked = notification.type === "achievement_unlocked";
                const canClaim = isAchievementUnlocked && !notification.metadata?.claimed;
                return (
                  <div
                    key={notification.id}
                    onClick={() => !canClaim && handleNotificationClick(notification)}
                    style={{
                      display: "flex",
                      gap: 12,
                      padding: "12px 16px",
                      borderBottom: "1px solid rgba(255,255,255,0.04)",
                      cursor: canClaim ? "default" : "pointer",
                      transition: "background 0.15s",
                      background: notification.isRead ? "transparent" : "rgba(108,99,255,0.05)",
                    }}
                    onMouseOver={(e) => {
                      if (!canClaim) e.currentTarget.style.background = "rgba(255,255,255,0.04)";
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.background = notification.isRead ? "transparent" : "rgba(108,99,255,0.05)";
                    }}
                  >
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 10,
                        background: "rgba(108,99,255,0.1)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      {getNotificationIcon(notification.type)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                        <span
                          style={{
                            fontSize: 13,
                            fontWeight: 600,
                            color: "#E4E1EE",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {notification.title}
                        </span>
                        {!notification.isRead && !canClaim && (
                          <span
                            style={{
                              width: 8,
                              height: 8,
                              borderRadius: "50%",
                              background: "#6C63FF",
                              flexShrink: 0,
                            }}
                          />
                        )}
                      </div>
                      <p
                        style={{
                          fontSize: 12,
                          color: "#C7C4D8",
                          lineHeight: 1.5,
                          overflow: "hidden",
                          display: "-webkit-box",
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical",
                        }}
                      >
                        {notification.body}
                      </p>
                      <span style={{ fontSize: 10, color: "#47464f", marginTop: 4, display: "block" }}>
                        {formatTimeAgo(notification.createdAt)}
                      </span>
                      {canClaim && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleClaim(notification);
                          }}
                          style={{
                            marginTop: 8,
                            padding: "4px 12px",
                            borderRadius: 20,
                            background: "linear-gradient(135deg,#45f1c5,#00D4AA)",
                            border: "none",
                            color: "#0F0F1A",
                            fontSize: 11,
                            fontWeight: 700,
                            cursor: "pointer",
                          }}
                        >
                          Claim Reward
                        </button>
                      )}
                    </div>
                    {!notification.isRead && !canClaim && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          markAsRead(notification.id);
                        }}
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: 8,
                          background: "rgba(255,255,255,0.05)",
                          border: "1px solid rgba(255,255,255,0.08)",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "#C7C4D8",
                          flexShrink: 0,
                          transition: "all 0.15s",
                        }}
                        onMouseOver={(e) => {
                          e.currentTarget.style.background = "rgba(108,99,255,0.15)";
                          e.currentTarget.style.color = "#c4c0ff";
                        }}
                        onMouseOut={(e) => {
                          e.currentTarget.style.background = "rgba(255,255,255,0.05)";
                          e.currentTarget.style.color = "#C7C4D8";
                        }}
                      >
                        <Check size={12} />
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>

          <div
            style={{
              padding: "10px 16px",
              borderTop: "1px solid rgba(255,255,255,0.08)",
              textAlign: "center",
            }}
          >
            <button
              onClick={() => {
                setIsOpen(false);
                navigate(notificationsPath);
              }}
              style={{
                background: "none",
                border: "none",
                fontSize: 12,
                fontWeight: 600,
                color: "#6C63FF",
                cursor: "pointer",
                padding: "6px 12px",
                borderRadius: 8,
                width: "100%",
                transition: "background 0.15s",
              }}
              onMouseOver={(e) => (e.currentTarget.style.background = "rgba(108,99,255,0.1)")}
              onMouseOut={(e) => (e.currentTarget.style.background = "transparent")}
            >
              View all notifications →
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes notificationSlideDown {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
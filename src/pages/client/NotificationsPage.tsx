/**
 * src/pages/client/NotificationsPage.tsx
 * Full notifications page with filtering, pagination, and mark all as read
 * Route: /notifications
 */

import React, { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, Check, CheckCheck, Filter, X, ArrowLeft, Trash2, MessageSquare, DollarSign, AlertTriangle, Info, Star, Users, Clock } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { useNotifications } from "../../hooks/useNotifications";
import type { Notification, NotificationType } from "../../types/notification";

const NOTIFICATION_TYPES: { value: NotificationType; label: string; color: string }[] = [
  { value: "payment_success", label: "Thanh toán", color: "#45f1c5" },
  { value: "payment_failed", label: "Thất bại", color: "#ffb4ab" },
  { value: "refund", label: "Hoàn tiền", color: "#FFB785" },
  { value: "course_enrolled", label: "Đăng ký", color: "#6C63FF" },
  { value: "admin_announcement", label: "Thông báo", color: "#c4c0ff" },
  { value: "admin_warning", label: "Cảnh báo", color: "#ffb4ab" },
  { value: "system", label: "Hệ thống", color: "#C7C4D8" },
];

const getNotificationIcon = (type: NotificationType) => {
  switch (type) {
    case "payment_success":
    case "payment_failed":
    case "refund":
      return <DollarSign size={16} />;
    case "admin_warning":
      return <AlertTriangle size={16} />;
    case "course_enrolled":
      return <Star size={16} />;
    case "community_message":
      return <MessageSquare size={16} />;
    case "admin_announcement":
      return <Users size={16} />;
    default:
      return <Info size={16} />;
  }
};

const getTypeColor = (type: NotificationType): string => {
  const found = NOTIFICATION_TYPES.find((t) => t.value === type);
  return found?.color || "#C7C4D8";
};

const formatDateTime = (timestamp: any): string => {
  if (!timestamp) return "";
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return date.toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatTimeAgo = (timestamp: any): string => {
  if (!timestamp) return "";
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return `${seconds} giây trước`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} phút trước`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} giờ trước`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} ngày trước`;
  const weeks = Math.floor(days / 7);
  if (weeks < 4) return `${weeks} tuần trước`;
  const months = Math.floor(days / 30);
  return `${months} tháng trước`;
};

const PAGE_SIZE = 20;

export default function NotificationsPage() {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { notifications, unreadCount, loading, error, markAsRead, markAllAsRead } = useNotifications(currentUser?.uid);
  
  const [filterType, setFilterType] = useState<NotificationType | "all">("all");
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);
  const [page, setPage] = useState(1);

  // Filter notifications
  const filteredNotifications = useMemo(() => {
    let filtered = [...notifications];
    
    if (filterType !== "all") {
      filtered = filtered.filter((n) => n.type === filterType);
    }
    
    if (showUnreadOnly) {
      filtered = filtered.filter((n) => !n.isRead);
    }
    
    return filtered;
  }, [notifications, filterType, showUnreadOnly]);

  // Pagination
  const totalPages = Math.ceil(filteredNotifications.length / PAGE_SIZE);
  const paginatedNotifications = filteredNotifications.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE
  );

  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.isRead) {
      await markAsRead(notification.id);
    }
    if (notification.link) {
      navigate(notification.link);
    }
  };

  const handleMarkAllRead = async () => {
    await markAllAsRead();
  };

  const handleBack = () => {
    navigate(-1);
  };

  const getTypeLabel = (type: NotificationType): string => {
    return NOTIFICATION_TYPES.find((t) => t.value === type)?.label || type;
  };

  if (loading && notifications.length === 0) {
    return (
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "32px 24px" }}>
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "50vh" }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: "50%",
              border: "2px solid rgba(108,99,255,0.2)",
              borderTopColor: "#6C63FF",
              animation: "spin 0.8s linear infinite",
            }}
          />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "32px 24px" }}>
        <div style={{ textAlign: "center", padding: 60, color: "#ffb4ab" }}>
          <AlertTriangle size={48} />
          <p style={{ marginTop: 16 }}>Không thể tải thông báo. Vui lòng thử lại sau.</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "32px 24px" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24, flexWrap: "wrap", gap: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button
            onClick={handleBack}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 10,
              padding: "8px 14px",
              color: "#C7C4D8",
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 600,
            }}
            onMouseOver={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.1)")}
            onMouseOut={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.05)")}
          >
            <ArrowLeft size={14} /> Quay lại
          </button>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 800, color: "#E4E1EE" }}>Thông báo</h1>
            <p style={{ fontSize: 13, color: "#C7C4D8", marginTop: 4 }}>
              Cập nhật hoạt động và tin tức từ Smart Review
            </p>
          </div>
        </div>
        
        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllRead}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 16px",
              borderRadius: 10,
              background: "linear-gradient(135deg,#6C63FF,#9B59B6)",
              border: "none",
              color: "#fff",
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 600,
              boxShadow: "0 0 12px rgba(108,99,255,0.3)",
            }}
          >
            <CheckCheck size={14} /> Đánh dấu đã đọc tất cả
          </button>
        )}
      </div>

      {/* Filters */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
          <Filter size={14} color="#C7C4D8" />
          <span style={{ fontSize: 12, fontWeight: 600, color: "#C7C4D8" }}>Lọc theo:</span>
          
          <button
            onClick={() => setShowUnreadOnly(!showUnreadOnly)}
            style={{
              padding: "6px 14px",
              borderRadius: 20,
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              background: showUnreadOnly ? "rgba(108,99,255,0.15)" : "rgba(255,255,255,0.05)",
              border: `1px solid ${showUnreadOnly ? "rgba(108,99,255,0.3)" : "rgba(255,255,255,0.08)"}`,
              color: showUnreadOnly ? "#c4c0ff" : "#C7C4D8",
            }}
          >
            Chưa đọc {unreadCount > 0 && `(${unreadCount})`}
          </button>
        </div>
        
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <button
            onClick={() => setFilterType("all")}
            style={{
              padding: "6px 14px",
              borderRadius: 20,
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              background: filterType === "all" ? "linear-gradient(135deg,#6C63FF,#9B59B6)" : "rgba(255,255,255,0.05)",
              border: filterType === "all" ? "none" : "1px solid rgba(255,255,255,0.08)",
              color: filterType === "all" ? "#fff" : "#C7C4D8",
            }}
          >
            Tất cả
          </button>
          {NOTIFICATION_TYPES.map((type) => (
            <button
              key={type.value}
              onClick={() => setFilterType(type.value)}
              style={{
                padding: "6px 14px",
                borderRadius: 20,
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                background: filterType === type.value ? `${type.color}20` : "rgba(255,255,255,0.05)",
                border: `1px solid ${filterType === type.value ? `${type.color}50` : "rgba(255,255,255,0.08)"}`,
                color: filterType === type.value ? type.color : "#C7C4D8",
              }}
            >
              {type.label}
            </button>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div style={{ marginBottom: 20, fontSize: 13, color: "#C7C4D8" }}>
        {filteredNotifications.length > 0 ? (
          <>
            Hiển thị <strong style={{ color: "#E4E1EE" }}>{paginatedNotifications.length}</strong> trên{" "}
            <strong style={{ color: "#E4E1EE" }}>{filteredNotifications.length}</strong> thông báo
            {showUnreadOnly && " (chưa đọc)"}
            {filterType !== "all" && ` · Loại: ${getTypeLabel(filterType as NotificationType)}`}
          </>
        ) : (
          <span>Không có thông báo nào</span>
        )}
      </div>

      {/* Notifications List */}
      {filteredNotifications.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            padding: 80,
            background: "rgba(26,26,46,0.4)",
            borderRadius: 20,
            border: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <Bell size={48} color="#47464f" />
          <p style={{ fontSize: 16, fontWeight: 600, color: "#C7C4D8", marginTop: 16 }}>
            {showUnreadOnly ? "Không có thông báo chưa đọc" : "Chưa có thông báo nào"}
          </p>
          <p style={{ fontSize: 13, color: "#C7C4D8", marginTop: 8 }}>
            {showUnreadOnly
              ? "Bạn đã đọc tất cả thông báo"
              : "Khi có thông báo mới, chúng sẽ xuất hiện tại đây"}
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {paginatedNotifications.map((notification) => {
            const typeColor = getTypeColor(notification.type);
            const Icon = getNotificationIcon(notification.type);
            
            return (
              <div
                key={notification.id}
                onClick={() => handleNotificationClick(notification)}
                style={{
                  display: "flex",
                  gap: 16,
                  padding: "16px 20px",
                  background: notification.isRead
                    ? "rgba(26,26,46,0.4)"
                    : "linear-gradient(135deg, rgba(108,99,255,0.08), rgba(155,89,182,0.04))",
                  border: `1px solid ${notification.isRead ? "rgba(255,255,255,0.06)" : "rgba(108,99,255,0.15)"}`,
                  borderRadius: 16,
                  cursor: "pointer",
                  transition: "all 0.2s",
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.background = notification.isRead
                    ? "rgba(255,255,255,0.04)"
                    : "linear-gradient(135deg, rgba(108,99,255,0.12), rgba(155,89,182,0.06))";
                  e.currentTarget.style.borderColor = "rgba(108,99,255,0.25)";
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.background = notification.isRead
                    ? "rgba(26,26,46,0.4)"
                    : "linear-gradient(135deg, rgba(108,99,255,0.08), rgba(155,89,182,0.04))";
                  e.currentTarget.style.borderColor = notification.isRead
                    ? "rgba(255,255,255,0.06)"
                    : "rgba(108,99,255,0.15)";
                }}
              >
                {/* Icon */}
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 14,
                    background: `${typeColor}15`,
                    border: `1px solid ${typeColor}30`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    color: typeColor,
                  }}
                >
                  {Icon}
                </div>

                {/* Content */}
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 6 }}>
                    <span style={{ fontSize: 15, fontWeight: 700, color: "#E4E1EE" }}>
                      {notification.title}
                    </span>
                    <span
                      style={{
                        padding: "2px 8px",
                        borderRadius: 12,
                        background: `${typeColor}15`,
                        fontSize: 10,
                        fontWeight: 600,
                        color: typeColor,
                      }}
                    >
                      {getTypeLabel(notification.type)}
                    </span>
                    {!notification.isRead && (
                      <span
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: "50%",
                          background: "#6C63FF",
                        }}
                      />
                    )}
                  </div>
                  <p style={{ fontSize: 13, color: "#C7C4D8", lineHeight: 1.6, marginBottom: 8 }}>
                    {notification.body}
                  </p>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ fontSize: 11, color: "#47464f", display: "flex", alignItems: "center", gap: 4 }}>
                      <Clock size={11} /> {formatTimeAgo(notification.createdAt)}
                    </span>
                    <span style={{ fontSize: 11, color: "#47464f" }}>•</span>
                    <span style={{ fontSize: 11, color: "#47464f" }}>{formatDateTime(notification.createdAt)}</span>
                  </div>
                </div>

                {/* Mark as read button */}
                {!notification.isRead && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      markAsRead(notification.id);
                    }}
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 10,
                      background: "rgba(108,99,255,0.1)",
                      border: "1px solid rgba(108,99,255,0.2)",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#6C63FF",
                      flexShrink: 0,
                      transition: "all 0.15s",
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.background = "rgba(108,99,255,0.2)";
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.background = "rgba(108,99,255,0.1)";
                    }}
                  >
                    <Check size={14} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 32 }}>
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            style={{
              padding: "8px 14px",
              borderRadius: 10,
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.08)",
              color: page === 1 ? "#47464f" : "#C7C4D8",
              cursor: page === 1 ? "not-allowed" : "pointer",
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            Trước
          </button>
          <span style={{ padding: "8px 16px", color: "#C7C4D8", fontSize: 13 }}>
            Trang {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            style={{
              padding: "8px 14px",
              borderRadius: 10,
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.08)",
              color: page === totalPages ? "#47464f" : "#C7C4D8",
              cursor: page === totalPages ? "not-allowed" : "pointer",
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            Sau
          </button>
        </div>
      )}
    </div>
  );
}
// src/components/client/ReviewList.tsx
import React, { useState } from "react";
import { Star, Calendar, Edit, Trash2, ThumbsUp, ThumbsDown, Shield, Award } from "lucide-react";
import type { Review } from "../../types/review";
import { useAuth } from "../../hooks/useAuth";
import { reportReview, toggleHelpful } from "../../services/reviewService";

interface ReviewListProps {
  reviews: Review[];
  loading: boolean;
  currentUserId?: string;
  onEdit?: (review: Review) => void;
  onDelete?: (reviewId: string) => void;
}

const toSafeDate = (value: any): Date => {
  if (!value) return new Date();
  if (value instanceof Date) return value;
  if (typeof value === "object" && typeof value.toDate === "function") return value.toDate();
  const d = new Date(value);
  return isNaN(d.getTime()) ? new Date() : d;
};

const fmtDate = (d: any): string => {
  const date = toSafeDate(d);
  return date.toLocaleDateString("vi-VN");
};

const weightToLabel = (weight: number): string => {
  if (weight >= 1.8) return "Expert";
  if (weight >= 1.5) return "Advanced";
  if (weight >= 1.2) return "Trusted";
  return "Learner";
};

const weightToColor = (weight: number): string => {
  if (weight >= 1.8) return "#FFD700";
  if (weight >= 1.5) return "#FFB785";
  if (weight >= 1.2) return "#6C63FF";
  return "#C7C4D8";
};

export function ReviewList({ reviews, loading, currentUserId, onEdit, onDelete }: ReviewListProps) {
  const { currentUser } = useAuth();
  const [helpfulLoading, setHelpfulLoading] = useState<string | null>(null);

  const handleReport = async (reviewId: string) => {
    if (!currentUser) {
      alert('Vui lòng đăng nhập để report');
      return;
    }
    try {
      await reportReview(reviewId, currentUser.uid);
      alert('Đã report review. Cảm ơn bạn!');
    } catch (err: any) {
      alert('Lỗi: ' + err.message);
    }
  };

  const handleToggleHelpful = async (reviewId: string, helpful: boolean) => {
    if (!currentUser) {
      alert('Vui lòng đăng nhập');
      return;
    }
    setHelpfulLoading(reviewId);
    try {
      await toggleHelpful(reviewId, currentUser.uid, helpful);
    } catch (err: any) {
      alert('Lỗi: ' + err.message);
    } finally {
      setHelpfulLoading(null);
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: 32 }}>
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: "50%",
            border: "2px solid rgba(108,99,255,0.2)",
            borderTopColor: "#6C63FF",
            animation: "spin 0.8s linear infinite",
            margin: "0 auto",
          }}
        />
      </div>
    );
  }

  if (reviews.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: 32, color: "#C7C4D8" }}>
        <Star size={32} style={{ marginBottom: 12, opacity: 0.3 }} />
        <p>Chưa có đánh giá nào cho khóa học này.</p>
        <p style={{ fontSize: 13, marginTop: 8 }}>Hãy là người đầu tiên đánh giá!</p>
      </div>
    );
  }

  // Sắp xếp: verified + high weight trước, helpful trước
  const sortedReviews = [...reviews].sort((a, b) => {
    // Verified lên trước
    if (a.verified && !b.verified) return -1;
    if (!a.verified && b.verified) return 1;
    // Weight cao lên trước
    if (a.reviewWeight !== b.reviewWeight) return (b.reviewWeight || 1) - (a.reviewWeight || 1);
    // Helpful nhiều lên trước
    return (b.helpfulCount || 0) - (a.helpfulCount || 0);
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {sortedReviews.map((review) => {
        const isOwner = currentUserId && review.userId === currentUserId;
        const hasHelpful = currentUserId && review.helpfulUsers?.includes(currentUserId);
        const hasNotHelpful = currentUserId && review.notHelpfulUsers?.includes(currentUserId);
        const weight = review.reviewWeight || 1.0;
        const weightLabel = weightToLabel(weight);
        const weightColor = weightToColor(weight);

        return (
          <div
            key={review.id}
            style={{
              background: review.verified ? "rgba(69,241,197,0.04)" : "rgba(26,26,46,0.5)",
              borderRadius: 16,
              border: review.verified ? "1px solid rgba(69,241,197,0.2)" : "1px solid rgba(255,255,255,0.06)",
              padding: 20,
              transition: "border-color 0.2s",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
              <div
                style={{
                  width: 40,
                  height: 40,
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
                {review.userName.charAt(0).toUpperCase()}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontWeight: 600, color: "#E4E1EE" }}>{review.userName}</span>
                  {/* ✅ Verified badge */}
                  {review.verified && (
                    <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 600, color: "#45f1c5", background: "rgba(69,241,197,0.12)", padding: "2px 8px", borderRadius: 12 }}>
                      <Shield size={12} /> Verified
                    </span>
                  )}
                  {/* ✅ Weight badge */}
                  <span style={{ fontSize: 11, fontWeight: 600, color: weightColor, background: `${weightColor}20`, padding: "2px 8px", borderRadius: 12 }}>
                    <Award size={12} style={{ display: "inline", marginRight: 4 }} />
                    {weightLabel} {weight > 1.2 ? `(${weight.toFixed(1)}x)` : ''}
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4, flexWrap: "wrap" }}>
                  <div style={{ display: "flex", gap: 2 }}>
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} size={14} fill={i < review.rating ? "#FFB785" : "transparent"} color="#FFB785" />
                    ))}
                  </div>
                  <span style={{ fontSize: 11, color: "#47464f" }}>
                    <Calendar size={10} style={{ display: "inline", marginRight: 4 }} />
                    {fmtDate(review.createdAt)}
                  </span>
                  {review.helpfulCount > 0 && (
                    <span style={{ fontSize: 11, color: "#45f1c5" }}>👍 {review.helpfulCount}</span>
                  )}
                  {review.notHelpfulCount > 0 && (
                    <span style={{ fontSize: 11, color: "#47464f" }}>👎 {review.notHelpfulCount}</span>
                  )}
                </div>
              </div>
              {isOwner && (
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    onClick={() => onEdit?.(review)}
                    style={{
                      background: "rgba(108,99,255,0.2)",
                      border: "none",
                      padding: "6px 10px",
                      borderRadius: 8,
                      fontSize: 12,
                      fontWeight: 600,
                      color: "#6C63FF",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    <Edit size={12} /> Sửa
                  </button>
                  <button
                    onClick={() => onDelete?.(review.id)}
                    style={{
                      background: "rgba(231,76,60,0.2)",
                      border: "none",
                      padding: "6px 10px",
                      borderRadius: 8,
                      fontSize: 12,
                      fontWeight: 600,
                      color: "#e74c3c",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    <Trash2 size={12} /> Xóa
                  </button>
                </div>
              )}
              {!isOwner && currentUserId && (
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    onClick={() => handleToggleHelpful(review.id, true)}
                    disabled={helpfulLoading === review.id}
                    style={{
                      background: hasHelpful ? "rgba(69,241,197,0.2)" : "rgba(255,255,255,0.05)",
                      border: hasHelpful ? "1px solid rgba(69,241,197,0.3)" : "1px solid rgba(255,255,255,0.08)",
                      padding: "6px 10px",
                      borderRadius: 8,
                      fontSize: 12,
                      fontWeight: 600,
                      color: hasHelpful ? "#45f1c5" : "#C7C4D8",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    <ThumbsUp size={12} /> {hasHelpful ? 'Helpful' : 'Hữu ích'}
                  </button>
                  <button
                    onClick={() => handleToggleHelpful(review.id, false)}
                    disabled={helpfulLoading === review.id}
                    style={{
                      background: hasNotHelpful ? "rgba(255,180,171,0.2)" : "rgba(255,255,255,0.05)",
                      border: hasNotHelpful ? "1px solid rgba(255,180,171,0.3)" : "1px solid rgba(255,255,255,0.08)",
                      padding: "6px 10px",
                      borderRadius: 8,
                      fontSize: 12,
                      fontWeight: 600,
                      color: hasNotHelpful ? "#ffb4ab" : "#C7C4D8",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    <ThumbsDown size={12} />
                  </button>
                  <button
                    onClick={() => handleReport(review.id)}
                    style={{
                      background: "rgba(255,180,171,0.2)",
                      border: "none",
                      padding: "6px 10px",
                      borderRadius: 8,
                      fontSize: 12,
                      fontWeight: 600,
                      color: "#ffb4ab",
                      cursor: "pointer",
                    }}
                  >
                    Báo cáo
                  </button>
                </div>
              )}
            </div>
            <p style={{ fontSize: 14, color: "#C7C4D8", lineHeight: 1.6 }}>{review.content}</p>
          </div>
        );
      })}
    </div>
  );
}
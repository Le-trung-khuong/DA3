/**
 * src/components/client/ReviewList.tsx
 * Hiển thị danh sách đánh giá của khóa học
 */

import React from "react";
import { Star, Calendar } from "lucide-react";
import type { Review } from "../../types/review";

interface ReviewListProps {
  reviews: Review[];
  loading: boolean;
}

// Helper chuyển đổi an toàn từ Timestamp (Firestore) hoặc Date sang Date object
const toSafeDate = (value: any): Date => {
  if (!value) return new Date();
  if (value instanceof Date) return value;
  // Firestore Timestamp
  if (typeof value === "object" && typeof value.toDate === "function") {
    return value.toDate();
  }
  // Nếu là số (milliseconds) hoặc string
  const d = new Date(value);
  return isNaN(d.getTime()) ? new Date() : d;
};

const fmtDate = (d: any): string => {
  const date = toSafeDate(d);
  return date.toLocaleDateString("vi-VN");
};

export function ReviewList({ reviews, loading }: ReviewListProps) {
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

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {reviews.map((review) => (
        <div
          key={review.id}
          style={{
            background: "rgba(26,26,46,0.5)",
            borderRadius: 16,
            border: "1px solid rgba(255,255,255,0.06)",
            padding: 20,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
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
            <div>
              <div style={{ fontWeight: 600, color: "#E4E1EE" }}>{review.userName}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
                <div style={{ display: "flex", gap: 2 }}>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      size={14}
                      fill={i < review.rating ? "#FFB785" : "transparent"}
                      color="#FFB785"
                    />
                  ))}
                </div>
                <span style={{ fontSize: 11, color: "#47464f" }}>
                  <Calendar size={10} style={{ display: "inline", marginRight: 4 }} />
                  {fmtDate(review.createdAt)}
                </span>
              </div>
            </div>
          </div>
          <p style={{ fontSize: 14, color: "#C7C4D8", lineHeight: 1.6 }}>{review.content}</p>
          {review.helpfulCount > 0 && (
            <div style={{ marginTop: 10, fontSize: 11, color: "#47464f" }}>
              {review.helpfulCount} người thấy hữu ích
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
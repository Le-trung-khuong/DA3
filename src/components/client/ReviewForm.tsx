// src/components/client/ReviewForm.tsx
import React, { useState, useEffect } from "react";
import { Star, X, AlertCircle, Shield, Loader } from "lucide-react";
import { checkReviewEligibility } from "../../services/reviewService";
import { useAuth } from "../../hooks/useAuth";

interface ReviewFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (rating: number, content: string) => Promise<void>;
  courseId: string;
  courseTitle: string;
}

export function ReviewForm({ isOpen, onClose, onSubmit, courseId, courseTitle }: ReviewFormProps) {
  const { currentUser } = useAuth();
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [eligibility, setEligibility] = useState<{
    eligible: boolean;
    message?: string;
    progress?: number;
  } | null>(null);
  const [checking, setChecking] = useState(true);

  // ✅ Kiểm tra điều kiện khi mở modal
  useEffect(() => {
    if (!isOpen || !currentUser || !courseId) return;

    const check = async () => {
      setChecking(true);
      try {
        const result = await checkReviewEligibility(currentUser.uid, courseId);
        setEligibility(result);
      } catch (err) {
        setError("Không thể kiểm tra điều kiện đánh giá.");
      } finally {
        setChecking(false);
      }
    };
    check();
  }, [isOpen, currentUser, courseId]);

  const handleSubmit = async () => {
    if (rating === 0) {
      setError("Vui lòng chọn số sao đánh giá");
      return;
    }
    if (!content.trim()) {
      setError("Vui lòng nhập nội dung đánh giá");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await onSubmit(rating, content);
      onClose();
      setRating(0);
      setContent("");
    } catch (err: any) {
      setError(err.message || "Có lỗi xảy ra");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  // ✅ Hiển thị thông báo nếu chưa đủ điều kiện
  if (!checking && eligibility && !eligibility.eligible) {
    return (
      <div
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.7)",
          backdropFilter: "blur(6px)",
          zIndex: 9999,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 20,
        }}
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <div
          style={{
            width: "100%",
            maxWidth: 500,
            background: "#1a1a2e",
            borderRadius: 24,
            border: "1px solid rgba(255,255,255,0.08)",
            padding: 28,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <h3 style={{ fontSize: 20, fontWeight: 700, color: "#E4E1EE" }}>Đánh giá khóa học</h3>
            <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#C7C4D8" }}>
              <X size={20} />
            </button>
          </div>
          <div style={{ textAlign: "center", padding: "20px 0" }}>
            <AlertCircle size={48} color="#FFB785" />
            <p style={{ color: "#FFB785", fontSize: 16, fontWeight: 600, marginTop: 16 }}>
              {eligibility.message}
            </p>
            {eligibility.progress !== undefined && (
              <div style={{ marginTop: 12 }}>
                <div style={{ height: 6, background: "rgba(255,255,255,0.1)", borderRadius: 3, overflow: "hidden", maxWidth: 300, margin: "0 auto" }}>
                  <div style={{ width: `${Math.min(eligibility.progress, 100)}%`, height: "100%", background: "#6C63FF", borderRadius: 3 }} />
                </div>
                <p style={{ fontSize: 12, color: "#C7C4D8", marginTop: 4 }}>
                  Tiến độ hiện tại: {Math.round(eligibility.progress)}% (cần 30%)
                </p>
              </div>
            )}
            <button
              onClick={onClose}
              style={{
                marginTop: 20,
                padding: "10px 24px",
                borderRadius: 12,
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.08)",
                color: "#C7C4D8",
                cursor: "pointer",
              }}
            >
              Đóng
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (checking) {
    return (
      <div
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.7)",
          backdropFilter: "blur(6px)",
          zIndex: 9999,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 20,
        }}
      >
        <div style={{ background: "#1a1a2e", borderRadius: 24, padding: 40, textAlign: "center" }}>
          <Loader size={32} style={{ animation: "spin 1s linear infinite" }} />
          <p style={{ color: "#C7C4D8", marginTop: 16 }}>Đang kiểm tra điều kiện...</p>
        </div>
      </div>
    );
  }

  // ✅ Form review (khi đủ điều kiện)
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.7)",
        backdropFilter: "blur(6px)",
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 500,
          background: "#1a1a2e",
          borderRadius: 24,
          border: "1px solid rgba(255,255,255,0.08)",
          padding: 28,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h3 style={{ fontSize: 20, fontWeight: 700, color: "#E4E1EE" }}>Đánh giá khóa học</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#C7C4D8" }}>
            <X size={20} />
          </button>
        </div>

        <p style={{ fontSize: 14, color: "#C7C4D8", marginBottom: 16 }}>
          <strong>{courseTitle}</strong>
        </p>

        {/* Verified badge */}
        {eligibility?.eligible && eligibility.progress && eligibility.progress >= 80 && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, background: "rgba(69,241,197,0.08)", padding: "8px 12px", borderRadius: 8 }}>
            <Shield size={16} color="#45f1c5" />
            <span style={{ fontSize: 12, color: "#45f1c5", fontWeight: 600 }}>✓ Verified Learner</span>
          </div>
        )}

        {/* Star rating */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#C7C4D8", marginBottom: 8 }}>
            Đánh giá của bạn *
          </label>
          <div style={{ display: "flex", gap: 6 }}>
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => setRating(star)}
                onMouseEnter={() => setHoverRating(star)}
                onMouseLeave={() => setHoverRating(0)}
                style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}
              >
                <Star
                  size={28}
                  fill={(hoverRating || rating) >= star ? "#FFB785" : "transparent"}
                  color="#FFB785"
                />
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#C7C4D8", marginBottom: 8 }}>
            Nội dung đánh giá *
          </label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={4}
            placeholder="Chia sẻ trải nghiệm của bạn về khóa học..."
            style={{
              width: "100%",
              background: "#0d0d18",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 12,
              padding: "12px",
              color: "#E4E1EE",
              fontSize: 14,
              resize: "vertical",
              outline: "none",
            }}
            autoFocus
          />
        </div>

        {error && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 16, color: "#ffb4ab", fontSize: 13 }}>
            <AlertCircle size={16} /> {error}
          </div>
        )}

        <div style={{ display: "flex", gap: 12 }}>
          <button
            onClick={onClose}
            style={{
              flex: 1,
              padding: "10px",
              borderRadius: 12,
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.08)",
              color: "#C7C4D8",
              cursor: "pointer",
            }}
          >
            Hủy
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            style={{
              flex: 2,
              padding: "10px",
              borderRadius: 12,
              background: "linear-gradient(135deg,#6C63FF,#9B59B6)",
              border: "none",
              color: "#fff",
              fontWeight: 700,
              cursor: loading ? "wait" : "pointer",
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? "Đang gửi..." : "Gửi đánh giá"}
          </button>
        </div>
      </div>
    </div>
  );
}
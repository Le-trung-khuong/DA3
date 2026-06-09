/**
 * src/components/player/LessonCompleteButton.tsx
 * Nút đánh dấu hoàn thành bài học – có nhận trạng thái completed từ ngoài
 */

import React, { useState } from "react";
import { CheckCircle, Loader } from "lucide-react";
import { completeLesson } from "../../services/progressService";

interface LessonCompleteButtonProps {
  userId: string;
  courseId: string;
  moduleId: string;
  lessonId: string;
  xpReward: number;
  onComplete?: () => void;
  disabled?: boolean;
  isCompleted?: boolean; // ✅ thêm prop này
}

export function LessonCompleteButton({
  userId,
  courseId,
  moduleId,
  lessonId,
  xpReward,
  onComplete,
  disabled = false,
  isCompleted = false, // ✅ mặc định false
}: LessonCompleteButtonProps) {
  const [loading, setLoading] = useState(false);
  const [localCompleted, setLocalCompleted] = useState(false);

  // Hiển thị completed nếu đã hoàn thành từ trước HOẶC vừa mới hoàn thành
  const showCompleted = isCompleted || localCompleted;

  const handleComplete = async () => {
    if (loading || showCompleted || disabled) return;
    setLoading(true);
    try {
      await completeLesson(userId, courseId, moduleId, lessonId, xpReward);
      setLocalCompleted(true);
      onComplete?.();
    } catch (error) {
      console.error("Failed to mark lesson complete:", error);
      alert("Không thể cập nhật tiến độ. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  };

  if (showCompleted) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#45f1c5" }}>
        <CheckCircle size={20} />
        <span style={{ fontSize: 14, fontWeight: 600 }}>Completed! +{xpReward} XP</span>
      </div>
    );
  }

  return (
    <button
      onClick={handleComplete}
      disabled={loading || disabled}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        background: "linear-gradient(135deg,#6C63FF,#9B59B6)",
        border: "none",
        padding: "10px 24px",
        borderRadius: 12,
        fontSize: 14,
        fontWeight: 700,
        color: "#fff",
        cursor: loading ? "wait" : "pointer",
        opacity: loading || disabled ? 0.7 : 1,
        transition: "opacity 0.2s",
      }}
    >
      {loading ? <Loader size={18} style={{ animation: "spin 0.8s linear infinite" }} /> : <CheckCircle size={18} />}
      {loading ? "Updating..." : "Mark as Completed"}
    </button>
  );
}
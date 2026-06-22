// src/components/player/LessonCompleteButton.tsx
import React, { useState, useRef } from "react";
import { CheckCircle, Loader, AlertCircle } from "lucide-react";
import { completeLesson } from "../../services/progressService";

interface LessonCompleteButtonProps {
  userId: string;
  courseId: string;
  moduleId: string;
  lessonId: string;
  xpReward: number;
  onComplete?: () => void;
  disabled?: boolean;
  isCompleted?: boolean;
  xpEarned?: number;
  lessonType?: 'lesson' | 'quiz' | 'reading' | 'video' | 'flashcard';
  // Additional requirements
  requirementsMet?: boolean;
  requirementMessage?: string;
}

export function LessonCompleteButton({
  userId,
  courseId,
  moduleId,
  lessonId,
  xpReward,
  onComplete,
  disabled = false,
  isCompleted = false,
  xpEarned = 0,
  lessonType = 'lesson',
  requirementsMet = true,
  requirementMessage = '',
}: LessonCompleteButtonProps) {
  const [loading, setLoading] = useState(false);
  const [localCompleted, setLocalCompleted] = useState(false);
  const loadingRef = useRef(false);

  const showCompleted = (isCompleted && xpEarned > 0) || localCompleted;

  const handleComplete = async () => {
    if (loadingRef.current || showCompleted || disabled) return;
    
    // Check requirements
    if (!requirementsMet) {
      alert(requirementMessage || 'Bạn chưa đáp ứng đủ điều kiện hoàn thành bài học.');
      return;
    }
    
    loadingRef.current = true;
    setLoading(true);

    try {
      await completeLesson(userId, courseId, moduleId, lessonId, xpReward, lessonType);
      setLocalCompleted(true);
      onComplete?.();
    } catch (error) {
      console.error("Failed to mark lesson complete:", error);
      alert("Không thể cập nhật tiến độ. Vui lòng thử lại.");
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  };

  if (showCompleted) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#45f1c5" }}>
        <CheckCircle size={20} />
        <span style={{ fontSize: 14, fontWeight: 600 }}>
          Completed! +{xpEarned || xpReward} XP
        </span>
      </div>
    );
  }

  return (
    <div>
      <button
        onClick={handleComplete}
        disabled={loading || disabled}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          background: loading || !requirementsMet 
            ? "rgba(255,255,255,0.05)" 
            : "linear-gradient(135deg,#6C63FF,#9B59B6)",
          border: "none",
          padding: "10px 24px",
          borderRadius: 12,
          fontSize: 14,
          fontWeight: 700,
          color: loading || !requirementsMet ? "#C7C4D8" : "#fff",
          cursor: loading ? "wait" : (!requirementsMet ? "not-allowed" : "pointer"),
          opacity: loading || disabled ? 0.7 : 1,
          transition: "all 0.2s",
        }}
      >
        {loading ? (
          <Loader size={18} style={{ animation: "spin 0.8s linear infinite" }} />
        ) : !requirementsMet ? (
          <AlertCircle size={18} />
        ) : (
          <CheckCircle size={18} />
        )}
        {loading ? "Updating..." : !requirementsMet ? "Requirements Not Met" : "Mark as Completed"}
      </button>
      {!requirementsMet && requirementMessage && (
        <p style={{ fontSize: 12, color: "#FFB785", marginTop: 8 }}>
          ⚠️ {requirementMessage}
        </p>
      )}
    </div>
  );
}
/**
 * src/components/player/FlashcardLesson.tsx
 * Flashcard lesson (flip card, basic)
 */

import React, { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight, RotateCw, CheckCircle } from "lucide-react";
import { LessonCompleteButton } from "./LessonCompleteButton";
import { updateFlashcardProgress } from "../../services/progressService";

interface FlashcardCard {
  id: string;
  front: string;
  back: string;
  hint?: string;
}

interface FlashcardLessonProps {
  userId: string;
  courseId: string;
  moduleId: string;
  lessonId: string;
  title: string;
  cards: FlashcardCard[];
  xpReward: number;
  savedProgress?: { totalCards: number; rememberedCards: number; lastCardIndex: number };
  onComplete?: () => void;
}

export function FlashcardLesson({
  userId,
  courseId,
  moduleId,
  lessonId,
  title,
  cards,
  xpReward,
  savedProgress,
  onComplete,
}: FlashcardLessonProps) {
  const [currentIndex, setCurrentIndex] = useState(() => {
    if (savedProgress && savedProgress.lastCardIndex !== undefined && savedProgress.lastCardIndex < cards.length) {
      return savedProgress.lastCardIndex;
    }
    return 0;
  });
  const [flipped, setFlipped] = useState(false);
  const [remembered, setRemembered] = useState<Set<string>>(() => {
    if (savedProgress && savedProgress.rememberedCards) {
      // We need to know which cards were remembered; we'll track by index as string
      // For simplicity, we'll store remembered indices as a Set of string ids or indices.
      // Here we'll use remembered card ids.
      return new Set();
    }
    return new Set();
  });
  const [progressSaved, setProgressSaved] = useState(false);

  const currentCard = cards[currentIndex];
  const totalCards = cards.length;
  const rememberedCount = remembered.size;

  useEffect(() => {
    // Auto-save progress when remembered set changes or index changes
    const saveProgress = async () => {
      if (progressSaved) return;
      await updateFlashcardProgress(userId, courseId, moduleId, lessonId, {
        totalCards,
        rememberedCards: rememberedCount,
        lastCardIndex: currentIndex,
      });
    };
    saveProgress();
  }, [rememberedCount, currentIndex, userId, courseId, moduleId, lessonId, totalCards, progressSaved]);

  const handleFlip = () => setFlipped(!flipped);

  const handleRemember = () => {
    setRemembered((prev) => {
      const next = new Set(prev);
      next.add(currentCard.id);
      return next;
    });
    // Move to next card
    if (currentIndex + 1 < totalCards) {
      setCurrentIndex(currentIndex + 1);
      setFlipped(false);
    }
  };

  const handleNext = () => {
    if (currentIndex + 1 < totalCards) {
      setCurrentIndex(currentIndex + 1);
      setFlipped(false);
    }
  };

  const handlePrev = () => {
    if (currentIndex - 1 >= 0) {
      setCurrentIndex(currentIndex - 1);
      setFlipped(false);
    }
  };

  const allRemembered = rememberedCount === totalCards;

  if (allRemembered) {
    return (
      <div style={{ maxWidth: 600, margin: "0 auto", textAlign: "center" }}>
        <div style={{ background: "rgba(69,241,197,0.1)", borderRadius: 16, padding: 32, marginBottom: 24 }}>
          <CheckCircle size={48} color="#45f1c5" style={{ marginBottom: 16 }} />
          <h3 style={{ fontSize: 20, fontWeight: 700, color: "#E4E1EE", marginBottom: 8 }}>Great job!</h3>
          <p style={{ fontSize: 16, color: "#C7C4D8" }}>You've mastered all {totalCards} flashcards.</p>
        </div>
        <LessonCompleteButton
          userId={userId}
          courseId={courseId}
          moduleId={moduleId}
          lessonId={lessonId}
          xpReward={xpReward}
          flashcardProgress={{ totalCards, rememberedCards: rememberedCount, lastCardIndex: currentIndex }}
          onComplete={onComplete}
        />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 600, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <h2 style={{ fontSize: 24, fontWeight: 700, color: "#E4E1EE" }}>{title}</h2>
        <span style={{ fontSize: 14, color: "#C7C4D8" }}>
          {currentIndex + 1} / {totalCards} • {rememberedCount} remembered
        </span>
      </div>

      {/* Flashcard */}
      <div
        onClick={handleFlip}
        style={{
          perspective: "1000px",
          cursor: "pointer",
          marginBottom: 24,
        }}
      >
        <div
          style={{
            position: "relative",
            width: "100%",
            height: 320,
            transition: "transform 0.6s",
            transformStyle: "preserve-3d",
            transform: flipped ? "rotateY(180deg)" : "rotateY(0)",
          }}
        >
          {/* Front */}
          <div
            style={{
              position: "absolute",
              width: "100%",
              height: "100%",
              backfaceVisibility: "hidden",
              background: "linear-gradient(135deg, #1a1a2e, #0d0d18)",
              borderRadius: 20,
              border: "1px solid rgba(108,99,255,0.3)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 24,
              textAlign: "center",
            }}
          >
            <p style={{ fontSize: 20, fontWeight: 600, color: "#E4E1EE" }}>{currentCard.front}</p>
          </div>
          {/* Back */}
          <div
            style={{
              position: "absolute",
              width: "100%",
              height: "100%",
              backfaceVisibility: "hidden",
              transform: "rotateY(180deg)",
              background: "linear-gradient(135deg, #1a1a2e, #0d0d18)",
              borderRadius: 20,
              border: "1px solid rgba(69,241,197,0.3)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: 24,
              textAlign: "center",
            }}
          >
            <p style={{ fontSize: 18, fontWeight: 500, color: "#C7C4D8", marginBottom: 16 }}>{currentCard.back}</p>
            {currentCard.hint && (
              <p style={{ fontSize: 12, color: "#FFB785", fontStyle: "italic" }}>Hint: {currentCard.hint}</p>
            )}
          </div>
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "center", gap: 12, marginBottom: 24 }}>
        <button
          onClick={handlePrev}
          disabled={currentIndex === 0}
          style={{
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 10,
            padding: "8px 16px",
            cursor: currentIndex === 0 ? "not-allowed" : "pointer",
            color: "#C7C4D8",
          }}
        >
          <ChevronLeft size={18} /> Previous
        </button>
        <button
          onClick={handleRemember}
          style={{
            background: "linear-gradient(135deg,#45f1c5,#00A878)",
            border: "none",
            borderRadius: 10,
            padding: "8px 20px",
            fontWeight: 700,
            color: "#000",
            cursor: "pointer",
          }}
        >
          Remembered ✓
        </button>
        <button
          onClick={handleNext}
          disabled={currentIndex === totalCards - 1}
          style={{
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 10,
            padding: "8px 16px",
            cursor: currentIndex === totalCards - 1 ? "not-allowed" : "pointer",
            color: "#C7C4D8",
          }}
        >
          Next <ChevronRight size={18} />
        </button>
      </div>

      <div style={{ textAlign: "center" }}>
        <button
          onClick={handleFlip}
          style={{
            background: "none",
            border: "none",
            color: "#6C63FF",
            fontSize: 13,
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          <RotateCw size={14} /> Flip card
        </button>
      </div>
    </div>
  );
}
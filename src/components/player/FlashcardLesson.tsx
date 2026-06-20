// src/components/player/FlashcardLesson.tsx
import React, { useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight, RotateCw, CheckCircle, RefreshCw, BarChart2 } from "lucide-react";
import { LessonCompleteButton } from "./LessonCompleteButton";
import { saveFlashcardProgress, saveResumeData, getResumeData } from "../../services/progressService";
import { useSRS } from "../../hooks/useSRS";

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
  isCompleted?: boolean;
  lessonType?: 'lesson' | 'quiz' | 'reading' | 'video' | 'flashcard';
}

type StudyMode = "learn" | "review" | "test";
type Difficulty = "again" | "hard" | "good" | "easy";

export function FlashcardLesson({
  userId, courseId, moduleId, lessonId, title, cards, xpReward, savedProgress, onComplete, isCompleted = false,
  lessonType = 'flashcard',
}: FlashcardLessonProps) {
  const [mode, setMode] = useState<StudyMode>("learn");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [mastered, setMastered] = useState<Set<string>>(() => new Set());
  const [reviewQueue, setReviewQueue] = useState<string[]>([]);
  const [stats, setStats] = useState({ totalReviewed: 0, correct: 0 });

  const { cards: srsCards, submitReview, initCard, refresh: refreshSRS } = useSRS(userId);
  const [showSRS, setShowSRS] = useState(false);
  const [currentSRSIndex, setCurrentSRSIndex] = useState(0);
  const [srsFlipped, setSrsFlipped] = useState(false);

  useEffect(() => {
    if (savedProgress?.rememberedCards) {
      const masteredIds = cards.slice(0, savedProgress.rememberedCards).map(c => c.id);
      setMastered(new Set(masteredIds));
    }
  }, [savedProgress, cards]);

  useEffect(() => {
    const loadResume = async () => {
      if (!userId || !courseId || !moduleId || !lessonId || isCompleted) return;
      const data = await getResumeData(userId, courseId, moduleId, lessonId);
      if (data) {
        if (data.flashcardCurrentIndex !== undefined) setCurrentIndex(data.flashcardCurrentIndex);
        if (data.flashcardReviewQueue) setReviewQueue(data.flashcardReviewQueue);
      }
    };
    loadResume();
  }, [userId, courseId, moduleId, lessonId, isCompleted]);

  useEffect(() => {
    if (!userId || !courseId || !moduleId || !lessonId || isCompleted) return;
    const timeout = setTimeout(() => {
      saveResumeData(userId, courseId, moduleId, lessonId, {
        flashcardCurrentIndex: currentIndex,
        flashcardReviewQueue: reviewQueue,
      });
    }, 500);
    return () => clearTimeout(timeout);
  }, [currentIndex, reviewQueue, userId, courseId, moduleId, lessonId, isCompleted]);

  const totalCards = cards.length;
  const currentCard = cards[currentIndex];
  const masteredCount = mastered.size;
  const allMastered = masteredCount === totalCards;

  useEffect(() => {
    const save = async () => {
      const flashcardProgress = {
        lessonId,
        cards: Object.fromEntries(cards.map(card => [card.id, {
          mastered: mastered.has(card.id),
          timesReviewed: mastered.has(card.id) ? 1 : 0,
          lastReviewedAt: new Date(),
        }])),
        masteredCount: mastered.size,
        totalCount: cards.length,
        lastActivityAt: new Date(),
      };
      await saveFlashcardProgress(userId, courseId, moduleId, lessonId, flashcardProgress);
    };
    save();
  }, [mastered, currentIndex, cards, userId, courseId, moduleId, lessonId]);

  useEffect(() => {
    if (allMastered && !isCompleted) {
      cards.forEach(card => initCard(card.id));
    }
  }, [allMastered, cards, initCard, isCompleted]);

  const handleFlip = () => setFlipped(!flipped);

  const handleDifficulty = (difficulty: Difficulty) => {
    if (difficulty === "again") {
      setReviewQueue(prev => [...prev, currentCard.id]);
    } else if (difficulty === "hard") {
      setReviewQueue(prev => [...prev, currentCard.id]);
    } else if (difficulty === "good") {
      setMastered(prev => new Set(prev).add(currentCard.id));
    } else if (difficulty === "easy") {
      setMastered(prev => new Set(prev).add(currentCard.id));
    }
    setStats(prev => ({ ...prev, totalReviewed: prev.totalReviewed + 1, correct: prev.correct + (difficulty !== "again" ? 1 : 0) }));
    nextCard();
  };

  const nextCard = () => {
    if (currentIndex + 1 < totalCards) {
      setCurrentIndex(currentIndex + 1);
      setFlipped(false);
    } else if (reviewQueue.length > 0) {
      const nextId = reviewQueue.shift();
      const idx = cards.findIndex(c => c.id === nextId);
      if (idx !== -1) setCurrentIndex(idx);
      setFlipped(false);
    }
  };

  const prevCard = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      setFlipped(false);
    }
  };

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.code === "Space") { e.preventDefault(); handleFlip(); }
      if (e.code === "ArrowLeft") prevCard();
      if (e.code === "ArrowRight") nextCard();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [currentIndex, flipped]);

  const renderSRSModal = () => {
    if (!showSRS) return null;
    const srsCard = srsCards[currentSRSIndex];
    const flashCard = cards.find(c => c.id === srsCard?.cardId);

    return (
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ background: '#1a1a2e', borderRadius: 24, padding: 24, maxWidth: 500, width: '100%' }}>
          <h3 style={{ color: '#E4E1EE', marginBottom: 16 }}>Ôn tập SRS</h3>
          {srsCards.length === 0 ? (
            <p style={{ color: '#C7C4D8' }}>Không có thẻ cần ôn hôm nay.</p>
          ) : (
            <>
              <div style={{ padding: 16, background: '#0d0d18', borderRadius: 12, marginBottom: 16 }}>
                {srsFlipped ? (
                  <p style={{ color: '#E4E1EE' }}>{flashCard?.back || 'N/A'}</p>
                ) : (
                  <p style={{ color: '#E4E1EE' }}>{flashCard?.front || 'N/A'}</p>
                )}
              </div>
              <button onClick={() => setSrsFlipped(!srsFlipped)} style={{ marginBottom: 16, background: '#6C63FF', border: 'none', padding: '4px 12px', borderRadius: 8, color: '#fff', cursor: 'pointer' }}>Lật thẻ</button>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
                {[0, 1, 2, 3, 4, 5].map(q => (
                  <button key={q} onClick={() => {
                    submitReview(srsCards[currentSRSIndex].cardId, q);
                    setSrsFlipped(false);
                    setCurrentSRSIndex((i) => (i + 1) % srsCards.length);
                  }} style={{ padding: '4px 12px', background: '#6C63FF', border: 'none', borderRadius: 8, color: '#fff', cursor: 'pointer' }}>
                    {q}
                  </button>
                ))}
              </div>
            </>
          )}
          <button onClick={() => setShowSRS(false)} style={{ marginTop: 16, background: 'none', border: 'none', color: '#C7C4D8', cursor: 'pointer' }}>Đóng</button>
        </div>
      </div>
    );
  };

  if (allMastered) {
    return (
      <div style={{ maxWidth: 600, margin: "0 auto", textAlign: "center" }}>
        <div style={{ background: "rgba(69,241,197,0.1)", borderRadius: 20, padding: 32, marginBottom: 24 }}>
          <CheckCircle size={48} color="#45f1c5" />
          <h3 style={{ fontSize: 22, fontWeight: 700, color: "#E4E1EE", marginTop: 16 }}>Excellent!</h3>
          <p style={{ fontSize: 16, color: "#C7C4D8" }}>You mastered all {totalCards} flashcards.</p>
          <div style={{ marginTop: 16, display: "flex", justifyContent: "center", gap: 12 }}>
            <div><BarChart2 size={16} /> {stats.totalReviewed} reviews</div>
            <div>🎯 {Math.round((stats.correct/stats.totalReviewed)*100)||0}% accuracy</div>
          </div>
        </div>
        <LessonCompleteButton
          userId={userId} courseId={courseId} moduleId={moduleId} lessonId={lessonId}
          xpReward={xpReward} onComplete={onComplete} isCompleted={isCompleted}
          lessonType={lessonType}
        />
        <div style={{ marginTop: 16 }}>
          <button onClick={() => { setShowSRS(true); refreshSRS(); }} style={{ background: '#6C63FF', border: 'none', padding: '6px 16px', borderRadius: 20, color: '#fff', cursor: 'pointer' }}>
            📚 Ôn tập SRS ({srsCards.length})
          </button>
        </div>
        {renderSRSModal()}
      </div>
    );
  }

  if (mode !== "learn") {
    return (
      <div style={{ maxWidth: 500, margin: "0 auto", textAlign: "center" }}>
        <h2 style={{ fontSize: 24, fontWeight: 700, color: "#E4E1EE", marginBottom: 24 }}>{title}</h2>
        <div style={{ display: "flex", gap: 16, justifyContent: "center", marginBottom: 32 }}>
          <button onClick={() => setMode("learn")} style={{ background: "linear-gradient(135deg,#6C63FF,#9B59B6)", border: "none", padding: "12px 24px", borderRadius: 40, color: "#fff", fontWeight: 700 }}>Start Learn</button>
          <button onClick={() => setMode("review")} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", padding: "12px 24px", borderRadius: 40, color: "#C7C4D8" }}>Review</button>
          <button onClick={() => setMode("test")} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", padding: "12px 24px", borderRadius: 40, color: "#C7C4D8" }}>Test</button>
        </div>
        <p style={{ color: "#C7C4D8" }}>Choose a study mode to begin.</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 600, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <h2 style={{ fontSize: 24, fontWeight: 700, color: "#E4E1EE" }}>{title}</h2>
        <span style={{ fontSize: 14, color: "#C7C4D8" }}>{masteredCount}/{totalCards} mastered</span>
      </div>

      <div style={{ height: 4, background: "rgba(255,255,255,0.1)", borderRadius: 2, marginBottom: 24 }}>
        <div style={{ width: `${(masteredCount/totalCards)*100}%`, height: "100%", background: "#45f1c5", borderRadius: 2 }} />
      </div>

      <div onClick={handleFlip} style={{ perspective: "1000px", cursor: "pointer", marginBottom: 24 }}>
        <div style={{ position: "relative", width: "100%", height: 320, transition: "transform 0.6s", transformStyle: "preserve-3d", transform: flipped ? "rotateY(180deg)" : "none" }}>
          <div style={{ position: "absolute", width: "100%", height: "100%", backfaceVisibility: "hidden", background: "linear-gradient(135deg,#1a1a2e,#0d0d18)", borderRadius: 20, border: "1px solid rgba(108,99,255,0.3)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, textAlign: "center" }}>
            <p style={{ fontSize: 20, fontWeight: 600, color: "#E4E1EE" }}>{currentCard.front}</p>
          </div>
          <div style={{ position: "absolute", width: "100%", height: "100%", backfaceVisibility: "hidden", transform: "rotateY(180deg)", background: "linear-gradient(135deg,#1a1a2e,#0d0d18)", borderRadius: 20, border: "1px solid rgba(69,241,197,0.3)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24 }}>
            <p style={{ fontSize: 18, fontWeight: 500, color: "#C7C4D8", marginBottom: 16 }}>{currentCard.back}</p>
            {currentCard.hint && <p style={{ fontSize: 12, color: "#FFB785" }}>💡 {currentCard.hint}</p>}
          </div>
        </div>
      </div>

      {flipped && (
        <div style={{ display: "flex", justifyContent: "center", gap: 12, marginBottom: 24 }}>
          {(["again","hard","good","easy"] as Difficulty[]).map(d => (
            <button key={d} onClick={() => handleDifficulty(d)}
              style={{ background: d==="again"?"rgba(255,107,107,0.2)": d==="hard"?"rgba(255,183,133,0.2)": d==="good"?"rgba(69,241,197,0.2)":"rgba(108,99,255,0.2)", border: `1px solid ${d==="again"?"#ff6b6b": d==="hard"?"#FFB785": d==="good"?"#45f1c5":"#6C63FF"}`, borderRadius: 40, padding: "6px 16px", fontSize: 12, fontWeight: 600, color: d==="again"?"#ff6b6b": d==="hard"?"#FFB785": d==="good"?"#45f1c5":"#6C63FF", cursor: "pointer" }}>
              {d.toUpperCase()}
            </button>
          ))}
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "center", gap: 12 }}>
        <button onClick={prevCard} disabled={currentIndex === 0}
          style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: "8px 16px", cursor: "pointer", color: "#C7C4D8" }}>
          <ChevronLeft size={16} />
        </button>
        <button onClick={handleFlip}
          style={{ background: "rgba(108,99,255,0.2)", border: "none", borderRadius: 10, padding: "8px 16px", color: "#c4c0ff", cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
          <RotateCw size={14} /> Flip
        </button>
        <button onClick={nextCard} disabled={currentIndex === totalCards-1 && reviewQueue.length === 0}
          style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: "8px 16px", cursor: "pointer", color: "#C7C4D8" }}>
          <ChevronRight size={16} />
        </button>
      </div>

      <div style={{ textAlign: "center", marginTop: 32 }}>
        <button onClick={() => { setMode("learn"); setCurrentIndex(0); setFlipped(false); setMastered(new Set()); setReviewQueue([]); }} style={{ background: "none", border: "none", color: "#6C63FF", fontSize: 12, cursor: "pointer" }}>
          <RefreshCw size={12} /> Reset session
        </button>
        <br />
        <button onClick={() => { setShowSRS(true); refreshSRS(); }} style={{ marginTop: 8, background: '#6C63FF', border: 'none', padding: '6px 16px', borderRadius: 20, color: '#fff', cursor: 'pointer' }}>
          📚 Ôn tập SRS ({srsCards.length})
        </button>
      </div>

      {renderSRSModal()}
    </div>
  );
}
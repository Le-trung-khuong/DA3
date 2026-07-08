// src/components/player/FlashcardLesson.tsx
import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { ChevronLeft, ChevronRight, RotateCw, CheckCircle, RefreshCw, BarChart2, Search, Filter } from "lucide-react";
import { LessonCompleteButton } from "./LessonCompleteButton";
import { saveFlashcardProgress, saveResumeData, getResumeData } from "../../services/progressService";
import { useSRS } from "../../hooks/useSRS";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../utils/config";
import { normalizeAnswer } from "../../utils/textAnswer";
import { FlashcardCard } from "../../types/lesson";

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
  lessonType?: "lesson" | "quiz" | "reading" | "video" | "flashcard";
}

type StudyMode = "learn" | "review" | "test" | "browse" | "typing";
type Difficulty = "again" | "hard" | "good" | "easy";

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
  isCompleted = false,
  lessonType = "flashcard",
}: FlashcardLessonProps) {
  const [mode, setMode] = useState<StudyMode>("learn");
  const [cardOrder, setCardOrder] = useState<string[]>(() => cards.map((c) => c.id));
  const [currentIndex, setCurrentIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [mastered, setMastered] = useState<Set<string>>(() => new Set());
  const [reviewQueue, setReviewQueue] = useState<string[]>([]);
  const [stats, setStats] = useState({ totalReviewed: 0, correct: 0 });
  const [isProcessing, setIsProcessing] = useState(false);
  const [xpEarned, setXpEarned] = useState(0);
  const [isCompletedState, setIsCompletedState] = useState(isCompleted);

  // View tracking
  const [viewedCardIds, setViewedCardIds] = useState<Set<string>>(new Set());

  // Category filter & search (browse mode)
  const [filterCategory, setFilterCategory] = useState<string | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Typing mode
  const [typedAnswer, setTypedAnswer] = useState("");
  const [typingResult, setTypingResult] = useState<"correct" | "incorrect" | null>(null);

  const { cards: srsCards, submitReview, initCard, refresh: refreshSRS } = useSRS(userId);
  const [showSRS, setShowSRS] = useState(false);
  const [currentSRSIndex, setCurrentSRSIndex] = useState(0);
  const [srsFlipped, setSrsFlipped] = useState(false);

  // Categories
  const categories = useMemo(
    () => Array.from(new Set(cards.map((c) => c.category).filter(Boolean))) as string[],
    [cards]
  );

  // Filter + Search
  const filteredCards = useMemo(() => {
    let list = cards;
    if (filterCategory !== "all") list = list.filter((c) => c.category === filterCategory);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((c) => c.front.toLowerCase().includes(q) || c.back.toLowerCase().includes(q));
    }
    return list;
  }, [cards, filterCategory, searchQuery]);

  // orderedCards (respect cardOrder)
  const orderedCards = useMemo(() => {
    const order = cardOrder.filter((id) => filteredCards.some((c) => c.id === id));
    // add any new cards not in order
    const missing = filteredCards.filter((c) => !order.includes(c.id));
    return [...order, ...missing.map((c) => c.id)].map((id) => filteredCards.find((c) => c.id === id)!).filter(Boolean);
  }, [cardOrder, filteredCards]);

  const totalCards = orderedCards.length;
  const currentCard = orderedCards[currentIndex];
  const masteredCount = mastered.size;
  const allMastered = masteredCount === totalCards;
  const allViewed = viewedCardIds.size === totalCards;

  // Shuffle
  const shuffleCards = useCallback(() => {
    if (flipped) return; // không xáo khi đang lật
    const ids = filteredCards.map((c) => c.id);
    for (let i = ids.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [ids[i], ids[j]] = [ids[j], ids[i]];
    }
    setCardOrder(ids);
    setCurrentIndex(0);
    setFlipped(false);
  }, [filteredCards, flipped]);

  // Lấy xp từ progress
  useEffect(() => {
    const fetchXp = async () => {
      if (!userId || !courseId || !moduleId || !lessonId) return;
      const progressId = `${userId}_${courseId}_${moduleId}_${lessonId}`;
      const progSnap = await getDoc(doc(db, "progress", progressId));
      if (progSnap.exists()) {
        setXpEarned(progSnap.data().xpEarned || 0);
      }
    };
    fetchXp();
  }, [userId, courseId, moduleId, lessonId]);

  // Load viewed set từ resume
  useEffect(() => {
    const loadResume = async () => {
      if (!userId || !courseId || !moduleId || !lessonId || isCompletedState) return;
      const data = await getResumeData(userId, courseId, moduleId, lessonId);
      if (data?.flashcardViewedSet) {
        setViewedCardIds(new Set(data.flashcardViewedSet));
      }
    };
    loadResume();
  }, [userId, courseId, moduleId, lessonId, isCompletedState]);

  // Reset SRS index
  useEffect(() => {
    if (srsCards.length > 0 && currentSRSIndex >= srsCards.length) {
      setCurrentSRSIndex(0);
    }
  }, [srsCards, currentSRSIndex]);

  // Load saved progress
  useEffect(() => {
    if (savedProgress?.rememberedCards) {
      const masteredIds = cards.slice(0, savedProgress.rememberedCards).map((c) => c.id);
      setMastered(new Set(masteredIds));
    }
  }, [savedProgress, cards]);

  // Load resume data (flashcard)
  useEffect(() => {
    const loadResume = async () => {
      if (!userId || !courseId || !moduleId || !lessonId || isCompletedState) return;
      const data = await getResumeData(userId, courseId, moduleId, lessonId);
      if (data) {
        if (data.flashcardCurrentIndex !== undefined) setCurrentIndex(data.flashcardCurrentIndex);
        if (data.flashcardReviewQueue) setReviewQueue(data.flashcardReviewQueue);
      }
    };
    loadResume();
  }, [userId, courseId, moduleId, lessonId, isCompletedState]);

  // Auto-save resume
  useEffect(() => {
    if (!userId || !courseId || !moduleId || !lessonId || isCompletedState) return;
    const timeout = setTimeout(() => {
      saveResumeData(userId, courseId, moduleId, lessonId, {
        flashcardCurrentIndex: currentIndex,
        flashcardReviewQueue: reviewQueue,
        flashcardViewedSet: Array.from(viewedCardIds),
      });
    }, 500);
    return () => clearTimeout(timeout);
  }, [currentIndex, reviewQueue, viewedCardIds, userId, courseId, moduleId, lessonId, isCompletedState]);

  // Debounced saveFlashcardProgress
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }

    saveTimeoutRef.current = setTimeout(async () => {
      const progressId = `${userId}_${courseId}_${moduleId}_${lessonId}`;
      const progSnap = await getDoc(doc(db, "progress", progressId));
      const existingCards = (progSnap.exists() && progSnap.data().flashcardProgress?.cards) || {};

      const flashcardProgress = {
        lessonId,
        cards: Object.fromEntries(
          cards.map((card) => {
            const existing = existingCards[card.id] || {};
            const currentTimesReviewed = existing.timesReviewed || 0;
            const isMastered = mastered.has(card.id);
            const newTimesReviewed = isMastered ? currentTimesReviewed + 1 : currentTimesReviewed;
            return [
              card.id,
              {
                mastered: isMastered,
                timesReviewed: newTimesReviewed,
                lastReviewedAt: new Date(),
              },
            ];
          })
        ),
        masteredCount: mastered.size,
        totalCount: cards.length,
        lastActivityAt: new Date(),
      };
      await saveFlashcardProgress(userId, courseId, moduleId, lessonId, flashcardProgress);
    }, 1000);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = null;
      }
    };
  }, [mastered, cards, userId, courseId, moduleId, lessonId]);

  // Initialize SRS khi master tất cả
  useEffect(() => {
    if (allMastered && !isCompletedState) {
      cards.forEach((card) => initCard(card.id));
    }
  }, [allMastered, cards, initCard, isCompletedState]);

  // Handlers
  const handleFlip = useCallback(() => {
    if (isProcessing) return;
    if (!flipped) {
      setViewedCardIds((prev) => new Set(prev).add(currentCard.id));
    }
    setFlipped((prev) => !prev);
  }, [isProcessing, flipped, currentCard]);

  const nextCard = useCallback(() => {
    if (isProcessing) return;
    if (currentIndex + 1 < totalCards) {
      setCurrentIndex(currentIndex + 1);
      setFlipped(false);
      setTypingResult(null);
      setTypedAnswer("");
    } else if (reviewQueue.length > 0) {
      const queue = [...reviewQueue];
      const nextId = queue.shift();
      if (nextId) {
        const idx = orderedCards.findIndex((c) => c.id === nextId);
        if (idx !== -1) {
          setCurrentIndex(idx);
          setFlipped(false);
          setTypingResult(null);
          setTypedAnswer("");
        }
      }
      setReviewQueue(queue);
    }
  }, [currentIndex, totalCards, reviewQueue, orderedCards, isProcessing]);

  const prevCard = useCallback(() => {
    if (isProcessing) return;
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      setFlipped(false);
      setTypingResult(null);
      setTypedAnswer("");
    }
  }, [currentIndex, isProcessing]);

  const handleDifficulty = useCallback(
    (difficulty: Difficulty) => {
      if (isProcessing) return;
      setIsProcessing(true);

      if (difficulty === "again" || difficulty === "hard") {
        setReviewQueue((prev) => [...prev, currentCard.id]);
      } else if (difficulty === "good" || difficulty === "easy") {
        setMastered((prev) => new Set(prev).add(currentCard.id));
      }

      setStats((prev) => ({
        ...prev,
        totalReviewed: prev.totalReviewed + 1,
        correct: prev.correct + (difficulty !== "again" ? 1 : 0),
      }));

      if (currentIndex + 1 < totalCards) {
        setCurrentIndex((prev) => prev + 1);
        setFlipped(false);
        setTypingResult(null);
        setTypedAnswer("");
      } else if (reviewQueue.length > 0) {
        const queue = [...reviewQueue];
        const nextId = queue.shift();
        if (nextId) {
          const idx = orderedCards.findIndex((c) => c.id === nextId);
          if (idx !== -1) {
            setCurrentIndex(idx);
            setFlipped(false);
            setTypingResult(null);
            setTypedAnswer("");
          }
        }
        setReviewQueue(queue);
      }

      setIsProcessing(false);
    },
    [isProcessing, currentCard, currentIndex, totalCards, reviewQueue, orderedCards]
  );

  // Typing mode handler
  const submitTypedAnswer = () => {
    if (!currentCard) return;
    const isCorrect = normalizeAnswer(typedAnswer) === normalizeAnswer(currentCard.back);
    setTypingResult(isCorrect ? "correct" : "incorrect");
    if (isCorrect) {
      setMastered((prev) => new Set(prev).add(currentCard.id));
      setStats((prev) => ({ ...prev, totalReviewed: prev.totalReviewed + 1, correct: prev.correct + 1 }));
    } else {
      setReviewQueue((prev) => [...prev, currentCard.id]);
      setStats((prev) => ({ ...prev, totalReviewed: prev.totalReviewed + 1 }));
    }
  };

  // Keyboard
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        e.preventDefault();
        if (mode === "typing") return;
        handleFlip();
      }
      if (e.code === "ArrowLeft") prevCard();
      if (e.code === "ArrowRight") nextCard();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [handleFlip, prevCard, nextCard, mode]);

  // SRS Modal
  const renderSRSModal = () => {
    if (!showSRS) return null;

    if (srsCards.length === 0) {
      return (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 999, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "#1a1a2e", borderRadius: 24, padding: 24, maxWidth: 500, width: "100%" }}>
            <h3 style={{ color: "#E4E1EE", marginBottom: 16 }}>Ôn tập SRS</h3>
            <p style={{ color: "#C7C4D8" }}>Không có thẻ cần ôn hôm nay.</p>
            <button onClick={() => setShowSRS(false)} style={{ marginTop: 16, background: "none", border: "none", color: "#C7C4D8", cursor: "pointer" }}>Đóng</button>
          </div>
        </div>
      );
    }

    const safeIndex = Math.min(currentSRSIndex, srsCards.length - 1);
    const srsCard = srsCards[safeIndex];
    if (!srsCard) return null;

    const flashCard = cards.find((c) => c.id === srsCard.cardId);
    const totalSRS = srsCards.length;

    return (
      <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 999, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ background: "#1a1a2e", borderRadius: 24, padding: 24, maxWidth: 500, width: "100%" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h3 style={{ color: "#E4E1EE", marginBottom: 16 }}>Ôn tập SRS ({safeIndex + 1}/{totalSRS})</h3>
            <button onClick={() => setShowSRS(false)} style={{ background: "none", border: "none", color: "#C7C4D8", cursor: "pointer", fontSize: 20 }}>✕</button>
          </div>

          <div style={{ padding: 16, background: "#0d0d18", borderRadius: 12, marginBottom: 16 }}>
            {srsFlipped ? <p style={{ color: "#E4E1EE" }}>{flashCard?.back || "N/A"}</p> : <p style={{ color: "#E4E1EE" }}>{flashCard?.front || "N/A"}</p>}
          </div>

          <button onClick={() => setSrsFlipped(!srsFlipped)} style={{ marginBottom: 16, background: "#6C63FF", border: "none", padding: "4px 12px", borderRadius: 8, color: "#fff", cursor: "pointer" }}>
            Lật thẻ
          </button>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16, justifyContent: "center" }}>
            {[0, 1, 2, 3, 4, 5].map((q) => (
              <button
                key={q}
                onClick={() => {
                  if (srsCard) {
                    submitReview(srsCard.cardId, q);
                  }
                  setSrsFlipped(false);
                  const nextIndex = safeIndex + 1;
                  if (nextIndex < srsCards.length) {
                    setCurrentSRSIndex(nextIndex);
                  } else {
                    setShowSRS(false);
                  }
                }}
                style={{ padding: "6px 14px", background: "#6C63FF", border: "none", borderRadius: 8, color: "#fff", cursor: "pointer" }}
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  };

  // ===== Render =====
  const canComplete = allMastered && allViewed && !isCompletedState;

  if (allMastered && allViewed) {
    return (
      <div style={{ maxWidth: 600, margin: "0 auto", textAlign: "center" }}>
        <div style={{ background: "rgba(69,241,197,0.1)", borderRadius: 20, padding: 32, marginBottom: 24 }}>
          <CheckCircle size={48} color="#45f1c5" />
          <h3 style={{ fontSize: 22, fontWeight: 700, color: "#E4E1EE", marginTop: 16 }}>Excellent!</h3>
          <p style={{ fontSize: 16, color: "#C7C4D8" }}>You mastered all {totalCards} flashcards and viewed each at least once.</p>
          <div style={{ marginTop: 16, display: "flex", justifyContent: "center", gap: 12 }}>
            <div><BarChart2 size={16} /> {stats.totalReviewed} reviews</div>
            <div>🎯 {Math.round((stats.correct / stats.totalReviewed) * 100) || 0}% accuracy</div>
          </div>
        </div>
        <LessonCompleteButton
          userId={userId}
          courseId={courseId}
          moduleId={moduleId}
          lessonId={lessonId}
          xpReward={xpReward}
          onComplete={onComplete}
          isCompleted={isCompletedState}
          xpEarned={xpEarned}
          lessonType={lessonType}
          requirementsMet={canComplete}
        />
        <div style={{ marginTop: 16 }}>
          <button
            onClick={() => {
              setShowSRS(true);
              refreshSRS();
            }}
            style={{ background: "#6C63FF", border: "none", padding: "6px 16px", borderRadius: 20, color: "#fff", cursor: "pointer" }}
          >
            📚 Ôn tập SRS ({srsCards.length})
          </button>
        </div>
        {renderSRSModal()}
      </div>
    );
  }

  if (mode !== "learn" && mode !== "browse" && mode !== "typing") {
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

  // Browse mode
  if (mode === "browse") {
    return (
      <div style={{ maxWidth: 700, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <h2 style={{ fontSize: 24, fontWeight: 700, color: "#E4E1EE" }}>{title} — Browse</h2>
          <button onClick={() => setMode("learn")} style={{ background: "rgba(108,99,255,0.2)", border: "none", padding: "6px 16px", borderRadius: 20, color: "#c4c0ff", cursor: "pointer" }}>← Back to Learn</button>
        </div>
        <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 200, display: "flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,0.05)", borderRadius: 10, padding: "4px 12px" }}>
            <Search size={16} color="#C7C4D8" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search flashcards..."
              style={{ background: "none", border: "none", color: "#E4E1EE", padding: "8px 0", flex: 1, outline: "none" }}
            />
          </div>
          {categories.length > 0 && (
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value as string | "all")}
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: "8px 12px", color: "#E4E1EE" }}
            >
              <option value="all">All Categories</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          )}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {orderedCards.map((card, idx) => (
            <div key={card.id} style={{ background: "rgba(26,26,46,0.4)", borderRadius: 10, padding: "12px 16px", border: "1px solid rgba(255,255,255,0.05)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, color: "#E4E1EE" }}>{card.front}</div>
                  <div style={{ fontSize: 13, color: "#C7C4D8" }}>{card.back}</div>
                  {card.category && <span style={{ fontSize: 10, color: "#6C63FF" }}>#{card.category}</span>}
                </div>
                {card.frontImageUrl && <img src={card.frontImageUrl} alt="" style={{ width: 40, height: 40, borderRadius: 8, objectFit: "cover" }} />}
              </div>
            </div>
          ))}
          {orderedCards.length === 0 && <p style={{ color: "#C7C4D8", textAlign: "center" }}>No flashcards match your filter.</p>}
        </div>
      </div>
    );
  }

  // Learn mode
  if (mode === "learn") {
    return (
      <div style={{ maxWidth: 600, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <h2 style={{ fontSize: 24, fontWeight: 700, color: "#E4E1EE" }}>{title}</h2>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <span style={{ fontSize: 14, color: "#C7C4D8" }}>
              {masteredCount}/{totalCards} mastered | {viewedCardIds.size}/{totalCards} viewed
            </span>
            <button onClick={shuffleCards} style={{ background: "rgba(108,99,255,0.2)", border: "none", borderRadius: 20, padding: "4px 12px", color: "#c4c0ff", cursor: "pointer", fontSize: 12 }}>🔀 Xáo</button>
            <button onClick={() => setMode("browse")} style={{ background: "rgba(255,255,255,0.05)", border: "none", borderRadius: 20, padding: "4px 12px", color: "#C7C4D8", cursor: "pointer", fontSize: 12 }}>🔍 Duyệt</button>
          </div>
        </div>

        <div style={{ height: 4, background: "rgba(255,255,255,0.1)", borderRadius: 2, marginBottom: 24 }}>
          <div style={{ width: `${(masteredCount / totalCards) * 100}%`, height: "100%", background: "#45f1c5", borderRadius: 2 }} />
        </div>

        <div onClick={handleFlip} style={{ perspective: "1000px", cursor: "pointer", marginBottom: 24 }}>
          <div style={{ position: "relative", width: "100%", height: 320, transition: "transform 0.6s", transformStyle: "preserve-3d", transform: flipped ? "rotateY(180deg)" : "none" }}>
            <div style={{ position: "absolute", width: "100%", height: "100%", backfaceVisibility: "hidden", background: "linear-gradient(135deg,#1a1a2e,#0d0d18)", borderRadius: 20, border: "1px solid rgba(108,99,255,0.3)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24, textAlign: "center" }}>
              {currentCard.frontImageUrl && <img src={currentCard.frontImageUrl} alt="" style={{ maxWidth: "100%", maxHeight: 120, borderRadius: 12, marginBottom: 12 }} />}
              <p style={{ fontSize: 20, fontWeight: 600, color: "#E4E1EE" }}>{currentCard.front}</p>
              {currentCard.category && <span style={{ fontSize: 10, color: "#6C63FF", marginTop: 8 }}>#{currentCard.category}</span>}
            </div>
            <div style={{ position: "absolute", width: "100%", height: "100%", backfaceVisibility: "hidden", transform: "rotateY(180deg)", background: "linear-gradient(135deg,#1a1a2e,#0d0d18)", borderRadius: 20, border: "1px solid rgba(69,241,197,0.3)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24 }}>
              {currentCard.backImageUrl && <img src={currentCard.backImageUrl} alt="" style={{ maxWidth: "100%", maxHeight: 120, borderRadius: 12, marginBottom: 12 }} />}
              <p style={{ fontSize: 18, fontWeight: 500, color: "#C7C4D8", marginBottom: 16 }}>{currentCard.back}</p>
              {currentCard.hint && <p style={{ fontSize: 12, color: "#FFB785" }}>💡 {currentCard.hint}</p>}
            </div>
          </div>
        </div>

        {flipped && mode === "learn" && (
          <div style={{ display: "flex", justifyContent: "center", gap: 12, marginBottom: 24 }}>
            {(["again", "hard", "good", "easy"] as Difficulty[]).map((d) => (
              <button
                key={d}
                onClick={() => handleDifficulty(d)}
                style={{
                  background: d === "again" ? "rgba(255,107,107,0.2)" : d === "hard" ? "rgba(255,183,133,0.2)" : d === "good" ? "rgba(69,241,197,0.2)" : "rgba(108,99,255,0.2)",
                  border: `1px solid ${d === "again" ? "#ff6b6b" : d === "hard" ? "#FFB785" : d === "good" ? "#45f1c5" : "#6C63FF"}`,
                  borderRadius: 40,
                  padding: "6px 16px",
                  fontSize: 12,
                  fontWeight: 600,
                  color: d === "again" ? "#ff6b6b" : d === "hard" ? "#FFB785" : d === "good" ? "#45f1c5" : "#6C63FF",
                  cursor: "pointer",
                }}
              >
                {d.toUpperCase()}
              </button>
            ))}
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "center", gap: 12 }}>
          <button onClick={prevCard} disabled={currentIndex === 0} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: "8px 16px", cursor: "pointer", color: "#C7C4D8" }}>
            <ChevronLeft size={16} />
          </button>
          <button onClick={handleFlip} style={{ background: "rgba(108,99,255,0.2)", border: "none", borderRadius: 10, padding: "8px 16px", color: "#c4c0ff", cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
            <RotateCw size={14} /> Flip
          </button>
          <button onClick={nextCard} disabled={currentIndex === totalCards - 1 && reviewQueue.length === 0} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: "8px 16px", cursor: "pointer", color: "#C7C4D8" }}>
            <ChevronRight size={16} />
          </button>
        </div>

        <div style={{ textAlign: "center", marginTop: 32 }}>
          <button
            onClick={() => {
              if (window.confirm('Bạn có chắc muốn reset toàn bộ tiến độ flashcard? Hành động này không thể hoàn tác.')) {
                setMode("learn");
                setCurrentIndex(0);
                setFlipped(false);
                setMastered(new Set());
                setReviewQueue([]);
                setViewedCardIds(new Set());
                setCardOrder(cards.map(c => c.id));
                setFilterCategory("all");
                setSearchQuery("");
              }
            }}
            style={{ background: "none", border: "none", color: "#6C63FF", fontSize: 12, cursor: "pointer" }}
          >
            <RefreshCw size={12} /> Reset session
          </button>
          <br />
          <button onClick={() => { setShowSRS(true); refreshSRS(); }} style={{ marginTop: 8, background: "#6C63FF", border: "none", padding: "6px 16px", borderRadius: 20, color: "#fff", cursor: "pointer" }}>
            📚 Ôn tập SRS ({srsCards.length})
          </button>
        </div>

        {renderSRSModal()}
      </div>
    );
  }

  // Typing mode
  if (mode === "typing") {
    return (
      <div style={{ maxWidth: 600, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <h2 style={{ fontSize: 24, fontWeight: 700, color: "#E4E1EE" }}>{title} — Typing</h2>
          <button onClick={() => setMode("learn")} style={{ background: "rgba(108,99,255,0.2)", border: "none", padding: "6px 16px", borderRadius: 20, color: "#c4c0ff", cursor: "pointer" }}>← Back</button>
        </div>

        <div style={{ height: 4, background: "rgba(255,255,255,0.1)", borderRadius: 2, marginBottom: 24 }}>
          <div style={{ width: `${(masteredCount / totalCards) * 100}%`, height: "100%", background: "#45f1c5", borderRadius: 2 }} />
        </div>

        <div style={{ background: "linear-gradient(135deg,#1a1a2e,#0d0d18)", borderRadius: 20, padding: 32, border: "1px solid rgba(108,99,255,0.3)", textAlign: "center", marginBottom: 24 }}>
          <div style={{ fontSize: 20, fontWeight: 600, color: "#E4E1EE", marginBottom: 16 }}>{currentCard.front}</div>
          <input
            type="text"
            value={typedAnswer}
            onChange={(e) => {
              setTypedAnswer(e.target.value);
              setTypingResult(null);
            }}
            placeholder="Type your answer..."
            style={{
              width: "100%",
              padding: "12px 16px",
              background: "#0d0d18",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 12,
              color: "#E4E1EE",
              fontSize: 16,
              outline: "none",
              textAlign: "center",
            }}
          />
          {typingResult && (
            <div style={{ marginTop: 12, fontSize: 16, fontWeight: 600, color: typingResult === "correct" ? "#45f1c5" : "#ffb4ab" }}>
              {typingResult === "correct" ? "✅ Correct!" : "❌ Incorrect. Correct: " + currentCard.back}
            </div>
          )}
          <button
            onClick={submitTypedAnswer}
            disabled={!typedAnswer.trim()}
            style={{
              marginTop: 16,
              background: "linear-gradient(135deg,#6C63FF,#9B59B6)",
              border: "none",
              padding: "8px 24px",
              borderRadius: 40,
              color: "#fff",
              fontWeight: 600,
              cursor: typedAnswer.trim() ? "pointer" : "not-allowed",
              opacity: typedAnswer.trim() ? 1 : 0.5,
            }}
          >
            Kiểm tra
          </button>
          <button
            onClick={() => {
              setTypedAnswer("");
              setTypingResult(null);
              nextCard();
            }}
            style={{
              marginTop: 12,
              background: "rgba(255,255,255,0.05)",
              border: "none",
              padding: "6px 16px",
              borderRadius: 20,
              color: "#C7C4D8",
              cursor: "pointer",
              display: "block",
              marginLeft: "auto",
              marginRight: "auto",
            }}
          >
            Next → <ChevronRight size={14} />
          </button>
        </div>
      </div>
    );
  }

  return null;
}
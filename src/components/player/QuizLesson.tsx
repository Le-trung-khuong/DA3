// src/components/player/QuizLesson.tsx
import React, { useState, useEffect } from "react";
import { CheckCircle, XCircle, Clock, ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
import {
  saveQuizAttempt,
  isLessonCompleted,
  getBestQuizScore,
  saveResumeData,
  getResumeData,
  completeLesson,
} from "../../services/progressService";
import { LessonCompleteButton } from "./LessonCompleteButton";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../utils/config";

interface QuizQuestion {
  id: string;
  text: string;
  options: string[];
  correctOptionIndex: number;
  explanation?: string;
}

interface QuizLessonProps {
  userId: string;
  courseId: string;
  moduleId: string;
  lessonId: string;
  title: string;
  questions: QuizQuestion[];
  passingScore: number;
  xpReward: number;
  onComplete?: () => void;
  isCompleted?: boolean;
  lessonType?: "lesson" | "quiz" | "reading" | "video" | "flashcard";
}

export function QuizLesson({
  userId,
  courseId,
  moduleId,
  lessonId,
  title,
  questions,
  passingScore,
  xpReward,
  onComplete,
  isCompleted: initialCompleted = false,
  lessonType = "quiz",
}: QuizLessonProps) {
  const [answers, setAnswers] = useState<{ [qid: string]: number }>({});
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState(0);
  const [passed, setPassed] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(60 * questions.length);
  const [timerActive, setTimerActive] = useState(true);
  const [isCompletedState, setIsCompletedState] = useState(initialCompleted);
  const [existingScore, setExistingScore] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showReview, setShowReview] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [isRetry, setIsRetry] = useState(false);
  const [xpEarned, setXpEarned] = useState(0);

  // ============ Kiểm tra trạng thái ban đầu và lấy xpEarned ============
  useEffect(() => {
    const checkCompletion = async () => {
      if (!userId) return;
      if (initialCompleted) {
        setIsCompletedState(true);
        const best = await getBestQuizScore(userId, courseId, moduleId, lessonId);
        if (best !== null) setExistingScore(best);
        // Lấy xpEarned
        const progressId = `${userId}_${courseId}_${moduleId}_${lessonId}`;
        const progSnap = await getDoc(doc(db, "progress", progressId));
        if (progSnap.exists()) {
          setXpEarned(progSnap.data().xpEarned || 0);
        }
        return;
      }
      const completed = await isLessonCompleted(userId, courseId, moduleId, lessonId);
      setIsCompletedState(completed);
      if (completed) {
        const best = await getBestQuizScore(userId, courseId, moduleId, lessonId);
        if (best !== null) setExistingScore(best);
        const progressId = `${userId}_${courseId}_${moduleId}_${lessonId}`;
        const progSnap = await getDoc(doc(db, "progress", progressId));
        if (progSnap.exists()) {
          setXpEarned(progSnap.data().xpEarned || 0);
        }
      }
    };
    checkCompletion();
  }, [userId, courseId, moduleId, lessonId, initialCompleted]);

  // ============ Load resume ============
  useEffect(() => {
    const loadResume = async () => {
      if (!userId || !courseId || !moduleId || !lessonId || isCompletedState || submitted) return;
      const data = await getResumeData(userId, courseId, moduleId, lessonId);
      if (data) {
        if (data.quizAnswers) setAnswers(data.quizAnswers);
        if (data.quizCurrentIndex !== undefined) setCurrentIndex(data.quizCurrentIndex);
        if (data.quizTimeLeft !== undefined) setTimeLeft(data.quizTimeLeft);
        if (data.quizRetry !== undefined) setIsRetry(data.quizRetry);
      }
    };
    loadResume();
  }, [userId, courseId, moduleId, lessonId, isCompletedState, submitted]);

  // ============ Auto-save resume ============
  useEffect(() => {
    if (!userId || !courseId || !moduleId || !lessonId || submitted || isCompletedState) return;
    const timeout = setTimeout(() => {
      saveResumeData(userId, courseId, moduleId, lessonId, {
        quizAnswers: answers,
        quizCurrentIndex: currentIndex,
        quizTimeLeft: timeLeft,
        quizRetry: isRetry,
      });
    }, 1000);
    return () => clearTimeout(timeout);
  }, [answers, currentIndex, timeLeft, submitted, isCompletedState, userId, courseId, moduleId, lessonId, isRetry]);

  // ============ Timer ============
  useEffect(() => {
    if (!submitted && timerActive && timeLeft > 0 && !isCompletedState) {
      const interval = setInterval(() => setTimeLeft((t) => t - 1), 1000);
      return () => clearInterval(interval);
    }
    if (timeLeft === 0 && !submitted && !isCompletedState) {
      handleSubmit();
    }
  }, [timeLeft, submitted, timerActive, isCompletedState]);

  const formatTime = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const s = sec % 60;
    return `${mins}:${s < 10 ? "0" : ""}${s}`;
  };

  const handleSelect = (qid: string, idx: number) => {
    if (submitted || isCompletedState) return;
    setAnswers((prev) => ({ ...prev, [qid]: idx }));
  };

  // ============ Reset để làm lại ============
  const handleRetry = async () => {
    setAnswers({});
    setSubmitted(false);
    setScore(0);
    setPassed(false);
    setCurrentIndex(0);
    setTimeLeft(60 * questions.length);
    setTimerActive(true);
    setShowReview(false);
    setSubmitting(false);
    setIsCompletedState(false);
    setIsRetry(true);

    await saveResumeData(userId, courseId, moduleId, lessonId, {
      quizRetry: true,
      quizAnswers: {},
      quizCurrentIndex: 0,
      quizTimeLeft: 60 * questions.length,
    });
  };

  // ============ Submit Quiz ============
  const handleSubmit = async () => {
    if (isCompletedState) {
      alert("Bạn đã hoàn thành quiz này rồi!");
      return;
    }
    if (submitting) return;
    if (Object.keys(answers).length !== questions.length) {
      alert(`Vui lòng trả lời tất cả ${questions.length} câu hỏi.`);
      return;
    }
    setSubmitting(true);
    setTimerActive(false);

    let correct = 0;
    questions.forEach((q) => {
      if (answers[q.id] === q.correctOptionIndex) correct++;
    });
    const calcScore = (correct / questions.length) * 100;
    const isPass = calcScore >= passingScore;
    setScore(calcScore);
    setPassed(isPass);
    setSubmitted(true);

    const attempt = {
      lessonId,
      startedAt: new Date(),
      completedAt: new Date(),
      score: calcScore,
      answers: Object.entries(answers).map(([qid, selected]) => ({
        questionId: qid,
        selectedOptionIndex: selected,
        isCorrect: questions.find((q) => q.id === qid)?.correctOptionIndex === selected,
      })),
    };

    try {
      // Lưu attempt (không set status="completed")
      await saveQuizAttempt(userId, courseId, moduleId, lessonId, attempt);
      await saveResumeData(userId, courseId, moduleId, lessonId, {});

      if (isPass && !isRetry) {
        setIsCompleting(true);
        try {
          await completeLesson(userId, courseId, moduleId, lessonId, xpReward, lessonType);
          setIsCompletedState(true);
          // Lấy xpEarned mới
          const progressId = `${userId}_${courseId}_${moduleId}_${lessonId}`;
          const progSnap = await getDoc(doc(db, "progress", progressId));
          if (progSnap.exists()) {
            setXpEarned(progSnap.data().xpEarned || 0);
          }
          if (onComplete) onComplete();
        } catch (err) {
          console.error("Failed to complete lesson after quiz:", err);
          alert("Có lỗi xảy ra khi cộng XP. Vui lòng liên hệ hỗ trợ.");
        } finally {
          setIsCompleting(false);
        }
      } else if (isPass && isRetry) {
        setIsCompletedState(true);
        // Lấy xpEarned (có thể vẫn là 0 nếu retry)
        const progressId = `${userId}_${courseId}_${moduleId}_${lessonId}`;
        const progSnap = await getDoc(doc(db, "progress", progressId));
        if (progSnap.exists()) {
          setXpEarned(progSnap.data().xpEarned || 0);
        }
      }
    } catch (err) {
      console.error("Failed to save quiz:", err);
      alert("Có lỗi xảy ra khi lưu kết quả. Vui lòng thử lại.");
    } finally {
      setSubmitting(false);
    }
  };

  // ============ Render ============

  if (isCompletedState && existingScore !== null) {
    return (
      <div style={{ maxWidth: 800, margin: "0 auto", textAlign: "center" }}>
        <div style={{ background: "rgba(69,241,197,0.1)", borderRadius: 24, padding: 32 }}>
          <CheckCircle size={64} color="#45f1c5" />
          <h2 style={{ fontSize: 28, fontWeight: 800, color: "#45f1c5", marginTop: 16 }}>
            {isRetry ? "✅ Bạn đã vượt qua lần làm lại!" : "Quiz Completed!"}
          </h2>
          <p style={{ fontSize: 18, color: "#E4E1EE" }}>Your best score: {Math.round(existingScore)}%</p>
          <p style={{ fontSize: 14, color: "#C7C4D8" }}>Passing score: {passingScore}%</p>
          {!isRetry && <p style={{ fontSize: 14, color: "#FFB785", marginTop: 8 }}>+{xpReward} XP earned!</p>}
          {isRetry && <p style={{ fontSize: 14, color: "#FFB785", marginTop: 8 }}>🔄 Làm lại thành công, không cộng XP.</p>}
          <div style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 16 }}>
            <button
              onClick={() => setShowReview(true)}
              style={{
                padding: "8px 20px",
                borderRadius: 12,
                background: "rgba(108,99,255,0.2)",
                border: "1px solid rgba(108,99,255,0.3)",
                color: "#c4c0ff",
                cursor: "pointer",
              }}
            >
              📝 Xem lại đáp án
            </button>
            <button
              onClick={handleRetry}
              style={{
                padding: "8px 20px",
                borderRadius: 12,
                background: "rgba(255,183,133,0.2)",
                border: "1px solid rgba(255,183,133,0.3)",
                color: "#FFB785",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <RefreshCw size={16} /> Làm lại
            </button>
          </div>
        </div>
        {showReview && (
          <QuizReviewModal
            questions={questions}
            answers={answers}
            score={score || existingScore}
            onClose={() => setShowReview(false)}
          />
        )}
      </div>
    );
  }

  if (submitted && passed && !isRetry) {
    return (
      <div style={{ maxWidth: 800, margin: "0 auto", textAlign: "center" }}>
        <div style={{ background: "rgba(69,241,197,0.1)", borderRadius: 24, padding: 32 }}>
          <CheckCircle size={64} color="#45f1c5" />
          <h2 style={{ fontSize: 28, fontWeight: 800, color: "#45f1c5", marginTop: 16 }}>Congratulations!</h2>
          <p style={{ fontSize: 18, color: "#E4E1EE" }}>You scored {Math.round(score)}%</p>
          <p style={{ fontSize: 14, color: "#C7C4D8" }}>Passing score: {passingScore}%</p>
          {isCompleting ? (
            <p style={{ fontSize: 14, color: "#FFB785", marginTop: 8 }}>Đang cộng XP...</p>
          ) : (
            <p style={{ fontSize: 14, color: "#45f1c5", marginTop: 8 }}>✅ +{xpReward} XP earned!</p>
          )}
          <button
            onClick={() => setShowReview(true)}
            style={{
              marginTop: 16,
              padding: "8px 20px",
              borderRadius: 12,
              background: "rgba(108,99,255,0.2)",
              border: "1px solid rgba(108,99,255,0.3)",
              color: "#c4c0ff",
              cursor: "pointer",
            }}
          >
            📝 Xem lại đáp án
          </button>
        </div>
        {showReview && (
          <QuizReviewModal
            questions={questions}
            answers={answers}
            score={score}
            onClose={() => setShowReview(false)}
          />
        )}
      </div>
    );
  }

  if (submitted && passed && isRetry) {
    return (
      <div style={{ maxWidth: 800, margin: "0 auto", textAlign: "center" }}>
        <div style={{ background: "rgba(69,241,197,0.1)", borderRadius: 24, padding: 32 }}>
          <CheckCircle size={64} color="#45f1c5" />
          <h2 style={{ fontSize: 28, fontWeight: 800, color: "#45f1c5", marginTop: 16 }}>✅ Bạn đã vượt qua!</h2>
          <p style={{ fontSize: 18, color: "#E4E1EE" }}>Your score: {Math.round(score)}%</p>
          <p style={{ fontSize: 14, color: "#C7C4D8" }}>Passing score: {passingScore}%</p>
          <p style={{ fontSize: 14, color: "#FFB785", marginTop: 8 }}>🔄 Làm lại thành công, không cộng XP.</p>
          <button
            onClick={() => setShowReview(true)}
            style={{
              marginTop: 16,
              padding: "8px 20px",
              borderRadius: 12,
              background: "rgba(108,99,255,0.2)",
              border: "1px solid rgba(108,99,255,0.3)",
              color: "#c4c0ff",
              cursor: "pointer",
            }}
          >
            📝 Xem lại đáp án
          </button>
        </div>
        {showReview && (
          <QuizReviewModal
            questions={questions}
            answers={answers}
            score={score}
            onClose={() => setShowReview(false)}
          />
        )}
      </div>
    );
  }

  if (submitted && !passed) {
    const correctCount = questions.filter((q) => answers[q.id] === q.correctOptionIndex).length;
    return (
      <div style={{ maxWidth: 800, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ background: "rgba(255,180,171,0.1)", borderRadius: 24, padding: 32 }}>
            <XCircle size={64} color="#ffb4ab" />
            <h2 style={{ fontSize: 28, fontWeight: 800, color: "#ffb4ab", marginTop: 16 }}>Not this time</h2>
            <p style={{ fontSize: 18, color: "#E4E1EE" }}>You scored {Math.round(score)}%</p>
            <p style={{ fontSize: 14, color: "#C7C4D8" }}>Need {passingScore}% to pass.</p>
          </div>
        </div>

        <div style={{ marginBottom: 32 }}>
          <h3 style={{ fontSize: 18, fontWeight: 700, color: "#E4E1EE", marginBottom: 16 }}>Review Answers</h3>
          {questions.map((q, idx) => {
            const selected = answers[q.id];
            const isCorrect = selected === q.correctOptionIndex;
            return (
              <div key={q.id} style={{ background: "rgba(26,26,46,0.6)", borderRadius: 16, padding: 20, marginBottom: 16 }}>
                <p style={{ fontWeight: 700, color: "#E4E1EE", marginBottom: 8 }}>Q{idx + 1}. {q.text}</p>
                <p style={{ fontSize: 13, color: isCorrect ? "#45f1c5" : "#ffb4ab" }}>Your answer: {selected !== undefined ? q.options[selected] : "Not answered"}</p>
                {!isCorrect && <p style={{ fontSize: 13, color: "#6C63FF" }}>Correct: {q.options[q.correctOptionIndex]}</p>}
                {q.explanation && <p style={{ fontSize: 12, color: "#C7C4D8", marginTop: 8 }}>💡 {q.explanation}</p>}
              </div>
            );
          })}
        </div>

        <div style={{ textAlign: "center" }}>
          <button
            onClick={() => {
              setAnswers({});
              setSubmitted(false);
              setCurrentIndex(0);
              setTimeLeft(60 * questions.length);
              setTimerActive(true);
              setSubmitting(false);
              setIsRetry(false);
              saveResumeData(userId, courseId, moduleId, lessonId, {});
            }}
            style={{
              background: "linear-gradient(135deg,#6C63FF,#9B59B6)",
              border: "none",
              padding: "10px 24px",
              borderRadius: 12,
              color: "#fff",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // ============ Đang làm quiz ============
  const currentQuestion = questions[currentIndex];
  const answeredCount = Object.keys(answers).length;

  return (
    <div style={{ maxWidth: 800, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <h2 style={{ fontSize: 24, fontWeight: 700, color: "#E4E1EE" }}>{title}</h2>
        <div style={{ display: "flex", alignItems: "center", gap: 16, background: "rgba(0,0,0,0.5)", padding: "6px 16px", borderRadius: 40 }}>
          <Clock size={16} color="#FFB785" />
          <span style={{ fontSize: 16, fontWeight: 700, color: timeLeft < 60 ? "#ffb4ab" : "#E4E1EE" }}>{formatTime(timeLeft)}</span>
          {isRetry && <span style={{ fontSize: 12, color: "#FFB785", marginLeft: 8 }}>🔄 Làm lại</span>}
        </div>
      </div>

      <div style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#C7C4D8" }}>
          <span>Question {currentIndex + 1} of {questions.length}</span>
          <span>{answeredCount}/{questions.length} answered</span>
        </div>
        <div style={{ height: 4, background: "rgba(255,255,255,0.1)", borderRadius: 2, marginTop: 4 }}>
          <div style={{ width: `${(answeredCount / questions.length) * 100}%`, height: "100%", background: "#6C63FF", borderRadius: 2 }} />
        </div>
      </div>

      <div style={{ background: "rgba(26,26,46,0.6)", borderRadius: 20, padding: 28, marginBottom: 24 }}>
        <p style={{ fontSize: 20, fontWeight: 600, color: "#E4E1EE", marginBottom: 24 }}>{currentQuestion.text}</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {currentQuestion.options.map((opt, idx) => (
            <label
              key={idx}
              onClick={() => handleSelect(currentQuestion.id, idx)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "12px 16px",
                background: answers[currentQuestion.id] === idx ? "rgba(108,99,255,0.2)" : "rgba(255,255,255,0.04)",
                border: answers[currentQuestion.id] === idx ? "1px solid rgba(108,99,255,0.5)" : "1px solid rgba(255,255,255,0.08)",
                borderRadius: 12,
                cursor: "pointer",
                transition: "0.1s",
              }}
            >
              <input type="radio" name={currentQuestion.id} checked={answers[currentQuestion.id] === idx} onChange={() => {}} style={{ accentColor: "#6C63FF" }} />
              <span style={{ fontSize: 15, color: "#C7C4D8" }}>{opt}</span>
            </label>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
        <button
          onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
          disabled={currentIndex === 0}
          style={{
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 12,
            padding: "10px 20px",
            color: "#C7C4D8",
            cursor: "pointer",
          }}
        >
          <ChevronLeft size={16} /> Previous
        </button>
        {currentIndex < questions.length - 1 ? (
          <button
            onClick={() => setCurrentIndex((i) => Math.min(questions.length - 1, i + 1))}
            style={{
              background: "rgba(108,99,255,0.2)",
              border: "1px solid rgba(108,99,255,0.3)",
              borderRadius: 12,
              padding: "10px 20px",
              color: "#c4c0ff",
              cursor: "pointer",
            }}
          >
            Next <ChevronRight size={16} />
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={submitting}
            style={{
              background: "linear-gradient(135deg,#6C63FF,#9B59B6)",
              border: "none",
              borderRadius: 12,
              padding: "10px 24px",
              color: "#fff",
              fontWeight: 700,
              cursor: submitting ? "wait" : "pointer",
            }}
          >
            {submitting ? "Submitting..." : "Submit Quiz"}
          </button>
        )}
      </div>

      <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 24, flexWrap: "wrap" }}>
        {questions.map((_, idx) => (
          <button
            key={idx}
            onClick={() => setCurrentIndex(idx)}
            style={{
              width: 32,
              height: 32,
              borderRadius: "50%",
              background: answers[questions[idx].id] !== undefined ? "#6C63FF" : "rgba(255,255,255,0.1)",
              border: currentIndex === idx ? "2px solid #c4c0ff" : "none",
              color: "#E4E1EE",
              fontSize: 12,
              cursor: "pointer",
            }}
          >
            {idx + 1}
          </button>
        ))}
      </div>

      {/* Luôn hiển thị LessonCompleteButton nếu đã hoàn thành (nhưng chưa cộng XP) */}
      {isCompletedState && (
        <div style={{ marginTop: 24, textAlign: "center" }}>
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
          />
        </div>
      )}
    </div>
  );
}

// ============ Quiz Review Modal ============
interface QuizReviewModalProps {
  questions: QuizQuestion[];
  answers: { [qid: string]: number };
  score: number;
  onClose: () => void;
}

function QuizReviewModal({ questions, answers, score, onClose }: QuizReviewModalProps) {
  const correctCount = questions.filter((q) => answers[q.id] === q.correctOptionIndex).length;
  const total = questions.length;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.8)",
        backdropFilter: "blur(8px)",
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        style={{
          maxWidth: 700,
          width: "100%",
          maxHeight: "90vh",
          overflowY: "auto",
          background: "#1A1A2E",
          borderRadius: 24,
          padding: 24,
          border: "1px solid rgba(108,99,255,0.2)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h2 style={{ fontSize: 24, fontWeight: 700, color: "#E4E1EE" }}>📝 Quiz Review</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#C7C4D8", cursor: "pointer", fontSize: 20 }}>
            ✕
          </button>
        </div>
        <div style={{ display: "flex", gap: 20, marginBottom: 24, padding: 16, background: "rgba(255,255,255,0.04)", borderRadius: 16, flexWrap: "wrap" }}>
          <div>
            <span style={{ color: "#C7C4D8" }}>Score:</span> <strong style={{ color: "#45f1c5" }}>{Math.round(score)}%</strong>
          </div>
          <div>
            <span style={{ color: "#C7C4D8" }}>Correct:</span> <strong style={{ color: "#45f1c5" }}>{correctCount}/{total}</strong>
          </div>
          <div>
            <span style={{ color: "#C7C4D8" }}>Incorrect:</span> <strong style={{ color: "#ffb4ab" }}>{total - correctCount}</strong>
          </div>
        </div>
        {questions.map((q, idx) => {
          const selected = answers[q.id];
          const isCorrect = selected === q.correctOptionIndex;
          return (
            <div
              key={q.id}
              style={{
                background: "rgba(26,26,46,0.6)",
                borderRadius: 16,
                padding: 16,
                marginBottom: 16,
                border: `1px solid ${isCorrect ? "rgba(69,241,197,0.2)" : "rgba(255,180,171,0.2)"}`,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                {isCorrect ? <CheckCircle size={16} color="#45f1c5" /> : <XCircle size={16} color="#ffb4ab" />}
                <span style={{ fontWeight: 600, color: "#E4E1EE" }}>Q{idx + 1}. {q.text}</span>
              </div>
              <div style={{ fontSize: 13, color: "#C7C4D8" }}>Your answer: {selected !== undefined ? q.options[selected] : "Not answered"}</div>
              {!isCorrect && (
                <div style={{ fontSize: 13, color: "#6C63FF", marginTop: 4 }}>✅ Correct: {q.options[q.correctOptionIndex]}</div>
              )}
              {q.explanation && (
                <div style={{ fontSize: 12, color: "#C7C4D8", marginTop: 8, padding: 8, background: "rgba(255,255,255,0.04)", borderRadius: 8 }}>
                  💡 {q.explanation}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
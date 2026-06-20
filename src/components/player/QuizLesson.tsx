// src/components/player/QuizLesson.tsx
import React, { useState, useEffect } from "react";
import { CheckCircle, XCircle, Clock, ChevronLeft, ChevronRight } from "lucide-react";
import { LessonCompleteButton } from "./LessonCompleteButton";
import { saveQuizAttempt, isLessonCompleted, getBestQuizScore, saveResumeData, getResumeData } from "../../services/progressService";

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
  lessonType?: 'lesson' | 'quiz' | 'reading' | 'video' | 'flashcard';
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
  lessonType = 'quiz',
}: QuizLessonProps) {
  const [answers, setAnswers] = useState<{ [qid: string]: number }>({});
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState(0);
  const [passed, setPassed] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(60 * questions.length);
  const [timerActive, setTimerActive] = useState(true);
  const [isCompleted, setIsCompleted] = useState(initialCompleted);
  const [existingScore, setExistingScore] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const checkCompletion = async () => {
      if (!userId) return;
      if (initialCompleted) {
        setIsCompleted(true);
        const best = await getBestQuizScore(userId, courseId, moduleId, lessonId);
        if (best !== null) setExistingScore(best);
        return;
      }
      const completed = await isLessonCompleted(userId, courseId, moduleId, lessonId);
      setIsCompleted(completed);
      if (completed) {
        const best = await getBestQuizScore(userId, courseId, moduleId, lessonId);
        if (best !== null) setExistingScore(best);
      }
    };
    checkCompletion();
  }, [userId, courseId, moduleId, lessonId, initialCompleted]);

  useEffect(() => {
    const loadResume = async () => {
      if (!userId || !courseId || !moduleId || !lessonId || isCompleted || submitted) return;
      const data = await getResumeData(userId, courseId, moduleId, lessonId);
      if (data) {
        if (data.quizAnswers) setAnswers(data.quizAnswers);
        if (data.quizCurrentIndex !== undefined) setCurrentIndex(data.quizCurrentIndex);
        if (data.quizTimeLeft !== undefined) setTimeLeft(data.quizTimeLeft);
      }
    };
    loadResume();
  }, [userId, courseId, moduleId, lessonId, isCompleted, submitted]);

  useEffect(() => {
    if (!userId || !courseId || !moduleId || !lessonId || submitted || isCompleted) return;
    const timeout = setTimeout(() => {
      saveResumeData(userId, courseId, moduleId, lessonId, {
        quizAnswers: answers,
        quizCurrentIndex: currentIndex,
        quizTimeLeft: timeLeft,
      });
    }, 1000);
    return () => clearTimeout(timeout);
  }, [answers, currentIndex, timeLeft, submitted, isCompleted, userId, courseId, moduleId, lessonId]);

  useEffect(() => {
    if (!submitted && timerActive && timeLeft > 0 && !isCompleted) {
      const interval = setInterval(() => setTimeLeft((t) => t - 1), 1000);
      return () => clearInterval(interval);
    }
    if (timeLeft === 0 && !submitted && !isCompleted) {
      handleSubmit();
    }
  }, [timeLeft, submitted, timerActive, isCompleted]);

  const formatTime = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const s = sec % 60;
    return `${mins}:${s < 10 ? "0" : ""}${s}`;
  };

  const handleSelect = (qid: string, idx: number) => {
    if (submitted || isCompleted) return;
    setAnswers((prev) => ({ ...prev, [qid]: idx }));
  };

  const handleSubmit = async () => {
    if (isCompleted) {
      alert("You have already completed this quiz!");
      return;
    }
    if (submitting) return;
    if (Object.keys(answers).length !== questions.length) {
      alert(`Please answer all ${questions.length} questions.`);
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
      await saveQuizAttempt(userId, courseId, moduleId, lessonId, attempt);
      await saveResumeData(userId, courseId, moduleId, lessonId, {});
    } catch (err) {
      console.error("Failed to save quiz attempt:", err);
      alert("Failed to save your quiz. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (isCompleted && existingScore !== null) {
    return (
      <div style={{ maxWidth: 800, margin: "0 auto", textAlign: "center" }}>
        <div style={{ background: "rgba(69,241,197,0.1)", borderRadius: 24, padding: 32 }}>
          <CheckCircle size={64} color="#45f1c5" />
          <h2 style={{ fontSize: 28, fontWeight: 800, color: "#45f1c5", marginTop: 16 }}>Quiz Completed!</h2>
          <p style={{ fontSize: 18, color: "#E4E1EE" }}>Your best score: {Math.round(existingScore)}%</p>
          <p style={{ fontSize: 14, color: "#C7C4D8" }}>Passing score: {passingScore}%</p>
        </div>
        <div style={{ marginTop: 24 }}>
          <LessonCompleteButton
            userId={userId}
            courseId={courseId}
            moduleId={moduleId}
            lessonId={lessonId}
            xpReward={xpReward}
            onComplete={onComplete}
            isCompleted={true}
            lessonType={lessonType}
          />
        </div>
      </div>
    );
  }

  if (submitted) {
    const correctCount = questions.filter((q) => answers[q.id] === q.correctOptionIndex).length;
    return (
      <div style={{ maxWidth: 800, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          {passed ? (
            <div style={{ background: "rgba(69,241,197,0.1)", borderRadius: 24, padding: 32 }}>
              <CheckCircle size={64} color="#45f1c5" />
              <h2 style={{ fontSize: 28, fontWeight: 800, color: "#45f1c5", marginTop: 16 }}>Congratulations!</h2>
              <p style={{ fontSize: 18, color: "#E4E1EE" }}>You scored {Math.round(score)}%</p>
              <p style={{ fontSize: 14, color: "#C7C4D8" }}>Passing score: {passingScore}%</p>
            </div>
          ) : (
            <div style={{ background: "rgba(255,180,171,0.1)", borderRadius: 24, padding: 32 }}>
              <XCircle size={64} color="#ffb4ab" />
              <h2 style={{ fontSize: 28, fontWeight: 800, color: "#ffb4ab", marginTop: 16 }}>Not this time</h2>
              <p style={{ fontSize: 18, color: "#E4E1EE" }}>You scored {Math.round(score)}%</p>
              <p style={{ fontSize: 14, color: "#C7C4D8" }}>Need {passingScore}% to pass.</p>
            </div>
          )}
        </div>

        <div style={{ marginBottom: 32 }}>
          <h3 style={{ fontSize: 18, fontWeight: 700, color: "#E4E1EE", marginBottom: 16 }}>Review Answers</h3>
          {questions.map((q, idx) => {
            const selected = answers[q.id];
            const isCorrect = selected === q.correctOptionIndex;
            return (
              <div key={q.id} style={{ background: "rgba(26,26,46,0.6)", borderRadius: 16, padding: 20, marginBottom: 16 }}>
                <p style={{ fontWeight: 700, color: "#E4E1EE", marginBottom: 8 }}>
                  Q{idx + 1}. {q.text}
                </p>
                <p style={{ fontSize: 13, color: isCorrect ? "#45f1c5" : "#ffb4ab" }}>
                  Your answer: {selected !== undefined ? q.options[selected] : "Not answered"}
                </p>
                {!isCorrect && (
                  <p style={{ fontSize: 13, color: "#6C63FF" }}>Correct: {q.options[q.correctOptionIndex]}</p>
                )}
                {q.explanation && (
                  <p style={{ fontSize: 12, color: "#C7C4D8", marginTop: 8 }}>💡 {q.explanation}</p>
                )}
              </div>
            );
          })}
        </div>

        {passed && (
          <div style={{ textAlign: "center" }}>
            <LessonCompleteButton
              userId={userId}
              courseId={courseId}
              moduleId={moduleId}
              lessonId={lessonId}
              xpReward={xpReward}
              onComplete={onComplete}
              isCompleted={false}
              lessonType={lessonType}
            />
          </div>
        )}
        {!passed && (
          <div style={{ textAlign: "center" }}>
            <button
              onClick={() => {
                setAnswers({});
                setSubmitted(false);
                setCurrentIndex(0);
                setTimeLeft(60 * questions.length);
                setTimerActive(true);
                setSubmitting(false);
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
        )}
      </div>
    );
  }

  const currentQuestion = questions[currentIndex];
  const answeredCount = Object.keys(answers).length;

  return (
    <div style={{ maxWidth: 800, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <h2 style={{ fontSize: 24, fontWeight: 700, color: "#E4E1EE" }}>{title}</h2>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            background: "rgba(0,0,0,0.5)",
            padding: "6px 16px",
            borderRadius: 40,
          }}
        >
          <Clock size={16} color="#FFB785" />
          <span style={{ fontSize: 16, fontWeight: 700, color: timeLeft < 60 ? "#ffb4ab" : "#E4E1EE" }}>
            {formatTime(timeLeft)}
          </span>
        </div>
      </div>

      <div style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#C7C4D8" }}>
          <span>Question {currentIndex + 1} of {questions.length}</span>
          <span>{answeredCount}/{questions.length} answered</span>
        </div>
        <div style={{ height: 4, background: "rgba(255,255,255,0.1)", borderRadius: 2, marginTop: 4 }}>
          <div
            style={{
              width: `${(answeredCount / questions.length) * 100}%`,
              height: "100%",
              background: "#6C63FF",
              borderRadius: 2,
            }}
          />
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
              <input
                type="radio"
                name={currentQuestion.id}
                checked={answers[currentQuestion.id] === idx}
                onChange={() => {}}
                style={{ accentColor: "#6C63FF" }}
              />
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
    </div>
  );
}
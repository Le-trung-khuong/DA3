/**
 * src/components/player/QuizLesson.tsx
 * Quiz lesson (multiple choice)
 */

import React, { useState } from "react";
import { CheckCircle, XCircle } from "lucide-react";
import { LessonCompleteButton } from "./LessonCompleteButton";
import { saveQuizAttempt } from "../../services/progressService";

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
}: QuizLessonProps) {
  const [answers, setAnswers] = useState<{ [questionId: string]: number }>({});
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState(0);
  const [passed, setPassed] = useState(false);

  const handleSelect = (questionId: string, optionIndex: number) => {
    if (submitted) return;
    setAnswers((prev) => ({ ...prev, [questionId]: optionIndex }));
  };

  const handleSubmit = async () => {
    if (Object.keys(answers).length !== questions.length) {
      alert("Please answer all questions before submitting.");
      return;
    }

    let correctCount = 0;
    questions.forEach((q) => {
      if (answers[q.id] === q.correctOptionIndex) correctCount++;
    });
    const calculatedScore = (correctCount / questions.length) * 100;
    const isPassed = calculatedScore >= passingScore;

    setScore(calculatedScore);
    setPassed(isPassed);
    setSubmitted(true);

    // Save quiz attempt
    const attempt = {
      lessonId,
      startedAt: new Date(),
      completedAt: new Date(),
      score: calculatedScore,
      answers: Object.entries(answers).map(([questionId, selectedOptionIndex]) => ({
        questionId,
        selectedOptionIndex,
        isCorrect: questions.find(q => q.id === questionId)?.correctOptionIndex === selectedOptionIndex,
      })),
    };
    await saveQuizAttempt(userId, courseId, moduleId, lessonId, attempt);
  };

  if (submitted) {
    return (
      <div style={{ maxWidth: 700, margin: "0 auto" }}>
        <div
          style={{
            background: passed ? "rgba(69,241,197,0.1)" : "rgba(255,180,171,0.1)",
            border: `1px solid ${passed ? "rgba(69,241,197,0.3)" : "rgba(255,180,171,0.3)"}`,
            borderRadius: 16,
            padding: 24,
            textAlign: "center",
            marginBottom: 24,
          }}
        >
          {passed ? (
            <CheckCircle size={48} color="#45f1c5" style={{ marginBottom: 16 }} />
          ) : (
            <XCircle size={48} color="#ffb4ab" style={{ marginBottom: 16 }} />
          )}
          <h3 style={{ fontSize: 20, fontWeight: 700, color: "#E4E1EE", marginBottom: 8 }}>
            {passed ? "Congratulations!" : "Not this time"}
          </h3>
          <p style={{ fontSize: 16, color: "#C7C4D8", marginBottom: 8 }}>
            Your score: {score.toFixed(0)}% (Passing: {passingScore}%)
          </p>
          {passed ? (
            <p style={{ fontSize: 14, color: "#45f1c5" }}>You've earned {xpReward} XP!</p>
          ) : (
            <p style={{ fontSize: 14, color: "#ffb4ab" }}>Review the material and try again.</p>
          )}
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
            />
          </div>
        )}

        {!passed && (
          <div style={{ textAlign: "center" }}>
            <button
              onClick={() => {
                setAnswers({});
                setSubmitted(false);
                setScore(0);
                setPassed(false);
              }}
              style={{
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.08)",
                padding: "10px 24px",
                borderRadius: 12,
                fontSize: 14,
                fontWeight: 600,
                color: "#C7C4D8",
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

  return (
    <div style={{ maxWidth: 700, margin: "0 auto" }}>
      <h2 style={{ fontSize: 24, fontWeight: 700, color: "#E4E1EE", marginBottom: 8 }}>{title}</h2>
      <p style={{ fontSize: 14, color: "#C7C4D8", marginBottom: 24 }}>
        Passing score: {passingScore}% • {questions.length} questions
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        {questions.map((q, idx) => (
          <div
            key={q.id}
            style={{
              background: "rgba(26,26,46,0.6)",
              borderRadius: 16,
              border: "1px solid rgba(255,255,255,0.06)",
              padding: 20,
            }}
          >
            <p style={{ fontSize: 16, fontWeight: 600, color: "#E4E1EE", marginBottom: 16 }}>
              {idx + 1}. {q.text}
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {q.options.map((opt, optIdx) => (
                <label
                  key={optIdx}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "10px 16px",
                    background: answers[q.id] === optIdx ? "rgba(108,99,255,0.15)" : "rgba(255,255,255,0.03)",
                    border: answers[q.id] === optIdx ? "1px solid rgba(108,99,255,0.4)" : "1px solid rgba(255,255,255,0.06)",
                    borderRadius: 12,
                    cursor: "pointer",
                    transition: "all 0.15s",
                  }}
                  onClick={() => handleSelect(q.id, optIdx)}
                >
                  <input
                    type="radio"
                    name={q.id}
                    checked={answers[q.id] === optIdx}
                    onChange={() => handleSelect(q.id, optIdx)}
                    style={{ accentColor: "#6C63FF" }}
                  />
                  <span style={{ fontSize: 14, color: "#C7C4D8" }}>{opt}</span>
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 32, textAlign: "center" }}>
        <button
          onClick={handleSubmit}
          style={{
            background: "linear-gradient(135deg,#6C63FF,#9B59B6)",
            border: "none",
            padding: "12px 32px",
            borderRadius: 12,
            fontSize: 16,
            fontWeight: 700,
            color: "#fff",
            cursor: "pointer",
          }}
        >
          Submit Quiz
        </button>
      </div>
    </div>
  );
}
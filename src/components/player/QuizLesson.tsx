// src/components/player/QuizLesson.tsx
import React, { useState, useEffect } from "react";
import { CheckCircle, XCircle, Clock, ChevronLeft, ChevronRight, Award } from "lucide-react";
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
  isCompleted?: boolean;
}

export function QuizLesson({
  userId, courseId, moduleId, lessonId, title, questions, passingScore, xpReward, onComplete, isCompleted = false
}: QuizLessonProps) {
  const [answers, setAnswers] = useState<{ [qid: string]: number }>({});
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState(0);
  const [passed, setPassed] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(60 * questions.length); // 1 min per question
  const [timerActive, setTimerActive] = useState(true);

  // Timer effect
  useEffect(() => {
    if (!submitted && timerActive && timeLeft > 0) {
      const interval = setInterval(() => setTimeLeft(t => t - 1), 1000);
      return () => clearInterval(interval);
    }
    if (timeLeft === 0 && !submitted) handleSubmit();
  }, [timeLeft, submitted, timerActive]);

  const formatTime = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const s = sec % 60;
    return `${mins}:${s < 10 ? "0" : ""}${s}`;
  };

  const handleSelect = (qid: string, idx: number) => {
    if (submitted) return;
    setAnswers(prev => ({ ...prev, [qid]: idx }));
  };

  const handleSubmit = async () => {
    if (Object.keys(answers).length !== questions.length) {
      alert(`Please answer all ${questions.length} questions.`);
      return;
    }
    setTimerActive(false);
    let correct = 0;
    questions.forEach(q => {
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
        isCorrect: questions.find(q => q.id === qid)?.correctOptionIndex === selected,
      })),
    };
    await saveQuizAttempt(userId, courseId, moduleId, lessonId, attempt);
  };

  const currentQuestion = questions[currentIndex];
  const answeredCount = Object.keys(answers).length;

  if (submitted) {
    const correctCount = questions.filter(q => answers[q.id] === q.correctOptionIndex).length;
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

        {/* Review answers */}
        <div style={{ marginBottom: 32 }}>
          <h3 style={{ fontSize: 18, fontWeight: 700, color: "#E4E1EE", marginBottom: 16 }}>Review Answers</h3>
          {questions.map((q, idx) => {
            const selected = answers[q.id];
            const isCorrect = selected === q.correctOptionIndex;
            return (
              <div key={q.id} style={{ background: "rgba(26,26,46,0.6)", borderRadius: 16, padding: 20, marginBottom: 16 }}>
                <p style={{ fontWeight: 700, color: "#E4E1EE", marginBottom: 8 }}>Q{idx+1}. {q.text}</p>
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
              userId={userId} courseId={courseId} moduleId={moduleId} lessonId={lessonId}
              xpReward={xpReward} onComplete={onComplete} isCompleted={isCompleted}
            />
          </div>
        )}
        {!passed && (
          <div style={{ textAlign: "center" }}>
            <button onClick={() => { setAnswers({}); setSubmitted(false); setCurrentIndex(0); setTimeLeft(60*questions.length); setTimerActive(true); }}
              style={{ background: "linear-gradient(135deg,#6C63FF,#9B59B6)", border: "none", padding: "10px 24px", borderRadius: 12, color: "#fff", fontWeight: 700, cursor: "pointer" }}>
              Try Again
            </button>
          </div>
        )}
      </div>
    );
  }

  // Active quiz view
  return (
    <div style={{ maxWidth: 800, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <h2 style={{ fontSize: 24, fontWeight: 700, color: "#E4E1EE" }}>{title}</h2>
        <div style={{ display: "flex", alignItems: "center", gap: 16, background: "rgba(0,0,0,0.5)", padding: "6px 16px", borderRadius: 40 }}>
          <Clock size={16} color="#FFB785" />
          <span style={{ fontSize: 16, fontWeight: 700, color: timeLeft < 60 ? "#ffb4ab" : "#E4E1EE" }}>{formatTime(timeLeft)}</span>
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#C7C4D8" }}>
          <span>Question {currentIndex+1} of {questions.length}</span>
          <span>{answeredCount}/{questions.length} answered</span>
        </div>
        <div style={{ height: 4, background: "rgba(255,255,255,0.1)", borderRadius: 2, marginTop: 4 }}>
          <div style={{ width: `${(answeredCount/questions.length)*100}%`, height: "100%", background: "#6C63FF", borderRadius: 2 }} />
        </div>
      </div>

      {/* Question */}
      <div style={{ background: "rgba(26,26,46,0.6)", borderRadius: 20, padding: 28, marginBottom: 24 }}>
        <p style={{ fontSize: 20, fontWeight: 600, color: "#E4E1EE", marginBottom: 24 }}>{currentQuestion.text}</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {currentQuestion.options.map((opt, idx) => (
            <label key={idx} onClick={() => handleSelect(currentQuestion.id, idx)}
              style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", background: answers[currentQuestion.id] === idx ? "rgba(108,99,255,0.2)" : "rgba(255,255,255,0.04)", border: answers[currentQuestion.id] === idx ? "1px solid rgba(108,99,255,0.5)" : "1px solid rgba(255,255,255,0.08)", borderRadius: 12, cursor: "pointer", transition: "0.1s" }}>
              <input type="radio" name={currentQuestion.id} checked={answers[currentQuestion.id] === idx} onChange={() => {}} style={{ accentColor: "#6C63FF" }} />
              <span style={{ fontSize: 15, color: "#C7C4D8" }}>{opt}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Navigation buttons */}
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
        <button onClick={() => setCurrentIndex(i => Math.max(0, i-1))} disabled={currentIndex === 0}
          style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: "10px 20px", color: "#C7C4D8", cursor: "pointer" }}>
          <ChevronLeft size={16} /> Previous
        </button>
        {currentIndex < questions.length - 1 ? (
          <button onClick={() => setCurrentIndex(i => Math.min(questions.length-1, i+1))}
            style={{ background: "rgba(108,99,255,0.2)", border: "1px solid rgba(108,99,255,0.3)", borderRadius: 12, padding: "10px 20px", color: "#c4c0ff", cursor: "pointer" }}>
            Next <ChevronRight size={16} />
          </button>
        ) : (
          <button onClick={handleSubmit}
            style={{ background: "linear-gradient(135deg,#6C63FF,#9B59B6)", border: "none", borderRadius: 12, padding: "10px 24px", color: "#fff", fontWeight: 700, cursor: "pointer" }}>
            Submit Quiz
          </button>
        )}
      </div>

      {/* Question navigator dots */}
      <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 24, flexWrap: "wrap" }}>
        {questions.map((_, idx) => (
          <button key={idx} onClick={() => setCurrentIndex(idx)}
            style={{ width: 32, height: 32, borderRadius: "50%", background: answers[questions[idx].id] !== undefined ? "#6C63FF" : "rgba(255,255,255,0.1)", border: currentIndex === idx ? "2px solid #c4c0ff" : "none", color: "#E4E1EE", fontSize: 12, cursor: "pointer" }}>
            {idx+1}
          </button>
        ))}
      </div>
    </div>
  );
}
/**
 * src/pages/client/CourseDetail.tsx
 * Chi tiết khóa học (modules & lessons) + progress tracking
 */

"use client";

import React, { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useDocument } from "../../hooks/useFirestore";
import { useProgress } from "../../hooks/useProgress";
import { useAuth } from "../../contexts/AuthContext";
import { Clock, BookOpen, Star, Users, CheckCircle, Lock, Play, Zap, FileText, Layers, ChevronRight } from "lucide-react";

interface Lesson {
  id: string;
  title: string;
  type: string;
  duration: number;
  isFree: boolean;
  xpReward: number;
  order: number;
}

interface Module {
  id: string;
  title: string;
  order: number;
  lessons: Lesson[];
}

interface Course {
  id: string;
  title: string;
  description: string;
  thumbnailUrl: string;
  category: string;
  level: string;
  price: number;
  rating: number;
  ratingCount: number;
  totalStudents: number;
  totalDurationHours: number;
  modules: Module[];
}

export default function CourseDetail() {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [isEnrolled, setIsEnrolled] = useState(false);

  const { data: course, loading: courseLoading, error: courseError } = useDocument<Course>("courses", courseId);
  const { progress, isLessonCompleted, getQuizScore } = useProgress(currentUser?.uid, courseId);

  // Đơn giản: kiểm tra xem user đã enroll chưa (giả sử có collection enrollments, tạm thời cho phép tất cả)
  // Ở giai đoạn này, tôi sẽ coi như user đã enroll để xem được nội dung.
  // Sau này sẽ implement enroll logic.
  useEffect(() => {
    if (currentUser && courseId) {
      // TODO: check enrollment in Firestore
      setIsEnrolled(true);
    } else {
      setIsEnrolled(false);
    }
  }, [currentUser, courseId]);

  const handleStartLesson = (moduleId: string, lesson: Lesson) => {
    // Nếu lesson không free và chưa enroll thì không cho học
    if (!lesson.isFree && !isEnrolled) {
      alert("Please enroll to access this lesson");
      return;
    }
    navigate(`/learn/${courseId}/${moduleId}/${lesson.id}`);
  };

  if (courseLoading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "60vh" }}>
        <div style={{ width: 48, height: 48, borderRadius: "50%", border: "2px solid rgba(108,99,255,0.2)", borderTopColor: "#6C63FF", animation: "spin 0.8s linear infinite" }} />
      </div>
    );
  }

  if (courseError || !course) {
    return (
      <div style={{ textAlign: "center", padding: 60, color: "#C7C4D8" }}>
        <p>Course not found.</p>
      </div>
    );
  }

  const totalLessons = course.modules.reduce((acc, m) => acc + m.lessons.length, 0);
  const completedLessons = progress.filter(p => p.status === "completed").length;

  return (
    <div style={{ maxWidth: 1280, margin: "0 auto", padding: "32px 24px" }}>
      {/* Hero Section */}
      <div style={{
        background: "linear-gradient(135deg, rgba(108,99,255,0.15), rgba(155,89,182,0.1))",
        borderRadius: 24,
        padding: 32,
        marginBottom: 32,
        border: "1px solid rgba(108,99,255,0.2)",
      }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 32, alignItems: "center" }}>
          <div style={{ flex: 2 }}>
            <h1 style={{ fontSize: 36, fontWeight: 800, color: "#E4E1EE", marginBottom: 16 }}>{course.title}</h1>
            <p style={{ fontSize: 16, color: "#C7C4D8", lineHeight: 1.6, marginBottom: 24 }}>{course.description}</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 24, marginBottom: 24 }}>
              <span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, color: "#C7C4D8" }}>
                <Star size={16} color="#FFB785" fill="#FFB785" /> {course.rating.toFixed(1)} ({course.ratingCount} reviews)
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, color: "#C7C4D8" }}>
                <Users size={16} /> {course.totalStudents.toLocaleString()} students
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, color: "#C7C4D8" }}>
                <Clock size={16} /> {course.totalDurationHours} hours
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, color: "#C7C4D8" }}>
                <Layers size={16} /> {totalLessons} lessons
              </span>
            </div>
            <div style={{ display: "flex", gap: 16 }}>
              {!isEnrolled ? (
                <button
                  style={{
                    background: "linear-gradient(135deg,#6C63FF,#9B59B6)",
                    border: "none",
                    padding: "12px 24px",
                    borderRadius: 12,
                    fontSize: 16,
                    fontWeight: 700,
                    color: "#fff",
                    cursor: "pointer",
                  }}
                  onClick={() => alert("Enrollment feature coming soon")}
                >
                  Enroll Now • {course.price === 0 ? "Free" : `$${course.price}`}
                </button>
              ) : (
                <div style={{ background: "rgba(69,241,197,0.1)", border: "1px solid rgba(69,241,197,0.3)", borderRadius: 12, padding: "8px 16px" }}>
                  <span style={{ color: "#45f1c5", fontWeight: 700 }}>✓ Enrolled</span>
                </div>
              )}
              {completedLessons > 0 && (
                <div style={{ background: "rgba(255,255,255,0.05)", borderRadius: 12, padding: "8px 16px" }}>
                  <span style={{ color: "#C7C4D8", fontWeight: 600 }}>Progress: {completedLessons}/{totalLessons} lessons</span>
                </div>
              )}
            </div>
          </div>
          <div style={{ flex: 1 }}>
            {course.thumbnailUrl ? (
              <img src={course.thumbnailUrl} alt={course.title} style={{ width: "100%", borderRadius: 16, boxShadow: "0 10px 30px rgba(0,0,0,0.3)" }} />
            ) : (
              <div style={{ background: "rgba(108,99,255,0.1)", borderRadius: 16, padding: "40px", textAlign: "center" }}>
                <BookOpen size={48} color="#6C63FF" />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Curriculum Section */}
      <div>
        <h2 style={{ fontSize: 24, fontWeight: 700, color: "#E4E1EE", marginBottom: 24 }}>Course Curriculum</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {course.modules.map((module, idx) => {
            const moduleCompletedLessons = module.lessons.filter(lesson => isLessonCompleted(module.id, lesson.id)).length;
            const moduleProgress = module.lessons.length ? (moduleCompletedLessons / module.lessons.length) * 100 : 0;
            return (
              <div
                key={module.id}
                style={{
                  background: "rgba(26,26,46,0.6)",
                  borderRadius: 16,
                  border: "1px solid rgba(255,255,255,0.06)",
                  overflow: "hidden",
                }}
              >
                <div style={{ padding: "16px 20px", background: "rgba(255,255,255,0.02)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <h3 style={{ fontSize: 18, fontWeight: 700, color: "#E4E1EE" }}>
                      Module {idx + 1}: {module.title}
                    </h3>
                    <span style={{ fontSize: 12, color: "#C7C4D8" }}>{module.lessons.length} lessons</span>
                  </div>
                  <div style={{ height: 4, background: "rgba(255,255,255,0.1)", borderRadius: 4, overflow: "hidden" }}>
                    <div style={{ width: `${moduleProgress}%`, height: "100%", background: "linear-gradient(90deg,#6C63FF,#45f1c5)", transition: "width 0.3s" }} />
                  </div>
                </div>
                <div>
                  {module.lessons.map((lesson, lIdx) => {
                    const completed = isLessonCompleted(module.id, lesson.id);
                    const quizScore = getQuizScore(module.id, lesson.id);
                    return (
                      <div
                        key={lesson.id}
                        onClick={() => handleStartLesson(module.id, lesson)}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "14px 20px",
                          borderBottom: "1px solid rgba(255,255,255,0.04)",
                          cursor: "pointer",
                          transition: "background 0.15s",
                          background: completed ? "rgba(69,241,197,0.05)" : "transparent",
                        }}
                        onMouseOver={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.04)")}
                        onMouseOut={(e) => (e.currentTarget.style.background = completed ? "rgba(69,241,197,0.05)" : "transparent")}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                          <span style={{ width: 28, textAlign: "center", fontSize: 14, fontWeight: 600, color: "#C7C4D8" }}>{lIdx + 1}</span>
                          {lesson.type === "video" && <Play size={16} color="#6C63FF" />}
                          {lesson.type === "quiz" && <Zap size={16} color="#45f1c5" />}
                          {lesson.type === "reading" && <FileText size={16} color="#FFB785" />}
                          {lesson.type === "flashcard" && <Layers size={16} color="#c4c0ff" />}
                          <span style={{ fontSize: 15, fontWeight: 600, color: "#E4E1EE" }}>{lesson.title}</span>
                          {!lesson.isFree && !isEnrolled && <Lock size={14} color="#47464f" />}
                          {completed && <CheckCircle size={14} color="#45f1c5" />}
                          {quizScore !== undefined && <span style={{ fontSize: 11, color: "#45f1c5", marginLeft: 8 }}>Score: {quizScore}%</span>}
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                          <span style={{ fontSize: 12, color: "#C7C4D8" }}>{lesson.duration} min</span>
                          <ChevronRight size={16} color="#C7C4D8" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
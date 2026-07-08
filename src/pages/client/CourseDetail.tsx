// src/pages/client/CourseDetail.tsx
/**
 * Chi tiết khóa học — UI nâng cấp, hero gradient, curriculum progress, review distribution
 * ✅ Hỗ trợ Drip Content (releaseAt)
 * ✅ Hỗ trợ Prerequisites
 * ✅ Hiển thị Course Progress
 * ✅ Continue Learning button
 */
"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { where } from "firebase/firestore";
import { useDocument } from "../../hooks/useFirestore";
import { useProgress } from "../../hooks/useProgress";
import { useCourseProgress } from "../../hooks/useCourseProgress";
import { useAuth } from "../../contexts/AuthContext";
import { useCollection } from "../../hooks/useFirestore";
import { useUserEnrollment } from "../../hooks/useUserEnrollment";
import {
  createReview,
  hasUserReviewed,
  updateReview,
  deleteReviewWithRecalc,
} from "../../services/reviewService";
import { ReviewForm } from "../../components/client/ReviewForm";
import { ReviewList } from "../../components/client/ReviewList";
import { createEnrollment } from "../../services/enrollmentService";
import { createPayOSOrder } from "../../services/payosService";
import PaymentModal from "./PaymentModal";
import type { Review } from "../../types/review";
import { useAIRecommendation } from "../../hooks/useAIRecommendation";
import {
  Clock,
  BookOpen,
  Star,
  Users,
  CheckCircle,
  Lock,
  Play,
  Zap,
  FileText,
  Layers,
  ChevronRight,
  X,
  MessageSquare,
  Link as LinkIcon,
  Sparkles,
  AlertCircle,
  ArrowRight,
} from "lucide-react";
import { useCourseCommunity } from "../../hooks/useCourseCommunity";

interface Lesson {
  id: string;
  title: string;
  type: string;
  duration: number;
  isFree: boolean;
  xpReward: number;
  order: number;
  releaseAt?: string | Date;
  prerequisites?: string[];
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

const toMillis = (value: any): number => {
  if (!value) return 0;
  if (value instanceof Date) return value.getTime();
  if (typeof value === "object" && typeof value.toDate === "function") {
    return value.toDate().getTime();
  }
  return 0;
};

export default function CourseDetail() {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const { currentUser } = useAuth();

  const { isEnrolled, loading: enrollmentLoading } = useUserEnrollment(
    currentUser?.uid,
    courseId
  );

  const { roomId: communityRoomId, hasAccess, loading: communityLoading } = useCourseCommunity(courseId);

  const [showReviewForm, setShowReviewForm] = useState(false);
  const [userReviewed, setUserReviewed] = useState(false);
  const [reviewCheckLoading, setReviewCheckLoading] = useState(true);
  const [editingReview, setEditingReview] = useState<Review | null>(null);
  const [editRating, setEditRating] = useState(0);
  const [editContent, setEditContent] = useState("");

  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [paymentTransactionId, setPaymentTransactionId] = useState<string | null>(null);
  const [paymentCheckoutUrl, setPaymentCheckoutUrl] = useState("");
  const [paymentQrCode, setPaymentQrCode] = useState("");

  const { data: course, loading: courseLoading, error: courseError } = useDocument<Course>(
    "courses",
    courseId
  );
  const { progress, isLessonCompleted, getQuizScore } = useProgress(currentUser?.uid, courseId);

  // 🆕 Course Progress
  const { percentage, completedLessons: courseCompleted, totalLessons: courseTotal, loading: progressLoading } = useCourseProgress(currentUser?.uid, courseId);

  const { lessonId: recommendedLessonId, moduleId: recommendedModuleId, reason, loading: recommendationLoading } = useAIRecommendation(
    currentUser?.uid,
    courseId
  );

  const {
    data: reviewData,
    loading: reviewsLoading,
    error: reviewsError,
  } = useCollection<Review>(
    "reviews",
    [where("courseId", "==", courseId || "")],
    [courseId]
  );

  const reviews = useMemo(() => {
    const list = (reviewData || []) as Review[];
    return [...list].sort((a, b) => {
      const aTime = toMillis(a.createdAt);
      const bTime = toMillis(b.createdAt);
      return bTime - aTime;
    });
  }, [reviewData]);

  useEffect(() => {
    if (reviewsError) {
      console.error("Lỗi khi lấy reviews:", reviewsError);
      if (reviewsError.message.includes("index")) {
        console.warn("Cần tạo composite index cho reviews. Click link trong console để tạo.");
      }
    }
  }, [reviewsError]);

  useEffect(() => {
    async function checkReviewed() {
      if (currentUser && courseId) {
        const reviewed = await hasUserReviewed(currentUser.uid, courseId);
        setUserReviewed(reviewed);
      }
      setReviewCheckLoading(false);
    }
    checkReviewed();
  }, [currentUser, courseId]);

  // ===== Continue Learning =====
  const findNextIncompleteLesson = useCallback(() => {
    if (!course || !progress) return null;
    const sortedModules = [...course.modules].sort((a, b) => a.order - b.order);
    for (const m of sortedModules) {
      const sortedLessons = [...m.lessons].sort((a, b) => a.order - b.order);
      for (const l of sortedLessons) {
        const completed = progress.some(
          (p) => p.moduleId === m.id && p.lessonId === l.id && p.status === "completed"
        );
        if (!completed) return { moduleId: m.id, lessonId: l.id };
      }
    }
    return null;
  }, [course, progress]);

  const nextLesson = findNextIncompleteLesson();

  const handleStartLesson = (moduleId: string, lesson: Lesson) => {
    if (!lesson.isFree && !isEnrolled) {
      alert("You need to purchase this course to access this lesson.");
      return;
    }
    if (lesson.releaseAt) {
      const releaseDate = new Date(lesson.releaseAt);
      if (releaseDate > new Date()) {
        alert(`This lesson will be available on ${releaseDate.toLocaleDateString()}`);
        return;
      }
    }
    if (lesson.prerequisites && lesson.prerequisites.length > 0) {
      const missing = lesson.prerequisites.filter(id =>
        !progress.some(p => p.lessonId === id && p.status === "completed")
      );
      if (missing.length > 0) {
        alert("You must complete prerequisite lessons before starting this one.");
        return;
      }
    }
    navigate(`/learn/${courseId}/${moduleId}/${lesson.id}`);
  };

  const handleFreeEnroll = async () => {
    if (!currentUser) {
      alert("Please login to enroll.");
      return;
    }
    try {
      await createEnrollment(currentUser.uid, course!.id, "free_course", course!.title);
      alert("Successfully enrolled! Redirecting to learning...");
      const firstModule = course!.modules[0];
      const firstLesson = firstModule?.lessons[0];
      if (firstModule && firstLesson) {
        navigate(`/learn/${course!.id}/${firstModule.id}/${firstLesson.id}`);
      } else {
        navigate(`/courses/${course!.id}`);
      }
    } catch (err) {
      console.error("Free enrollment error:", err);
      alert("Enrollment failed. Please try again.");
    }
  };

  const handlePaidEnroll = async () => {
    if (!currentUser) {
      alert("Please login to purchase.");
      return;
    }
    try {
      const order = await createPayOSOrder(currentUser.uid, course!.id);
      setPaymentTransactionId(order.transactionId);
      setPaymentCheckoutUrl(order.checkoutUrl);
      setPaymentQrCode(order.qrCode);
      setPaymentModalOpen(true);
    } catch (err: any) {
      console.error("Payment order error:", err);
      alert(err.message || "Cannot create payment order. Please try again.");
    }
  };

  const handlePaymentSuccess = () => {
    setPaymentModalOpen(false);
    window.location.reload();
  };

  const handleSubmitReview = async (rating: number, content: string) => {
    if (!currentUser) throw new Error("Vui lòng đăng nhập");
    const result = await createReview(
      currentUser.uid,
      currentUser.displayName || currentUser.email?.split("@")[0] || "User",
      courseId!,
      course!.title,
      rating,
      content
    );
    if (!result.success) throw new Error(result.message);
    setUserReviewed(true);
  };

  const handleUpdateReview = async () => {
    if (!editingReview) return;
    try {
      await updateReview(editingReview.id, editRating, editContent);
      setEditingReview(null);
    } catch (err) {
      console.error(err);
      alert("Không thể cập nhật đánh giá");
    }
  };

  const handleDeleteReview = async (reviewId: string) => {
    if (window.confirm("Bạn có chắc muốn xóa đánh giá này?")) {
      try {
        await deleteReviewWithRecalc(reviewId);
      } catch (err) {
        console.error(err);
        alert("Không thể xóa đánh giá");
      }
    }
  };

  if (courseLoading || enrollmentLoading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", height: "60vh", gap: 16 }}>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <div style={{
          width: 52, height: 52, borderRadius: 16,
          background: "linear-gradient(135deg,#6C63FF,#9B59B6)",
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 0 28px rgba(108,99,255,0.4)",
          animation: "spin 1.5s linear infinite",
        }}>
          <div style={{ width: 20, height: 20, borderRadius: "50%", border: "3px solid rgba(255,255,255,0.3)", borderTopColor: "#fff" }} />
        </div>
        <span style={{ fontSize: 13, color: "#C7C4D8", fontWeight: 600 }}>Đang tải khóa học...</span>
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
  const completedLessons = progress.filter((p) => p.status === "completed").length;

  // Rating distribution
  const ratingCounts = [0, 0, 0, 0, 0];
  reviews.forEach(r => { if (r.rating >= 1 && r.rating <= 5) ratingCounts[r.rating - 1]++; });
  const maxCount = Math.max(...ratingCounts, 1);

  return (
    <div style={{ background: "#0F0F1A", minHeight: "100vh" }}>
      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.7; transform:scale(1.02)} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
      `}</style>

      {/* Hero Section */}
      <div style={{
        background: "linear-gradient(135deg, rgba(108,99,255,0.20) 0%, rgba(155,89,182,0.12) 50%, rgba(15,15,26,0) 100%)",
        borderBottom: "1px solid rgba(108,99,255,0.1)",
        padding: "48px 0 40px",
      }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "0 24px" }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 32, alignItems: "center" }}>
            <div style={{ flex: 2 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <span style={{
                  fontSize: 11, fontWeight: 800, letterSpacing: ".1em", textTransform: "uppercase",
                  color: "#6C63FF", background: "rgba(108,99,255,0.12)", padding: "4px 12px", borderRadius: 999,
                  border: "1px solid rgba(108,99,255,0.2)",
                }}>Course Detail</span>
              </div>
              <h1 style={{ fontSize: 36, fontWeight: 900, color: "#E4E1EE", margin: "0 0 16px", letterSpacing: "-.025em" }}>
                {course.title}
              </h1>
              <p style={{ fontSize: 16, color: "#C7C4D8", lineHeight: 1.6, marginBottom: 24 }}>
                {course.description}
              </p>
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

              {/* Course Progress Bar */}
              {isEnrolled && !progressLoading && (
                <div style={{ marginBottom: 24, background: "rgba(255,255,255,0.05)", borderRadius: 12, padding: "12px 16px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#C7C4D8", marginBottom: 4 }}>
                    <span>Course Progress</span>
                    <span>{courseCompleted}/{courseTotal} lessons · {percentage}%</span>
                  </div>
                  <div style={{ height: 6, background: "rgba(255,255,255,0.1)", borderRadius: 3, overflow: "hidden" }}>
                    <div style={{ width: `${percentage}%`, height: "100%", background: "linear-gradient(90deg,#6C63FF,#45f1c5)", transition: "width 0.3s" }} />
                  </div>
                </div>
              )}

              <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                {!isEnrolled ? (
                  course.price === 0 ? (
                    <button
                      style={{
                        background: "linear-gradient(135deg,#45f1c5,#00D4AA)",
                        border: "none", padding: "12px 28px", borderRadius: 14,
                        fontSize: 16, fontWeight: 700, color: "#0F0F1A",
                        cursor: "pointer", boxShadow: "0 4px 16px rgba(69,241,197,0.3)",
                        transition: "transform .2s, box-shadow .2s",
                      }}
                      onMouseOver={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 8px 24px rgba(69,241,197,0.4)"; }}
                      onMouseOut={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "0 4px 16px rgba(69,241,197,0.3)"; }}
                      onClick={handleFreeEnroll}
                    >
                      Enroll Now • Free
                    </button>
                  ) : (
                    <button
                      style={{
                        background: "linear-gradient(135deg,#6C63FF,#9B59B6)",
                        border: "none", padding: "12px 28px", borderRadius: 14,
                        fontSize: 16, fontWeight: 700, color: "#fff",
                        cursor: "pointer", boxShadow: "0 4px 16px rgba(108,99,255,0.4)",
                        animation: "pulse 2s ease-in-out infinite",
                        transition: "transform .2s, box-shadow .2s",
                      }}
                      onMouseOver={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 8px 28px rgba(108,99,255,0.5)"; e.currentTarget.style.animation = "none"; }}
                      onMouseOut={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "0 4px 16px rgba(108,99,255,0.4)"; e.currentTarget.style.animation = "pulse 2s ease-in-out infinite"; }}
                      onClick={handlePaidEnroll}
                    >
                      Buy Now • {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(course.price)}
                    </button>
                  )
                ) : (
                  <>
                    <div style={{ background: "rgba(69,241,197,0.1)", border: "1px solid rgba(69,241,197,0.3)", borderRadius: 14, padding: "10px 20px" }}>
                      <span style={{ color: "#45f1c5", fontWeight: 700 }}>✓ Enrolled</span>
                    </div>
                    {/* ✅ Continue Learning button */}
                    {nextLesson && (
                      <Link
                        to={`/learn/${courseId}/${nextLesson.moduleId}/${nextLesson.lessonId}`}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 8,
                          padding: "12px 24px",
                          borderRadius: 14,
                          background: "linear-gradient(135deg,#45f1c5,#00D4AA)",
                          color: "#0F0F1A",
                          fontWeight: 700,
                          textDecoration: "none",
                          fontSize: 15,
                          transition: "transform .2s, box-shadow .2s",
                          boxShadow: "0 4px 16px rgba(69,241,197,0.25)",
                        }}
                        onMouseOver={(e) => {
                          e.currentTarget.style.transform = "translateY(-2px)";
                          e.currentTarget.style.boxShadow = "0 8px 24px rgba(69,241,197,0.4)";
                        }}
                        onMouseOut={(e) => {
                          e.currentTarget.style.transform = "translateY(0)";
                          e.currentTarget.style.boxShadow = "0 4px 16px rgba(69,241,197,0.25)";
                        }}
                      >
                        Tiếp tục học <ArrowRight size={18} />
                      </Link>
                    )}
                  </>
                )}

                {isEnrolled && communityLoading && (
                  <div style={{
                    display: "inline-flex", alignItems: "center", gap: 8,
                    padding: "12px 20px", borderRadius: 14,
                    background: "rgba(108,99,255,0.06)", border: "1px solid rgba(108,99,255,0.12)",
                    color: "#6B6882", fontSize: 14,
                  }}>
                    <div style={{ width: 14, height: 14, borderRadius: "50%", border: "2px solid rgba(108,99,255,0.2)", borderTopColor: "#6C63FF", animation: "spin 0.8s linear infinite" }} />
                    Loading community…
                  </div>
                )}
                {isEnrolled && communityRoomId && hasAccess && !communityLoading && (
                  <Link
                    to={`/chat/${communityRoomId}`}
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 10,
                      padding: "12px 24px", borderRadius: 14,
                      background: "linear-gradient(135deg,rgba(108,99,255,0.14),rgba(155,89,182,0.09))",
                      border: "1px solid rgba(108,99,255,0.28)",
                      color: "#c4c0ff", fontWeight: 700, textDecoration: "none", fontSize: 15,
                      transition: "all .2s",
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.background = "linear-gradient(135deg,rgba(108,99,255,0.22),rgba(155,89,182,0.16))";
                      e.currentTarget.style.borderColor = "rgba(108,99,255,0.45)";
                      e.currentTarget.style.transform = "translateY(-2px)";
                      e.currentTarget.style.boxShadow = "0 6px 20px rgba(108,99,255,0.2)";
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.background = "linear-gradient(135deg,rgba(108,99,255,0.14),rgba(155,89,182,0.09))";
                      e.currentTarget.style.borderColor = "rgba(108,99,255,0.28)";
                      e.currentTarget.style.transform = "translateY(0)";
                      e.currentTarget.style.boxShadow = "none";
                    }}
                  >
                    <MessageSquare size={17} />
                    Join Community
                    <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: ".04em", background: "rgba(255,215,0,0.14)", color: "#FFD700", padding: "2px 8px", borderRadius: 999 }}>
                      💬 LIVE
                    </span>
                  </Link>
                )}

                {completedLessons > 0 && (
                  <div style={{ background: "rgba(255,255,255,0.05)", borderRadius: 14, padding: "10px 18px" }}>
                    <span style={{ color: "#C7C4D8", fontWeight: 600 }}>
                      Progress: {completedLessons}/{totalLessons} lessons
                    </span>
                  </div>
                )}
              </div>
            </div>
            <div style={{ flex: 1 }}>
              {course.thumbnailUrl ? (
                <img
                  src={course.thumbnailUrl}
                  alt={course.title}
                  style={{ width: "100%", borderRadius: 20, boxShadow: "0 10px 30px rgba(0,0,0,0.4)" }}
                />
              ) : (
                <div style={{
                  background: "rgba(108,99,255,0.1)", borderRadius: 20,
                  padding: "40px", textAlign: "center",
                }}>
                  <BookOpen size={48} color="#6C63FF" />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "32px 24px" }}>
        {/* AI Recommendation */}
        {recommendedLessonId && recommendedModuleId && !courseLoading && !recommendationLoading && (
          <div style={{
            marginBottom: 24, padding: 16,
            background: "linear-gradient(135deg,rgba(108,99,255,0.08),rgba(155,89,182,0.05))",
            borderRadius: 16, border: "1px solid rgba(108,99,255,0.2)",
            display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12,
          }}>
            <div>
              <h4 style={{ display: "flex", alignItems: "center", gap: 8, color: "#c4c0ff", margin: 0 }}>
                <Sparkles size={18} color="#FFD700" /> Gợi ý bài học tiếp theo
              </h4>
              <p style={{ color: "#C7C4D8", margin: "4px 0 0", fontSize: 14 }}>Lý do: {reason}</p>
            </div>
            <button
              onClick={() => navigate(`/learn/${courseId}/${recommendedModuleId}/${recommendedLessonId}`)}
              style={{
                padding: "8px 20px", borderRadius: 10,
                background: "linear-gradient(135deg,#6C63FF,#9B59B6)", border: "none",
                color: "#fff", cursor: "pointer", fontWeight: 600, fontSize: 14,
                transition: "transform .2s",
              }}
              onMouseOver={e => e.currentTarget.style.transform = "scale(1.02)"}
              onMouseOut={e => e.currentTarget.style.transform = "scale(1)"}
            >
              Bắt đầu ngay →
            </button>
          </div>
        )}

        {/* Curriculum */}
        <div style={{ marginTop: 8 }}>
          <h2 style={{ fontSize: 24, fontWeight: 700, color: "#E4E1EE", marginBottom: 24 }}>
            Course Curriculum
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {course.modules.map((module, idx) => {
              const moduleCompletedLessons = module.lessons.filter((lesson) =>
                isLessonCompleted(module.id, lesson.id)
              ).length;
              const moduleProgress = module.lessons.length
                ? (moduleCompletedLessons / module.lessons.length) * 100
                : 0;
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
                  <div
                    style={{
                      padding: "16px 20px",
                      background: "rgba(255,255,255,0.02)",
                      borderBottom: "1px solid rgba(255,255,255,0.06)",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                      <h3 style={{ fontSize: 18, fontWeight: 700, color: "#E4E1EE" }}>
                        Module {idx + 1}: {module.title}
                      </h3>
                      <span style={{ fontSize: 12, color: "#C7C4D8" }}>{module.lessons.length} lessons</span>
                    </div>
                    <div style={{
                      height: 4, background: "rgba(255,255,255,0.1)", borderRadius: 4, overflow: "hidden",
                    }}>
                      <div
                        style={{
                          width: `${moduleProgress}%`,
                          height: "100%",
                          background: "linear-gradient(90deg,#6C63FF,#45f1c5)",
                          transition: "width 0.3s",
                        }}
                      />
                    </div>
                  </div>
                  <div>
                    {module.lessons.map((lesson, lIdx) => {
                      const completed = isLessonCompleted(module.id, lesson.id);
                      const quizScore = getQuizScore(module.id, lesson.id);

                      const now = new Date();
                      const releaseDate = lesson.releaseAt ? new Date(lesson.releaseAt) : null;
                      const isReleased = !releaseDate || releaseDate <= now;
                      const prerequisitesMet = !lesson.prerequisites || lesson.prerequisites.length === 0 ||
                        lesson.prerequisites.every(preId =>
                          progress.some(p => p.lessonId === preId && p.status === "completed")
                        );
                      const isPaymentLocked = !lesson.isFree && !isEnrolled;
                      const isLocked = isPaymentLocked || !isReleased || !prerequisitesMet;

                      let lockReason = "";
                      if (isPaymentLocked) lockReason = "Paid lesson";
                      else if (!isReleased && releaseDate) lockReason = `Available ${releaseDate.toLocaleDateString()}`;
                      else if (!prerequisitesMet) lockReason = "Prerequisites required";

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
                            cursor: isLocked ? "not-allowed" : "pointer",
                            transition: "background 0.15s",
                            background: completed ? "rgba(69,241,197,0.05)" : "transparent",
                            opacity: isLocked ? 0.7 : 1,
                          }}
                          onMouseOver={(e) => {
                            if (!isLocked) e.currentTarget.style.background = "rgba(255,255,255,0.04)";
                          }}
                          onMouseOut={(e) => {
                            e.currentTarget.style.background = completed
                              ? "rgba(69,241,197,0.05)"
                              : "transparent";
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                            <span style={{ width: 28, textAlign: "center", fontSize: 14, fontWeight: 600, color: "#C7C4D8" }}>
                              {lIdx + 1}
                            </span>
                            {lesson.type === "video" && <Play size={16} color="#6C63FF" />}
                            {lesson.type === "quiz" && <Zap size={16} color="#45f1c5" />}
                            {lesson.type === "reading" && <FileText size={16} color="#FFB785" />}
                            {lesson.type === "flashcard" && <Layers size={16} color="#c4c0ff" />}
                            <span style={{ fontSize: 15, fontWeight: 600, color: "#E4E1EE" }}>
                              {lesson.title}
                            </span>
                            {isLocked && <Lock size={14} color="#47464f" />}
                            {completed && <CheckCircle size={14} color="#45f1c5" />}
                            {quizScore !== undefined && (
                              <span style={{ fontSize: 11, color: "#45f1c5", marginLeft: 8 }}>
                                Score: {quizScore}%
                              </span>
                            )}
                            {isLocked && lockReason && (
                              <span style={{ fontSize: 11, color: "#FFB785", marginLeft: 4 }}>
                                ({lockReason})
                              </span>
                            )}
                            {!prerequisitesMet && lesson.prerequisites && (
                              <span style={{ fontSize: 11, color: "#FFB785", marginLeft: 4 }}>
                                (Requires: {lesson.prerequisites.map(id => {
                                  const found = course.modules.flatMap(m => m.lessons).find(l => l.id === id);
                                  return found?.title || id;
                                }).join(", ")})
                              </span>
                            )}
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

        {/* Reviews Section */}
        <div style={{ marginTop: 48 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
            <h2 style={{ fontSize: 24, fontWeight: 700, color: "#E4E1EE" }}>
              Đánh giá từ học viên ({reviews.length})
            </h2>
            {currentUser && !userReviewed && !reviewCheckLoading && (
              <button
                onClick={() => setShowReviewForm(true)}
                style={{
                  background: "linear-gradient(135deg,#6C63FF,#9B59B6)",
                  border: "none", padding: "8px 20px", borderRadius: 12,
                  fontSize: 14, fontWeight: 700, color: "#fff", cursor: "pointer",
                  transition: "transform .2s",
                }}
                onMouseOver={e => e.currentTarget.style.transform = "scale(1.02)"}
                onMouseOut={e => e.currentTarget.style.transform = "scale(1)"}
              >
                Viết đánh giá
              </button>
            )}
          </div>

          {/* Rating distribution */}
          {reviews.length > 0 && (
            <div style={{
              background: "rgba(26,26,46,0.4)", borderRadius: 12,
              padding: 20, marginBottom: 24,
              border: "1px solid rgba(255,255,255,0.05)",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontSize: 28, fontWeight: 900, color: "#E4E1EE" }}>
                    {course.rating.toFixed(1)}
                  </div>
                  <div style={{ display: "flex", gap: 2 }}>
                    {[1, 2, 3, 4, 5].map(s => (
                      <Star key={s} size={14} fill={s <= Math.round(course.rating) ? "#FFB785" : "transparent"} color="#FFB785" />
                    ))}
                  </div>
                  <div style={{ fontSize: 12, color: "#C7C4D8" }}>{reviews.length} đánh giá</div>
                </div>
                <div style={{ flex: 1, minWidth: 200 }}>
                  {[5, 4, 3, 2, 1].map(r => {
                    const count = ratingCounts[r - 1] || 0;
                    const pct = maxCount > 0 ? (count / maxCount) * 100 : 0;
                    return (
                      <div key={r} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                        <span style={{ width: 20, color: "#C7C4D8" }}>{r}★</span>
                        <div style={{ flex: 1, height: 6, background: "rgba(255,255,255,0.06)", borderRadius: 3, overflow: "hidden" }}>
                          <div style={{ width: `${pct}%`, height: "100%", background: "linear-gradient(90deg,#6C63FF,#9B59B6)", borderRadius: 3 }} />
                        </div>
                        <span style={{ width: 30, color: "#C7C4D8", textAlign: "right" }}>{count}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          <ReviewList
            reviews={reviews}
            loading={reviewsLoading}
            currentUserId={currentUser?.uid}
            onEdit={(review) => {
              setEditingReview(review);
              setEditRating(review.rating);
              setEditContent(review.content);
            }}
            onDelete={handleDeleteReview}
          />
        </div>

        <ReviewForm
          isOpen={showReviewForm}
          onClose={() => setShowReviewForm(false)}
          onSubmit={handleSubmitReview}
          courseId={courseId!}
          courseTitle={course.title}
        />

        {editingReview && (
          <div
            style={{
              position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
              background: "rgba(0,0,0,0.7)",
              display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000,
            }}
            onClick={() => setEditingReview(null)}
          >
            <div
              style={{
                background: "#1A1A2E", borderRadius: 24, padding: 24,
                width: "90%", maxWidth: 500,
                border: "1px solid rgba(108,99,255,0.2)",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <h3 style={{ fontSize: 20, fontWeight: 700, color: "#E4E1EE" }}>Chỉnh sửa đánh giá</h3>
                <button onClick={() => setEditingReview(null)} style={{ background: "none", border: "none", cursor: "pointer" }}>
                  <X size={24} color="#C7C4D8" />
                </button>
              </div>
              <div style={{ marginBottom: 16 }}>
                <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      size={32}
                      fill={star <= editRating ? "#FFB785" : "transparent"}
                      color="#FFB785"
                      style={{ cursor: "pointer" }}
                      onClick={() => setEditRating(star)}
                    />
                  ))}
                </div>
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  placeholder="Nội dung đánh giá của bạn..."
                  rows={4}
                  style={{
                    width: "100%",
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 12,
                    padding: 12,
                    color: "#E4E1EE",
                    fontSize: 14,
                    resize: "vertical",
                  }}
                />
              </div>
              <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
                <button
                  onClick={() => setEditingReview(null)}
                  style={{
                    background: "rgba(255,255,255,0.1)", border: "none",
                    padding: "10px 20px", borderRadius: 12,
                    fontWeight: 600, color: "#C7C4D8", cursor: "pointer",
                  }}
                >
                  Hủy
                </button>
                <button
                  onClick={handleUpdateReview}
                  style={{
                    background: "linear-gradient(135deg,#6C63FF,#9B59B6)", border: "none",
                    padding: "10px 20px", borderRadius: 12,
                    fontWeight: 600, color: "#fff", cursor: "pointer",
                  }}
                >
                  Lưu thay đổi
                </button>
              </div>
            </div>
          </div>
        )}

        <PaymentModal
          isOpen={paymentModalOpen}
          onClose={() => setPaymentModalOpen(false)}
          transactionId={paymentTransactionId}
          checkoutUrl={paymentCheckoutUrl}
          qrCode={paymentQrCode}
          onSuccess={handlePaymentSuccess}
        />
      </div>
    </div>
  );
}
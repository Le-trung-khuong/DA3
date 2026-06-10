/**
 * src/pages/client/CourseDetail.tsx
 * Chi tiết khóa học (modules & lessons) + progress tracking + reviews + sửa/xóa review
 * Tích hợp realtime enrollment (useUserEnrollment)
 * Xử lý enroll miễn phí (price === 0) và thanh toán PayOS (price > 0)
 */

"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { where } from "firebase/firestore";
import { useDocument } from "../../hooks/useFirestore";
import { useProgress } from "../../hooks/useProgress";
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
} from "lucide-react";

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

  // Realtime enrollment
  const { isEnrolled, loading: enrollmentLoading } = useUserEnrollment(
    currentUser?.uid,
    courseId
  );

  const [showReviewForm, setShowReviewForm] = useState(false);
  const [userReviewed, setUserReviewed] = useState(false);
  const [reviewCheckLoading, setReviewCheckLoading] = useState(true);
  const [editingReview, setEditingReview] = useState<Review | null>(null);
  const [editRating, setEditRating] = useState(0);
  const [editContent, setEditContent] = useState("");

  // Payment modal
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [paymentTransactionId, setPaymentTransactionId] = useState<string | null>(null);
  const [paymentCheckoutUrl, setPaymentCheckoutUrl] = useState("");
  const [paymentQrCode, setPaymentQrCode] = useState("");

  const { data: course, loading: courseLoading, error: courseError } = useDocument<Course>(
    "courses",
    courseId
  );
  const { progress, isLessonCompleted, getQuizScore } = useProgress(currentUser?.uid, courseId);

  // Lấy danh sách reviews realtime
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

  // Kiểm tra user đã review chưa
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

  const handleStartLesson = (moduleId: string, lesson: Lesson) => {
    if (!lesson.isFree && !isEnrolled) {
      alert("You need to purchase this course to access this lesson.");
      return;
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
    // Realtime hook `useUserEnrollment` sẽ tự cập nhật isEnrolled
    // Có thể reload để làm mới UI
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
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "60vh" }}>
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: "50%",
            border: "2px solid rgba(108,99,255,0.2)",
            borderTopColor: "#6C63FF",
            animation: "spin 0.8s linear infinite",
          }}
        />
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

  return (
    <div style={{ maxWidth: 1280, margin: "0 auto", padding: "32px 24px" }}>
      {/* Hero Section */}
      <div
        style={{
          background: "linear-gradient(135deg, rgba(108,99,255,0.15), rgba(155,89,182,0.1))",
          borderRadius: 24,
          padding: 32,
          marginBottom: 32,
          border: "1px solid rgba(108,99,255,0.2)",
        }}
      >
        <div style={{ display: "flex", flexWrap: "wrap", gap: 32, alignItems: "center" }}>
          <div style={{ flex: 2 }}>
            <h1 style={{ fontSize: 36, fontWeight: 800, color: "#E4E1EE", marginBottom: 16 }}>
              {course.title}
            </h1>
            <p style={{ fontSize: 16, color: "#C7C4D8", lineHeight: 1.6, marginBottom: 24 }}>
              {course.description}
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 24, marginBottom: 24 }}>
              <span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, color: "#C7C4D8" }}>
                <Star size={16} color="#FFB785" fill="#FFB785" /> {course.rating.toFixed(1)} (
                {course.ratingCount} reviews)
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
                course.price === 0 ? (
                  <button
                    style={{
                      background: "linear-gradient(135deg,#45f1c5,#00D4AA)",
                      border: "none",
                      padding: "12px 24px",
                      borderRadius: 12,
                      fontSize: 16,
                      fontWeight: 700,
                      color: "#0F0F1A",
                      cursor: "pointer",
                    }}
                    onClick={handleFreeEnroll}
                  >
                    Enroll Now • Free
                  </button>
                ) : (
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
                    onClick={handlePaidEnroll}
                  >
                    Buy Now • {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(course.price)}
                  </button>
                )
              ) : (
                <div
                  style={{
                    background: "rgba(69,241,197,0.1)",
                    border: "1px solid rgba(69,241,197,0.3)",
                    borderRadius: 12,
                    padding: "8px 16px",
                  }}
                >
                  <span style={{ color: "#45f1c5", fontWeight: 700 }}>✓ Enrolled</span>
                </div>
              )}
              {completedLessons > 0 && (
                <div style={{ background: "rgba(255,255,255,0.05)", borderRadius: 12, padding: "8px 16px" }}>
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
                style={{ width: "100%", borderRadius: 16, boxShadow: "0 10px 30px rgba(0,0,0,0.3)" }}
              />
            ) : (
              <div
                style={{
                  background: "rgba(108,99,255,0.1)",
                  borderRadius: 16,
                  padding: "40px",
                  textAlign: "center",
                }}
              >
                <BookOpen size={48} color="#6C63FF" />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Curriculum Section */}
      <div>
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
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: 8,
                    }}
                  >
                    <h3 style={{ fontSize: 18, fontWeight: 700, color: "#E4E1EE" }}>
                      Module {idx + 1}: {module.title}
                    </h3>
                    <span style={{ fontSize: 12, color: "#C7C4D8" }}>{module.lessons.length} lessons</span>
                  </div>
                  <div
                    style={{
                      height: 4,
                      background: "rgba(255,255,255,0.1)",
                      borderRadius: 4,
                      overflow: "hidden",
                    }}
                  >
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
                    const isLocked = !lesson.isFree && !isEnrolled;
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
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                          <span
                            style={{ width: 28, textAlign: "center", fontSize: 14, fontWeight: 600, color: "#C7C4D8" }}
                          >
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
                border: "none",
                padding: "8px 20px",
                borderRadius: 12,
                fontSize: 14,
                fontWeight: 700,
                color: "#fff",
                cursor: "pointer",
              }}
            >
              Viết đánh giá
            </button>
          )}
        </div>
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

      {/* Review Form Modal */}
      <ReviewForm
        isOpen={showReviewForm}
        onClose={() => setShowReviewForm(false)}
        onSubmit={handleSubmitReview}
        courseTitle={course.title}
      />

      {/* Edit Review Modal */}
      {editingReview && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.7)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
          onClick={() => setEditingReview(null)}
        >
          <div
            style={{
              background: "#1A1A2E",
              borderRadius: 24,
              padding: 24,
              width: "90%",
              maxWidth: 500,
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
                  background: "rgba(255,255,255,0.1)",
                  border: "none",
                  padding: "10px 20px",
                  borderRadius: 12,
                  fontWeight: 600,
                  color: "#C7C4D8",
                  cursor: "pointer",
                }}
              >
                Hủy
              </button>
              <button
                onClick={handleUpdateReview}
                style={{
                  background: "linear-gradient(135deg,#6C63FF,#9B59B6)",
                  border: "none",
                  padding: "10px 20px",
                  borderRadius: 12,
                  fontWeight: 600,
                  color: "#fff",
                  cursor: "pointer",
                }}
              >
                Lưu thay đổi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      <PaymentModal
        isOpen={paymentModalOpen}
        onClose={() => setPaymentModalOpen(false)}
        transactionId={paymentTransactionId}
        checkoutUrl={paymentCheckoutUrl}
        qrCode={paymentQrCode}
        onSuccess={handlePaymentSuccess}
      />
    </div>
  );
}
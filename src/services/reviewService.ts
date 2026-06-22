// src/services/reviewService.ts
import { db } from "../utils/config";
import {
  doc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  addDoc,
  collection,
  query,
  where,
  getDocs,
  getDoc,
  increment,
  arrayUnion,
  arrayRemove,
  runTransaction,
} from "firebase/firestore";
import type { AdminActionResult } from "./adminService";
import type { Review, ReviewStatus } from "../types/review";
import { getCourseProgress } from "./progressService";
import { getUserAchievements } from "./achievementService";

// ============ CÔNG THỨC TÍNH WEIGHT ============
export async function calculateReviewWeight(
  userId: string,
  courseId: string,
  courseProgress: number
): Promise<{ weight: number; verified: boolean }> {
  // Lấy thông tin user
  const userRef = doc(db, "users", userId);
  const userSnap = await getDoc(userRef);
  const userData = userSnap.exists() ? userSnap.data() : {};
  const totalXP = userData.totalXP || 0;
  const role = userData.role || "student";

  // Lấy số khóa học đã hoàn thành
  const completedCoursesQuery = query(
    collection(db, "progress"),
    where("userId", "==", userId),
    where("status", "==", "completed")
  );
  const completedSnap = await getDocs(completedCoursesQuery);
  // Tính số khóa học đã hoàn thành (group by courseId)
  const courseMap = new Map<string, Set<string>>();
  completedSnap.forEach(doc => {
    const data = doc.data();
    const cid = data.courseId;
    if (cid) {
      if (!courseMap.has(cid)) courseMap.set(cid, new Set());
      courseMap.get(cid)!.add(data.lessonId);
    }
  });
  // Đếm số khóa học có 100% completion
  let completedCourses = 0;
  for (const [cid, lessonSet] of courseMap) {
    const courseRef = doc(db, "courses", cid);
    const courseSnap = await getDoc(courseRef);
    const totalLessons = courseSnap.data()?.modules?.reduce(
      (acc: number, m: any) => acc + (m.lessons?.length || 0), 0
    ) || 0;
    if (lessonSet.size >= totalLessons) completedCourses++;
  }

  // Lấy achievements của user
  const userAchievements = await getUserAchievements(userId);
  const achievementIds = userAchievements.map(a => a.achievementId);

  // ==== TÍNH WEIGHT ====
  let weight = 1.0;
  let verified = false;

  // 1. Verified learner (>=80% progress)
  if (courseProgress >= 80) {
    weight *= 1.2;
    verified = true;
  }

  // 2. Completed courses
  if (completedCourses >= 5) weight *= 1.3;
  else if (completedCourses >= 3) weight *= 1.15;

  // 3. XP level
  if (totalXP >= 10000) weight *= 1.5;
  else if (totalXP >= 5000) weight *= 1.3;
  else if (totalXP >= 2000) weight *= 1.15;

  // 4. Achievements
  const hasAch = (id: string) => achievementIds.includes(id);
  if (hasAch('top_learner')) weight *= 1.5;
  if (hasAch('knowledge_master')) weight *= 1.3;
  if (hasAch('course_finisher')) weight *= 1.2;

  // 5. Role
  if (['instructor', 'moderator', 'admin'].includes(role)) weight *= 1.5;

  // Cap at 2.0
  weight = Math.min(weight, 2.0);

  return { weight, verified };
}

// ============ CREATE REVIEW (có kiểm tra điều kiện) ============
export async function createReview(
  userId: string,
  userName: string,
  courseId: string,
  courseTitle: string,
  rating: number,
  content: string
): Promise<{ success: boolean; message: string; reviewId?: string }> {
  // 1. Kiểm tra user đã review chưa
  const existingQuery = query(
    collection(db, "reviews"),
    where("userId", "==", userId),
    where("courseId", "==", courseId)
  );
  const existingSnap = await getDocs(existingQuery);
  if (!existingSnap.empty) {
    return { success: false, message: "Bạn đã đánh giá khóa học này rồi." };
  }

  // 2. ✅ Kiểm tra điều kiện: đã enroll và progress >= 30%
  const enrollQuery = query(
    collection(db, "enrollments"),
    where("userId", "==", userId),
    where("courseId", "==", courseId),
    where("isActive", "==", true)
  );
  const enrollSnap = await getDocs(enrollQuery);
  if (enrollSnap.empty) {
    return { success: false, message: "Bạn cần tham gia khóa học trước khi đánh giá." };
  }

  // Lấy progress của course
  const progressList = await getCourseProgress(userId, courseId);
  const totalLessons = progressList.length;
  const completedLessons = progressList.filter(p => p.status === "completed").length;
  const progressPercent = totalLessons > 0 ? (completedLessons / totalLessons) * 100 : 0;

  if (progressPercent < 30) {
    return {
      success: false,
      message: `Bạn cần hoàn thành ít nhất 30% khóa học (hiện tại ${Math.round(progressPercent)}%) trước khi đánh giá.`
    };
  }

  // 3. Tính review weight và verified
  const { weight, verified } = await calculateReviewWeight(userId, courseId, progressPercent);

  // 4. Tạo review
  const reviewRef = await addDoc(collection(db, "reviews"), {
    userId,
    userName,
    userAvatar: null,
    courseId,
    courseTitle,
    rating,
    content,
    status: "visible",
    helpfulCount: 0,
    notHelpfulCount: 0,
    helpfulUsers: [],
    notHelpfulUsers: [],
    reportCount: 0,
    verified,
    reviewWeight: weight,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  // 5. Cập nhật rating trung bình (weighted)
  await recalculateCourseRating(courseId);

  return { success: true, message: "Cảm ơn bạn đã đánh giá!", reviewId: reviewRef.id };
}

// ============ UPDATE REVIEW ============
export async function updateReview(
  reviewId: string,
  rating: number,
  content: string
): Promise<AdminActionResult> {
  const reviewRef = doc(db, "reviews", reviewId);
  await updateDoc(reviewRef, {
    rating,
    content,
    updatedAt: serverTimestamp(),
  });
  // Recalculate
  const reviewSnap = await getDoc(reviewRef);
  const courseId = reviewSnap.data()?.courseId;
  if (courseId) await recalculateCourseRating(courseId);
  return { success: true, message: "Review updated successfully" };
}

// ============ HELPFUL / NOT HELPFUL ============
export async function toggleHelpful(
  reviewId: string,
  userId: string,
  helpful: boolean
): Promise<{ success: boolean; message: string }> {
  const reviewRef = doc(db, "reviews", reviewId);
  const field = helpful ? 'helpfulUsers' : 'notHelpfulUsers';
  const countField = helpful ? 'helpfulCount' : 'notHelpfulCount';
  const oppositeField = helpful ? 'notHelpfulUsers' : 'helpfulUsers';
  const oppositeCountField = helpful ? 'notHelpfulCount' : 'helpfulCount';

  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(reviewRef);
    if (!snap.exists()) throw new Error("Review not found");

    const data = snap.data() as Review;
    const users = data[field] || [];
    const oppositeUsers = data[oppositeField] || [];

    if (users.includes(userId)) {
      // Unmark
      transaction.update(reviewRef, {
        [field]: arrayRemove(userId),
        [countField]: increment(-1),
        updatedAt: serverTimestamp(),
      });
    } else {
      // Mark helpful, remove from opposite if exists
      const updates: any = {
        [field]: arrayUnion(userId),
        [countField]: increment(1),
        updatedAt: serverTimestamp(),
      };
      if (oppositeUsers.includes(userId)) {
        updates[oppositeField] = arrayRemove(userId);
        updates[oppositeCountField] = increment(-1);
      }
      transaction.update(reviewRef, updates);
    }
  });

  return { success: true, message: helpful ? "Marked as helpful" : "Marked as not helpful" };
}

// ============ RECALCULATE COURSE RATING (WEIGHTED) ============
async function recalculateCourseRating(courseId: string): Promise<void> {
  const q = query(
    collection(db, "reviews"),
    where("courseId", "==", courseId),
    where("status", "==", "visible")
  );
  const snap = await getDocs(q);
  const reviews = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Review));

  if (reviews.length === 0) {
    await updateDoc(doc(db, "courses", courseId), {
      rating: 0,
      ratingCount: 0,
      updatedAt: serverTimestamp(),
    });
    return;
  }

  // ✅ Weighted average
  let sumWeighted = 0;
  let sumWeights = 0;
  for (const r of reviews) {
    const weight = r.reviewWeight || 1.0;
    sumWeighted += r.rating * weight;
    sumWeights += weight;
  }
  const avg = sumWeights > 0 ? sumWeighted / sumWeights : 0;

  await updateDoc(doc(db, "courses", courseId), {
    rating: avg,
    ratingCount: reviews.length,
    updatedAt: serverTimestamp(),
  });
}

// ============ CÁC HÀM KHÁC (giữ nguyên) ============
export async function hideReview(reviewId: string): Promise<AdminActionResult> {
  const reviewRef = doc(db, "reviews", reviewId);
  await updateDoc(reviewRef, {
    status: "hidden",
    updatedAt: serverTimestamp(),
  });
  return { success: true, message: "Review hidden" };
}

export async function unhideReview(reviewId: string): Promise<AdminActionResult> {
  const reviewRef = doc(db, "reviews", reviewId);
  await updateDoc(reviewRef, {
    status: "visible",
    updatedAt: serverTimestamp(),
  });
  return { success: true, message: "Review restored" };
}

export async function deleteReview(reviewId: string): Promise<AdminActionResult> {
  const reviewRef = doc(db, "reviews", reviewId);
  await deleteDoc(reviewRef);
  return { success: true, message: "Review deleted permanently" };
}

export async function deleteReviewWithRecalc(reviewId: string): Promise<AdminActionResult> {
  const reviewRef = doc(db, "reviews", reviewId);
  const reviewSnap = await getDoc(reviewRef);
  const courseId = reviewSnap.data()?.courseId;
  await deleteDoc(reviewRef);
  if (courseId) await recalculateCourseRating(courseId);
  return { success: true, message: "Review deleted successfully" };
}

export async function hasUserReviewed(userId: string, courseId: string): Promise<boolean> {
  const q = query(
    collection(db, "reviews"),
    where("userId", "==", userId),
    where("courseId", "==", courseId)
  );
  const snap = await getDocs(q);
  return !snap.empty;
}

export async function reportReview(reviewId: string, userId: string): Promise<void> {
  const reviewRef = doc(db, "reviews", reviewId);
  await updateDoc(reviewRef, {
    reportCount: increment(1),
    reportedBy: arrayUnion(userId),
    updatedAt: serverTimestamp(),
  });
}

export async function getReviewsSortedByReports(): Promise<Review[]> {
  const snap = await getDocs(collection(db, "reviews"));
  const reviews = snap.docs.map(d => ({ id: d.id, ...d.data() } as Review));
  return reviews.sort((a, b) => (b.reportCount || 0) - (a.reportCount || 0));
}

// ============ CHECK REVIEW ELIGIBILITY ============
export async function checkReviewEligibility(
  userId: string,
  courseId: string
): Promise<{ eligible: boolean; message?: string; progress?: number }> {
  // Check enrollment
  const enrollQuery = query(
    collection(db, "enrollments"),
    where("userId", "==", userId),
    where("courseId", "==", courseId),
    where("isActive", "==", true)
  );
  const enrollSnap = await getDocs(enrollQuery);
  if (enrollSnap.empty) {
    return { eligible: false, message: "Bạn cần tham gia khóa học trước khi đánh giá." };
  }

  // Check progress
  const progressList = await getCourseProgress(userId, courseId);
  const total = progressList.length;
  const completed = progressList.filter(p => p.status === "completed").length;
  const percent = total > 0 ? (completed / total) * 100 : 0;

  if (percent < 30) {
    return {
      eligible: false,
      message: `Bạn cần hoàn thành ít nhất 30% khóa học (hiện tại ${Math.round(percent)}%).`,
      progress: percent,
    };
  }

  return { eligible: true, progress: percent };
}
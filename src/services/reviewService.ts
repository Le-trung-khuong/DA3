/**
 * src/services/reviewService.ts
 * Admin + Client operations for reviews management
 */

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
} from "firebase/firestore";
import type { AdminActionResult } from "./adminService";
import type { Review } from "../types/review";

/**
 * Ẩn review (soft delete / moderation)
 */
export async function hideReview(reviewId: string): Promise<AdminActionResult> {
  const reviewRef = doc(db, "reviews", reviewId);
  await updateDoc(reviewRef, {
    status: "hidden",
    updatedAt: serverTimestamp(),
  });
  return { success: true, message: "Review hidden from public view." };
}

/**
 * Hiện lại review (bỏ ẩn)
 */
export async function unhideReview(reviewId: string): Promise<AdminActionResult> {
  const reviewRef = doc(db, "reviews", reviewId);
  await updateDoc(reviewRef, {
    status: "visible",
    updatedAt: serverTimestamp(),
  });
  return { success: true, message: "Review restored to public view." };
}

/**
 * Xóa vĩnh viễn review (dành cho admin)
 */
export async function deleteReview(reviewId: string): Promise<AdminActionResult> {
  const reviewRef = doc(db, "reviews", reviewId);
  await deleteDoc(reviewRef);
  return { success: true, message: "Review permanently deleted from Firestore." };
}

/**
 * Tạo review mới từ user
 */
export async function createReview(
  userId: string,
  userName: string,
  courseId: string,
  courseTitle: string,
  rating: number,
  content: string
): Promise<{ success: boolean; message: string; reviewId?: string }> {
  // Kiểm tra user đã review chưa
  const existingQuery = query(
    collection(db, "reviews"),
    where("userId", "==", userId),
    where("courseId", "==", courseId)
  );
  const existingSnap = await getDocs(existingQuery);
  if (!existingSnap.empty) {
    return { success: false, message: "Bạn đã đánh giá khóa học này rồi." };
  }

  // Thêm review mới
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
    reportCount: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  // Cập nhật rating và ratingCount trong course document
  await recalculateCourseRating(courseId);

  return { success: true, message: "Cảm ơn bạn đã đánh giá!", reviewId: reviewRef.id };
}

/**
 * Cập nhật review (chỉ chủ sở hữu mới được gọi)
 */
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

  // Cập nhật lại rating trung bình của course
  const reviewSnap = await getDoc(reviewRef);
  const courseId = reviewSnap.data()?.courseId;
  if (courseId) {
    await recalculateCourseRating(courseId);
  }

  return { success: true, message: "Review updated successfully" };
}

/**
 * Xóa review (dành cho chính user hoặc admin) và cập nhật lại rating course
 */
export async function deleteReviewWithRecalc(reviewId: string): Promise<AdminActionResult> {
  const reviewRef = doc(db, "reviews", reviewId);
  const reviewSnap = await getDoc(reviewRef);
  const courseId = reviewSnap.data()?.courseId;

  await deleteDoc(reviewRef);

  if (courseId) {
    await recalculateCourseRating(courseId);
  }

  return { success: true, message: "Review deleted successfully" };
}

/**
 * Tính toán lại rating trung bình cho một course dựa trên tất cả reviews có status "visible"
 */
async function recalculateCourseRating(courseId: string): Promise<void> {
  const q = query(
    collection(db, "reviews"),
    where("courseId", "==", courseId),
    where("status", "==", "visible")
  );
  const snap = await getDocs(q);
  const reviews = snap.docs.map((doc) => doc.data() as Review);
  const total = reviews.length;
  const sum = reviews.reduce((acc, r) => acc + r.rating, 0);
  const avg = total === 0 ? 0 : sum / total;

  const courseRef = doc(db, "courses", courseId);
  await updateDoc(courseRef, {
    rating: avg,
    ratingCount: total,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Kiểm tra user đã review khóa học chưa
 */
export async function hasUserReviewed(userId: string, courseId: string): Promise<boolean> {
  const q = query(
    collection(db, "reviews"),
    where("userId", "==", userId),
    where("courseId", "==", courseId)
  );
  const snap = await getDocs(q);
  return !snap.empty;
}
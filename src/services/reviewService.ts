/**
 * src/services/reviewService.ts
 * Admin + Client operations for reviews management
 */

import { db } from "../utils/config";
import { doc, updateDoc, deleteDoc, serverTimestamp, addDoc, collection, query, where, getDocs, getDoc } from "firebase/firestore";
import type { AdminActionResult } from "./adminService";

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
 * Xóa vĩnh viễn review
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
  const courseRef = doc(db, "courses", courseId);
  const courseSnap = await getDoc(courseRef);
  if (courseSnap.exists()) {
    const currentRating = courseSnap.data().rating || 0;
    const currentCount = courseSnap.data().ratingCount || 0;
    const newRatingCount = currentCount + 1;
    const newAvgRating = (currentRating * currentCount + rating) / newRatingCount;
    await updateDoc(courseRef, {
      rating: newAvgRating,
      ratingCount: newRatingCount,
      updatedAt: serverTimestamp(),
    });
  }

  return { success: true, message: "Cảm ơn bạn đã đánh giá!", reviewId: reviewRef.id };
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
/**
 * src/services/reviewService.ts
 * Admin operations for reviews management
 */

import { db } from "../utils/config";
import { doc, updateDoc, deleteDoc, serverTimestamp } from "firebase/firestore";
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
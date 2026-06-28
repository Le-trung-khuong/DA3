// src/services/subscriptionService.ts
/**
 * Quản lý subscription tier của instructor
 */

import { db } from "../utils/config";
import { doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import type { SubscriptionTier } from "../types/chat";

/**
 * Kiểm tra user có subscription PRO không
 */
export async function isUserPro(userId: string): Promise<boolean> {
  const userRef = doc(db, "users", userId);
  const snap = await getDoc(userRef);
  if (!snap.exists()) return false;
  const data = snap.data();
  return data.subscriptionTier === "pro";
}

/**
 * Nâng cấp lên PRO (cho instructor)
 */
export async function upgradeToPro(userId: string, expiresAt?: Date): Promise<void> {
  const userRef = doc(db, "users", userId);
  await updateDoc(userRef, {
    subscriptionTier: "pro",
    subscriptionExpiresAt: expiresAt || null,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Hạ cấp xuống FREE
 */
export async function downgradeToFree(userId: string): Promise<void> {
  const userRef = doc(db, "users", userId);
  await updateDoc(userRef, {
    subscriptionTier: "free",
    subscriptionExpiresAt: null,
    updatedAt: serverTimestamp(),
  });
}
/**
 * src/services/adminService.ts
 * Tất cả admin write operations với Firestore (real)
 * FIX: Đã tắt revokeUserSessions để tránh lỗi CORS
 */

import { db, auth } from "../utils/config";
import {
  doc, collection, getDoc, getDocs, addDoc, updateDoc, deleteDoc,
  query, where, orderBy, limit, getCountFromServer,
  serverTimestamp, increment, writeBatch, Timestamp,collectionGroup,
} from "firebase/firestore";
import { sendPasswordResetEmail } from "firebase/auth";
import { getFunctions, httpsCallable } from "firebase/functions";

// ==================== TYPES ====================
export type UserRole   = "admin" | "moderator" | "instructor" | "user";
export type UserStatus = "active" | "banned" | "suspended";
export type TxStatus   = "completed" | "refunded" | "pending" | "failed";

export interface AdminActionResult {
  success: boolean;
  message: string;
}

export interface NotificationPayload {
  title: string;
  body: string;
  link?: string;
  type?: "info" | "success" | "warning" | "achievement";
}

// ==================== USER MANAGEMENT ====================

/**
 * Cập nhật XP (cộng/trừ) – dùng transaction để tránh race condition
 */
export async function updateUserXP(
  userId: string,
  delta: number,
  reason = "Admin adjustment"
): Promise<AdminActionResult> {
  const userRef = doc(db, "users", userId);
  const batch = writeBatch(db);
  batch.update(userRef, {
    totalXP: increment(delta),
    updatedAt: serverTimestamp(),
  });
  const logRef = doc(collection(db, "xp_logs"));
  batch.set(logRef, {
    userId,
    delta,
    reason,
    source: "admin",
    createdAt: serverTimestamp(),
  });
  await batch.commit();
  return { success: true, message: `XP ${delta > 0 ? "+" : ""}${delta} applied.` };
}

/**
 * Ban người dùng – ĐÃ TẮT revokeUserSessions để tránh CORS
 */
export async function banUser(
  userId: string,
  reason: string,
  permanent = false
): Promise<AdminActionResult> {
  const userRef = doc(db, "users", userId);
  await updateDoc(userRef, {
    status: "banned",
    bannedReason: reason,
    bannedAt: serverTimestamp(),
    bannedUntil: permanent ? null : Timestamp.fromDate(new Date(Date.now() + 30 * 86400000)),
  });
  
  // TẠM THỜI TẮT revokeUserSessions do chưa deploy Cloud Function với CORS đúng
  // TODO: Bật lại sau khi deploy function và cấu hình CORS
  /*
  try {
    const fn = httpsCallable(getFunctions(), "revokeUserSessions");
    await fn({ userId });
  } catch (e) {
    console.warn("revokeUserSessions failed (maybe not deployed)", e);
  }
  */
  
  return { success: true, message: `User banned${permanent ? " permanently" : " for 30 days"}.` };
}

/**
 * Gỡ ban / khôi phục user
 */
export async function restoreUser(userId: string): Promise<AdminActionResult> {
  const userRef = doc(db, "users", userId);
  await updateDoc(userRef, {
    status: "active",
    bannedReason: null,
    bannedAt: null,
    bannedUntil: null,
  });
  return { success: true, message: "User restored to active." };
}

/**
 * Thay đổi role
 */
export async function updateUserRole(userId: string, role: UserRole): Promise<AdminActionResult> {
  const userRef = doc(db, "users", userId);
  await updateDoc(userRef, { role, updatedAt: serverTimestamp() });
  return { success: true, message: `Role updated to "${role}".` };
}

/**
 * Gửi email reset password
 */
export async function sendResetPasswordEmail(email: string): Promise<AdminActionResult> {
  await sendPasswordResetEmail(auth, email);
  return { success: true, message: `Password reset email sent to ${email}.` };
}

/**
 * Cảnh báo user (tăng warningCount)
 */
export async function warnUser(userId: string, reason: string): Promise<AdminActionResult> {
  const userRef = doc(db, "users", userId);
  const batch = writeBatch(db);
  batch.update(userRef, { warningCount: increment(1), updatedAt: serverTimestamp() });
  const warningRef = doc(collection(db, "users", userId, "warnings"));
  batch.set(warningRef, { reason, createdAt: serverTimestamp() });
  await batch.commit();
  return { success: true, message: `Warning sent. Reason: "${reason}".` };
}

// ==================== COURSE MANAGEMENT ====================

export async function setCourseStatus(
  courseId: string,
  status: "published" | "draft" | "archived"
): Promise<AdminActionResult> {
  const courseRef = doc(db, "courses", courseId);
  const updateData: any = { status, updatedAt: serverTimestamp() };
  if (status === "published") updateData.publishedAt = serverTimestamp();
  await updateDoc(courseRef, updateData);
  return { success: true, message: `Course status → "${status}".` };
}

export async function deleteCourse(courseId: string): Promise<AdminActionResult> {
  const courseRef = doc(db, "courses", courseId);
  await updateDoc(courseRef, { status: "deleted", deletedAt: serverTimestamp() });
  return { success: true, message: "Course archived (soft delete)." };
}

export async function setFeaturedCourses(courseIds: string[]): Promise<AdminActionResult> {
  const batch = writeBatch(db);
  courseIds.forEach((id, idx) => {
    const ref = doc(db, "courses", id);
    batch.update(ref, { featuredOrder: idx });
  });
  await batch.commit();
  return { success: true, message: `${courseIds.length} courses featured.` };
}

// ==================== TRANSACTION / PAYMENT ====================

export async function refundTransaction(txId: string, reason: string): Promise<AdminActionResult> {
  const txRef = doc(db, "transactions", txId);
  await updateDoc(txRef, {
    status: "refunded",
    refundedAt: serverTimestamp(),
    refundReason: reason,
  });
  return { success: true, message: `Transaction ${txId} refunded.` };
}

export async function markTransactionPaid(txId: string): Promise<AdminActionResult> {
  const txRef = doc(db, "transactions", txId);
  await updateDoc(txRef, { status: "completed", paidAt: serverTimestamp() });
  return { success: true, message: "Transaction marked as paid." };
}

// ==================== NOTIFICATION ====================

export async function sendNotificationToUser(
  userId: string,
  payload: NotificationPayload
): Promise<AdminActionResult> {
  await addDoc(collection(db, "notifications"), {
    userId,
    ...payload,
    read: false,
    createdAt: serverTimestamp(),
  });
  
  // TẠM THỜI TẮT push notification do chưa deploy Cloud Function
  /*
  try {
    const fn = httpsCallable(getFunctions(), "sendPushNotification");
    await fn({ userId, ...payload });
  } catch (e) {
    console.warn("sendPushNotification failed (maybe not deployed)", e);
  }
  */
  
  return { success: true, message: `Notification sent to user ${userId}.` };
}

export async function broadcastNotification(
  payload: NotificationPayload,
  segment: "all" | "premium" | "free" = "all"
): Promise<AdminActionResult> {
  // TẠM THỜI TẮT broadcast do chưa deploy Cloud Function
  /*
  const fn = httpsCallable(getFunctions(), "adminBroadcastNotification");
  await fn({ ...payload, segment });
  */
  
  console.warn("Broadcast notification temporarily disabled (Cloud Function not deployed)");
  return { success: true, message: `Broadcast would be sent to "${segment}" segment. (Feature disabled)` };
}

// ==================== COMMUNITY ====================

export async function deleteChatMessage(roomId: string, msgId: string): Promise<AdminActionResult> {
  const msgRef = doc(db, "chat_rooms", roomId, "messages", msgId);
  await deleteDoc(msgRef);
  return { success: true, message: "Message deleted permanently." };
}

export async function dismissMessageReport(roomId: string, msgId: string): Promise<AdminActionResult> {
  const msgRef = doc(db, "chat_rooms", roomId, "messages", msgId);
  await updateDoc(msgRef, {
    isReported: false,
    reportReason: null,
    reportedBy: null,
    reportedAt: null,
  });
  return { success: true, message: "Report dismissed." };
}

export async function setRoomLocked(roomId: string, locked: boolean): Promise<AdminActionResult> {
  const roomRef = doc(db, "chat_rooms", roomId);
  await updateDoc(roomRef, { isLocked: locked, updatedAt: serverTimestamp() });
  return { success: true, message: `Room ${locked ? "locked" : "unlocked"}.` };
}

// ==================== ANALYTICS ====================

export interface DashboardStats {
  totalUsers: number;
  totalCourses: number;
  totalRevenue: number;
  totalEnrollments: number;
  reportedMessages: number;
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const [usersSnap, coursesSnap, txSnap] = await Promise.all([
    getCountFromServer(collection(db, "users")),
    getCountFromServer(collection(db, "courses")),
    getDocs(query(collection(db, "transactions"), where("status", "==", "completed"))),
  ]);
  const totalRevenue = txSnap.docs.reduce((sum, doc) => sum + (doc.data().amount || 0), 0);
  const reportedSnap = await getCountFromServer(
    query(collectionGroup(db, "messages"), where("isReported", "==", true))
  );
  return {
    totalUsers: usersSnap.data().count,
    totalCourses: coursesSnap.data().count,
    totalRevenue,
    totalEnrollments: 0,
    reportedMessages: reportedSnap.data().count,
  };
}

export async function getRevenueByMonth(): Promise<Array<{ month: string; revenue: number; count: number }>> {
  const txSnap = await getDocs(query(collection(db, "transactions"), where("status", "==", "completed")));
  const months: Record<string, { revenue: number; count: number }> = {};
  const now = new Date();
  for (let i = 0; i < 7; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = d.toLocaleString("default", { month: "short" });
    months[key] = { revenue: 0, count: 0 };
  }
  txSnap.docs.forEach((doc) => {
    const data = doc.data();
    const date = data.createdAt?.toDate();
    if (date) {
      const monthKey = date.toLocaleString("default", { month: "short" });
      if (months[monthKey]) {
        months[monthKey].revenue += data.amount || 0;
        months[monthKey].count += 1;
      }
    }
  });
  const result = Object.entries(months).map(([month, val]) => ({ month, ...val }));
  result.reverse();
  return result;
}
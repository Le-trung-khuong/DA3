/**
 * src/services/adminService.ts
 * ─────────────────────────────────────────────────────────────
 * Tập hợp tất cả admin write operations với Firestore.
 * Tách logic khỏi component — component chỉ gọi service, không gọi SDK trực tiếp.
 *
 * Tất cả hàm đều:
 *   - Throw FirebaseError nếu có lỗi (component tự catch)
 *   - Comment rõ Firestore path được ảnh hưởng
 *   - Có mock fallback cho development
 *
 * Categories:
 *   USER MANAGEMENT    – ban, warn, role, XP
 *   COURSE MANAGEMENT  – publish, archive, stats
 *   TRANSACTION        – refund, mark paid
 *   NOTIFICATION       – push to user(s)
 *   COMMUNITY          – delete message, warn in chat
 *   ANALYTICS          – read-only aggregations
 */

// ─── Firebase (uncomment in production) ────────────────────────────────────────
// import { db, auth } from "@/firebase/config";
// import {
//   doc, collection, getDoc, getDocs, setDoc, updateDoc, deleteDoc, addDoc,
//   query, where, orderBy, limit, getCountFromServer,
//   serverTimestamp, increment, writeBatch, Timestamp,
//   type DocumentReference,
// } from "firebase/firestore";
// import { getFunctions, httpsCallable } from "firebase/functions";

// ─── Types ─────────────────────────────────────────────────────────────────────

export type UserRole   = "admin" | "moderator" | "instructor" | "user";
export type UserStatus = "active" | "banned" | "suspended";
export type TxStatus   = "completed" | "refunded" | "pending" | "failed";

export interface AdminActionResult { success: boolean; message: string; }
export interface NotificationPayload {
  title:   string;
  body:    string;
  link?:   string;
  type?:   "info" | "success" | "warning" | "achievement";
}

// Simulated network delay for mock
const delay = (ms = 600) => new Promise((r) => setTimeout(r, ms));

// ═══════════════════════════════════════════════════════════════════════════════
// USER MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Cập nhật XP của user.
 * Firestore: users/{userId} → totalXP += delta
 *
 * @param userId   Firestore document ID
 * @param delta    Số XP thêm (dương) hoặc trừ (âm)
 * @param reason   Ghi chú lý do (lưu vào xp_logs)
 */
export async function updateUserXP(
  userId: string,
  delta: number,
  reason = "Admin adjustment",
): Promise<AdminActionResult> {
  // ── REAL FIREBASE ────────────────────────────────────────────────────────────
  // const batch = writeBatch(db);
  //
  // // 1. Cập nhật totalXP trên user document
  // batch.update(doc(db, "users", userId), {
  //   totalXP:     increment(delta),
  //   updatedAt:   serverTimestamp(),
  // });
  //
  // // 2. Ghi log vào xp_logs sub-collection
  // const logRef = doc(collection(db, "users", userId, "xp_logs"));
  // batch.set(logRef, {
  //   delta,
  //   reason,
  //   source:    "admin",
  //   createdAt: serverTimestamp(),
  // });
  //
  // await batch.commit();
  // ─────────────────────────────────────────────────────────────────────────────
  await delay();
  console.log(`[adminService] updateUserXP: user=${userId} delta=${delta} reason="${reason}"`);
  return { success: true, message: `XP ${delta > 0 ? "+" : ""}${delta} applied to user.` };
}

/**
 * Ban user.
 * Firestore: users/{userId} → status = "banned", bannedAt, bannedReason
 * Optionally revoke sessions via Firebase Auth Admin SDK (Cloud Function).
 */
export async function banUser(
  userId: string,
  reason: string,
  permanent = false,
): Promise<AdminActionResult> {
  // await updateDoc(doc(db, "users", userId), {
  //   status:     "banned",
  //   bannedReason: reason,
  //   bannedAt:   serverTimestamp(),
  //   bannedUntil: permanent ? null : Timestamp.fromDate(new Date(Date.now() + 1000 * 60 * 60 * 24 * 30)),
  // });
  // // Revoke refresh tokens (requires Cloud Function / Admin SDK)
  // const fn = httpsCallable(getFunctions(), "revokeUserSessions");
  // await fn({ userId });
  await delay();
  console.log(`[adminService] banUser: ${userId}`, { reason, permanent });
  return { success: true, message: `User banned${permanent ? " permanently" : " for 30 days"}.` };
}

/** Suspend user (temporary, lighter than ban). */
export async function suspendUser(userId: string, reason: string): Promise<AdminActionResult> {
  // await updateDoc(doc(db, "users", userId), { status: "suspended", suspendReason: reason, suspendedAt: serverTimestamp() });
  await delay();
  return { success: true, message: "User suspended." };
}

/** Restore user to active. */
export async function restoreUser(userId: string): Promise<AdminActionResult> {
  // await updateDoc(doc(db, "users", userId), { status: "active", bannedReason: null, bannedAt: null, bannedUntil: null });
  await delay();
  return { success: true, message: "User restored to active." };
}

/** Thay đổi role. */
export async function updateUserRole(userId: string, role: UserRole): Promise<AdminActionResult> {
  // await updateDoc(doc(db, "users", userId), { role, updatedAt: serverTimestamp() });
  await delay();
  return { success: true, message: `Role updated to "${role}".` };
}

/** Thêm warning count. Firestore: users/{userId} → warningCount += 1. */
export async function warnUser(userId: string, reason: string): Promise<AdminActionResult> {
  // const batch = writeBatch(db);
  // batch.update(doc(db, "users", userId), { warningCount: increment(1), updatedAt: serverTimestamp() });
  // batch.set(doc(collection(db, "users", userId, "warnings")), { reason, createdAt: serverTimestamp() });
  // await batch.commit();
  await delay(400);
  return { success: true, message: `Warning sent. Reason: "${reason}".` };
}

// ═══════════════════════════════════════════════════════════════════════════════
// COURSE MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════════

/** Publish / Unpublish khoá học. */
export async function setCourseStatus(
  courseId: string,
  status: "published" | "draft" | "archived",
): Promise<AdminActionResult> {
  // await updateDoc(doc(db, "courses", courseId), {
  //   status,
  //   ...(status === "published" ? { publishedAt: serverTimestamp() } : {}),
  //   updatedAt: serverTimestamp(),
  // });
  await delay();
  return { success: true, message: `Course status → "${status}".` };
}

/** Xoá khoá học (soft delete). */
export async function deleteCourse(courseId: string): Promise<AdminActionResult> {
  // await updateDoc(doc(db, "courses", courseId), { status: "deleted", deletedAt: serverTimestamp() });
  await delay();
  return { success: true, message: "Course archived (soft delete)." };
}

/** Cập nhật thứ tự featured courses. */
export async function setFeaturedCourses(courseIds: string[]): Promise<AdminActionResult> {
  // const batch = writeBatch(db);
  // courseIds.forEach((id, idx) => batch.update(doc(db, "courses", id), { featuredOrder: idx }));
  // await batch.commit();
  await delay();
  return { success: true, message: `${courseIds.length} courses featured.` };
}

// ═══════════════════════════════════════════════════════════════════════════════
// TRANSACTION / PAYMENT
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Refund giao dịch.
 * Firestore: transactions/{txId} → status = "refunded"
 * Thực tế cần gọi Payment Gateway API → dùng Cloud Function.
 */
export async function refundTransaction(
  txId:   string,
  reason: string,
): Promise<AdminActionResult> {
  // // Cloud Function xử lý refund gateway + Firestore update
  // const fn = httpsCallable(getFunctions(), "adminRefundTransaction");
  // await fn({ txId, reason });
  //
  // Hoặc chỉ cập nhật status nếu refund đã được xử lý ngoài hệ thống:
  // await updateDoc(doc(db, "transactions", txId), {
  //   status:     "refunded",
  //   refundedAt: serverTimestamp(),
  //   refundReason: reason,
  // });
  await delay(900);
  console.log(`[adminService] refundTransaction: tx=${txId} reason="${reason}"`);
  return { success: true, message: `Transaction ${txId} refunded.` };
}

/** Đánh dấu giao dịch đã thanh toán (manual). */
export async function markTransactionPaid(txId: string): Promise<AdminActionResult> {
  // await updateDoc(doc(db, "transactions", txId), { status: "completed", paidAt: serverTimestamp() });
  await delay();
  return { success: true, message: "Transaction marked as paid." };
}

// ═══════════════════════════════════════════════════════════════════════════════
// NOTIFICATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Gửi notification đến 1 user.
 * Firestore: notifications/{autoId} + (optionally) FCM via Cloud Function.
 */
export async function sendNotificationToUser(
  userId:  string,
  payload: NotificationPayload,
): Promise<AdminActionResult> {
  // await addDoc(collection(db, "notifications"), {
  //   userId,
  //   ...payload,
  //   read:      false,
  //   createdAt: serverTimestamp(),
  // });
  // // FCM push (optional – requires Cloud Function)
  // const fn = httpsCallable(getFunctions(), "sendPushNotification");
  // await fn({ userId, ...payload });
  await delay(500);
  console.log(`[adminService] sendNotification → user=${userId}`, payload);
  return { success: true, message: `Notification sent to user ${userId}.` };
}

/**
 * Gửi broadcast đến tất cả users (hoặc theo segment).
 * Production: nên dùng Cloud Function để tránh quota limits.
 */
export async function broadcastNotification(
  payload:   NotificationPayload,
  segment?: "all" | "premium" | "free",
): Promise<AdminActionResult> {
  // const fn = httpsCallable(getFunctions(), "adminBroadcastNotification");
  // await fn({ ...payload, segment: segment ?? "all" });
  await delay(800);
  console.log(`[adminService] broadcastNotification segment=${segment ?? "all"}`, payload);
  return { success: true, message: `Broadcast sent to "${segment ?? "all"}" segment.` };
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMMUNITY
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Xoá tin nhắn vĩnh viễn khỏi Firestore.
 * Firestore: chat_rooms/{roomId}/messages/{msgId} → deleteDoc
 */
export async function deleteChatMessage(roomId: string, msgId: string): Promise<AdminActionResult> {
  // await deleteDoc(doc(db, "chat_rooms", roomId, "messages", msgId));
  await delay(500);
  return { success: true, message: "Message deleted permanently." };
}

/**
 * Xoá report flag khỏi message (dismiss).
 * Firestore: chat_rooms/{roomId}/messages/{msgId} → isReported = false
 */
export async function dismissMessageReport(roomId: string, msgId: string): Promise<AdminActionResult> {
  // await updateDoc(doc(db, "chat_rooms", roomId, "messages", msgId), {
  //   isReported:   false,
  //   reportReason: null,
  //   reportedBy:   null,
  //   reportedAt:   null,
  // });
  await delay(400);
  return { success: true, message: "Report dismissed." };
}

/** Lock / Unlock chat room. */
export async function setRoomLocked(roomId: string, locked: boolean): Promise<AdminActionResult> {
  // await updateDoc(doc(db, "chat_rooms", roomId), { isLocked: locked, updatedAt: serverTimestamp() });
  await delay();
  return { success: true, message: `Room ${locked ? "locked" : "unlocked"}.` };
}

// ═══════════════════════════════════════════════════════════════════════════════
// ANALYTICS (read-only aggregations)
// ═══════════════════════════════════════════════════════════════════════════════

export interface DashboardStats {
  totalUsers:       number;
  totalCourses:     number;
  totalRevenue:     number;
  totalEnrollments: number;
  reportedMessages: number;
}

/**
 * Lấy snapshot aggregation cho dashboard.
 * Production: dùng getCountFromServer hoặc lưu vào document "stats/global".
 */
export async function getDashboardStats(): Promise<DashboardStats> {
  // ── REAL FIREBASE ────────────────────────────────────────────────────────────
  // const [usersSnap, coursesSnap, txSnap] = await Promise.all([
  //   getCountFromServer(collection(db, "users")),
  //   getCountFromServer(collection(db, "courses")),
  //   getDocs(query(collection(db, "transactions"), where("status","==","completed"))),
  // ]);
  // const totalRevenue = txSnap.docs.reduce((s, d) => s + (d.data().amount ?? 0), 0);
  // return {
  //   totalUsers:       usersSnap.data().count,
  //   totalCourses:     coursesSnap.data().count,
  //   totalRevenue,
  //   totalEnrollments: 0,  // add similar
  //   reportedMessages: 0,
  // };
  // ─────────────────────────────────────────────────────────────────────────────
  await delay(700);
  return { totalUsers: 12_847, totalCourses: 64, totalRevenue: 284_300_000, totalEnrollments: 38_920, reportedMessages: 7 };
}

/**
 * Lấy doanh thu theo tháng (7 tháng gần nhất).
 * Production: query transactions group-by month, hoặc đọc từ pre-aggregated doc.
 */
export async function getRevenueByMonth(): Promise<Array<{ month: string; revenue: number; count: number }>> {
  await delay(600);
  return [
    { month: "Oct", revenue: 32_000_000, count: 89  },
    { month: "Nov", revenue: 41_500_000, count: 112 },
    { month: "Dec", revenue: 55_200_000, count: 148 },
    { month: "Jan", revenue: 38_900_000, count: 103 },
    { month: "Feb", revenue: 47_300_000, count: 127 },
    { month: "Mar", revenue: 61_800_000, count: 162 },
    { month: "Apr", revenue: 72_100_000, count: 189 },
  ];
}

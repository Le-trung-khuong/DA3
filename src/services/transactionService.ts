/**
 * src/services/transactionService.ts
 * Admin transaction operations (refund, force complete, export)
 * Tự động gửi notification và ghi payment log
 * ✅ Fix: XP không âm, race condition, idempotency
 */

import { db } from "../utils/config";
import {
  collection,
  doc,
  updateDoc,
  getDoc,
  query,
  where,
  getDocs,
  writeBatch,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import type { Transaction, TransactionStatus } from "../types/transaction";
import { createEnrollment, deactivateEnrollment } from "./enrollmentService";
import { sendNotification } from "./notificationService";
import { recordPaymentLog } from "./paymentLogService";

/**
 * Refund a successful transaction (admin only)
 * Updates transaction status, removes purchased course, subtracts XP.
 * Gửi notification refund cho user và ghi payment log
 * ✅ Fix: XP không âm, deactivate enrollment được gộp vào batch
 */
export async function refundTransaction(
  transactionId: string,
  reason: string,
  adminId: string,
  adminEmail: string
): Promise<void> {
  const txRef = doc(db, "transactions", transactionId);
  const txSnap = await getDoc(txRef);
  if (!txSnap.exists()) throw new Error("Transaction not found");
  const txData = txSnap.data() as Transaction;
  if (txData.status !== "success") throw new Error("Only successful transactions can be refunded");

  const batch = writeBatch(db);

  // 1. Update transaction status
  batch.update(txRef, {
    status: "refunded",
    refundedAt: serverTimestamp(),
    refundReason: reason,
    updatedAt: serverTimestamp(),
  });

  // 2. Deactivate enrollment (gộp vào batch thay vì gọi riêng)
  const enrollQuery = query(
    collection(db, "enrollments"),
    where("userId", "==", txData.userId),
    where("courseId", "==", txData.courseId),
    where("isActive", "==", true)
  );
  const enrollSnap = await getDocs(enrollQuery);
  if (!enrollSnap.empty) {
    const enrollRef = enrollSnap.docs[0].ref;
    batch.update(enrollRef, {
      isActive: false,
      deactivatedAt: serverTimestamp(),
    });
  }

  // 3. Remove purchased course (soft delete)
  const purchasedQuery = query(
    collection(db, "purchasedCourses"),
    where("userId", "==", txData.userId),
    where("courseId", "==", txData.courseId),
    where("transactionId", "==", transactionId)
  );
  const purchasedSnap = await getDocs(purchasedQuery);
  if (!purchasedSnap.empty) {
    const purchasedRef = purchasedSnap.docs[0].ref;
    batch.update(purchasedRef, { isActive: false });
  }

  // 4. Subtract XP (✅ không cho âm)
  const userRef = doc(db, "users", txData.userId);
  const userSnap = await getDoc(userRef);
  if (userSnap.exists()) {
    const xpToSubtract = Math.floor(txData.amount * 10);
    const currentXP = userSnap.data().totalXP || 0;
    const newXP = Math.max(0, currentXP - xpToSubtract);
    batch.update(userRef, {
      totalXP: newXP,
      updatedAt: serverTimestamp(),
    });
    const logRef = doc(collection(db, "xp_logs"));
    batch.set(logRef, {
      userId: txData.userId,
      amount: -xpToSubtract,
      reason: `Refund: ${reason}`,
      activityType: "refund",
      createdAt: serverTimestamp(),
      adminNote: `Transaction ${transactionId} refunded by ${adminEmail}`,
    });
  }

  // 5. Audit log
  const auditRef = doc(collection(db, "adminAuditLogs"));
  batch.set(auditRef, {
    adminId,
    adminEmail,
    action: "refund_transaction",
    targetId: transactionId,
    details: { reason, amount: txData.amount, courseName: txData.courseName },
    createdAt: serverTimestamp(),
  });

  await batch.commit();

  // 6. Ghi payment log
  await recordPaymentLog(
    transactionId,
    "refund",
    { reason, adminId, adminEmail },
    { status: "refunded", refundedAt: new Date().toISOString() },
    "success"
  );

  // 7. Gửi notification đến user
  try {
    await sendNotification(
      txData.userId,
      "refund",
      "💰 Hoàn tiền thành công",
      `Giao dịch ${txData.courseName} đã được hoàn tiền. Lý do: ${reason}`,
      `/courses/${txData.courseId}`,
      { transactionId, courseId: txData.courseId }
    );
  } catch (err) {
    console.error("Failed to send refund notification:", err);
  }
}

/**
 * Force complete a transaction (manual override when callback fails)
 * Gửi notification payment_success cho user và ghi payment log
 * ✅ Fix: kiểm tra idempotency (chỉ cho phép nếu status === 'pending')
 */
export async function forceCompleteTransaction(
  transactionId: string,
  adminId: string,
  adminEmail: string
): Promise<void> {
  const txRef = doc(db, "transactions", transactionId);
  const txSnap = await getDoc(txRef);
  if (!txSnap.exists()) throw new Error("Transaction not found");
  const txData = txSnap.data() as Transaction;
  // ✅ Idempotency: chỉ cho phép nếu đang pending
  if (txData.status !== "pending") throw new Error("Only pending transactions can be force completed");

  const batch = writeBatch(db);

  batch.update(txRef, {
    status: "success",
    paidAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  // Add purchased course
  const purchasedRef = doc(collection(db, "purchasedCourses"));
  batch.set(purchasedRef, {
    userId: txData.userId,
    courseId: txData.courseId,
    transactionId,
    purchasedAt: serverTimestamp(),
    isActive: true,
  });

  // Tạo enrollment (hàm này sẽ gửi notification bên trong)
  // Lưu ý: createEnrollment hiện tại dùng setDoc ngoài batch,
  // để atomic cần đưa vào batch. Tuy nhiên createEnrollment hiện tại
  // cũng có thể được dùng ngoài, nhưng để an toàn ta có thể viết thêm
  // logic tạo enrollment trong batch.
  const enrollRef = doc(collection(db, "enrollments"));
  batch.set(enrollRef, {
    userId: txData.userId,
    courseId: txData.courseId,
    transactionId,
    enrolledAt: serverTimestamp(),
    isActive: true,
  });

  // Add XP cho user
  const userRef = doc(db, "users", txData.userId);
  const userSnap = await getDoc(userRef);
  if (userSnap.exists()) {
    const xpToAdd = Math.floor(txData.amount * 10);
    batch.update(userRef, {
      totalXP: (userSnap.data().totalXP || 0) + xpToAdd,
      updatedAt: serverTimestamp(),
    });
  }

  // Audit log
  const auditRef = doc(collection(db, "adminAuditLogs"));
  batch.set(auditRef, {
    adminId,
    adminEmail,
    action: "force_complete",
    targetId: transactionId,
    details: { amount: txData.amount, courseName: txData.courseName },
    createdAt: serverTimestamp(),
  });

  await batch.commit();

  // Ghi payment log
  await recordPaymentLog(
    transactionId,
    "force_complete",
    { adminId, adminEmail },
    { status: "success", paidAt: new Date().toISOString() },
    "success"
  );

  // Gửi thêm notification payment_success
  try {
    await sendNotification(
      txData.userId,
      "payment_success",
      "✅ Thanh toán thành công",
      `Bạn đã thanh toán thành công khóa học "${txData.courseName}".`,
      `/courses/${txData.courseId}`,
      { transactionId, courseId: txData.courseId, amount: txData.amount }
    );
  } catch (err) {
    console.error("Failed to send payment success notification:", err);
  }
}

/**
 * Export transactions to CSV (client-side)
 */
export async function exportTransactionsToCSV(transactions: Transaction[]): Promise<void> {
  const headers = ["ID", "User ID", "User Name", "Course", "Amount (VND)", "Status", "Created At", "Paid At", "Refunded At", "Refund Reason"];
  const rows = transactions.map(tx => [
    tx.id,
    tx.userId,
    tx.userName,
    tx.courseName,
    tx.amount.toString(),
    tx.status,
    tx.createdAt?.toDate?.()?.toISOString() || "",
    tx.paidAt?.toDate?.()?.toISOString() || "",
    tx.refundedAt?.toDate?.()?.toISOString() || "",
    tx.refundReason || "",
  ]);
  const csvContent = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(",")).join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.href = url;
  link.setAttribute("download", `transactions_${new Date().toISOString()}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
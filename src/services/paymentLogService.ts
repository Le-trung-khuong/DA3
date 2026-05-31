/**
 * src/services/paymentLogService.ts
 * Ghi và truy xuất payment logs (cho mỗi transaction)
 */

import { db } from "../utils/config";
import {
  collection,
  addDoc,
  query,
  where,
  orderBy,
  getDocs,
  serverTimestamp,
  Timestamp,
  limit,
} from "firebase/firestore";
import type { PaymentLog } from "../types/transaction";

/**
 * Ghi một payment log
 */
export async function recordPaymentLog(
  transactionId: string,
  action: PaymentLog["action"],
  requestData: any,
  responseData: any,
  status: "success" | "failed",
  errorCode?: number,
  errorMessage?: string
): Promise<string> {
  const logData: Omit<PaymentLog, "id"> = {
    transactionId,
    action,
    requestData: requestData || null,
    responseData: responseData || null,
    status,
    createdAt: serverTimestamp() as Timestamp,
  };
  if (errorCode !== undefined) (logData as any).errorCode = errorCode;
  if (errorMessage) (logData as any).errorMessage = errorMessage;

  const docRef = await addDoc(collection(db, "paymentLogs"), logData);
  return docRef.id;
}

/**
 * Lấy tất cả payment logs của một transaction (sắp xếp mới nhất trước)
 */
export async function getTransactionLogs(
  transactionId: string,
  limitCount = 50
): Promise<PaymentLog[]> {
  const q = query(
    collection(db, "paymentLogs"),
    where("transactionId", "==", transactionId),
    orderBy("createdAt", "desc"),
    limit(limitCount)
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      transactionId: data.transactionId,
      action: data.action,
      requestData: data.requestData,
      responseData: data.responseData,
      status: data.status,
      createdAt: data.createdAt,
      errorCode: data.errorCode,
      errorMessage: data.errorMessage,
    } as PaymentLog;
  });
}

/**
 * Lấy admin audit logs liên quan đến transaction (từ collection adminAuditLogs)
 */
export async function getTransactionAdminLogs(
  transactionId: string
): Promise<any[]> {
  const q = query(
    collection(db, "adminAuditLogs"),
    where("targetId", "==", transactionId),
    orderBy("createdAt", "desc")
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

/**
 * Xóa logs cũ hơn N ngày (chạy định kỳ)
 */
export async function deleteOldLogs(daysOld = 90): Promise<void> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - daysOld);
  const cutoffTimestamp = Timestamp.fromDate(cutoff);

  const q = query(
    collection(db, "paymentLogs"),
    where("createdAt", "<=", cutoffTimestamp),
    orderBy("createdAt", "desc")
  );
  const snapshot = await getDocs(q);
  const batch = db.batch();
  snapshot.forEach((doc) => batch.delete(doc.ref));
  await batch.commit();
}
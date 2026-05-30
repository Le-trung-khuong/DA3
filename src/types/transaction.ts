/**
 * src/types/transaction.ts
 * Types for transaction, payment, and admin audit logs
 */

import { Timestamp } from "firebase/firestore";

export type TransactionStatus = "pending" | "processing" | "success" | "failed" | "refunded" | "cancelled";
export type PaymentMethod = "zalopay" | "credit_card" | "paypal";

export interface Transaction {
  id: string;
  orderId: string;           // mã đơn hàng từ ZaloPay
  appTransId: string;        // mã giao dịch nội bộ (do bạn sinh)
  userId: string;
  userEmail: string;
  userName: string;
  courseId: string;
  courseName: string;
  amount: number;            // VND
  status: TransactionStatus;
  paymentMethod: PaymentMethod;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  paidAt?: Timestamp | null;
  refundedAt?: Timestamp | null;
  refundReason?: string;
  zpTransId?: string;        // mã từ ZaloPay callback
  channel?: "qr" | "app";
  errorCode?: number;
  errorMessage?: string;
}

export interface PurchasedCourse {
  id: string;
  userId: string;
  courseId: string;
  transactionId: string;
  purchasedAt: Timestamp;
  expiresAt?: Timestamp | null;
  isActive: boolean;
}

export interface PaymentLog {
  id: string;
  transactionId: string;
  action: "callback" | "query" | "refund";
  requestData: any;
  responseData: any;
  status: "success" | "failed";
  createdAt: Timestamp;
}

export interface AdminAuditLog {
  id: string;
  adminId: string;
  adminEmail: string;
  action: "refund_transaction" | "force_complete" | "broadcast_notification" | "ban_user" | "edit_course";
  targetId?: string;
  details: any;
  ipAddress?: string;
  createdAt: Timestamp;
}
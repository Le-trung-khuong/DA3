/**
 * src/types/notification.ts
 * Types for realtime notifications
 */

import { Timestamp } from "firebase/firestore";

export type NotificationType = "payment_success" | "payment_failed" | "refund" | "admin_warning" | "system";

export interface Notification {
  id: string;
  userId: string;            // nếu "all" thì là broadcast
  type: NotificationType;
  title: string;
  body: string;
  link?: string;
  isRead: boolean;
  createdAt: Timestamp;
  metadata?: {
    transactionId?: string;
    courseId?: string;
    warningCount?: number;
  };
}
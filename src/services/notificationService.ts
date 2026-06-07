/**
 * src/services/notificationService.ts
 * Core notification operations: send, broadcast, mark as read, delete
 * Uses Firestore as realtime store
 */

import { db } from "../utils/config";
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  getDocs,
  serverTimestamp,
  Timestamp,
  limit,
  writeBatch,
  onSnapshot,
} from "firebase/firestore";
import type { Notification, NotificationType } from "../types/notification";

// ============ SEND NOTIFICATION TO SINGLE USER ============

/**
 * Gửi notification đến một user cụ thể
 * @param userId - ID của người nhận (hoặc "all" cho broadcast)
 * @param type - Loại thông báo (payment_success, refund, course_enrolled, ...)
 * @param title - Tiêu đề thông báo
 * @param body - Nội dung thông báo
 * @param link - Đường dẫn khi click vào thông báo (tuỳ chọn)
 * @param metadata - Dữ liệu bổ sung (transactionId, courseId, ...)
 * @returns ID của document notification vừa tạo
 */
export async function sendNotification(
  userId: string,
  type: NotificationType,
  title: string,
  body: string,
  link?: string,
  metadata?: Record<string, any>
): Promise<string> {
  const notificationData = {
    userId,
    type,
    title,
    body,
    link: link || null,
    isRead: false,
    createdAt: serverTimestamp(),
    metadata: metadata || {},
  };
  const docRef = await addDoc(collection(db, "notifications"), notificationData);
  return docRef.id;
}

// ============ BROADCAST TO ALL USERS ============

/**
 * Gửi notification đến TẤT CẢ user (userId = "all")
 * Client sẽ filter để hiển thị (userId === currentUser.uid || userId === "all")
 * @param type - Loại thông báo
 * @param title - Tiêu đề thông báo
 * @param body - Nội dung thông báo
 * @param link - Đường dẫn khi click
 * @param metadata - Dữ liệu bổ sung
 */
export async function broadcastNotification(
  type: NotificationType,
  title: string,
  body: string,
  link?: string,
  metadata?: Record<string, any>
): Promise<string> {
  return sendNotification("all", type, title, body, link, metadata);
}

// ============ MARK AS READ ============

/**
 * Đánh dấu một notification là đã đọc
 * @param notificationId - ID của notification cần đánh dấu
 */
export async function markNotificationAsRead(notificationId: string): Promise<void> {
  const notifRef = doc(db, "notifications", notificationId);
  await updateDoc(notifRef, { isRead: true });
}

/**
 * Đánh dấu tất cả notification của user là đã đọc
 * @param userId - ID của user hiện tại
 */
export async function markAllNotificationsAsRead(userId: string): Promise<void> {
  // Lấy tất cả notification chưa đọc của user này (bao gồm broadcast)
  const q = query(
    collection(db, "notifications"),
    where("userId", "in", [userId, "all"]),
    where("isRead", "==", false)
  );
  const snapshot = await getDocs(q);
  
  if (snapshot.empty) return;
  
  const batch = writeBatch(db);
  snapshot.forEach((doc) => {
    batch.update(doc.ref, { isRead: true });
  });
  await batch.commit();
}

// ============ DELETE NOTIFICATION ============

/**
 * Xóa notification (thường chỉ dùng cho admin)
 * @param notificationId - ID của notification cần xóa
 */
export async function deleteNotification(notificationId: string): Promise<void> {
  await deleteDoc(doc(db, "notifications", notificationId));
}

/**
 * Xóa tất cả notification cũ hơn ngày chỉ định (cleanup cho admin)
 * @param daysOld - Số ngày, mặc định 90 ngày
 */
export async function deleteOldNotifications(daysOld = 90): Promise<void> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);
  const cutoffTimestamp = Timestamp.fromDate(cutoffDate);
  
  const q = query(
    collection(db, "notifications"),
    where("createdAt", "<=", cutoffTimestamp),
    orderBy("createdAt", "desc")
  );
  const snapshot = await getDocs(q);
  
  if (snapshot.empty) return;
  
  const batch = writeBatch(db);
  snapshot.forEach((doc) => {
    batch.delete(doc.ref);
  });
  await batch.commit();
}

// ============ GET NOTIFICATIONS (non-realtime, dùng cho page) ============

/**
 * Lấy danh sách notification của user (dùng cho page, không realtime)
 * @param userId - ID của user
 * @param limitCount - Số lượng tối đa, mặc định 50
 * @param beforeDate - Lấy các notification cũ hơn ngày này (dùng cho pagination)
 * @returns Mảng notification
 */
export async function getUserNotifications(
  userId: string,
  limitCount = 50,
  beforeDate?: Date
): Promise<Notification[]> {
  let constraints: any[] = [
    where("userId", "in", [userId, "all"]),
    orderBy("createdAt", "desc"),
    limit(limitCount),
  ];
  
  if (beforeDate) {
    constraints = [
      where("userId", "in", [userId, "all"]),
      where("createdAt", "<=", Timestamp.fromDate(beforeDate)),
      orderBy("createdAt", "desc"),
      limit(limitCount),
    ];
  }
  
  const q = query(collection(db, "notifications"), ...constraints);
  const snapshot = await getDocs(q);
  
  return snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      userId: data.userId,
      type: data.type,
      title: data.title,
      body: data.body,
      link: data.link,
      isRead: data.isRead,
      createdAt: data.createdAt,
      metadata: data.metadata,
    } as Notification;
  });
}

/**
 * Lấy danh sách tất cả notification (chỉ dành cho admin)
 * @param limitCount - Số lượng tối đa
 */
export async function getAllNotifications(limitCount = 100): Promise<Notification[]> {
  const q = query(
    collection(db, "notifications"),
    orderBy("createdAt", "desc"),
    limit(limitCount)
  );
  const snapshot = await getDocs(q);
  
  return snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      userId: data.userId,
      type: data.type,
      title: data.title,
      body: data.body,
      link: data.link,
      isRead: data.isRead,
      createdAt: data.createdAt,
      metadata: data.metadata,
    } as Notification;
  });
}

// ============ COUNT UNREAD NOTIFICATIONS ============

/**
 * Đếm số notification chưa đọc của user (dùng cho badge)
 * @param userId - ID của user
 * @returns Số lượng notification chưa đọc
 */
export async function countUnreadNotifications(userId: string): Promise<number> {
  const q = query(
    collection(db, "notifications"),
    where("userId", "in", [userId, "all"]),
    where("isRead", "==", false)
  );
  const snapshot = await getDocs(q);
  return snapshot.size;
}

// ============ HELPER: GET UNREAD COUNT (REALTIME) ============
// Lưu ý: Hàm này trả về unsubscribe function, dùng trong hook

/**
 * Lắng nghe realtime số lượng notification chưa đọc
 * @param userId - ID của user
 * @param callback - Hàm nhận số lượng chưa đọc
 * @returns Unsubscribe function
 */
export function subscribeToUnreadCount(
  userId: string,
  callback: (unreadCount: number) => void
): () => void {
  const q = query(
    collection(db, "notifications"),
    where("userId", "in", [userId, "all"]),
    where("isRead", "==", false)
  );
  
  const unsubscribe = onSnapshot(q, (snapshot) => {
    callback(snapshot.size);
  });
  
  return unsubscribe;
}
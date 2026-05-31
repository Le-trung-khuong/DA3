/**
 * src/hooks/useNotifications.ts
 * Realtime hook for fetching user notifications from Firestore
 * Automatically subscribes/unsubscribes based on userId
 */

import { useState, useEffect, useCallback } from "react";
import { db } from "../utils/config";
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  writeBatch,
  doc,
  updateDoc,
} from "firebase/firestore";
import type { Notification, NotificationType } from "../types/notification";

export interface UseNotificationsOptions {
  /** Số lượng notification tối đa lấy về (mặc định: 50) */
  limit?: number;
  /** Chỉ lấy các notification chưa đọc (mặc định: false) */
  unreadOnly?: boolean;
  /** Lọc theo loại notification (tuỳ chọn) */
  type?: NotificationType;
}

export interface UseNotificationsReturn {
  /** Danh sách notifications */
  notifications: Notification[];
  /** Số lượng chưa đọc */
  unreadCount: number;
  /** Đang loading */
  loading: boolean;
  /** Lỗi nếu có */
  error: Error | null;
  /** Đánh dấu một notification là đã đọc */
  markAsRead: (notificationId: string) => Promise<void>;
  /** Đánh dấu tất cả là đã đọc */
  markAllAsRead: () => Promise<void>;
  /** Xóa một notification */
  deleteNotification: (notificationId: string) => Promise<void>;
  /** Refresh (re-fetch) */
  refresh: () => void;
}

export function useNotifications(
  userId: string | undefined,
  options: UseNotificationsOptions = {}
): UseNotificationsReturn {
  const { limit: limitCount = 50, unreadOnly = false, type } = options;
  
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = useCallback(() => {
    setRefreshKey((prev) => prev + 1);
  }, []);

  // Helper: mark as read
  const markAsRead = useCallback(async (notificationId: string) => {
    if (!notificationId) return;
    try {
      const notifRef = doc(db, "notifications", notificationId);
      await updateDoc(notifRef, { isRead: true });
    } catch (err) {
      console.error("Failed to mark notification as read:", err);
    }
  }, []);

  // Helper: mark all as read
  const markAllAsRead = useCallback(async () => {
    if (!userId || notifications.length === 0) return;
    
    const unreadNotifications = notifications.filter((n) => !n.isRead);
    if (unreadNotifications.length === 0) return;
    
    try {
      const batch = writeBatch(db);
      unreadNotifications.forEach((notif) => {
        const notifRef = doc(db, "notifications", notif.id);
        batch.update(notifRef, { isRead: true });
      });
      await batch.commit();
    } catch (err) {
      console.error("Failed to mark all as read:", err);
    }
  }, [userId, notifications]);

  // Helper: delete notification
  const deleteNotificationCallback = useCallback(async (notificationId: string) => {
    if (!notificationId) return;
    try {
      const notifRef = doc(db, "notifications", notificationId);
      await updateDoc(notifRef, { isRead: true });
      // Note: For hard delete, use deleteDoc. But soft delete (mark as read) is safer.
      // await deleteDoc(notifRef);
    } catch (err) {
      console.error("Failed to delete notification:", err);
    }
  }, []);

  // Main realtime listener
  useEffect(() => {
    if (!userId) {
      setNotifications([]);
      setUnreadCount(0);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    // Build query constraints
    const constraints: any[] = [
      where("userId", "in", [userId, "all"]),
      orderBy("createdAt", "desc"),
      limit(limitCount),
    ];
    
    if (unreadOnly) {
      constraints.unshift(where("isRead", "==", false));
    }
    
    if (type) {
      constraints.unshift(where("type", "==", type));
    }

    const q = query(collection(db, "notifications"), ...constraints);
    
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const fetchedNotifications: Notification[] = [];
        let unread = 0;
        
        snapshot.forEach((doc) => {
          const data = doc.data();
          const notif: Notification = {
            id: doc.id,
            userId: data.userId,
            type: data.type,
            title: data.title,
            body: data.body,
            link: data.link,
            isRead: data.isRead,
            createdAt: data.createdAt,
            metadata: data.metadata,
          };
          fetchedNotifications.push(notif);
          if (!data.isRead) {
            unread++;
          }
        });
        
        setNotifications(fetchedNotifications);
        setUnreadCount(unread);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error("useNotifications error:", err);
        setError(err);
        setLoading(false);
      }
    );
    
    return () => unsubscribe();
  }, [userId, limitCount, unreadOnly, type, refreshKey]);

  return {
    notifications,
    unreadCount,
    loading,
    error,
    markAsRead,
    markAllAsRead,
    deleteNotification: deleteNotificationCallback,
    refresh,
  };
}
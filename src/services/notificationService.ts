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
  getDoc, // ✅ THÊM getDoc VÀO IMPORT
  serverTimestamp,
  Timestamp,
  limit,
  writeBatch,
  onSnapshot,
  increment,
} from "firebase/firestore";
import type { Notification, NotificationType } from "../types/notification";

// ============ SEND NOTIFICATION ============

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

  if (userId !== "all") {
    const userRef = doc(db, "users", userId);
    await updateDoc(userRef, {
      unreadCount: increment(1),
      updatedAt: serverTimestamp(),
    });
  }

  return docRef.id;
}

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

export async function markNotificationAsRead(notificationId: string): Promise<void> {
  const notifRef = doc(db, "notifications", notificationId);
  const notifSnap = await getDoc(notifRef); // ✅ getDoc đã được import

  if (notifSnap.exists()) {
    const data = notifSnap.data();
    if (!data.isRead) {
      await updateDoc(notifRef, { isRead: true });

      if (data.userId && data.userId !== "all") {
        const userRef = doc(db, "users", data.userId);
        await updateDoc(userRef, {
          unreadCount: increment(-1),
        });
      }
    }
  }
}

export async function markAllNotificationsAsRead(userId: string): Promise<void> {
  const q = query(
    collection(db, "notifications"),
    where("userId", "in", [userId, "all"]),
    where("isRead", "==", false)
  );
  const snapshot = await getDocs(q);

  if (snapshot.empty) return;

  const BATCH_SIZE = 400;
  const docs = snapshot.docs;

  for (let i = 0; i < docs.length; i += BATCH_SIZE) {
    const chunk = docs.slice(i, i + BATCH_SIZE);
    const batch = writeBatch(db);
    chunk.forEach((doc) => {
      batch.update(doc.ref, { isRead: true });
    });
    await batch.commit();
  }

  const userRef = doc(db, "users", userId);
  await updateDoc(userRef, {
    unreadCount: 0,
  });
}

export async function deleteNotification(notificationId: string): Promise<void> {
  await deleteDoc(doc(db, "notifications", notificationId));
}

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

// ============ GET NOTIFICATIONS ============

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

// ============ COUNT UNREAD ============

export async function countUnreadNotifications(userId: string): Promise<number> {
  const userRef = doc(db, "users", userId);
  const snap = await getDoc(userRef); // ✅ getDoc đã được import
  if (snap.exists()) {
    return snap.data().unreadCount || 0;
  }
  return 0;
}

// ============ REALTIME SUBSCRIPTION ============

export function subscribeToUnreadCount(
  userId: string,
  callback: (unreadCount: number) => void
): () => void {
  const userRef = doc(db, "users", userId);
  const unsubscribe = onSnapshot(userRef, (snap) => {
    if (snap.exists()) {
      callback(snap.data().unreadCount || 0);
    } else {
      callback(0);
    }
  });
  return unsubscribe;
}
// src/services/eventService.ts
import { db } from "../utils/config";
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  getDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";

export interface GameEvent {
  id?: string;
  name: string;
  type: "double_xp" | "triple_xp" | "streak_bonus" | "flash_sale" | "custom";
  multiplier: number;
  startDate: Date;
  endDate: Date;
  isActive: boolean;
  description: string;
  color: string;
  icon: string;
  createdAt?: any;
  updatedAt?: any;
}

/**
 * Tạo sự kiện mới
 */
export async function createEvent(event: Omit<GameEvent, "id" | "createdAt" | "updatedAt">): Promise<string> {
  const docRef = await addDoc(collection(db, "events"), {
    ...event,
    startDate: Timestamp.fromDate(event.startDate),
    endDate: Timestamp.fromDate(event.endDate),
    isActive: event.isActive ?? false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return docRef.id;
}

/**
 * Cập nhật sự kiện
 */
export async function updateEvent(eventId: string, data: Partial<GameEvent>): Promise<void> {
  const updateData: any = { ...data, updatedAt: serverTimestamp() };
  if (data.startDate) updateData.startDate = Timestamp.fromDate(data.startDate);
  if (data.endDate) updateData.endDate = Timestamp.fromDate(data.endDate);
  await updateDoc(doc(db, "events", eventId), updateData);
}

/**
 * Xóa sự kiện
 */
export async function deleteEvent(eventId: string): Promise<void> {
  await deleteDoc(doc(db, "events", eventId));
}

/**
 * Bật/tắt sự kiện
 */
export async function toggleEvent(eventId: string, isActive: boolean): Promise<void> {
  await updateDoc(doc(db, "events", eventId), {
    isActive,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Lấy tất cả sự kiện (realtime dùng hook)
 */
export async function getAllEvents(): Promise<GameEvent[]> {
  const q = query(collection(db, "events"), orderBy("startDate", "desc"));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
    startDate: doc.data().startDate?.toDate() || new Date(),
    endDate: doc.data().endDate?.toDate() || new Date(),
  })) as GameEvent[];
}

/**
 * Kiểm tra sự kiện đang hoạt động (dùng khi cộng XP)
 */
export async function getActiveEvent(type?: string): Promise<GameEvent | null> {
  const now = new Date();
  const q = query(
    collection(db, "events"),
    where("isActive", "==", true),
    where("startDate", "<=", Timestamp.fromDate(now)),
    where("endDate", ">=", Timestamp.fromDate(now))
  );
  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;
  return {
    id: snapshot.docs[0].id,
    ...snapshot.docs[0].data(),
    startDate: snapshot.docs[0].data().startDate?.toDate() || new Date(),
    endDate: snapshot.docs[0].data().endDate?.toDate() || new Date(),
  } as GameEvent;
}
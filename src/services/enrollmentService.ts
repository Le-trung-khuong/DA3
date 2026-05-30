/**
 * src/services/enrollmentService.ts
 * Quản lý quyền truy cập khóa học (enrollment)
 */

import { db } from "../utils/config";
import {
  collection,
  doc,
  addDoc,
  query,
  where,
  getDocs,
  updateDoc,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";

export interface Enrollment {
  id: string;
  userId: string;
  courseId: string;
  transactionId?: string;
  enrolledAt: Timestamp;
  isActive: boolean;
}

/**
 * Tạo enrollment mới (sau khi thanh toán thành công hoặc admin cấp quyền)
 */
export async function createEnrollment(
  userId: string,
  courseId: string,
  transactionId?: string
): Promise<string> {
  // Kiểm tra xem đã có enrollment active chưa (tránh duplicate)
  const existingQuery = query(
    collection(db, "enrollments"),
    where("userId", "==", userId),
    where("courseId", "==", courseId),
    where("isActive", "==", true)
  );
  const existingSnap = await getDocs(existingQuery);
  if (!existingSnap.empty) {
    // Nếu đã có, trả về id của nó
    return existingSnap.docs[0].id;
  }

  const enrollmentData = {
    userId,
    courseId,
    transactionId: transactionId || null,
    enrolledAt: serverTimestamp(),
    isActive: true,
  };
  const docRef = await addDoc(collection(db, "enrollments"), enrollmentData);
  return docRef.id;
}

/**
 * Kiểm tra user đã mua khóa học chưa (dùng cho hook realtime, nhưng cũng có thể gọi một lần)
 */
export async function checkUserEnrollment(
  userId: string,
  courseId: string
): Promise<boolean> {
  const q = query(
    collection(db, "enrollments"),
    where("userId", "==", userId),
    where("courseId", "==", courseId),
    where("isActive", "==", true)
  );
  const snap = await getDocs(q);
  return !snap.empty;
}

/**
 * Lấy danh sách khóa học user đã mua (trả về mảng courseId)
 */
export async function getUserEnrolledCourses(userId: string): Promise<string[]> {
  const q = query(
    collection(db, "enrollments"),
    where("userId", "==", userId),
    where("isActive", "==", true)
  );
  const snap = await getDocs(q);
  return snap.docs.map((doc) => doc.data().courseId);
}

/**
 * Vô hiệu hóa enrollment (khi refund hoặc admin thu hồi quyền)
 */
export async function deactivateEnrollment(
  userId: string,
  courseId: string
): Promise<void> {
  const q = query(
    collection(db, "enrollments"),
    where("userId", "==", userId),
    where("courseId", "==", courseId),
    where("isActive", "==", true)
  );
  const snap = await getDocs(q);
  for (const docSnap of snap.docs) {
    await updateDoc(docSnap.ref, { isActive: false });
  }
}

/**
 * Lấy tất cả enrollment của một khóa học (cho admin)
 */
export async function getCourseEnrollments(courseId: string): Promise<Enrollment[]> {
  const q = query(
    collection(db, "enrollments"),
    where("courseId", "==", courseId),
    where("isActive", "==", true)
  );
  const snap = await getDocs(q);
  return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Enrollment));
}
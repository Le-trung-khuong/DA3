/**
 * src/services/enrollmentService.ts
 * Quản lý quyền truy cập khóa học (enrollment)
 * Tự động gửi notification khi user enroll khóa học
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
import { sendNotification } from "./notificationService";

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
 * Tự động gửi notification đến user
 * @param userId - ID của người dùng
 * @param courseId - ID của khóa học
 * @param transactionId - ID giao dịch (nếu có)
 * @param courseTitle - Tên khóa học (để hiển thị trong notification)
 * @returns ID của enrollment document
 */
export async function createEnrollment(
  userId: string,
  courseId: string,
  transactionId?: string,
  courseTitle?: string
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

  // Gửi notification cho user
  try {
    const title = "🎉 Chúc mừng! Bạn đã đăng ký khóa học";
    const body = courseTitle 
      ? `Bạn đã đăng ký thành công khóa học "${courseTitle}". Hãy bắt đầu học ngay!`
      : "Bạn đã đăng ký thành công khóa học. Hãy bắt đầu học ngay!";
    await sendNotification(
      userId,
      "course_enrolled",
      title,
      body,
      `/courses/${courseId}`,
      { courseId, enrollmentId: docRef.id, courseTitle }
    );
  } catch (err) {
    console.error("Failed to send enrollment notification:", err);
    // Không throw lỗi để không ảnh hưởng đến luồng chính
  }

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
 * Tự động gửi notification refund cho user
 */
export async function deactivateEnrollment(
  userId: string,
  courseId: string,
  courseTitle?: string
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

  // Gửi notification refund cho user
  try {
    const title = "💰 Hoàn tiền thành công";
    const body = courseTitle
      ? `Khóa học "${courseTitle}" đã được hoàn tiền. Số tiền sẽ được chuyển hoàn vào tài khoản của bạn.`
      : "Khóa học của bạn đã được hoàn tiền thành công.";
    await sendNotification(
      userId,
      "refund",
      title,
      body,
      `/courses/${courseId}`,
      { courseId, courseTitle }
    );
  } catch (err) {
    console.error("Failed to send refund notification:", err);
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

/**
 * Lấy số lượng học viên của một khóa học
 */
export async function getEnrollmentCount(courseId: string): Promise<number> {
  const q = query(
    collection(db, "enrollments"),
    where("courseId", "==", courseId),
    where("isActive", "==", true)
  );
  const snap = await getDocs(q);
  return snap.size;
}
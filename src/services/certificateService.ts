import { db } from "../utils/config";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  query,
  where,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { getCourseProgress } from "./progressService";
import { getUserEnrolledCourses } from "./enrollmentService";

export interface Certificate {
  id: string;
  userId: string;
  courseId: string;
  courseTitle: string;
  userName: string;
  issuedAt: Date;
  certificateId: string;
}

/**
 * Tạo mã chứng chỉ duy nhất
 */
function generateCertificateId(userId: string, courseId: string): string {
  const timestamp = Date.now().toString(36);
  const shortUserId = userId.slice(-6);
  const shortCourseId = courseId.slice(-6);
  return `CERT-${shortUserId}-${shortCourseId}-${timestamp}`.toUpperCase();
}

/**
 * Kiểm tra xem một khóa học đã được hoàn thành 100% chưa
 */
export async function isCourseCompleted(
  userId: string,
  courseId: string,
  totalLessons: number
): Promise<boolean> {
  const progressList = await getCourseProgress(userId, courseId);
  const completedLessons = progressList.filter(p => p.status === "completed").length;
  return completedLessons >= totalLessons;
}

/**
 * Kiểm tra xem đã có certificate cho khóa học này chưa
 */
export async function hasCertificate(userId: string, courseId: string): Promise<boolean> {
  const q = query(
    collection(db, "certificates"),
    where("userId", "==", userId),
    where("courseId", "==", courseId)
  );
  const snap = await getDocs(q);
  return !snap.empty;
}

/**
 * Tạo certificate mới (lưu Firestore)
 */
export async function createCertificate(
  userId: string,
  courseId: string,
  courseTitle: string,
  userName: string
): Promise<Certificate> {
  const certificateId = generateCertificateId(userId, courseId);
  const docRef = await addDoc(collection(db, "certificates"), {
    userId,
    courseId,
    courseTitle,
    userName,
    issuedAt: serverTimestamp(),
    certificateId,
  });
  return {
    id: docRef.id,
    userId,
    courseId,
    courseTitle,
    userName,
    issuedAt: new Date(),
    certificateId,
  };
}

/**
 * Hàm chính: kiểm tra và sinh chứng chỉ nếu đủ điều kiện
 * Gọi sau mỗi lần completeLesson
 */
export async function checkAndGenerateCertificate(
  userId: string,
  courseId: string,
  courseTitle: string,
  userName: string,
  totalLessons: number
): Promise<Certificate | null> {
  // 1. Kiểm tra đã có certificate chưa
  const existing = await hasCertificate(userId, courseId);
  if (existing) return null;

  // 2. Kiểm tra hoàn thành 100%
  const completed = await isCourseCompleted(userId, courseId, totalLessons);
  if (!completed) return null;

  // 3. Tạo certificate
  const cert = await createCertificate(userId, courseId, courseTitle, userName);
  console.log(`🎓 Certificate issued for ${userName} on course "${courseTitle}"`);
  return cert;
}

/**
 * Lấy danh sách certificates của user
 */
export async function getUserCertificates(userId: string): Promise<Certificate[]> {
  const q = query(collection(db, "certificates"), where("userId", "==", userId));
  const snap = await getDocs(q);
  return snap.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
    issuedAt: doc.data().issuedAt?.toDate() || new Date(),
  })) as Certificate[];
}
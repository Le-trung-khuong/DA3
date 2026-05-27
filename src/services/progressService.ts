/**
 * src/services/progressService.ts
 * Các hàm cập nhật progress và XP
 */

import { db } from "../utils/config";
import {
  doc, setDoc, updateDoc, increment, serverTimestamp, Timestamp,
  getDoc, collection, query, where, getDocs,
} from "firebase/firestore";
import { Progress, QuizAttempt } from "../types/progress";

/**
 * Lấy progress của user cho một course (realtime sẽ dùng hook riêng)
 * Hàm này dùng để đọc một lần
 */
export async function getCourseProgress(userId: string, courseId: string): Promise<Progress[]> {
  const q = query(
    collection(db, "progress"),
    where("userId", "==", userId),
    where("courseId", "==", courseId)
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any)) as Progress[];
}

/**
 * Đánh dấu lesson hoàn thành và cộng XP
 */
export async function completeLesson(
  userId: string,
  courseId: string,
  moduleId: string,
  lessonId: string,
  xpReward: number,
  quizScore?: number,
  flashcardProgress?: { totalCards: number; rememberedCards: number; lastCardIndex: number }
): Promise<void> {
  const progressRef = doc(
    db,
    "progress",
    `${userId}_${courseId}_${moduleId}_${lessonId}`
  );
  
  await setDoc(
    progressRef,
    {
      userId,
      courseId,
      moduleId,
      lessonId,
      status: "completed",
      completedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      ...(quizScore !== undefined && { quizScore }),
      ...(flashcardProgress && { flashcardProgress }),
    },
    { merge: true }
  );

  // Cộng XP vào user document
  const userRef = doc(db, "users", userId);
  await updateDoc(userRef, {
    totalXP: increment(xpReward),
    updatedAt: serverTimestamp(),
  });
}

/**
 * Lưu kết quả làm quiz (chi tiết)
 */
export async function saveQuizAttempt(attempt: Omit<QuizAttempt, "startedAt" | "completedAt">): Promise<void> {
  const attemptRef = doc(collection(db, "quiz_attempts"));
  await setDoc(attemptRef, {
    ...attempt,
    startedAt: Timestamp.fromDate(attempt.startedAt),
    completedAt: Timestamp.fromDate(attempt.completedAt),
  });
}

/**
 * Cập nhật progress flashcard (không hoàn thành hẳn)
 */
export async function updateFlashcardProgress(
  userId: string,
  courseId: string,
  moduleId: string,
  lessonId: string,
  flashcardProgress: { totalCards: number; rememberedCards: number; lastCardIndex: number }
): Promise<void> {
  const progressRef = doc(
    db,
    "progress",
    `${userId}_${courseId}_${moduleId}_${lessonId}`
  );
  await setDoc(
    progressRef,
    {
      userId,
      courseId,
      moduleId,
      lessonId,
      flashcardProgress,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}
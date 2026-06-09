/**
 * src/services/progressService.ts
 * Quản lý tiến trình học tập của user (lesson, quiz, flashcard)
 */

import { db } from "../utils/config";
import {
  collection,
  doc,
  setDoc,
  updateDoc,
  getDoc,
  getDocs,
  query,
  where,
  serverTimestamp,
  Timestamp,
  writeBatch,
  increment,
} from "firebase/firestore";

import { updateUserStreak } from "./streakService";

// ============ TYPES ============

export interface LessonProgress {
  id: string;
  userId: string;
  courseId: string;
  moduleId: string;
  lessonId: string;
  status: "not_started" | "in_progress" | "completed";
  startedAt?: Timestamp;
  completedAt?: Timestamp;
  lastActivityAt: Timestamp;
  xpEarned: number;
}

export interface QuizAttempt {
  lessonId: string;
  startedAt: Date;
  completedAt: Date;
  score: number;
  answers: Array<{ questionId: string; selectedOptionIndex: number; isCorrect: boolean }>;
}

export interface FlashcardProgress {
  lessonId: string;
  cards: Record<string, { mastered: boolean; timesReviewed: number; lastReviewedAt: Date }>;
  masteredCount: number;
  totalCount: number;
  lastActivityAt: Date;
}

// ============ QUIZ PROGRESS ============

/**
 * Lưu hoặc cập nhật kết quả quiz của user
 */
export async function saveQuizAttempt(
  userId: string,
  courseId: string,
  moduleId: string,
  lessonId: string,
  attempt: QuizAttempt
): Promise<void> {
  const progressId = `${userId}_${courseId}_${moduleId}_${lessonId}`;
  const progressRef = doc(db, "progress", progressId);

  const existing = await getDoc(progressRef);
  const existingData = existing.exists() ? existing.data() : null;
  const prevAttempts: QuizAttempt[] = existingData?.quizAttempts || [];

  const updatedAttempts = [...prevAttempts, attempt];
  const bestScore = Math.max(
    ...updatedAttempts.map((a) => a.score),
    existingData?.quizScore || 0
  );

  const updateData: any = {
    userId,
    courseId,
    moduleId,
    lessonId,
    lessonType: "quiz",
    quizScore: bestScore,
    quizAttempts: updatedAttempts,
    status: "completed",
    lastActivityAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  if (!existing.exists()) {
    updateData.createdAt = serverTimestamp();
    updateData.startedAt = serverTimestamp();
    updateData.completedAt = serverTimestamp();
  } else {
    if (existingData?.status !== "completed") {
      updateData.completedAt = serverTimestamp();
    }
  }

  await setDoc(progressRef, updateData, { merge: true });
}

/**
 * Lấy điểm quiz tốt nhất của user cho một lesson
 */
export async function getBestQuizScore(
  userId: string,
  courseId: string,
  moduleId: string,
  lessonId: string
): Promise<number | null> {
  const progressId = `${userId}_${courseId}_${moduleId}_${lessonId}`;
  const docSnap = await getDoc(doc(db, "progress", progressId));
  if (docSnap.exists()) {
    return docSnap.data().quizScore || null;
  }
  return null;
}

// ============ FLASHCARD PROGRESS ============

/**
 * Lưu tiến trình học flashcard
 */
export async function saveFlashcardProgress(
  userId: string,
  courseId: string,
  moduleId: string,
  lessonId: string,
  progress: FlashcardProgress
): Promise<void> {
  const progressId = `${userId}_${courseId}_${moduleId}_${lessonId}`;
  const progressRef = doc(db, "progress", progressId);

  const existing = await getDoc(progressRef);
  const updateData: any = {
    userId,
    courseId,
    moduleId,
    lessonId,
    lessonType: "flashcard",
    flashcardProgress: {
      cards: progress.cards,
      masteredCount: progress.masteredCount,
      totalCount: progress.totalCount,
      lastActivityAt: Timestamp.fromDate(progress.lastActivityAt),
    },
    lastActivityAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  if (!existing.exists()) {
    updateData.createdAt = serverTimestamp();
    updateData.startedAt = serverTimestamp();
  }

  if (progress.masteredCount === progress.totalCount && progress.totalCount > 0) {
    updateData.status = "completed";
    updateData.completedAt = serverTimestamp();
  } else {
    updateData.status = "in_progress";
  }

  await setDoc(progressRef, updateData, { merge: true });
}

/**
 * Lấy tiến trình flashcard
 */
export async function getFlashcardProgress(
  userId: string,
  courseId: string,
  moduleId: string,
  lessonId: string
): Promise<FlashcardProgress | null> {
  const progressId = `${userId}_${courseId}_${moduleId}_${lessonId}`;
  const docSnap = await getDoc(doc(db, "progress", progressId));
  if (docSnap.exists()) {
    const data = docSnap.data();
    if (data.flashcardProgress) {
      const fp = data.flashcardProgress;
      return {
        lessonId,
        cards: fp.cards,
        masteredCount: fp.masteredCount,
        totalCount: fp.totalCount,
        lastActivityAt: fp.lastActivityAt?.toDate() || new Date(),
      };
    }
  }
  return null;
}

// ============ LESSON PROGRESS (GENERAL) ============

/**
 * Đánh dấu bài học (video, reading) đã hoàn thành và cộng XP
 * 🔍 Log chi tiết để debug
 */
export async function completeLesson(
  userId: string,
  courseId: string,
  moduleId: string,
  lessonId: string,
  xpReward: number
): Promise<void> {
  console.log(`[completeLesson] Start: userId=${userId}, lessonId=${lessonId}, xpReward=${xpReward}`);

  const progressId = `${userId}_${courseId}_${moduleId}_${lessonId}`;
  const progressRef = doc(db, "progress", progressId);

  const existing = await getDoc(progressRef);
  if (existing.exists() && existing.data().status === "completed") {
    console.log(`[completeLesson] Lesson ${lessonId} already completed, skip.`);
    return;
  }

  const updateData: any = {
    userId,
    courseId,
    moduleId,
    lessonId,
    lessonType: "lesson",
    status: "completed",
    xpEarned: xpReward,
    completedAt: serverTimestamp(),
    lastActivityAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  if (!existing.exists()) {
    updateData.createdAt = serverTimestamp();
    updateData.startedAt = serverTimestamp();
  }

  // 1. Lưu progress
  await setDoc(progressRef, updateData, { merge: true });
  console.log(`[completeLesson] Progress saved for ${lessonId}`);

  // 2. Cộng XP atomic (increment)
  const userRef = doc(db, "users", userId);
  try {
    await updateDoc(userRef, {
      totalXP: increment(xpReward),
      updatedAt: serverTimestamp(),
    });
    await updateUserStreak(userId);
    console.log(`✅ XP added: +${xpReward} to user ${userId}`);
  } catch (err) {
    console.error("❌ Failed to update user XP:", err);
    throw err;
  }

  // 3. Ghi log XP
  await addXPLog(userId, xpReward, `Completed lesson: ${lessonId}`, "lesson_complete");
  console.log(`[completeLesson] XP log saved`);
}

/**
 * Lấy tiến trình của một lesson (kiểm tra đã hoàn thành chưa)
 */
export async function isLessonCompleted(
  userId: string,
  courseId: string,
  moduleId: string,
  lessonId: string
): Promise<boolean> {
  const progressId = `${userId}_${courseId}_${moduleId}_${lessonId}`;
  const docSnap = await getDoc(doc(db, "progress", progressId));
  return docSnap.exists() && docSnap.data().status === "completed";
}

/**
 * Lấy tất cả progress của user trong một khóa học
 */
export async function getCourseProgress(
  userId: string,
  courseId: string
): Promise<LessonProgress[]> {
  const q = query(
    collection(db, "progress"),
    where("userId", "==", userId),
    where("courseId", "==", courseId)
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as LessonProgress[];
}

// ============ BATCH UPDATE ============

/**
 * Cập nhật nhiều progress cùng lúc (dùng batch)
 */
export async function batchUpdateProgress(
  updates: Array<{
    userId: string;
    courseId: string;
    moduleId: string;
    lessonId: string;
    status: "completed" | "in_progress";
    xpReward?: number;
  }>
): Promise<void> {
  const batch = writeBatch(db);
  for (const update of updates) {
    const progressId = `${update.userId}_${update.courseId}_${update.moduleId}_${update.lessonId}`;
    const ref = doc(db, "progress", progressId);
    const updateData: any = {
      status: update.status,
      lastActivityAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    if (update.status === "completed") {
      updateData.completedAt = serverTimestamp();
      if (update.xpReward) updateData.xpEarned = update.xpReward;
    }
    batch.set(ref, updateData, { merge: true });
  }
  await batch.commit();
}

// ============ XP LOGS ============

/**
 * Ghi log thay đổi XP (dùng cho admin hoặc tự động)
 */
export async function addXPLog(
  userId: string,
  amount: number,
  reason: string,
  activityType: "lesson_complete" | "quiz_complete" | "admin_adjustment" | "refund",
  adminNote?: string
): Promise<void> {
  await setDoc(doc(collection(db, "xp_logs")), {
    userId,
    amount,
    reason,
    activityType,
    adminNote: adminNote || null,
    timestamp: serverTimestamp(),
  });
}
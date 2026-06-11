// src/services/progressService.ts
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
  runTransaction,
  deleteField,
} from "firebase/firestore";

import { updateUserStreak } from "./streakService";
import { getActiveEvent } from "./eventService";
import type { ResumeData } from "../types/progress";
import { checkAndGenerateCertificate } from "./certificateService";
import { checkAndUnlockAchievements } from "./achievementService"; // ✅ thêm

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
export async function saveQuizAttempt(
  userId: string,
  courseId: string,
  moduleId: string,
  lessonId: string,
  attempt: QuizAttempt
): Promise<void> {
  const progressId = `${userId}_${courseId}_${moduleId}_${lessonId}`;
  const progressRef = doc(db, "progress", progressId);

  await runTransaction(db, async (transaction) => {
    const existing = await transaction.get(progressRef);
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

    transaction.set(progressRef, updateData, { merge: true });
  });
}

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

// ============ RESUME DATA ============
export async function saveResumeData(
  userId: string,
  courseId: string,
  moduleId: string,
  lessonId: string,
  resumeData: ResumeData
): Promise<void> {
  const progressId = `${userId}_${courseId}_${moduleId}_${lessonId}`;
  const progressRef = doc(db, "progress", progressId);
  await setDoc(
    progressRef,
    {
      resumeData,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

export async function getResumeData(
  userId: string,
  courseId: string,
  moduleId: string,
  lessonId: string
): Promise<ResumeData | null> {
  const progressId = `${userId}_${courseId}_${moduleId}_${lessonId}`;
  const docSnap = await getDoc(doc(db, "progress", progressId));
  if (docSnap.exists()) {
    return docSnap.data().resumeData || null;
  }
  return null;
}

// ============ LESSON COMPLETION (with certificate & achievements) ============
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
  const userRef = doc(db, "users", userId);

  // Quick check outside transaction to avoid unnecessary transaction
  const existingSnap = await getDoc(progressRef);
  if (existingSnap.exists() && existingSnap.data().status === "completed") {
    console.log(`[completeLesson] Lesson ${lessonId} already completed, skip.`);
    return;
  }

  const activeEvent = await getActiveEvent();
  let finalXPReward = xpReward;
  if (activeEvent) {
    finalXPReward = Math.floor(xpReward * activeEvent.multiplier);
    console.log(`🎉 Event active: ${activeEvent.name} x${activeEvent.multiplier} → ${finalXPReward} XP`);
  }

  await runTransaction(db, async (transaction) => {
    const userSnap = await transaction.get(userRef);
    if (!userSnap.exists()) {
      throw new Error("User not found");
    }

    const progressSnap = await transaction.get(progressRef);
    if (progressSnap.exists() && progressSnap.data().status === "completed") {
      console.log(`[completeLesson] Lesson ${lessonId} already completed (tx), skip.`);
      return;
    }

    const updateData: any = {
      userId,
      courseId,
      moduleId,
      lessonId,
      lessonType: "lesson",
      status: "completed",
      xpEarned: finalXPReward,
      completedAt: serverTimestamp(),
      lastActivityAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      resumeData: deleteField(),
    };
    if (!progressSnap.exists()) {
      updateData.createdAt = serverTimestamp();
      updateData.startedAt = serverTimestamp();
    }

    transaction.set(progressRef, updateData, { merge: true });
    transaction.update(userRef, {
      totalXP: increment(finalXPReward),
      updatedAt: serverTimestamp(),
    });
  });

  // After transaction succeeds, update streak and log XP (non-critical)
  await updateUserStreak(userId);
  await addXPLog(userId, finalXPReward, `Completed lesson: ${lessonId}`, "lesson_complete");
  console.log(`[completeLesson] Success: +${finalXPReward} XP to user ${userId}`);

  // ✅ KIỂM TRA VÀ SINH CHỨNG CHỈ
  try {
    const courseRef = doc(db, "courses", courseId);
    const courseSnap = await getDoc(courseRef);
    if (courseSnap.exists()) {
      const courseData = courseSnap.data();
      const modules = courseData.modules || [];
      const totalLessons = modules.reduce((acc: number, m: any) => acc + (m.lessons?.length || 0), 0);
      const courseTitle = courseData.title || "Untitled";

      const userSnap = await getDoc(userRef);
      const userName = userSnap.exists()
        ? (userSnap.data().displayName || userSnap.data().name || "User")
        : "User";

      await checkAndGenerateCertificate(userId, courseId, courseTitle, userName, totalLessons);
    }
  } catch (certErr) {
    console.error("Failed to check/generate certificate:", certErr);
  }

  // ✅ KIỂM TRA VÀ MỞ KHÓA THÀNH TỰU
  try {
    // Lấy thông tin user mới nhất
    const userSnapAfter = await getDoc(userRef);
    const userDataAfter = userSnapAfter.data() || {};

    // Đếm số lesson đã hoàn thành
    const completedLessonsQuery = query(
      collection(db, "progress"),
      where("userId", "==", userId),
      where("status", "==", "completed")
    );
    const completedLessonsSnap = await getDocs(completedLessonsQuery);
    const completedLessonsCount = completedLessonsSnap.size;

    // Đếm số khóa học đã hoàn thành (tính sơ bộ)
    const enrollQuery = query(
      collection(db, "enrollments"),
      where("userId", "==", userId),
      where("isActive", "==", true)
    );
    const enrollSnap = await getDocs(enrollQuery);
    const courseIds = enrollSnap.docs.map(d => d.data().courseId);
    let completedCoursesCount = 0;
    for (const cid of courseIds) {
      const progressCount = await getDocs(query(
        collection(db, "progress"),
        where("userId", "==", userId),
        where("courseId", "==", cid),
        where("status", "==", "completed")
      ));
      // Lấy tổng số lesson của course (có thể cache nhưng tạm thế)
      const courseDoc = await getDoc(doc(db, "courses", cid));
      const total = courseDoc.data()?.modules?.reduce((acc: number, m: any) => acc + (m.lessons?.length || 0), 0) || 0;
      if (progressCount.size === total && total > 0) completedCoursesCount++;
    }

    const eventData = {
      totalXP: userDataAfter.totalXP || 0,
      completedLessons: completedLessonsCount,
      currentStreak: userDataAfter.currentStreak || 0,
      completedCourses: completedCoursesCount,
    };
    await checkAndUnlockAchievements(userId, "lessons_completed", eventData.completedLessons, eventData);
    await checkAndUnlockAchievements(userId, "total_xp", eventData.totalXP, eventData);
    await checkAndUnlockAchievements(userId, "streak_days", eventData.currentStreak, eventData);
    await checkAndUnlockAchievements(userId, "courses_completed", eventData.completedCourses, eventData);
  } catch (achErr) {
    console.error("Failed to check achievements:", achErr);
  }
}

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
      updateData.resumeData = deleteField();
    }
    batch.set(ref, updateData, { merge: true });
  }
  await batch.commit();
}

// ============ XP LOGS ============
export async function addXPLog(
  userId: string,
  amount: number,
  reason: string,
  activityType: "lesson_complete" | "quiz_complete" | "admin_adjustment" | "refund" | "achievement",
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
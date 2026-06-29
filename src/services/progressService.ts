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
import { checkAndUnlockAchievementsLegacy } from "./achievementService";
import { checkAndCompleteDailyTask } from "./dailyGoalService";
import { mergeSegments } from "../utils/videoTracking";
import {
  calculateLessonXP,
  checkDailyXPLimit,
  applyDiminishingReturns,
  getTodayLessonCount,
  DAILY_XP_LIMIT,
} from "./xpService";

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
      quizCompleted: true,
      lastActivityAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    if (!existing.exists()) {
      updateData.createdAt = serverTimestamp();
      updateData.startedAt = serverTimestamp();
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
  const allMastered = progress.masteredCount === progress.totalCount && progress.totalCount > 0;

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
    allMastered: allMastered,
  };

  if (!existing.exists()) {
    updateData.createdAt = serverTimestamp();
    updateData.startedAt = serverTimestamp();
  }

  updateData.status = "in_progress";

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

// ============ COMPLETION REQUIREMENTS CHECK ============
export async function checkCompletionRequirements(
  userId: string,
  courseId: string,
  moduleId: string,
  lessonId: string,
  lessonType: string
): Promise<{ met: boolean; reason?: string; details?: any }> {
  const progressId = `${userId}_${courseId}_${moduleId}_${lessonId}`;
  const docSnap = await getDoc(doc(db, "progress", progressId));
  if (!docSnap.exists()) {
    return { met: false, reason: "Chưa có dữ liệu tiến độ" };
  }

  const data = docSnap.data();
  const resumeData = data.resumeData || {};

  switch (lessonType) {
    case "video": {
      const tracking = resumeData.videoTracking;
      if (!tracking) return { met: false, reason: "Chưa có dữ liệu xem video" };

      const merged = mergeSegments(tracking.watchedSegments || []);
      const totalWatched = merged.reduce((sum, seg) => sum + (seg.end - seg.start), 0);
      const duration = resumeData.videoDuration || 1;
      const percent = (totalWatched / duration) * 100;

      if (percent < 80) {
        return { met: false, reason: `Đã xem thực tế ${Math.round(percent)}%, cần 80%` };
      }
      if (tracking.skipCount > 3) {
        return { met: false, reason: `Vượt quá số lần skip cho phép (${tracking.skipCount}/3)` };
      }
      if ((tracking.afkWarningCount ?? 0) > 3) {
        return { met: false, reason: `Bị phát hiện AFK ${tracking.afkWarningCount} lần` };
      }
      return { met: true, details: { percent, skipCount: tracking.skipCount, afkWarnings: tracking.afkWarningCount } };
    }

    case "reading": {
      const tracking = resumeData.readingTracking;
      if (!tracking) return { met: false, reason: "Chưa có dữ liệu đọc" };

      if (tracking.actualProgress < 80) {
        return { met: false, reason: `Đã đọc ${Math.round(tracking.actualProgress)}%, cần 80%` };
      }
      if (tracking.timeSpentSeconds < tracking.minTimeRequired) {
        return { met: false, reason: `Cần đọc ít nhất ${tracking.minTimeRequired} giây` };
      }
      if (!tracking.knowledgeCheckPassed) {
        return { met: false, reason: "Chưa vượt qua kiểm tra nhanh" };
      }

      if (tracking.scrollSpikeCount > tracking.maxScrollSpikeCount) {
        console.warn(`[Reading] suspectedFastScroll: user ${userId}, lesson ${lessonId}, spikes=${tracking.scrollSpikeCount}`);
      }
      if (tracking.engagementScore !== undefined && tracking.engagementScore < 50) {
        console.warn(`[Reading] Low engagement: user ${userId}, lesson ${lessonId}, score=${tracking.engagementScore}`);
      }

      return { met: true, details: tracking };
    }

    case "flashcard": {
      const progress = data.flashcardProgress;
      const viewedSet = resumeData.flashcardViewedSet || [];
      if (!progress) return { met: false, reason: "Chưa học flashcard" };

      const allMastered = Object.values(progress.cards).every((c: any) => c.mastered);
      if (!allMastered) {
        const masteredCount = Object.values(progress.cards).filter((c: any) => c.mastered).length;
        return { met: false, reason: `Đã master ${masteredCount}/${progress.totalCount} thẻ` };
      }

      const allViewed = viewedSet.length >= progress.totalCount;
      if (!allViewed) {
        return { met: false, reason: `Đã xem ${viewedSet.length}/${progress.totalCount} thẻ` };
      }
      return { met: true, details: { allMastered, allViewed } };
    }

    case "quiz": {
      const score = data.quizScore || 0;

      let passingScore = 70;
      try {
        const courseRef = doc(db, "courses", courseId);
        const courseSnap = await getDoc(courseRef);
        if (courseSnap.exists()) {
          const courseData = courseSnap.data();
          const modules = courseData.modules || [];
          for (const module of modules) {
            const lessons = module.lessons || [];
            for (const lesson of lessons) {
              if (lesson.id === lessonId) {
                if (lesson.content?.data?.passingScore !== undefined) {
                  passingScore = lesson.content.data.passingScore;
                }
                break;
              }
            }
            if (passingScore !== 70) break;
          }
        }
      } catch (err) {
        console.warn(`[Quiz] Could not read passingScore for lesson ${lessonId}, using default 70`, err);
      }

      if (score < passingScore) {
        return { met: false, reason: `Điểm ${score}%, cần ${passingScore}% để pass` };
      }
      return { met: true, details: { score, passingScore } };
    }

    default:
      return { met: true };
  }
}

// ============================================================================
// COMPLETE LESSON CLIENT (CẬP NHẬT VỚI XP MỚI)
// ============================================================================

/**
 * Client-side function to mark a lesson as complete.
 * Uses Firestore transaction (atomic) and runs side effects after.
 *
 * ✅ NEW: Tính XP dựa trên loại lesson, thời lượng, số thẻ, v.v.
 * ✅ NEW: Giới hạn XP mỗi ngày (300 XP)
 * ✅ NEW: Diminishing returns (giảm dần sau bài thứ 3)
 */
export async function completeLessonClient(
  userId: string,
  courseId: string,
  moduleId: string,
  lessonId: string,
  xpReward: number,
  lessonType: "lesson" | "quiz" | "reading" | "video" | "flashcard" = "lesson"
): Promise<void> {
  const progressId = `${userId}_${courseId}_${moduleId}_${lessonId}`;
  const progressRef = doc(db, "progress", progressId);
  const userRef = doc(db, "users", userId);

  // ─── 1. Kiểm tra completion requirements ─────────────────────────────────
  const requirements = await checkCompletionRequirements(
    userId,
    courseId,
    moduleId,
    lessonId,
    lessonType
  );
  if (!requirements.met) {
    throw new Error(`Completion requirements not met: ${requirements.reason}`);
  }

  // ─── 2. Kiểm tra giới hạn XP hàng ngày ─────────────────────────────────
  const xpCheck = await checkDailyXPLimit(userId);
  if (!xpCheck.allowed) {
    throw new Error(
      `Bạn đã đạt giới hạn XP hôm nay (${xpCheck.limit} XP). Hãy quay lại ngày mai để tiếp tục kiếm XP!`
    );
  }

  // ─── 3. Lấy thông tin lesson để tính XP ─────────────────────────────────
  let durationMinutes = 10;
  let cardCount = 0;
  let isPerfect = false;
  let isPassing = true;

  try {
    const courseRef = doc(db, "courses", courseId);
    const courseSnap = await getDoc(courseRef);
    if (courseSnap.exists()) {
      const courseData = courseSnap.data();
      const modules = courseData.modules || [];
      for (const module of modules) {
        const lessons = module.lessons || [];
        for (const lesson of lessons) {
          if (lesson.id === lessonId) {
            durationMinutes = lesson.duration || 10;

            // Quiz: kiểm tra perfect score
            if (lessonType === "quiz") {
              const progressSnap = await getDoc(progressRef);
              if (progressSnap.exists()) {
                const quizScore = progressSnap.data().quizScore || 0;
                isPerfect = quizScore === 100;
                isPassing = quizScore >= (lesson.content?.data?.passingScore || 70);
              }
            }

            // Flashcard: đếm số thẻ
            if (lessonType === "flashcard") {
              cardCount = lesson.content?.data?.cards?.length || 0;
            }
            break;
          }
        }
      }
    }
  } catch (err) {
    console.warn(`[completeLessonClient] Could not fetch lesson details:`, err);
  }

  // ─── 4. Tính XP dựa trên loại lesson ────────────────────────────────────
  let calculatedXP = calculateLessonXP({
    lessonType,
    durationMinutes,
    cardCount,
    isPerfect,
    isPassing,
  });

  // ─── 5. Áp dụng diminishing returns ─────────────────────────────────────
  const todayLessons = await getTodayLessonCount(userId);
  calculatedXP = applyDiminishingReturns(calculatedXP, todayLessons + 1);

  // ─── 6. Đảm bảo không vượt quá giới hạn còn lại ──────────────────────
  const finalXPReward = Math.min(calculatedXP, xpCheck.remaining);

  // ─── 7. Áp dụng event multiplier (nếu có) ──────────────────────────────
  let eventMultiplier = 1;
  try {
    const activeEvent = await getActiveEvent();
    if (activeEvent) {
      eventMultiplier = activeEvent.multiplier || 1;
    }
  } catch (err) {
    console.warn("[completeLessonClient] Could not fetch active event:", err);
  }

  const finalXPWithEvent = Math.floor(finalXPReward * eventMultiplier);

  console.log(
    `[XP] Lesson ${lessonId}: base=${calculatedXP}, afterDiminishing=${finalXPReward}, event=x${eventMultiplier}, final=${finalXPWithEvent}`
  );

  // ─── 8. Transaction ──────────────────────────────────────────────────────
  await runTransaction(db, async (transaction) => {
    const [progressSnap, userSnap] = await Promise.all([
      transaction.get(progressRef),
      transaction.get(userRef),
    ]);

    if (!userSnap.exists()) {
      throw new Error("User not found");
    }

    const existingData = progressSnap.exists() ? progressSnap.data() : null;
    if (existingData?.xpEarned && existingData.xpEarned > 0) {
      console.log(`[completeLessonClient] Lesson ${lessonId} already completed, skipping.`);
      return;
    }

    const updateData: any = {
      userId,
      courseId,
      moduleId,
      lessonId,
      lessonType: lessonType,
      status: "completed",
      xpEarned: finalXPWithEvent,
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
      totalXP: increment(finalXPWithEvent),
      updatedAt: serverTimestamp(),
    });
  });

  console.log(`[completeLessonClient] Transaction committed, XP awarded: ${finalXPWithEvent}`);

  // ─── 9. Side effects ─────────────────────────────────────────────────────
  Promise.allSettled([
    updateUserStreak(userId).catch((err) => console.error("Streak error:", err)),
    addXPLog(userId, finalXPWithEvent, `Completed lesson: ${lessonId} (${lessonType})`, "lesson_complete").catch(
      (err) => console.error("XPLog error:", err)
    ),
    checkAndCompleteDailyTask(userId, lessonType).catch((err) => console.error("DailyTask error:", err)),
    (async () => {
      try {
        // Certificate check
        const courseRef = doc(db, "courses", courseId);
        const courseSnap = await getDoc(courseRef);
        if (courseSnap.exists()) {
          const courseData = courseSnap.data();
          const modules = courseData.modules || [];
          const totalLessons = modules.reduce((acc: number, m: any) => acc + (m.lessons?.length || 0), 0);
          const courseTitle = courseData.title || "Untitled";
          const userSnap = await getDoc(userRef);
          const userName = userSnap.exists()
            ? userSnap.data().displayName || userSnap.data().name || "User"
            : "User";
          await checkAndGenerateCertificate(userId, courseId, courseTitle, userName, totalLessons);
        }
      } catch (certErr) {
        console.error("Certificate error:", certErr);
      }
    })(),
    (async () => {
      try {
        // Achievements (legacy) - 4 calls sequential
        const userSnapAfter = await getDoc(userRef);
        const userDataAfter = userSnapAfter.data() || {};
        const completedLessonsQuery = query(
          collection(db, "progress"),
          where("userId", "==", userId),
          where("status", "==", "completed")
        );
        const completedLessonsSnap = await getDocs(completedLessonsQuery);
        const completedLessonsCount = completedLessonsSnap.size;

        const enrollQuery = query(
          collection(db, "enrollments"),
          where("userId", "==", userId),
          where("isActive", "==", true)
        );
        const enrollSnap = await getDocs(enrollQuery);
        const courseIds = enrollSnap.docs.map((d) => d.data().courseId);

        const completedPerCourse: Record<string, number> = {};
        completedLessonsSnap.forEach((docSnap) => {
          const p = docSnap.data();
          const cid = p.courseId;
          if (cid) completedPerCourse[cid] = (completedPerCourse[cid] || 0) + 1;
        });

        let completedCoursesCount = 0;
        const batchSize = 30;
        for (let i = 0; i < courseIds.length; i += batchSize) {
          const batchIds = courseIds.slice(i, i + batchSize);
          const courseRefs = batchIds.map((cid) => doc(db, "courses", cid));
          const courseSnaps = await Promise.all(courseRefs.map((ref) => getDoc(ref)));
          courseSnaps.forEach((snap, idx) => {
            if (snap.exists()) {
              const total =
                snap.data()?.modules?.reduce((acc: number, m: any) => acc + (m.lessons?.length || 0), 0) || 0;
              const completed = completedPerCourse[batchIds[idx]] || 0;
              if (total > 0 && completed === total) completedCoursesCount++;
            }
          });
        }

        const eventData = {
          totalXP: userDataAfter.totalXP || 0,
          completedLessons: completedLessonsCount,
          currentStreak: userDataAfter.currentStreak || 0,
          completedCourses: completedCoursesCount,
        };
        // Gọi achievement check 4 lần – có thể optimize nhưng không critical
        await checkAndUnlockAchievementsLegacy(userId, "lessons_completed", eventData.completedLessons, eventData);
        await checkAndUnlockAchievementsLegacy(userId, "total_xp", eventData.totalXP, eventData);
        await checkAndUnlockAchievementsLegacy(userId, "streak_days", eventData.currentStreak, eventData);
        await checkAndUnlockAchievementsLegacy(userId, "courses_completed", eventData.completedCourses, eventData);
      } catch (achErr) {
        console.error("Achievement error:", achErr);
      }
    })(),
  ]).catch((err) => console.error("Side effects error:", err));

  console.log(`[completeLessonClient] Lesson ${lessonId} completed successfully.`);
}

// ============================================================================
// DEPRECATED: keep as alias to completeLessonClient
// ============================================================================
/**
 * @deprecated Use completeLessonClient() instead.
 */
export async function completeLesson(
  userId: string,
  courseId: string,
  moduleId: string,
  lessonId: string,
  xpReward: number,
  lessonType: "lesson" | "quiz" | "reading" | "video" | "flashcard" = "lesson"
): Promise<void> {
  console.warn("[DEPRECATED] completeLesson() called – delegating to completeLessonClient().");
  return completeLessonClient(userId, courseId, moduleId, lessonId, xpReward, lessonType);
}

// ============ CÁC HÀM KHÁC ============
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

export interface CourseProgress {
  courseId: string;
  courseName: string;
  percent: number;
}

export const getUserOverallProgress = async (userId: string): Promise<CourseProgress[]> => {
  const enrollSnap = await getDocs(
    query(
      collection(db, "enrollments"),
      where("userId", "==", userId),
      where("isActive", "==", true)
    )
  );
  if (enrollSnap.empty) return [];

  const courseIds = enrollSnap.docs.map((d) => d.data().courseId);

  const progressSnap = await getDocs(
    query(
      collection(db, "progress"),
      where("userId", "==", userId),
      where("status", "==", "completed")
    )
  );

  const completedPerCourse: Record<string, number> = {};
  progressSnap.forEach((doc) => {
    const data = doc.data();
    const cid = data.courseId;
    if (cid) {
      completedPerCourse[cid] = (completedPerCourse[cid] || 0) + 1;
    }
  });

  const result: CourseProgress[] = [];
  const batchSize = 30;

  for (let i = 0; i < courseIds.length; i += batchSize) {
    const batchIds = courseIds.slice(i, i + batchSize);
    const courseQuery = query(
      collection(db, "courses"),
      where("__name__", "in", batchIds)
    );
    const courseSnap = await getDocs(courseQuery);
    const courseMap: Record<string, any> = {};
    courseSnap.forEach((doc) => {
      const data = doc.data();
      const modules = data.modules || [];
      const totalLessons = modules.reduce((acc: number, m: any) => acc + (m.lessons?.length || 0), 0);
      courseMap[doc.id] = {
        title: data.title || "Unknown",
        totalLessons,
      };
    });

    for (const cid of batchIds) {
      const courseInfo = courseMap[cid];
      if (!courseInfo) continue;
      const completed = completedPerCourse[cid] || 0;
      const total = courseInfo.totalLessons;
      const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
      result.push({
        courseId: cid,
        courseName: courseInfo.title,
        percent,
      });
    }
  }

  return result;
};
// src/services/xpService.ts
import { db } from "../utils/config";
import {
  collection,
  query,
  where,
  getDocs,
  Timestamp,
} from "firebase/firestore";

// ─── CẤU HÌNH XP ─────────────────────────────────────────────────────────────

export const DAILY_XP_LIMIT = 300; // Giới hạn XP mỗi ngày

export const XP_RATES = {
  video: {
    base: 15,
    perMinute: 2,
    maxBonus: 20,
    minXP: 10,
  },
  reading: {
    base: 15,
    perMinute: 2.5,
    maxBonus: 25,
    minXP: 10,
  },
  flashcard: {
    base: 12,
    perCard: 0.5,
    maxBonus: 15,
    minXP: 8,
  },
  quiz: {
    base: 25,
    perfectBonus: 20,
    passingBonus: 5,
    minXP: 15,
  },
  lesson: {
    base: 20,
    minXP: 10,
    maxXP: 40,
  },
};

/**
 * Lấy tổng XP user đã kiếm được trong ngày
 */
export async function getTodayXP(userId: string): Promise<number> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const q = query(
    collection(db, "xp_logs"),
    where("userId", "==", userId),
    where("timestamp", ">=", Timestamp.fromDate(today)),
    where("timestamp", "<", Timestamp.fromDate(tomorrow))
  );
  const snap = await getDocs(q);
  let total = 0;
  snap.forEach((doc) => {
    const amount = doc.data().amount || 0;
    if (amount > 0) total += amount;
  });
  return total;
}

/**
 * Lấy số bài học đã hoàn thành trong ngày
 */
export async function getTodayLessonCount(userId: string): Promise<number> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const q = query(
    collection(db, "xp_logs"),
    where("userId", "==", userId),
    where("activityType", "==", "lesson_complete"),
    where("timestamp", ">=", Timestamp.fromDate(today)),
    where("timestamp", "<", Timestamp.fromDate(tomorrow))
  );
  const snap = await getDocs(q);
  return snap.size;
}

/**
 * Kiểm tra xem user còn có thể kiếm XP trong ngày không
 */
export async function checkDailyXPLimit(
  userId: string
): Promise<{ allowed: boolean; current: number; limit: number; remaining: number }> {
  const current = await getTodayXP(userId);
  return {
    allowed: current < DAILY_XP_LIMIT,
    current,
    limit: DAILY_XP_LIMIT,
    remaining: Math.max(0, DAILY_XP_LIMIT - current),
  };
}

/**
 * Tính XP cho lesson dựa trên loại và thời lượng
 */
export function calculateLessonXP(params: {
  lessonType: "video" | "reading" | "flashcard" | "quiz" | "lesson";
  durationMinutes?: number;
  cardCount?: number;
  isPerfect?: boolean;
  isPassing?: boolean;
}): number {
  const { lessonType, durationMinutes = 0, cardCount = 0, isPerfect = false, isPassing = true } = params;

  let xp = 0;

  switch (lessonType) {
    case "video": {
      const rate = XP_RATES.video;
      xp = rate.base + Math.floor(durationMinutes * rate.perMinute);
      xp = Math.min(xp, rate.base + rate.maxBonus);
      xp = Math.max(xp, rate.minXP);
      break;
    }

    case "reading": {
      const rate = XP_RATES.reading;
      xp = rate.base + Math.floor(durationMinutes * rate.perMinute);
      xp = Math.min(xp, rate.base + rate.maxBonus);
      xp = Math.max(xp, rate.minXP);
      break;
    }

    case "flashcard": {
      const rate = XP_RATES.flashcard;
      xp = rate.base + Math.floor(cardCount * rate.perCard);
      xp = Math.min(xp, rate.base + rate.maxBonus);
      xp = Math.max(xp, rate.minXP);
      break;
    }

    case "quiz": {
      const rate = XP_RATES.quiz;
      xp = rate.base;
      if (isPerfect) xp += rate.perfectBonus;
      else if (isPassing) xp += rate.passingBonus;
      xp = Math.max(xp, rate.minXP);
      break;
    }

    default: {
      const rate = XP_RATES.lesson;
      xp = rate.base;
      xp = Math.min(xp, rate.maxXP);
      xp = Math.max(xp, rate.minXP);
    }
  }

  return Math.floor(xp);
}

/**
 * Tính XP với diminishing returns (giảm dần sau mỗi bài học trong ngày)
 */
export function applyDiminishingReturns(xp: number, lessonCountToday: number): number {
  if (lessonCountToday <= 3) return xp;
  // Giảm 10% mỗi bài sau bài thứ 3
  const multiplier = Math.max(0.3, 1 - (lessonCountToday - 3) * 0.1);
  return Math.floor(xp * multiplier);
}

/**
 * Lấy thông tin XP cho UI hiển thị
 */
export async function getXPStatus(
  userId: string
): Promise<{
  todayXP: number;
  dailyLimit: number;
  remaining: number;
  todayLessons: number;
  isLimited: boolean;
}> {
  const [todayXP, todayLessons] = await Promise.all([getTodayXP(userId), getTodayLessonCount(userId)]);

  return {
    todayXP,
    dailyLimit: DAILY_XP_LIMIT,
    remaining: Math.max(0, DAILY_XP_LIMIT - todayXP),
    todayLessons,
    isLimited: todayXP >= DAILY_XP_LIMIT,
  };
}
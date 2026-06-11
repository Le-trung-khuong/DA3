// src/services/streakService.ts
import { doc, updateDoc, getDoc, serverTimestamp, runTransaction } from "firebase/firestore";
import { db } from "../utils/config";
import { checkAndUnlockAchievements } from "./achievementService";

export async function updateUserStreak(userId: string, activityDate: Date = new Date()): Promise<void> {
  const userRef = doc(db, "users", userId);

  await runTransaction(db, async (transaction) => {
    const userSnap = await transaction.get(userRef);
    if (!userSnap.exists()) return;

    const userData = userSnap.data();
    const lastDate = userData.lastStreakDate?.toDate ? userData.lastStreakDate.toDate() : null;
    let currentStreak = userData.currentStreak || 0;
    let longestStreak = userData.longestStreak || 0;

    const today = new Date(activityDate);
    today.setHours(0, 0, 0, 0);

    if (!lastDate) {
      currentStreak = 1;
    } else {
      const lastDay = new Date(lastDate);
      lastDay.setHours(0, 0, 0, 0);
      const diffDays = Math.floor((today.getTime() - lastDay.getTime()) / (1000 * 60 * 60 * 24));

      if (diffDays === 1) {
        currentStreak += 1;
      } else if (diffDays > 1) {
        currentStreak = 1;
      } else if (diffDays === 0) {
        // Cùng ngày -> không thay đổi
        return;
      }
    }

    if (currentStreak > longestStreak) {
      longestStreak = currentStreak;
    }

    transaction.update(userRef, {
      currentStreak: currentStreak,
      longestStreak: longestStreak,
      lastStreakDate: today,
      updatedAt: serverTimestamp(),
    });
  });

  // ✅ Sau khi cập nhật streak, kiểm tra thành tựu liên quan đến streak
  try {
    const userSnapAfter = await getDoc(userRef);
    const newStreak = userSnapAfter.data()?.currentStreak || 0;
    await checkAndUnlockAchievements(userId, "streak_days", newStreak, { currentStreak: newStreak });
  } catch (err) {
    console.error("Failed to check streak achievement:", err);
  }
}
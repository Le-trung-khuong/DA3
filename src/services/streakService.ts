// src/services/streakService.ts
import { doc, updateDoc, getDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../utils/config";

/**
 * Cập nhật streak cho user dựa trên ngày hoạt động hiện tại
 * @param userId - ID người dùng
 * @param activityDate - Ngày diễn ra hoạt động (mặc định là hôm nay)
 */
export async function updateUserStreak(userId: string, activityDate: Date = new Date()): Promise<void> {
  const userRef = doc(db, "users", userId);
  const userSnap = await getDoc(userRef);
  if (!userSnap.exists()) return;

  const userData = userSnap.data();
  const lastDate = userData.lastStreakDate?.toDate ? userData.lastStreakDate.toDate() : null;
  let currentStreak = userData.currentStreak || 0;
  let longestStreak = userData.longestStreak || 0;

  const today = new Date(activityDate);
  today.setHours(0, 0, 0, 0);

  if (!lastDate) {
    // Lần đầu tiên có hoạt động
    currentStreak = 1;
  } else {
    const lastDay = new Date(lastDate);
    lastDay.setHours(0, 0, 0, 0);
    const diffDays = Math.floor((today.getTime() - lastDay.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) {
      // Hôm qua có hoạt động → tăng streak
      currentStreak += 1;
    } else if (diffDays > 1) {
      // Bỏ qua ít nhất 1 ngày → reset streak
      currentStreak = 1;
    } else if (diffDays === 0) {
      // Cùng ngày → không thay đổi streak
      return;
    }
  }

  if (currentStreak > longestStreak) {
    longestStreak = currentStreak;
  }

  await updateDoc(userRef, {
    currentStreak: currentStreak,
    longestStreak: longestStreak,
    lastStreakDate: today,
    updatedAt: serverTimestamp(),
  });
}
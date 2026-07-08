// src/services/dailyGoalService.ts
import { db } from '../utils/config';
import { doc, collection, setDoc, getDoc, updateDoc, increment, runTransaction, serverTimestamp } from 'firebase/firestore';

export interface DailyTask {
  id: string;
  text: string;
  xpReward: number;
  icon: string;
  lessonType?: 'lesson' | 'quiz' | 'reading' | 'video' | 'flashcard';
}

export const DAILY_TASKS: DailyTask[] = [
  { id: 'complete_lesson', text: 'Hoàn thành 1 bài học', xpReward: 10, icon: '📚', lessonType: 'lesson' },
  { id: 'complete_quiz', text: 'Hoàn thành 1 bài quiz', xpReward: 15, icon: '📝', lessonType: 'quiz' },
  { id: 'complete_reading', text: 'Đọc 1 bài reading', xpReward: 10, icon: '📖', lessonType: 'reading' },
  { id: 'complete_video', text: 'Xem 1 video bài giảng', xpReward: 10, icon: '🎬', lessonType: 'video' },
];

export interface DailyProgress {
  userId: string;
  date: string;
  completedTasks: string[];
  createdAt: Date;
}

export const getDailyProgress = async (userId: string, date: string): Promise<DailyProgress | null> => {
  const ref = doc(db, 'dailyProgress', `${userId}_${date}`);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return { ...snap.data() } as DailyProgress;
};

export const completeTask = async (
  userId: string,
  date: string,
  taskId: string
): Promise<{ xpEarned: number }> => {
  const ref = doc(db, 'dailyProgress', `${userId}_${date}`);
  const userRef = doc(db, 'users', userId);
  // Tạo sẵn ref cho xp_logs (không tốn round-trip mạng) để ghi trong cùng transaction
  const xpLogRef = doc(collection(db, 'xp_logs'));

  return runTransaction(db, async (transaction) => {
    const snap = await transaction.get(ref);
    const existingData = snap.exists() ? snap.data() : null;
    // ✅ Sửa: dùng optional chaining và fallback
    const completedTasks: string[] = existingData?.completedTasks || [];

    if (completedTasks.includes(taskId)) {
      return { xpEarned: 0 };
    }

    const task = DAILY_TASKS.find(t => t.id === taskId);
    if (!task) throw new Error('Không tìm thấy nhiệm vụ');

    const updated = [...completedTasks, taskId];
    transaction.set(ref, {
      userId,
      date,
      completedTasks: updated,
      // ✅ Sửa: dùng nullish coalescing operator
      createdAt: existingData?.createdAt ?? new Date(),
    }, { merge: true });

    transaction.update(userRef, {
      totalXP: increment(task.xpReward),
      updatedAt: serverTimestamp(),
    });

    // ✅ FIX: Ghi vào xp_logs để Daily Task XP được tính vào DAILY_XP_LIMIT
    // (getTodayXP trong xpService.ts chỉ đọc từ xp_logs) và xuất hiện đúng
    // trong analytics heatmap. Trước đây totalXP được cộng thẳng, không qua
    // xp_logs, nên XP này nằm ngoài mọi giới hạn/thống kê dựa trên xp_logs.
    transaction.set(xpLogRef, {
      userId,
      amount: task.xpReward,
      reason: `Daily task: ${task.text}`,
      activityType: 'daily_task',
      adminNote: null,
      timestamp: serverTimestamp(),
    });

    return { xpEarned: task.xpReward };
  });
};

export const checkAndCompleteDailyTask = async (
  userId: string,
  lessonType: 'lesson' | 'quiz' | 'reading' | 'video' | 'flashcard'
) => {
  const date = new Date().toISOString().slice(0, 10);
  const task = DAILY_TASKS.find(t => t.lessonType === lessonType);
  if (!task) return;
  await completeTask(userId, date, task.id);
};
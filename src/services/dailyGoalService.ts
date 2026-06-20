import { db } from '../utils/config';
import { doc, setDoc, getDoc, updateDoc, increment } from 'firebase/firestore';

export interface DailyTask {
  id: string;
  text: string;
  xpReward: number;
  icon: string;
  lessonType?: 'lesson' | 'quiz' | 'reading' | 'video' | 'flashcard';
}

// Nhiệm vụ gắn với hành động học tập thực tế
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

/**
 * Chỉ được gọi từ các service học tập (progressService) khi user thực sự hoàn thành hành động.
 * Không cho phép gọi từ UI.
 */
export const completeTask = async (userId: string, date: string, taskId: string): Promise<{ xpEarned: number }> => {
  const ref = doc(db, 'dailyProgress', `${userId}_${date}`);
  const snap = await getDoc(ref);
  const completedTasks: string[] = snap.exists() ? snap.data().completedTasks || [] : [];

  if (completedTasks.includes(taskId)) {
    return { xpEarned: 0 }; // đã hoàn thành hôm nay
  }

  const task = DAILY_TASKS.find(t => t.id === taskId);
  if (!task) throw new Error('Không tìm thấy nhiệm vụ');

  const updated = [...completedTasks, taskId];
  await setDoc(ref, {
    userId,
    date,
    completedTasks: updated,
    createdAt: snap.exists() ? snap.data().createdAt : new Date(),
  }, { merge: true });

  const userRef = doc(db, 'users', userId);
  await updateDoc(userRef, { totalXP: increment(task.xpReward) });

  return { xpEarned: task.xpReward };
};

/**
 * Hàm tiện lợi để kiểm tra và hoàn thành nhiệm vụ dựa trên lessonType
 */
export const checkAndCompleteDailyTask = async (userId: string, lessonType: 'lesson' | 'quiz' | 'reading' | 'video' | 'flashcard') => {
  const date = new Date().toISOString().slice(0, 10);
  const task = DAILY_TASKS.find(t => t.lessonType === lessonType);
  if (!task) return;
  await completeTask(userId, date, task.id);
};
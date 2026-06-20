/**
 * src/services/dailyGoalService.ts
 * Quản lý mục tiêu hằng ngày của user
 */

import { db } from '../utils/config';
import { collection, doc, setDoc, getDocs, updateDoc, query, where } from 'firebase/firestore';

const COLLECTION = 'dailyGoals';

export interface DailyGoal {
  id?: string;
  userId: string;
  date: string; // 'YYYY-MM-DD'
  goals: string[];
  completed: boolean[];
  createdAt: Date;
}

export const getDailyGoals = async (userId: string, date: string): Promise<DailyGoal | null> => {
  const q = query(collection(db, COLLECTION), where('userId', '==', userId), where('date', '==', date));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const docSnap = snap.docs[0];
  return { id: docSnap.id, ...docSnap.data() } as DailyGoal;
};

export const saveDailyGoals = async (userId: string, date: string, goals: string[], completed: boolean[]): Promise<void> => {
  const existing = await getDailyGoals(userId, date);
  if (existing && existing.id) {
    await updateDoc(doc(db, COLLECTION, existing.id), { goals, completed });
  } else {
    await setDoc(doc(collection(db, COLLECTION)), { userId, date, goals, completed, createdAt: new Date() });
  }
};

export const toggleGoalCompletion = async (userId: string, date: string, index: number): Promise<void> => {
  const existing = await getDailyGoals(userId, date);
  if (!existing || !existing.id) return;
  const newCompleted = [...existing.completed];
  newCompleted[index] = !newCompleted[index];
  await updateDoc(doc(db, COLLECTION, existing.id), { completed: newCompleted });
};
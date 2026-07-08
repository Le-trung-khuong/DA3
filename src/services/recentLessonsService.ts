// src/services/recentLessonsService.ts
import { db } from "../utils/config";
import { doc, updateDoc, arrayUnion, arrayRemove, getDoc } from "firebase/firestore";

const MAX_RECENT = 20;

export interface RecentLesson {
  courseId: string;
  moduleId: string;
  lessonId: string;
  lessonTitle: string;
  viewedAt: number;
}

export async function updateRecentLessons(
  userId: string,
  lesson: RecentLesson
) {
  if (!userId) return;
  const userRef = doc(db, "users", userId);
  const snap = await getDoc(userRef);
  const current = snap.exists() ? snap.data().recentLessons || [] : [];

  // Loại bỏ trùng lessonId
  const filtered = current.filter(
    (l: RecentLesson) => l.lessonId !== lesson.lessonId
  );
  const updated = [lesson, ...filtered].slice(0, MAX_RECENT);

  await updateDoc(userRef, {
    recentLessons: updated,
  });
}

export async function getRecentLessons(userId: string): Promise<RecentLesson[]> {
  if (!userId) return [];
  const userRef = doc(db, "users", userId);
  const snap = await getDoc(userRef);
  return snap.exists() ? snap.data().recentLessons || [] : [];
}
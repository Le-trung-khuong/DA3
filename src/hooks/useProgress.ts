/**
 * src/hooks/useProgress.ts
 * Hook lấy progress realtime của user cho một course
 */

import { useState, useEffect } from "react";
import { collection, query, where, onSnapshot, getDocs } from "firebase/firestore";
import { db } from "../utils/config";
import { Progress, ResumeData } from "../types/progress";

export function useProgress(userId: string | undefined, courseId: string | undefined) {
  const [progress, setProgress] = useState<Progress[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [resumeDataMap, setResumeDataMap] = useState<Record<string, ResumeData>>({});

  // Hàm fetch lại dữ liệu (có thể gọi thủ công sau khi complete)
  const refreshProgress = async () => {
    if (!userId || !courseId) return;
    try {
      const q = query(
        collection(db, "progress"),
        where("userId", "==", userId),
        where("courseId", "==", courseId)
      );
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as unknown as Progress[];
      setProgress(data);
      // Build resume data map
      const newMap: Record<string, ResumeData> = {};
      snapshot.docs.forEach(doc => {
        const d = doc.data();
        if (d.resumeData) newMap[d.lessonId] = d.resumeData;
      });
      setResumeDataMap(newMap);
    } catch (err) {
      console.error("refreshProgress error:", err);
    }
  };

  useEffect(() => {
    if (!userId || !courseId) {
      setProgress([]);
      setResumeDataMap({});
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, "progress"),
      where("userId", "==", userId),
      where("courseId", "==", courseId)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as unknown as Progress[];
        setProgress(data);
        // Build resume data map
        const newMap: Record<string, ResumeData> = {};
        snapshot.docs.forEach(doc => {
          const d = doc.data();
          if (d.resumeData) newMap[d.lessonId] = d.resumeData;
        });
        setResumeDataMap(newMap);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error("useProgress error:", err);
        setError(err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [userId, courseId]);

  // Helper: kiểm tra lesson đã hoàn thành chưa
  const isLessonCompleted = (moduleId: string, lessonId: string): boolean => {
    return progress.some(
      (p) => p.moduleId === moduleId && p.lessonId === lessonId && p.status === "completed"
    );
  };

  // Helper: lấy điểm quiz nếu có
  const getQuizScore = (moduleId: string, lessonId: string): number | undefined => {
    const p = progress.find((p) => p.moduleId === moduleId && p.lessonId === lessonId);
    return p?.quizScore;
  };

  // Helper: lấy flashcard progress
  const getFlashcardProgress = (moduleId: string, lessonId: string) => {
    const p = progress.find((p) => p.moduleId === moduleId && p.lessonId === lessonId);
    return p?.flashcardProgress;
  };

  // Helper: lấy resume data cho một lesson
  const getResumeData = (lessonId: string): ResumeData | null => {
    return resumeDataMap[lessonId] || null;
  };

  return {
    progress,
    loading,
    error,
    isLessonCompleted,
    getQuizScore,
    getFlashcardProgress,
    refreshProgress,
    getResumeData,
  };
}
// src/hooks/useUserStats.ts
import { useState, useEffect } from "react";
import {
  collection,
  query,
  where,
  getDocs,
  orderBy,
  limit,
  doc,
  getDoc,
} from "firebase/firestore";
import { db } from "../utils/config";

export interface UserStats {
  totalXP: number;
  level: number;
  currentStreak: number;
  enrolledCourses: number;
  completedCourses: number;
  completedLessons: number;
  averageQuizScore: number;
  xpOverTime: { date: string; xp: number }[];
}

export function useUserStats(userId: string | undefined) {
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!userId) {
      setStats(null);
      setLoading(false);
      return;
    }

    const fetchStats = async () => {
      try {
        // 1. Lấy user document
        const userRef = doc(db, "users", userId);
        const userSnap = await getDoc(userRef);
        const userData = userSnap.exists() ? userSnap.data() : {};

        // 2. Lấy enrollments
        const enrollQuery = query(
          collection(db, "enrollments"),
          where("userId", "==", userId),
          where("isActive", "==", true)
        );
        const enrollSnap = await getDocs(enrollQuery);
        const enrolledCourses = enrollSnap.size;
        const courseIds = enrollSnap.docs.map((d) => d.data().courseId);

        // 3. Lấy progress completed
        const progressQuery = query(
          collection(db, "progress"),
          where("userId", "==", userId),
          where("status", "==", "completed")
        );
        const progressSnap = await getDocs(progressQuery);
        const completedLessons = progressSnap.size;

        // 4. Tính số khóa đã hoàn thành
        let completedCourses = 0;
        if (courseIds.length > 0) {
          const courseTotalLessons: Record<string, number> = {};
          for (const cid of courseIds) {
            const courseRef = doc(db, "courses", cid);
            const courseSnap = await getDoc(courseRef);
            if (courseSnap.exists()) {
              const data = courseSnap.data();
              let total = 0;
              if (data.modules) {
                data.modules.forEach((module: any) => {
                  total += module.lessons?.length || 0;
                });
              }
              courseTotalLessons[cid] = total;
            }
          }

          const completedPerCourse: Record<string, number> = {};
          progressSnap.forEach((docSnap) => {
            const p = docSnap.data();
            const cid = p.courseId;
            if (cid) completedPerCourse[cid] = (completedPerCourse[cid] || 0) + 1;
          });

          for (const cid of courseIds) {
            const total = courseTotalLessons[cid] || 0;
            const completed = completedPerCourse[cid] || 0;
            if (total > 0 && completed === total) completedCourses++;
          }
        }

        // 5. Quiz trung bình
        let totalQuizScore = 0;
        let quizCount = 0;
        progressSnap.forEach((docSnap) => {
          const p = docSnap.data();
          if (p.quizScore !== undefined && p.lessonType === "quiz") {
            totalQuizScore += p.quizScore;
            quizCount++;
          }
        });
        const averageQuizScore = quizCount > 0 ? totalQuizScore / quizCount : 0;

        // 6. XP over time từ xp_logs (đã sửa trường timestamp)
        const xpLogsQuery = query(
          collection(db, "xp_logs"),
          where("userId", "==", userId),
          orderBy("timestamp", "desc"),
          limit(30)
        );
        const xpLogsSnap = await getDocs(xpLogsQuery);
        const xpByDate: Record<string, number> = {};
        xpLogsSnap.forEach((docSnap) => {
          const data = docSnap.data();
          const ts = data.timestamp?.toDate(); // sửa từ data.createdAt
          if (ts) {
            const date = ts.toISOString().split("T")[0];
            const amount = data.amount > 0 ? data.amount : 0;
            xpByDate[date] = (xpByDate[date] || 0) + amount;
          }
        });
        const xpOverTime = Object.entries(xpByDate)
          .map(([date, xp]) => ({ date, xp }))
          .sort((a, b) => a.date.localeCompare(b.date));

        setStats({
          totalXP: userData.totalXP || 0,
          level: userData.level || 1,
          currentStreak: userData.currentStreak || 0,
          enrolledCourses,
          completedCourses,
          completedLessons,
          averageQuizScore,
          xpOverTime,
        });
        setLoading(false);
      } catch (err: any) {
        console.error("useUserStats error:", err);
        setError(err);
        setLoading(false);
      }
    };

    fetchStats();
  }, [userId]);

  return { stats, loading, error };
}
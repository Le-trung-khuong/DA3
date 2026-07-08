// src/hooks/useCourseProgress.ts
import { useMemo } from "react";
import { useProgress } from "./useProgress";
import { useDocument } from "./useFirestore";

interface CourseProgress {
  completedLessons: number;
  totalLessons: number;
  percentage: number;
}

export function useCourseProgress(userId: string | undefined, courseId: string | undefined): CourseProgress & { loading: boolean } {
  const { progress, loading: progressLoading } = useProgress(userId, courseId);
  const { data: course, loading: courseLoading } = useDocument<{ modules: any[] }>("courses", courseId);

  const result = useMemo(() => {
    if (!course || !progress || progressLoading || courseLoading) {
      return { completedLessons: 0, totalLessons: 0, percentage: 0, loading: true };
    }
    const totalLessons = course.modules.reduce((acc, m) => acc + (m.lessons?.length || 0), 0);
    const completed = progress.filter(p => p.status === "completed").length;
    const percentage = totalLessons > 0 ? Math.round((completed / totalLessons) * 100) : 0;
    return { completedLessons: completed, totalLessons, percentage, loading: false };
  }, [course, progress, progressLoading, courseLoading]);

  return { ...result, loading: result.loading };
}
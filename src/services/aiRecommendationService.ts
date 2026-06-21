// src/services/aiRecommendationService.ts
import { collection, query, where, getDocs, doc, getDoc, limit } from 'firebase/firestore';
import { db } from '../utils/config';

export interface RecommendationResult {
  lessonId: string | null;
  moduleId: string | null;
  reason: string;
}

export async function recommendNextLesson(userId: string, courseId: string): Promise<RecommendationResult> {
  // ✅ Giới hạn số lượng progress lấy về (tối đa 1000 để tránh over-fetch)
  const progQuery = query(
    collection(db, 'progress'),
    where('userId', '==', userId),
    where('courseId', '==', courseId),
    limit(1000)
  );
  const progSnap = await getDocs(progQuery);
  const progressMap: Record<string, any> = {};
  progSnap.forEach((d) => {
    const data = d.data();
    progressMap[data.lessonId] = data;
  });

  const courseRef = doc(db, 'courses', courseId);
  const courseSnap = await getDoc(courseRef);
  const courseData = courseSnap.data();
  if (!courseData) return { lessonId: null, moduleId: null, reason: 'Không tìm thấy khóa học' };

  const modules = courseData.modules || [];

  // ✅ Duyệt qua từng module để lấy moduleId
  for (const module of modules) {
    const lessons = module.lessons || [];
    for (const lesson of lessons) {
      const prog = progressMap[lesson.id];
      if (!prog || prog.status !== 'completed') {
        return {
          lessonId: lesson.id,
          moduleId: module.id, // ✅ trả về moduleId
          reason: 'Bài học mới'
        };
      }
      if (prog.quizScore !== undefined && prog.quizScore < 70) {
        return {
          lessonId: lesson.id,
          moduleId: module.id, // ✅ trả về moduleId
          reason: 'Ôn tập (điểm thấp)'
        };
      }
    }
  }

  return { lessonId: null, moduleId: null, reason: 'Bạn đã hoàn thành tất cả!' };
}
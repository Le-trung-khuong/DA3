// src/services/recommendationService.ts
import { db } from '../utils/config';
import { collection, getDocs, getDoc, doc, query, where, getDocsFromCache } from 'firebase/firestore';

export interface RecommendedCourse {
  courseId: string;
  courseName: string;
  avgRating: number;
  reviewCount: number;
}

export const getRecommendedCourses = async (limitCount: number = 5): Promise<RecommendedCourse[]> => {
  const reviewSnap = await getDocs(collection(db, 'reviews'));
  const reviews = reviewSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  const map = new Map<string, { total: number; count: number }>();
  reviews.forEach((r: any) => {
    const courseId = r.courseId;
    if (!courseId) return;
    if (!map.has(courseId)) map.set(courseId, { total: 0, count: 0 });
    const entry = map.get(courseId)!;
    entry.total += r.rating || 0;
    entry.count += 1;
  });

  // ✅ Khắc phục N+1: Batch get courses (tối đa 30 mỗi lần)
  const courseIds = Array.from(map.keys());
  const result: RecommendedCourse[] = [];

  // Chia nhỏ batch nếu số lượng > 30
  const batchSize = 30;
  for (let i = 0; i < courseIds.length; i += batchSize) {
    const batchIds = courseIds.slice(i, i + batchSize);
    // Sử dụng getDocs với where in (chỉ hỗ trợ tối đa 30)
    const courseQuery = query(
      collection(db, 'courses'),
      where('__name__', 'in', batchIds)
    );
    const courseSnap = await getDocs(courseQuery);
    const courseMap: Record<string, any> = {};
    courseSnap.forEach(doc => {
      courseMap[doc.id] = doc.data();
    });

    for (const courseId of batchIds) {
      const courseData = courseMap[courseId];
      if (!courseData) {
        console.warn(`[getRecommendedCourses] Course ${courseId} not found.`);
        continue;
      }
      const stats = map.get(courseId)!;
      const avg = stats.total / stats.count;
      const courseName = courseData.title || 'Khóa học';
      result.push({ courseId, courseName, avgRating: avg, reviewCount: stats.count });
    }
  }

  // Sắp xếp theo rating cao -> nhiều review
  result.sort((a, b) => {
    if (b.avgRating !== a.avgRating) return b.avgRating - a.avgRating;
    return b.reviewCount - a.reviewCount;
  });

  return result.slice(0, limitCount);
};
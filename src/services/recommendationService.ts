import { db } from '../utils/config';
import { collection, getDocs, getDoc, doc } from 'firebase/firestore';

export interface RecommendedCourse {
  courseId: string;
  courseName: string;
  avgRating: number;
  reviewCount: number;
}

export const getRecommendedCourses = async (limit: number = 5): Promise<RecommendedCourse[]> => {
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

  const result: RecommendedCourse[] = [];
  for (const [courseId, stats] of map.entries()) {
    try {
      const courseDoc = await getDoc(doc(db, 'courses', courseId));
      if (!courseDoc.exists()) {
        console.warn(`[getRecommendedCourses] Course with id "${courseId}" not found. Skipping.`);
        continue; // bỏ qua nếu khóa học không tồn tại
      }
      const avg = stats.total / stats.count;
      const courseName = courseDoc.data().title || 'Khóa học';
      result.push({ courseId, courseName, avgRating: avg, reviewCount: stats.count });
    } catch (err) {
      console.error(`[getRecommendedCourses] Error fetching course ${courseId}:`, err);
    }
  }

  // Sắp xếp theo rating cao -> nhiều review
  result.sort((a, b) => {
    if (b.avgRating !== a.avgRating) return b.avgRating - a.avgRating;
    return b.reviewCount - a.reviewCount;
  });

  return result.slice(0, limit);
};
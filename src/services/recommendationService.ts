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
  const reviews = reviewSnap.docs.map(d => d.data());
  const map = new Map<string, { total: number; count: number }>();
  reviews.forEach((r: any) => {
    if (!map.has(r.courseId)) map.set(r.courseId, { total: 0, count: 0 });
    const entry = map.get(r.courseId)!;
    entry.total += r.rating || 0;
    entry.count += 1;
  });
  const result: RecommendedCourse[] = [];
  for (const [courseId, stats] of map.entries()) {
    const avg = stats.total / stats.count;
    const courseDoc = await getDoc(doc(db, 'courses', courseId));
    const courseName = courseDoc.exists() ? (courseDoc.data().title || 'Khóa học') : 'Khóa học';
    result.push({ courseId, courseName, avgRating: avg, reviewCount: stats.count });
  }
  result.sort((a, b) => {
    if (b.avgRating !== a.avgRating) return b.avgRating - a.avgRating;
    return b.reviewCount - a.reviewCount;
  });
  return result.slice(0, limit);
};
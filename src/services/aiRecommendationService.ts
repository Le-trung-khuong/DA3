import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../utils/config';

export async function recommendNextLesson(userId: string, courseId: string) {
  // Lấy progress của user trong course
  const progQuery = query(
    collection(db, 'progress'),
    where('userId', '==', userId),
    where('courseId', '==', courseId)
  );
  const progSnap = await getDocs(progQuery);
  const progressMap: Record<string, any> = {};
  progSnap.forEach((d) => {
    const data = d.data();
    progressMap[data.lessonId] = data;
  });

  // Lấy thông tin course
  const courseRef = doc(db, 'courses', courseId);
  const courseSnap = await getDoc(courseRef);
  const courseData = courseSnap.data();
  if (!courseData) return { lessonId: null, reason: 'Không tìm thấy khóa học' };

  const modules = courseData.modules || [];
  const lessons = modules.flatMap((m: any) => m.lessons || []);

  for (const lesson of lessons) {
    const prog = progressMap[lesson.id];
    if (!prog || prog.status !== 'completed') {
      return { lessonId: lesson.id, reason: 'Bài học mới' };
    }
    if (prog.quizScore !== undefined && prog.quizScore < 70) {
      return { lessonId: lesson.id, reason: 'Ôn tập (điểm thấp)' };
    }
  }
  return { lessonId: null, reason: 'Bạn đã hoàn thành tất cả!' };
}
/**
 * src/components/client/RecommendedCourses.tsx
 */

import React, { useEffect, useState } from 'react';
import { getRecommendedCourses, RecommendedCourse } from '../../services/recommendationService';

const RecommendedCourses: React.FC = () => {
  const [courses, setCourses] = useState<RecommendedCourse[]>([]);

  useEffect(() => {
    getRecommendedCourses(5).then(setCourses);
  }, []);

  return (
    <div className="bg-white p-4 rounded shadow">
      <h2 className="text-xl font-bold mb-3">🌟 Khóa học gợi ý</h2>
      {courses.length === 0 && <p>Chưa có đánh giá nào.</p>}
      <ul className="space-y-2">
        {courses.map(c => (
          <li key={c.courseId} className="border-b pb-2">
            <div className="font-medium">{c.courseName}</div>
            <div className="text-sm text-gray-600">
              ⭐ {c.avgRating.toFixed(1)} / 5 · {c.reviewCount} đánh giá
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default RecommendedCourses;
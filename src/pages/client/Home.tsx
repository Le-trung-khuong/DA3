/**
 * src/pages/client/Home.tsx
 * Trang chủ hiển thị mục tiêu, tiến độ và gợi ý khóa học
 */

import React from 'react';
import DailyGoals from '../../components/client/DailyGoals';
import LearningProgress from '../../components/client/LearningProgress';
import RecommendedCourses from '../../components/client/RecommendedCourses';

const Home: React.FC = () => {
  return (
    <div className="max-w-6xl mx-auto p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
      <div className="md:col-span-2">
        <DailyGoals />
        <LearningProgress />
      </div>
      <div className="md:col-span-1">
        <RecommendedCourses />
      </div>
    </div>
  );
};

export default Home;
/**
 * src/pages/client/Home.tsx
 * Trang chủ hiển thị mục tiêu, tiến độ, gợi ý khóa học và Pomodoro Timer
 */

import React from 'react';
import DailyGoals from '../../components/client/DailyGoals';
import LearningProgress from '../../components/client/LearningProgress';
import RecommendedCourses from '../../components/client/RecommendedCourses';
import PomodoroTimer from '../../components/client/PomodoroTimer/PomodoroTimer';

const Home: React.FC = () => {
  return (
    <div style={{ background: '#0F0F1A', minHeight: '100vh', padding: '32px 0' }}>
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 24px' }}>
        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: '#E4E1EE', margin: 0 }}>
            Chào mừng bạn trở lại 👋
          </h1>
          <p style={{ fontSize: 16, color: '#C7C4D8', marginTop: 4 }}>
            Hãy tiếp tục hành trình học tập của bạn
          </p>
        </div>

        {/* Grid 2 cột */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 24 }}>
          {/* Cột trái */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <DailyGoals />
            <LearningProgress />
          </div>

          {/* Cột phải */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <PomodoroTimer />
            <RecommendedCourses />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;
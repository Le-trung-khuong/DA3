/**
 * src/pages/client/Home.tsx
 * Trang chủ hiển thị mục tiêu, tiến độ, gợi ý khóa học và Pomodoro Timer
 */

import React, { useEffect, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useLevel } from '../../hooks/useLevel';
import { LevelBadge } from '../../components/common/LevelBadge';
import DailyGoals from '../../components/client/DailyGoals';
import LearningProgress from '../../components/client/LearningProgress';
import RecommendedCourses from '../../components/client/RecommendedCourses';
import PomodoroTimer from '../../components/client/PomodoroTimer/PomodoroTimer';
import { getUserOverallProgress } from '../../services/progressService';

const Home: React.FC = () => {
  const { currentUser, userProfile } = useAuth();
  const userId = currentUser?.uid;
  const levelInfo = useLevel(userProfile?.totalXP);
  
  const [firstCourseId, setFirstCourseId] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    const fetchFirstCourse = async () => {
      try {
        const progress = await getUserOverallProgress(userId);
        if (progress.length > 0) {
          setFirstCourseId(progress[0].courseId);
        }
      } catch (err) {
        console.error('Failed to get user progress:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchFirstCourse();
  }, [userId]);

  return (
    <div style={{ background: '#0F0F1A', minHeight: '100vh', padding: '32px 0' }}>
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 24px' }}>
        {/* Header */}
        <div style={{ 
          marginBottom: 32, 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12,
        }}>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 700, color: '#E4E1EE', margin: 0 }}>
              Chào mừng bạn trở lại 👋
            </h1>
            <p style={{ fontSize: 16, color: '#C7C4D8', marginTop: 4 }}>
              Hãy tiếp tục hành trình học tập của bạn
            </p>
          </div>
          {currentUser && (
            <LevelBadge
              level={levelInfo.level}
              title={levelInfo.title}
              icon={levelInfo.icon}
              color={levelInfo.color}
              size="md"
              showTitle={false}
            />
          )}
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
            {!loading && <RecommendedCourses courseId={firstCourseId} />}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;
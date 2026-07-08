// src/pages/client/Home.tsx
/**
 * Trang chủ — UI polished, design system chuẩn
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
import { Zap, Flame, BookOpen, Trophy } from 'lucide-react';

const Home: React.FC = () => {
  const { currentUser, userProfile } = useAuth();
  const userId = currentUser?.uid;
  const levelInfo = useLevel(userProfile?.totalXP);

  const [firstCourseId, setFirstCourseId] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) { setLoading(false); return; }
    const fetchFirstCourse = async () => {
      try {
        const progress = await getUserOverallProgress(userId);
        if (progress.length > 0) setFirstCourseId(progress[0].courseId);
      } catch (err) {
        console.error('Failed to get user progress:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchFirstCourse();
  }, [userId]);

  const displayName = userProfile?.displayName || currentUser?.displayName || 'bạn';
  const totalXP = userProfile?.totalXP ?? 0;
  const streak = userProfile?.currentStreak ?? 0;

  return (
    <div style={{ background: '#0F0F1A', minHeight: '100vh' }}>
      <style>{`
        @keyframes fadeUp { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.55} }
        @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
      `}</style>

      {/* Hero Banner */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(108,99,255,0.18) 0%, rgba(155,89,182,0.10) 50%, rgba(15,15,26,0) 100%)',
        borderBottom: '1px solid rgba(108,99,255,0.12)',
        padding: '48px 0 40px',
        animation: 'fadeUp .5s ease',
      }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 20 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <span style={{
                  fontSize: 11, fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase',
                  color: '#6C63FF', background: 'rgba(108,99,255,0.12)', padding: '4px 12px', borderRadius: 999,
                  border: '1px solid rgba(108,99,255,0.2)',
                }}>Learning Dashboard</span>
              </div>
              <h1 style={{
                fontSize: 36, fontWeight: 900, color: '#E4E1EE', margin: '0 0 10px',
                letterSpacing: '-.025em', lineHeight: 1.1,
              }}>
                Chào mừng trở lại,{' '}
                <span style={{
                  background: 'linear-gradient(135deg,#6C63FF,#9B59B6)',
                  WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                }}>{displayName} 👋</span>
              </h1>
              <p style={{ fontSize: 16, color: '#C7C4D8', margin: 0, lineHeight: 1.5 }}>
                Hành trình học tập của bạn đang tiến triển tốt. Hãy tiếp tục!
              </p>
            </div>
            {currentUser && (
              <LevelBadge level={levelInfo.level} title={levelInfo.title} icon={levelInfo.icon} color={levelInfo.color} size="md" showTitle />
            )}
          </div>

          {/* Stats Row */}
          {currentUser && (
            <div style={{ display: 'flex', gap: 16, marginTop: 32, flexWrap: 'wrap' }}>
              {[
                { label: 'Total XP', value: totalXP.toLocaleString(), icon: Zap, color: '#FFB785', bg: 'rgba(255,183,133,0.10)', border: 'rgba(255,183,133,0.20)' },
                { label: 'Current Streak', value: `${streak} days`, icon: Flame, color: '#ff6b6b', bg: 'rgba(255,107,107,0.10)', border: 'rgba(255,107,107,0.20)' },
                { label: 'Level', value: `Lv. ${levelInfo.level}`, icon: Trophy, color: '#6C63FF', bg: 'rgba(108,99,255,0.10)', border: 'rgba(108,99,255,0.20)' },
                { label: 'Status', value: 'Active', icon: BookOpen, color: '#45f1c5', bg: 'rgba(69,241,197,0.10)', border: 'rgba(69,241,197,0.20)' },
              ].map(({ label, value, icon: Icon, color, bg, border }) => (
                <div key={label} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  background: bg, border: `1px solid ${border}`,
                  borderRadius: 14, padding: '12px 20px',
                  backdropFilter: 'blur(12px)',
                  flex: '1 1 160px', minWidth: 140,
                }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 10,
                    background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Icon size={18} color={color} />
                  </div>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#C7C4D8', textTransform: 'uppercase', letterSpacing: '.06em' }}>{label}</div>
                    <div style={{ fontSize: 17, fontWeight: 800, color: '#E4E1EE', lineHeight: 1.2 }}>{value}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '32px 24px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 24 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div style={{ animation: 'fadeUp .5s .1s ease both' }}><DailyGoals /></div>
            <div style={{ animation: 'fadeUp .5s .2s ease both' }}><LearningProgress /></div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div style={{ animation: 'fadeUp .5s .15s ease both' }}><PomodoroTimer /></div>
            {!loading && (
              <div style={{ animation: 'fadeUp .5s .25s ease both' }}>
                <RecommendedCourses courseId={firstCourseId} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;
// src/components/client/LearningProgress.tsx
import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useLevel } from '../../hooks/useLevel';
import { LevelBadge } from '../../components/common/LevelBadge';
import { getUserOverallProgress, CourseProgress } from '../../services/progressService';
import { BookOpen } from 'lucide-react';
import { onSnapshot, collection, query, where } from 'firebase/firestore';
import { db } from '../../utils/config';

const LearningProgress: React.FC = () => {
  const { currentUser, userProfile } = useAuth();
  const levelInfo = useLevel(userProfile?.totalXP);
  const [progress, setProgress] = useState<CourseProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const aggregateProgress = (data: CourseProgress[]): CourseProgress[] => {
    const map = new Map<string, CourseProgress>();
    data.forEach(item => {
      if (map.has(item.courseId)) {
        const existing = map.get(item.courseId)!;
        if (item.percent > existing.percent) {
          map.set(item.courseId, { ...item });
        }
      } else {
        map.set(item.courseId, { ...item });
      }
    });
    return Array.from(map.values());
  };

  const fetchProgress = useCallback(async (force = false) => {
    if (!currentUser) {
      setProgress([]);
      setLoading(false);
      return;
    }

    if (!force) {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = setTimeout(() => fetchProgress(true), 500);
      return;
    }

    try {
      setLoading(true);
      const data = await getUserOverallProgress(currentUser.uid);
      const aggregated = aggregateProgress(data);
      setProgress(aggregated);
    } catch (err) {
      console.error('Failed to load learning progress:', err);
    } finally {
      setLoading(false);
      debounceTimerRef.current = null;
    }
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser) {
      setLoading(false);
      return;
    }

    fetchProgress(true);

    const q = query(
      collection(db, 'progress'),
      where('userId', '==', currentUser.uid),
      where('status', '==', 'completed')
    );
    const unsubscribe = onSnapshot(q, () => {
      fetchProgress();
    }, (err) => {
      console.error('LearningProgress real-time error:', err);
    });

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      unsubscribe();
    };
  }, [currentUser, fetchProgress]);

  if (loading) {
    return (
      <div style={{ background: 'rgba(26,26,46,0.7)', borderRadius: 20, border: '1px solid rgba(255,255,255,0.07)', padding: 24, backdropFilter: 'blur(12px)', boxShadow: '0 4px 24px rgba(0,0,0,0.2)' }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: '#E4E1EE', margin: 0, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
          <BookOpen size={22} color="#6C63FF" /> Tiến độ học tập
        </h2>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 100 }}>
          <div style={{ width: 30, height: 30, borderRadius: '50%', border: '3px solid rgba(108,99,255,0.2)', borderTopColor: '#6C63FF', animation: 'spin 0.8s linear infinite' }} />
        </div>
        <style>{`
          @keyframes spin { to { transform: rotate(360deg); } }
        `}</style>
      </div>
    );
  }

  const totalPercent = progress.length > 0
    ? Math.round(progress.reduce((sum, p) => sum + p.percent, 0) / progress.length)
    : 0;

  return (
    <div style={{ background: 'rgba(26,26,46,0.7)', borderRadius: 20, border: '1px solid rgba(255,255,255,0.07)', padding: 24, backdropFilter: 'blur(12px)', boxShadow: '0 4px 24px rgba(0,0,0,0.2)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: '#E4E1EE', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
          <BookOpen size={22} color="#6C63FF" /> Tiến độ học tập
        </h2>
        <LevelBadge
          level={levelInfo.level}
          title={levelInfo.title}
          icon={levelInfo.icon}
          color={levelInfo.color}
          size="sm"
          showTitle={false}
        />
      </div>

      {progress.length > 0 && (
        <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ flex: 1, height: 10, background: 'rgba(255,255,255,0.06)', borderRadius: 5, overflow: 'hidden', boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.3)' }}>
            <div style={{ width: `${totalPercent}%`, height: '100%', background: 'linear-gradient(90deg,#6C63FF,#9B59B6)', borderRadius: 5, transition: 'width 0.6s cubic-bezier(.4,0,.2,1)', boxShadow: '0 0 10px rgba(108,99,255,0.4)' }} />
          </div>
          <span style={{ fontSize: 14, fontWeight: 600, color: '#6C63FF', whiteSpace: 'nowrap' }}>
            {totalPercent}%
          </span>
        </div>
      )}

      {progress.length === 0 && (
        <p style={{ color: '#C7C4D8', fontSize: 14, padding: '12px 0' }}>Chưa có tiến độ học tập nào.</p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {progress.map(p => (
          <div key={p.courseId}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: '#E4E1EE' }}>
              <span>{p.courseName}</span>
              <span style={{ color: '#C7C4D8' }}>{p.percent}%</span>
            </div>
            <div style={{ width: '100%', height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 3, marginTop: 4, overflow: 'hidden' }}>
              <div
                style={{
                  width: `${p.percent}%`,
                  height: '100%',
                  background: p.percent === 100
                    ? 'linear-gradient(90deg,#45f1c5,#00D4AA)'
                    : 'linear-gradient(90deg,#6C63FF,#9B59B6)',
                  borderRadius: 3,
                  transition: 'width 0.6s cubic-bezier(.4,0,.2,1)',
                  boxShadow: p.percent === 100 ? '0 0 8px rgba(69,241,197,0.4)' : '0 0 6px rgba(108,99,255,0.3)',
                }}
              />
            </div>
          </div>
        ))}
      </div>

      {progress.length > 0 && (
        <div style={{ marginTop: 20, paddingTop: 20, borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', gap: 0 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, color: '#C7C4D8' }}>Khóa học đang học</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#E4E1EE' }}>{progress.length}</div>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, color: '#C7C4D8' }}>Hoàn thành trung bình</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#E4E1EE' }}>{totalPercent}%</div>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, color: '#C7C4D8' }}>Đã hoàn thành</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#45f1c5' }}>
              {progress.filter(p => p.percent === 100).length}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LearningProgress;
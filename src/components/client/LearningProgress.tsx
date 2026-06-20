import React, { useEffect, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { getUserOverallProgress, CourseProgress } from '../../services/progressService';
import { BookOpen } from 'lucide-react';

const LearningProgress: React.FC = () => {
  const { currentUser } = useAuth();
  const [progress, setProgress] = useState<CourseProgress[]>([]);

  useEffect(() => {
    if (currentUser) {
      getUserOverallProgress(currentUser.uid).then(setProgress);
    }
  }, [currentUser]);

  const totalPercent = progress.length > 0
    ? Math.round(progress.reduce((sum, p) => sum + p.percent, 0) / progress.length)
    : 0;

  return (
    <div style={{ background: 'rgba(26,26,46,0.5)', borderRadius: 16, border: '1px solid rgba(255,255,255,0.06)', padding: 20 }}>
      <h2 style={{ fontSize: 20, fontWeight: 700, color: '#E4E1EE', margin: 0, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
        <BookOpen size={22} color="#6C63FF" /> Tiến độ học tập
      </h2>

      {progress.length > 0 && (
        <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ flex: 1, height: 8, background: 'rgba(255,255,255,0.06)', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ width: `${totalPercent}%`, height: '100%', background: '#6C63FF', borderRadius: 4, transition: 'width 0.5s' }} />
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
                  background: p.percent === 100 ? '#45f1c5' : '#6C63FF',
                  borderRadius: 3,
                  transition: 'width 0.5s ease',
                }}
              />
            </div>
          </div>
        ))}
      </div>

      {progress.length > 0 && (
        <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', gap: 24 }}>
          <div>
            <div style={{ fontSize: 12, color: '#C7C4D8' }}>Khóa học đang học</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#E4E1EE' }}>{progress.length}</div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: '#C7C4D8' }}>Hoàn thành trung bình</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#E4E1EE' }}>{totalPercent}%</div>
          </div>
          <div>
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
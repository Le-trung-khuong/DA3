import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getRecommendedCourses, RecommendedCourse } from '../../services/recommendationService';
import { Star, Users, ArrowRight, TrendingUp } from 'lucide-react';

const RecommendedCourses: React.FC = () => {
  const navigate = useNavigate();
  const [courses, setCourses] = useState<RecommendedCourse[]>([]);

  useEffect(() => {
    getRecommendedCourses(5).then(setCourses);
  }, []);

  return (
    <div style={{ background: 'rgba(26,26,46,0.5)', borderRadius: 16, border: '1px solid rgba(255,255,255,0.06)', padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: '#E4E1EE', display: 'flex', alignItems: 'center', gap: 8 }}>
          <TrendingUp size={22} color="#6C63FF" /> Khóa học gợi ý
        </h2>
        <span style={{ fontSize: 13, color: '#6C63FF' }}>Top đánh giá</span>
      </div>

      {courses.length === 0 && (
        <div style={{ textAlign: 'center', padding: '20px 0', color: '#C7C4D8' }}>
          <p>Chưa có đánh giá nào để gợi ý.</p>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {courses.map((c, idx) => (
          <div
            key={c.courseId}
            style={{
              padding: '14px 16px',
              borderRadius: 12,
              background: idx === 0 ? 'rgba(108,99,255,0.08)' : 'rgba(255,255,255,0.03)',
              border: idx === 0 ? '1px solid rgba(108,99,255,0.3)' : '1px solid rgba(255,255,255,0.06)',
              transition: 'all 0.2s',
              cursor: 'pointer',
            }}
            onClick={() => navigate(`/courses/${c.courseId}`)}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = '#6C63FF';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(108,99,255,0.15)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = idx === 0 ? 'rgba(108,99,255,0.3)' : 'rgba(255,255,255,0.06)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, color: '#E4E1EE', fontSize: 15 }}>
                  {c.courseName}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Star size={14} color="#f5a623" fill="#f5a623" />
                    <span style={{ fontSize: 14, fontWeight: 600, color: '#E4E1EE' }}>
                      {c.avgRating.toFixed(1)}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#C7C4D8', fontSize: 13 }}>
                    <Users size={14} />
                    <span>{c.reviewCount} đánh giá</span>
                  </div>
                  {idx === 0 && (
                    <span style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: '#6C63FF',
                      background: 'rgba(108,99,255,0.15)',
                      padding: '2px 10px',
                      borderRadius: 12,
                    }}>
                      HOT
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={e => {
                  e.stopPropagation();
                  navigate(`/courses/${c.courseId}`);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  background: '#6C63FF',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 8,
                  padding: '6px 14px',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'background 0.2s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = '#5a4bd1'}
                onMouseLeave={e => e.currentTarget.style.background = '#6C63FF'}
              >
                Xem ngay <ArrowRight size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {courses.length > 0 && (
        <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <button
            onClick={() => navigate('/courses')}
            style={{
              width: '100%',
              padding: '8px',
              background: 'transparent',
              border: '1px solid #6C63FF',
              borderRadius: 8,
              color: '#6C63FF',
              fontWeight: 600,
              fontSize: 14,
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(108,99,255,0.08)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
          >
            Xem tất cả khóa học →
          </button>
        </div>
      )}
    </div>
  );
};

export default RecommendedCourses;
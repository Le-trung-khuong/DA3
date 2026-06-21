// src/components/client/RecommendedCourses.tsx
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useAIRecommendation } from '../../hooks/useAIRecommendation';
import { getRecommendedCourses, RecommendedCourse } from '../../services/recommendationService';
import { Star, Users, ArrowRight, TrendingUp, Sparkles, BookOpen, ChevronRight } from 'lucide-react';

interface RecommendedCoursesProps {
  courseId?: string; // Nếu có, hiển thị gợi ý bài học tiếp theo cho khóa học đó
}

const RecommendedCourses: React.FC<RecommendedCoursesProps> = ({ courseId }) => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const userId = currentUser?.uid;

  const [courses, setCourses] = useState<RecommendedCourse[]>([]);
  const [loadingCourses, setLoadingCourses] = useState(true);

  // Gợi ý bài học tiếp theo (nếu có courseId)
  const { lessonId, moduleId, reason, loading: recommendLoading } = useAIRecommendation(userId, courseId);

  // Lấy danh sách khóa học gợi ý (top rated)
  useEffect(() => {
    getRecommendedCourses(5)
      .then(setCourses)
      .catch(console.error)
      .finally(() => setLoadingCourses(false));
  }, []);

  const handleContinueLesson = () => {
    if (lessonId && moduleId && courseId) {
      navigate(`/learn/${courseId}/${moduleId}/${lessonId}`);
    }
  };

  // ============ Render gợi ý bài học tiếp theo ============
  const renderLessonRecommendation = () => {
    if (!courseId) return null;

    if (recommendLoading) {
      return (
        <div style={{ 
          background: 'rgba(108,99,255,0.05)', 
          borderRadius: 12, 
          padding: 16, 
          marginBottom: 16,
          border: '1px solid rgba(108,99,255,0.1)'
        }}>
          <p style={{ color: '#C7C4D8', fontSize: 13 }}>Đang tìm bài học tiếp theo...</p>
        </div>
      );
    }

    if (!lessonId || !moduleId) {
      return (
        <div style={{ 
          background: 'rgba(69,241,197,0.05)', 
          borderRadius: 12, 
          padding: 16, 
          marginBottom: 16,
          border: '1px solid rgba(69,241,197,0.15)'
        }}>
          <p style={{ color: '#45f1c5', fontSize: 14, fontWeight: 600 }}>🎉 {reason}</p>
        </div>
      );
    }

    return (
      <div
        style={{
          background: 'rgba(108,99,255,0.08)',
          borderRadius: 12,
          padding: 16,
          marginBottom: 16,
          border: '1px solid rgba(108,99,255,0.2)',
          cursor: 'pointer',
          transition: 'all 0.2s',
        }}
        onClick={handleContinueLesson}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'rgba(108,99,255,0.15)';
          e.currentTarget.style.transform = 'translateX(4px)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'rgba(108,99,255,0.08)';
          e.currentTarget.style.transform = 'translateX(0)';
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ 
              width: 36, 
              height: 36, 
              borderRadius: '50%', 
              background: 'rgba(108,99,255,0.2)', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center' 
            }}>
              <Sparkles size={18} color="#6C63FF" />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#6C63FF' }}>
                  {reason === 'Bài học mới' ? '📖 Bài học mới' : '🔄 Ôn tập'}
                </span>
                <span style={{ 
                  fontSize: 10, 
                  color: '#C7C4D8', 
                  background: 'rgba(255,255,255,0.05)', 
                  padding: '2px 8px', 
                  borderRadius: 12 
                }}>
                  Tiếp theo
                </span>
              </div>
              <span style={{ fontSize: 12, color: '#C7C4D8' }}>{reason}</span>
            </div>
          </div>
          <ChevronRight size={18} color="#6C63FF" />
        </div>
      </div>
    );
  };

  // ============ Render danh sách khóa học gợi ý ============
  const renderCourseRecommendations = () => {
    if (loadingCourses) {
      return (
        <div style={{ textAlign: 'center', padding: '20px 0', color: '#C7C4D8' }}>
          <p>Đang tải...</p>
        </div>
      );
    }

    if (courses.length === 0) {
      return (
        <div style={{ textAlign: 'center', padding: '20px 0', color: '#C7C4D8' }}>
          <p>Chưa có đánh giá nào để gợi ý.</p>
        </div>
      );
    }

    return (
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
    );
  };

  return (
    <div style={{ background: 'rgba(26,26,46,0.5)', borderRadius: 16, border: '1px solid rgba(255,255,255,0.06)', padding: 20 }}>
      {/* ✅ Gợi ý bài học tiếp theo (nếu có courseId) */}
      {renderLessonRecommendation()}

      {/* Danh sách khóa học gợi ý */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: '#E4E1EE', display: 'flex', alignItems: 'center', gap: 8 }}>
          <TrendingUp size={22} color="#6C63FF" /> Khóa học gợi ý
        </h2>
        <span style={{ fontSize: 13, color: '#6C63FF' }}>Top đánh giá</span>
      </div>

      {renderCourseRecommendations()}

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
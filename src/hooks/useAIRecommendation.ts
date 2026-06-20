import { useState, useEffect } from 'react';
import { recommendNextLesson } from '../services/aiRecommendationService';

export function useAIRecommendation(userId: string | undefined, courseId: string | undefined) {
  const [lessonId, setLessonId] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId || !courseId) {
      setLoading(false);
      return;
    }
    recommendNextLesson(userId, courseId)
      .then((result: { lessonId: string | null; reason: string }) => {
        setLessonId(result.lessonId);
        setReason(result.reason);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [userId, courseId]);

  return { lessonId, reason, loading };
}
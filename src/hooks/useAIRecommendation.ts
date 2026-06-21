// src/hooks/useAIRecommendation.ts
import { useState, useEffect } from 'react';
import { recommendNextLesson, RecommendationResult } from '../services/aiRecommendationService';

export function useAIRecommendation(userId: string | undefined, courseId: string | undefined) {
  const [lessonId, setLessonId] = useState<string | null>(null);
  const [moduleId, setModuleId] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId || !courseId) {
      setLoading(false);
      return;
    }
    recommendNextLesson(userId, courseId)
      .then((result: RecommendationResult) => {
        setLessonId(result.lessonId);
        setModuleId(result.moduleId); // ✅ lấy moduleId
        setReason(result.reason);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [userId, courseId]);

  return { lessonId, moduleId, reason, loading };
}
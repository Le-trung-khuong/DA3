import { useState, useEffect } from 'react';
import { fetchLearningHeatmapData, HeatmapData } from '../services/analyticsService';

export function useLearningHeatmap(userId: string | undefined, days = 30) {
  const [data, setData] = useState<HeatmapData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }
    fetchLearningHeatmapData(userId, days).then((d) => {
      setData(d);
      setLoading(false);
    });
  }, [userId, days]);

  return { data, loading };
}
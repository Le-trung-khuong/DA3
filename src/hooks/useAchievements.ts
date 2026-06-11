// src/hooks/useAchievements.ts
import { useState, useEffect } from "react";
import { getUserAchievements, getAchievementDefinitions, AchievementDef, UserAchievement } from "../services/achievementService";

interface AchievementWithStatus extends AchievementDef {
  unlockedAt?: Date;
  isUnlocked: boolean;
}

export function useAchievements(userId: string | undefined) {
  const [achievements, setAchievements] = useState<AchievementWithStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!userId) {
      setAchievements([]);
      setLoading(false);
      return;
    }

    Promise.all([getAchievementDefinitions(), getUserAchievements(userId)])
      .then(([defs, userAchievements]) => {
        const map = new Map<string, UserAchievement>();
        userAchievements.forEach(ua => map.set(ua.achievementId, ua));
        const merged = defs.map(def => ({
          ...def,
          unlockedAt: map.get(def.id)?.unlockedAt,
          isUnlocked: map.has(def.id),
        }));
        setAchievements(merged);
        setLoading(false);
      })
      .catch(err => {
        console.error("useAchievements error:", err);
        setError(err);
        setLoading(false);
      });
  }, [userId]);

  return { achievements, loading, error };
}
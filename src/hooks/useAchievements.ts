// src/hooks/useAchievements.ts
import { useState, useEffect } from "react";
import { getUserAchievements, getAchievementDefinitions, AchievementDef, UserAchievement } from "../services/achievementService";

interface AchievementWithStatus extends AchievementDef {
  unlockedAt?: Date;
  claimedAt?: Date | null;
  progress?: number;
  isUnlocked: boolean;
  isClaimed: boolean;
  status: "locked" | "unlocked" | "claimed";
}

export function useAchievements(userId: string | undefined) {
  const [achievements, setAchievements] = useState<AchievementWithStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = async () => {
    if (!userId) {
      setAchievements([]);
      setLoading(false);
      return;
    }
    try {
      const [defs, userAchs] = await Promise.all([
        getAchievementDefinitions(),
        getUserAchievements(userId),
      ]);
      const map = new Map<string, UserAchievement>();
      userAchs.forEach(ua => map.set(ua.achievementId, ua));
      const merged = defs.map(def => {
        const ua = map.get(def.id);
        const isUnlocked = !!ua;
        const isClaimed = isUnlocked && ua?.claimedAt !== null;
        let status: "locked" | "unlocked" | "claimed" = "locked";
        if (isClaimed) status = "claimed";
        else if (isUnlocked) status = "unlocked";
        return {
          ...def,
          unlockedAt: ua?.unlockedAt,
          claimedAt: ua?.claimedAt,
          progress: ua?.progress,
          isUnlocked,
          isClaimed,
          status,
        };
      });
      setAchievements(merged);
    } catch (err) {
      console.error("useAchievements error:", err);
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [userId]);

  return { achievements, loading, error, refetch: fetchData };
}
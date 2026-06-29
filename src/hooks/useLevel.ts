// src/hooks/useLevel.ts
import { useMemo } from "react";
import { getLevelInfo, LevelInfo } from "../services/levelService";

/**
 * Hook lấy level info từ totalXP.
 * Sử dụng useMemo để tránh tính toán lại không cần thiết.
 */
export function useLevel(totalXP: number | undefined): LevelInfo {
  return useMemo(() => {
    if (totalXP === undefined || totalXP === null) {
      return {
        level: 1,
        totalXP: 0,
        xpInLevel: 0,
        xpToNext: 100,
        progress: 0,
        title: "Bronze",
        icon: "🥉",
        color: "#CD7F32",
      };
    }
    return getLevelInfo(totalXP);
  }, [totalXP]);
}
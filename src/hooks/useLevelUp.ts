// src/hooks/useLevelUp.ts
import { useEffect, useRef, useState } from 'react';
import { useLevel } from './useLevel';

export interface LevelUpData {
  oldLevel: number;
  newLevel: number;
  oldTitle: string;
  newTitle: string;
  oldIcon: string;
  newIcon: string;
  oldColor: string;
  newColor: string;
}

export function useLevelUp(totalXP: number | undefined) {
  const [levelUpData, setLevelUpData] = useState<LevelUpData | null>(null);
  const prevLevelRef = useRef<number>(1);
  const prevLevelInfo = useRef<ReturnType<typeof useLevel> | null>(null);
  const currentLevelInfo = useLevel(totalXP);

  useEffect(() => {
    if (totalXP === undefined || totalXP === null) {
      prevLevelRef.current = 1;
      return;
    }

    if (prevLevelInfo.current) {
      const prev = prevLevelInfo.current;
      const curr = currentLevelInfo;
      if (curr.level > prev.level) {
        setLevelUpData({
          oldLevel: prev.level,
          newLevel: curr.level,
          oldTitle: prev.title,
          newTitle: curr.title,
          oldIcon: prev.icon,
          newIcon: curr.icon,
          oldColor: prev.color,
          newColor: curr.color,
        });
      }
    }
    prevLevelInfo.current = currentLevelInfo;
  }, [totalXP, currentLevelInfo]);

  const clearLevelUp = () => setLevelUpData(null);

  return { levelUpData, clearLevelUp };
}
// src/services/levelService.ts

const BASE_XP = 100;
const EXPONENT = 1.5;

/**
 * Tính XP cần để đạt được một level cụ thể.
 * Công thức: XP(level) = floor(100 * (level - 1)^1.5)
 */
export function getXPForLevel(level: number): number {
  if (level <= 1) return 0;
  return Math.floor(BASE_XP * Math.pow(level - 1, EXPONENT));
}

/**
 * Tính level từ totalXP (binary search).
 * Trả về level nhỏ nhất mà XP >= totalXP.
 */
export function getLevelFromXP(totalXP: number): number {
  if (totalXP < 0) return 1;
  let low = 1;
  let high = 1000; // đủ cho XP rất lớn, có thể nâng lên nếu cần
  while (low < high) {
    const mid = Math.floor((low + high + 1) / 2);
    if (getXPForLevel(mid) <= totalXP) {
      low = mid;
    } else {
      high = mid - 1;
    }
  }
  return low;
}

/**
 * Các tier level (Bronze, Silver, Gold...)
 */
const LEVEL_TIERS = [
  { maxLevel: 5, title: "Bronze", icon: "🥉", color: "#CD7F32" },
  { maxLevel: 15, title: "Silver", icon: "🥈", color: "#C0C0C0" },
  { maxLevel: 30, title: "Gold", icon: "🥇", color: "#FFD700" },
  { maxLevel: 50, title: "Platinum", icon: "💎", color: "#E5E4E2" },
  { maxLevel: 75, title: "Diamond", icon: "💠", color: "#B9F2FF" },
  { maxLevel: 100, title: "Master", icon: "👑", color: "#6C63FF" },
  { maxLevel: Infinity, title: "Legend", icon: "🌟", color: "#FF6B6B" },
];

/**
 * Lấy tier theo level
 */
export function getLevelTier(level: number): { title: string; icon: string; color: string } {
  for (const tier of LEVEL_TIERS) {
    if (level <= tier.maxLevel) {
      return { title: tier.title, icon: tier.icon, color: tier.color };
    }
  }
  return LEVEL_TIERS[LEVEL_TIERS.length - 1];
}

export interface LevelInfo {
  level: number;
  totalXP: number;
  xpInLevel: number;   // XP đã có trong level hiện tại
  xpToNext: number;    // XP cần để lên level tiếp theo
  progress: number;    // 0..1
  title: string;
  icon: string;
  color: string;
}

/**
 * Lấy toàn bộ thông tin level từ totalXP
 */
export function getLevelInfo(totalXP: number): LevelInfo {
  const level = getLevelFromXP(totalXP);
  const xpForCurrent = getXPForLevel(level);
  const xpForNext = getXPForLevel(level + 1);
  const xpInLevel = totalXP - xpForCurrent;
  const xpToNext = xpForNext - totalXP;
  const progress = xpToNext > 0 ? Math.min(xpInLevel / (xpForNext - xpForCurrent), 1) : 1;
  const tier = getLevelTier(level);

  return {
    level,
    totalXP,
    xpInLevel,
    xpToNext,
    progress,
    title: tier.title,
    icon: tier.icon,
    color: tier.color,
  };
}
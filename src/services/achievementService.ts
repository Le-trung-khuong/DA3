// src/services/achievementService.ts
import { db } from "../utils/config";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  query,
  where,
  serverTimestamp,
  updateDoc,
  increment,
} from "firebase/firestore";
import { addXPLog } from "./progressService";

export interface AchievementDef {
  id: string;
  title: string;
  description: string;
  icon: string;
  category: string;
  criteria: {
    type: string;
    threshold: number;
  };
  xpReward: number;
  rarity: string;
  order: number;
}

export interface UserAchievement {
  userId: string;
  achievementId: string;
  unlockedAt: Date;
  progress: number;
  isUnlocked: boolean;
}

// Cache definitions
let achievementDefsCache: AchievementDef[] | null = null;

export async function getAchievementDefinitions(): Promise<AchievementDef[]> {
  if (achievementDefsCache) return achievementDefsCache;
  const snapshot = await getDocs(collection(db, "achievements"));
  achievementDefsCache = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AchievementDef));
  return achievementDefsCache;
}

export async function getUserAchievements(userId: string): Promise<UserAchievement[]> {
  const q = query(collection(db, "userAchievements"), where("userId", "==", userId), where("isUnlocked", "==", true));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({
    userId: doc.data().userId,
    achievementId: doc.data().achievementId,
    unlockedAt: doc.data().unlockedAt.toDate(),
    progress: doc.data().progress,
    isUnlocked: true,
  }));
}

export async function isAchievementUnlocked(userId: string, achievementId: string): Promise<boolean> {
  const docRef = doc(db, "userAchievements", `${userId}_${achievementId}`);
  const snap = await getDoc(docRef);
  return snap.exists() && snap.data().isUnlocked === true;
}

export async function unlockAchievement(
  userId: string,
  achievementDef: AchievementDef,
  currentProgress: number
): Promise<void> {
  const userAchievementId = `${userId}_${achievementDef.id}`;
  const userAchievementRef = doc(db, "userAchievements", userAchievementId);
  const userRef = doc(db, "users", userId);

  await setDoc(userAchievementRef, {
    userId,
    achievementId: achievementDef.id,
    unlockedAt: serverTimestamp(),
    progress: currentProgress,
    isUnlocked: true,
  });

  // Award XP for the achievement
  await updateDoc(userRef, {
    totalXP: increment(achievementDef.xpReward),
  });
  await addXPLog(userId, achievementDef.xpReward, `Achievement unlocked: ${achievementDef.title}`, "achievement");
}

export async function checkAndUnlockAchievements(
  userId: string,
  eventType: string,
  currentValue: number,
  userStats: {
    totalXP?: number;
    completedLessons?: number;
    currentStreak?: number;
    completedCourses?: number;
    leaderboardRank?: number;
  }
): Promise<AchievementDef[]> {
  const defs = await getAchievementDefinitions();
  const unlockedIds = new Set((await getUserAchievements(userId)).map(a => a.achievementId));
  const newlyUnlocked: AchievementDef[] = [];

  for (const def of defs) {
    if (unlockedIds.has(def.id)) continue;
    if (def.criteria.type !== eventType) continue;
    if (currentValue >= def.criteria.threshold) {
      await unlockAchievement(userId, def, currentValue);
      newlyUnlocked.push(def);
    }
  }
  return newlyUnlocked;
}
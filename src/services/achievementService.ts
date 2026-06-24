// src/services/achievementService.ts
import { db } from "../utils/config";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
  serverTimestamp,
  increment,
  runTransaction,
} from "firebase/firestore";
import { addXPLog } from "./progressService";
import { sendNotification } from "./notificationService";

export interface AchievementDef {
  id: string;
  title: string;
  description: string;
  icon: string;
  category: 'beginner' | 'intermediate' | 'expert' | 'special';
  criteria: { type: string; threshold: number };
  xpReward: number;
  rarity: string;
  order: number;
}

export interface UserAchievement {
  userId: string;
  achievementId: string;
  unlockedAt: Date;
  claimedAt: Date | null;
  progress: number;
}

let achievementDefsCache: { data: AchievementDef[]; timestamp: number } | null = null;
const CACHE_TTL = 5 * 60 * 1000;

export async function getAchievementDefinitions(): Promise<AchievementDef[]> {
  const now = Date.now();
  if (achievementDefsCache && (now - achievementDefsCache.timestamp) < CACHE_TTL) {
    return achievementDefsCache.data;
  }
  const snapshot = await getDocs(collection(db, "achievements"));
  const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AchievementDef));
  achievementDefsCache = { data, timestamp: now };
  return data;
}

export async function getUserAchievements(userId: string): Promise<UserAchievement[]> {
  const q = query(collection(db, "userAchievements"), where("userId", "==", userId));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => {
    const data = doc.data();
    return {
      userId: data.userId,
      achievementId: data.achievementId,
      // ✅ NEW-2: Null guard cho unlockedAt
      unlockedAt: data.unlockedAt ? data.unlockedAt.toDate() : new Date(0),
      claimedAt: data.claimedAt?.toDate() || null,
      progress: data.progress,
    };
  });
}

export async function isAchievementUnlocked(userId: string, achievementId: string): Promise<boolean> {
  const docRef = doc(db, "userAchievements", `${userId}_${achievementId}`);
  const snap = await getDoc(docRef);
  return snap.exists() && snap.data().unlockedAt !== undefined;
}

export async function unlockAchievement(
  userId: string,
  achievementDef: AchievementDef,
  currentProgress: number
): Promise<void> {
  const userAchievementId = `${userId}_${achievementDef.id}`;
  const userAchievementRef = doc(db, "userAchievements", userAchievementId);

  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(userAchievementRef);
    if (snap.exists()) {
      const data = snap.data();
      if (data.unlockedAt !== undefined && data.unlockedAt !== null) {
        return;
      }
    }
    transaction.set(userAchievementRef, {
      userId,
      achievementId: achievementDef.id,
      unlockedAt: serverTimestamp(),
      claimedAt: null,
      progress: currentProgress,
    });
  });

  await createAchievementNotification(userId, achievementDef);
}

export async function claimAchievement(
  userId: string,
  achievementId: string
): Promise<{ success: boolean; message?: string; xpEarned?: number }> {
  const userAchievementId = `${userId}_${achievementId}`;
  const userAchievementRef = doc(db, "userAchievements", userAchievementId);
  const userRef = doc(db, "users", userId);
  const defs = await getAchievementDefinitions();
  const achievement = defs.find(d => d.id === achievementId);
  if (!achievement) return { success: false, message: "Invalid achievement" };

  try {
    await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(userAchievementRef);
      if (!snap.exists()) throw new Error("Achievement not found");
      const data = snap.data();
      if (data.claimedAt !== undefined && data.claimedAt !== null) {
        throw new Error("Already claimed");
      }
      if (!data.unlockedAt) throw new Error("Not unlocked yet");

      transaction.update(userAchievementRef, { claimedAt: serverTimestamp() });
      transaction.update(userRef, {
        totalXP: increment(achievement.xpReward),
      });
    });

    await addXPLog(userId, achievement.xpReward, `Claimed achievement: ${achievement.title}`, "achievement");

    const notifQuery = query(
      collection(db, "notifications"),
      where("userId", "==", userId),
      where("metadata.achievementId", "==", achievementId),
      where("metadata.claimable", "==", true)
    );
    const notifSnap = await getDocs(notifQuery);
    for (const doc of notifSnap.docs) {
      await updateDoc(doc.ref, { "metadata.claimed": true, isRead: true });
    }

    return { success: true, xpEarned: achievement.xpReward };
  } catch (err: any) {
    return { success: false, message: err.message };
  }
}

async function createAchievementNotification(userId: string, achievement: AchievementDef): Promise<void> {
  await sendNotification(
    userId,
    "achievement_unlocked",
    `🏆 Achievement Unlocked: ${achievement.title}`,
    `${achievement.description}. Reward: +${achievement.xpReward} XP. Click to claim.`,
    "/profile",
    { achievementId: achievement.id, reward: achievement.xpReward, claimable: true, claimed: false }
  );
}

// ✅ NEW-1: Parallelize unlockAchievement calls
export async function checkAndUnlockAchievements(
  userId: string,
  stats: {
    sessions: number;
    focusScore: number;
    noPause: boolean;
    streak?: number;
    totalMinutes?: number;
  }
): Promise<AchievementDef[]> {
  const defs = await getAchievementDefinitions();
  const unlockedMap = new Map((await getUserAchievements(userId)).map(a => [a.achievementId, a]));
  const newlyUnlocked: AchievementDef[] = [];
  const unlockPromises: Promise<void>[] = [];

  for (const def of defs) {
    const existing = unlockedMap.get(def.id);
    if (existing && existing.claimedAt !== undefined) continue;
    if (existing && existing.unlockedAt) continue;
    
    let isUnlocked = false;
    const condition = def.criteria;
    
    switch (condition.type) {
      case 'sessions':
        isUnlocked = stats.sessions >= condition.threshold;
        break;
      case 'focusScore':
        isUnlocked = stats.focusScore >= condition.threshold;
        break;
      case 'noPause':
        isUnlocked = stats.noPause === (condition.threshold === 1);
        break;
      case 'streak':
        isUnlocked = (stats.streak || 0) >= condition.threshold;
        break;
      case 'totalMinutes':
        isUnlocked = (stats.totalMinutes || 0) >= condition.threshold;
        break;
    }
    
    if (isUnlocked) {
      // ✅ Thêm vào promise array thay vì await
      unlockPromises.push(unlockAchievement(userId, def, 100).then(() => {
        newlyUnlocked.push(def);
      }));
    }
  }

  // ✅ Chạy tất cả unlock song song
  if (unlockPromises.length > 0) {
    await Promise.all(unlockPromises);
  }
  
  return newlyUnlocked;
}

// Legacy function with same parallel fix
export async function checkAndUnlockAchievementsLegacy(
  userId: string,
  eventType: string,
  currentValue: number,
  userStats: any
): Promise<AchievementDef[]> {
  const defs = await getAchievementDefinitions();
  const unlockedMap = new Map((await getUserAchievements(userId)).map(a => [a.achievementId, a]));
  const newlyUnlocked: AchievementDef[] = [];
  const unlockPromises: Promise<void>[] = [];

  for (const def of defs) {
    const existing = unlockedMap.get(def.id);
    if (existing && existing.claimedAt !== undefined) continue;
    if (existing && existing.unlockedAt) continue;
    if (def.criteria.type !== eventType) continue;
    if (currentValue >= def.criteria.threshold) {
      unlockPromises.push(unlockAchievement(userId, def, currentValue).then(() => {
        newlyUnlocked.push(def);
      }));
    }
  }

  if (unlockPromises.length > 0) {
    await Promise.all(unlockPromises);
  }
  return newlyUnlocked;
}
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
  category: string;
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

let achievementDefsCache: AchievementDef[] | null = null;

export async function getAchievementDefinitions(): Promise<AchievementDef[]> {
  if (achievementDefsCache) return achievementDefsCache;
  const snapshot = await getDocs(collection(db, "achievements"));
  achievementDefsCache = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AchievementDef));
  return achievementDefsCache;
}

export async function getUserAchievements(userId: string): Promise<UserAchievement[]> {
  const q = query(collection(db, "userAchievements"), where("userId", "==", userId));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({
    userId: doc.data().userId,
    achievementId: doc.data().achievementId,
    unlockedAt: doc.data().unlockedAt.toDate(),
    claimedAt: doc.data().claimedAt?.toDate() || null,
    progress: doc.data().progress,
  }));
}

export async function isAchievementUnlocked(userId: string, achievementId: string): Promise<boolean> {
  const docRef = doc(db, "userAchievements", `${userId}_${achievementId}`);
  const snap = await getDoc(docRef);
  return snap.exists() && snap.data().unlockedAt !== undefined;
}

// 🔁 UNLOCK (không cộng XP)
export async function unlockAchievement(
  userId: string,
  achievementDef: AchievementDef,
  currentProgress: number
): Promise<void> {
  const userAchievementId = `${userId}_${achievementDef.id}`;
  const userAchievementRef = doc(db, "userAchievements", userAchievementId);
  const existing = await getDoc(userAchievementRef);
  if (existing.exists() && existing.data().claimedAt !== undefined) return;
  if (existing.exists() && existing.data().unlockedAt !== undefined) return;

  await setDoc(userAchievementRef, {
    userId,
    achievementId: achievementDef.id,
    unlockedAt: serverTimestamp(),
    claimedAt: null,
    progress: currentProgress,
  });

  // Tạo notification để claim
  await createAchievementNotification(userId, achievementDef);
}

// ✅ CLAIM REWARD (cộng XP)
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

      // 1. Cập nhật claimedAt
      transaction.update(userAchievementRef, { claimedAt: serverTimestamp() });

      // 2. Cộng XP
      transaction.update(userRef, {
        totalXP: increment(achievement.xpReward),
      });
    });

    // Ghi log XP (sau transaction)
    await addXPLog(userId, achievement.xpReward, `Claimed achievement: ${achievement.title}`, "achievement");

    // Đánh dấu notification liên quan đã được claim (nếu muốn)
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

export async function checkAndUnlockAchievements(
  userId: string,
  eventType: string,
  currentValue: number,
  userStats: any
): Promise<AchievementDef[]> {
  const defs = await getAchievementDefinitions();
  const unlockedMap = new Map((await getUserAchievements(userId)).map(a => [a.achievementId, a]));
  const newlyUnlocked: AchievementDef[] = [];

  for (const def of defs) {
    const existing = unlockedMap.get(def.id);
    if (existing && existing.claimedAt !== undefined) continue; // already claimed
    if (existing && existing.unlockedAt) continue; // already unlocked but not claimed
    if (def.criteria.type !== eventType) continue;
    if (currentValue >= def.criteria.threshold) {
      await unlockAchievement(userId, def, currentValue);
      newlyUnlocked.push(def);
    }
  }
  return newlyUnlocked;
}
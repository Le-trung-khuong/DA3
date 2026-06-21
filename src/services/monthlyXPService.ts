// src/services/monthlyXPService.ts
import { db } from "../utils/config";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  Timestamp,
  limit,
  orderBy,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";

/**
 * Lấy tổng XP của user trong tháng hiện tại
 */
export async function getUserMonthlyXP(userId: string): Promise<number> {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  const q = query(
    collection(db, "xp_logs"),
    where("userId", "==", userId),
    where("timestamp", ">=", Timestamp.fromDate(startOfMonth)),
    where("timestamp", "<=", Timestamp.fromDate(endOfMonth))
  );
  const snapshot = await getDocs(q);
  let total = 0;
  snapshot.forEach((doc) => {
    const amount = doc.data().amount;
    if (amount > 0) total += amount;
  });
  return total;
}

/**
 * Lấy leaderboard tháng này sử dụng cache collection
 */
export async function getAllUsersMonthlyXP(limitCount = 100): Promise<{ userId: string; monthlyXP: number; displayName: string; email: string }[]> {
  const now = new Date();
  const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const cacheDocId = `monthly_${yearMonth}`;
  const cacheRef = doc(db, "leaderboard_cache", cacheDocId);

  const cacheSnap = await getDoc(cacheRef);
  if (cacheSnap.exists()) {
    const data = cacheSnap.data();
    if (data.expiresAt && data.expiresAt.toDate() > new Date()) {
      const users = data.users || [];
      return users.slice(0, limitCount);
    }
  }

  console.warn("[MonthlyXP] Cache miss, using fallback query (limited to 200 users)");
  const usersSnap = await getDocs(query(collection(db, "users"), limit(200)));
  const users = usersSnap.docs.map((doc) => ({
    userId: doc.id,
    displayName: doc.data().displayName || doc.data().name || "Unknown",
    email: doc.data().email || "",
  }));

  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  const logsQuery = query(
    collection(db, "xp_logs"),
    where("timestamp", ">=", Timestamp.fromDate(startOfMonth)),
    where("timestamp", "<=", Timestamp.fromDate(endOfMonth)),
    orderBy("timestamp", "desc"),
    limit(5000)
  );
  const logsSnap = await getDocs(logsQuery);
  const monthlyXPMap = new Map<string, number>();
  logsSnap.forEach((docSnap) => {
    const data = docSnap.data();
    const uid = data.userId;
    const amount = data.amount > 0 ? data.amount : 0;
    monthlyXPMap.set(uid, (monthlyXPMap.get(uid) || 0) + amount);
  });

  const result = users
    .map((user) => ({
      ...user,
      monthlyXP: monthlyXPMap.get(user.userId) || 0,
    }))
    .sort((a, b) => b.monthlyXP - a.monthlyXP)
    .slice(0, limitCount);

  await setDoc(cacheRef, {
    users: result,
    expiresAt: Timestamp.fromDate(new Date(Date.now() + 5 * 60 * 1000)),
    updatedAt: serverTimestamp(),
  }).catch((e) => console.error("Failed to write cache:", e));

  return result;
}
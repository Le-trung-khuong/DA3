// src/services/monthlyXPService.ts
import { db } from "../utils/config";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  setDoc,
  Timestamp,
} from "firebase/firestore";

/**
 * Tính tổng XP của user trong tháng hiện tại từ xp_logs
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
 * Lấy tất cả user kèm monthly XP (dùng cho leaderboard)
 */
export async function getAllUsersMonthlyXP(limitCount = 100): Promise<{ userId: string; monthlyXP: number; displayName: string; email: string }[]> {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  // Lấy tất cả user
  const usersSnap = await getDocs(collection(db, "users"));
  const users = usersSnap.docs.map((doc) => ({
    userId: doc.id,
    displayName: doc.data().displayName || doc.data().name || "Unknown",
    email: doc.data().email || "",
  }));

  // Lấy tất cả xp_logs trong tháng
  const logsQuery = query(
    collection(db, "xp_logs"),
    where("timestamp", ">=", Timestamp.fromDate(startOfMonth)),
    where("timestamp", "<=", Timestamp.fromDate(endOfMonth))
  );
  const logsSnap = await getDocs(logsQuery);

  // Tổng hợp XP theo userId
  const monthlyXPMap = new Map<string, number>();
  logsSnap.forEach((doc) => {
    const data = doc.data();
    const userId = data.userId;
    const amount = data.amount > 0 ? data.amount : 0;
    monthlyXPMap.set(userId, (monthlyXPMap.get(userId) || 0) + amount);
  });

  const result = users
    .map((user) => ({
      ...user,
      monthlyXP: monthlyXPMap.get(user.userId) || 0,
    }))
    .sort((a, b) => b.monthlyXP - a.monthlyXP)
    .slice(0, limitCount);

  return result;
}
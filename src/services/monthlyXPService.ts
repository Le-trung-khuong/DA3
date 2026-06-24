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
  runTransaction,
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
 * Lấy leaderboard tháng này với cache + stampede protection
 * ✅ NEW-4: Dùng transaction để tránh cache stampede
 */
export async function getAllUsersMonthlyXP(limitCount = 100): Promise<{ userId: string; monthlyXP: number; displayName: string; email: string }[]> {
  const now = new Date();
  const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const cacheDocId = `monthly_${yearMonth}`;
  const cacheRef = doc(db, "leaderboard_cache", cacheDocId);

  // Thử đọc cache
  const cacheSnap = await getDoc(cacheRef);
  if (cacheSnap.exists()) {
    const data = cacheSnap.data();
    if (data.expiresAt && data.expiresAt.toDate() > new Date()) {
      return data.users.slice(0, limitCount);
    }
  }

  // ✅ Dùng transaction để chỉ 1 request được refresh cache
  try {
    const result = await runTransaction(db, async (transaction) => {
      const freshCacheSnap = await transaction.get(cacheRef);
      if (freshCacheSnap.exists()) {
        const data = freshCacheSnap.data();
        if (data.expiresAt && data.expiresAt.toDate() > new Date()) {
          return data.users.slice(0, limitCount);
        }
      }

      // Cache miss – tính toán
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

      // Lấy tất cả user (có thể phân trang, nhưng ở đây giới hạn 1000 user cho leaderboard)
      // ✅ NEW-4: Lấy user có orderBy để deterministic
      const usersSnap = await getDocs(query(collection(db, "users"), orderBy("totalXP", "desc"), limit(1000)));
      const users = usersSnap.docs.map((doc) => ({
        userId: doc.id,
        displayName: doc.data().displayName || doc.data().name || "Unknown",
        email: doc.data().email || "",
      }));

      // Lấy logs tháng
      const logsQuery = query(
        collection(db, "xp_logs"),
        where("timestamp", ">=", Timestamp.fromDate(startOfMonth)),
        where("timestamp", "<=", Timestamp.fromDate(endOfMonth)),
        orderBy("timestamp", "desc"),
        limit(10000)
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

      // Update cache với TTL 10 phút
      transaction.set(cacheRef, {
        users: result,
        expiresAt: Timestamp.fromDate(new Date(Date.now() + 10 * 60 * 1000)),
        updatedAt: serverTimestamp(),
      });

      return result;
    });

    if (result) return result;
  } catch (e) {
    console.warn("[MonthlyXP] Cache refresh transaction failed:", e);
  }

  // Fallback: nếu transaction fail, trả về cache cũ (dù expired) thay vì crash
  if (cacheSnap.exists()) {
    const data = cacheSnap.data();
    return data.users.slice(0, limitCount);
  }

  // Ultimate fallback: query trực tiếp nhưng giới hạn 200 user
  console.warn("[MonthlyXP] Ultimate fallback query (limited)");
  const fallbackUsers = await getDocs(query(collection(db, "users"), orderBy("totalXP", "desc"), limit(200)));
  // ... tính toán đơn giản
  return fallbackUsers.docs.map(doc => ({
    userId: doc.id,
    displayName: doc.data().displayName || "Unknown",
    email: doc.data().email || "",
    monthlyXP: 0, // không có log => 0
  }));
}
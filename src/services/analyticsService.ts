/**
 * src/services/analyticsService.ts
 * Aggregate analytics from Firestore collections
 * Used by Admin Dashboard
 */

import { db } from "../utils/config";
import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
  type QueryDocumentSnapshot,
  type DocumentData,
} from "firebase/firestore";

// ============ TYPES ============
export interface RevenueStats {
  todayRevenue: number;
  monthlyRevenue: number;
  yearlyRevenue: number;
  totalRevenue: number;
  todayCount: number;
  monthlyCount: number;
  yearlyCount: number;
  totalCount: number;
}

export interface TransactionStats {
  pending: number;
  processing: number;
  success: number;
  failed: number;
  refunded: number;
  cancelled: number;
}

export interface TopCourse {
  id: string;
  title: string;
  price: number;
  totalSold: number;      // from transactions success
  totalRevenue: number;
  totalEnrollments: number;
  rating: number;
  ratingCount: number;
}

export interface TopUser {
  uid: string;
  displayName: string;
  email: string;
  totalSpent: number;
  totalXP: number;
  enrollmentCount: number;
}

export interface RevenuePoint {
  date: string; // YYYY-MM-DD
  revenue: number;
  count: number;
}

// ============ HELPERS ============
const startOfDay = (date: Date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return Timestamp.fromDate(d);
};

const endOfDay = (date: Date) => {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return Timestamp.fromDate(d);
};

const startOfMonth = (date: Date) => {
  const d = new Date(date.getFullYear(), date.getMonth(), 1);
  return Timestamp.fromDate(d);
};

const startOfYear = (date: Date) => {
  const d = new Date(date.getFullYear(), 0, 1);
  return Timestamp.fromDate(d);
};

// ============ REVENUE STATS ============
export async function getRevenueStats(): Promise<RevenueStats> {
  const now = new Date();
  const todayStart = startOfDay(now);
  const monthStart = startOfMonth(now);
  const yearStart = startOfYear(now);

  // Query all success transactions
  const q = query(
    collection(db, "transactions"),
    where("status", "==", "success")
  );
  const snapshot = await getDocs(q);

  let todayRevenue = 0, todayCount = 0;
  let monthlyRevenue = 0, monthlyCount = 0;
  let yearlyRevenue = 0, yearlyCount = 0;
  let totalRevenue = 0, totalCount = 0;

  snapshot.forEach((doc) => {
    const data = doc.data();
    const amount = data.amount || 0;
    const createdAt = data.paidAt || data.createdAt;
    if (!createdAt) return;

    const date = createdAt.toDate();
    totalRevenue += amount;
    totalCount++;

    if (date >= todayStart.toDate()) {
      todayRevenue += amount;
      todayCount++;
    }
    if (date >= monthStart.toDate()) {
      monthlyRevenue += amount;
      monthlyCount++;
    }
    if (date >= yearStart.toDate()) {
      yearlyRevenue += amount;
      yearlyCount++;
    }
  });

  return {
    todayRevenue,
    monthlyRevenue,
    yearlyRevenue,
    totalRevenue,
    todayCount,
    monthlyCount,
    yearlyCount,
    totalCount,
  };
}

// ============ TRANSACTION STATUS STATS ============
export async function getTransactionStats(): Promise<TransactionStats> {
  const statuses = ["pending", "processing", "success", "failed", "refunded", "cancelled"];
  const stats = {} as TransactionStats;
  for (const s of statuses) {
    const q = query(collection(db, "transactions"), where("status", "==", s));
    const snap = await getDocs(q);
    stats[s as keyof TransactionStats] = snap.size;
  }
  return stats;
}

// ============ TOP COURSES ============
export async function getTopCourses(limitCount = 10): Promise<TopCourse[]> {
  // Get all success transactions and aggregate per course
  const txQuery = query(
    collection(db, "transactions"),
    where("status", "==", "success")
  );
  const txSnap = await getDocs(txQuery);
  const courseMap = new Map<string, { sold: number; revenue: number }>();

  txSnap.forEach((doc) => {
    const data = doc.data();
    const courseId = data.courseId;
    const amount = data.amount || 0;
    if (!courseId) return;
    const existing = courseMap.get(courseId) || { sold: 0, revenue: 0 };
    existing.sold++;
    existing.revenue += amount;
    courseMap.set(courseId, existing);
  });

  // Get course details
  const coursesSnap = await getDocs(collection(db, "courses"));
  const courseDetails = new Map();
  coursesSnap.forEach((doc) => {
    courseDetails.set(doc.id, { title: doc.data().title, price: doc.data().price, rating: doc.data().rating || 0, ratingCount: doc.data().ratingCount || 0 });
  });

  // Get enrollments per course (for totalEnrollments)
  const enrollSnap = await getDocs(collection(db, "enrollments"));
  const enrollmentCount = new Map<string, number>();
  enrollSnap.forEach((doc) => {
    const courseId = doc.data().courseId;
    if (courseId) enrollmentCount.set(courseId, (enrollmentCount.get(courseId) || 0) + 1);
  });

  const result: TopCourse[] = [];
  for (const [courseId, { sold, revenue }] of courseMap.entries()) {
    const details = courseDetails.get(courseId);
    if (!details) continue;
    result.push({
      id: courseId,
      title: details.title || "Unknown",
      price: details.price || 0,
      totalSold: sold,
      totalRevenue: revenue,
      totalEnrollments: enrollmentCount.get(courseId) || 0,
      rating: details.rating || 0,
      ratingCount: details.ratingCount || 0,
    });
  }
  // Sort by revenue descending
  result.sort((a, b) => b.totalRevenue - a.totalRevenue);
  return result.slice(0, limitCount);
}

// ============ TOP USERS ============
export async function getTopUsers(limitCount = 10): Promise<TopUser[]> {
  // Aggregate from transactions success per user
  const txQuery = query(
    collection(db, "transactions"),
    where("status", "==", "success")
  );
  const txSnap = await getDocs(txQuery);
  const userSpent = new Map<string, number>();
  const userCourses = new Map<string, Set<string>>();

  txSnap.forEach((doc) => {
    const data = doc.data();
    const userId = data.userId;
    const amount = data.amount || 0;
    const courseId = data.courseId;
    if (!userId) return;
    userSpent.set(userId, (userSpent.get(userId) || 0) + amount);
    if (courseId) {
      if (!userCourses.has(userId)) userCourses.set(userId, new Set());
      userCourses.get(userId)!.add(courseId);
    }
  });

  // Fetch user details
  const usersSnap = await getDocs(collection(db, "users"));
  const userMap = new Map();
  usersSnap.forEach((doc) => {
    userMap.set(doc.id, {
      displayName: doc.data().displayName || doc.data().name || "Anonymous",
      email: doc.data().email || "",
      totalXP: doc.data().totalXP || 0,
    });
  });

  const result: TopUser[] = [];
  for (const [uid, totalSpent] of userSpent.entries()) {
    const details = userMap.get(uid);
    if (!details) continue;
    result.push({
      uid,
      displayName: details.displayName,
      email: details.email,
      totalSpent,
      totalXP: details.totalXP,
      enrollmentCount: userCourses.get(uid)?.size || 0,
    });
  }
  result.sort((a, b) => b.totalSpent - a.totalSpent);
  return result.slice(0, limitCount);
}

// ============ REVENUE TREND ============
export async function getRevenueTrend(days = 30): Promise<RevenuePoint[]> {
  const now = new Date();
  const startDate = new Date(now);
  startDate.setDate(now.getDate() - days);
  startDate.setHours(0, 0, 0, 0);
  const startTimestamp = Timestamp.fromDate(startDate);

  const q = query(
    collection(db, "transactions"),
    where("status", "==", "success"),
    where("createdAt", ">=", startTimestamp)
  );
  const snapshot = await getDocs(q);
  const dailyMap = new Map<string, { revenue: number; count: number }>();

  // Initialize last `days` days with zero
  for (let i = 0; i < days; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    const key = d.toISOString().split("T")[0];
    dailyMap.set(key, { revenue: 0, count: 0 });
  }

  snapshot.forEach((doc) => {
    const data = doc.data();
    const amount = data.amount || 0;
    const paidAt = data.paidAt || data.createdAt;
    if (!paidAt) return;
    const date = paidAt.toDate();
    const key = date.toISOString().split("T")[0];
    const existing = dailyMap.get(key);
    if (existing) {
      existing.revenue += amount;
      existing.count++;
    } else {
      dailyMap.set(key, { revenue: amount, count: 1 });
    }
  });

  // Convert to array and sort by date ascending
  const result = Array.from(dailyMap.entries()).map(([date, { revenue, count }]) => ({
    date,
    revenue,
    count,
  }));
  result.sort((a, b) => a.date.localeCompare(b.date));
  return result;
}

// ============ USER STATS SUMMARY ============
export interface UserStats {
  totalUsers: number;
  newUsersLast30Days: number;
  premiumUsers: number;   // users who spent > 0
  totalXPAll: number;
  avgXP: number;
}

export async function getUserStats(): Promise<UserStats> {
  const usersSnap = await getDocs(collection(db, "users"));
  let totalUsers = 0;
  let newUsers30 = 0;
  let premiumUsers = 0;
  let totalXP = 0;
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  usersSnap.forEach((doc) => {
    const data = doc.data();
    totalUsers++;
    const createdAt = data.createdAt?.toDate();
    if (createdAt && createdAt >= thirtyDaysAgo) newUsers30++;
    if ((data.totalSpent || 0) > 0) premiumUsers++;
    totalXP += data.totalXP || 0;
  });

  return {
    totalUsers,
    newUsersLast30Days: newUsers30,
    premiumUsers,
    totalXPAll: totalXP,
    avgXP: totalUsers ? Math.round(totalXP / totalUsers) : 0,
  };
}
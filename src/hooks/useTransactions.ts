/**
 * src/hooks/useTransactions.ts
 * Custom hook for realtime Firestore transactions with filtering & pagination
 * FIX: tránh re-run effect do object options thay đổi, thêm log, ưu tiên hiển thị dữ liệu
 */

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { db } from "../utils/config";
import {
  collection,
  query,
  orderBy,
  where,
  onSnapshot,
  Timestamp,
  QueryConstraint,
  limit,
} from "firebase/firestore";
import type { Transaction, TransactionStatus } from "../types/transaction";

export interface UseTransactionsOptions {
  status?: TransactionStatus | "all";
  courseId?: string;
  userId?: string;
  startDate?: Date;
  endDate?: Date;
  search?: string;
  limit?: number;
}

export function useTransactions(options: UseTransactionsOptions = {}) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  
  // Dùng ref để lưu options tránh re-run effect không cần thiết
  const optionsRef = useRef(options);
  optionsRef.current = options;

  // Tạo constraints ổn định dựa trên các giá trị nguyên thuỷ
  const constraintsKey = useMemo(() => {
    return JSON.stringify({
      status: options.status === "all" ? undefined : options.status,
      courseId: options.courseId,
      userId: options.userId,
      startDate: options.startDate?.toISOString(),
      endDate: options.endDate?.toISOString(),
      limit: options.limit,
    });
  }, [options.status, options.courseId, options.userId, options.startDate, options.endDate, options.limit]);

  useEffect(() => {
    setLoading(true);
    const opts = optionsRef.current;
    const constraints: QueryConstraint[] = [orderBy("createdAt", "desc")];
    if (opts.status && opts.status !== "all") {
      constraints.push(where("status", "==", opts.status));
    }
    if (opts.courseId) {
      constraints.push(where("courseId", "==", opts.courseId));
    }
    if (opts.userId) {
      constraints.push(where("userId", "==", opts.userId));
    }
    if (opts.startDate) {
      constraints.push(where("createdAt", ">=", Timestamp.fromDate(opts.startDate)));
    }
    if (opts.endDate) {
      constraints.push(where("createdAt", "<=", Timestamp.fromDate(opts.endDate)));
    }
    if (opts.limit) {
      constraints.push(limit(opts.limit));
    }

    const q = query(collection(db, "transactions"), ...constraints);
    console.log("[useTransactions] Listening to query, constraintsKey:", constraintsKey);

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        console.log("[useTransactions] Snapshot size:", snapshot.size);
        let data = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Transaction[];
        if (opts.search) {
          const searchLower = opts.search.toLowerCase();
          data = data.filter(
            (tx) =>
              tx.userName?.toLowerCase().includes(searchLower) ||
              tx.userEmail?.toLowerCase().includes(searchLower) ||
              tx.courseName?.toLowerCase().includes(searchLower) ||
              tx.id.toLowerCase().includes(searchLower)
          );
        }
        setTransactions(data);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error("[useTransactions] onSnapshot error:", err);
        setError(err);
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, [constraintsKey]); // chỉ chạy lại khi constraintsKey thay đổi

  return { transactions, loading, error };
}
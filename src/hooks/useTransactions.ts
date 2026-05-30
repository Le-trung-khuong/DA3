/**
 * src/hooks/useTransactions.ts
 * Custom hook for realtime Firestore transactions with filtering & pagination
 */

import { useState, useEffect, useMemo, useCallback } from "react";
import { db } from "../utils/config";
import {
  collection,
  query,
  orderBy,
  where,
  onSnapshot,
  Timestamp,
  QueryConstraint,
} from "firebase/firestore";
import type { Transaction, TransactionStatus } from "../types/transaction";

export interface UseTransactionsOptions {
  status?: TransactionStatus | "all";
  courseId?: string;
  userId?: string;
  startDate?: Date;
  endDate?: Date;
  search?: string; // search in userName, userEmail, courseName
  limit?: number;
}

export function useTransactions(options: UseTransactionsOptions = {}) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const buildConstraints = useCallback((): QueryConstraint[] => {
    const constraints: QueryConstraint[] = [orderBy("createdAt", "desc")];
    if (options.status && options.status !== "all") {
      constraints.push(where("status", "==", options.status));
    }
    if (options.courseId) {
      constraints.push(where("courseId", "==", options.courseId));
    }
    if (options.userId) {
      constraints.push(where("userId", "==", options.userId));
    }
    if (options.startDate) {
      constraints.push(where("createdAt", ">=", Timestamp.fromDate(options.startDate)));
    }
    if (options.endDate) {
      constraints.push(where("createdAt", "<=", Timestamp.fromDate(options.endDate)));
    }
    if (options.limit) {
      constraints.push(limit(options.limit));
    }
    return constraints;
  }, [options]);

  useEffect(() => {
    setLoading(true);
    const constraints = buildConstraints();
    const q = query(collection(db, "transactions"), ...constraints);
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        let data = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Transaction[];
        // Client-side search (since Firestore doesn't support partial match on multiple fields)
        if (options.search) {
          const searchLower = options.search.toLowerCase();
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
        console.error("useTransactions error:", err);
        setError(err);
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, [buildConstraints, options.search]);

  return { transactions, loading, error };
}
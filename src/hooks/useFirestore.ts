/**
 * src/hooks/useFirestore.ts
 * Generic Firestore realtime hooks (real Firebase)
 */

"use client";

import { useState, useEffect, useCallback, useRef, type DependencyList } from "react";
import { db } from "../utils/config";
import {
  doc, collection, onSnapshot, getDoc, getDocs,
  query, QueryConstraint, startAfter, limit,
  DocumentSnapshot, QuerySnapshot,
  DocumentData, Query, CollectionReference,
  type FirebaseError,
} from "firebase/firestore";

export interface FirestoreState<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  refetch: () => void;
}

export interface FirestoreListState<T> {
  data: T[];
  loading: boolean;
  error: Error | null;
  refetch: () => void;
}

// useDocument – realtime
export function useDocument<T extends Record<string, unknown>>(
  collectionPath: string,
  docId: string | null | undefined,
): FirestoreState<T & { id: string }> {
  const [data, setData] = useState<(T & { id: string }) | null>(null);
  const [loading, setLoading] = useState(Boolean(docId));
  const [error, setError] = useState<Error | null>(null);
  const [tick, setTick] = useState(0);
  const refetch = useCallback(() => setTick((n) => n + 1), []);

  useEffect(() => {
    if (!docId) {
      setData(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const ref = doc(db, collectionPath, docId);
    const unsub = onSnapshot(
      ref,
      (snap: DocumentSnapshot<DocumentData>) => {
        if (snap.exists()) {
          setData({ id: snap.id, ...(snap.data() as T) });
        } else {
          setData(null);
          setError(new Error(`Document ${collectionPath}/${docId} not found`));
        }
        setLoading(false);
      },
      (err: FirebaseError) => {
        setError(err);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [collectionPath, docId, tick]);

  return { data, loading, error, refetch };
}

// useCollection – realtime với query constraints
export function useCollection<T extends Record<string, unknown>>(
  collectionPath: string,
  constraints: QueryConstraint[] = [],
  deps: DependencyList = [],
): FirestoreListState<T & { id: string }> {
  const [data, setData] = useState<(T & { id: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [tick, setTick] = useState(0);
  const refetch = useCallback(() => setTick((n) => n + 1), []);

  useEffect(() => {
    setLoading(true);
    setError(null);
    const ref = collection(db, collectionPath) as CollectionReference<T>;
    const q = query(ref, ...constraints);
    const unsub = onSnapshot(
      q,
      (snap: QuerySnapshot<T>) => {
        setData(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
      (err: FirebaseError) => {
        setError(err);
        setLoading(false);
      }
    );
    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collectionPath, tick, ...deps]);

  return { data, loading, error, refetch };
}

export const useRealtimeQuery = useCollection;

// usePaginatedQuery (cursor-based)
export function usePaginatedQuery<T extends Record<string, unknown>>(
  collectionPath: string,
  constraints: QueryConstraint[] = [],
  pageSize = 10,
) {
  const [pages, setPages] = useState<(T & { id: string })[][]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const cursorRef = useRef<DocumentSnapshot | null>(null);

  const loadPage = useCallback(async (reset = false) => {
    setLoading(true);
    setError(null);

    const constraintsWithLimit = [...constraints];
    if (!reset && cursorRef.current) {
      constraintsWithLimit.push(startAfter(cursorRef.current));
    }
    constraintsWithLimit.push(limit(pageSize));

    const ref = collection(db, collectionPath);
    const q = query(ref, ...constraintsWithLimit);
    const snap = await getDocs(q);
    const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as (T & { id: string })[];
    cursorRef.current = snap.docs[snap.docs.length - 1] ?? null;

    if (reset) {
      setPages([docs]);
    } else {
      setPages((prev) => [...prev, docs]);
    }
    setHasMore(docs.length === pageSize);
    setLoading(false);
  }, [collectionPath, constraints, pageSize]);

  useEffect(() => {
    void loadPage(true);
  }, [loadPage]);

  const loadMore = () => {
    if (!loading && hasMore) void loadPage(false);
  };
  const refetch = () => {
    cursorRef.current = null;
    void loadPage(true);
  };

  const data = pages.flat();
  return { data, loading, error, hasMore, loadMore, refetch };
}

// useDocumentOnce
export function useDocumentOnce<T extends Record<string, unknown>>(
  collectionPath: string,
  docId: string | null | undefined,
): FirestoreState<T & { id: string }> {
  const [data, setData] = useState<(T & { id: string }) | null>(null);
  const [loading, setLoading] = useState(Boolean(docId));
  const [error, setError] = useState<Error | null>(null);
  const [tick, setTick] = useState(0);
  const refetch = useCallback(() => setTick((n) => n + 1), []);

  useEffect(() => {
    if (!docId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    getDoc(doc(db, collectionPath, docId))
      .then((snap) => {
        if (snap.exists()) {
          setData({ id: snap.id, ...(snap.data() as T) });
        } else {
          setError(new Error("Not found"));
        }
        setLoading(false);
      })
      .catch((err) => {
        setError(err);
        setLoading(false);
      });
  }, [collectionPath, docId, tick]);

  return { data, loading, error, refetch };
}

// useCollectionOnce
export function useCollectionOnce<T extends Record<string, unknown>>(
  collectionPath: string,
  constraints: QueryConstraint[] = [],
): FirestoreListState<T & { id: string }> {
  const [data, setData] = useState<(T & { id: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [tick, setTick] = useState(0);
  const refetch = useCallback(() => setTick((n) => n + 1), []);

  useEffect(() => {
    setLoading(true);
    const ref = collection(db, collectionPath);
    const q = query(ref, ...constraints);
    getDocs(q)
      .then((snap) => {
        setData(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoading(false);
      })
      .catch((err) => {
        setError(err);
        setLoading(false);
      });
  }, [collectionPath, tick]);

  return { data, loading, error, refetch };
}
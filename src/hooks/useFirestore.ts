/**
 * src/hooks/useFirestore.ts
 * ─────────────────────────────────────────────────────────────
 * Generic Firestore realtime hooks. Dùng được ở bất kỳ component nào.
 *
 * Exports:
 *   useDocument<T>       – lắng nghe 1 document (onSnapshot)
 *   useCollection<T>     – lắng nghe toàn bộ collection với query
 *   useRealtimeQuery<T>  – alias of useCollection, cho phép query động
 *   usePaginatedQuery<T> – phân trang (startAfter cursor)
 *   useDocumentOnce<T>   – getDoc (1 lần, không realtime)
 *   useCollectionOnce<T> – getDocs (1 lần, không realtime)
 *
 * Tất cả đều trả về { data, loading, error, refetch }.
 *
 * Firebase imports bị comment để không build lỗi khi chạy mock.
 * Uncomment khi deploy production.
 */

"use client";

import { useState, useEffect, useCallback, useRef, type DependencyList } from "react";

// ─── Firebase (uncomment in production) ────────────────────────────────────────
// import { db }          from "@/firebase/config";
// import {
//   doc, collection,
//   onSnapshot, getDoc, getDocs,
//   query, QueryConstraint, startAfter,
//   DocumentSnapshot, QuerySnapshot,
//   DocumentData, Query, CollectionReference,
//   type FirebaseError,
// } from "firebase/firestore";

// ─── Shared state shape ─────────────────────────────────────────────────────────

export interface FirestoreState<T> {
  data:     T | null;
  loading:  boolean;
  error:    Error | null;
  refetch:  () => void;
}

export interface FirestoreListState<T> {
  data:     T[];
  loading:  boolean;
  error:    Error | null;
  refetch:  () => void;
}

// ─── useDocument ───────────────────────────────────────────────────────────────

/**
 * Realtime listener for a single Firestore document.
 *
 * @example
 * const { data: user, loading } = useDocument<UserProfile>("users", userId);
 */
export function useDocument<T extends Record<string, unknown>>(
  collectionPath: string,
  docId: string | null | undefined,
): FirestoreState<T & { id: string }> {
  const [data,    setData]    = useState<(T & { id: string }) | null>(null);
  const [loading, setLoading] = useState(Boolean(docId));
  const [error,   setError]   = useState<Error | null>(null);
  const [tick,    setTick]    = useState(0);

  const refetch = useCallback(() => setTick((n) => n + 1), []);

  useEffect(() => {
    if (!docId) { setData(null); setLoading(false); return; }

    setLoading(true); setError(null);

    // ── REAL FIREBASE ────────────────────────────────────────────────────────
    // const ref  = doc(db, collectionPath, docId);
    // const unsub = onSnapshot(
    //   ref,
    //   (snap: DocumentSnapshot<DocumentData>) => {
    //     if (snap.exists()) {
    //       setData({ id: snap.id, ...(snap.data() as T) });
    //     } else {
    //       setData(null);
    //       setError(new Error(`Document ${collectionPath}/${docId} not found`));
    //     }
    //     setLoading(false);
    //   },
    //   (err) => { setError(err); setLoading(false); }
    // );
    // return () => unsub();
    // ─────────────────────────────────────────────────────────────────────────

    // Mock fallback
    const t = setTimeout(() => {
      setData({ id: docId } as T & { id: string });
      setLoading(false);
    }, 400);
    return () => clearTimeout(t);
  }, [collectionPath, docId, tick]);

  return { data, loading, error, refetch };
}

// ─── useCollection ─────────────────────────────────────────────────────────────

/**
 * Realtime listener for a Firestore collection with optional query constraints.
 *
 * @example
 * const { data: courses } = useCollection<Course>(
 *   "courses",
 *   [where("status","==","published"), orderBy("createdAt","desc"), limit(20)]
 * );
 */
export function useCollection<T extends Record<string, unknown>>(
  collectionPath: string,
  // constraints: QueryConstraint[] = [],
  _constraints: unknown[] = [],
  deps: DependencyList = [],
): FirestoreListState<T & { id: string }> {
  const [data,    setData]    = useState<(T & { id: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<Error | null>(null);
  const [tick,    setTick]    = useState(0);

  const refetch = useCallback(() => setTick((n) => n + 1), []);

  useEffect(() => {
    setLoading(true); setError(null);

    // ── REAL FIREBASE ────────────────────────────────────────────────────────
    // const ref  = collection(db, collectionPath) as CollectionReference<T>;
    // const q    = query(ref, ...constraints) as Query<T>;
    // const unsub = onSnapshot(
    //   q,
    //   (snap: QuerySnapshot<T>) => {
    //     setData(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    //     setLoading(false);
    //   },
    //   (err) => { setError(err); setLoading(false); }
    // );
    // return () => unsub();
    // ─────────────────────────────────────────────────────────────────────────

    const t = setTimeout(() => { setData([]); setLoading(false); }, 500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collectionPath, tick, ...deps]);

  return { data, loading, error, refetch };
}

/** Alias — semantically signals "dynamic query" */
export const useRealtimeQuery = useCollection;

// ─── usePaginatedQuery ─────────────────────────────────────────────────────────

/**
 * Cursor-based pagination using Firestore `startAfter`.
 *
 * @example
 * const { data, hasMore, loadMore, loading } = usePaginatedQuery<User>(
 *   "users",
 *   [orderBy("createdAt","desc")],
 *   10
 * );
 */
export function usePaginatedQuery<T extends Record<string, unknown>>(
  collectionPath: string,
  _constraints: unknown[] = [],
  pageSize = 10,
) {
  const [pages, setPages] = useState<(T & { id: string })[][]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore,  setHasMore] = useState(true);
  const [error,    setError]   = useState<Error | null>(null);

  // last document cursor (production: DocumentSnapshot)
  const cursorRef = useRef<unknown>(null);

  const loadPage = useCallback(async (reset = false) => {
    setLoading(true); setError(null);

    // ── REAL FIREBASE ────────────────────────────────────────────────────────
    // const constraints = [..._constraints];
    // if (!reset && cursorRef.current) constraints.push(startAfter(cursorRef.current));
    // constraints.push(limit(pageSize));
    // const ref = collection(db, collectionPath);
    // const q   = query(ref, ...constraints);
    // const snap = await getDocs(q);
    // const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as (T & { id: string })[];
    // cursorRef.current = snap.docs[snap.docs.length - 1] ?? null;
    // if (reset) setPages([docs]); else setPages((p) => [...p, docs]);
    // setHasMore(docs.length === pageSize);
    // setLoading(false);
    // ─────────────────────────────────────────────────────────────────────────

    await new Promise((r) => setTimeout(r, 400));
    if (reset) setPages([[]]);
    setHasMore(false);
    setLoading(false);
  }, [collectionPath, pageSize]);

  useEffect(() => { void loadPage(true); }, [loadPage]);

  const loadMore = () => { if (!loading && hasMore) loadPage(false); };
  const refetch  = () => { cursorRef.current = null; void loadPage(true); };

  const data = pages.flat();
  return { data, loading, error, hasMore, loadMore, refetch };
}

// ─── useDocumentOnce ───────────────────────────────────────────────────────────

/**
 * Fetch a document once (non-realtime). Use when you don't need live updates.
 */
export function useDocumentOnce<T extends Record<string, unknown>>(
  collectionPath: string,
  docId: string | null | undefined,
): FirestoreState<T & { id: string }> {
  const [data,    setData]    = useState<(T & { id: string }) | null>(null);
  const [loading, setLoading] = useState(Boolean(docId));
  const [error,   setError]   = useState<Error | null>(null);
  const [tick,    setTick]    = useState(0);

  const refetch = useCallback(() => setTick((n) => n + 1), []);

  useEffect(() => {
    if (!docId) { setLoading(false); return; }
    setLoading(true);

    // ── REAL FIREBASE ────────────────────────────────────────────────────────
    // getDoc(doc(db, collectionPath, docId)).then((snap) => {
    //   if (snap.exists()) setData({ id: snap.id, ...(snap.data() as T) });
    //   else setError(new Error("Not found"));
    //   setLoading(false);
    // }).catch((err) => { setError(err); setLoading(false); });
    // ─────────────────────────────────────────────────────────────────────────

    const t = setTimeout(() => { setData({ id: docId } as T & { id: string }); setLoading(false); }, 300);
    return () => clearTimeout(t);
  }, [collectionPath, docId, tick]);

  return { data, loading, error, refetch };
}

// ─── useCollectionOnce ─────────────────────────────────────────────────────────

/**
 * Fetch a collection once (non-realtime). Useful for dropdowns, selects.
 */
export function useCollectionOnce<T extends Record<string, unknown>>(
  collectionPath: string,
  _constraints: unknown[] = [],
): FirestoreListState<T & { id: string }> {
  const [data,    setData]    = useState<(T & { id: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<Error | null>(null);
  const [tick,    setTick]    = useState(0);

  const refetch = useCallback(() => setTick((n) => n + 1), []);

  useEffect(() => {
    setLoading(true);

    // ── REAL FIREBASE ────────────────────────────────────────────────────────
    // const ref = collection(db, collectionPath);
    // const q   = query(ref, ..._constraints);
    // getDocs(q).then((snap) => {
    //   setData(snap.docs.map((d) => ({ id: d.id, ...d.data() as T })));
    //   setLoading(false);
    // }).catch((err) => { setError(err); setLoading(false); });
    // ─────────────────────────────────────────────────────────────────────────

    const t = setTimeout(() => { setData([]); setLoading(false); }, 300);
    return () => clearTimeout(t);
  }, [collectionPath, tick]);

  return { data, loading, error, refetch };
}

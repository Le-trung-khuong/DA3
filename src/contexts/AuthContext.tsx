/**
 * src/contexts/AuthContext.tsx
 * ─────────────────────────────────────────────────────────────
 * Cung cấp:
 *   currentUser  – Firebase Auth user (or null)
 *   userProfile  – Firestore users/{uid} document (bao gồm role, status, displayName, …)
 *   role         – "admin" | "moderator" | "instructor" | "user" | null
 *   loading      – auth + role đã sẵn sàng chưa
 *   error        – FirebaseError nếu có
 *   logout       – gọi signOut(auth)
 *
 * Wrap toàn bộ app (hoặc ít nhất phần admin):
 *   <AuthProvider>
 *     <AdminRouteGuard>…</AdminRouteGuard>
 *   </AuthProvider>
 *
 * Realtime role listening: khi Firestore document users/{uid} thay đổi
 * (ví dụ admin nâng cấp role), state tự động cập nhật — không cần reload.
 */

"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import type { User, FirebaseError } from "firebase/auth";

// ─── Firebase (uncomment in production) ────────────────────────────────────────
// import { auth, db }     from "@/firebase/config";
// import { onAuthStateChanged, signOut } from "firebase/auth";
// import { doc, onSnapshot }             from "firebase/firestore";

// ─── Types ──────────────────────────────────────────────────────────────────────

export type UserRole = "admin" | "moderator" | "instructor" | "user";

export interface UserProfile {
  uid:          string;
  email:        string | null;
  displayName:  string | null;
  photoURL:     string | null;
  role:         UserRole;
  status:       "active" | "banned" | "suspended";
  level:        number;
  totalXP:      number;
  streakDays:   number;
  createdAt:    Date;
  lastActiveAt?: Date;
}

export interface AuthContextValue {
  currentUser:  User | null;
  userProfile:  UserProfile | null;
  role:         UserRole | null;
  loading:      boolean;
  error:        FirebaseError | null;
  logout:       () => Promise<void>;
  refreshRole:  () => void;          // manual re-fetch trigger
}

// ─── Mock data (development) ───────────────────────────────────────────────────

const MOCK_USER = {
  uid:         "admin_mock_001",
  email:       "admin@smartreview.vn",
  displayName: "Admin SR",
  photoURL:    null,
} as unknown as User;

const MOCK_PROFILE: UserProfile = {
  uid:          "admin_mock_001",
  email:        "admin@smartreview.vn",
  displayName:  "Admin SR",
  photoURL:     null,
  role:         "admin",
  status:       "active",
  level:        99,
  totalXP:      125_000,
  streakDays:   42,
  createdAt:    new Date("2024-01-01"),
  lastActiveAt: new Date(),
};

// ─── Context ────────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

// ─── Provider ──────────────────────────────────────────────────────────────────

interface AuthProviderProps { children: ReactNode; }

export function AuthProvider({ children }: AuthProviderProps) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState<FirebaseError | null>(null);
  const [refreshKey,  setRefreshKey]  = useState(0);

  // Keep ref to Firestore unsubscribe to cancel on user change
  const profileUnsubRef = useRef<(() => void) | null>(null);

  const logout = useCallback(async () => {
    // await signOut(auth);
    setCurrentUser(null);
    setUserProfile(null);
  }, []);

  const refreshRole = useCallback(() => setRefreshKey((k) => k + 1), []);

  useEffect(() => {
    // ── REAL FIREBASE ──────────────────────────────────────────────────────────
    //
    // const unsubAuth = onAuthStateChanged(auth, (user) => {
    //   setCurrentUser(user);
    //
    //   // Cancel previous Firestore listener
    //   profileUnsubRef.current?.();
    //   profileUnsubRef.current = null;
    //
    //   if (!user) {
    //     setUserProfile(null);
    //     setLoading(false);
    //     return;
    //   }
    //
    //   // Realtime role listener — picks up role changes without page reload
    //   const userRef = doc(db, "users", user.uid);
    //   const unsubProfile = onSnapshot(
    //     userRef,
    //     (snap) => {
    //       if (!snap.exists()) {
    //         setUserProfile(null);
    //         setError({ code: "not-found", message: "User document not found" } as FirebaseError);
    //       } else {
    //         const data = snap.data();
    //         setUserProfile({
    //           uid:          user.uid,
    //           email:        user.email,
    //           displayName:  data.displayName ?? user.displayName,
    //           photoURL:     data.photoURL    ?? user.photoURL,
    //           role:         data.role        ?? "user",
    //           status:       data.status      ?? "active",
    //           level:        data.level       ?? 1,
    //           totalXP:      data.totalXP     ?? 0,
    //           streakDays:   data.streakDays  ?? 0,
    //           createdAt:    data.createdAt?.toDate() ?? new Date(),
    //           lastActiveAt: data.lastActiveAt?.toDate(),
    //         });
    //         setError(null);
    //       }
    //       setLoading(false);
    //     },
    //     (err) => {
    //       console.error("[AuthContext] Firestore error:", err);
    //       setError(err as FirebaseError);
    //       setLoading(false);
    //     }
    //   );
    //   profileUnsubRef.current = unsubProfile;
    // });
    //
    // return () => { unsubAuth(); profileUnsubRef.current?.(); };
    // ──────────────────────────────────────────────────────────────────────────

    // Mock auth (remove in production)
    const t = setTimeout(() => {
      setCurrentUser(MOCK_USER);
      setUserProfile(MOCK_PROFILE);
      setLoading(false);
    }, 600);
    return () => clearTimeout(t);
  }, [refreshKey]);

  const value: AuthContextValue = {
    currentUser,
    userProfile,
    role: userProfile?.role ?? null,
    loading,
    error,
    logout,
    refreshRole,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export default AuthContext;

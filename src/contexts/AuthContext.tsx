/**
 * src/contexts/AuthContext.tsx
 * Auth provider realtime với Firebase Auth + Firestore
 * 
 * Schema User thống nhất:
 * - uid (document ID)
 * - email, displayName, photoURL, phone, bio
 * - role, status, bannedAt, bannedUntil, bannedReason
 * - totalXP, level, currentStreak, longestStreak, lastStreakDate
 * - dailyGoalMinutes, unreadCount
 * - createdAt, updatedAt, lastLogin, lastActiveAt
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
import type { User } from "firebase/auth";
import { FirebaseError } from "firebase/app";
import { auth, db } from "../utils/config";
import { 
  onAuthStateChanged, 
  signOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile
} from "firebase/auth";
import { doc, onSnapshot, setDoc, serverTimestamp } from "firebase/firestore";
import { updateUserStreak } from "../services/streakService";

// ─── Role type ─────────────────────────────────────────────────────────────────
export type UserRole = "admin" | "moderator" | "instructor" | "student";
export type UserStatus = "active" | "banned" | "suspended";

export interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  phone: string | null;
  bio: string | null;
  role: UserRole;
  status: UserStatus;
  bannedAt: Date | null;
  bannedUntil: Date | null;
  bannedReason: string | null;
  level: number;
  totalXP: number;
  currentStreak: number;
  longestStreak: number;
  lastStreakDate: Date | null;
  dailyGoalMinutes: number;
  unreadCount: number;
  createdAt: Date;
  updatedAt: Date;
  lastLogin: Date;
  lastActiveAt: Date | null;
  
  // 🆕 Subscription for instructors
  subscriptionTier: "free" | "pro";  // mặc định "free"
  subscriptionExpiresAt?: Date | null;
}

export interface AuthContextValue {
  currentUser: User | null;
  userProfile: UserProfile | null;
  role: UserRole | null;
  loading: boolean;
  error: FirebaseError | null;
  logout: () => Promise<void>;
  refreshRole: () => void;
  signIn: (email: string, password: string) => Promise<User>;
  signUp: (email: string, password: string, displayName: string) => Promise<User>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

interface AuthProviderProps { children: ReactNode; }

export function AuthProvider({ children }: AuthProviderProps) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<FirebaseError | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const profileUnsubRef = useRef<(() => void) | null>(null);

  const logout = useCallback(async () => {
    await signOut(auth);
    setCurrentUser(null);
    setUserProfile(null);
  }, []);

  const signIn = async (email: string, password: string) => {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    return cred.user;
  };

  // ─── signUp: tạo user với schema chuẩn, role mặc định "student" ──────────
  const signUp = async (email: string, password: string, displayName: string) => {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(cred.user, { displayName });

    const userData = {
      uid: cred.user.uid,
      email: cred.user.email,
      displayName: displayName,
      photoURL: cred.user.photoURL || null,
      phone: null,
      bio: null,
      role: "student" as UserRole,  // ✅ thay "user" → "student"
      status: "active" as UserStatus,
      bannedAt: null,
      bannedUntil: null,
      bannedReason: null,
      level: 1,
      totalXP: 0,
      currentStreak: 0,
      longestStreak: 0,
      lastStreakDate: null,
      dailyGoalMinutes: 30,
      unreadCount: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      lastLogin: serverTimestamp(),
      lastActiveAt: serverTimestamp(),
    };

    await setDoc(doc(db, 'users', cred.user.uid), userData);
    return cred.user;
  };

  const refreshRole = useCallback(() => setRefreshKey((k) => k + 1), []);

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);

      profileUnsubRef.current?.();
      profileUnsubRef.current = null;

      if (!user) {
        setUserProfile(null);
        setLoading(false);
        return;
      }
      updateUserStreak(user.uid).catch(console.error);

      const userRef = doc(db, "users", user.uid);
      const unsubProfile = onSnapshot(
        userRef,
        (snap) => {
          if (!snap.exists()) {
            setUserProfile(null);
            setError({ code: "not-found", message: "User document not found" } as FirebaseError);
          } else {
            const data = snap.data();
            setUserProfile({
              uid: user.uid,
              email: user.email,
              displayName: data.displayName ?? user.displayName,
              photoURL: data.photoURL ?? user.photoURL,
              phone: data.phone ?? null,
              bio: data.bio ?? null,
              role: (data.role === "admin" || data.role === "moderator" || data.role === "instructor" || data.role === "student")
                ? data.role
                : "student", // fallback
              status: data.status ?? "active",
              bannedAt: data.bannedAt?.toDate?.() ?? null,
              bannedUntil: data.bannedUntil?.toDate?.() ?? null,
              bannedReason: data.bannedReason ?? null,
              level: data.level ?? 1,
              totalXP: data.totalXP ?? 0,
              currentStreak: data.currentStreak ?? 0,
              longestStreak: data.longestStreak ?? 0,
              lastStreakDate: data.lastStreakDate?.toDate?.() ?? null,
              dailyGoalMinutes: data.dailyGoalMinutes ?? 30,
              unreadCount: data.unreadCount ?? 0,
              createdAt: data.createdAt?.toDate?.() ?? new Date(),
              updatedAt: data.updatedAt?.toDate?.() ?? new Date(),
              lastLogin: data.lastLogin?.toDate?.() ?? new Date(),
              lastActiveAt: data.lastActiveAt?.toDate?.() ?? null,
              subscriptionTier: data.subscriptionTier ?? "free",
              subscriptionExpiresAt: data.subscriptionExpiresAt?.toDate?.() ?? null,
            });
            setError(null);
          }
          setLoading(false);
        },
        (err) => {
          console.error("[AuthContext] Firestore error:", err);
          setError(err as FirebaseError);
          setLoading(false);
        }
      );
      profileUnsubRef.current = unsubProfile;
    });

    return () => {
      unsubAuth();
      profileUnsubRef.current?.();
    };
  }, [refreshKey]);

  const value: AuthContextValue = {
    currentUser,
    userProfile,
    role: userProfile?.role ?? null,
    loading,
    error,
    logout,
    refreshRole,
    signIn,
    signUp,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export default AuthContext;
/**
 * src/contexts/AuthContext.tsx
 * Auth provider realtime với Firebase Auth + Firestore
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
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";

export type UserRole = "admin" | "moderator" | "instructor" | "user";

export interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  role: UserRole;
  status: "active" | "banned" | "suspended";
  level: number;
  totalXP: number;
  streakDays: number;
  createdAt: Date;
  lastActiveAt?: Date;
}

export interface AuthContextValue {
  currentUser: User | null;
  userProfile: UserProfile | null;
  role: UserRole | null;
  loading: boolean;
  error: FirebaseError | null;
  logout: () => Promise<void>;
  refreshRole: () => void;
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

  const refreshRole = useCallback(() => setRefreshKey((k) => k + 1), []);

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);

      // Hủy listener cũ
      profileUnsubRef.current?.();
      profileUnsubRef.current = null;

      if (!user) {
        setUserProfile(null);
        setLoading(false);
        return;
      }

      // Realtime role listener
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
              role: data.role ?? "user",
              status: data.status ?? "active",
              level: data.level ?? 1,
              totalXP: data.totalXP ?? 0,
              streakDays: data.streakDays ?? 0,
              createdAt: data.createdAt?.toDate() ?? new Date(),
              lastActiveAt: data.lastActiveAt?.toDate(),
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
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export default AuthContext;
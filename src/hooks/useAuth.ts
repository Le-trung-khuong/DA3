export {
  useAuth,
  type UserRole,
  type UserProfile,
  type AuthContextValue,
} from "../contexts/AuthContext";

import { useAuth as _useAuth } from "../contexts/AuthContext";

export function useIsAdmin(): boolean {
  const { role, loading } = _useAuth();
  return !loading && role === "admin";
}

export function useIsStaff(): boolean {
  const { role, loading } = _useAuth();
  return !loading && (role === "admin" || role === "moderator");
}

export function useDisplayName(): string {
  const { userProfile, currentUser } = _useAuth();
  return userProfile?.displayName ?? currentUser?.displayName ?? currentUser?.email ?? "Unknown";
}
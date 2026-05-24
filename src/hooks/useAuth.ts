/**
 * src/hooks/useAuth.ts
 * ─────────────────────────────────────────────────────────────
 * Convenience re-export của useAuth từ AuthContext.
 * Import hook này thay vì import trực tiếp từ context
 * để giữ clean architecture (hooks/ không phụ thuộc contexts/).
 *
 * @example
 *   import { useAuth } from "@/hooks/useAuth";
 *   const { currentUser, role, loading, logout } = useAuth();
 *
 * Nếu bạn muốn thêm derived state (ví dụ isAdmin, isLoggedIn),
 * wrap thêm logic ở đây thay vì trong component.
 */

export {
  useAuth,
  type UserRole,
  type UserProfile,
  type AuthContextValue,
} from "@/contexts/AuthContext";

// ─── Derived helpers (optional) ────────────────────────────────────────────────

import { useAuth as _useAuth } from "@/contexts/AuthContext";

/**
 * Returns true only when role === "admin".
 * Throws if used outside <AuthProvider>.
 */
export function useIsAdmin(): boolean {
  const { role, loading } = _useAuth();
  return !loading && role === "admin";
}

/**
 * Returns true when role is admin or moderator.
 */
export function useIsStaff(): boolean {
  const { role, loading } = _useAuth();
  return !loading && (role === "admin" || role === "moderator");
}

/**
 * Returns the current user's display name with a safe fallback.
 */
export function useDisplayName(): string {
  const { userProfile, currentUser } = _useAuth();
  return userProfile?.displayName ?? currentUser?.displayName ?? currentUser?.email ?? "Unknown";
}

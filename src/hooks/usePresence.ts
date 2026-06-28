/**
 * src/hooks/usePresence.ts
 * Hook quản lý online/offline presence của user hiện tại
 * và lắng nghe presence của danh sách userId bất kỳ.
 *
 * Cách dùng:
 *   // Để tự cập nhật presence (gọi ở component root / layout):
 *   useOwnPresence(currentUser?.uid);
 *
 *   // Để lấy presence của nhiều user:
 *   const presenceMap = usePresenceMap(["uid1", "uid2"]);
 *   presenceMap["uid1"]?.status // "online" | "offline" | "away"
 */

import { useState, useEffect, useCallback } from "react";
import { updateUserPresence, onUserPresence } from "../services/chatService";
import type { PresenceStatus } from "../types/chat";

// ─── Hook tự cập nhật presence của user hiện tại ────────────────────────────

export function useOwnPresence(userId: string | undefined) {
  useEffect(() => {
    if (!userId) return;

    // Đặt online khi mount
    updateUserPresence(userId, "online").catch(console.error);

    // Đặt offline khi tab ẩn, đặt lại online khi quay lại
    const handleVisibility = () => {
      if (document.hidden) {
        updateUserPresence(userId, "away").catch(console.error);
      } else {
        updateUserPresence(userId, "online").catch(console.error);
      }
    };

    // Đặt offline khi đóng tab
    const handleBeforeUnload = () => {
      // Dùng sendBeacon để đảm bảo request được gửi ngay cả khi tab đóng.
      // Firestore không hỗ trợ sendBeacon, nên dùng fetch keep-alive là tốt nhất
      // có thể. Thực tế thì Firestore RTDB có onDisconnect() tốt hơn,
      // nhưng dự án dùng Firestore nên ta best-effort ở đây.
      updateUserPresence(userId, "offline").catch(console.error);
    };

    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("beforeunload", handleBeforeUnload);
      // Đặt offline khi component unmount
      updateUserPresence(userId, "offline").catch(console.error);
    };
  }, [userId]);
}

// ─── Hook lắng nghe presence của danh sách userIds ──────────────────────────

export function usePresenceMap(userIds: string[]): Record<string, PresenceStatus> {
  const [presenceMap, setPresenceMap] = useState<Record<string, PresenceStatus>>({});

  useEffect(() => {
    if (userIds.length === 0) return;

    // Loại bỏ duplicate
    const unique = [...new Set(userIds)];

    const unsubscribers = unique.map((uid) =>
      onUserPresence(uid, (presence) => {
        setPresenceMap((prev) => {
          if (!presence) {
            const next = { ...prev };
            delete next[uid];
            return next;
          }
          return { ...prev, [uid]: presence };
        });
      })
    );

    return () => unsubscribers.forEach((unsub) => unsub());
  }, [userIds.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps

  return presenceMap;
}

// ─── Helper: lấy status text ─────────────────────────────────────────────────

export function getStatusDot(status: PresenceStatus["status"] | undefined): {
  color: string;
  label: string;
} {
  switch (status) {
    case "online": return { color: "#10B981", label: "Online" };
    case "away":   return { color: "#F59E0B", label: "Away" };
    default:       return { color: "#6B7280", label: "Offline" };
  }
}
// src/hooks/useCourseCommunity.ts
/**
 * Hook để lấy community room của một course và kiểm tra quyền truy cập
 */

import { useState, useEffect } from "react";
import {
  getCourseCommunityRoomId,
  canAccessCommunity,
} from "../services/chatService";
import { useAuth } from "../contexts/AuthContext";

export function useCourseCommunity(courseId: string | undefined) {
  const { currentUser, userProfile } = useAuth();
  const [roomId, setRoomId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);

  useEffect(() => {
    if (!courseId || !currentUser) {
      setLoading(false);
      return;
    }

    let isMounted = true;

    const fetch = async () => {
      try {
        const id = await getCourseCommunityRoomId(courseId);
        if (!isMounted) return;
        setRoomId(id);

        if (id) {
          const access = await canAccessCommunity(
            id,
            currentUser.uid,
            userProfile?.role
          );
          if (isMounted) setHasAccess(access);
        }
      } catch (err) {
        console.error("useCourseCommunity error:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetch();

    return () => {
      isMounted = false;
    };
  }, [courseId, currentUser, userProfile?.role]);

  return { roomId, hasAccess, loading };
}
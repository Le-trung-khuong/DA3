/**
 * src/components/common/PresenceUpdater.tsx
 * Component nhỏ để cập nhật presence của user hiện tại
 * Đặt trong LayoutClient hoặc App.tsx
 */

import React from "react";
import { useAuth } from "../../hooks/useAuth";
import { useOwnPresence } from "../../hooks/usePresence";

export const PresenceUpdater: React.FC = () => {
  const { currentUser } = useAuth();
  useOwnPresence(currentUser?.uid);
  return null;
};
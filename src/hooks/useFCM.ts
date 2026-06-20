import { useState, useEffect } from 'react';
import { initFCM, onNotificationReceived } from '../services/fcmService';
import { useAuth } from './useAuth';

export function useFCM() {
  const { currentUser } = useAuth();
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    if (!currentUser) return;
    initFCM(currentUser.uid).then((t) => {
      if (t) setToken(t);
    });
  }, [currentUser]);

  useEffect(() => {
    onNotificationReceived((payload) => {
      console.log('Notification:', payload);
      // Có thể hiển thị toast ở đây
    });
  }, []);

  return { token };
}
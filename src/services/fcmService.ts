import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import { db } from '../utils/config';
import { doc, setDoc, Timestamp } from 'firebase/firestore'; // ✅ import đúng

const VAPID_KEY = import.meta.env.VITE_FCM_VAPID_KEY;

export async function initFCM(userId: string): Promise<string | null> {
  try {
    const messaging = getMessaging();
    const token = await getToken(messaging, { vapidKey: VAPID_KEY });
    // Lưu token vào Firestore
    const tokenRef = doc(db, 'userFcmTokens', token);
    await setDoc(tokenRef, {
      token,
      userId,
      updatedAt: Timestamp.now(),
    });
    return token;
  } catch (e) {
    console.error('FCM init error:', e);
    return null;
  }
}

export function onNotificationReceived(callback: (payload: any) => void) {
  const messaging = getMessaging();
  onMessage(messaging, (payload) => callback(payload));
}
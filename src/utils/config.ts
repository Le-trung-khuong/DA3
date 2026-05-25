/**
 * src/utils/config.ts
 * Firebase config cho Vite (dùng import.meta.env)
 */

import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getStorage, type FirebaseStorage } from "firebase/storage";
import { getAnalytics, isSupported, type Analytics } from "firebase/analytics";

// Lấy config từ biến môi trường (Vite)
const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId:     import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

// Khởi tạo Firebase App (singleton)
const app: FirebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);

// Export các service
export const auth: Auth = getAuth(app);
export const db: Firestore = getFirestore(app);
export const storage: FirebaseStorage = getStorage(app);

// Analytics (chỉ chạy ở browser)
let _analytics: Analytics | null = null;
export const getFirebaseAnalytics = async (): Promise<Analytics | null> => {
  if (_analytics) return _analytics;
  if (await isSupported()) {
    _analytics = getAnalytics(app);
    return _analytics;
  }
  return null;
};

// Tuỳ chọn: dùng emulator trong môi trường dev
// if (import.meta.env.DEV && typeof window !== "undefined") {
//   import("firebase/auth").then(({ connectAuthEmulator }) => connectAuthEmulator(auth, "http://localhost:9099"));
//   import("firebase/firestore").then(({ connectFirestoreEmulator }) => connectFirestoreEmulator(db, "localhost", 8080));
//   import("firebase/storage").then(({ connectStorageEmulator }) => connectStorageEmulator(storage, "localhost", 9199));
// }

export default app;
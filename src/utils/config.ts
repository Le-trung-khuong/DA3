/**
 * src/firebase/config.ts
 * ─────────────────────────────────────────────────────────────
 * Khởi tạo Firebase App (singleton pattern).
 * Import file này ở bất kỳ đâu cần dùng Firebase SDK.
 *
 * Điền giá trị thật vào .env.local (Next.js) hoặc .env (Vite/CRA):
 *
 *   NEXT_PUBLIC_FIREBASE_API_KEY=...
 *   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
 *   NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
 *   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
 *   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
 *   NEXT_PUBLIC_FIREBASE_APP_ID=...
 *
 * Đổi tiền tố VITE_ nếu dùng Vite.
 */

import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAuth,  type Auth  } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getStorage,  type FirebaseStorage } from "firebase/storage";
import { getAnalytics, isSupported, type Analytics } from "firebase/analytics";

// ─── Firestore Emulator (dev only) ────────────────────────────────────────────
// import { connectFirestoreEmulator } from "firebase/firestore";
// import { connectAuthEmulator }      from "firebase/auth";
// import { connectStorageEmulator }   from "firebase/storage";

// ─── Config ────────────────────────────────────────────────────────────────────
const firebaseConfig = {
  apiKey:            process.env.NEXT_PUBLIC_FIREBASE_API_KEY            ?? "",
  authDomain:        process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN        ?? "",
  projectId:         process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID         ?? "",
  storageBucket:     process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET     ?? "",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "",
  appId:             process.env.NEXT_PUBLIC_FIREBASE_APP_ID             ?? "",
  measurementId:     process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,   // optional
};

// ─── Singleton init ─────────────────────────────────────────────────────────────
const app: FirebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const auth:    Auth            = getAuth(app);
export const db:      Firestore       = getFirestore(app);
export const storage: FirebaseStorage = getStorage(app);

// Analytics – browser only, lazily initialised
let _analytics: Analytics | null = null;
export const getFirebaseAnalytics = async (): Promise<Analytics | null> => {
  if (_analytics) return _analytics;
  if (await isSupported()) {
    _analytics = getAnalytics(app);
    return _analytics;
  }
  return null;
};

// ─── Emulator setup (uncomment for local dev) ──────────────────────────────────
// if (process.env.NODE_ENV === "development" && typeof window !== "undefined") {
//   connectAuthEmulator(auth,    "http://localhost:9099",  { disableWarnings: true });
//   connectFirestoreEmulator(db, "localhost", 8080);
//   connectStorageEmulator(storage, "localhost", 9199);
// }

export default app;

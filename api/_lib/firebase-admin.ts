// api/_lib/firebase-admin.ts
import admin from 'firebase-admin';

// Hàm lấy credentials từ environment variables
const getFirebaseCredentials = () => {
  // Cách 1: Dùng một biến FIREBASE_SERVICE_ACCOUNT chứa toàn bộ JSON
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    try {
      const creds = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      console.log('✅ Found FIREBASE_SERVICE_ACCOUNT env var');
      return creds;
    } catch (e) {
      console.error('❌ Failed to parse FIREBASE_SERVICE_ACCOUNT:', e);
    }
  }

  // Cách 2 (Fallback): Dùng các biến riêng lẻ
  if (process.env.FIREBASE_PROJECT_ID && 
      process.env.FIREBASE_CLIENT_EMAIL && 
      process.env.FIREBASE_PRIVATE_KEY) {
    console.log('✅ Found individual FIREBASE_* env vars');
    return {
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    };
  }

  console.error('❌ No Firebase credentials found in environment variables.');
  return null;
};

// Khởi tạo Firebase Admin
if (!admin.apps.length) {
  const credentials = getFirebaseCredentials();
  
  if (credentials) {
    try {
      admin.initializeApp({
        credential: admin.credential.cert(credentials),
        // Bạn có thể thêm projectId nếu muốn chắc chắn
        // projectId: credentials.projectId,
      });
      console.log('✅ Firebase Admin initialized successfully with env credentials!');
    } catch (error) {
      console.error('❌ Failed to initialize Firebase Admin with env credentials:', error);
      // Khởi tạo fallback để tránh lỗi crash app, nhưng sẽ không hoạt động
      admin.initializeApp({
        projectId: process.env.FIREBASE_PROJECT_ID || 'smart-review-dashboard'
      });
    }
  } else {
    // Trường hợp này sẽ xảy ra nếu bạn chưa set env
    console.error('❌ No Firebase credentials found. Initializing without credentials (will fail).');
    admin.initializeApp({
      projectId: process.env.FIREBASE_PROJECT_ID || 'smart-review-dashboard'
    });
  }
}

export const db = admin.firestore();
export const FieldValue = admin.firestore.FieldValue;
export const Timestamp = admin.firestore.Timestamp;
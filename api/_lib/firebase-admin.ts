// api/_lib/firebase-admin.ts
import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Lấy __dirname trong ES module
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('Current __dirname:', __dirname);

// Thử nhiều đường dẫn
const possiblePaths = [
  join(__dirname, 'serviceAccountKey.json'),
  join(process.cwd(), 'api', '_lib', 'serviceAccountKey.json'),
  join(process.cwd(), 'serviceAccountKey.json'),
];

let serviceAccount = null;
for (const path of possiblePaths) {
  try {
    serviceAccount = JSON.parse(readFileSync(path, 'utf8'));
    console.log(`✅ Loaded service account from ${path}`);
    break;
  } catch (err) {
    console.log(`Failed to load from ${path}`);
  }
}

if (!admin.apps.length) {
  if (serviceAccount) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    console.log('✅ Firebase Admin initialized with service account');
  } else {
    console.error('❌ No service account file found. Using default credentials.');
    // Vẫn khởi tạo app để không crash, nhưng các query sẽ fail
    admin.initializeApp();
  }
}

export const db = admin.firestore();
export const FieldValue = admin.firestore.FieldValue;
export const Timestamp = admin.firestore.Timestamp;
// removeLevelField.cjs
const admin = require('firebase-admin');
const path = require('path');

// ─── CẤU HÌNH ──────────────────────────────────────────────────────────────
// Đường dẫn đến service account key (tải từ Firebase Console)
const SERVICE_ACCOUNT_PATH = path.join(__dirname, '../api/_lib/serviceAccountKey.json');

// Khởi tạo Firebase Admin
let serviceAccount;
try {
  serviceAccount = require(SERVICE_ACCOUNT_PATH);
} catch (err) {
  console.error('❌ Không tìm thấy serviceAccountKey.json');
  console.error('   Vui lòng tải file từ Firebase Console và đặt vào thư mục gốc.');
  console.error('   Xem hướng dẫn: https://console.firebase.google.com/ → Settings → Service Accounts');
  process.exit(1);
}

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

// ─── HÀM CHÍNH ──────────────────────────────────────────────────────────────
async function removeLevelField() {
  console.log('🔄 Đang quét collection users...');

  const usersRef = db.collection('users');
  const snapshot = await usersRef.get();

  if (snapshot.empty) {
    console.log('ℹ️ Không có user nào.');
    return;
  }

  console.log(`📊 Tìm thấy ${snapshot.size} users.`);

  let batch = db.batch();
  let batchCount = 0;
  let count = 0;
  const MAX_BATCH = 500;

  for (const docSnap of snapshot.docs) {
    const data = docSnap.data();
    if (data.level !== undefined) {
      const ref = db.collection('users').doc(docSnap.id);
      batch.update(ref, { level: admin.firestore.FieldValue.delete() });
      batchCount++;
      count++;

      if (batchCount >= MAX_BATCH) {
        await batch.commit();
        console.log(`   Đã xử lý ${count} users...`);
        batch = db.batch();
        batchCount = 0;
      }
    }
  }

  if (batchCount > 0) {
    await batch.commit();
  }

  if (count === 0) {
    console.log('ℹ️ Không có user nào có field "level".');
  } else {
    console.log(`✅ Đã xóa field "level" khỏi ${count} users.`);
  }
}

// ─── CHẠY ──────────────────────────────────────────────────────────────────
removeLevelField()
  .then(() => {
    console.log('🎉 Hoàn thành!');
    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ Lỗi:', err);
    process.exit(1);
  });
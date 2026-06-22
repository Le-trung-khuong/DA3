// scripts/migrateReviews.cjs
const admin = require('firebase-admin');
const serviceAccount = require('../api/_lib/serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function migrateReviews() {
  const snapshot = await db.collection('reviews').get();
  let count = 0;
  for (const doc of snapshot.docs) {
    const data = doc.data();
    // Nếu chưa có reviewWeight hoặc verified, set default
    if (data.reviewWeight === undefined || data.verified === undefined) {
      await doc.ref.update({
        reviewWeight: 1.0,
        verified: false,
        notHelpfulCount: 0,
        helpfulUsers: [],
        notHelpfulUsers: [],
      });
      console.log(`✅ Updated review ${doc.id}`);
      count++;
    }
  }
  console.log(`🎉 Done! Migrated ${count} reviews.`);
}

migrateReviews().catch(console.error);
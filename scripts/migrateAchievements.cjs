// scripts/migrateAchievements.cjs
const admin = require('firebase-admin');
const serviceAccount = require('../api/_lib/serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function migrate() {
  const snapshot = await db.collection('userAchievements').get();
  let count = 0;
  for (const doc of snapshot.docs) {
    const data = doc.data();
    if (data.unlockedAt && !data.claimedAt) {
      await doc.ref.update({ claimedAt: data.unlockedAt });
      console.log(`✅ Migrated ${doc.id}`);
      count++;
    }
  }
  console.log(`🎉 Done! Migrated ${count} achievements.`);
}

migrate().catch(console.error);
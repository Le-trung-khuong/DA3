// src/services/srsService.ts
import { db } from '../utils/config';
import { doc, setDoc, getDoc, updateDoc, getDocs, query, where, Timestamp, collection } from 'firebase/firestore';
import type { SRSCard, SRSReviewResult } from '../types/srs';

const COLLECTION = 'srs_cards';

export async function initializeSRSCard(cardId: string, userId: string): Promise<void> {
  const ref = doc(db, COLLECTION, `${userId}_${cardId}`);

  const existing = await getDoc(ref);
  if (existing.exists()) {
    console.log(`[SRS] Card ${cardId} already initialized for user ${userId}, skipping.`);
    return;
  }

  const card: SRSCard = {
    cardId,
    userId,
    easeFactor: 2.5,
    interval: 0,
    nextReviewDate: new Date(),
    stage: 0,
    timesReviewed: 0,
    lastQuality: 0,
  };
  await setDoc(ref, { ...card, nextReviewDate: Timestamp.fromDate(card.nextReviewDate) });
}

export function calculateReviewResult(card: SRSCard, quality: number): SRSReviewResult {
  let ease = card.easeFactor;
  let interval = card.interval;
  let stage = card.stage;

  if (quality < 3) {
    stage = 0;
    interval = 0;
    ease = 2.5;
  } else {
    ease = Math.max(1.3, ease + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)));
    if (stage === 0) {
      stage = 1;
      interval = 1;
    } else if (stage === 1) {
      stage = 2;
      interval = 6;
    } else {
      interval = Math.round(interval * ease);
      if (interval > 365) interval = 365;
    }
  }

  const nextReviewDate = new Date();
  nextReviewDate.setDate(nextReviewDate.getDate() + interval);

  return {
    cardId: card.cardId,
    quality,
    newEaseFactor: ease,
    newInterval: interval,
    nextReviewDate,
    newStage: stage as 0 | 1 | 2 | 3,
  };
}

export async function updateSRSCard(
  cardId: string,
  userId: string,
  result: SRSReviewResult,
  currentCard: SRSCard
): Promise<void> {
  const ref = doc(db, COLLECTION, `${userId}_${cardId}`);

  await updateDoc(ref, {
    easeFactor: result.newEaseFactor,
    interval: result.newInterval,
    nextReviewDate: Timestamp.fromDate(result.nextReviewDate),
    stage: result.newStage,
    timesReviewed: currentCard.timesReviewed + 1,
    lastQuality: result.quality,
  });
}

export async function getCardsForReview(userId: string): Promise<SRSCard[]> {
  const now = new Date();
  const q = query(
    collection(db, COLLECTION),
    where('userId', '==', userId),
    where('nextReviewDate', '<=', Timestamp.fromDate(now))
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      ...data,
      nextReviewDate: data.nextReviewDate.toDate(),
    } as SRSCard;
  });
}

export async function resetSRSCard(cardId: string, userId: string): Promise<void> {
  const ref = doc(db, COLLECTION, `${userId}_${cardId}`);
  await setDoc(ref, {
    cardId,
    userId,
    easeFactor: 2.5,
    interval: 0,
    nextReviewDate: Timestamp.fromDate(new Date()),
    stage: 0,
    timesReviewed: 0,
    lastQuality: 0,
  });
}
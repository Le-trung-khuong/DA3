import { db } from '../utils/config';
import { doc, setDoc, getDoc, updateDoc, getDocs, query, where, Timestamp, collection } from 'firebase/firestore';
import type { SRSCard, SRSReviewResult } from '../types/srs';

const COLLECTION = 'srs_cards';

export async function initializeSRSCard(cardId: string, userId: string): Promise<void> {
  const ref = doc(db, COLLECTION, `${userId}_${cardId}`);
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
  let newEaseFactor = card.easeFactor;
  let newInterval = card.interval;
  let newStage = card.stage;

  if (quality < 3) {
    newStage = 0;
    newInterval = 0;
    newEaseFactor = 2.5;
  } else {
    if (card.stage === 0) {
      newStage = 1;
      newInterval = 1;
    } else if (card.stage === 1) {
      newStage = 2;
      newInterval = 1;
    } else {
      const ease = card.easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
      const newEaseFactor = Math.max(1.3, ease); // chuẩn SM-2 sàn là 1.3, không phải 2.5
      newInterval = Math.round(card.interval * newEaseFactor);
      const nextStage = card.stage + 1;
      newStage = nextStage > 3 ? 3 : (nextStage as 0 | 1 | 2 | 3);
    }
  }

  const nextReviewDate = new Date();
  nextReviewDate.setDate(nextReviewDate.getDate() + newInterval);

  return {
    cardId: card.cardId,
    quality,
    newEaseFactor,
    newInterval,
    nextReviewDate,
  };
}

export async function updateSRSCard(cardId: string, userId: string, result: SRSReviewResult): Promise<void> {
  const ref = doc(db, COLLECTION, `${userId}_${cardId}`);
  const snap = await getDoc(ref);
  const data = snap.data();
  const currentStage = data?.stage ?? 0;
  const currentTimesReviewed = data?.timesReviewed ?? 0;

  let newStage: 0 | 1 | 2 | 3;
  if (result.quality < 3) {
    newStage = 0;
  } else {
    const nextStage = currentStage + 1;
    newStage = nextStage > 3 ? 3 : (nextStage as 0 | 1 | 2 | 3);
  }

  await updateDoc(ref, {
    easeFactor: result.newEaseFactor,
    interval: result.newInterval,
    nextReviewDate: Timestamp.fromDate(result.nextReviewDate),
    stage: newStage,
    timesReviewed: currentTimesReviewed + 1,
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
export interface SRSCard {
  cardId: string;
  userId: string;
  easeFactor: number;
  interval: number;
  nextReviewDate: Date;
  stage: 0 | 1 | 2 | 3;
  timesReviewed: number;
  lastQuality: number;
}

export interface SRSReviewResult {
  cardId: string;
  quality: number;
  newEaseFactor: number;
  newInterval: number;
  nextReviewDate: Date;
}
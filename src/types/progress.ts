// src/types/progress.ts

export type LessonStatus = "not_started" | "completed";

export interface FlashcardProgress {
  totalCards: number;
  rememberedCards: number;
  lastCardIndex: number; // để resume
}

export interface VideoWatchedSegment {
  start: number;   // giây
  end: number;     // giây
}

export interface VideoTracking {
  watchedSegments: VideoWatchedSegment[];
  totalWatchedSeconds: number;
  skipCount: number;
  maxSkipCount: number;
  afkWarningCount: number;
  isAfk: boolean;
  lastActivityAt: number;
}

export interface ReadingTracking {
  scrollProgress: number;      // 0-100
  actualProgress: number;      // 0-100, anti-cheat
  timeSpentSeconds: number;
  minTimeRequired: number;
  wordCount: number;
  scrollSpikeCount: number;
  maxScrollSpikeCount: number;
  lastActivityAt: number;
}

// ---------- RESUME DATA ----------
export interface ResumeData {
  // Video
  videoCurrentTime?: number;
  videoDuration?: number;
  videoTracking?: VideoTracking;
  
  // Reading
  readingScrollPercent?: number;
  readingTracking?: ReadingTracking;
  
  // Flashcard
  flashcardCurrentIndex?: number;
  flashcardReviewQueue?: string[];
  flashcardViewedSet?: string[]; // IDs của thẻ đã lật
  
  // Quiz
  quizAnswers?: { [questionId: string]: number };
  quizCurrentIndex?: number;
  quizTimeLeft?: number;
  quizRetry?: boolean;
}

export interface Progress {
  userId: string;
  courseId: string;
  moduleId: string;
  lessonId: string;
  status: LessonStatus;
  completedAt?: Date;
  quizScore?: number;         // cho quiz lesson
  flashcardProgress?: FlashcardProgress;
  resumeData?: ResumeData;
  updatedAt: Date;
  xpEarned: number;
}

export interface QuizAttempt {
  userId: string;
  courseId: string;
  lessonId: string;
  answers: { questionId: string; selectedOptionIndex: number }[];
  score: number;            // %
  passed: boolean;
  startedAt: Date;
  completedAt: Date;
}
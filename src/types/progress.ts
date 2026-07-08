// src/types/progress.ts

export type LessonStatus = "not_started" | "completed";

export interface FlashcardProgress {
  totalCards: number;
  rememberedCards: number;
  lastCardIndex: number;
}

export interface VideoWatchedSegment {
  start: number;
  end: number;
}

export interface VideoTracking {
  watchedSegments: VideoWatchedSegment[];
  totalWatchedSeconds: number;
  skipCount: number;
  maxSkipCount: number;
  afkWarningCount: number;
  isAfk: boolean;
  lastActivityAt: number;
  progressLocked?: boolean;
}

export interface ReadingTracking {
  scrollProgress: number;
  actualProgress: number;
  timeSpentSeconds: number;
  minTimeRequired: number;
  wordCount: number;
  scrollSpikeCount: number;
  maxScrollSpikeCount: number;
  lastActivityAt: number;
  readWordsCount: number;
  knowledgeCheckPassed: boolean;
  engagementScore: number;
  sectionInteraction: number;
  totalSections: number;
  suspectedFastScroll: boolean;
  focusTimeSeconds: number;
}

// ---------- RESUME DATA ----------
export interface ResumeData {
  // Video
  videoCurrentTime?: number;
  videoDuration?: number;
  videoTracking?: VideoTracking;
  videoBookmarks?: number[];    // mới
  videoNotes?: string;          // mới

  // Reading
  readingScrollPercent?: number;
  readingScrollTop?: number;
  readingTracking?: ReadingTracking;
  readingNotes?: Record<string, string>;     // mới: key = heading id
  readingHighlights?: string[];              // mới: danh sách paragraph id
  readingBookmarks?: string[];               // mới: heading ids

  // Flashcard
  flashcardCurrentIndex?: number;
  flashcardReviewQueue?: string[];
  flashcardViewedSet?: string[];

  // Quiz
  quizAnswers?: { [questionId: string]: number | number[] | string }; // mở rộng
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
  quizScore?: number;
  flashcardProgress?: FlashcardProgress;
  resumeData?: ResumeData;
  updatedAt: Date;
  xpEarned: number;
}

export interface QuizAttemptAnswer {
  questionId: string;
  selectedOptionIndex: number;
  selectedOptionIndexes?: number[]; // mới cho multiple
  selectedText?: string;            // mới cho fill_blank
  isCorrect: boolean;
}

export interface QuizAttempt {
  lessonId: string;
  startedAt: Date;
  completedAt: Date;
  score: number;
  answers: QuizAttemptAnswer[];
}
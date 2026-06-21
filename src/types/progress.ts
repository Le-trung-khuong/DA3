// src/types/progress.ts
export type LessonStatus = "not_started" | "completed";

export interface FlashcardProgress {
  totalCards: number;
  rememberedCards: number;
  lastCardIndex: number; // để resume
}

// ---------- RESUME DATA ----------
export interface ResumeData {
  // Video
  videoCurrentTime?: number;
  // Reading
  readingScrollPercent?: number;
  // Flashcard
  flashcardCurrentIndex?: number;
  flashcardReviewQueue?: string[];   // array of card ids
  // Quiz
  quizAnswers?: { [questionId: string]: number };
  quizCurrentIndex?: number;
  quizTimeLeft?: number;
  // Quiz retry flag (thêm mới)
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
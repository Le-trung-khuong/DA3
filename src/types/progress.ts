/**
 * src/types/progress.ts
 * Định nghĩa kiểu dữ liệu cho progress tracking + resume learning
 */

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
  resumeData?: ResumeData;    // ✅ thêm mới
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
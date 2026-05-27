/**
 * src/types/progress.ts
 * Định nghĩa kiểu dữ liệu cho progress tracking
 */

export type LessonStatus = "not_started" | "completed";

export interface FlashcardProgress {
  totalCards: number;
  rememberedCards: number;
  lastCardIndex: number; // để resume
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
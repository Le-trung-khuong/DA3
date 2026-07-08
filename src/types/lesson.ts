// src/types/lesson.ts
/**
 * Định nghĩa kiểu dữ liệu cho lesson và nội dung lesson
 * Đã mở rộng cho các tính năng: quiz multiple, fill-blank, video chapters, transcript, flashcard category/image
 */

export type LessonType = "video" | "quiz" | "reading" | "flashcard";

// ---------- Video ----------
export interface VideoChapter {
  time: number;   // giây bắt đầu chapter
  title: string;
}

export interface TranscriptLine {
  time: number;
  text: string;
}

export interface VideoContent {
  chapters?: VideoChapter[];
  transcript?: TranscriptLine[];
}

// ---------- Quiz ----------
export interface QuizQuestion {
  id: string;
  text: string;
  type?: "single" | "multiple" | "true_false" | "fill_blank"; // mới
  options: string[];   // dùng cho single, multiple, true_false
  correctOptionIndex: number;        // dùng cho single, true_false
  correctOptionIndexes?: number[];   // dùng cho multiple
  correctTextAnswers?: string[];     // dùng cho fill_blank
  explanation?: string;
  topic?: string;      // mới cho Weak Knowledge Detection
}

export interface QuizContent {
  questions: QuizQuestion[];
  passingScore: number;
  questionsToShow?: number; // mới: random subset
}

// ---------- Reading ----------
export interface ReadingContent {
  markdown: string;
}

// ---------- Flashcard ----------
export interface FlashcardCard {
  id: string;
  front: string;
  back: string;
  hint?: string;
  category?: string;        // mới
  frontImageUrl?: string;   // mới
  backImageUrl?: string;    // mới
}

export interface FlashcardContent {
  cards: FlashcardCard[];
}

// ---------- LessonContent ----------
export type LessonContent =
  | { type: "video"; data: VideoContent }
  | { type: "quiz"; data: QuizContent }
  | { type: "reading"; data: ReadingContent }
  | { type: "flashcard"; data: FlashcardContent };

// ---------- Lesson ----------
export interface Lesson {
  id: string;
  title: string;
  type: LessonType;
  duration: number;
  xpReward: number;
  isFree: boolean;
  order: number;
  videoUrl?: string;         // legacy
  content?: LessonContent;

  // Drip content
  releaseAt?: Date | string | number;

  // Prerequisites
  prerequisites?: string[];
}
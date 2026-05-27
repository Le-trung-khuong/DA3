/**
 * src/types/lesson.ts
 * Định nghĩa kiểu dữ liệu cho lesson và nội dung lesson
 */

export type LessonType = "video" | "quiz" | "reading" | "assignment" | "flashcard";

// Nội dung cho từng loại lesson
export interface VideoContent {
  // Video lesson chỉ cần videoUrl (đã có trong Lesson cũ)
  // Để tương thích, nếu lesson có videoUrl thì coi như video content
  // Có thể mở rộng thêm transcript, captions...
}

export interface QuizQuestion {
  id: string;
  text: string;
  options: string[];        // 4 options
  correctOptionIndex: number; // 0-based
  explanation?: string;
}

export interface QuizContent {
  questions: QuizQuestion[];
  passingScore: number;     // % cần đạt để qua bài (vd: 70)
}

export interface ReadingContent {
  markdown: string;         // Nội dung bài đọc dạng markdown
}

export interface FlashcardCard {
  id: string;
  front: string;
  back: string;
  hint?: string;
}

export interface FlashcardContent {
  cards: FlashcardCard[];
}

// Union type cho content
export type LessonContent = 
  | { type: "video"; data: VideoContent }
  | { type: "quiz"; data: QuizContent }
  | { type: "reading"; data: ReadingContent }
  | { type: "flashcard"; data: FlashcardContent };

// Lesson object hoàn chỉnh (dùng trong Firestore)
export interface Lesson {
  id: string;
  title: string;
  type: LessonType;
  duration: number;      // minutes
  xpReward: number;
  isFree: boolean;
  order: number;
  videoUrl?: string;     // legacy field cho video lesson (vẫn giữ)
  content?: LessonContent; // nội dung chi tiết cho quiz/reading/flashcard
}
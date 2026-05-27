/**
 * src/services/import/types.ts
 * Các kiểu dữ liệu dùng chung cho import system
 */

import { QuizQuestion, FlashcardCard } from "../../types/lesson";

// Kết quả parse trả về (dùng trong preview)
export interface ParsedQuizData {
  questions: QuizQuestion[];
  errors: ImportError[];
  warnings: string[];
}

export interface ParsedFlashcardData {
  cards: FlashcardCard[];
  errors: ImportError[];
  warnings: string[];
}

export interface ImportError {
  row: number;          // số dòng bị lỗi (bắt đầu từ 1)
  column?: string;      // tên cột nếu có
  message: string;
}

// Cấu hình mapping column cho quiz (linh hoạt)
export interface QuizColumnMapping {
  questionCol: number;      // index cột chứa câu hỏi (0-based)
  optionCols: number[];     // index các cột chứa option (tối đa 4)
  correctCol: number;       // index cột chứa đáp án đúng (A, B, C, D hoặc nội dung option)
  explanationCol?: number;  // index cột chứa giải thích (tuỳ chọn)
}
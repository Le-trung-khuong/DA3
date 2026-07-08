// src/utils/textAnswer.ts
/**
 * Hàm chuẩn hóa câu trả lời dạng text cho Quiz fill-blank và Flashcard typing
 */
export function normalizeAnswer(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}
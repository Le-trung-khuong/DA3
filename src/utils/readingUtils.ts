// src/utils/readingUtils.ts

/**
 * Đếm số từ trong content (HTML hoặc text)
 */
export function countWords(content: string): number {
  // Loại bỏ HTML tags và markdown
  const text = content
    .replace(/<[^>]*>/g, ' ')
    .replace(/[#*`\[\]()!]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  
  return text.split(/\s+/).length;
}

/**
 * Tính thời gian đọc tối thiểu dựa trên số từ
 * Tốc độ đọc: ~200 từ/phút = 3.33 từ/giây
 * Tối thiểu 30 giây
 */
export function calculateMinReadingTime(wordCount: number): number {
  const WORDS_PER_SECOND = 3.33;
  const MIN_SECONDS = 30;
  const MAX_SECONDS = 600; // 10 phút
  
  if (wordCount <= 0) return MIN_SECONDS;
  const calculated = Math.ceil(wordCount / WORDS_PER_SECOND);
  return Math.min(MAX_SECONDS, Math.max(MIN_SECONDS, calculated));
}

/**
 * Kiểm tra scroll velocity (anti-cheat)
 * Nếu user scroll quá nhanh → phát hiện cheat
 */
export function detectScrollCheat(
  currentTop: number,
  previousTop: number,
  timeDelta: number
): boolean {
  const SCROLL_SPEED_THRESHOLD = 5000; // pixels/giây
  
  if (timeDelta <= 0) return false;
  const velocity = Math.abs(currentTop - previousTop) / timeDelta;
  
  return velocity > SCROLL_SPEED_THRESHOLD;
}
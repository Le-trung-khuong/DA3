// src/utils/videoTracking.ts

export interface WatchedSegment {
  start: number;
  end: number;
}

/**
 * Gộp các khoảng đè nhau / sát nhau (gap ≤ 1s).
 */
export function mergeSegments(segments: WatchedSegment[]): WatchedSegment[] {
  const valid = segments.filter(s => s.end > s.start);
  if (!valid.length) return [];
  const sorted = [...valid].sort((a, b) => a.start - b.start);
  const merged: WatchedSegment[] = [{ ...sorted[0] }];
  for (let i = 1; i < sorted.length; i++) {
    const s = sorted[i];
    const last = merged[merged.length - 1];
    if (s.start <= last.end + 1) {
      last.end = Math.max(last.end, s.end);
    } else {
      merged.push({ ...s });
    }
  }
  return merged;
}

/**
 * Tính phần trăm đã xem thực tế dựa trên merged segments.
 */
export function calculateWatchedPercent(
  segments: WatchedSegment[],
  duration: number
): number {
  if (duration <= 0) return 0;
  const merged = mergeSegments(segments);
  const totalWatched = merged.reduce((sum, s) => sum + (s.end - s.start), 0);
  return Math.min(100, Math.max(0, (totalWatched / duration) * 100));
}
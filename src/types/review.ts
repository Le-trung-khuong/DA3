/**
 * src/types/review.ts
 * Định nghĩa kiểu dữ liệu cho review system
 */

export type ReviewStatus = "visible" | "hidden" | "reported";

export interface Review {
  id: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  courseId: string;
  courseTitle: string;
  rating: number;          // 1-5
  content: string;
  status: ReviewStatus;
  createdAt: Date;
  updatedAt: Date;
  helpfulCount: number;    // số lượt hữu ích
  reportCount?: number;    // số lần báo cáo (cho mở rộng)
  adminNote?: string;      // ghi chú của admin
}
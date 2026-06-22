// src/types/review.ts
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
  helpfulCount: number;
  notHelpfulCount: number;      // ✅ Mới
  helpfulUsers: string[];       // ✅ Mới
  notHelpfulUsers: string[];    // ✅ Mới
  reportCount?: number;
  adminNote?: string;
  // ✅ Mới
  verified: boolean;
  reviewWeight: number;
  learnerLevel?: string;        // e.g., "beginner", "intermediate", "advanced"
}
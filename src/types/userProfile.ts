// src/types/userProfile.ts
export interface UserProfile {
  id: string;
  displayName: string;
  email: string;
  photoURL?: string;
  role: string;
  totalXP: number;
  streakDays: number;
  joinedAt: Date;
  lastActiveAt?: Date;
  completedCourses: number;
  enrolledCourses: number;
  completedLessons: number;
  averageQuizScore: number;
}
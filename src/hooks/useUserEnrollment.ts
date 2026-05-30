/**
 * src/hooks/useUserEnrollment.ts
 * Realtime lắng nghe quyền truy cập khóa học của user
 */

import { useState, useEffect } from "react";
import { db } from "../utils/config";
import { collection, query, where, onSnapshot } from "firebase/firestore";

export function useUserEnrollment(userId: string | undefined, courseId: string | undefined) {
  const [isEnrolled, setIsEnrolled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [enrolledAt, setEnrolledAt] = useState<Date | null>(null);
  const [enrollmentId, setEnrollmentId] = useState<string | null>(null);

  useEffect(() => {
    if (!userId || !courseId) {
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, "enrollments"),
      where("userId", "==", userId),
      where("courseId", "==", courseId),
      where("isActive", "==", true)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        if (snapshot.empty) {
          setIsEnrolled(false);
          setEnrolledAt(null);
          setEnrollmentId(null);
        } else {
          const doc = snapshot.docs[0];
          const data = doc.data();
          setIsEnrolled(true);
          setEnrollmentId(doc.id);
          setEnrolledAt(data.enrolledAt?.toDate?.() ?? null);
        }
        setLoading(false);
      },
      (error) => {
        console.error("useUserEnrollment error:", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [userId, courseId]);

  return { isEnrolled, loading, enrolledAt, enrollmentId };
}
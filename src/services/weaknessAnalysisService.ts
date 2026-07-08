// src/services/weaknessAnalysisService.ts
import { db } from "../utils/config";
import { doc, writeBatch, increment } from "firebase/firestore";
import { QuizAttempt } from "../types/progress";
import { QuizQuestion } from "../types/lesson"; // ✅ import từ lesson.ts

export async function recordTopicStats(
  userId: string,
  attempt: QuizAttempt,
  questions: QuizQuestion[]
) {
  if (!userId || !attempt || !questions.length) return;

  const batch = writeBatch(db);
  const topicStats: Record<string, { total: number; incorrect: number }> = {};

  for (const ans of attempt.answers) {
    const q = questions.find((x) => x.id === ans.questionId);
    if (!q?.topic) continue;
    if (!topicStats[q.topic]) {
      topicStats[q.topic] = { total: 0, incorrect: 0 };
    }
    topicStats[q.topic].total += 1;
    if (!ans.isCorrect) topicStats[q.topic].incorrect += 1;
  }

  for (const [topic, stats] of Object.entries(topicStats)) {
    const ref = doc(db, "users", userId, "topicStats", topic);
    batch.set(
      ref,
      {
        totalCount: increment(stats.total),
        incorrectCount: increment(stats.incorrect),
        lastUpdated: new Date(),
      },
      { merge: true }
    );
  }

  await batch.commit();
}
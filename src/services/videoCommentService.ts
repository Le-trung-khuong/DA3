// src/services/videoCommentService.ts
import {
  collection,
  addDoc,
  query,
  orderBy,
  onSnapshot,
  Timestamp,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../utils/config";

export interface VideoComment {
  id: string;
  userId: string;
  userName: string;
  text: string;
  videoTimestamp: number; // giây
  isInstructor: boolean;
  createdAt: Timestamp;
}

export async function addVideoComment(
  lessonId: string,
  comment: Omit<VideoComment, "id" | "createdAt">
) {
  const ref = collection(db, "lessons", lessonId, "videoComments");
  await addDoc(ref, {
    ...comment,
    createdAt: serverTimestamp(),
  });
}

export function onVideoComments(
  lessonId: string,
  callback: (comments: VideoComment[]) => void
) {
  const q = query(
    collection(db, "lessons", lessonId, "videoComments"),
    orderBy("videoTimestamp", "asc")
  );
  return onSnapshot(q, (snap) => {
    const comments = snap.docs.map(
      (d) => ({ id: d.id, ...d.data() } as VideoComment)
    );
    callback(comments);
  });
}
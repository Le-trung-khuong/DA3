// src/hooks/useEvents.ts
import { useState, useEffect } from "react";
import { collection, query, orderBy, onSnapshot } from "firebase/firestore";
import { db } from "../utils/config";
import { GameEvent } from "../services/eventService";

export function useEvents() {
  const [events, setEvents] = useState<GameEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const q = query(collection(db, "events"), orderBy("startDate", "desc"));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
          startDate: doc.data().startDate?.toDate() || new Date(),
          endDate: doc.data().endDate?.toDate() || new Date(),
        })) as GameEvent[];
        setEvents(data);
        setLoading(false);
      },
      (err) => {
        console.error("useEvents error:", err);
        setError(err);
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, []);

  const activeEvent = events.find(
    (e) => e.isActive && e.startDate <= new Date() && e.endDate >= new Date()
  );

  return { events, activeEvent, loading, error };
}
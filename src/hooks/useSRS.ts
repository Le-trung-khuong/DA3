// src/hooks/useSRS.ts
import { useState, useEffect, useRef } from 'react';
import { getCardsForReview, updateSRSCard, calculateReviewResult, initializeSRSCard } from '../services/srsService';
import type { SRSCard } from '../types/srs';

export function useSRS(userId: string | undefined) {
  const [cards, setCards] = useState<SRSCard[]>([]);
  const [loading, setLoading] = useState(true);
  const submittingRef = useRef(false); // ✅ Guard

  const fetchCards = async () => {
    if (!userId) return;
    const data = await getCardsForReview(userId);
    setCards(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchCards();
  }, [userId]);

  const submitReview = async (cardId: string, quality: number) => {
    if (!userId) return;
    if (submittingRef.current) {
      console.warn('[useSRS] Already submitting, skipping duplicate call');
      return;
    }
    const card = cards.find(c => c.cardId === cardId);
    if (!card) return;

    submittingRef.current = true;
    try {
      const result = calculateReviewResult(card, quality);
      await updateSRSCard(cardId, userId, result, card);
      await fetchCards();
    } finally {
      submittingRef.current = false;
    }
  };

  const initCard = async (cardId: string) => {
    if (userId) await initializeSRSCard(cardId, userId);
  };

  return { cards, loading, submitReview, initCard, refresh: fetchCards };
}
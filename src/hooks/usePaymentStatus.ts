/**
 * src/hooks/usePaymentStatus.ts
 * Realtime lắng nghe trạng thái giao dịch
 */

import { useState, useEffect } from "react";
import { db } from "../utils/config";
import { doc, onSnapshot } from "firebase/firestore";
import type { TransactionStatus } from "../types/transaction";

export function usePaymentStatus(transactionId: string | null) {
  const [status, setStatus] = useState<TransactionStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!transactionId) {
      setLoading(false);
      return;
    }

    const unsubscribe = onSnapshot(
      doc(db, "transactions", transactionId),
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          setStatus(data.status as TransactionStatus);
        }
        setLoading(false);
      },
      (error) => {
        console.error("usePaymentStatus error:", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [transactionId]);

  return { status, loading };
}
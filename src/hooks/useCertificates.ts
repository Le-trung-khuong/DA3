import { useState, useEffect } from "react";
import { getUserCertificates, Certificate } from "../services/certificateService";

export function useCertificates(userId: string | undefined) {
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!userId) {
      setCertificates([]);
      setLoading(false);
      return;
    }

    const fetchCertificates = async () => {
      try {
        const data = await getUserCertificates(userId);
        setCertificates(data);
        setLoading(false);
      } catch (err: any) {
        console.error("useCertificates error:", err);
        setError(err);
        setLoading(false);
      }
    };

    fetchCertificates();
  }, [userId]);

  return { certificates, loading, error };
}
// src/services/payosService.ts
const API_BASE = import.meta.env.VITE_API_BASE || '/api';

export interface CreateOrderResponse {
  checkoutUrl: string;
  qrCode: string;
  transactionId: string;
}

export async function createPayOSOrder(
  userId: string,
  courseId: string
): Promise<CreateOrderResponse> {
  const response = await fetch(`${API_BASE}/create-payos-order`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ userId, courseId }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create order');
  }

  return response.json();
}
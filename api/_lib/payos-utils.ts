// api/_lib/payos-utils.ts
import { createHmac } from 'crypto';

export type PayOSSignatureData = {
  amount: number;
  cancelUrl: string;
  description: string;
  orderCode: number | string;
  returnUrl: string;
};

function normalizeValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value.trim();
  return String(value);
}

export function buildPayOSSignatureString(data: PayOSSignatureData): string {
  const canonical = {
    amount: normalizeValue(data.amount),
    cancelUrl: normalizeValue(data.cancelUrl),
    description: normalizeValue(data.description),
    orderCode: normalizeValue(data.orderCode),
    returnUrl: normalizeValue(data.returnUrl),
  };

  const queryString = Object.keys(canonical)
    .sort()
    .map((key) => `${key}=${canonical[key as keyof typeof canonical]}`)
    .join('&');

  return queryString;
}

export function generatePayOSSignature(
  data: PayOSSignatureData,
  checksumKey: string
): string {
  const queryString = buildPayOSSignatureString(data);

  console.log('===== PAYOS SIGNATURE INPUT =====');
  console.log(JSON.stringify(data, null, 2));

  console.log('===== PAYOS SIGNATURE STRING =====');
  console.log(queryString);

  console.log('===== PAYOS CHECKSUM KEY PRESENT =====');
  console.log(Boolean(checksumKey));

  const signature = createHmac('sha256', checksumKey)
    .update(queryString)
    .digest('hex');

  console.log('===== PAYOS SIGNATURE RESULT =====');
  console.log(signature);

  return signature;
}
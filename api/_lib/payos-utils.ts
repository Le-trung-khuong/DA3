// api/_lib/payos-utils.ts
import { createHmac } from 'crypto';

// ===== FOR ORDER CREATION =====
export type PayOSSignatureData = {
  amount: number;
  cancelUrl: string;
  description: string;
  orderCode: string | number;
  returnUrl: string;
};

export function generatePayOSSignature(
  data: PayOSSignatureData,
  checksumKey: string
): string {
  // Theo PayOS: chỉ ký các field: amount, cancelUrl, description, orderCode, returnUrl
  const sortedKeys = Object.keys(data).sort();
  const queryString = sortedKeys
    .map((key) => `${key}=${String(data[key as keyof PayOSSignatureData])}`)
    .join('&');

  console.log('===== PAYOS SIGNATURE STRING =====');
  console.log(queryString);

  return createHmac('sha256', checksumKey).update(queryString).digest('hex');
}

// ===== FOR WEBHOOK VERIFICATION =====
// ✅ Copy chính xác từ PayOS SDK: createSignatureFromObj(data, checksumKey)
export function createSignatureFromObj(
  obj: Record<string, any>,
  checksumKey: string
): string {
  // 1. Loại bỏ các field có giá trị null, undefined, empty string
  const filteredObj: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== null && value !== undefined && value !== '') {
      filteredObj[key] = value;
    }
  }

  // 2. Sắp xếp keys alphabetically
  const sortedKeys = Object.keys(filteredObj).sort();

  // 3. Tạo query string: key=value&key=value...
  const queryString = sortedKeys
    .map((key) => `${key}=${String(filteredObj[key])}`)
    .join('&');

  console.log('===== WEBHOOK SIGNATURE STRING =====');
  console.log('Keys:', sortedKeys);
  console.log('String:', queryString);

  // 4. HMAC-SHA256
  return createHmac('sha256', checksumKey).update(queryString).digest('hex');
}
// api/check-transaction.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { db, Timestamp } from './_lib/firebase-admin.js';

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173,https://smart-review.vercel.app').split(',');

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // ✅ CORS: chỉ cho phép các origin trong danh sách
  const origin = req.headers.origin || '';
  if (ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    // Fallback: nếu không khớp, vẫn cho phép localhost để dev (có thể gỡ bỏ sau)
    if (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) {
      res.setHeader('Access-Control-Allow-Origin', origin);
    }
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const { transactionId, orderCode } = req.query;
    const orderCodeNum = orderCode ? Number(orderCode) : null;

    if (!transactionId && !orderCodeNum) {
      return res.status(400).json({
        success: false,
        error: 'Cần transactionId hoặc orderCode',
      });
    }

    let doc: FirebaseFirestore.DocumentSnapshot;
    let data: any;

    if (transactionId) {
      doc = await db.collection('transactions').doc(transactionId as string).get();
      if (!doc.exists) {
        return res.status(404).json({ success: false, error: 'Không tìm thấy giao dịch' });
      }
      data = doc.data();
    } else {
      const snap = await db
        .collection('transactions')
        .where('orderId', '==', String(orderCodeNum))
        .limit(1)
        .get();
      if (snap.empty) {
        return res.status(404).json({ success: false, error: 'Không tìm thấy giao dịch' });
      }
      doc = snap.docs[0];
      data = doc.data();
    }

    // Chuyển đổi paidAt từ Timestamp sang ISO string
    let paidAt: string | null = null;
    if (data.paidAt) {
      if (typeof data.paidAt.toDate === 'function') {
        paidAt = data.paidAt.toDate().toISOString();
      } else if (data.paidAt._seconds !== undefined) {
        paidAt = new Date(data.paidAt._seconds * 1000).toISOString();
      } else {
        paidAt = String(data.paidAt);
      }
    }

    return res.status(200).json({
      status: data.status,
      transactionId: doc.id,
      orderCode: data.orderId,
      courseId: data.courseId,
      paidAt: paidAt,
    });
  } catch (error: any) {
    console.error('check-transaction error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Không thể kiểm tra giao dịch',
    });
  }
}
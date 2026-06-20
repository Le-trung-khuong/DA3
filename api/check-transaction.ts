import type { VercelRequest, VercelResponse } from '@vercel/node';
import { db, Timestamp } from './_lib/firebase-admin.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
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

    // Chuyển đổi paidAt từ Timestamp sang ISO string (hoặc null)
    let paidAt: string | null = null;
    if (data.paidAt) {
      if (typeof data.paidAt.toDate === 'function') {
        paidAt = data.paidAt.toDate().toISOString();
      } else if (data.paidAt._seconds !== undefined) {
        // Fallback cho object {_seconds, _nanoseconds}
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
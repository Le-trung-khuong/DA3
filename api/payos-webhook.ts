// api/payos-webhook.ts
import 'dotenv/config';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { db, FieldValue, Timestamp } from './_lib/firebase-admin';
import { generateSignature } from './_lib/payos-utils';

const PAYOS_CHECKSUM_KEY = "22654ee51c9e3a8cf07e9ba0c2523400c3d05cc796007c45d18c0ad2c5fc97c3";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = req.body;
    const signature = req.headers['x-payos-signature'] as string;

    const computedSignature = generateSignature(body.data, PAYOS_CHECKSUM_KEY);
    if (computedSignature !== signature) {
      console.error('Invalid signature');
      await db.collection('payment_logs').add({
        action: 'webhook_received',
        requestData: body,
        responseData: { error: 'Invalid signature' },
        status: 'failed',
        createdAt: Timestamp.now(),
      });
      return res.status(400).json({ error: 'Invalid signature' });
    }

    const { data } = body;
    const orderCode = data.orderCode;
    const reference = data.reference;

    const transactionQuery = await db.collection('transactions')
      .where('orderId', '==', orderCode.toString())
      .limit(1)
      .get();

    if (transactionQuery.empty) {
      console.error('Transaction not found for orderCode:', orderCode);
      await db.collection('payment_logs').add({
        action: 'webhook_received',
        requestData: body,
        responseData: { error: 'Transaction not found' },
        status: 'failed',
        createdAt: Timestamp.now(),
      });
      return res.status(200).json({ message: 'OK' });
    }

    const transactionDoc = transactionQuery.docs[0];
    const transaction = transactionDoc.data();

    if (transaction.status === 'success') {
      return res.status(200).json({ message: 'Already processed' });
    }

    await db.collection('payment_logs').add({
      transactionId: transactionDoc.id,
      action: 'callback',
      requestData: body,
      responseData: data,
      status: 'success',
      createdAt: Timestamp.now(),
    });

    await transactionDoc.ref.update({
      status: 'success',
      paidAt: Timestamp.now(),
      zpTransId: reference,
      updatedAt: Timestamp.now(),
    });

    const { userId, courseId, courseName } = transaction;
    const enrollmentRef = db.collection('enrollments').doc();
    await enrollmentRef.set({
      id: enrollmentRef.id,
      userId,
      courseId,
      transactionId: transactionDoc.id,
      enrolledAt: Timestamp.now(),
      isActive: true,
    });

    await db.collection('notifications').add({
      userId,
      type: 'payment_success',
      title: 'Thanh toán thành công',
      body: `Bạn đã thanh toán thành công khóa học "${courseName}".`,
      link: `/courses/${courseId}`,
      isRead: false,
      createdAt: Timestamp.now(),
      metadata: { transactionId: transactionDoc.id, courseId },
    });

    await db.collection('courses').doc(courseId).update({
      totalStudents: FieldValue.increment(1),
    });

    return res.status(200).json({ message: 'OK' });
  } catch (error: any) {
    console.error('Webhook error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
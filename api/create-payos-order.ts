// api/create-payos-order.ts
import 'dotenv/config';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import axios from 'axios';
import { db, Timestamp } from './_lib/firebase-admin';
import {
  generatePayOSSignature,
  type PayOSSignatureData,
} from './_lib/payos-utils';

import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

console.log('ENV TEST');
console.log({
  clientId: process.env.PAYOS_CLIENT_ID ? 'FOUND' : 'MISSING',
  apiKey: process.env.PAYOS_API_KEY ? 'FOUND' : 'MISSING',
  checksum: process.env.PAYOS_CHECKSUM_KEY ? 'FOUND' : 'MISSING',
});

const PAYOS_BASE_URL = process.env.PAYOS_BASE_URL || 'https://api-merchant.payos.vn';
const PAYOS_CLIENT_ID = process.env.PAYOS_CLIENT_ID || '';
const PAYOS_API_KEY = process.env.PAYOS_API_KEY || '';
const PAYOS_CHECKSUM_KEY = process.env.PAYOS_CHECKSUM_KEY || '';
const APP_URL = process.env.APP_URL || 'http://localhost:5173';

function maskSecret(value: string, keep = 4): string {
  if (!value) return '(missing)';
  if (value.length <= keep * 2) return `${value.slice(0, 2)}***`;
  return `${value.slice(0, keep)}...${value.slice(-keep)}`;
}

function logAxiosError(error: any) {
  console.error('===== PAYOS ERROR MESSAGE =====');
  console.error(error?.message || error);

  if (error?.response) {
    console.error('===== PAYOS ERROR STATUS =====');
    console.error(error.response.status);

    console.error('===== PAYOS ERROR DATA =====');
    console.error(JSON.stringify(error.response.data, null, 2));
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  console.log('===== PAYOS CREATE ORDER START =====');
  console.log('method:', req.method);
  console.log('body:', JSON.stringify(req.body ?? {}, null, 2));
  console.log('env:', {
    PAYOS_BASE_URL,
    PAYOS_CLIENT_ID: maskSecret(PAYOS_CLIENT_ID),
    PAYOS_API_KEY: maskSecret(PAYOS_API_KEY),
    PAYOS_CHECKSUM_KEY: maskSecret(PAYOS_CHECKSUM_KEY),
    APP_URL,
  });

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { userId, courseId } = req.body || {};
  if (!userId || !courseId) {
    return res.status(400).json({ error: 'Missing userId or courseId' });
  }

  let transactionId = '';
  const paymentLogsRef = db.collection('payment_logs');

  try {
    const courseDoc = await db.collection('courses').doc(courseId).get();
    if (!courseDoc.exists) {
      return res.status(404).json({ error: 'Course not found' });
    }

    const course = courseDoc.data()!;
    const courseName = String(course.title || '').trim();
    const amount = Number(course.price);

    if (!courseName) {
      return res.status(400).json({ error: 'Invalid course title' });
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ error: 'Invalid course price' });
    }

    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = userDoc.data()!;
    const userName = String(user.name || 'User').trim();
    const userEmail = String(user.email || '').trim();

    const orderCode = Date.now();
    transactionId = String(orderCode);
    const transactionRef = db.collection('transactions').doc(transactionId);

    console.log('===== COURSE INFO =====');
    console.log({ courseId, courseName, amount });

    console.log('===== USER INFO =====');
    console.log({ userId, userName, userEmail });

    await transactionRef.set({
      id: transactionId,
      orderId: String(orderCode),
      appTransId: String(orderCode),
      userId,
      userEmail,
      userName,
      courseId,
      courseName,
      amount,
      status: 'pending',
      paymentMethod: 'payos',
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });

    await paymentLogsRef.add({
      transactionId,
      action: 'create_order',
      requestData: { orderCode, amount, courseId, userId },
      responseData: null,
      status: 'pending',
      createdAt: Timestamp.now(),
    });

    const returnUrl = `${APP_URL}/payment-success?transactionId=${transactionId}`;
    const cancelUrl = `${APP_URL}/payment-cancel?transactionId=${transactionId}`;

    // items nằm trong payload tạo link, nhưng KHÔNG đưa vào chuỗi ký
    const items = [
      {
        name: courseName.slice(0, 50),
        quantity: 1,
        price: amount,
      },
    ];

    const signatureData: PayOSSignatureData = {
      amount,
      cancelUrl,
      description: `KH${orderCode}`,
      orderCode,
      returnUrl,
    };

    const signature = generatePayOSSignature(signatureData, PAYOS_CHECKSUM_KEY);

    const apiPayload = {
      orderCode,
      amount,
      description: `KH${orderCode}`,
      cancelUrl,
      returnUrl,
      buyerName: userName,
      buyerEmail: userEmail || undefined,
      items,
      signature,
    };

    console.log('===== PAYOS SIGNATURE DATA =====');
    console.log(JSON.stringify(signatureData, null, 2));

    console.log('===== PAYOS API PAYLOAD =====');
    console.log(JSON.stringify(apiPayload, null, 2));

    const response = await axios.post(
      `${PAYOS_BASE_URL}/v2/payment-requests`,
      apiPayload,
      {
        headers: {
          'x-client-id': PAYOS_CLIENT_ID,
          'x-api-key': PAYOS_API_KEY,
          'Content-Type': 'application/json',
        },
        timeout: 15000,
      }
    );

    console.log('===== PAYOS RESPONSE STATUS =====');
    console.log(response.status);

    console.log('===== PAYOS RESPONSE DATA =====');
    console.log(JSON.stringify(response.data, null, 2));

    const payosData = response.data?.data ?? response.data;

    if (!payosData?.checkoutUrl) {
      throw new Error('Invalid response from PayOS: missing checkoutUrl');
    }

    await transactionRef.update({
      orderId: String(payosData.orderCode ?? orderCode),
      payosCheckoutUrl: payosData.checkoutUrl,
      updatedAt: Timestamp.now(),
    });

    const logQuery = await paymentLogsRef
      .where('transactionId', '==', transactionId)
      .where('action', '==', 'create_order')
      .limit(1)
      .get();

    if (!logQuery.empty) {
      await logQuery.docs[0].ref.update({
        responseData: payosData,
        status: 'success',
      });
    }

    return res.status(200).json({
      checkoutUrl: payosData.checkoutUrl,
      qrCode: payosData.qrCode ?? null,
      transactionId,
    });
  } catch (error: any) {
    logAxiosError(error);

    if (transactionId) {
      try {
        await db.collection('transactions').doc(transactionId).update({
          status: 'failed',
          errorMessage: error?.message || 'Unknown error',
          updatedAt: Timestamp.now(),
        });
      } catch (updateErr) {
        console.error('Failed to update transaction status:', updateErr);
      }

      try {
        const logQuery = await paymentLogsRef
          .where('transactionId', '==', transactionId)
          .where('action', '==', 'create_order')
          .limit(1)
          .get();

        if (!logQuery.empty) {
          await logQuery.docs[0].ref.update({
            status: 'failed',
            responseData: error?.response?.data ?? null,
            errorMessage: error?.message || 'Unknown error',
          });
        }
      } catch (logErr) {
        console.error('Failed to update payment log:', logErr);
      }
    }

    return res.status(500).json({
      error: 'Failed to create payment link',
      details: error?.message || 'Unknown error',
    });
  }
}
// api/payos-webhook.ts

import "dotenv/config";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { db, FieldValue, Timestamp } from "./_lib/firebase-admin.js";
import { generatePayOSSignature } from "./_lib/payos-utils.js";

const PAYOS_CHECKSUM_KEY = process.env.PAYOS_CHECKSUM_KEY || "";

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  console.log("=================================");
  console.log("PAYOS WEBHOOK RECEIVED");
  console.log("METHOD:", req.method);
  console.log("HEADERS:", JSON.stringify(req.headers, null, 2));
  console.log("BODY:", JSON.stringify(req.body, null, 2));
  console.log("=================================");

  if (req.method !== "POST") {
    return res.status(200).json({
      success: true,
      message: "Webhook alive",
    });
  }

  try {
    const body = req.body;

    if (!body) {
      console.error("Webhook body missing");
      return res.status(400).json({
        error: "Missing body",
      });
    }

    // ✅ 1. Verify signature (nếu có checksum key)
    const signature = req.headers["x-payos-signature"] as string;
    if (PAYOS_CHECKSUM_KEY && signature) {
      const computed = generatePayOSSignature(body, PAYOS_CHECKSUM_KEY);
      if (computed !== signature) {
        console.error("Invalid signature");
        await db.collection("payment_logs").add({
          action: "webhook_invalid_signature",
          status: "failed",
          createdAt: Timestamp.now(),
        });
        return res.status(401).json({ error: "Invalid signature" });
      }
    }

    const data = body.data || body;

    console.log("===== WEBHOOK DATA =====");
    console.log(JSON.stringify(data, null, 2));

    const orderCode = String(data.orderCode || "");

    if (!orderCode) {
      console.error("Missing orderCode");
      return res.status(400).json({
        error: "Missing orderCode",
      });
    }

    // Tìm transaction theo orderId
    const transactionQuery = await db
      .collection("transactions")
      .where("orderId", "==", orderCode)
      .limit(1)
      .get();

    if (transactionQuery.empty) {
      console.error("Transaction not found:", orderCode);

      await db.collection("payment_logs").add({
        action: "webhook_transaction_not_found",
        requestData: body,
        status: "failed",
        createdAt: Timestamp.now(),
      });

      return res.status(200).json({
        message: "OK",
      });
    }

    const transactionDoc = transactionQuery.docs[0];
    const transaction = transactionDoc.data();

    console.log("===== TRANSACTION FOUND =====");
    console.log(transaction);

    // ✅ 2. Idempotency: nếu đã xử lý thì bỏ qua
    if (transaction.status === "success" || transaction.status === "failed") {
      console.log("Transaction already processed, ignoring duplicate webhook.");
      await db.collection("payment_logs").add({
        transactionId: transactionDoc.id,
        action: "webhook_duplicate",
        status: "ignored",
        createdAt: Timestamp.now(),
      });
      return res.status(200).json({
        message: "Already processed",
      });
    }

    // Ghi log webhook nhận được
    await db.collection("payment_logs").add({
      transactionId: transactionDoc.id,
      action: "webhook_received",
      requestData: body,
      responseData: data,
      status: "success",
      createdAt: Timestamp.now(),
    });

    console.log("===== UPDATE TRANSACTION =====");

    // Cập nhật transaction thành success
    await transactionDoc.ref.update({
      status: "success",
      paidAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      payosWebhookReceived: true,
    });

    const { userId, courseId, courseName } = transaction;

    console.log("===== CREATE ENROLLMENT =====");

    const enrollmentRef = db.collection("enrollments").doc();
    await enrollmentRef.set({
      id: enrollmentRef.id,
      userId,
      courseId,
      transactionId: transactionDoc.id,
      enrolledAt: Timestamp.now(),
      isActive: true,
    });

    // ✅ Cộng XP cho user (dựa trên amount * 10)
    console.log("===== AWARD XP =====");
    const xpAmount = Math.floor(transaction.amount * 10);
    const userRef = db.collection("users").doc(userId);
    await userRef.update({
      totalXP: FieldValue.increment(xpAmount),
    });

    console.log("===== CREATE NOTIFICATION =====");

    await db.collection("notifications").add({
      userId,
      type: "payment_success",
      title: "Thanh toán thành công",
      body: `Bạn đã thanh toán thành công khóa học "${courseName}".`,
      link: `/courses/${courseId}`,
      isRead: false,
      createdAt: Timestamp.now(),
      metadata: {
        transactionId: transactionDoc.id,
        courseId,
        xpAwarded: xpAmount,
      },
    });

    console.log("===== UPDATE COURSE STUDENTS =====");

    await db.collection("courses").doc(courseId).update({
      totalStudents: FieldValue.increment(1),
    });

    console.log("===== PAYMENT SUCCESS =====");

    return res.status(200).json({
      success: true,
      message: "Payment processed",
    });
  } catch (error: any) {
    console.error("===== WEBHOOK ERROR =====");
    console.error(error);

    await db.collection("payment_logs").add({
      action: "webhook_error",
      status: "failed",
      errorMessage: error?.message || "Unknown error",
      createdAt: Timestamp.now(),
    });

    return res.status(500).json({
      error: error?.message || "Internal server error",
    });
  }
}
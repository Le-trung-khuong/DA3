/**
 * src/pages/client/PaymentModal.tsx
 * Modal hiển thị QR code và theo dõi trạng thái thanh toán
 */

import React, { useEffect } from "react";
import { X, Loader, CheckCircle, XCircle } from "lucide-react";
import { usePaymentStatus } from "../../hooks/usePaymentStatus";
import { QRCodeSVG } from "qrcode.react";

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  transactionId: string | null;
  checkoutUrl: string;
  qrCode: string;
  onSuccess: () => void;
  onFailure?: () => void;
}

export default function PaymentModal({
  isOpen,
  onClose,
  transactionId,
  checkoutUrl,
  qrCode,
  onSuccess,
  onFailure,
}: PaymentModalProps) {
  const { status, loading } = usePaymentStatus(transactionId);

  useEffect(() => {
    if (status === "success") {
      onSuccess();
    } else if (status === "failed" && onFailure) {
      onFailure();
    }
  }, [status, onSuccess, onFailure]);

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.8)",
        backdropFilter: "blur(8px)",
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        style={{
          maxWidth: 500,
          width: "100%",
          background: "#1A1A2E",
          borderRadius: 24,
          border: "1px solid rgba(108,99,255,0.2)",
          padding: 24,
          position: "relative",
          animation: "scaleIn 0.2s ease",
        }}
      >
        <button
          onClick={onClose}
          style={{
            position: "absolute",
            top: 16,
            right: 16,
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "#C7C4D8",
          }}
        >
          <X size={20} />
        </button>

        <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16, color: "#E4E1EE" }}>
          Thanh toán khóa học
        </h2>

        {status === "success" ? (
          <div style={{ textAlign: "center", padding: 20 }}>
            <CheckCircle size={48} color="#45f1c5" />
            <p style={{ marginTop: 12, color: "#45f1c5" }}>Thanh toán thành công!</p>
            <p style={{ fontSize: 13, color: "#C7C4D8", marginTop: 8 }}>
              Bạn có thể bắt đầu học ngay.
            </p>
          </div>
        ) : status === "failed" ? (
          <div style={{ textAlign: "center", padding: 20 }}>
            <XCircle size={48} color="#ffb4ab" />
            <p style={{ marginTop: 12, color: "#ffb4ab" }}>Thanh toán thất bại.</p>
            <button
              onClick={onClose}
              style={{
                marginTop: 16,
                padding: "8px 16px",
                background: "linear-gradient(135deg,#6C63FF,#9B59B6)",
                border: "none",
                borderRadius: 12,
                color: "#fff",
                cursor: "pointer",
              }}
            >
              Đóng
            </button>
          </div>
        ) : (
          <>
            <div style={{ textAlign: "center", marginBottom: 20 }}>
              {qrCode && (
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "center",
                      marginBottom: 12,
                    }}
                  >
                    <div
                      style={{
                        background: "#fff",
                        padding: 12,
                        borderRadius: 12,
                      }}
                    >
                      <QRCodeSVG
                        value={qrCode}
                        size={220}
                      />
                    </div>
                  </div>
                )}
              <p style={{ marginTop: 12, fontSize: 13, color: "#C7C4D8" }}>
                Quét mã QR bằng ứng dụng ngân hàng hoặc chuyển khoản
              </p>
              {checkoutUrl && (
                <a
                  href={checkoutUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: "inline-block",
                    marginTop: 12,
                    padding: "8px 16px",
                    background: "rgba(108,99,255,0.15)",
                    borderRadius: 12,
                    color: "#6C63FF",
                    textDecoration: "none",
                  }}
                >
                  Hoặc thanh toán qua cổng PayOS
                </a>
              )}
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                marginTop: 16,
              }}
            >
              <Loader size={16} style={{ animation: "spin 0.8s linear infinite" }} />
              <span style={{ fontSize: 13, color: "#C7C4D8" }}>Đang chờ thanh toán...</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
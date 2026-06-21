// src/components/certificate/CertificateCard.tsx
import React, { useState } from "react";
import { PDFDownloadLink } from "@react-pdf/renderer";
import { CertificatePDF } from "./CertificatePDF";
import { Award, Download, Calendar, AlertCircle } from "lucide-react";
import type { Certificate } from "../../services/certificateService";

interface CertificateCardProps {
  certificate: Certificate;
}

export function CertificateCard({ certificate }: CertificateCardProps) {
  const { userName, courseTitle, issuedAt, certificateId } = certificate;
  const [error, setError] = useState<string | null>(null);
  const [showError, setShowError] = useState(false);

  const formattedDate = issuedAt.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div
      style={{
        background: "rgba(26,26,46,0.65)",
        border: "1px solid rgba(108,99,255,0.3)",
        borderRadius: 20,
        padding: "20px",
        transition: "transform 0.2s",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 16 }}>
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: 12,
            background: "linear-gradient(135deg,#6C63FF,#9B59B6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Award size={24} color="#fff" />
        </div>
        <div style={{ flex: 1 }}>
          <h3 style={{ fontSize: 18, fontWeight: 700, color: "#E4E1EE" }}>{courseTitle}</h3>
          <div style={{ display: "flex", gap: 16, fontSize: 12, color: "#C7C4D8", marginTop: 4 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <Calendar size={12} /> {formattedDate}
            </span>
            <code style={{ fontSize: 10, color: "#c4c0ff" }}>{certificateId}</code>
          </div>
        </div>
      </div>

      {/* Hiển thị lỗi nếu có */}
      {error && (
        <div
          style={{
            background: "rgba(255,180,171,0.1)",
            border: "1px solid rgba(255,180,171,0.2)",
            borderRadius: 12,
            padding: 8,
            marginBottom: 12,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <AlertCircle size={16} color="#ffb4ab" />
          <span style={{ fontSize: 12, color: "#ffb4ab" }}>{error}</span>
          <button
            onClick={() => setError(null)}
            style={{ background: "none", border: "none", color: "#ffb4ab", cursor: "pointer", marginLeft: "auto" }}
          >
            ✕
          </button>
        </div>
      )}

      <PDFDownloadLink
        document={
          <CertificatePDF
            userName={userName}
            courseTitle={courseTitle}
            issuedAt={issuedAt}
            certificateId={certificateId}
          />
        }
        fileName={`certificate_${courseTitle.replace(/\s/g, "_")}_${certificateId}.pdf`}
      >
        {({ loading, error: pdfError }) => {
          // Nếu có lỗi từ PDFDownloadLink, hiển thị
          if (pdfError) {
            setError("Không thể tạo PDF. Vui lòng thử lại.");
          }

          return (
            <button
              style={{
                width: "100%",
                padding: "10px",
                borderRadius: 12,
                background: loading ? "rgba(255,255,255,0.1)" : "linear-gradient(135deg,#45f1c5,#00D4AA)",
                border: "none",
                color: loading ? "#C7C4D8" : "#0F0F1A",
                fontWeight: 700,
                fontSize: 14,
                cursor: loading ? "wait" : "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                opacity: loading ? 0.7 : 1,
                transition: "all 0.2s",
              }}
              disabled={loading}
              onMouseEnter={(e) => {
                if (!loading) e.currentTarget.style.transform = "scale(1.02)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "scale(1)";
              }}
            >
              {loading ? (
                <>
                  <span
                    style={{
                      display: "inline-block",
                      width: 16,
                      height: 16,
                      border: "2px solid rgba(255,255,255,0.3)",
                      borderTop: "2px solid #6C63FF",
                      borderRadius: "50%",
                      animation: "spin 0.8s linear infinite",
                    }}
                  />
                  Đang tạo PDF...
                </>
              ) : (
                <>
                  <Download size={16} /> Download Certificate
                </>
              )}
            </button>
          );
        }}
      </PDFDownloadLink>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
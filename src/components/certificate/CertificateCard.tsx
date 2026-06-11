import React from "react";
import { PDFDownloadLink } from "@react-pdf/renderer";
import { CertificatePDF } from "./CertificatePDF";
import { Award, Download, Calendar } from "lucide-react";
import type { Certificate } from "../../services/certificateService";

interface CertificateCardProps {
  certificate: Certificate;
}

export function CertificateCard({ certificate }: CertificateCardProps) {
  const { userName, courseTitle, issuedAt, certificateId } = certificate;
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
        {({ loading, error }) => (
          <button
            style={{
              width: "100%",
              padding: "10px",
              borderRadius: 12,
              background: "linear-gradient(135deg,#45f1c5,#00D4AA)",
              border: "none",
              color: "#0F0F1A",
              fontWeight: 700,
              fontSize: 14,
              cursor: loading ? "wait" : "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              opacity: loading ? 0.7 : 1,
            }}
            disabled={loading}
          >
            {loading ? "Generating PDF..." : <><Download size={16} /> Download Certificate</>}
          </button>
        )}
      </PDFDownloadLink>
    </div>
  );
}
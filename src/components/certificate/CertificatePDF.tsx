import React from "react";
import { Document, Page, Text, View, StyleSheet, Font, Image } from "@react-pdf/renderer";

// Đăng ký font (có thể dùng font có sẵn hoặc tải thêm)
Font.register({
  family: "Roboto",
  fonts: [
    { src: "https://fonts.gstatic.com/s/roboto/v30/KFOmCnqEu92Fr1Mu4mxP.ttf" },
    { src: "https://fonts.gstatic.com/s/roboto/v30/KFOlCnqEu92Fr1MmEU9fBBc4.ttf", fontWeight: "bold" },
  ],
});

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: "Roboto",
    backgroundColor: "#fff",
    position: "relative",
  },
  border: {
    border: "2px solid #6C63FF",
    padding: 30,
    borderRadius: 10,
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    textAlign: "center",
    color: "#6C63FF",
    marginBottom: 30,
  },
  subTitle: {
    fontSize: 18,
    textAlign: "center",
    marginBottom: 20,
    color: "#555",
  },
  recipientName: {
    fontSize: 28,
    fontWeight: "bold",
    textAlign: "center",
    marginVertical: 20,
    color: "#333",
  },
  courseName: {
    fontSize: 22,
    fontWeight: "bold",
    textAlign: "center",
    marginVertical: 15,
    color: "#6C63FF",
  },
  bodyText: {
    fontSize: 14,
    textAlign: "center",
    marginVertical: 10,
    color: "#666",
    lineHeight: 1.5,
  },
  date: {
    fontSize: 12,
    textAlign: "center",
    marginTop: 30,
    color: "#888",
  },
  certId: {
    fontSize: 10,
    textAlign: "center",
    marginTop: 20,
    color: "#aaa",
  },
  seal: {
    position: "absolute",
    bottom: 80,
    right: 80,
    width: 80,
    height: 80,
    opacity: 0.6,
  },
});

interface CertificatePDFProps {
  userName: string;
  courseTitle: string;
  issuedAt: Date;
  certificateId: string;
}

export function CertificatePDF({ userName, courseTitle, issuedAt, certificateId }: CertificatePDFProps) {
  const formattedDate = issuedAt.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.border}>
          <Text style={styles.title}>CERTIFICATE OF COMPLETION</Text>
          <Text style={styles.subTitle}>This certificate is proudly presented to</Text>
          <Text style={styles.recipientName}>{userName}</Text>
          <Text style={styles.bodyText}>for successfully completing the course</Text>
          <Text style={styles.courseName}>"{courseTitle}"</Text>
          <Text style={styles.bodyText}>
            demonstrating outstanding dedication and mastery of the subject matter.
          </Text>
          <Text style={styles.date}>Issued on {formattedDate}</Text>
          <Text style={styles.certId}>Certificate ID: {certificateId}</Text>
        </View>
        <Image
          style={styles.seal}
          src="https://upload.wikimedia.org/wikipedia/commons/thumb/5/50/Seal_of_the_United_States_Department_of_Education.svg/1200px-Seal_of_the_United_States_Department_of_Education.svg.png"
        />
      </Page>
    </Document>
  );
}
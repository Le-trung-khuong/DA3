/**
 * src/pages/admin/Login.tsx
 * Tự động thêm createdAt nếu user cũ thiếu
 */

import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { signInWithEmailAndPassword } from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../../utils/config";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      // 1. Đăng nhập Firebase Auth
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // 2. Kiểm tra document trong Firestore
      const userRef = doc(db, "users", user.uid);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        // 3. Tạo mới document
        await setDoc(userRef, {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName ?? email.split("@")[0],
          role: "student",
          status: "active",
          level: 1,
          xp: 0,
          currentStreak: 0,
          totalLessons: 0,
          createdAt: serverTimestamp(),
          lastLogin: serverTimestamp(),
        });
        console.log("✅ Tạo mới user document cho:", user.email);
      } else {
        // 4. Cập nhật lastLogin, và thêm createdAt nếu thiếu
        const existingData = userSnap.data();
        const updatePayload: Record<string, any> = {
          lastLogin: serverTimestamp(),
        };
        
        // Migration: thêm createdAt nếu user cũ chưa có
        if (!existingData.createdAt) {
          updatePayload.createdAt = serverTimestamp();
          console.log("🔧 Đã thêm createdAt cho user cũ:", user.email);
        }
        
        await setDoc(userRef, updatePayload, { merge: true });
        console.log("🔄 Đã cập nhật lastLogin cho:", user.email);
      }

      // 5. Chuyển hướng đến trang quản lý users
      navigate("/admin/users");
    } catch (err: any) {
      console.error("Lỗi đăng nhập:", err);
      setError(err.message || "Đăng nhập thất bại");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "#0F0F1A",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "Inter, sans-serif",
    }}>
      <div style={{
        width: "100%",
        maxWidth: 420,
        padding: 32,
        background: "rgba(26,26,46,0.95)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 24,
        backdropFilter: "blur(12px)",
      }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{
            width: 48, height: 48,
            background: "linear-gradient(135deg,#6C63FF,#9B59B6)",
            borderRadius: 12,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 12px",
          }}>
            <span style={{ fontSize: 24, fontWeight: 800, color: "#fff" }}>SR</span>
          </div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: "#E4E1EE" }}>Admin Login</h2>
          <p style={{ fontSize: 12, color: "#C7C4D8", marginTop: 4 }}>Smart Review Dashboard</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#C7C4D8", marginBottom: 6 }}>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{
                width: "100%",
                background: "#0d0d18",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 12,
                padding: "10px 14px",
                color: "#E4E1EE",
                fontSize: 14,
                outline: "none",
              }}
              placeholder="admin@smartreview.io"
            />
          </div>
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#C7C4D8", marginBottom: 6 }}>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{
                width: "100%",
                background: "#0d0d18",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 12,
                padding: "10px 14px",
                color: "#E4E1EE",
                fontSize: 14,
                outline: "none",
              }}
            />
          </div>
          {error && (
            <div style={{ marginBottom: 16, fontSize: 12, color: "#ffb4ab", textAlign: "center" }}>
              {error}
            </div>
          )}
          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              padding: "12px",
              borderRadius: 12,
              fontSize: 14,
              fontWeight: 700,
              cursor: loading ? "wait" : "pointer",
              background: "linear-gradient(135deg,#6C63FF,#9B59B6)",
              border: "none",
              color: "#fff",
              transition: "opacity 0.2s",
            }}
          >
            {loading ? "Logging in..." : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}
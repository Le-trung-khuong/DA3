/**
 * Smart Review — Admin Review List (Firestore Realtime)
 * File: src/pages/admin/reviews/ReviewListAdmin.tsx
 *
 * Features:
 *   - Realtime onSnapshot from Firestore `reviews` collection
 *   - Filter by rating (1-5) and status (visible/hidden/reported)
 *   - Search by userName or courseTitle
 *   - Pagination (client-side)
 *   - Hide/Unhide review (soft delete)
 *   - Delete review permanently (with confirm dialog)
 *   - Stats cards: total reviews, avg rating, visible/hidden counts, reported
 *   - Sort by reportCount (high to low)
 *   - ✅ Hiển thị Verified, Review Weight, Helpful/Not Helpful
 */

"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
} from "firebase/firestore";
import { db } from "../../../utils/config";
import { hideReview, unhideReview, deleteReview } from "../../../services/reviewService";
import type { Review, ReviewStatus } from "../../../types/review";

import {
  Search,
  Eye,
  EyeOff,
  Trash2,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Users,
  Star,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Loader,
  BookOpen,
  Calendar,
  Shield,
  Award,
  ThumbsUp,
  ThumbsDown,
} from "lucide-react";

// ==================== HELPERS ====================
const fmtDate = (d: Date) => d.toLocaleDateString("vi-VN");
const fmtRelative = (d: Date) => {
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "vừa xong";
  if (mins < 60) return `${mins}p trước`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h trước`;
  const days = Math.floor(hrs / 24);
  return `${days}d trước`;
};

const weightToColor = (weight: number): string => {
  if (weight >= 1.8) return "#FFD700";
  if (weight >= 1.5) return "#FFB785";
  if (weight >= 1.2) return "#6C63FF";
  return "#C7C4D8";
};

const STATUS_CFG: Record<ReviewStatus, { label: string; color: string; bg: string; border: string; Icon: React.ElementType }> = {
  visible: { label: "Visible", color: "#45f1c5", bg: "rgba(69,241,197,.12)", border: "rgba(69,241,197,.28)", Icon: Eye },
  hidden:  { label: "Hidden",  color: "#B0AEC0", bg: "rgba(176,174,192,.12)", border: "rgba(176,174,192,.22)", Icon: EyeOff },
  reported:{ label: "Reported",color: "#ffb4ab", bg: "rgba(255,180,171,.12)", border: "rgba(255,180,171,.28)", Icon: AlertTriangle },
};

// ==================== COMPONENTS ====================
const DeleteConfirmDialog = ({ review, onConfirm, onCancel }: { review: Review; onConfirm: () => void; onCancel: () => void }) => {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.7)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={(e) => e.target === e.currentTarget && onCancel()}>
      <div style={{ background: "#1a1a2e", borderRadius: 24, padding: 24, maxWidth: 400, border: "1px solid #ffb4ab" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
          <Trash2 size={24} color="#ffb4ab" />
          <h3 style={{ fontSize: 18, fontWeight: 700, color: "#E4E1EE" }}>Delete review?</h3>
        </div>
        <p style={{ color: "#C7C4D8", marginBottom: 20 }}>
          Are you sure you want to permanently delete review from <strong>{review.userName}</strong> on <strong>{review.courseTitle}</strong>?
        </p>
        <div style={{ display: "flex", gap: 12 }}>
          <button onClick={onCancel} style={{ flex: 1, padding: "10px", borderRadius: 12, background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.08)", color: "#C7C4D8", cursor: "pointer" }}>
            Cancel
          </button>
          <button onClick={onConfirm} style={{ flex: 1, padding: "10px", borderRadius: 12, background: "rgba(255,180,171,.12)", border: "1px solid rgba(255,180,171,.3)", color: "#ffb4ab", cursor: "pointer" }}>
            Delete Permanently
          </button>
        </div>
      </div>
    </div>
  );
};

const ReviewDetailModal = ({ review, onClose }: { review: Review; onClose: () => void }) => (
  <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.7)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={onClose}>
    <div style={{ background: "#1a1a2e", borderRadius: 24, padding: 24, maxWidth: 500, border: "1px solid rgba(255,255,255,.1)" }} onClick={e => e.stopPropagation()}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
        <h3 style={{ fontSize: 18, fontWeight: 700, color: "#E4E1EE" }}>Review Details</h3>
        <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#C7C4D8" }}><XCircle size={18} /></button>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {[
          ["User", review.userName],
          ["Course", review.courseTitle],
          ["Rating", `${review.rating} / 5`],
          ["Content", review.content],
          ["Status", review.status],
          ["Verified", review.verified ? "✅ Yes" : "❌ No"],
          ["Weight", (review.reviewWeight || 1).toFixed(2) + "x"],
          ["Helpful", `${review.helpfulCount || 0} 👍`],
          ["Not Helpful", `${review.notHelpfulCount || 0} 👎`],
          ["Report Count", review.reportCount ?? 0],
          ["Created", fmtDate(review.createdAt)],
          ["Updated", fmtDate(review.updatedAt)],
          ...(review.adminNote ? [["Admin Note", review.adminNote]] : []),
        ].map(([k, v]) => (
          <div key={k} style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid rgba(255,255,255,.05)", paddingBottom: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#C7C4D8", textTransform: "uppercase", letterSpacing: ".06em" }}>{k}</span>
            <span style={{ fontSize: 13, color: "#E4E1EE", fontWeight: 600, textAlign: "right", maxWidth: 240 }}>{v}</span>
          </div>
        ))}
      </div>
      <button onClick={onClose} style={{ marginTop: 20, width: "100%", padding: "10px", borderRadius: 12, background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.08)", color: "#C7C4D8", cursor: "pointer" }}>Close</button>
    </div>
  </div>
);

// ==================== MAIN ====================
export default function ReviewListAdmin() {
  const navigate = useNavigate();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [ratingFilter, setRatingFilter] = useState<number | "all">("all");
  const [statusFilter, setStatusFilter] = useState<ReviewStatus | "all">("all");
  const [sortBy, setSortBy] = useState<'reportCount' | 'createdAt'>('reportCount');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const [deleteTarget, setDeleteTarget] = useState<Review | null>(null);
  const [viewTarget, setViewTarget] = useState<Review | null>(null);
  const pageSize = 10;

  // ========== REALTIME FIRESTORE LISTENER ==========
  useEffect(() => {
    console.log("[ReviewList] Setting up Firestore listener on 'reviews'");
    const q = query(collection(db, "reviews"), orderBy("createdAt", "desc"));

    const unsub = onSnapshot(
      q,
      (snapshot) => {
        if (reviews.length === 0 && snapshot.size > 0) {
          console.log(`✅ Loaded ${snapshot.size} reviews from Firestore`);
        }

        const reviewList: Review[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          reviewList.push({
            id: docSnap.id,
            userId: data.userId || "",
            userName: data.userName || "Anonymous",
            userAvatar: data.userAvatar,
            courseId: data.courseId || "",
            courseTitle: data.courseTitle || "Unknown course",
            rating: data.rating || 0,
            content: data.content || "",
            status: data.status || "visible",
            verified: data.verified || false,
            reviewWeight: data.reviewWeight || 1.0,
            helpfulCount: data.helpfulCount || 0,
            notHelpfulCount: data.notHelpfulCount || 0,
            helpfulUsers: data.helpfulUsers || [],
            notHelpfulUsers: data.notHelpfulUsers || [],
            reportCount: data.reportCount || 0,
            adminNote: data.adminNote,
            createdAt: data.createdAt?.toDate?.() ?? new Date(),
            updatedAt: data.updatedAt?.toDate?.() ?? new Date(),
          });
        });
        setReviews(reviewList);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error("Firestore error:", err);
        setError(err.message);
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  // ========== FILTERS & SORT ==========
  const filtered = useMemo(() => {
    let data = [...reviews];
    const q = search.toLowerCase();
    if (q) {
      data = data.filter(r => r.userName.toLowerCase().includes(q) || r.courseTitle.toLowerCase().includes(q) || r.content.toLowerCase().includes(q));
    }
    if (ratingFilter !== "all") {
      data = data.filter(r => r.rating === ratingFilter);
    }
    if (statusFilter !== "all") {
      data = data.filter(r => r.status === statusFilter);
    }
    if (sortBy === 'reportCount') {
      data.sort((a, b) => (b.reportCount || 0) - (a.reportCount || 0));
    } else {
      data.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    }
    if (sortOrder === 'asc') data.reverse();
    return data;
  }, [reviews, search, ratingFilter, statusFilter, sortBy, sortOrder]);

  const totalPages = Math.ceil(filtered.length / pageSize);
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);

  // ========== ACTIONS ==========
  const handleHideToggle = async (review: Review) => {
    try {
      if (review.status === "visible") {
        await hideReview(review.id);
        alert(`✅ Review hidden`);
      } else if (review.status === "hidden") {
        await unhideReview(review.id);
        alert(`✅ Review restored to visible`);
      }
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  const handleDelete = async (review: Review) => {
    try {
      await deleteReview(review.id);
      alert(`✅ Review deleted permanently`);
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
    setDeleteTarget(null);
  };

  // ========== STATS ==========
  const stats = useMemo(() => {
    const total = reviews.length;
    const avgRating = total ? +(reviews.reduce((sum, r) => sum + r.rating, 0) / total).toFixed(1) : 0;
    const visible = reviews.filter(r => r.status === "visible").length;
    const hidden = reviews.filter(r => r.status === "hidden").length;
    const reported = reviews.filter(r => r.status === "reported").length;
    const verified = reviews.filter(r => r.verified).length;
    const avgWeight = total ? +(reviews.reduce((sum, r) => sum + (r.reviewWeight || 1), 0) / total).toFixed(2) : 0;
    return { total, avgRating, visible, hidden, reported, verified, avgWeight };
  }, [reviews]);

  // ========== RESET PAGE WHEN FILTERS CHANGE ==========
  useEffect(() => {
    setPage(1);
  }, [search, ratingFilter, statusFilter, sortBy, sortOrder]);

  if (loading) return <div style={{ display: "flex", justifyContent: "center", padding: 40 }}><Loader size={32} style={{ animation: "spin 1s linear infinite" }} /> Loading reviews...</div>;
  if (error) return <div style={{ textAlign: "center", padding: 40, color: "#ffb4ab" }}>Error: {error}</div>;

  return (
    <div style={{ padding: 24, background: "#0F0F1A", minHeight: "100vh" }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "#E4E1EE" }}>Review Management</h1>
          <p style={{ color: "#C7C4D8" }}>Firestore: <code>reviews</code> • Realtime onSnapshot</p>
        </div>
        <button onClick={() => window.location.reload()} style={{ padding: "8px 16px", borderRadius: 12, background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.08)", color: "#C7C4D8" }}>
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Stats Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px,1fr))", gap: 16, marginBottom: 24 }}>
        {[
          { label: "Total Reviews", value: stats.total, icon: Users, color: "#c4c0ff" },
          { label: "Avg Rating", value: stats.avgRating, icon: Star, color: "#FFB785" },
          { label: "Verified", value: stats.verified, icon: Shield, color: "#45f1c5" },
          { label: "Avg Weight", value: stats.avgWeight + "x", icon: Award, color: "#FFD700" },
          { label: "Visible", value: stats.visible, icon: Eye, color: "#45f1c5" },
          { label: "Hidden", value: stats.hidden, icon: EyeOff, color: "#B0AEC0" },
          { label: "Reported", value: stats.reported, icon: AlertTriangle, color: "#ffb4ab" },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} style={{ background: "rgba(26,26,46,.7)", borderRadius: 16, padding: 16, display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: `${color}20`, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Icon size={20} color={color} />
            </div>
            <div>
              <div style={{ fontSize: 11, color: "#C7C4D8" }}>{label}</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: "#E4E1EE" }}>{value}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ position: "relative", flex: 1, maxWidth: 320 }}>
          <Search size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#C7C4D8" }} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by user, course, or content..." style={{ width: "100%", background: "#0d0d18", border: "1px solid rgba(255,255,255,.08)", borderRadius: 12, padding: "9px 12px 9px 34px", color: "#E4E1EE" }} />
        </div>

        <select value={ratingFilter} onChange={(e) => setRatingFilter(e.target.value === "all" ? "all" : Number(e.target.value))} style={{ background: "#0d0d18", border: "1px solid rgba(255,255,255,.08)", borderRadius: 12, padding: "8px 12px", color: "#E4E1EE" }}>
          <option value="all">All ratings</option>
          <option value="5">★★★★★ (5)</option>
          <option value="4">★★★★☆ (4)</option>
          <option value="3">★★★☆☆ (3)</option>
          <option value="2">★★☆☆☆ (2)</option>
          <option value="1">★☆☆☆☆ (1)</option>
        </select>

        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)} style={{ background: "#0d0d18", border: "1px solid rgba(255,255,255,.08)", borderRadius: 12, padding: "8px 12px", color: "#E4E1EE" }}>
          <option value="all">All status</option>
          <option value="visible">Visible</option>
          <option value="hidden">Hidden</option>
          <option value="reported">Reported</option>
        </select>

        <select value={sortBy} onChange={(e) => setSortBy(e.target.value as any)} style={{ background: '#0d0d18', border: '1px solid rgba(255,255,255,.08)', borderRadius: 12, padding: '8px 12px', color: '#E4E1EE' }}>
          <option value="reportCount">Sort by Reports</option>
          <option value="createdAt">Sort by Date</option>
        </select>
        <button onClick={() => setSortOrder(o => o === 'desc' ? 'asc' : 'desc')} style={{ background: '#0d0d18', border: '1px solid rgba(255,255,255,.08)', borderRadius: 12, padding: '8px 12px', color: '#E4E1EE' }}>
          {sortOrder === 'desc' ? '↓' : '↑'}
        </button>

        <span style={{ marginLeft: "auto", fontSize: 12, color: "#C7C4D8" }}>{filtered.length} reviews</span>
      </div>

      {/* Table */}
      <div style={{ background: "rgba(26,26,46,.6)", borderRadius: 20, border: "1px solid rgba(255,255,255,.06)", overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1200 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(255,255,255,.06)" }}>
                <th style={{ padding: "12px 16px", textAlign: "left" }}>User</th>
                <th style={{ padding: "12px 16px", textAlign: "left" }}>Course</th>
                <th style={{ padding: "12px 16px", textAlign: "center" }}>Rating</th>
                <th style={{ padding: "12px 16px", textAlign: "left" }}>Review Content</th>
                <th style={{ padding: "12px 16px", textAlign: "center" }}>Status</th>
                <th style={{ padding: "12px 16px", textAlign: "center" }}>Verified</th>
                <th style={{ padding: "12px 16px", textAlign: "center" }}>Weight</th>
                <th style={{ padding: "12px 16px", textAlign: "center" }}>Helpful</th>
                <th style={{ padding: "12px 16px", textAlign: "center" }}>Reports</th>
                <th style={{ padding: "12px 16px", textAlign: "left" }}>Created</th>
                <th style={{ padding: "12px 16px", textAlign: "center" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginated.map(review => {
                const statusCfg = STATUS_CFG[review.status];
                const StatusIcon = statusCfg.Icon;
                const starColor = review.rating >= 4 ? "#FFB785" : review.rating >= 3 ? "#c4c0ff" : "#B0AEC0";
                const weightColor = weightToColor(review.reviewWeight || 1);
                return (
                  <tr key={review.id} style={{ borderBottom: "1px solid rgba(255,255,255,.04)" }}>
                    <td style={{ padding: "12px 16px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ width: 32, height: 32, borderRadius: "50%", background: "linear-gradient(135deg,#6C63FF,#9B59B6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: "#fff" }}>
                          {review.userName.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, color: "#E4E1EE" }}>{review.userName}</div>
                          <div style={{ fontSize: 11, color: "#C7C4D8" }}>{review.userId.slice(0, 8)}…</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <BookOpen size={12} color="#C7C4D8" />
                        <span style={{ fontSize: 13, color: "#C7C4D8" }}>{review.courseTitle}</span>
                      </div>
                    </td>
                    <td style={{ padding: "12px 16px", textAlign: "center" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 2 }}>
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star key={i} size={14} fill={i < review.rating ? starColor : "transparent"} color={starColor} />
                        ))}
                      </div>
                      <span style={{ fontSize: 11, color: starColor, marginTop: 2, display: "block" }}>{review.rating}.0</span>
                    </td>
                    <td style={{ padding: "12px 16px", maxWidth: 300 }}>
                      <div style={{ fontSize: 13, color: "#C7C4D8", lineHeight: 1.5, overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
                        {review.content}
                      </div>
                    </td>
                    <td style={{ padding: "12px 16px", textAlign: "center" }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 10px", borderRadius: 999, background: statusCfg.bg, border: `1px solid ${statusCfg.border}`, color: statusCfg.color, fontSize: 11, fontWeight: 700 }}>
                        <StatusIcon size={11} /> {statusCfg.label}
                      </span>
                    </td>
                    <td style={{ padding: "12px 16px", textAlign: "center" }}>
                      {review.verified ? (
                        <span style={{ color: "#45f1c5" }}>
                          <Shield size={16} />
                        </span>
                      ) : (
                        <span style={{ color: "#47464f" }}>—</span>
                      )}
                    </td>
                    <td style={{ padding: "12px 16px", textAlign: "center", fontWeight: 600, color: weightColor }}>
                      {(review.reviewWeight || 1).toFixed(2)}x
                    </td>
                    <td style={{ padding: "12px 16px", textAlign: "center" }}>
                      <div style={{ display: "flex", gap: 6, justifyContent: "center", fontSize: 12 }}>
                        <span style={{ color: "#45f1c5" }}>👍 {review.helpfulCount || 0}</span>
                        <span style={{ color: "#47464f" }}>👎 {review.notHelpfulCount || 0}</span>
                      </div>
                    </td>
                    <td style={{ padding: "12px 16px", textAlign: "center", fontWeight: 600, color: (review.reportCount || 0) > 5 ? '#ffb4ab' : '#E4E1EE' }}>
                      {review.reportCount || 0}
                    </td>
                    <td style={{ padding: "12px 16px", fontSize: 12, color: "#C7C4D8" }}>
                      {fmtRelative(review.createdAt)}<br/>{fmtDate(review.createdAt)}
                    </td>
                    <td style={{ padding: "12px 16px", textAlign: "center" }}>
                      <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
                        <button onClick={() => setViewTarget(review)} title="View details" style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(108,99,255,.08)", border: "1px solid rgba(108,99,255,.2)", cursor: "pointer", color: "#6C63FF" }}>
                          <Eye size={14} />
                        </button>
                        <button onClick={() => handleHideToggle(review)} title={review.status === "visible" ? "Hide review" : "Restore review"} style={{ width: 32, height: 32, borderRadius: 8, background: review.status === "visible" ? "rgba(255,180,171,.08)" : "rgba(69,241,197,.08)", border: `1px solid ${review.status === "visible" ? "rgba(255,180,171,.2)" : "rgba(69,241,197,.2)"}`, cursor: "pointer", color: review.status === "visible" ? "#ffb4ab" : "#45f1c5" }}>
                          {review.status === "visible" ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                        <button onClick={() => setDeleteTarget(review)} title="Delete permanently" style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(255,180,171,.08)", border: "1px solid rgba(255,180,171,.2)", cursor: "pointer", color: "#ffb4ab" }}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {filtered.length > 0 && (
          <div style={{ padding: "16px 20px", borderTop: "1px solid rgba(255,255,255,.05)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 12, color: "#C7C4D8" }}>{(page-1)*pageSize+1}–{Math.min(page*pageSize, filtered.length)} of {filtered.length}</span>
            <div style={{ display: "flex", gap: 6 }}>
              <button disabled={page===1} onClick={() => setPage(p=>p-1)} style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.08)", cursor: page===1?"not-allowed":"pointer", color: page===1?"#47464f":"#C7C4D8" }}>
                <ChevronLeft size={14} />
              </button>
              <span style={{ padding: "0 12px", fontSize: 13 }}>{page} / {totalPages}</span>
              <button disabled={page===totalPages} onClick={() => setPage(p=>p+1)} style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.08)", cursor: page===totalPages?"not-allowed":"pointer", color: page===totalPages?"#47464f":"#C7C4D8" }}>
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {deleteTarget && <DeleteConfirmDialog review={deleteTarget} onConfirm={() => handleDelete(deleteTarget)} onCancel={() => setDeleteTarget(null)} />}
      {viewTarget && <ReviewDetailModal review={viewTarget} onClose={() => setViewTarget(null)} />}
    </div>
  );
}
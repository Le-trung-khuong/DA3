// src/pages/instructor/InstructorCourseList.tsx
/**
 * Instructor Course List – Quản lý khóa học của instructor
 * Sử dụng realtime onSnapshot + lọc theo instructorId
 */

import React, { useState, useEffect, useMemo } from "react";
import { useAuth } from "../../contexts/AuthContext";
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  doc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../../utils/config";
import {
  Search,
  Plus,
  Edit3,
  Trash2,
  Eye,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  BookOpen,
  Star,
  Clock,
  DollarSign,
  Layers,
  CheckCircle,
  XCircle,
  PauseCircle,
  RefreshCw,
  Loader,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

// ─── Types ──────────────────────────────────────────────────────────────
type CourseStatus = "published" | "draft" | "archived";

interface Course {
  id: string;
  title: string;
  description: string;
  price: number;
  category: string;
  status: CourseStatus;
  thumbnailUrl?: string;
  modulesCount: number;
  rating: number;
  totalStudents: number;
  totalDurationHours: number;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Constants ──────────────────────────────────────────────────────────
const STATUS_CFG: Record<CourseStatus, { label: string; color: string; bg: string; border: string; Icon: React.ElementType }> = {
  published: { label: "Published", color: "#45f1c5", bg: "rgba(69,241,197,.12)", border: "rgba(69,241,197,.25)", Icon: CheckCircle },
  draft: { label: "Draft", color: "#FFB785", bg: "rgba(255,183,133,.12)", border: "rgba(255,183,133,.25)", Icon: PauseCircle },
  archived: { label: "Archived", color: "#B0AEC0", bg: "rgba(176,174,192,.12)", border: "rgba(176,174,192,.20)", Icon: XCircle },
};

const PAGE_SIZE = 8;

// ─── Helpers ─────────────────────────────────────────────────────────────
const fmtCurrency = (n: number) =>
  n === 0 ? "Free" : new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(n);
const fmtDate = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

// ─── Main Component ──────────────────────────────────────────────────────
export default function InstructorCourseList() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const uid = currentUser?.uid;

  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<CourseStatus | "all">("all");
  const [page, setPage] = useState(1);
  const [deleteTarget, setDeleteTarget] = useState<Course | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null);

  // ─── Realtime listener ──────────────────────────────────────────────────
  useEffect(() => {
    if (!uid) return;

    const constraints: any[] = [
      where("instructorId", "==", uid),
      orderBy("createdAt", "desc"),
    ];

    if (statusFilter !== "all") {
      constraints.push(where("status", "==", statusFilter));
    }

    const q = query(collection(db, "courses"), ...constraints);
    const unsub = onSnapshot(
      q,
      (snapshot) => {
        let courseList: Course[] = snapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            title: data.title || "Untitled",
            description: data.description || "",
            price: data.price || 0,
            category: data.category || "Development",
            status: data.status || "draft",
            thumbnailUrl: data.thumbnailUrl || "",
            modulesCount: data.modules?.length || 0,
            rating: data.rating || 0,
            totalStudents: data.totalStudents || 0,
            totalDurationHours: data.totalDurationHours || 0,
            createdAt: data.createdAt?.toDate?.() || new Date(),
            updatedAt: data.updatedAt?.toDate?.() || new Date(),
          };
        });

        if (search.trim()) {
          const qLower = search.toLowerCase();
          courseList = courseList.filter(
            (c) => c.title.toLowerCase().includes(qLower) || c.description.toLowerCase().includes(qLower)
          );
        }

        setCourses(courseList);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error("Courses error:", err);
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [uid, statusFilter, search]);

  // ─── Reset page khi filter thay đổi ──────────────────────────────────
  useEffect(() => {
    setPage(1);
  }, [search, statusFilter]);

  // ─── Pagination ────────────────────────────────────────────────────────
  const filtered = useMemo(() => courses, [courses]);
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // ─── Actions ────────────────────────────────────────────────────────────
  const handleDelete = async (course: Course, soft = true) => {
    try {
      const ref = doc(db, "courses", course.id);
      if (soft) {
        await updateDoc(ref, { status: "archived", updatedAt: serverTimestamp() });
        showToast(`"${course.title}" archived`, "info");
      } else {
        await updateDoc(ref, { status: "deleted", updatedAt: serverTimestamp() });
        showToast(`"${course.title}" deleted`, "error");
      }
    } catch (err: any) {
      showToast(`Error: ${err.message}`, "error");
    }
    setDeleteTarget(null);
  };

  const showToast = (msg: string, type: string) => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  if (loading && courses.length === 0) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: 60 }}>
        <Loader size={32} color="#6C63FF" style={{ animation: "spin 1s linear infinite" }} />
      </div>
    );
  }

  return (
    <div style={{ padding: 24, color: "#E4E1EE", minHeight: "100vh" }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700 }}>My Courses</h1>
          <p style={{ color: "#C7C4D8", fontSize: 13 }}>
            {courses.length} courses · {courses.filter((c) => c.status === "published").length} published
          </p>
        </div>
        <button
          onClick={() => navigate("/admin/courses/new")}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "10px 20px",
            borderRadius: 12,
            background: "linear-gradient(135deg,#6C63FF,#9B59B6)",
            border: "none",
            color: "#fff",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          <Plus size={16} /> Add Course
        </button>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ position: "relative", flex: 1, maxWidth: 320 }}>
          <Search size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#C7C4D8" }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title..."
            style={{
              width: "100%",
              background: "#0d0d18",
              border: "1px solid rgba(255,255,255,.08)",
              borderRadius: 12,
              padding: "9px 12px 9px 34px",
              color: "#E4E1EE",
            }}
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as any)}
          style={{
            background: "#0d0d18",
            border: "1px solid rgba(255,255,255,.08)",
            borderRadius: 12,
            padding: "8px 12px",
            color: "#E4E1EE",
          }}
        >
          <option value="all">All status</option>
          <option value="published">Published</option>
          <option value="draft">Draft</option>
          <option value="archived">Archived</option>
        </select>

        <button
          onClick={() => window.location.reload()}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "8px 14px",
            borderRadius: 10,
            background: "rgba(255,255,255,.05)",
            border: "1px solid rgba(255,255,255,.08)",
            color: "#C7C4D8",
            cursor: "pointer",
          }}
        >
          <RefreshCw size={14} />
        </button>

        <span style={{ marginLeft: "auto", fontSize: 12, color: "#C7C4D8" }}>{filtered.length} courses</span>
      </div>

      {/* Table */}
      <div style={{ background: "rgba(26,26,46,.6)", borderRadius: 20, border: "1px solid rgba(255,255,255,.06)", overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 800 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(255,255,255,.06)" }}>
                <th style={{ padding: "12px 16px", textAlign: "left", width: 48 }}></th>
                <th style={{ padding: "12px 16px", textAlign: "left" }}>Course</th>
                <th style={{ padding: "12px 16px", textAlign: "left" }}>Price</th>
                <th style={{ padding: "12px 16px", textAlign: "left" }}>Students</th>
                <th style={{ padding: "12px 16px", textAlign: "left" }}>Status</th>
                <th style={{ padding: "12px 16px", textAlign: "left" }}>Updated</th>
                <th style={{ padding: "12px 16px", textAlign: "center" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginated.map((course) => {
                const statusCfg = STATUS_CFG[course.status];
                const StatusIcon = statusCfg.Icon;
                return (
                  <tr key={course.id} style={{ borderBottom: "1px solid rgba(255,255,255,.04)" }}>
                    <td style={{ padding: "12px 8px 12px 16px" }}>
                      <div
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: 8,
                          background: "rgba(108,99,255,.12)",
                          border: "1px solid rgba(108,99,255,.2)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        {course.thumbnailUrl ? (
                          <img src={course.thumbnailUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 6 }} />
                        ) : (
                          <BookOpen size={18} color="#6C63FF" />
                        )}
                      </div>
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <div style={{ fontWeight: 600, color: "#E4E1EE", marginBottom: 4 }}>{course.title}</div>
                      <div style={{ display: "flex", gap: 8, fontSize: 11, color: "#C7C4D8" }}>
                        <span>{course.category}</span>
                        <span>·</span>
                        <span>{course.totalDurationHours}h</span>
                        <span>·</span>
                        <span style={{ display: "flex", alignItems: "center", gap: 3 }}>
                          <Star size={11} color="#FFB785" fill="#FFB785" /> {course.rating.toFixed(1)}
                        </span>
                      </div>
                    </td>
                    <td style={{ padding: "12px 16px", fontWeight: 700, color: course.price === 0 ? "#45f1c5" : "#e3dfff" }}>
                      {fmtCurrency(course.price)}
                    </td>
                    <td style={{ padding: "12px 16px", fontSize: 13 }}>{course.totalStudents}</td>
                    <td style={{ padding: "12px 16px" }}>
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                          padding: "3px 10px",
                          borderRadius: 999,
                          background: statusCfg.bg,
                          border: `1px solid ${statusCfg.border}`,
                          fontSize: 11,
                          fontWeight: 700,
                          color: statusCfg.color,
                        }}
                      >
                        <StatusIcon size={11} /> {statusCfg.label}
                      </span>
                    </td>
                    <td style={{ padding: "12px 16px", fontSize: 12, color: "#C7C4D8" }}>{fmtDate(course.updatedAt)}</td>
                    <td style={{ padding: "12px 16px", textAlign: "center" }}>
                      <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
                        <button
                          onClick={() => navigate(`/admin/courses/${course.id}`)}
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: 8,
                            background: "rgba(108,99,255,.08)",
                            border: "1px solid rgba(108,99,255,.2)",
                            cursor: "pointer",
                            color: "#6C63FF",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <Eye size={14} />
                        </button>
                        <button
                          onClick={() => navigate(`/admin/courses/${course.id}/edit`)}
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: 8,
                            background: "rgba(69,241,197,.08)",
                            border: "1px solid rgba(69,241,197,.2)",
                            cursor: "pointer",
                            color: "#45f1c5",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <Edit3 size={14} />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(course)}
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: 8,
                            background: "rgba(255,180,171,.08)",
                            border: "1px solid rgba(255,180,171,.2)",
                            cursor: "pointer",
                            color: "#ffb4ab",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
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
            <span style={{ fontSize: 12, color: "#C7C4D8" }}>
              {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
            </span>
            <div style={{ display: "flex", gap: 6 }}>
              <button
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  background: "rgba(255,255,255,.04)",
                  border: "1px solid rgba(255,255,255,.08)",
                  cursor: page === 1 ? "not-allowed" : "pointer",
                  color: page === 1 ? "#47464f" : "#C7C4D8",
                }}
              >
                <ChevronLeft size={14} />
              </button>
              <span style={{ padding: "0 12px", fontSize: 13 }}>
                {page} / {totalPages}
              </span>
              <button
                disabled={page === totalPages}
                onClick={() => setPage((p) => p + 1)}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  background: "rgba(255,255,255,.04)",
                  border: "1px solid rgba(255,255,255,.08)",
                  cursor: page === totalPages ? "not-allowed" : "pointer",
                  color: page === totalPages ? "#47464f" : "#C7C4D8",
                }}
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Delete Dialog */}
      {deleteTarget && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,.7)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          onClick={(e) => e.target === e.currentTarget && setDeleteTarget(null)}
        >
          <div style={{ background: "#1a1a2e", borderRadius: 24, padding: 24, maxWidth: 400, border: "1px solid rgba(255,180,171,.3)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
              <AlertTriangle size={24} color="#ffb4ab" />
              <h3 style={{ fontSize: 18, fontWeight: 700, color: "#E4E1EE" }}>Delete course?</h3>
            </div>
            <p style={{ color: "#C7C4D8", marginBottom: 20 }}>
              Are you sure you want to delete <strong>{deleteTarget.title}</strong>?
            </p>
            <div style={{ display: "flex", gap: 12 }}>
              <button
                onClick={() => setDeleteTarget(null)}
                style={{
                  flex: 1,
                  padding: "10px",
                  borderRadius: 12,
                  background: "rgba(255,255,255,.05)",
                  border: "1px solid rgba(255,255,255,.08)",
                  color: "#C7C4D8",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteTarget, true)}
                style={{
                  flex: 1,
                  padding: "10px",
                  borderRadius: 12,
                  background: "rgba(255,183,133,.12)",
                  border: "1px solid rgba(255,183,133,.3)",
                  color: "#FFB785",
                  cursor: "pointer",
                }}
              >
                Archive
              </button>
              <button
                onClick={() => handleDelete(deleteTarget, false)}
                style={{
                  flex: 1,
                  padding: "10px",
                  borderRadius: 12,
                  background: "rgba(255,180,171,.12)",
                  border: "1px solid rgba(255,180,171,.3)",
                  color: "#ffb4ab",
                  cursor: "pointer",
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div
          style={{
            position: "fixed",
            bottom: 24,
            right: 24,
            zIndex: 99999,
            background: "rgba(26,26,46,.97)",
            border: `1px solid ${toast.type === "error" ? "#ffb4ab" : toast.type === "success" ? "#45f1c5" : "#FFB785"}40`,
            borderRadius: 12,
            padding: "12px 20px",
            color: toast.type === "error" ? "#ffb4ab" : toast.type === "success" ? "#45f1c5" : "#FFB785",
            fontSize: 13,
            fontWeight: 600,
            animation: "fadeDown .3s ease",
          }}
        >
          {toast.msg}
        </div>
      )}
    </div>
  );
}
/**
 * Smart Review — Admin / Instructor Course List (Firestore Realtime)
 * File: src/pages/admin/courses/CourseListAdmin.tsx
 * 
 * - Admin: thấy tất cả khóa học.
 * - Instructor: chỉ thấy khóa học có instructorId = uid của họ.
 */

"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  doc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  getDocs,
  type QueryConstraint,
} from "firebase/firestore";
import { db } from "../../../utils/config";
import { useAuth } from "../../../contexts/AuthContext";

// Lucide icons
import {
  Search,
  Plus,
  Edit3,
  Trash2,
  Eye,
  Filter,
  ChevronLeft,
  ChevronRight,
  X,
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
  GraduationCap,
  Tag,
  ArrowUpDown,
  Loader,
  Image,
} from "lucide-react";

// ==================== TYPES ====================
type CourseLevel = "beginner" | "intermediate" | "advanced" | "all_levels";
type CourseStatus = "published" | "draft" | "archived";
type SortField = "createdAt" | "title" | "price" | "updatedAt";
type SortDir = "asc" | "desc";

interface Course {
  id: string;
  title: string;
  description: string;
  level: CourseLevel;
  price: number;
  category: string;
  thumbnailUrl?: string;
  status: CourseStatus;
  modulesCount: number;
  rating?: number;
  totalStudents?: number;
  durationHours?: number;
  createdAt: Date;
  updatedAt: Date;
  instructorId?: string; // 👈 thêm
}

interface CourseFiltersState {
  search: string;
  category: string;
  status: CourseStatus | "all";
  level: CourseLevel | "all";
  sortField: SortField;
  sortDir: SortDir;
}

// ==================== CONSTANTS ====================
const CATEGORIES = [
  "Development",
  "Design",
  "Business",
  "Marketing",
  "Data Science",
  "Language",
  "Soft Skills",
  "Mathematics",
];

const PAGE_SIZE = 8;

// ==================== HELPER ====================
const fmtCurrency = (n: number) => n === 0 ? "Free" : new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(n);
const fmtDate = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
const fmtNum = (n: number) => new Intl.NumberFormat("en-US", { notation: "compact" }).format(n);

const STATUS_CFG: Record<CourseStatus, { label: string; color: string; bg: string; border: string; Icon: React.ElementType }> = {
  published: { label: "Published", color: "#45f1c5", bg: "rgba(69,241,197,.12)", border: "rgba(69,241,197,.25)", Icon: CheckCircle },
  draft: { label: "Draft", color: "#FFB785", bg: "rgba(255,183,133,.12)", border: "rgba(255,183,133,.25)", Icon: PauseCircle },
  archived: { label: "Archived", color: "#B0AEC0", bg: "rgba(176,174,192,.12)", border: "rgba(176,174,192,.20)", Icon: XCircle },
};

const LEVEL_BADGE: Record<CourseLevel, { label: string; color: string; bg: string }> = {
  beginner: { label: "Beginner", color: "#45f1c5", bg: "rgba(69,241,197,.08)" },
  intermediate: { label: "Intermediate", color: "#e3dfff", bg: "rgba(227,223,255,.08)" },
  advanced: { label: "Advanced", color: "#ffb4ab", bg: "rgba(255,180,171,.10)" },
  all_levels: { label: "All Levels", color: "#FFB785", bg: "rgba(255,183,133,.08)" },
};

// ==================== MAIN COMPONENT ====================
export default function CourseListAdmin() {
  const navigate = useNavigate();
  const { currentUser, role } = useAuth(); // 👈 lấy user và role

  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<CourseStatus | "all">("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [levelFilter, setLevelFilter] = useState<CourseLevel | "all">("all");
  const [sortField, setSortField] = useState<SortField>("createdAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [page, setPage] = useState(1);
  const [deleteTarget, setDeleteTarget] = useState<Course | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null);

  // ========== REALTIME FIRESTORE LISTENER ==========
  useEffect(() => {
    if (!currentUser) return; // chưa login thì không query

    console.log("[CourseList] Setting up Firestore listener");

    const constraints: QueryConstraint[] = [
      orderBy(sortField === "title" ? "title" : sortField === "price" ? "price" : sortField === "updatedAt" ? "updatedAt" : "createdAt", sortDir),
    ];

    // 👇 Nếu không phải admin → chỉ lấy khóa học của instructor
    if (role !== "admin") {
      constraints.push(where("instructorId", "==", currentUser.uid));
    }

    if (statusFilter !== "all") {
      constraints.push(where("status", "==", statusFilter));
    }
    if (categoryFilter !== "all") {
      constraints.push(where("category", "==", categoryFilter));
    }
    if (levelFilter !== "all") {
      constraints.push(where("level", "==", levelFilter));
    }

    const q = query(collection(db, "courses"), ...constraints);

    const unsub = onSnapshot(
      q,
      (snapshot) => {
        let courseList: Course[] = snapshot.docs.map((docSnap) => {
          const data = docSnap.data();
          return {
            id: docSnap.id,
            title: data.title || "Untitled",
            description: data.description || "",
            level: data.level || "beginner",
            price: data.price || 0,
            category: data.category || "Development",
            thumbnailUrl: data.thumbnailUrl || "",
            status: data.status || "draft",
            modulesCount: data.modules?.length || 0,
            rating: data.rating || 0,
            totalStudents: data.totalStudents || 0,
            durationHours: data.totalDurationHours || 0,
            createdAt: data.createdAt?.toDate?.() ?? new Date(),
            updatedAt: data.updatedAt?.toDate?.() ?? new Date(),
            instructorId: data.instructorId || undefined,
          };
        });

        // Client-side search
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
        console.error("Firestore error:", err);
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [currentUser, role, sortField, sortDir, statusFilter, categoryFilter, levelFilter]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, categoryFilter, levelFilter, sortField, sortDir]);

  // Filter + Pagination
  const filtered = useMemo(() => {
    return courses;
  }, [courses]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Stats
  const stats = useMemo(() => {
    const published = courses.filter((c) => c.status === "published").length;
    const drafts = courses.filter((c) => c.status === "draft").length;
    const totalRevenue = courses
      .filter((c) => c.status === "published")
      .reduce((sum, c) => sum + c.price * (c.totalStudents || 0), 0);
    return { total: courses.length, published, drafts, totalRevenue };
  }, [courses]);

  // Actions
  const handleDelete = async (course: Course, soft = true) => {
    try {
      const courseRef = doc(db, "courses", course.id);
      if (soft) {
        await updateDoc(courseRef, {
          status: "archived",
          updatedAt: serverTimestamp(),
        });
        showToast(`"${course.title}" archived`, "info");
      } else {
        await deleteDoc(courseRef);
        showToast(`"${course.title}" deleted permanently`, "error");
      }
    } catch (err: any) {
      showToast(`Error: ${err.message}`, "error");
    }
    setDeleteTarget(null);
  };

  const handleStatusChange = async (course: Course, newStatus: CourseStatus) => {
    try {
      const courseRef = doc(db, "courses", course.id);
      await updateDoc(courseRef, {
        status: newStatus,
        updatedAt: serverTimestamp(),
      });
      showToast(`"${course.title}" → ${newStatus}`, "success");
    } catch (err: any) {
      showToast(`Error: ${err.message}`, "error");
    }
  };

  const showToast = (msg: string, type: string) => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(sortDir === "desc" ? "asc" : "desc");
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  };

  if (loading && courses.length === 0) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: 60, background: "#0F0F1A", minHeight: "100vh" }}>
        <Loader size={32} color="#6C63FF" style={{ animation: "spin 1s linear infinite" }} />
      </div>
    );
  }

  return (
    <div style={{ padding: 24, background: "#0F0F1A", minHeight: "100vh" }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes slideInRight { from { opacity: 0; transform: translateX(20px); } to { opacity: 1; transform: translateX(0); } }
      `}</style>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "#E4E1EE" }}>
            {role === "admin" ? "Course Management" : "My Courses"}
          </h1>
          <p style={{ color: "#C7C4D8" }}>
            Firestore: <code style={{ background: "rgba(108,99,255,.12)", padding: "2px 6px", borderRadius: 6 }}>courses</code> 
            {role !== "admin" && ` · filtered by instructorId: ${currentUser?.uid.slice(0, 8)}…`}
            {" • Realtime onSnapshot"}
          </p>
        </div>
        <button
          onClick={() => navigate("/admin/courses/new")}
          style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 20px", borderRadius: 12, background: "linear-gradient(135deg,#6C63FF,#9B59B6)", border: "none", color: "#fff", fontWeight: 700, cursor: "pointer" }}
        >
          <Plus size={16} /> Add Course
        </button>
      </div>

      {/* Stats Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16, marginBottom: 24 }}>
        {[
          { label: "Total Courses", value: stats.total, icon: BookOpen, color: "#e3dfff" },
          { label: "Published", value: stats.published, icon: CheckCircle, color: "#45f1c5" },
          { label: "Drafts", value: stats.drafts, icon: PauseCircle, color: "#FFB785" },
          { label: "Est. Revenue", value: `$${(stats.totalRevenue / 1000).toFixed(0)}k`, icon: DollarSign, color: "#6C63FF" },
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
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title or description..."
            style={{ width: "100%", background: "#0d0d18", border: "1px solid rgba(255,255,255,.08)", borderRadius: 12, padding: "9px 12px 9px 34px", color: "#E4E1EE" }}
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as any)}
          style={{ background: "#0d0d18", border: "1px solid rgba(255,255,255,.08)", borderRadius: 12, padding: "8px 12px", color: "#E4E1EE" }}
        >
          <option value="all">All status</option>
          <option value="published">Published</option>
          <option value="draft">Draft</option>
          <option value="archived">Archived</option>
        </select>

        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          style={{ background: "#0d0d18", border: "1px solid rgba(255,255,255,.08)", borderRadius: 12, padding: "8px 12px", color: "#E4E1EE" }}
        >
          <option value="all">All categories</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        <select
          value={levelFilter}
          onChange={(e) => setLevelFilter(e.target.value as any)}
          style={{ background: "#0d0d18", border: "1px solid rgba(255,255,255,.08)", borderRadius: 12, padding: "8px 12px", color: "#E4E1EE" }}
        >
          <option value="all">All levels</option>
          <option value="beginner">Beginner</option>
          <option value="intermediate">Intermediate</option>
          <option value="advanced">Advanced</option>
          <option value="all_levels">All Levels</option>
        </select>

        <div style={{ display: "flex", gap: 4, background: "rgba(255,255,255,.04)", borderRadius: 10, padding: 4 }}>
          {(["createdAt", "title", "price"] as SortField[]).map((field) => (
            <button
              key={field}
              onClick={() => toggleSort(field)}
              style={{
                display: "flex", alignItems: "center", gap: 4, padding: "6px 12px", borderRadius: 8,
                background: sortField === field ? "rgba(108,99,255,.2)" : "transparent",
                border: sortField === field ? "1px solid rgba(108,99,255,.3)" : "1px solid transparent",
                color: sortField === field ? "#e3dfff" : "#C7C4D8", fontSize: 12, cursor: "pointer",
              }}
            >
              {field === "createdAt" ? "Created" : field === "title" ? "Title" : "Price"}
              <ArrowUpDown size={11} />
            </button>
          ))}
        </div>

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
                <th style={{ padding: "12px 16px", textAlign: "left" }}>Category</th>
                <th style={{ padding: "12px 16px", textAlign: "left" }}>Price</th>
                <th style={{ padding: "12px 16px", textAlign: "left" }}>Level</th>
                <th style={{ padding: "12px 16px", textAlign: "left" }}>Status</th>
                <th style={{ padding: "12px 16px", textAlign: "left" }}>Updated</th>
                <th style={{ padding: "12px 16px", textAlign: "center" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginated.map((course) => {
                const statusCfg = STATUS_CFG[course.status];
                const StatusIcon = statusCfg.Icon;
                const levelCfg = LEVEL_BADGE[course.level];
                return (
                  <tr key={course.id} style={{ borderBottom: "1px solid rgba(255,255,255,.04)" }}>
                    <td style={{ padding: "12px 8px 12px 16px" }}>
                      <div style={{ width: 40, height: 40, borderRadius: 8, background: "rgba(108,99,255,.12)", border: "1px solid rgba(108,99,255,.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
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
                        {course.rating && course.rating > 0 && (
                          <span style={{ display: "flex", alignItems: "center", gap: 3 }}>
                            <Star size={11} color="#FFB785" fill="#FFB785" /> {course.rating.toFixed(1)}
                          </span>
                        )}
                        <span style={{ display: "flex", alignItems: "center", gap: 3 }}><Layers size={11} /> {course.modulesCount} modules</span>
                        {course.durationHours && course.durationHours > 0 && (
                          <span style={{ display: "flex", alignItems: "center", gap: 3 }}><Clock size={11} /> {course.durationHours}h</span>
                        )}
                      </div>
                    </td>
                    <td style={{ padding: "12px 16px", fontSize: 12, color: "#C7C4D8" }}>{course.category}</td>
                    <td style={{ padding: "12px 16px", fontWeight: 700, color: course.price === 0 ? "#45f1c5" : "#e3dfff" }}>
                      {fmtCurrency(course.price)}
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <span style={{ padding: "2px 8px", borderRadius: 6, fontSize: 10, fontWeight: 700, color: levelCfg.color, background: levelCfg.bg }}>
                        {levelCfg.label}
                      </span>
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 10px", borderRadius: 999, background: statusCfg.bg, border: `1px solid ${statusCfg.border}`, fontSize: 11, fontWeight: 700, color: statusCfg.color }}>
                        <StatusIcon size={11} /> {statusCfg.label}
                      </span>
                    </td>
                    <td style={{ padding: "12px 16px", fontSize: 12, color: "#C7C4D8" }}>{fmtDate(course.updatedAt)}</td>
                    <td style={{ padding: "12px 16px", textAlign: "center" }}>
                      <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
                        <button
                          onClick={() => navigate(`/admin/courses/${course.id}`)}
                          style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(108,99,255,.08)", border: "1px solid rgba(108,99,255,.2)", cursor: "pointer", color: "#6C63FF" }}
                        >
                          <Eye size={14} />
                        </button>
                        <button
                          onClick={() => navigate(`/admin/courses/${course.id}/edit`)}
                          style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(69,241,197,.08)", border: "1px solid rgba(69,241,197,.2)", cursor: "pointer", color: "#45f1c5" }}
                        >
                          <Edit3 size={14} />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(course)}
                          style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(255,180,171,.08)", border: "1px solid rgba(255,180,171,.2)", cursor: "pointer", color: "#ffb4ab" }}
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
              <button disabled={page === 1} onClick={() => setPage((p) => p - 1)} style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.08)", cursor: page === 1 ? "not-allowed" : "pointer", color: page === 1 ? "#47464f" : "#C7C4D8" }}>
                <ChevronLeft size={14} />
              </button>
              <span style={{ padding: "0 12px", fontSize: 13 }}>
                {page} / {totalPages}
              </span>
              <button disabled={page === totalPages} onClick={() => setPage((p) => p + 1)} style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.08)", cursor: page === totalPages ? "not-allowed" : "pointer", color: page === totalPages ? "#47464f" : "#C7C4D8" }}>
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Delete Dialog */}
      {deleteTarget && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.7)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center" }}
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
              <button onClick={() => setDeleteTarget(null)} style={{ flex: 1, padding: "10px", borderRadius: 12, background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.08)", color: "#C7C4D8", cursor: "pointer" }}>
                Cancel
              </button>
              <button onClick={() => handleDelete(deleteTarget, true)} style={{ flex: 1, padding: "10px", borderRadius: 12, background: "rgba(255,183,133,.12)", border: "1px solid rgba(255,183,133,.3)", color: "#FFB785", cursor: "pointer" }}>
                Archive (soft)
              </button>
              <button onClick={() => handleDelete(deleteTarget, false)} style={{ flex: 1, padding: "10px", borderRadius: 12, background: "rgba(255,180,171,.12)", border: "1px solid rgba(255,180,171,.3)", color: "#ffb4ab", cursor: "pointer" }}>
                Delete permanently
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div style={{ position: "fixed", bottom: 24, right: 24, zIndex: 99999, background: "rgba(26,26,46,.97)", border: `1px solid ${toast.type === "error" ? "#ffb4ab" : toast.type === "success" ? "#45f1c5" : "#FFB785"}40`, borderRadius: 12, padding: "12px 20px", color: toast.type === "error" ? "#ffb4ab" : toast.type === "success" ? "#45f1c5" : "#FFB785", fontSize: 13, fontWeight: 600, animation: "slideInRight .3s ease" }}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
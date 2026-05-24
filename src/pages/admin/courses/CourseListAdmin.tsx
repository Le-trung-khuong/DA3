/**
 * Smart Review — Admin Course List
 * React + TypeScript + TailwindCSS + Firebase SDK v9+
 *
 * Files produced:
 *   src/pages/admin/CourseListAdmin.tsx   ← this file (all-in-one for review)
 *
 * In production split into:
 *   hooks/useCourses.ts
 *   components/admin/courses/CourseTable.tsx
 *   components/admin/courses/CourseFilters.tsx
 *   components/admin/courses/Pagination.tsx
 *   components/admin/courses/CourseFormModal.tsx
 *   components/admin/courses/DeleteConfirmDialog.tsx
 *
 * Dependencies: firebase, lucide-react
 * npm install firebase lucide-react
 */

"use client";

import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
  type ReactNode,
} from "react";

// ─── Firebase (uncomment in production) ─────────────────────────────────────
// import { db } from "@/lib/firebase";
// import {
//   collection,
//   query,
//   where,
//   orderBy,
//   limit,
//   startAfter,
//   onSnapshot,
//   doc,
//   updateDoc,
//   deleteDoc,
//   addDoc,
//   serverTimestamp,
//   QueryDocumentSnapshot,
//   DocumentData,
//   QueryConstraint,
// } from "firebase/firestore";

// ─── Lucide icons ────────────────────────────────────────────────────────────
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
  BarChart2,
  DollarSign,
  Layers,
  CheckCircle,
  XCircle,
  PauseCircle,
  RefreshCw,
  GraduationCap,
  Tag,
  ArrowUpDown,
  MoreVertical,
  Save,
  Image,
} from "lucide-react";

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

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
  thumbnail?: string;
  status: CourseStatus;
  modules: number;
  rating?: number;
  totalStudents?: number;
  durationHours?: number;
  createdAt: Date;
  updatedAt: Date;
}

interface CourseFiltersState {
  search: string;
  category: string;
  status: CourseStatus | "all";
  level: CourseLevel | "all";
  sortField: SortField;
  sortDir: SortDir;
}

interface PaginationState {
  page: number;
  pageSize: number;
  total: number;
  // lastDoc: QueryDocumentSnapshot<DocumentData> | null; // for startAfter
}

interface UseCourseReturn {
  courses: Course[];
  loading: boolean;
  error: Error | null;
  pagination: PaginationState;
  goToPage: (p: number) => void;
  refetch: () => void;
}

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

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

// ═══════════════════════════════════════════════════════════════════════════
// MOCK DATA
// ═══════════════════════════════════════════════════════════════════════════

const buildMockCourses = (): Course[] => {
  const now = new Date();
  const data: Omit<Course, "id" | "createdAt" | "updatedAt">[] = [
    { title: "Advanced React Patterns & Performance", description: "Master concurrent rendering, custom hooks, and scalable architecture.", level: "advanced", price: 89, category: "Development", modules: 8, status: "published", rating: 4.9, totalStudents: 1245, durationHours: 12.5 },
    { title: "UI/UX Design Systems from Scratch", description: "Build maintainable design systems using Figma and modern principles.", level: "intermediate", price: 65, category: "Design", modules: 6, status: "published", rating: 4.7, totalStudents: 890, durationHours: 8.25 },
    { title: "Data-Driven Decision Making", description: "Translate complex datasets into actionable business strategies.", level: "all_levels", price: 120, category: "Business", modules: 10, status: "published", rating: 4.8, totalStudents: 2100, durationHours: 15 },
    { title: "Growth Hacking Essentials", description: "Rapid experimentation across marketing channels.", level: "beginner", price: 45, category: "Marketing", modules: 5, status: "draft", rating: 4.5, totalStudents: 0, durationHours: 5.75 },
    { title: "Python Machine Learning Bootcamp", description: "End-to-end ML pipelines from data prep to model deployment.", level: "intermediate", price: 149, category: "Data Science", modules: 12, status: "published", rating: 4.9, totalStudents: 3400, durationHours: 22 },
    { title: "Professional English Communication", description: "Business English for global professionals.", level: "beginner", price: 55, category: "Language", modules: 14, status: "published", rating: 4.6, totalStudents: 560, durationHours: 10 },
    { title: "Critical Thinking & Problem Solving", description: "Sharpen analytical thinking for the modern workplace.", level: "all_levels", price: 39, category: "Soft Skills", modules: 7, status: "archived", rating: 4.4, totalStudents: 320, durationHours: 6 },
    { title: "Linear Algebra Fundamentals", description: "Vectors, matrices, and transformations for engineers.", level: "intermediate", price: 75, category: "Mathematics", modules: 9, status: "published", rating: 4.8, totalStudents: 780, durationHours: 14 },
    { title: "Figma Prototyping Masterclass", description: "Create interactive, high-fidelity mockups from zero.", level: "beginner", price: 59, category: "Design", modules: 8, status: "draft", rating: 4.7, totalStudents: 0, durationHours: 9 },
    { title: "Node.js Microservices Architecture", description: "Design scalable backend systems with Docker and Kubernetes.", level: "advanced", price: 199, category: "Development", modules: 15, status: "published", rating: 4.9, totalStudents: 670, durationHours: 20 },
    { title: "SEO & Content Marketing Strategy", description: "Drive organic traffic and build content that converts.", level: "all_levels", price: 49, category: "Marketing", modules: 6, status: "published", rating: 4.5, totalStudents: 1100, durationHours: 7 },
    { title: "Deep Learning with TensorFlow", description: "Neural networks, CNNs, RNNs, and transformers in Python.", level: "advanced", price: 179, category: "Data Science", modules: 14, status: "draft", rating: 4.8, totalStudents: 0, durationHours: 28 },
    { title: "Business Negotiation Skills", description: "Win-win negotiation frameworks for executives.", level: "intermediate", price: 85, category: "Business", modules: 7, status: "published", rating: 4.6, totalStudents: 440, durationHours: 8 },
    { title: "Intro to Korean Language", description: "Hangul, basic grammar, and survival phrases.", level: "beginner", price: 35, category: "Language", modules: 10, status: "published", rating: 4.7, totalStudents: 2300, durationHours: 12 },
    { title: "TypeScript for React Developers", description: "Type-safe React apps with advanced TypeScript patterns.", level: "intermediate", price: 79, category: "Development", modules: 11, status: "published", rating: 4.9, totalStudents: 1560, durationHours: 13 },
    { title: "Calculus for Machine Learning", description: "Derivatives, integrals, and optimisation in ML context.", level: "intermediate", price: 69, category: "Mathematics", modules: 8, status: "archived", rating: 4.5, totalStudents: 210, durationHours: 11 },
  ];

  return data.map((d, i) => ({
    ...d,
    id: `course_${String(i + 1).padStart(3, "0")}`,
    createdAt: new Date(now.getTime() - (i + 1) * 1000 * 60 * 60 * 24 * 3),
    updatedAt: new Date(now.getTime() - i * 1000 * 60 * 60 * 12),
  }));
};

const ALL_COURSES = buildMockCourses();

// ═══════════════════════════════════════════════════════════════════════════
// DEBOUNCE HOOK
// ═══════════════════════════════════════════════════════════════════════════

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

// ═══════════════════════════════════════════════════════════════════════════
// CUSTOM HOOK: useCourses
// ═══════════════════════════════════════════════════════════════════════════

function useCourses(
  filters: CourseFiltersState,
  pageState: { page: number; pageSize: number }
): UseCourseReturn {
  const [courses, setCourses] = useState<Course[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [page, setPage] = useState(pageState.page);

  const debouncedSearch = useDebounce(filters.search, 350);

  const fetch = useCallback(() => {
    setLoading(true);
    setError(null);

    // ── REAL FIREBASE IMPLEMENTATION ────────────────────────────────────
    // const constraints: QueryConstraint[] = [orderBy(filters.sortField, filters.sortDir)];
    //
    // if (filters.status !== "all") {
    //   constraints.push(where("status", "==", filters.status));
    // }
    // if (filters.category !== "all") {
    //   constraints.push(where("category", "==", filters.category));
    // }
    // if (filters.level !== "all") {
    //   constraints.push(where("level", "==", filters.level));
    // }
    //
    // // Firestore doesn't support full-text search natively.
    // // Use Algolia / Typesense for search, or filter client-side for small datasets.
    // // Client-side filter for title search (works up to ~500 docs):
    // const baseQ = query(collection(db, "courses"), ...constraints);
    //
    // const unsub = onSnapshot(baseQ, (snap) => {
    //   let docs = snap.docs.map((d) => ({
    //     id: d.id,
    //     ...(d.data() as Omit<Course, "id">),
    //     createdAt: d.data().createdAt?.toDate() ?? new Date(),
    //     updatedAt: d.data().updatedAt?.toDate() ?? new Date(),
    //   }));
    //
    //   // Client-side title filter
    //   if (debouncedSearch) {
    //     docs = docs.filter((c) =>
    //       c.title.toLowerCase().includes(debouncedSearch.toLowerCase())
    //     );
    //   }
    //
    //   setTotal(docs.length);
    //   const start = (page - 1) * pageState.pageSize;
    //   setCourses(docs.slice(start, start + pageState.pageSize));
    //   setLoading(false);
    // }, (err) => { setError(err); setLoading(false); });
    //
    // return () => unsub();
    // ── /REAL FIREBASE ───────────────────────────────────────────────────

    setTimeout(() => {
      let filtered = [...ALL_COURSES];

      if (debouncedSearch) {
        filtered = filtered.filter((c) =>
          c.title.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
          c.description.toLowerCase().includes(debouncedSearch.toLowerCase())
        );
      }
      if (filters.status !== "all") {
        filtered = filtered.filter((c) => c.status === filters.status);
      }
      if (filters.category !== "all") {
        filtered = filtered.filter((c) => c.category === filters.category);
      }
      if (filters.level !== "all") {
        filtered = filtered.filter((c) => c.level === filters.level);
      }

      filtered.sort((a, b) => {
        const mul = filters.sortDir === "asc" ? 1 : -1;
        if (filters.sortField === "title") {
          return mul * a.title.localeCompare(b.title);
        }
        if (filters.sortField === "price") {
          return mul * (a.price - b.price);
        }
        const aDate = filters.sortField === "createdAt" ? a.createdAt : a.updatedAt;
        const bDate = filters.sortField === "createdAt" ? b.createdAt : b.updatedAt;
        return mul * (aDate.getTime() - bDate.getTime());
      });

      setTotal(filtered.length);
      const start = (page - 1) * pageState.pageSize;
      setCourses(filtered.slice(start, start + pageState.pageSize));
      setLoading(false);
    }, 600);
  }, [debouncedSearch, filters, page, pageState.pageSize]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, filters.status, filters.category, filters.level]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return {
    courses,
    loading,
    error,
    pagination: { page, pageSize: pageState.pageSize, total },
    goToPage: setPage,
    refetch: fetch,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

function fmtCurrency(n: number) {
  return n === 0 ? "Free" : `$${n}`;
}
function fmtDate(d: Date) {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
function fmtLevel(l: CourseLevel): string {
  const map: Record<CourseLevel, string> = {
    beginner: "Beginner",
    intermediate: "Intermediate",
    advanced: "Advanced",
    all_levels: "All Levels",
  };
  return map[l];
}

// ═══════════════════════════════════════════════════════════════════════════
// STATUS BADGE
// ═══════════════════════════════════════════════════════════════════════════

interface StatusBadgeProps { status: CourseStatus; }
function StatusBadge({ status }: StatusBadgeProps) {
  const cfg = {
    published: { label: "Published", color: "#45f1c5", bg: "rgba(69,241,197,0.12)", border: "rgba(69,241,197,0.25)", Icon: CheckCircle },
    draft:     { label: "Draft",     color: "#FFB785", bg: "rgba(255,183,133,0.12)", border: "rgba(255,183,133,0.25)", Icon: PauseCircle },
    archived:  { label: "Archived",  color: "#B0AEC0", bg: "rgba(176,174,192,0.12)", border: "rgba(176,174,192,0.20)", Icon: XCircle },
  }[status];

  return (
    <span
      style={{
        display: "inline-flex", alignItems: "center", gap: 5,
        padding: "3px 10px", borderRadius: 999, fontSize: 11, fontWeight: 700,
        color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}`,
      }}
    >
      <cfg.Icon size={11} />
      {cfg.label}
    </span>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// LEVEL BADGE
// ═══════════════════════════════════════════════════════════════════════════

interface LevelBadgeProps { level: CourseLevel; }
function LevelBadge({ level }: LevelBadgeProps) {
  const cfg = {
    beginner:     { label: "Beginner",     color: "#45f1c5", bg: "rgba(69,241,197,0.08)"  },
    intermediate: { label: "Intermediate", color: "#e3dfff", bg: "rgba(227,223,255,0.08)" },
    advanced:     { label: "Advanced",     color: "#ffb4ab", bg: "rgba(255,180,171,0.10)" },
    all_levels:   { label: "All Levels",   color: "#FFB785", bg: "rgba(255,183,133,0.08)" },
  }[level];

  return (
    <span style={{ display: "inline-flex", alignItems: "center", padding: "2px 8px", borderRadius: 6, fontSize: 10, fontWeight: 700, color: cfg.color, background: cfg.bg }}>
      {cfg.label}
    </span>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// COURSE FILTERS
// ═══════════════════════════════════════════════════════════════════════════

interface CourseFiltersProps {
  filters: CourseFiltersState;
  onChange: (f: Partial<CourseFiltersState>) => void;
  total: number;
  loading: boolean;
}

function CourseFilters({ filters, onChange, total, loading }: CourseFiltersProps) {
  const [expanded, setExpanded] = useState(false);

  const activeFilterCount = [
    filters.status !== "all",
    filters.category !== "all",
    filters.level !== "all",
  ].filter(Boolean).length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Top row */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        {/* Search */}
        <div style={{ position: "relative", flex: "1 1 260px", maxWidth: 400 }}>
          <Search
            size={15}
            style={{
              position: "absolute", left: 13, top: "50%",
              transform: "translateY(-50%)", color: "#C7C4D8", pointerEvents: "none",
            }}
          />
          <input
            value={filters.search}
            onChange={(e) => onChange({ search: e.target.value })}
            placeholder="Search courses by title or keyword…"
            style={{
              width: "100%", background: "#0e0e11", border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 12, padding: "9px 12px 9px 38px", color: "#E4E1EE",
              fontSize: 13, outline: "none", fontFamily: "Inter, sans-serif",
              transition: "border-color .2s",
            }}
            onFocus={(e) => (e.target.style.borderColor = "rgba(108,99,255,0.5)")}
            onBlur={(e) => (e.target.style.borderColor = "rgba(255,255,255,0.08)")}
          />
          {filters.search && (
            <button
              onClick={() => onChange({ search: "" })}
              style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#C7C4D8" }}
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Sort */}
        <select
          value={`${filters.sortField}:${filters.sortDir}`}
          onChange={(e) => {
            const [sortField, sortDir] = e.target.value.split(":") as [SortField, SortDir];
            onChange({ sortField, sortDir });
          }}
          style={{ background: "#1f1f28", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: "9px 12px", color: "#E4E1EE", fontSize: 13, outline: "none", fontFamily: "Inter, sans-serif", cursor: "pointer" }}
        >
          <option value="createdAt:desc">Newest first</option>
          <option value="createdAt:asc">Oldest first</option>
          <option value="title:asc">Title A–Z</option>
          <option value="title:desc">Title Z–A</option>
          <option value="price:desc">Price high–low</option>
          <option value="price:asc">Price low–high</option>
          <option value="updatedAt:desc">Recently updated</option>
        </select>

        {/* Filter toggle */}
        <button
          onClick={() => setExpanded((p) => !p)}
          style={{
            display: "flex", alignItems: "center", gap: 7,
            padding: "9px 16px", borderRadius: 12, fontSize: 13, fontWeight: 600,
            fontFamily: "Inter, sans-serif", cursor: "pointer",
            background: expanded ? "rgba(108,99,255,0.15)" : "rgba(255,255,255,0.04)",
            border: expanded ? "1px solid rgba(108,99,255,0.35)" : "1px solid rgba(255,255,255,0.08)",
            color: expanded ? "#e3dfff" : "#C7C4D8",
            transition: "all .2s",
          }}
        >
          <Filter size={14} />
          Filters
          {activeFilterCount > 0 && (
            <span style={{ background: "linear-gradient(135deg,#6C63FF,#9B59B6)", color: "#fff", fontSize: 10, fontWeight: 700, width: 18, height: 18, borderRadius: "50%", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
              {activeFilterCount}
            </span>
          )}
        </button>

        {/* Result count */}
        <span style={{ marginLeft: "auto", fontSize: 12, color: "#C7C4D8", fontWeight: 600 }}>
          {loading ? "Loading…" : `${total} course${total !== 1 ? "s" : ""}`}
        </span>
      </div>

      {/* Expanded filters */}
      {expanded && (
        <div
          style={{
            display: "flex", gap: 12, flexWrap: "wrap", padding: "16px",
            background: "rgba(26,26,46,0.5)", border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: 16, animation: "fadeIn .2s ease",
          }}
        >
          {/* Status */}
          <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: "1 1 160px" }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: "#C7C4D8", letterSpacing: ".06em", textTransform: "uppercase" }}>Status</label>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {(["all", "published", "draft", "archived"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => onChange({ status: s })}
                  style={{
                    padding: "5px 12px", borderRadius: 999, fontSize: 11, fontWeight: 700,
                    fontFamily: "Inter, sans-serif", cursor: "pointer", transition: "all .15s",
                    background: filters.status === s ? "linear-gradient(135deg,#6C63FF,#9B59B6)" : "rgba(255,255,255,0.05)",
                    border: filters.status === s ? "1px solid rgba(108,99,255,0.4)" : "1px solid rgba(255,255,255,0.08)",
                    color: filters.status === s ? "#fff" : "#C7C4D8",
                  }}
                >
                  {s === "all" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Category */}
          <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: "1 1 200px" }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: "#C7C4D8", letterSpacing: ".06em", textTransform: "uppercase" }}>Category</label>
            <select
              value={filters.category}
              onChange={(e) => onChange({ category: e.target.value })}
              style={{ background: "#0e0e11", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: "7px 12px", color: "#E4E1EE", fontSize: 13, outline: "none", fontFamily: "Inter, sans-serif" }}
            >
              <option value="all">All Categories</option>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          {/* Level */}
          <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: "1 1 200px" }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: "#C7C4D8", letterSpacing: ".06em", textTransform: "uppercase" }}>Level</label>
            <select
              value={filters.level}
              onChange={(e) => onChange({ level: e.target.value as CourseLevel | "all" })}
              style={{ background: "#0e0e11", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: "7px 12px", color: "#E4E1EE", fontSize: 13, outline: "none", fontFamily: "Inter, sans-serif" }}
            >
              <option value="all">All Levels</option>
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
              <option value="all_levels">All Levels (course tag)</option>
            </select>
          </div>

          {activeFilterCount > 0 && (
            <div style={{ alignSelf: "flex-end" }}>
              <button
                onClick={() => onChange({ status: "all", category: "all", level: "all" })}
                style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 10, fontSize: 12, fontWeight: 600, fontFamily: "Inter, sans-serif", cursor: "pointer", background: "rgba(255,180,171,0.10)", border: "1px solid rgba(255,180,171,0.25)", color: "#ffb4ab" }}
              >
                <X size={13} /> Clear filters
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// PAGINATION
// ═══════════════════════════════════════════════════════════════════════════

interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onPage: (p: number) => void;
}

function Pagination({ page, pageSize, total, onPage }: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  const pages = useMemo(() => {
    const p: (number | "…")[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) p.push(i);
    } else {
      p.push(1);
      if (page > 3) p.push("…");
      for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) p.push(i);
      if (page < totalPages - 2) p.push("…");
      p.push(totalPages);
    }
    return p;
  }, [page, totalPages]);

  if (total === 0) return null;

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
      <span style={{ fontSize: 12, color: "#C7C4D8", fontWeight: 600 }}>
        Showing <strong style={{ color: "#E4E1EE" }}>{start}–{end}</strong> of <strong style={{ color: "#E4E1EE" }}>{total}</strong> courses
      </span>

      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <button
          onClick={() => onPage(page - 1)}
          disabled={page === 1}
          style={{ width: 34, height: 34, borderRadius: 10, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.04)", color: page === 1 ? "#47464f" : "#C7C4D8", cursor: page === 1 ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
        >
          <ChevronLeft size={16} />
        </button>

        {pages.map((p, i) =>
          p === "…" ? (
            <span key={`el-${i}`} style={{ width: 34, textAlign: "center", color: "#47464f", fontSize: 13 }}>…</span>
          ) : (
            <button
              key={p}
              onClick={() => onPage(p)}
              style={{
                width: 34, height: 34, borderRadius: 10, fontSize: 13, fontWeight: 700,
                fontFamily: "Inter, sans-serif", cursor: "pointer", transition: "all .15s",
                background: p === page ? "linear-gradient(135deg,#6C63FF,#9B59B6)" : "rgba(255,255,255,0.04)",
                border: p === page ? "1px solid rgba(108,99,255,0.4)" : "1px solid rgba(255,255,255,0.08)",
                color: p === page ? "#fff" : "#C7C4D8",
                boxShadow: p === page ? "0 0 12px rgba(108,99,255,0.3)" : "none",
              }}
            >
              {p}
            </button>
          )
        )}

        <button
          onClick={() => onPage(page + 1)}
          disabled={page === totalPages}
          style={{ width: 34, height: 34, borderRadius: 10, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.04)", color: page === totalPages ? "#47464f" : "#C7C4D8", cursor: page === totalPages ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// DELETE CONFIRM DIALOG
// ═══════════════════════════════════════════════════════════════════════════

interface DeleteDialogProps {
  course: Course;
  onConfirm: (soft: boolean) => void;
  onCancel: () => void;
}

function DeleteConfirmDialog({ course, onConfirm, onCancel }: DeleteDialogProps) {
  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", backdropFilter: "blur(6px)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
      onClick={(e) => e.target === e.currentTarget && onCancel()}
    >
      <div
        style={{ width: "100%", maxWidth: 440, background: "rgba(26,26,46,0.95)", border: "1px solid rgba(255,180,171,0.2)", borderRadius: 24, padding: 32, boxShadow: "0 20px 60px rgba(0,0,0,0.5)", animation: "scaleIn .2s ease" }}
      >
        {/* Icon */}
        <div style={{ width: 56, height: 56, borderRadius: "50%", background: "rgba(255,180,171,0.12)", border: "1px solid rgba(255,180,171,0.3)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
          <AlertTriangle size={26} color="#ffb4ab" />
        </div>

        <h2 style={{ fontSize: 20, fontWeight: 700, color: "#E4E1EE", textAlign: "center", marginBottom: 10 }}>
          Delete course?
        </h2>
        <p style={{ fontSize: 14, color: "#C7C4D8", textAlign: "center", lineHeight: 1.6, marginBottom: 24 }}>
          You're about to remove <strong style={{ color: "#E4E1EE" }}>"{course.title}"</strong>.
          {course.totalStudents && course.totalStudents > 0
            ? ` This course has ${course.totalStudents.toLocaleString()} enrolled students.`
            : ""}
        </p>

        {/* Options */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
          <button
            onClick={() => onConfirm(true)}
            style={{ width: "100%", padding: "12px 20px", borderRadius: 14, fontSize: 14, fontWeight: 600, fontFamily: "Inter, sans-serif", cursor: "pointer", background: "rgba(255,183,133,0.12)", border: "1px solid rgba(255,183,133,0.3)", color: "#FFB785", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, transition: "all .2s" }}
            onMouseOver={(e) => (e.currentTarget.style.background = "rgba(255,183,133,0.2)")}
            onMouseOut={(e) => (e.currentTarget.style.background = "rgba(255,183,133,0.12)")}
          >
            <PauseCircle size={16} />
            Archive (soft delete) — Recommended
          </button>
          <button
            onClick={() => onConfirm(false)}
            style={{ width: "100%", padding: "12px 20px", borderRadius: 14, fontSize: 14, fontWeight: 600, fontFamily: "Inter, sans-serif", cursor: "pointer", background: "rgba(255,180,171,0.12)", border: "1px solid rgba(255,180,171,0.35)", color: "#ffb4ab", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, transition: "all .2s" }}
            onMouseOver={(e) => (e.currentTarget.style.background = "rgba(255,180,171,0.22)")}
            onMouseOut={(e) => (e.currentTarget.style.background = "rgba(255,180,171,0.12)")}
          >
            <Trash2 size={16} />
            Permanently delete from Firestore
          </button>
        </div>

        <button
          onClick={onCancel}
          style={{ width: "100%", padding: "12px 20px", borderRadius: 14, fontSize: 14, fontWeight: 600, fontFamily: "Inter, sans-serif", cursor: "pointer", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "#C7C4D8" }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// COURSE FORM MODAL (Add / Edit)
// ═══════════════════════════════════════════════════════════════════════════

interface CourseFormModalProps {
  course?: Course | null;
  onSave: (data: Partial<Course>) => void;
  onClose: () => void;
}

function CourseFormModal({ course, onSave, onClose }: CourseFormModalProps) {
  const isEdit = !!course;
  const [form, setForm] = useState<Partial<Course>>(
    course ?? { title: "", description: "", level: "beginner", price: 0, category: CATEGORIES[0], status: "draft", modules: 1 }
  );
  const [saving, setSaving] = useState(false);

  const set = (key: keyof Course, val: unknown) => setForm((f) => ({ ...f, [key]: val }));

  const handleSave = async () => {
    setSaving(true);
    // ── FIREBASE ─────────────────────────────────────────────────────
    // if (isEdit && course) {
    //   await updateDoc(doc(db, "courses", course.id), { ...form, updatedAt: serverTimestamp() });
    // } else {
    //   await addDoc(collection(db, "courses"), { ...form, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
    // }
    // ── /FIREBASE ─────────────────────────────────────────────────────
    await new Promise((r) => setTimeout(r, 700)); // mock
    onSave(form);
    setSaving(false);
  };

  const inputStyle = {
    width: "100%", background: "#0e0e11", border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 10, padding: "9px 12px", color: "#E4E1EE", fontSize: 13,
    outline: "none", fontFamily: "Inter, sans-serif", transition: "border-color .2s",
  };
  const labelStyle = { fontSize: 11, fontWeight: 700, color: "#C7C4D8", letterSpacing: ".06em", textTransform: "uppercase" as const, display: "block", marginBottom: 6 };

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", backdropFilter: "blur(6px)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div style={{ width: "100%", maxWidth: 560, maxHeight: "92vh", overflowY: "auto", background: "rgba(26,26,46,0.97)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 24, boxShadow: "0 24px 80px rgba(0,0,0,0.6)", animation: "scaleIn .2s ease" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 24px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: "#E4E1EE" }}>{isEdit ? "Edit Course" : "Add New Course"}</h2>
            <p style={{ fontSize: 12, color: "#C7C4D8", marginTop: 3 }}>
              {isEdit ? `Firestore: courses/${course!.id}` : "Creates doc in courses collection"}
            </p>
          </div>
          <button onClick={onClose} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#C7C4D8" }}>
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 18 }}>
          {/* Title */}
          <div>
            <label style={labelStyle}>Title *</label>
            <input value={form.title ?? ""} onChange={(e) => set("title", e.target.value)} placeholder="e.g. Advanced React Patterns" style={inputStyle} onFocus={(e) => (e.target.style.borderColor = "rgba(108,99,255,.5)")} onBlur={(e) => (e.target.style.borderColor = "rgba(255,255,255,.08)")} />
          </div>

          {/* Description */}
          <div>
            <label style={labelStyle}>Description</label>
            <textarea
              value={form.description ?? ""}
              onChange={(e) => set("description", e.target.value)}
              rows={3}
              placeholder="Short course description…"
              style={{ ...inputStyle, resize: "vertical" }}
              onFocus={(e) => (e.target.style.borderColor = "rgba(108,99,255,.5)")}
              onBlur={(e) => (e.target.style.borderColor = "rgba(255,255,255,.08)")}
            />
          </div>

          {/* Row: category + level */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div>
              <label style={labelStyle}>Category</label>
              <select value={form.category ?? CATEGORIES[0]} onChange={(e) => set("category", e.target.value)} style={inputStyle}>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Level</label>
              <select value={form.level ?? "beginner"} onChange={(e) => set("level", e.target.value as CourseLevel)} style={inputStyle}>
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
                <option value="all_levels">All Levels</option>
              </select>
            </div>
          </div>

          {/* Row: price + modules */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div>
              <label style={labelStyle}>Price (USD)</label>
              <input type="number" min={0} value={form.price ?? 0} onChange={(e) => set("price", Number(e.target.value))} placeholder="0 = free" style={inputStyle} onFocus={(e) => (e.target.style.borderColor = "rgba(108,99,255,.5)")} onBlur={(e) => (e.target.style.borderColor = "rgba(255,255,255,.08)")} />
            </div>
            <div>
              <label style={labelStyle}>Modules</label>
              <input type="number" min={1} value={form.modules ?? 1} onChange={(e) => set("modules", Number(e.target.value))} style={inputStyle} onFocus={(e) => (e.target.style.borderColor = "rgba(108,99,255,.5)")} onBlur={(e) => (e.target.style.borderColor = "rgba(255,255,255,.08)")} />
            </div>
          </div>

          {/* Status */}
          <div>
            <label style={labelStyle}>Status</label>
            <div style={{ display: "flex", gap: 8 }}>
              {(["draft", "published", "archived"] as CourseStatus[]).map((s) => (
                <button
                  key={s}
                  onClick={() => set("status", s)}
                  style={{
                    flex: 1, padding: "9px 8px", borderRadius: 10, fontSize: 12, fontWeight: 700,
                    fontFamily: "Inter, sans-serif", cursor: "pointer", transition: "all .15s",
                    background: form.status === s ? "linear-gradient(135deg,#6C63FF,#9B59B6)" : "rgba(255,255,255,0.04)",
                    border: form.status === s ? "1px solid rgba(108,99,255,0.4)" : "1px solid rgba(255,255,255,0.08)",
                    color: form.status === s ? "#fff" : "#C7C4D8",
                  }}
                >
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Thumbnail URL */}
          <div>
            <label style={labelStyle}>Thumbnail URL (Firebase Storage)</label>
            <div style={{ position: "relative" }}>
              <Image size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#C7C4D8" }} />
              <input value={form.thumbnail ?? ""} onChange={(e) => set("thumbnail", e.target.value)} placeholder="https://firebasestorage.googleapis.com/…" style={{ ...inputStyle, paddingLeft: 34 }} onFocus={(e) => (e.target.style.borderColor = "rgba(108,99,255,.5)")} onBlur={(e) => (e.target.style.borderColor = "rgba(255,255,255,.08)")} />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: "16px 24px", borderTop: "1px solid rgba(255,255,255,0.06)", display: "flex", gap: 12 }}>
          <button onClick={onClose} style={{ flex: 1, padding: "12px", borderRadius: 14, fontSize: 14, fontWeight: 600, fontFamily: "Inter, sans-serif", cursor: "pointer", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "#C7C4D8" }}>
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!form.title || saving}
            style={{ flex: 2, padding: "12px", borderRadius: 14, fontSize: 14, fontWeight: 700, fontFamily: "Inter, sans-serif", cursor: saving ? "wait" : "pointer", background: "linear-gradient(135deg,#6C63FF,#9B59B6)", border: "none", color: "#fff", boxShadow: "0 0 20px rgba(108,99,255,0.3)", opacity: !form.title ? 0.5 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, transition: "all .2s" }}
          >
            {saving ? <RefreshCw size={15} style={{ animation: "spin .8s linear infinite" }} /> : <Save size={15} />}
            {saving ? "Saving to Firestore…" : isEdit ? "Save changes" : "Create course"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// COURSE TABLE
// ═══════════════════════════════════════════════════════════════════════════

interface CourseTableProps {
  courses: Course[];
  loading: boolean;
  onEdit: (c: Course) => void;
  onDelete: (c: Course) => void;
  onView: (c: Course) => void;
  sortField: SortField;
  sortDir: SortDir;
  onSort: (field: SortField) => void;
}

function CourseTable({ courses, loading, onEdit, onDelete, onView, sortField, sortDir, onSort }: CourseTableProps) {
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const SortButton = ({ field, label }: { field: SortField; label: string }) => (
    <button
      onClick={() => onSort(field)}
      style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "none", border: "none", cursor: "pointer", color: sortField === field ? "#e3dfff" : "#C7C4D8", fontSize: 11, fontWeight: 700, fontFamily: "Inter, sans-serif", letterSpacing: ".06em", textTransform: "uppercase" }}
    >
      {label}
      <ArrowUpDown size={11} style={{ opacity: sortField === field ? 1 : 0.4 }} />
    </button>
  );

  const thStyle: React.CSSProperties = { padding: "10px 16px", textAlign: "left", background: "rgba(255,255,255,0.02)", borderBottom: "1px solid rgba(255,255,255,0.06)" };

  return (
    <div style={{ background: "rgba(26,26,46,0.6)", borderRadius: 20, border: "1px solid rgba(255,255,255,0.06)", overflow: "hidden" }}>
      {/* Table header */}
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 780 }}>
          <thead>
            <tr>
              <th style={{ ...thStyle, width: 48 }}></th>
              <th style={thStyle}><SortButton field="title" label="Course" /></th>
              <th style={thStyle}><span style={{ fontSize: 11, fontWeight: 700, color: "#C7C4D8", letterSpacing: ".06em", textTransform: "uppercase" }}>Category</span></th>
              <th style={thStyle}><SortButton field="price" label="Price" /></th>
              <th style={thStyle}><span style={{ fontSize: 11, fontWeight: 700, color: "#C7C4D8", letterSpacing: ".06em", textTransform: "uppercase" }}>Level</span></th>
              <th style={thStyle}><span style={{ fontSize: 11, fontWeight: 700, color: "#C7C4D8", letterSpacing: ".06em", textTransform: "uppercase" }}>Status</span></th>
              <th style={thStyle}><SortButton field="updatedAt" label="Updated" /></th>
              <th style={{ ...thStyle, textAlign: "center" }}><span style={{ fontSize: 11, fontWeight: 700, color: "#C7C4D8", letterSpacing: ".06em", textTransform: "uppercase" }}>Actions</span></th>
            </tr>
          </thead>

          <tbody>
            {loading
              ? Array.from({ length: PAGE_SIZE }).map((_, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                    {[48, 260, 100, 70, 100, 100, 100, 90].map((w, j) => (
                      <td key={j} style={{ padding: "14px 16px" }}>
                        <div style={{ height: 16, width: "80%", borderRadius: 8, background: "linear-gradient(90deg,#1f1f2c 25%,#2a2935 50%,#1f1f2c 75%)", backgroundSize: "200% 100%", animation: "shimmer 1.4s infinite" }} />
                      </td>
                    ))}
                  </tr>
                ))
              : courses.length === 0
              ? (
                <tr>
                  <td colSpan={8} style={{ padding: 60, textAlign: "center" }}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
                      <div style={{ width: 64, height: 64, borderRadius: "50%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <GraduationCap size={28} color="#47464f" />
                      </div>
                      <p style={{ fontSize: 15, fontWeight: 600, color: "#C7C4D8" }}>No courses found</p>
                      <p style={{ fontSize: 13, color: "#47464f" }}>Try adjusting your search or filters</p>
                    </div>
                  </td>
                </tr>
              )
              : courses.map((course, idx) => (
                  <tr
                    key={course.id}
                    style={{ borderBottom: "1px solid rgba(255,255,255,0.04)", transition: "background .15s" }}
                    onMouseOver={(e) => ((e.currentTarget as HTMLTableRowElement).style.background = "rgba(255,255,255,0.025)")}
                    onMouseOut={(e) => ((e.currentTarget as HTMLTableRowElement).style.background = "transparent")}
                  >
                    {/* Thumbnail */}
                    <td style={{ padding: "12px 8px 12px 16px" }}>
                      <div style={{ width: 40, height: 40, borderRadius: 10, background: "rgba(108,99,255,0.12)", border: "1px solid rgba(108,99,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", flexShrink: 0 }}>
                        {course.thumbnail
                          ? <img src={course.thumbnail} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          : <BookOpen size={18} color="#6C63FF" />
                        }
                      </div>
                    </td>

                    {/* Title + meta */}
                    <td style={{ padding: "12px 16px", maxWidth: 260 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#E4E1EE", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginBottom: 4 }}>
                        {course.title}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 11, color: "#C7C4D8" }}>
                        {course.rating !== undefined && (
                          <span style={{ display: "flex", alignItems: "center", gap: 3 }}>
                            <Star size={11} color="#FFB785" fill="#FFB785" />
                            {course.rating.toFixed(1)}
                          </span>
                        )}
                        <span style={{ display: "flex", alignItems: "center", gap: 3 }}>
                          <Layers size={11} />
                          {course.modules} modules
                        </span>
                        {course.durationHours !== undefined && (
                          <span style={{ display: "flex", alignItems: "center", gap: 3 }}>
                            <Clock size={11} />
                            {course.durationHours}h
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Category */}
                    <td style={{ padding: "12px 16px" }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 600, color: "#C7C4D8" }}>
                        <Tag size={11} />
                        {course.category}
                      </span>
                    </td>

                    {/* Price */}
                    <td style={{ padding: "12px 16px" }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: course.price === 0 ? "#45f1c5" : "#e3dfff" }}>
                        {fmtCurrency(course.price)}
                      </span>
                    </td>

                    {/* Level */}
                    <td style={{ padding: "12px 16px" }}>
                      <LevelBadge level={course.level} />
                    </td>

                    {/* Status */}
                    <td style={{ padding: "12px 16px" }}>
                      <StatusBadge status={course.status} />
                    </td>

                    {/* Updated */}
                    <td style={{ padding: "12px 16px" }}>
                      <span style={{ fontSize: 12, color: "#C7C4D8" }}>{fmtDate(course.updatedAt)}</span>
                    </td>

                    {/* Actions */}
                    <td style={{ padding: "12px 16px", textAlign: "center" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
                        <button
                          title="View details"
                          onClick={() => onView(course)}
                          style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#C7C4D8", transition: "all .15s" }}
                          onMouseOver={(e) => { e.currentTarget.style.background = "rgba(227,223,255,0.1)"; e.currentTarget.style.color = "#e3dfff"; }}
                          onMouseOut={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.04)"; e.currentTarget.style.color = "#C7C4D8"; }}
                        >
                          <Eye size={14} />
                        </button>
                        <button
                          title="Edit course"
                          onClick={() => onEdit(course)}
                          style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(108,99,255,0.08)", border: "1px solid rgba(108,99,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#6C63FF", transition: "all .15s" }}
                          onMouseOver={(e) => { e.currentTarget.style.background = "rgba(108,99,255,0.18)"; }}
                          onMouseOut={(e) => { e.currentTarget.style.background = "rgba(108,99,255,0.08)"; }}
                        >
                          <Edit3 size={14} />
                        </button>
                        <button
                          title="Delete course"
                          onClick={() => onDelete(course)}
                          style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(255,180,171,0.08)", border: "1px solid rgba(255,180,171,0.2)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#ffb4ab", transition: "all .15s" }}
                          onMouseOver={(e) => { e.currentTarget.style.background = "rgba(255,180,171,0.18)"; }}
                          onMouseOut={(e) => { e.currentTarget.style.background = "rgba(255,180,171,0.08)"; }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
            }
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TOAST NOTIFICATION
// ═══════════════════════════════════════════════════════════════════════════

interface Toast { id: string; msg: string; type: "success" | "error" | "info"; }

function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const add = useCallback((msg: string, type: Toast["type"] = "success") => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t, { id, msg, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
  }, []);
  return { toasts, add };
}

function ToastContainer({ toasts }: { toasts: Toast[] }) {
  const color = { success: "#45f1c5", error: "#ffb4ab", info: "#e3dfff" };
  return (
    <div style={{ position: "fixed", bottom: 24, right: 24, zIndex: 99999, display: "flex", flexDirection: "column", gap: 10 }}>
      {toasts.map((t) => (
        <div key={t.id} style={{ background: "rgba(26,26,46,0.97)", border: `1px solid ${color[t.type]}40`, borderRadius: 14, padding: "12px 18px", color: color[t.type], fontSize: 13, fontWeight: 600, fontFamily: "Inter, sans-serif", boxShadow: `0 8px 30px rgba(0,0,0,0.4), 0 0 20px ${color[t.type]}20`, animation: "slideInRight .3s ease", maxWidth: 340 }}>
          {t.msg}
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN: CourseListAdmin
// ═══════════════════════════════════════════════════════════════════════════

export default function CourseListAdmin() {
  const [filters, setFilters] = useState<CourseFiltersState>({
    search: "", category: "all", status: "all", level: "all",
    sortField: "createdAt", sortDir: "desc",
  });
  const [paging] = useState({ page: 1, pageSize: PAGE_SIZE });

  const { courses, loading, error, pagination, goToPage, refetch } = useCourses(filters, paging);

  const [editingCourse, setEditingCourse] = useState<Course | null | undefined>(undefined);
  const [deletingCourse, setDeletingCourse] = useState<Course | null>(null);
  const [viewingCourse, setViewingCourse] = useState<Course | null>(null);
  const { toasts, add: addToast } = useToast();

  const handleFilterChange = useCallback((partial: Partial<CourseFiltersState>) => {
    setFilters((f) => ({ ...f, ...partial }));
  }, []);

  const handleSort = useCallback((field: SortField) => {
    setFilters((f) => ({
      ...f,
      sortField: field,
      sortDir: f.sortField === field && f.sortDir === "desc" ? "asc" : "desc",
    }));
  }, []);

  const handleSave = useCallback((data: Partial<Course>) => {
    // ── FIREBASE ─────────────────────────────────────────────────────
    // Real write happens inside CourseFormModal (updateDoc / addDoc)
    // ── /FIREBASE ─────────────────────────────────────────────────────
    addToast(editingCourse ? `"${data.title}" updated ✓` : `Course "${data.title}" created ✓`);
    setEditingCourse(undefined);
    refetch();
  }, [editingCourse, addToast, refetch]);

  const handleDeleteConfirm = useCallback((soft: boolean) => {
    if (!deletingCourse) return;
    // ── FIREBASE ─────────────────────────────────────────────────────
    // if (soft) {
    //   await updateDoc(doc(db, "courses", deletingCourse.id), { status: "archived", updatedAt: serverTimestamp() });
    // } else {
    //   await deleteDoc(doc(db, "courses", deletingCourse.id));
    // }
    // ── /FIREBASE ─────────────────────────────────────────────────────
    addToast(soft ? `"${deletingCourse.title}" archived` : `"${deletingCourse.title}" deleted permanently`, soft ? "info" : "error");
    setDeletingCourse(null);
    refetch();
  }, [deletingCourse, addToast, refetch]);

  // Summary stats
  const summaryStats = useMemo(() => {
    const pub = ALL_COURSES.filter((c) => c.status === "published").length;
    const draft = ALL_COURSES.filter((c) => c.status === "draft").length;
    const revenue = ALL_COURSES.filter((c) => c.status === "published").reduce((s, c) => s + c.price * (c.totalStudents ?? 0), 0);
    return { total: ALL_COURSES.length, pub, draft, revenue };
  }, []);

  return (
    <div style={{ minHeight: "100vh", background: "#0F0F1A", color: "#E4E1EE", fontFamily: "Inter, sans-serif", padding: "24px", backgroundImage: "radial-gradient(circle at 10% 5%, rgba(108,99,255,0.07) 0%, transparent 55%)" }}>

      {/* Global CSS */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');
        @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
        @keyframes fadeIn { from{opacity:0;transform:translateY(-6px)} to{opacity:1;transform:translateY(0)} }
        @keyframes scaleIn { from{opacity:0;transform:scale(0.94)} to{opacity:1;transform:scale(1)} }
        @keyframes slideInRight { from{opacity:0;transform:translateX(20px)} to{opacity:1;transform:translateX(0)} }
        @keyframes spin { to{transform:rotate(360deg)} }
        *{box-sizing:border-box;} body{margin:0;}
        input,select,textarea,button { font-family: Inter, sans-serif; }
        ::-webkit-scrollbar{width:6px;height:6px;} ::-webkit-scrollbar-track{background:#0F0F1A;} ::-webkit-scrollbar-thumb{background:#353438;border-radius:10px;}
      `}</style>

      <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", flexDirection: "column", gap: 24 }}>

        {/* ── PAGE HEADER ─────────────────────────────────────────────── */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
              <GraduationCap size={22} color="#6C63FF" />
              <h1 style={{ fontSize: 24, fontWeight: 700, color: "#E4E1EE" }}>Course Management</h1>
            </div>
            <p style={{ fontSize: 13, color: "#C7C4D8" }}>
              Firestore: <code style={{ background: "rgba(108,99,255,0.12)", padding: "1px 6px", borderRadius: 5, fontSize: 11, color: "#c4c0ff" }}>courses</code> collection · Realtime <code style={{ background: "rgba(69,241,197,0.10)", padding: "1px 6px", borderRadius: 5, fontSize: 11, color: "#45f1c5" }}>onSnapshot</code>
            </p>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button
              onClick={refetch}
              style={{ display: "flex", alignItems: "center", gap: 7, padding: "10px 16px", borderRadius: 12, fontSize: 13, fontWeight: 600, cursor: "pointer", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#C7C4D8", transition: "all .2s" }}
              onMouseOver={(e) => { e.currentTarget.style.color = "#e3dfff"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.2)"; }}
              onMouseOut={(e) => { e.currentTarget.style.color = "#C7C4D8"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; }}
            >
              <RefreshCw size={14} />
              Refresh
            </button>
            <button
              onClick={() => setEditingCourse(null)}
              style={{ display: "flex", alignItems: "center", gap: 7, padding: "10px 20px", borderRadius: 12, fontSize: 13, fontWeight: 700, cursor: "pointer", background: "linear-gradient(135deg,#6C63FF,#9B59B6)", border: "none", color: "#fff", boxShadow: "0 0 20px rgba(108,99,255,0.25)", transition: "opacity .2s" }}
              onMouseOver={(e) => (e.currentTarget.style.opacity = "0.88")}
              onMouseOut={(e) => (e.currentTarget.style.opacity = "1")}
            >
              <Plus size={16} />
              Add Course
            </button>
          </div>
        </div>

        {/* ── SUMMARY STAT STRIP ──────────────────────────────────────── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
          {[
            { label: "Total Courses", value: summaryStats.total, icon: <BookOpen size={16} color="#e3dfff" />, glow: "rgba(227,223,255,0.1)" },
            { label: "Published", value: summaryStats.pub, icon: <CheckCircle size={16} color="#45f1c5" />, glow: "rgba(69,241,197,0.1)" },
            { label: "Drafts", value: summaryStats.draft, icon: <PauseCircle size={16} color="#FFB785" />, glow: "rgba(255,183,133,0.1)" },
            { label: "Est. Revenue", value: `$${(summaryStats.revenue / 1000).toFixed(0)}k+`, icon: <DollarSign size={16} color="#6C63FF" />, glow: "rgba(108,99,255,0.15)" },
          ].map(({ label, value, icon, glow }) => (
            <div key={label} style={{ background: "rgba(26,26,46,0.6)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16, padding: "16px 18px", display: "flex", alignItems: "center", gap: 14, backdropFilter: "blur(12px)", boxShadow: `0 4px 20px ${glow}` }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: glow, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{icon}</div>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#C7C4D8", letterSpacing: ".07em", textTransform: "uppercase", marginBottom: 3 }}>{label}</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: "#E4E1EE" }}>{value}</div>
              </div>
            </div>
          ))}
        </div>

        {/* ── FILTERS ─────────────────────────────────────────────────── */}
        <CourseFilters filters={filters} onChange={handleFilterChange} total={pagination.total} loading={loading} />

        {/* ── TABLE ───────────────────────────────────────────────────── */}
        {error ? (
          <div style={{ background: "rgba(255,180,171,0.08)", border: "1px solid rgba(255,180,171,0.2)", borderRadius: 16, padding: 32, display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
            <AlertTriangle size={32} color="#ffb4ab" />
            <p style={{ fontSize: 15, fontWeight: 600, color: "#E4E1EE" }}>Failed to load courses</p>
            <p style={{ fontSize: 13, color: "#C7C4D8" }}>{error.message}</p>
            <button onClick={refetch} style={{ display: "flex", alignItems: "center", gap: 7, padding: "10px 20px", borderRadius: 12, fontSize: 13, fontWeight: 700, cursor: "pointer", background: "linear-gradient(135deg,#6C63FF,#9B59B6)", border: "none", color: "#fff" }}>
              <RefreshCw size={14} /> Retry
            </button>
          </div>
        ) : (
          <CourseTable
            courses={courses}
            loading={loading}
            onEdit={setEditingCourse}
            onDelete={setDeletingCourse}
            onView={setViewingCourse}
            sortField={filters.sortField}
            sortDir={filters.sortDir}
            onSort={handleSort}
          />
        )}

        {/* ── PAGINATION ──────────────────────────────────────────────── */}
        <Pagination
          page={pagination.page}
          pageSize={pagination.pageSize}
          total={pagination.total}
          onPage={goToPage}
        />

      </div>

      {/* ── MODALS ──────────────────────────────────────────────────────── */}
      {editingCourse !== undefined && (
        <CourseFormModal
          course={editingCourse}
          onSave={handleSave}
          onClose={() => setEditingCourse(undefined)}
        />
      )}

      {deletingCourse && (
        <DeleteConfirmDialog
          course={deletingCourse}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeletingCourse(null)}
        />
      )}

      {/* View detail modal (lightweight) */}
      {viewingCourse && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", backdropFilter: "blur(6px)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }} onClick={() => setViewingCourse(null)}>
          <div style={{ width: "100%", maxWidth: 440, background: "rgba(26,26,46,0.97)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 24, padding: 28, animation: "scaleIn .2s ease" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: "#E4E1EE" }}>Course Details</h2>
              <button onClick={() => setViewingCourse(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#C7C4D8" }}><X size={18} /></button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {[
                ["ID", viewingCourse.id],
                ["Title", viewingCourse.title],
                ["Category", viewingCourse.category],
                ["Level", fmtLevel(viewingCourse.level)],
                ["Price", fmtCurrency(viewingCourse.price)],
                ["Modules", String(viewingCourse.modules)],
                ["Students", (viewingCourse.totalStudents ?? 0).toLocaleString()],
                ["Rating", viewingCourse.rating ? `${viewingCourse.rating} / 5` : "No ratings"],
                ["Status", viewingCourse.status],
                ["Created", fmtDate(viewingCourse.createdAt)],
                ["Updated", fmtDate(viewingCourse.updatedAt)],
              ].map(([k, v]) => (
                <div key={k} style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid rgba(255,255,255,0.05)", paddingBottom: 10 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#C7C4D8", textTransform: "uppercase", letterSpacing: ".06em" }}>{k}</span>
                  <span style={{ fontSize: 13, color: "#E4E1EE", fontWeight: 600, textAlign: "right", maxWidth: 240 }}>{v}</span>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 20, display: "flex", gap: 10 }}>
              <button onClick={() => { setViewingCourse(null); setEditingCourse(viewingCourse); }} style={{ flex: 1, padding: "11px", borderRadius: 14, fontSize: 13, fontWeight: 700, cursor: "pointer", background: "linear-gradient(135deg,#6C63FF,#9B59B6)", border: "none", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}>
                <Edit3 size={14} /> Edit
              </button>
              <button onClick={() => setViewingCourse(null)} style={{ flex: 1, padding: "11px", borderRadius: 14, fontSize: 13, fontWeight: 600, cursor: "pointer", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "#C7C4D8" }}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      <ToastContainer toasts={toasts} />
    </div>
  );
}

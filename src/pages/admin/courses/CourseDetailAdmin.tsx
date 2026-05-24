/**
 * Smart Review — Admin Course Detail View
 * React + TypeScript + Firebase SDK v9+
 *
 * File: src/pages/admin/courses/CourseDetailAdmin.tsx
 *
 * Route: /admin/courses/:courseId
 *
 * Dependencies: firebase  lucide-react  recharts
 */

"use client";

import React, { useState, useEffect, useCallback, useMemo, type ReactNode } from "react";
import { useParams, useNavigate } from "react-router-dom";

// ─── Import custom hooks từ thư mục hooks ─────────────────────────────────────
import { useDocument } from "../../../hooks/useFirestore";

// ─── Recharts ────────────────────────────────────────────────────────────────
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
  BarChart, Bar,
} from "recharts";

// ─── Lucide icons ─────────────────────────────────────────────────────────────
import {
  ArrowLeft, Edit3, Trash2, Share2, ExternalLink,
  Star, StarHalf, Clock, Users, BookOpen, Play, FileText,
  Zap, BarChart2, Tag, Globe, Calendar, ChevronDown,
  ChevronRight, CheckCircle, Lock, Eye, EyeOff, PauseCircle,
  TrendingUp, Award, MessageSquare, RefreshCw, AlertTriangle,
  Loader, Video, Layers, DollarSign, Activity, MoreVertical,
  Copy, Info, GraduationCap,
} from "lucide-react";

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

type CourseStatus  = "published" | "draft" | "archived";
type CourseLevel   = "beginner" | "intermediate" | "advanced" | "all_levels";
type LessonType    = "video" | "quiz" | "reading" | "assignment";

interface Lesson {
  id: string;
  title: string;
  type: LessonType;
  duration: number;     // minutes
  videoUrl?: string;
  xpReward: number;
  isFree: boolean;
  order: number;
}

interface Module {
  id: string;
  title: string;
  order: number;
  lessons: Lesson[];
}

interface Instructor {
  id: string;
  name: string;
  title: string;
  avatar?: string;
  totalCourses: number;
  totalStudents: number;
}

interface Review {
  id: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  rating: number;         // 1-5
  comment: string;
  createdAt: Date;
  helpful: number;
}

interface EnrollmentPoint { date: string; count: number; revenue: number; }

interface Course {
  id: string;
  title: string;
  description: string;
  price: number;
  category: string;
  level: CourseLevel;
  status: CourseStatus;
  thumbnailUrl?: string;
  language: string;
  tags: string[];
  modules: Module[];
  instructor?: Instructor;
  rating: number;
  ratingCount: number;
  enrollments: number;
  totalDurationHours: number;
  createdAt: Date;
  updatedAt: Date;
  xpTotal: number;
  completionRate: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// MOCK DATA (thay bằng real data khi kết nối Firebase)
// ═══════════════════════════════════════════════════════════════════════════

const MOCK_COURSE: Course = {
  id: "course_001",
  title: "Advanced React Patterns & Performance",
  description: "Master the most advanced concepts in React development. Dive deep into concurrent rendering, custom hooks architecture, performance optimisation, and building highly scalable, gamified interfaces using glassmorphism and modern UI patterns. By the end you will be able to build enterprise-grade React apps with confidence.",
  price: 89,
  category: "Development",
  level: "advanced",
  status: "published",
  thumbnailUrl: "",
  language: "English",
  tags: ["react", "typescript", "performance", "hooks", "architecture"],
  rating: 4.9,
  ratingCount: 1245,
  enrollments: 3_480,
  totalDurationHours: 12.5,
  xpTotal: 2400,
  completionRate: 71,
  createdAt: new Date("2024-11-01"),
  updatedAt: new Date("2025-04-20"),
  instructor: {
    id: "inst_001",
    name: "Sarah Drasner",
    title: "Senior Frontend Architect",
    totalCourses: 8,
    totalStudents: 24_000,
  },
  modules: [
    {
      id: "mod_1", title: "The Foundations", order: 1,
      lessons: [
        { id: "l1", title: "Introduction to Modern React", type: "video", duration: 12, xpReward: 50, isFree: true, order: 1 },
        { id: "l2", title: "Component Architecture Patterns", type: "video", duration: 18, xpReward: 75, isFree: false, order: 2 },
        { id: "l3", title: "Module 1 Assessment Quiz", type: "quiz", duration: 10, xpReward: 100, isFree: false, order: 3 },
      ],
    },
    {
      id: "mod_2", title: "Advanced State Management", order: 2,
      lessons: [
        { id: "l4", title: "Context API Deep Dive", type: "video", duration: 22, xpReward: 75, isFree: false, order: 1 },
        { id: "l5", title: "Zustand vs Redux Toolkit", type: "reading", duration: 15, xpReward: 50, isFree: false, order: 2 },
        { id: "l6", title: "State Machine Assignment", type: "assignment", duration: 30, xpReward: 150, isFree: false, order: 3 },
        { id: "l7", title: "Advanced Patterns Quiz", type: "quiz", duration: 10, xpReward: 100, isFree: false, order: 4 },
      ],
    },
    {
      id: "mod_3", title: "Performance & Optimisation", order: 3,
      lessons: [
        { id: "l8",  title: "Concurrent Rendering Explained", type: "video", duration: 25, xpReward: 100, isFree: false, order: 1 },
        { id: "l9",  title: "Memoisation Strategies",         type: "video", duration: 18, xpReward: 75,  isFree: false, order: 2 },
        { id: "l10", title: "Bundle Splitting & Lazy Loading", type: "video", duration: 20, xpReward: 75,  isFree: false, order: 3 },
        { id: "l11", title: "Performance Audit Assignment",   type: "assignment", duration: 45, xpReward: 200, isFree: false, order: 4 },
      ],
    },
    {
      id: "mod_4", title: "Testing & Production", order: 4,
      lessons: [
        { id: "l12", title: "Unit & Integration Testing",    type: "video", duration: 20, xpReward: 75,  isFree: false, order: 1 },
        { id: "l13", title: "E2E Testing with Playwright",   type: "video", duration: 18, xpReward: 75,  isFree: false, order: 2 },
        { id: "l14", title: "CI/CD & Deployment Strategies", type: "reading", duration: 12, xpReward: 50, isFree: false, order: 3 },
        { id: "l15", title: "Final Project",                 type: "assignment", duration: 60, xpReward: 300, isFree: false, order: 4 },
      ],
    },
  ],
};

const MOCK_REVIEWS: Review[] = [
  { id: "r1", userId: "u1", userName: "Minh Tuấn", rating: 5, comment: "Best React course I've taken. The performance module completely changed the way I architect my apps.", createdAt: new Date("2025-04-18"), helpful: 42 },
  { id: "r2", userId: "u2", userName: "Lan Anh",   rating: 5, comment: "Sarah's explanations of concurrent rendering are the clearest I've found anywhere. Highly recommended.", createdAt: new Date("2025-04-10"), helpful: 31 },
  { id: "r3", userId: "u3", userName: "Hoàng Dev", rating: 4, comment: "Excellent content. Would love a bit more coverage of Next.js App Router patterns, but overall fantastic.", createdAt: new Date("2025-03-28"), helpful: 18 },
  { id: "r4", userId: "u4", userName: "Mai Phương",rating: 5, comment: "Went from beginner to confident with hooks. The assignments really cement the learning.", createdAt: new Date("2025-03-15"), helpful: 26 },
];

const MOCK_ENROLLMENT_TREND: EnrollmentPoint[] = [
  { date: "Nov", count: 210, revenue: 18690 },
  { date: "Dec", count: 340, revenue: 30260 },
  { date: "Jan", count: 480, revenue: 42720 },
  { date: "Feb", count: 620, revenue: 55180 },
  { date: "Mar", count: 890, revenue: 79210 },
  { date: "Apr", count: 940, revenue: 83660 },
];

const MOCK_RATING_DIST: { stars: number; count: number }[] = [
  { stars: 5, count: 892 },
  { stars: 4, count: 243 },
  { stars: 3, count: 72  },
  { stars: 2, count: 24  },
  { stars: 1, count: 14  },
];

// ═══════════════════════════════════════════════════════════════════════════
// CUSTOM HOOKS (không định nghĩa lại useDocument – đã import)
// ═══════════════════════════════════════════════════════════════════════════

function useEnrollmentCount(courseId: string) {
  const [count, setCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    // ── REAL FIREBASE ─────────────────────────────────────────────────
    // getCountFromServer(
    //   query(collection(db, "enrollments"), where("courseId", "==", courseId))
    // ).then((snap) => { setCount(snap.data().count); setLoading(false); });
    // ── MOCK ─────────────────────────────────────────────────────────
    const t = setTimeout(() => { setCount(3480); setLoading(false); }, 600);
    return () => clearTimeout(t);
  }, [courseId]);
  return { count, loading };
}

function useCourseReviews(courseId: string) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [avgRating, setAvgRating] = useState(0);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    // ── REAL FIREBASE ─────────────────────────────────────────────────
    // const q = query(
    //   collection(db, "reviews"),
    //   where("courseId", "==", courseId),
    //   orderBy("createdAt", "desc"),
    //   limit(20)
    // );
    // const unsub = onSnapshot(q, (snap) => {
    //   const data = snap.docs.map((d) => ({ id: d.id, ...d.data(), createdAt: d.data().createdAt?.toDate() })) as Review[];
    //   setReviews(data);
    //   const avg = data.length ? +(data.reduce((s, r) => s + r.rating, 0) / data.length).toFixed(1) : 0;
    //   setAvgRating(avg);
    //   setLoading(false);
    // });
    // return () => unsub();
    // ── MOCK ─────────────────────────────────────────────────────────
    const t = setTimeout(() => {
      setReviews(MOCK_REVIEWS);
      setAvgRating(4.9);
      setLoading(false);
    }, 700);
    return () => clearTimeout(t);
  }, [courseId]);
  return { reviews, avgRating, loading };
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

const fmtNum   = (n: number) => new Intl.NumberFormat("en-US", { notation: "compact" }).format(n);
const fmtMoney = (n: number) => n === 0 ? "Free" : `$${n}`;
const fmtDate  = (d: Date)   => d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
const fmtMins  = (m: number) => m >= 60 ? `${Math.floor(m / 60)}h ${m % 60 ? m % 60 + "m" : ""}`.trim() : `${m}m`;

const totalModuleMins = (m: Module) => m.lessons.reduce((s, l) => s + l.duration, 0);
const totalLessonsCount = (modules: Module[]) => modules.reduce((s, m) => s + m.lessons.length, 0);

const LESSON_META: Record<LessonType, { label: string; color: string; bg: string; Icon: React.ElementType }> = {
  video:      { label: "Video",      color: "#6C63FF", bg: "rgba(108,99,255,.14)", Icon: Play },
  quiz:       { label: "Quiz",       color: "#45f1c5", bg: "rgba(69,241,197,.12)", Icon: Zap },
  reading:    { label: "Reading",    color: "#FFB785", bg: "rgba(255,183,133,.12)", Icon: BookOpen },
  assignment: { label: "Assignment", color: "#ffb4ab", bg: "rgba(255,180,171,.12)", Icon: FileText },
};

const STATUS_CFG: Record<CourseStatus, { label: string; color: string; bg: string; border: string; Icon: React.ElementType }> = {
  published: { label: "Published", color: "#45f1c5", bg: "rgba(69,241,197,.12)",  border: "rgba(69,241,197,.28)",  Icon: CheckCircle },
  draft:     { label: "Draft",     color: "#FFB785", bg: "rgba(255,183,133,.12)", border: "rgba(255,183,133,.28)", Icon: PauseCircle },
  archived:  { label: "Archived",  color: "#B0AEC0", bg: "rgba(176,174,192,.12)", border: "rgba(176,174,192,.22)", Icon: EyeOff },
};

// ═══════════════════════════════════════════════════════════════════════════
// STATS BADGE
// ═══════════════════════════════════════════════════════════════════════════

interface StatsBadgeProps {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub?: string;
  accent: string;
  glow?: string;
  loading?: boolean;
}

function StatsBadge({ icon: Icon, label, value, sub, accent, glow, loading }: StatsBadgeProps) {
  return (
    <div style={{
      background: "rgba(26,26,46,.65)", border: `1px solid ${accent}`,
      borderRadius: 18, padding: "18px 20px",
      backdropFilter: "blur(12px)",
      boxShadow: glow ? `0 4px 24px ${glow}` : undefined,
      transition: "transform .2s, box-shadow .2s",
      position: "relative", overflow: "hidden",
    }}
      onMouseOver={(e) => { e.currentTarget.style.transform = "translateY(-2px)"; }}
      onMouseOut={(e)  => { e.currentTarget.style.transform = "translateY(0)";    }}
    >
      <div style={{ position: "absolute", top: -20, right: -20, width: 70, height: 70, borderRadius: "50%", background: accent, filter: "blur(28px)", opacity: .18, pointerEvents: "none" }} />
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <div style={{ width: 34, height: 34, borderRadius: 10, background: `${accent}22`, border: `1px solid ${accent}44`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Icon size={16} color={accent} />
        </div>
        <span style={{ fontSize: 10, fontWeight: 800, color: "#C7C4D8", letterSpacing: ".08em", textTransform: "uppercase" }}>{label}</span>
      </div>
      {loading
        ? <div style={{ height: 28, width: "60%", borderRadius: 8, background: "linear-gradient(90deg,#1f1f2c 25%,#2a2935 50%,#1f1f2c 75%)", backgroundSize: "200% 100%", animation: "shimmer 1.4s infinite" }} />
        : <div style={{ fontSize: 26, fontWeight: 800, color: "#E4E1EE", letterSpacing: "-.02em", lineHeight: 1 }}>{value}</div>
      }
      {sub && !loading && <p style={{ fontSize: 11, color: "#C7C4D8", marginTop: 5 }}>{sub}</p>}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// COURSE INFO PANEL
// ═══════════════════════════════════════════════════════════════════════════

function CourseInfo({ course, onEdit }: { course: Course; onEdit: () => void }) {
  const cfg = STATUS_CFG[course.status];
  const StatusIcon = cfg.Icon;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 24, alignItems: "start" }}>
      {/* LEFT: thumbnail */}
      <div style={{ position: "relative", borderRadius: 20, overflow: "hidden", aspectRatio: "16/9", background: "#0a0a15", border: "1px solid rgba(255,255,255,.07)", flexShrink: 0 }}>
        {course.thumbnailUrl
          ? <img src={course.thumbnailUrl} alt={course.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          : (
            <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, background: "linear-gradient(135deg,rgba(108,99,255,.12),rgba(0,212,170,.06))" }}>
              <div style={{ width: 72, height: 72, borderRadius: "50%", background: "rgba(108,99,255,.18)", border: "1px solid rgba(108,99,255,.3)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Video size={32} color="#6C63FF" />
              </div>
              <span style={{ fontSize: 13, color: "#C7C4D8", fontWeight: 600 }}>No thumbnail</span>
            </div>
          )
        }
        {/* Play overlay */}
        <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.35)", display: "flex", alignItems: "center", justifyContent: "center", opacity: 0, transition: "opacity .2s" }}
          onMouseOver={(e) => (e.currentTarget.style.opacity = "1")}
          onMouseOut={(e)  => (e.currentTarget.style.opacity = "0")}>
          <div style={{ width: 60, height: 60, borderRadius: "50%", background: "rgba(26,26,46,.85)", backdropFilter: "blur(10px)", border: "1px solid rgba(255,255,255,.15)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 20px rgba(108,99,255,.4)" }}>
            <Play size={24} color="#e3dfff" fill="#e3dfff" />
          </div>
        </div>

        {/* Status badge */}
        <div style={{ position: "absolute", top: 14, left: 14 }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "5px 12px", borderRadius: 999, background: cfg.bg, border: `1px solid ${cfg.border}`, color: cfg.color, fontSize: 11, fontWeight: 800, backdropFilter: "blur(8px)" }}>
            <StatusIcon size={11} /> {cfg.label}
          </span>
        </div>
      </div>

      {/* RIGHT: info */}
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {/* Title */}
        <div>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 10 }}>
            <h2 style={{ fontSize: 20, fontWeight: 800, color: "#E4E1EE", lineHeight: 1.35, flex: 1 }}>{course.title}</h2>
            <span style={{ fontSize: 22, fontWeight: 800, color: "#45f1c5", flexShrink: 0 }}>{fmtMoney(course.price)}</span>
          </div>
          <p style={{ fontSize: 13, color: "#C7C4D8", lineHeight: 1.6 }}>{course.description.slice(0, 180)}…</p>
        </div>

        {/* Meta chips */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {[
            { Icon: Tag,      val: course.category },
            { Icon: BarChart2, val: course.level.replace("_", " ") },
            { Icon: Globe,    val: course.language },
            { Icon: Calendar, val: fmtDate(course.createdAt) },
          ].map(({ Icon, val }) => (
            <span key={val} style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 8, background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.08)", fontSize: 11, fontWeight: 600, color: "#C7C4D8" }}>
              <Icon size={11} /> {val}
            </span>
          ))}
        </div>

        {/* Tags */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {course.tags.map((t) => (
            <span key={t} style={{ padding: "3px 9px", borderRadius: 999, background: "rgba(108,99,255,.12)", border: "1px solid rgba(108,99,255,.22)", fontSize: 11, fontWeight: 700, color: "#c4c0ff" }}>
              #{t}
            </span>
          ))}
        </div>

        {/* Rating row */}
        <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            {Array.from({ length: 5 }).map((_, i) => (
              <Star key={i} size={16} fill={i < Math.floor(course.rating) ? "#FFB785" : "transparent"} color="#FFB785" />
            ))}
          </div>
          <span style={{ fontSize: 18, fontWeight: 800, color: "#FFB785" }}>{course.rating.toFixed(1)}</span>
          <span style={{ fontSize: 12, color: "#C7C4D8" }}>({fmtNum(course.ratingCount)} reviews)</span>
          <span style={{ width: 4, height: 4, borderRadius: "50%", background: "#47464f", display: "inline-block" }} />
          <span style={{ fontSize: 12, color: "#C7C4D8", display: "flex", alignItems: "center", gap: 5 }}>
            <Clock size={12} /> {course.totalDurationHours}h total
          </span>
          <span style={{ width: 4, height: 4, borderRadius: "50%", background: "#47464f", display: "inline-block" }} />
          <span style={{ fontSize: 12, color: "#C7C4D8", display: "flex", alignItems: "center", gap: 5 }}>
            <BookOpen size={12} /> {totalLessonsCount(course.modules)} lessons
          </span>
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button
            onClick={onEdit}
            style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 20px", borderRadius: 12, fontSize: 13, fontWeight: 700, cursor: "pointer", background: "linear-gradient(135deg,#6C63FF,#9B59B6)", border: "none", color: "#fff", boxShadow: "0 0 18px rgba(108,99,255,.28)", transition: "opacity .2s" }}
            onMouseOver={(e) => (e.currentTarget.style.opacity = ".88")}
            onMouseOut={(e)  => (e.currentTarget.style.opacity = "1")}
          >
            <Edit3 size={14} /> Edit Course
          </button>
          <button style={{ display: "flex", alignItems: "center", gap: 7, padding: "10px 16px", borderRadius: 12, fontSize: 13, fontWeight: 600, cursor: "pointer", background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.1)", color: "#C7C4D8", transition: "all .2s" }}
            onMouseOver={(e) => { e.currentTarget.style.color = "#e3dfff"; }}
            onMouseOut={(e)  => { e.currentTarget.style.color = "#C7C4D8"; }}>
            <ExternalLink size={14} /> Preview
          </button>
          <button style={{ display: "flex", alignItems: "center", gap: 7, padding: "10px 16px", borderRadius: 12, fontSize: 13, fontWeight: 600, cursor: "pointer", background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.1)", color: "#C7C4D8", transition: "all .2s" }}>
            <Share2 size={14} /> Share
          </button>
          <button style={{ display: "flex", alignItems: "center", gap: 7, padding: "10px 16px", borderRadius: 12, fontSize: 13, fontWeight: 600, cursor: "pointer", background: "rgba(255,180,171,.08)", border: "1px solid rgba(255,180,171,.2)", color: "#ffb4ab", transition: "all .2s" }}>
            <Trash2 size={14} /> Delete
          </button>
        </div>

        {/* Firebase path */}
        <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "8px 12px", borderRadius: 10, background: "rgba(108,99,255,.07)", border: "1px solid rgba(108,99,255,.18)", fontSize: 11, color: "#9B59B6" }}>
          <Info size={12} />
          <code style={{ color: "#c4c0ff" }}>courses/{course.id}</code>
          <button title="Copy path" style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: "#9B59B6" }}>
            <Copy size={11} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// LESSON ROW (dùng trong ModuleAccordion)
// ═══════════════════════════════════════════════════════════════════════════

function LessonRow({ lesson, index }: { lesson: Lesson; index: number }) {
  const meta = LESSON_META[lesson.type];
  const MetaIcon = meta.Icon;

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12,
      padding: "10px 14px", borderRadius: 12,
      background: "rgba(255,255,255,.022)",
      border: "1px solid rgba(255,255,255,.06)",
      transition: "background .15s",
      cursor: "default",
    }}
      onMouseOver={(e) => (e.currentTarget.style.background = "rgba(255,255,255,.04)")}
      onMouseOut={(e)  => (e.currentTarget.style.background = "rgba(255,255,255,.022)")}
    >
      {/* Order */}
      <span style={{ width: 24, height: 24, borderRadius: "50%", background: "rgba(108,99,255,.18)", border: "1px solid rgba(108,99,255,.28)", fontSize: 10, fontWeight: 800, color: "#c4c0ff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        {index + 1}
      </span>

      {/* Type badge */}
      <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 9px", borderRadius: 999, background: meta.bg, color: meta.color, fontSize: 10, fontWeight: 700, flexShrink: 0 }}>
        <MetaIcon size={9} /> {meta.label}
      </span>

      {/* Title */}
      <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: "#E4E1EE", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {lesson.title}
      </span>

      {/* Free badge */}
      {lesson.isFree && (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 8px", borderRadius: 999, background: "rgba(69,241,197,.1)", border: "1px solid rgba(69,241,197,.25)", fontSize: 10, fontWeight: 700, color: "#45f1c5", flexShrink: 0 }}>
          <Eye size={9} /> Free
        </span>
      )}

      {/* XP */}
      <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 700, color: "#FFB785", flexShrink: 0 }}>
        <Zap size={11} /> +{lesson.xpReward}
      </span>

      {/* Duration */}
      <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "#C7C4D8", flexShrink: 0, minWidth: 42 }}>
        <Clock size={11} /> {lesson.duration}m
      </span>

      {/* Actions */}
      <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
        <button style={{ width: 28, height: 28, borderRadius: 8, background: "rgba(108,99,255,.08)", border: "1px solid rgba(108,99,255,.2)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#6C63FF", transition: "background .15s" }}
          onMouseOver={(e) => (e.currentTarget.style.background = "rgba(108,99,255,.18)")}
          onMouseOut={(e)  => (e.currentTarget.style.background = "rgba(108,99,255,.08)")}>
          <Edit3 size={12} />
        </button>
        <button style={{ width: 28, height: 28, borderRadius: 8, background: "rgba(255,180,171,.07)", border: "1px solid rgba(255,180,171,.18)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#ffb4ab", transition: "background .15s" }}
          onMouseOver={(e) => (e.currentTarget.style.background = "rgba(255,180,171,.16)")}
          onMouseOut={(e)  => (e.currentTarget.style.background = "rgba(255,180,171,.07)")}>
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MODULE ACCORDION
// ═══════════════════════════════════════════════════════════════════════════

function ModuleAccordion({ modules, courseId }: { modules: Module[]; courseId: string }) {
  const [openIds, setOpenIds] = useState<Set<string>>(new Set([modules[0]?.id]));

  const toggle = (id: string) =>
    setOpenIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const totalMins   = modules.reduce((s, m) => s + totalModuleMins(m), 0);
  const totalLesson = totalLessonsCount(modules);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {/* Header row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
        <div style={{ display: "flex", gap: 16 }}>
          <span style={{ fontSize: 12, color: "#C7C4D8", display: "flex", alignItems: "center", gap: 5 }}>
            <Layers size={13} /> {modules.length} modules
          </span>
          <span style={{ fontSize: 12, color: "#C7C4D8", display: "flex", alignItems: "center", gap: 5 }}>
            <BookOpen size={13} /> {totalLesson} lessons
          </span>
          <span style={{ fontSize: 12, color: "#C7C4D8", display: "flex", alignItems: "center", gap: 5 }}>
            <Clock size={13} /> {fmtMins(totalMins)}
          </span>
        </div>
        <a
          href={`/admin/courses/${courseId}/lessons`}
          style={{ display: "flex", alignItems: "center", gap: 7, padding: "7px 14px", borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: "pointer", background: "linear-gradient(135deg,#6C63FF,#9B59B6)", border: "none", color: "#fff", boxShadow: "0 0 14px rgba(108,99,255,.25)", textDecoration: "none", transition: "opacity .2s" }}
          onMouseOver={(e) => (e.currentTarget.style.opacity = ".88")}
          onMouseOut={(e)  => (e.currentTarget.style.opacity = "1")}
        >
          <Layers size={13} /> Manage Lessons
        </a>
      </div>

      {/* Module cards */}
      {modules.map((mod, mIdx) => {
        const isOpen = openIds.has(mod.id);
        const mins   = totalModuleMins(mod);

        return (
          <div key={mod.id} style={{ background: "rgba(26,26,46,.65)", border: "1px solid rgba(255,255,255,.07)", borderRadius: 18, overflow: "hidden", backdropFilter: "blur(12px)", transition: "box-shadow .2s" }}>
            {/* Module header (clickable) */}
            <button
              onClick={() => toggle(mod.id)}
              style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "14px 18px", background: "none", border: "none", cursor: "pointer", textAlign: "left" }}
            >
              {/* Order badge */}
              <div style={{ width: 30, height: 30, borderRadius: 9, background: "linear-gradient(135deg,#6C63FF,#9B59B6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800, color: "#fff", flexShrink: 0, boxShadow: "0 0 10px rgba(108,99,255,.3)" }}>
                {mIdx + 1}
              </div>

              {/* Title */}
              <span style={{ flex: 1, fontSize: 14, fontWeight: 700, color: "#E4E1EE" }}>
                {mod.title}
              </span>

              {/* Stats */}
              <span style={{ fontSize: 11, color: "#C7C4D8", display: "flex", alignItems: "center", gap: 10, flexShrink: 0, marginRight: 8 }}>
                <span style={{ display: "flex", alignItems: "center", gap: 4 }}><BookOpen size={11} /> {mod.lessons.length}</span>
                <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Clock size={11} /> {fmtMins(mins)}</span>
              </span>

              {/* Chevron */}
              <div style={{ color: "#C7C4D8", transition: "transform .25s", transform: isOpen ? "rotate(0deg)" : "rotate(-90deg)" }}>
                <ChevronDown size={16} />
              </div>
            </button>

            {/* Lessons (collapsible) */}
            {isOpen && (
              <div style={{ padding: "0 14px 14px", display: "flex", flexDirection: "column", gap: 7, animation: "fadeDown .22s ease" }}>
                {mod.lessons.map((lesson, lIdx) => (
                  <LessonRow key={lesson.id} lesson={lesson} index={lIdx} />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// REVIEWS PANEL
// ═══════════════════════════════════════════════════════════════════════════

function StarRating({ rating, size = 14 }: { rating: number; size?: number }) {
  return (
    <span style={{ display: "inline-flex", gap: 2 }}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Star key={i} size={size} color="#FFB785"
          fill={i < Math.floor(rating) ? "#FFB785" : i < rating ? "#FFB785" : "transparent"}
          opacity={i < Math.ceil(rating) ? 1 : .3}
        />
      ))}
    </span>
  );
}

function ReviewsPanel({ reviews, avgRating, ratingDist }: { reviews: Review[]; avgRating: number; ratingDist: typeof MOCK_RATING_DIST }) {
  const total = ratingDist.reduce((s, r) => s + r.count, 0);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 24, alignItems: "start" }}>
      {/* Left: summary */}
      <div style={{ display: "flex", flexDirection: "column", gap: 16, position: "sticky", top: 0 }}>
        <div style={{ textAlign: "center", padding: "20px 16px", background: "rgba(255,255,255,.025)", borderRadius: 16, border: "1px solid rgba(255,255,255,.07)" }}>
          <div style={{ fontSize: 52, fontWeight: 900, color: "#FFB785", lineHeight: 1 }}>{avgRating.toFixed(1)}</div>
          <StarRating rating={avgRating} size={18} />
          <p style={{ fontSize: 12, color: "#C7C4D8", marginTop: 8 }}>{total.toLocaleString()} ratings</p>
        </div>

        {/* Distribution bars */}
        <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
          {[5, 4, 3, 2, 1].map((stars) => {
            const entry = ratingDist.find((r) => r.stars === stars);
            const pct = entry ? Math.round((entry.count / total) * 100) : 0;
            return (
              <div key={stars} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11 }}>
                <span style={{ color: "#FFB785", fontWeight: 700, width: 14, textAlign: "right", flexShrink: 0 }}>{stars}</span>
                <Star size={10} color="#FFB785" fill="#FFB785" />
                <div style={{ flex: 1, height: 7, borderRadius: 99, background: "rgba(255,255,255,.08)", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${pct}%`, background: "linear-gradient(90deg,#FFB785,#FF8C42)", borderRadius: 99, transition: "width .6s ease" }} />
                </div>
                <span style={{ color: "#C7C4D8", width: 30, textAlign: "right", flexShrink: 0 }}>{pct}%</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Right: review cards */}
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {reviews.map((r) => (
          <div key={r.id} style={{ background: "rgba(26,26,46,.6)", border: "1px solid rgba(255,255,255,.07)", borderRadius: 16, padding: "16px 18px", backdropFilter: "blur(10px)" }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: "50%", background: "linear-gradient(135deg,#6C63FF,#00D4AA)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800, color: "#fff", flexShrink: 0 }}>
                  {r.userName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 700, color: "#E4E1EE" }}>{r.userName}</p>
                  <p style={{ fontSize: 11, color: "#C7C4D8" }}>{fmtDate(r.createdAt)}</p>
                </div>
              </div>
              <StarRating rating={r.rating} size={13} />
            </div>
            <p style={{ fontSize: 13, color: "#C7C4D8", lineHeight: 1.6 }}>{r.comment}</p>
            <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 10, fontSize: 11, color: "#47464f" }}>
              <Award size={11} /> {r.helpful} found helpful
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ENROLLMENT CHART
// ═══════════════════════════════════════════════════════════════════════════

const ChartTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "rgba(26,26,46,.97)", border: "1px solid rgba(255,255,255,.08)", borderRadius: 12, padding: "10px 14px", fontSize: 12 }}>
      <p style={{ color: "#C7C4D8", marginBottom: 6, fontWeight: 700 }}>{label}</p>
      <p style={{ color: "#45f1c5" }}>+{payload[0]?.value} students</p>
      <p style={{ color: "#FFB785", marginTop: 3 }}>${payload[1]?.value?.toLocaleString()} revenue</p>
    </div>
  );
};

function EnrollmentChart({ data }: { data: EnrollmentPoint[] }) {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "#C7C4D8" }}>
          <span style={{ width: 10, height: 10, borderRadius: 2, background: "#45f1c5", display: "inline-block" }} /> Enrollments
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "#C7C4D8" }}>
          <span style={{ width: 10, height: 10, borderRadius: 2, background: "#FFB785", display: "inline-block" }} /> Revenue ($)
        </div>
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={data} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
          <defs>
            <linearGradient id="gEnroll" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#45f1c5" stopOpacity={.3} />
              <stop offset="95%" stopColor="#45f1c5" stopOpacity={0}  />
            </linearGradient>
            <linearGradient id="gRev" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#FFB785" stopOpacity={.25} />
              <stop offset="95%" stopColor="#FFB785" stopOpacity={0}   />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.04)" vertical={false} />
          <XAxis dataKey="date" tick={{ fill: "#C7C4D8", fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: "#C7C4D8", fontSize: 11 }} axisLine={false} tickLine={false} />
          <Tooltip content={<ChartTooltip />} cursor={{ stroke: "rgba(255,255,255,.08)", strokeWidth: 1 }} />
          <Area type="monotone" dataKey="count"   stroke="#45f1c5" strokeWidth={2} fill="url(#gEnroll)" dot={false} activeDot={{ r: 5, fill: "#45f1c5", stroke: "#0F0F1A", strokeWidth: 2 }} />
          <Area type="monotone" dataKey="revenue" stroke="#FFB785" strokeWidth={2} fill="url(#gRev)"    dot={false} activeDot={{ r: 5, fill: "#FFB785", stroke: "#0F0F1A", strokeWidth: 2 }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION WRAPPER
// ═══════════════════════════════════════════════════════════════════════════

function Section({ title, subtitle, icon: Icon, children, action }: {
  title: string; subtitle?: string;
  icon: React.ElementType;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div style={{ background: "rgba(26,26,46,.6)", border: "1px solid rgba(255,255,255,.06)", borderRadius: 22, overflow: "hidden", backdropFilter: "blur(14px)" }}>
      <div style={{ padding: "16px 22px", borderBottom: "1px solid rgba(255,255,255,.06)", display: "flex", alignItems: "center", gap: 12, background: "rgba(255,255,255,.02)" }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(108,99,255,.14)", border: "1px solid rgba(108,99,255,.24)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Icon size={17} color="#6C63FF" />
        </div>
        <div style={{ flex: 1 }}>
          <h3 style={{ fontSize: 15, fontWeight: 800, color: "#E4E1EE", margin: 0 }}>{title}</h3>
          {subtitle && <p style={{ fontSize: 11, color: "#C7C4D8", margin: 0 }}>{subtitle}</p>}
        </div>
        {action}
      </div>
      <div style={{ padding: 22 }}>{children}</div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB BAR
// ═══════════════════════════════════════════════════════════════════════════

const TABS = [
  { id: "overview",    label: "Overview",   Icon: Info         },
  { id: "curriculum",  label: "Curriculum",  Icon: BookOpen     },
  { id: "analytics",   label: "Analytics",   Icon: TrendingUp   },
  { id: "reviews",     label: "Reviews",     Icon: MessageSquare },
] as const;
type TabId = typeof TABS[number]["id"];

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export default function CourseDetailAdmin() {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabId>("overview");

  // Redirect nếu không có courseId
  useEffect(() => {
    if (!courseId) navigate("/admin/courses");
  }, [courseId, navigate]);

  // ── Data hooks (dùng courseId từ params) ────────────────────────────────
  const { data: course, loading: courseLoading, error: courseError, lastUpdated, refetch } =
    useDocument<Course>("courses", courseId ?? "", MOCK_COURSE, 900);

  const { count: enrollCount, loading: enrollLoading } = useEnrollmentCount(courseId ?? "");
  const { reviews, avgRating, loading: reviewsLoading } = useCourseReviews(courseId ?? "");

  // Derived stats
  const stats = useMemo(() => {
    if (!course) return null;
    const lessons  = totalLessonsCount(course.modules);
    const xp       = course.modules.reduce((s, m) => s + m.lessons.reduce((ls, l) => ls + l.xpReward, 0), 0);
    const estRev   = (enrollCount ?? course.enrollments) * course.price;
    return { lessons, xp, estRev };
  }, [course, enrollCount]);

  // ─────────────────────────────────────────────────────────────────────
  // LOADING STATE
  // ─────────────────────────────────────────────────────────────────────
  if (courseLoading) {
    return (
      <div style={{ minHeight: "100vh", background: "#0F0F1A", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Inter,sans-serif" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 18 }}>
          <div style={{ width: 56, height: 56, borderRadius: "50%", background: "rgba(108,99,255,.15)", border: "1px solid rgba(108,99,255,.3)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Loader size={26} color="#6C63FF" style={{ animation: "spin .8s linear infinite" }} />
          </div>
          <p style={{ fontSize: 15, fontWeight: 600, color: "#C7C4D8" }}>Loading from Firestore…</p>
          <code style={{ fontSize: 11, color: "#9B59B6" }}>courses/{courseId}</code>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────
  // ERROR STATE
  // ─────────────────────────────────────────────────────────────────────
  if (courseError || !course) {
    return (
      <div style={{ minHeight: "100vh", background: "#0F0F1A", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Inter,sans-serif" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, textAlign: "center" }}>
          <div style={{ width: 60, height: 60, borderRadius: "50%", background: "rgba(255,180,171,.12)", border: "1px solid rgba(255,180,171,.3)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <AlertTriangle size={28} color="#ffb4ab" />
          </div>
          <p style={{ fontSize: 16, fontWeight: 700, color: "#E4E1EE" }}>Course not found</p>
          <p style={{ fontSize: 13, color: "#C7C4D8" }}>{courseError?.message ?? "The requested course does not exist in Firestore."}</p>
          <button onClick={refetch} style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 20px", borderRadius: 12, fontSize: 13, fontWeight: 700, cursor: "pointer", background: "linear-gradient(135deg,#6C63FF,#9B59B6)", border: "none", color: "#fff" }}>
            <RefreshCw size={14} /> Retry
          </button>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────
  // MAIN RENDER
  // ─────────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: "100vh", background: "#0F0F1A", color: "#E4E1EE", fontFamily: "Inter,sans-serif", backgroundImage: "radial-gradient(circle at 5% 0%, rgba(108,99,255,.06) 0%, transparent 55%), radial-gradient(circle at 90% 100%, rgba(0,212,170,.04) 0%, transparent 55%)" }}>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        @keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}
        @keyframes fadeDown{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:translateY(0)}}
        @keyframes spin{to{transform:rotate(360deg)}}
        input,select,textarea,button{font-family:Inter,sans-serif;}
        ::-webkit-scrollbar{width:5px;height:5px;} ::-webkit-scrollbar-track{background:#0F0F1A;} ::-webkit-scrollbar-thumb{background:#2a292d;border-radius:10px;}
      `}</style>

      {/* ── STICKY HEADER ──────────────────────────────────────────────── */}
      <header style={{ position: "sticky", top: 0, zIndex: 50, background: "rgba(15,15,26,.92)", backdropFilter: "blur(18px)", borderBottom: "1px solid rgba(255,255,255,.06)" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "12px 24px", display: "flex", alignItems: "center", gap: 16 }}>
          <button onClick={() => navigate("/admin/courses")} style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.08)", borderRadius: 10, padding: "8px 14px", color: "#C7C4D8", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            <ArrowLeft size={14} /> Courses
          </button>

          {/* Breadcrumb */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#C7C4D8" }}>
            <span>Admin</span>
            <ChevronRight size={13} />
            <span>Courses</span>
            <ChevronRight size={13} />
            <span style={{ color: "#e3dfff", fontWeight: 600, maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{course.title}</span>
          </div>

          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12 }}>
            {lastUpdated && (
              <span style={{ fontSize: 11, color: "#45f1c5", display: "flex", alignItems: "center", gap: 5, fontWeight: 700 }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#45f1c5", display: "inline-block", animation: "pulse2 2s infinite" }} />
                Live · {lastUpdated.toLocaleTimeString()}
              </span>
            )}
            <button onClick={refetch} style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 10, fontSize: 12, fontWeight: 600, cursor: "pointer", background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.08)", color: "#C7C4D8" }}>
              <RefreshCw size={13} /> Refresh
            </button>
          </div>
        </div>
      </header>

      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "28px 24px", display: "flex", flexDirection: "column", gap: 24 }}>

        {/* ── COURSE INFO ──────────────────────────────────────────────── */}
        <Section title="Course Details" subtitle={`Firestore doc · courses/${course.id}`} icon={GraduationCap}
          action={
            <span style={{ fontSize: 11, color: "#9B59B6", display: "flex", alignItems: "center", gap: 5 }}>
              <Activity size={12} /> Updated {fmtDate(course.updatedAt)}
            </span>
          }
        >
          <CourseInfo course={course} onEdit={() => navigate(`/admin/courses/${courseId}/edit`)} />
        </Section>

        {/* ── STATS GRID ───────────────────────────────────────────────── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 14 }}>
          <StatsBadge icon={Users}     label="Enrolled" value={enrollLoading ? "…" : fmtNum(enrollCount ?? 0)} sub="Firestore count()" accent="#45f1c5" glow="rgba(69,241,197,.08)" loading={enrollLoading} />
          <StatsBadge icon={Star}      label="Rating"   value={`${course.rating}/5`} sub={`${fmtNum(course.ratingCount)} reviews`} accent="#FFB785" glow="rgba(255,183,133,.08)" />
          <StatsBadge icon={DollarSign} label="Revenue" value={`$${fmtNum((enrollCount ?? course.enrollments) * course.price)}`} sub="Total estimated" accent="#6C63FF" glow="rgba(108,99,255,.1)" loading={enrollLoading} />
          <StatsBadge icon={CheckCircle} label="Completion" value={`${course.completionRate}%`} sub="Average rate" accent="#00D4AA" />
          <StatsBadge icon={Zap}       label="Total XP"  value={`+${fmtNum(stats?.xp ?? 0)}`} sub="Per completion" accent="#c4c0ff" />
        </div>

        {/* ── TAB BAR ──────────────────────────────────────────────────── */}
        <div style={{ display: "flex", gap: 4, background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.06)", borderRadius: 14, padding: 5 }}>
          {TABS.map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              style={{
                flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                padding: "10px 14px", borderRadius: 10, fontSize: 13, fontWeight: 700,
                cursor: "pointer", transition: "all .2s",
                background: activeTab === id ? "linear-gradient(135deg,#6C63FF,#9B59B6)" : "transparent",
                border: activeTab === id ? "1px solid rgba(108,99,255,.3)" : "1px solid transparent",
                color: activeTab === id ? "#fff" : "#C7C4D8",
                boxShadow: activeTab === id ? "0 0 16px rgba(108,99,255,.25)" : "none",
              }}
            >
              <Icon size={14} /> {label}
            </button>
          ))}
        </div>

        {/* ── TAB CONTENT ──────────────────────────────────────────────── */}

        {activeTab === "overview" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 20, animation: "fadeDown .25s ease" }}>
            {/* Instructor card */}
            <Section title="Instructor" subtitle="Linked via instructorId field in Firestore" icon={Award}>
              {course.instructor && (
                <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                  <div style={{ width: 56, height: 56, borderRadius: "50%", background: "linear-gradient(135deg,#6C63FF,#9B59B6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, fontWeight: 800, color: "#fff", flexShrink: 0, boxShadow: "0 0 20px rgba(108,99,255,.28)" }}>
                    {course.instructor.name.charAt(0)}
                  </div>
                  <div style={{ flex: 1 }}>
                    <h4 style={{ fontSize: 16, fontWeight: 800, color: "#E4E1EE", marginBottom: 4 }}>{course.instructor.name}</h4>
                    <p style={{ fontSize: 13, color: "#C7C4D8", marginBottom: 10 }}>{course.instructor.title}</p>
                    <div style={{ display: "flex", gap: 16 }}>
                      {[
                        { Icon: BookOpen, val: `${course.instructor.totalCourses} courses` },
                        { Icon: Users,    val: `${fmtNum(course.instructor.totalStudents)} students` },
                      ].map(({ Icon, val }) => (
                        <span key={val} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#C7C4D8" }}>
                          <Icon size={13} /> {val}
                        </span>
                      ))}
                    </div>
                  </div>
                  <button style={{ padding: "8px 18px", borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: "pointer", background: "rgba(108,99,255,.1)", border: "1px solid rgba(108,99,255,.25)", color: "#c4c0ff" }}>
                    View Profile
                  </button>
                </div>
              )}
            </Section>

            {/* Metadata sidebar */}
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <Section title="Metadata" icon={Info}>
                {[
                  ["Course ID",   course.id],
                  ["Status",      course.status],
                  ["Category",    course.category],
                  ["Level",       course.level.replace("_", " ")],
                  ["Language",    course.language],
                  ["Price",       fmtMoney(course.price)],
                  ["Modules",     course.modules.length],
                  ["Created",     fmtDate(course.createdAt)],
                  ["Updated",     fmtDate(course.updatedAt)],
                ].map(([k, v]) => (
                  <div key={k as string} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 0", borderBottom: "1px solid rgba(255,255,255,.05)" }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "#C7C4D8", textTransform: "uppercase", letterSpacing: ".06em" }}>{k}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "#E4E1EE" }}>{v}</span>
                  </div>
                ))}
              </Section>
            </div>
          </div>
        )}

        {activeTab === "curriculum" && (
          <div style={{ animation: "fadeDown .25s ease" }}>
            <Section title="Curriculum" subtitle={`${course.modules.length} modules · ${totalLessonsCount(course.modules)} lessons · ${course.totalDurationHours}h · Stored in Firestore modules[]`} icon={BookOpen}>
              <ModuleAccordion modules={course.modules} courseId={course.id} />
            </Section>
          </div>
        )}

        {activeTab === "analytics" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20, animation: "fadeDown .25s ease" }}>
            <Section title="Enrollment Trend" subtitle="6-month enrollment and revenue data · Firestore aggregation" icon={TrendingUp}>
              <EnrollmentChart data={MOCK_ENROLLMENT_TREND} />
            </Section>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
              <Section title="Rating Distribution" subtitle="From reviews collection" icon={Star}>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {MOCK_RATING_DIST.map(({ stars, count }) => {
                    const total = MOCK_RATING_DIST.reduce((s, r) => s + r.count, 0);
                    const pct = Math.round((count / total) * 100);
                    return (
                      <div key={stars} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: "#FFB785", width: 12, textAlign: "right" }}>{stars}</span>
                        <Star size={11} color="#FFB785" fill="#FFB785" />
                        <div style={{ flex: 1, height: 8, borderRadius: 99, background: "rgba(255,255,255,.07)", overflow: "hidden" }}>
                          <div style={{ height: "100%", width: `${pct}%`, background: "linear-gradient(90deg,#FFB785,#FF8C42)", borderRadius: 99 }} />
                        </div>
                        <span style={{ fontSize: 11, color: "#C7C4D8", width: 28 }}>{count}</span>
                        <span style={{ fontSize: 11, color: "#47464f", width: 30 }}>{pct}%</span>
                      </div>
                    );
                  })}
                </div>
              </Section>

              <Section title="Completion Funnel" subtitle="Lesson-by-lesson dropout" icon={Activity}>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={course.modules.map((m, i) => ({ name: `M${i + 1}`, rate: 95 - i * 8 }))} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.04)" vertical={false} />
                    <XAxis dataKey="name" tick={{ fill: "#C7C4D8", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "#C7C4D8", fontSize: 11 }} axisLine={false} tickLine={false} unit="%" />
                    <Tooltip contentStyle={{ background: "rgba(26,26,46,.97)", border: "1px solid rgba(255,255,255,.08)", borderRadius: 10, fontSize: 12 }} formatter={(v: number) => [`${v}%`, "Completion"]} />
                    <Bar dataKey="rate" fill="url(#barGrad)" radius={[6, 6, 0, 0]} />
                    <defs>
                      <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%"   stopColor="#6C63FF" />
                        <stop offset="100%" stopColor="#9B59B6" stopOpacity={.7} />
                      </linearGradient>
                    </defs>
                  </BarChart>
                </ResponsiveContainer>
              </Section>
            </div>
          </div>
        )}

        {activeTab === "reviews" && (
          <div style={{ animation: "fadeDown .25s ease" }}>
            <Section title="Reviews" subtitle={`${fmtNum(course.ratingCount)} total · Firestore: reviews where courseId == "${courseId}"`} icon={MessageSquare}>
              {reviewsLoading
                ? (
                  <div style={{ display: "flex", justifyContent: "center", padding: 40 }}>
                    <Loader size={28} color="#6C63FF" style={{ animation: "spin .8s linear infinite" }} />
                  </div>
                )
                : <ReviewsPanel reviews={reviews} avgRating={avgRating} ratingDist={MOCK_RATING_DIST} />
              }
            </Section>
          </div>
        )}

      </div>
    </div>
  );
}
/**
 * Smart Review — Admin / Instructor Course Detail View
 * React + TypeScript + Firebase SDK v9+
 *
 * File: src/pages/admin/courses/CourseDetailAdmin.tsx
 *
 * Route: /admin/courses/:courseId
 * 
 * - Admin: xem tất cả.
 * - Instructor: chỉ xem được nếu instructorId == uid.
 * 
 * ✅ Đã cập nhật LessonType (loại bỏ assignment)
 * ✅ Đã import LinkIcon
 */

"use client";

import React, { useState, useEffect, useMemo, type ReactNode } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Timestamp, collection, query, where, getDocs, orderBy, limit } from "firebase/firestore";
import { db } from "../../../utils/config";
import { useAuth } from "../../../contexts/AuthContext";

// ─── Import custom hooks từ thư mục hooks ─────────────────────────────────────
import { useDocument, useCollection } from "../../../hooks/useFirestore";

// ─── Recharts ────────────────────────────────────────────────────────────────
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
  BarChart, Bar,
} from "recharts";

// ─── Lucide icons ─────────────────────────────────────────────────────────────
import {
  ArrowLeft, Edit3, Trash2, Share2, ExternalLink,
  Star, Clock, Users, BookOpen, Play, FileText,
  Zap, BarChart2, Tag, Globe, Calendar, ChevronDown,
  ChevronRight, CheckCircle, Eye, EyeOff, PauseCircle,
  TrendingUp, Award, MessageSquare, RefreshCw, AlertTriangle,
  Loader, Video, Layers, DollarSign, Activity,
  Copy, Info, GraduationCap,
  Link as LinkIcon, // ✅ đã thêm
} from "lucide-react";

// ─── Import services ─────────────────────────────────────────────────────────
import { getEnrollmentCount } from "../../../services/enrollmentService";

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

type CourseStatus = "published" | "draft" | "archived";
type CourseLevel = "beginner" | "intermediate" | "advanced" | "all_levels";
type LessonType = "video" | "quiz" | "reading" | "flashcard"; // ✅ đã loại bỏ "assignment"

interface Lesson {
  id: string;
  title: string;
  type: LessonType;
  duration: number;
  videoUrl?: string;
  xpReward: number;
  isFree: boolean;
  order: number;
  // 🆕 Các trường mới (đọc từ Firestore)
  releaseAt?: string | Date;
  prerequisites?: string[];
}

interface Module {
  id: string;
  title: string;
  order: number;
  lessons: Lesson[];
}

interface Review {
  id: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  rating: number;
  content: string;
  createdAt: any;
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
  rating: number;
  ratingCount: number;
  enrollments: number;
  totalDurationHours: number;
  createdAt: any;
  updatedAt: any;
  xpTotal: number;
  completionRate: number;
  instructorId?: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS (xử lý an toàn Timestamp)
// ═══════════════════════════════════════════════════════════════════════════

const toDate = (value: unknown): Date => {
  if (value instanceof Date) return value;
  if (value instanceof Timestamp) return value.toDate();
  if (value && typeof value === 'object' && 'toDate' in value) return (value as Timestamp).toDate();
  return new Date();
};

const fmtNum = (n: number) => new Intl.NumberFormat("en-US", { notation: "compact" }).format(n);
const fmtMoney = (n: number) => n === 0 ? "Free" : new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(n);
const fmtDate = (d: unknown) => {
  const date = toDate(d);
  return date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
};
const fmtMins = (m: number) => m >= 60 ? `${Math.floor(m / 60)}h ${m % 60 ? m % 60 + "m" : ""}`.trim() : `${m}m`;

const totalModuleMins = (m: Module) => {
  if (!m || !m.lessons) return 0;
  return m.lessons.reduce((s, l) => s + (l?.duration || 0), 0);
};

const totalLessonsCount = (modules?: Module[]) => {
  if (!modules || !Array.isArray(modules)) return 0;
  return modules.reduce((total, module) => total + (module.lessons?.length || 0), 0);
};

const totalXPCount = (modules?: Module[]) => {
  if (!modules || !Array.isArray(modules)) return 0;
  return modules.reduce((s, m) => s + (m.lessons?.reduce((ls, l) => ls + (l?.xpReward || 0), 0) || 0), 0);
};

const LESSON_META: Record<LessonType, { label: string; color: string; bg: string; Icon: React.ElementType }> = {
  video: { label: "Video", color: "#6C63FF", bg: "rgba(108,99,255,.14)", Icon: Play },
  quiz: { label: "Quiz", color: "#45f1c5", bg: "rgba(69,241,197,.12)", Icon: Zap },
  reading: { label: "Reading", color: "#FFB785", bg: "rgba(255,183,133,.12)", Icon: BookOpen },
  flashcard: { label: "Flashcard", color: "#c4c0ff", bg: "rgba(196,192,255,.12)", Icon: Layers },
};

const STATUS_CFG: Record<CourseStatus, { label: string; color: string; bg: string; border: string; Icon: React.ElementType }> = {
  published: { label: "Published", color: "#45f1c5", bg: "rgba(69,241,197,.12)", border: "rgba(69,241,197,.28)", Icon: CheckCircle },
  draft: { label: "Draft", color: "#FFB785", bg: "rgba(255,183,133,.12)", border: "rgba(255,183,133,.28)", Icon: PauseCircle },
  archived: { label: "Archived", color: "#B0AEC0", bg: "rgba(176,174,192,.12)", border: "rgba(176,174,192,.22)", Icon: EyeOff },
};

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════

function StatsBadge({ icon: Icon, label, value, sub, accent, glow, loading }: any) {
  return (
    <div style={{
      background: "rgba(26,26,46,.65)", border: `1px solid ${accent}`,
      borderRadius: 18, padding: "18px 20px",
      backdropFilter: "blur(12px)",
      boxShadow: glow ? `0 4px 24px ${glow}` : undefined,
      transition: "transform .2s, box-shadow .2s",
      position: "relative", overflow: "hidden",
    }}
      onMouseOver={(e) => { (e.currentTarget as HTMLDivElement).style.transform = "translateY(-2px)"; }}
      onMouseOut={(e) => { (e.currentTarget as HTMLDivElement).style.transform = "translateY(0)"; }}
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
      <div style={{ position: "relative", borderRadius: 20, overflow: "hidden", aspectRatio: "16/9", background: "#0a0a15", border: "1px solid rgba(255,255,255,.07)", flexShrink: 0 }}>
        {course.thumbnailUrl ? (
          <img src={course.thumbnailUrl} alt={course.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, background: "linear-gradient(135deg,rgba(108,99,255,.12),rgba(0,212,170,.06))" }}>
            <div style={{ width: 72, height: 72, borderRadius: "50%", background: "rgba(108,99,255,.18)", border: "1px solid rgba(108,99,255,.3)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Video size={32} color="#6C63FF" />
            </div>
            <span style={{ fontSize: 13, color: "#C7C4D8", fontWeight: 600 }}>No thumbnail</span>
          </div>
        )}
        <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.35)", display: "flex", alignItems: "center", justifyContent: "center", opacity: 0, transition: "opacity .2s" }}
          onMouseOver={(e) => { (e.currentTarget as HTMLDivElement).style.opacity = "1"; }}
          onMouseOut={(e) => { (e.currentTarget as HTMLDivElement).style.opacity = "0"; }}>
          <div style={{ width: 60, height: 60, borderRadius: "50%", background: "rgba(26,26,46,.85)", backdropFilter: "blur(10px)", border: "1px solid rgba(255,255,255,.15)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 20px rgba(108,99,255,.4)" }}>
            <Play size={24} color="#e3dfff" fill="#e3dfff" />
          </div>
        </div>
        <div style={{ position: "absolute", top: 14, left: 14 }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "5px 12px", borderRadius: 999, background: cfg.bg, border: `1px solid ${cfg.border}`, color: cfg.color, fontSize: 11, fontWeight: 800, backdropFilter: "blur(8px)" }}>
            <StatusIcon size={11} /> {cfg.label}
          </span>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 10 }}>
            <h2 style={{ fontSize: 20, fontWeight: 800, color: "#E4E1EE", lineHeight: 1.35, flex: 1 }}>{course.title}</h2>
            <span style={{ fontSize: 22, fontWeight: 800, color: "#45f1c5", flexShrink: 0 }}>{fmtMoney(course.price)}</span>
          </div>
          <p style={{ fontSize: 13, color: "#C7C4D8", lineHeight: 1.6 }}>{course.description?.slice(0, 180) || "No description"}…</p>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {[
            { Icon: Tag, val: course.category },
            { Icon: BarChart2, val: course.level?.replace("_", " ") || "beginner" },
            { Icon: Globe, val: course.language },
            { Icon: Calendar, val: fmtDate(course.createdAt) },
          ].map(({ Icon, val }) => (
            <span key={val} style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 8, background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.08)", fontSize: 11, fontWeight: 600, color: "#C7C4D8" }}>
              <Icon size={11} /> {val}
            </span>
          ))}
        </div>

        {course.tags && course.tags.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {course.tags.map((t) => (
              <span key={t} style={{ padding: "3px 9px", borderRadius: 999, background: "rgba(108,99,255,.12)", border: "1px solid rgba(108,99,255,.22)", fontSize: 11, fontWeight: 700, color: "#c4c0ff" }}>
                #{t}
              </span>
            ))}
          </div>
        )}

        <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            {Array.from({ length: 5 }).map((_, i) => (
              <Star key={i} size={16} fill={i < Math.floor(course.rating || 0) ? "#FFB785" : "transparent"} color="#FFB785" />
            ))}
          </div>
          <span style={{ fontSize: 18, fontWeight: 800, color: "#FFB785" }}>{(course.rating || 0).toFixed(1)}</span>
          <span style={{ fontSize: 12, color: "#C7C4D8" }}>({fmtNum(course.ratingCount || 0)} reviews)</span>
          <span style={{ width: 4, height: 4, borderRadius: "50%", background: "#47464f", display: "inline-block" }} />
          <span style={{ fontSize: 12, color: "#C7C4D8", display: "flex", alignItems: "center", gap: 5 }}>
            <Clock size={12} /> {course.totalDurationHours || 0}h total
          </span>
          <span style={{ width: 4, height: 4, borderRadius: "50%", background: "#47464f", display: "inline-block" }} />
          <span style={{ fontSize: 12, color: "#C7C4D8", display: "flex", alignItems: "center", gap: 5 }}>
            <BookOpen size={12} /> {totalLessonsCount(course.modules)} lessons
          </span>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button onClick={onEdit} style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 20px", borderRadius: 12, fontSize: 13, fontWeight: 700, cursor: "pointer", background: "linear-gradient(135deg,#6C63FF,#9B59B6)", border: "none", color: "#fff", boxShadow: "0 0 18px rgba(108,99,255,.28)" }}>
            <Edit3 size={14} /> Edit Course
          </button>
          <button style={{ display: "flex", alignItems: "center", gap: 7, padding: "10px 16px", borderRadius: 12, fontSize: 13, fontWeight: 600, cursor: "pointer", background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.1)", color: "#C7C4D8" }}>
            <ExternalLink size={14} /> Preview
          </button>
          <button style={{ display: "flex", alignItems: "center", gap: 7, padding: "10px 16px", borderRadius: 12, fontSize: 13, fontWeight: 600, cursor: "pointer", background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.1)", color: "#C7C4D8" }}>
            <Share2 size={14} /> Share
          </button>
          <button style={{ display: "flex", alignItems: "center", gap: 7, padding: "10px 16px", borderRadius: 12, fontSize: 13, fontWeight: 600, cursor: "pointer", background: "rgba(255,180,171,.08)", border: "1px solid rgba(255,180,171,.2)", color: "#ffb4ab" }}>
            <Trash2 size={14} /> Delete
          </button>
        </div>

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
// MODULE ACCORDION
// ═══════════════════════════════════════════════════════════════════════════

function LessonRow({ lesson, index }: { lesson: Lesson; index: number }) {
  const meta = LESSON_META[lesson.type] || {
    label: lesson.type,
    color: "#C7C4D8",
    bg: "rgba(255,255,255,.05)",
    Icon: FileText,
  };
  const MetaIcon = meta.Icon;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderRadius: 12, background: "rgba(255,255,255,.022)", border: "1px solid rgba(255,255,255,.06)", transition: "background .15s", cursor: "default" }}
      onMouseOver={(e) => { (e.currentTarget as HTMLDivElement).style.background = "rgba(255,255,255,.04)"; }}
      onMouseOut={(e) => { (e.currentTarget as HTMLDivElement).style.background = "rgba(255,255,255,.022)"; }}>
      <span style={{ width: 24, height: 24, borderRadius: "50%", background: "rgba(108,99,255,.18)", border: "1px solid rgba(108,99,255,.28)", fontSize: 10, fontWeight: 800, color: "#c4c0ff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        {index + 1}
      </span>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 9px", borderRadius: 999, background: meta.bg, color: meta.color, fontSize: 10, fontWeight: 700, flexShrink: 0 }}>
        <MetaIcon size={9} /> {meta.label}
      </span>
      <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: "#E4E1EE", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {lesson.title}
      </span>
      {lesson.isFree && (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 8px", borderRadius: 999, background: "rgba(69,241,197,.1)", border: "1px solid rgba(69,241,197,.25)", fontSize: 10, fontWeight: 700, color: "#45f1c5", flexShrink: 0 }}>
          <Eye size={9} /> Free
        </span>
      )}
      {/* 🆕 Hiển thị Drip Content trong admin */}
      {lesson.releaseAt && (
        <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, color: "#FFB785", flexShrink: 0 }}>
          <Clock size={10} /> {new Date(lesson.releaseAt).toLocaleDateString()}
        </span>
      )}
      {/* 🆕 Hiển thị Prerequisites trong admin */}
      {lesson.prerequisites && lesson.prerequisites.length > 0 && (
        <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, color: "#6C63FF", flexShrink: 0 }}>
          <LinkIcon size={10} /> {lesson.prerequisites.length} req.
        </span>
      )}
      <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 700, color: "#FFB785", flexShrink: 0 }}>
        <Zap size={11} /> +{lesson.xpReward}
      </span>
      <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "#C7C4D8", flexShrink: 0, minWidth: 42 }}>
        <Clock size={11} /> {lesson.duration}m
      </span>
    </div>
  );
}

function ModuleAccordion({ modules, courseId }: { modules: Module[]; courseId: string }) {
  const [openIds, setOpenIds] = useState<Set<string>>(new Set(modules?.[0]?.id ? [modules[0].id] : []));

  const toggle = (id: string) => setOpenIds((prev) => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  if (!modules || modules.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: 40, color: "#C7C4D8" }}>
        <Layers size={32} style={{ marginBottom: 12, opacity: 0.5 }} />
        <p>No curriculum defined yet.</p>
        <button onClick={() => window.location.href = `/admin/courses/${courseId}/edit`} style={{ marginTop: 12, padding: "8px 16px", borderRadius: 10, background: "linear-gradient(135deg,#6C63FF,#9B59B6)", border: "none", color: "#fff", cursor: "pointer" }}>
          Add Modules
        </button>
      </div>
    );
  }

  const totalMins = modules.reduce((s, m) => s + totalModuleMins(m), 0);
  const totalLesson = totalLessonsCount(modules);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
        <div style={{ display: "flex", gap: 16 }}>
          <span style={{ fontSize: 12, color: "#C7C4D8", display: "flex", alignItems: "center", gap: 5 }}><Layers size={13} /> {modules.length} modules</span>
          <span style={{ fontSize: 12, color: "#C7C4D8", display: "flex", alignItems: "center", gap: 5 }}><BookOpen size={13} /> {totalLesson} lessons</span>
          <span style={{ fontSize: 12, color: "#C7C4D8", display: "flex", alignItems: "center", gap: 5 }}><Clock size={13} /> {fmtMins(totalMins)}</span>
        </div>
        <a href={`/admin/courses/${courseId}/edit`} style={{ display: "flex", alignItems: "center", gap: 7, padding: "7px 14px", borderRadius: 10, fontSize: 12, fontWeight: 700, background: "linear-gradient(135deg,#6C63FF,#9B59B6)", border: "none", color: "#fff", textDecoration: "none" }}>
          <Layers size={13} /> Manage Lessons
        </a>
      </div>

      {modules.map((mod, mIdx) => {
        const isOpen = openIds.has(mod.id);
        const mins = totalModuleMins(mod);
        return (
          <div key={mod.id} style={{ background: "rgba(26,26,46,.65)", border: "1px solid rgba(255,255,255,.07)", borderRadius: 18, overflow: "hidden", backdropFilter: "blur(12px)" }}>
            <button onClick={() => toggle(mod.id)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "14px 18px", background: "none", border: "none", cursor: "pointer", textAlign: "left" }}>
              <div style={{ width: 30, height: 30, borderRadius: 9, background: "linear-gradient(135deg,#6C63FF,#9B59B6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800, color: "#fff", flexShrink: 0, boxShadow: "0 0 10px rgba(108,99,255,.3)" }}>
                {mIdx + 1}
              </div>
              <span style={{ flex: 1, fontSize: 14, fontWeight: 700, color: "#E4E1EE" }}>{mod.title || `Module ${mIdx + 1}`}</span>
              <span style={{ fontSize: 11, color: "#C7C4D8", display: "flex", alignItems: "center", gap: 10, flexShrink: 0, marginRight: 8 }}>
                <span style={{ display: "flex", alignItems: "center", gap: 4 }}><BookOpen size={11} /> {mod.lessons?.length || 0}</span>
                <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Clock size={11} /> {fmtMins(mins)}</span>
              </span>
              <div style={{ color: "#C7C4D8", transition: "transform .25s", transform: isOpen ? "rotate(0deg)" : "rotate(-90deg)" }}>
                <ChevronDown size={16} />
              </div>
            </button>

            {isOpen && mod.lessons && mod.lessons.length > 0 && (
              <div style={{ padding: "0 14px 14px", display: "flex", flexDirection: "column", gap: 7 }}>
                {mod.lessons.map((lesson, lIdx) => (<LessonRow key={lesson.id} lesson={lesson} index={lIdx} />))}
              </div>
            )}
            {isOpen && (!mod.lessons || mod.lessons.length === 0) && (
              <div style={{ padding: "0 14px 14px", textAlign: "center", color: "#C7C4D8", fontSize: 12 }}>
                No lessons yet. Edit course to add lessons.
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// REVIEWS PANEL (Dùng dữ liệu thật từ Firestore)
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

function ReviewsPanel({ courseId }: { courseId: string }) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [avgRating, setAvgRating] = useState(0);
  const [ratingDist, setRatingDist] = useState<{ stars: number; count: number }[]>([
    { stars: 5, count: 0 }, { stars: 4, count: 0 }, { stars: 3, count: 0 }, { stars: 2, count: 0 }, { stars: 1, count: 0 }
  ]);

  useEffect(() => {
    if (!courseId) return;

    const fetchReviews = async () => {
      setLoading(true);
      try {
        const q = query(
          collection(db, "reviews"),
          where("courseId", "==", courseId),
          orderBy("createdAt", "desc")
        );
        const snapshot = await getDocs(q);
        const reviewList: Review[] = [];
        const dist = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
        let totalRating = 0;

        snapshot.forEach((doc) => {
          const data = doc.data();
          const rating = data.rating || 0;
          reviewList.push({
            id: doc.id,
            userId: data.userId,
            userName: data.userName || "Anonymous",
            rating,
            content: data.content || "",
            createdAt: data.createdAt,
            helpful: data.helpful || 0,
          });
          totalRating += rating;
          dist[rating as keyof typeof dist]++;
        });

        setReviews(reviewList);
        setAvgRating(reviewList.length ? totalRating / reviewList.length : 0);
        setRatingDist([
          { stars: 5, count: dist[5] },
          { stars: 4, count: dist[4] },
          { stars: 3, count: dist[3] },
          { stars: 2, count: dist[2] },
          { stars: 1, count: dist[1] },
        ]);
      } catch (err) {
        console.error("Error fetching reviews:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchReviews();
  }, [courseId]);

  const total = ratingDist.reduce((s, r) => s + r.count, 0);

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: 40 }}>
        <Loader size={28} color="#6C63FF" style={{ animation: "spin 0.8s linear infinite" }} />
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 24, alignItems: "start" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16, position: "sticky", top: 0 }}>
        <div style={{ textAlign: "center", padding: "20px 16px", background: "rgba(255,255,255,.025)", borderRadius: 16, border: "1px solid rgba(255,255,255,.07)" }}>
          <div style={{ fontSize: 52, fontWeight: 900, color: "#FFB785", lineHeight: 1 }}>{avgRating.toFixed(1)}</div>
          <StarRating rating={avgRating} size={18} />
          <p style={{ fontSize: 12, color: "#C7C4D8", marginTop: 8 }}>{total.toLocaleString()} ratings</p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
          {[5, 4, 3, 2, 1].map((stars) => {
            const entry = ratingDist.find((r) => r.stars === stars);
            const pct = entry && total ? Math.round((entry.count / total) * 100) : 0;
            return (
              <div key={stars} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11 }}>
                <span style={{ color: "#FFB785", fontWeight: 700, width: 14, textAlign: "right", flexShrink: 0 }}>{stars}</span>
                <Star size={10} color="#FFB785" fill="#FFB785" />
                <div style={{ flex: 1, height: 7, borderRadius: 99, background: "rgba(255,255,255,.08)", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${pct}%`, background: "linear-gradient(90deg,#FFB785,#FF8C42)", borderRadius: 99 }} />
                </div>
                <span style={{ color: "#C7C4D8", width: 30, textAlign: "right", flexShrink: 0 }}>{pct}%</span>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {reviews.length === 0 ? (
          <div style={{ textAlign: "center", padding: 40, color: "#C7C4D8" }}>
            <MessageSquare size={32} style={{ marginBottom: 12, opacity: 0.5 }} />
            <p>No reviews yet.</p>
          </div>
        ) : (
          reviews.map((r) => (
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
              <p style={{ fontSize: 13, color: "#C7C4D8", lineHeight: 1.6 }}>{r.content}</p>
              <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 10, fontSize: 11, color: "#47464f" }}>
                <Award size={11} /> {r.helpful} found helpful
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ENROLLMENT CHART (Dùng dữ liệu thật từ enrollments)
// ═══════════════════════════════════════════════════════════════════════════

const ChartTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "rgba(26,26,46,.97)", border: "1px solid rgba(255,255,255,.08)", borderRadius: 12, padding: "10px 14px", fontSize: 12 }}>
      <p style={{ color: "#C7C4D8", marginBottom: 6, fontWeight: 700 }}>{label}</p>
      <p style={{ color: "#45f1c5" }}>+{payload[0]?.value} students</p>
    </div>
  );
};

function EnrollmentChart({ courseId }: { courseId: string }) {
  const [data, setData] = useState<{ date: string; count: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!courseId) return;

    const fetchEnrollments = async () => {
      setLoading(true);
      try {
        const q = query(
          collection(db, "enrollments"),
          where("courseId", "==", courseId),
          where("isActive", "==", true),
          orderBy("enrolledAt", "desc")
        );
        const snapshot = await getDocs(q);
        const monthlyMap = new Map<string, number>();
        const now = new Date();

        for (let i = 5; i >= 0; i--) {
          const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
          const key = date.toLocaleString("default", { month: "short" });
          monthlyMap.set(key, 0);
        }

        snapshot.forEach((doc) => {
          const enrolledAt = doc.data().enrolledAt?.toDate();
          if (enrolledAt) {
            const key = enrolledAt.toLocaleString("default", { month: "short" });
            if (monthlyMap.has(key)) {
              monthlyMap.set(key, (monthlyMap.get(key) || 0) + 1);
            }
          }
        });

        const chartData = Array.from(monthlyMap.entries()).map(([date, count]) => ({ date, count }));
        setData(chartData);
      } catch (err) {
        console.error("Error fetching enrollments:", err);
        setData([]);
      } finally {
        setLoading(false);
      }
    };

    fetchEnrollments();
  }, [courseId]);

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: 40 }}>
        <Loader size={24} color="#6C63FF" style={{ animation: "spin 0.8s linear infinite" }} />
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "#C7C4D8" }}>
          <span style={{ width: 10, height: 10, borderRadius: 2, background: "#45f1c5", display: "inline-block" }} /> Enrollments
        </div>
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={data} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
          <defs>
            <linearGradient id="gEnroll" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#45f1c5" stopOpacity={.3} />
              <stop offset="95%" stopColor="#45f1c5" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.04)" vertical={false} />
          <XAxis dataKey="date" tick={{ fill: "#C7C4D8", fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: "#C7C4D8", fontSize: 11 }} axisLine={false} tickLine={false} />
          <Tooltip content={<ChartTooltip />} cursor={{ stroke: "rgba(255,255,255,.08)", strokeWidth: 1 }} />
          <Area type="monotone" dataKey="count" stroke="#45f1c5" strokeWidth={2} fill="url(#gEnroll)" dot={false} activeDot={{ r: 5, fill: "#45f1c5", stroke: "#0F0F1A", strokeWidth: 2 }} />
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
  { id: "overview", label: "Overview", Icon: Info },
  { id: "curriculum", label: "Curriculum", Icon: BookOpen },
  { id: "analytics", label: "Analytics", Icon: TrendingUp },
  { id: "reviews", label: "Reviews", Icon: MessageSquare },
] as const;
type TabId = typeof TABS[number]["id"];

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export default function CourseDetailAdmin() {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const { currentUser, role } = useAuth();
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [enrollCount, setEnrollCount] = useState<number | null>(null);
  const [enrollLoading, setEnrollLoading] = useState(true);

  useEffect(() => {
    if (!courseId) navigate("/admin/courses");
  }, [courseId, navigate]);

  const { data: rawData, loading: courseLoading, error: courseError, refetch } = useDocument<any>("courses", courseId ?? null);

  // Fetch real enrollment count
  useEffect(() => {
    const fetchEnrollCount = async () => {
      if (!courseId) return;
      setEnrollLoading(true);
      const count = await getEnrollmentCount(courseId);
      setEnrollCount(count);
      setEnrollLoading(false);
    };
    fetchEnrollCount();
  }, [courseId]);

  // Chuyển đổi dữ liệu từ Firestore
  const course = rawData ? {
    id: rawData.id,
    title: rawData.title || "Untitled",
    description: rawData.description || "",
    price: rawData.price || 0,
    category: rawData.category || "Uncategorized",
    level: rawData.level || "beginner",
    status: rawData.status || "draft",
    thumbnailUrl: rawData.thumbnailUrl || "",
    language: rawData.language || "English",
    tags: rawData.tags || [],
    modules: rawData.modules || [],
    rating: rawData.rating || 0,
    ratingCount: rawData.ratingCount || 0,
    enrollments: rawData.enrollments || 0,
    totalDurationHours: rawData.totalDurationHours || 0,
    completionRate: rawData.completionRate || 0,
    xpTotal: rawData.xpTotal || 0,
    createdAt: toDate(rawData.createdAt),
    updatedAt: toDate(rawData.updatedAt),
    instructorId: rawData.instructorId || undefined,
  } : null;

  // 👇 Kiểm tra quyền truy cập
  if (course && role !== "admin" && course.instructorId !== currentUser?.uid) {
    return (
      <div style={{ minHeight: "100vh", background: "#0F0F1A", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Inter,sans-serif" }}>
        <div style={{ textAlign: "center", maxWidth: 400 }}>
          <div style={{ width: 64, height: 64, borderRadius: "50%", background: "rgba(255,180,171,.12)", border: "1px solid rgba(255,180,171,.3)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
            <AlertTriangle size={28} color="#ffb4ab" />
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "#E4E1EE", marginBottom: 10 }}>Access Denied</h1>
          <p style={{ fontSize: 13, color: "#C7C4D8", lineHeight: 1.6 }}>
            You do not have permission to view this course. Only the instructor who created it can access it.
          </p>
          <button onClick={() => navigate("/admin/courses")} style={{ marginTop: 20, padding: "10px 28px", borderRadius: 14, fontSize: 14, fontWeight: 700, cursor: "pointer", background: "linear-gradient(135deg,#6C63FF,#9B59B6)", border: "none", color: "#fff" }}>
            ← Back to Courses
          </button>
        </div>
      </div>
    );
  }

  const stats = useMemo(() => {
    if (!course) return null;
    const lessons = totalLessonsCount(course.modules);
    const xp = totalXPCount(course.modules);
    const estRev = (enrollCount ?? course.enrollments ?? 0) * (course.price || 0);
    return { lessons, xp, estRev };
  }, [course, enrollCount]);

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

  return (
    <div style={{ minHeight: "100vh", background: "#0F0F1A", color: "#E4E1EE", fontFamily: "Inter,sans-serif" }}>
      <style>{`
        @keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}
        @keyframes fadeDown{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:translateY(0)}}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes pulse2{0%{opacity:0.4} 50%{opacity:1} 100%{opacity:0.4}}
      `}</style>

      <header style={{ position: "sticky", top: 0, zIndex: 50, background: "rgba(15,15,26,.92)", backdropFilter: "blur(18px)", borderBottom: "1px solid rgba(255,255,255,.06)" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "12px 24px", display: "flex", alignItems: "center", gap: 16 }}>
          <button onClick={() => navigate("/admin/courses")} style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.08)", borderRadius: 10, padding: "8px 14px", color: "#C7C4D8", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            <ArrowLeft size={14} /> Courses
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#C7C4D8" }}>
            <span>Admin</span>
            <ChevronRight size={13} />
            <span>Courses</span>
            <ChevronRight size={13} />
            <span style={{ color: "#e3dfff", fontWeight: 600, maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{course.title}</span>
          </div>
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 11, color: "#45f1c5", display: "flex", alignItems: "center", gap: 5, fontWeight: 700 }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#45f1c5", display: "inline-block", animation: "pulse2 2s infinite" }} />
              Live · {fmtDate(course.updatedAt)}
            </span>
            <button onClick={refetch} style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 10, fontSize: 12, fontWeight: 600, cursor: "pointer", background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.08)", color: "#C7C4D8" }}>
              <RefreshCw size={13} /> Refresh
            </button>
          </div>
        </div>
      </header>

      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "28px 24px", display: "flex", flexDirection: "column", gap: 24 }}>
        <Section title="Course Details" subtitle={`Firestore doc · courses/${course.id}`} icon={GraduationCap} action={
          <span style={{ fontSize: 11, color: "#9B59B6", display: "flex", alignItems: "center", gap: 5 }}>
            <Activity size={12} /> Updated {fmtDate(course.updatedAt)}
          </span>
        }>
          <CourseInfo course={course} onEdit={() => navigate(`/admin/courses/${courseId}/edit`)} />
        </Section>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 14 }}>
          <StatsBadge icon={Users} label="Enrolled" value={enrollLoading ? "…" : fmtNum(enrollCount ?? 0)} sub="Firestore count()" accent="#45f1c5" glow="rgba(69,241,197,.08)" loading={enrollLoading} />
          <StatsBadge icon={Star} label="Rating" value={`${(course.rating || 0).toFixed(1)}/5`} sub={`${fmtNum(course.ratingCount || 0)} reviews`} accent="#FFB785" glow="rgba(255,183,133,.08)" />
          <StatsBadge icon={DollarSign} label="Revenue" value={`$${fmtNum(stats?.estRev || 0)}`} sub="Total estimated" accent="#6C63FF" glow="rgba(108,99,255,.1)" loading={enrollLoading} />
          <StatsBadge icon={CheckCircle} label="Completion" value={`${course.completionRate || 0}%`} sub="Average rate" accent="#00D4AA" />
          <StatsBadge icon={Zap} label="Total XP" value={`+${fmtNum(stats?.xp || 0)}`} sub="Per completion" accent="#c4c0ff" />
        </div>

        <div style={{ display: "flex", gap: 4, background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.06)", borderRadius: 14, padding: 5 }}>
          {TABS.map(({ id, label, Icon }) => (
            <button key={id} onClick={() => setActiveTab(id)} style={{
              flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              padding: "10px 14px", borderRadius: 10, fontSize: 13, fontWeight: 700,
              cursor: "pointer", transition: "all .2s",
              background: activeTab === id ? "linear-gradient(135deg,#6C63FF,#9B59B6)" : "transparent",
              border: activeTab === id ? "1px solid rgba(108,99,255,.3)" : "1px solid transparent",
              color: activeTab === id ? "#fff" : "#C7C4D8",
              boxShadow: activeTab === id ? "0 0 16px rgba(108,99,255,.25)" : "none",
            }}>
              <Icon size={14} /> {label}
            </button>
          ))}
        </div>

        {activeTab === "overview" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 20, animation: "fadeDown .25s ease" }}>

            {/* 👈 CỘT TRÁI: Instructor Section (chỉ hiển thị nếu không có instructor) */}
            {!course.instructorId && (
              <Section title="Instructor" subtitle="Linked via instructorId field in Firestore" icon={Award}>
                <div style={{ textAlign: "center", padding: 20, color: "#C7C4D8" }}>
                  <Award size={32} style={{ marginBottom: 12, opacity: 0.5 }} />
                  <p>No instructor assigned yet.</p>
                </div>
              </Section>
            )}

            {/* 👈 CỘT PHẢI: Metadata Section (LUÔN hiển thị) */}
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <Section title="Metadata" icon={Info}>
                {[
                  ["Course ID", course.id],
                  ["Status", course.status],
                  ["Category", course.category],
                  ["Level", course.level?.replace("_", " ") || "beginner"],
                  ["Language", course.language],
                  ["Price", fmtMoney(course.price)],
                  ["Modules", course.modules?.length || 0],
                  ["Created", fmtDate(course.createdAt)],
                  ["Updated", fmtDate(course.updatedAt)],
                  ["Instructor ID", course.instructorId || "—"],
                  [
                    "Community",
                    rawData?.enableCommunity ? (
                      rawData?.communityRoomId ? (
                        <a href={`/chat/${rawData.communityRoomId}`} target="_blank" rel="noopener noreferrer" style={{ color: "#6C63FF", textDecoration: "none", display: "flex", alignItems: "center", gap: 4 }}>
                          <ExternalLink size={12} /> Open Chat
                        </a>
                      ) : (
                        <span style={{ color: "#FFB785" }}>Not created yet</span>
                      )
                    ) : (
                      <span style={{ color: "#B0AEC0" }}>Disabled</span>
                    )
                  ],
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
            <Section title="Curriculum" subtitle={`${course.modules?.length || 0} modules · ${totalLessonsCount(course.modules)} lessons · ${course.totalDurationHours || 0}h`} icon={BookOpen}>
              <ModuleAccordion modules={course.modules || []} courseId={course.id} />
            </Section>
          </div>
        )}

        {activeTab === "analytics" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20, animation: "fadeDown .25s ease" }}>
            <Section title="Enrollment Trend" subtitle="Monthly enrollment data" icon={TrendingUp}>
              <EnrollmentChart courseId={course.id} />
            </Section>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
              <Section title="Rating Distribution" subtitle="From reviews collection" icon={Star}>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <p style={{ fontSize: 12, color: "#C7C4D8", textAlign: "center", padding: 20 }}>
                    Loading rating distribution...
                  </p>
                </div>
              </Section>
              <Section title="Completion Funnel" subtitle="Lesson-by-lesson dropout" icon={Activity}>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart
                    data={course.modules?.map((_: any, i: number) => ({ name: `M${i + 1}`, rate: 95 - i * 8 })) || []}
                    margin={{ top: 4, right: 4, left: -20, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.04)" vertical={false} />
                    <XAxis dataKey="name" tick={{ fill: "#C7C4D8", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "#C7C4D8", fontSize: 11 }} axisLine={false} tickLine={false} unit="%" />
                    <Tooltip contentStyle={{ background: "rgba(26,26,46,.97)", border: "1px solid rgba(255,255,255,.08)", borderRadius: 10, fontSize: 12 }} formatter={(v: number) => [`${v}%`, "Completion"]} />
                    <Bar dataKey="rate" fill="url(#barGrad)" radius={[6, 6, 0, 0]} />
                    <defs>
                      <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#6C63FF" />
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
            <Section title="Reviews" subtitle={`Firestore: reviews where courseId == "${courseId}"`} icon={MessageSquare}>
              <ReviewsPanel courseId={course.id} />
            </Section>
          </div>
        )}
      </div>
    </div>
  );
}
/**
 * Smart Review — Admin Course Form (Add / Edit)
 * React + TypeScript + Firebase SDK v9+
 *
 * File: src/pages/admin/courses/CourseFormAdmin.tsx
 *
 * Usage:
 *   /admin/courses/new       → tạo mới
 *   /admin/courses/:courseId/edit → chỉnh sửa
 *
 * Dependencies: firebase, lucide-react, react-markdown (cho preview)
 */

"use client";

import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  lazy,
  Suspense,
  type DragEvent,
} from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  doc,
  updateDoc,
  addDoc,
  collection,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../../../utils/config";

// ─── Import custom hooks từ thư mục hooks ─────────────────────────────
import { useDocument } from "../../../hooks/useFirestore";

// ─── Lucide icons ────────────────────────────────────────────────────────────
import {
  ArrowLeft,
  Save,
  GraduationCap,
  Tag,
  DollarSign,
  BarChart2,
  FileText,
  Image,
  Plus,
  Trash2,
  GripVertical,
  ChevronDown,
  ChevronRight,
  Clock,
  AlertCircle,
  CheckCircle,
  Upload,
  X,
  BookOpen,
  Play,
  Eye,
  EyeOff,
  Loader,
  Layers,
  Zap,
  Info,
  PauseCircle,
} from "lucide-react";

// ─── Editor components lazy load ─────────────────────────────────────
// NẾU các editor được export default, dùng:
// const QuizEditor = lazy(() => import("../../../components/admin/QuizEditor"));
// NẾU các editor được export named (ví dụ: export const QuizEditor = ...), dùng:
const QuizEditor = lazy(() =>
  import("../../../components/admin/QuizEditor").then((module) => ({
    default: module.QuizEditor,
  }))
);
const ReadingEditor = lazy(() =>
  import("../../../components/admin/ReadingEditor").then((module) => ({
    default: module.ReadingEditor,
  }))
);
const FlashcardEditor = lazy(() =>
  import("../../../components/admin/FlashcardEditor").then((module) => ({
    default: module.FlashcardEditor,
  }))
);

// Định nghĩa kiểu dữ liệu cho các props của editor (dùng chung)
type QuizEditorProps = {
  questions: any[];
  onChange: (questions: any[]) => void;
};
type ReadingEditorProps = {
  markdown: string;
  onChange: (markdown: string) => void;
};
type FlashcardEditorProps = {
  cards: any[];
  onChange: (cards: any[]) => void;
};

const EditorLoader = () => (
  <div style={{ padding: "20px", textAlign: "center" }}>
    <div
      style={{
        width: 32,
        height: 32,
        borderRadius: "50%",
        border: "2px solid rgba(108,99,255,0.2)",
        borderTopColor: "#6C63FF",
        animation: "spin 0.8s linear infinite",
        margin: "0 auto",
      }}
    />
    <p style={{ fontSize: 12, color: "#C7C4D8", marginTop: 12 }}>Loading editor...</p>
    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
  </div>
);

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

type CourseLevel   = "beginner" | "intermediate" | "advanced" | "all_levels";
type CourseStatus  = "published" | "draft" | "archived";
type LessonType    = "video" | "quiz" | "reading" | "flashcard";

interface Lesson {
  id: string;
  title: string;
  type: LessonType;
  duration: number;   // minutes
  videoUrl?: string;
  xpReward: number;
  isFree: boolean;
  content?: any;      // nội dung chi tiết cho quiz, reading, flashcard
}

interface Module {
  id: string;
  title: string;
  duration: number;   // total minutes (auto-computed)
  order: number;
  lessons: Lesson[];
  expanded: boolean;
}

interface CourseFormData {
  title: string;
  description: string;
  price: number;
  category: string;
  level: CourseLevel;
  status: CourseStatus;
  thumbnailUrl: string;
  totalDurationHours: number;
  language: string;
  tags: string[];
  modules: Module[];
}

interface ValidationErrors {
  title?: string;
  price?: string;
  category?: string;
  description?: string;
  modules?: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

const CATEGORIES = [
  "Development", "Design", "Business", "Marketing",
  "Data Science", "Language", "Soft Skills", "Mathematics",
];

const LANGUAGES = ["English", "Vietnamese", "Japanese", "Korean", "French", "Spanish"];

const LESSON_TYPE_META: Record<LessonType, { label: string; color: string; bg: string; Icon: React.ElementType }> = {
  video:      { label: "Video",      color: "#6C63FF", bg: "rgba(108,99,255,0.14)", Icon: Play },
  quiz:       { label: "Quiz",       color: "#45f1c5", bg: "rgba(69,241,197,0.12)", Icon: Zap },
  reading:    { label: "Reading",    color: "#FFB785", bg: "rgba(255,183,133,0.12)", Icon: BookOpen },
  flashcard:  { label: "Flashcard",  color: "#c4c0ff", bg: "rgba(196,192,255,0.12)", Icon: Layers },
};

// ═══════════════════════════════════════════════════════════════════════════
// ID FACTORY
// ═══════════════════════════════════════════════════════════════════════════

let idSeq = 0;
const uid = (prefix = "id") => `${prefix}_${++idSeq}_${Math.random().toString(36).slice(2, 6)}`;

// ═══════════════════════════════════════════════════════════════════════════
// DEFAULT FACTORIES
// ═══════════════════════════════════════════════════════════════════════════

const emptyLesson = (): Lesson => ({
  id: uid("lesson"),
  title: "",
  type: "video",
  duration: 10,
  xpReward: 50,
  isFree: false,
  content: undefined,
});

const emptyModule = (order: number): Module => ({
  id: uid("module"),
  title: "",
  duration: 0,
  order,
  lessons: [emptyLesson()],
  expanded: true,
});

const defaultForm = (): CourseFormData => ({
  title: "",
  description: "",
  price: 0,
  category: CATEGORIES[0],
  level: "beginner",
  status: "draft",
  thumbnailUrl: "",
  totalDurationHours: 0,
  language: "English",
  tags: [],
  modules: [emptyModule(1)],
});

// ═══════════════════════════════════════════════════════════════════════════
// VALIDATION
// ═══════════════════════════════════════════════════════════════════════════

function validate(form: CourseFormData): ValidationErrors {
  const errors: ValidationErrors = {};
  if (!form.title.trim())               errors.title    = "Course title is required";
  if (form.title.trim().length > 120)   errors.title    = "Title must be under 120 characters";
  if (form.price < 0)                   errors.price    = "Price cannot be negative";
  if (!form.category)                   errors.category = "Please select a category";
  if (!form.description.trim())         errors.description = "Please add a short description";
  if (form.modules.length === 0)        errors.modules  = "Add at least one module";
  const emptyModules = form.modules.filter((m) => !m.title.trim());
  if (emptyModules.length > 0)          errors.modules  = "All modules must have a title";
  return errors;
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

const totalModuleMinutes = (m: Module) =>
  m.lessons.reduce((s, l) => s + (l.duration || 0), 0);

const totalCourseHours = (modules: Module[]) =>
  +(modules.reduce((s, m) => s + totalModuleMinutes(m), 0) / 60).toFixed(1);

const totalLessons = (modules: Module[]) =>
  modules.reduce((s, m) => s + m.lessons.length, 0);

const totalXP = (modules: Module[]) =>
  modules.reduce((s, m) => s + m.lessons.reduce((ls, l) => ls + l.xpReward, 0), 0);

// Helper để loại bỏ tất cả các giá trị undefined (recursive)
function removeUndefined<T>(obj: T): T {
  if (obj === null || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) {
    return obj.map((item) => removeUndefined(item)) as any;
  }
  const cleaned: any = {};
  for (const key in obj) {
    const val = obj[key];
    if (val !== undefined) {
      cleaned[key] = removeUndefined(val);
    }
  }
  return cleaned;
}

// ═══════════════════════════════════════════════════════════════════════════
// SHARED INPUT STYLES
// ═══════════════════════════════════════════════════════════════════════════

const IS: React.CSSProperties = {
  width: "100%", background: "#0d0d18",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 12, padding: "10px 14px",
  color: "#E4E1EE", fontSize: 14,
  outline: "none", fontFamily: "Inter,sans-serif",
  transition: "border-color .2s, box-shadow .2s",
};

const LABEL: React.CSSProperties = {
  display: "block", fontSize: 11, fontWeight: 700,
  color: "#C7C4D8", letterSpacing: ".07em",
  textTransform: "uppercase", marginBottom: 7,
};

function InputField({
  label, icon: Icon, error, children,
  hint,
}: {
  label: string; icon?: React.ElementType; error?: string;
  children: React.ReactNode; hint?: string;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      <label style={{ ...LABEL, display: "flex", alignItems: "center", gap: 6 }}>
        {Icon && <Icon size={11} style={{ opacity: .7 }} />}
        {label}
      </label>
      {children}
      {hint && !error && (
        <p style={{ fontSize: 11, color: "#6C63FF", marginTop: 5, display: "flex", alignItems: "center", gap: 4 }}>
          <Info size={10} /> {hint}
        </p>
      )}
      {error && (
        <p style={{ fontSize: 11, color: "#ffb4ab", marginTop: 5, display: "flex", alignItems: "center", gap: 4 }}>
          <AlertCircle size={10} /> {error}
        </p>
      )}
    </div>
  );
}

function focusBorder(e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
  e.target.style.borderColor = "rgba(108,99,255,.55)";
  e.target.style.boxShadow = "0 0 0 3px rgba(108,99,255,.12)";
}
function blurBorder(e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
  e.target.style.borderColor = "rgba(255,255,255,.08)";
  e.target.style.boxShadow = "none";
}

// ═══════════════════════════════════════════════════════════════════════════
// THUMBNAIL UPLOADER (Cloudinary)
// ═══════════════════════════════════════════════════════════════════════════

interface ThumbnailUploaderProps {
  url: string;
  onChange: (url: string) => void;
}

function ThumbnailUploader({ url, onChange }: ThumbnailUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    if (!file.type.startsWith("image/")) return;

    setUploading(true);
    setProgress(0);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET);

    try {
      const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
      const uploadUrl = `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`;

      const xhr = new XMLHttpRequest();
      xhr.open("POST", uploadUrl, true);

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percent = Math.round((event.loaded / event.total) * 100);
          setProgress(percent);
        }
      };

      xhr.onload = () => {
        if (xhr.status === 200) {
          const response = JSON.parse(xhr.responseText);
          onChange(response.secure_url);
          setUploading(false);
          setProgress(0);
        } else {
          console.error("Upload failed:", xhr.statusText);
          setUploading(false);
          setProgress(0);
          alert("Upload ảnh thất bại, vui lòng thử lại.");
        }
      };

      xhr.onerror = () => {
        console.error("Network error");
        setUploading(false);
        setProgress(0);
        alert("Lỗi kết nối khi upload ảnh.");
      };

      xhr.send(formData);
    } catch (err) {
      console.error(err);
      setUploading(false);
      setProgress(0);
      alert("Không thể upload ảnh.");
    }
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div
        onClick={() => !uploading && inputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        style={{
          position: "relative", width: "100%",
          aspectRatio: "16/7", borderRadius: 16, overflow: "hidden",
          border: `2px dashed ${dragOver ? "rgba(108,99,255,.7)" : url ? "rgba(255,255,255,.1)" : "rgba(255,255,255,.12)"}`,
          background: dragOver ? "rgba(108,99,255,.07)" : "rgba(255,255,255,.025)",
          cursor: uploading ? "wait" : "pointer",
          transition: "border-color .2s, background .2s",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}
      >
        {url ? (
          <>
            <img
              src={url}
              alt="Thumbnail preview"
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
            <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.45)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, opacity: 0, transition: "opacity .2s" }}
              onMouseOver={(e) => (e.currentTarget.style.opacity = "1")}
              onMouseOut={(e) => (e.currentTarget.style.opacity = "0")}>
              <Upload size={24} color="#fff" />
              <span style={{ fontSize: 12, fontWeight: 700, color: "#fff" }}>Replace image</span>
            </div>
            {!uploading && (
              <button
                onClick={(e) => { e.stopPropagation(); onChange(""); }}
                style={{ position: "absolute", top: 10, right: 10, width: 30, height: 30, borderRadius: "50%", background: "rgba(0,0,0,.65)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff" }}
              >
                <X size={14} />
              </button>
            )}
          </>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: 24 }}>
            <div style={{ width: 56, height: 56, borderRadius: "50%", background: "rgba(108,99,255,.12)", border: "1px solid rgba(108,99,255,.25)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Image size={24} color="#6C63FF" />
            </div>
            <div style={{ textAlign: "center" }}>
              <p style={{ fontSize: 14, fontWeight: 700, color: "#E4E1EE", marginBottom: 4 }}>
                Drop thumbnail here
              </p>
              <p style={{ fontSize: 12, color: "#C7C4D8" }}>
                or click to upload · 16:9 recommended · PNG / WEBP / JPG
              </p>
            </div>
          </div>
        )}

        {uploading && (
          <div style={{ position: "absolute", inset: 0, background: "rgba(15,15,26,.85)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14 }}>
            <Loader size={28} color="#6C63FF" style={{ animation: "spin .8s linear infinite" }} />
            <div style={{ width: "60%", height: 4, background: "rgba(255,255,255,.1)", borderRadius: 99, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${progress}%`, background: "linear-gradient(90deg,#6C63FF,#00D4AA)", transition: "width .15s", borderRadius: 99 }} />
            </div>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#e3dfff" }}>Uploading {progress}%</span>
          </div>
        )}
      </div>

      <input
        ref={inputRef as unknown as React.RefObject<HTMLInputElement>}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
      />
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <div style={{ flex: 1, position: "relative" }}>
          <Image size={13} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#C7C4D8" }} />
          <input
            value={url}
            onChange={(e) => onChange(e.target.value)}
            placeholder="…or paste a Cloudinary / Firebase Storage URL"
            style={{ ...IS, paddingLeft: 32, fontSize: 12 }}
            onFocus={focusBorder}
            onBlur={blurBorder}
          />
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// LESSON EDITOR (đã tích hợp editors cho quiz, reading, flashcard)
// ═══════════════════════════════════════════════════════════════════════════

interface LessonEditorProps {
  lesson: Lesson;
  index: number;
  onUpdate: (patch: Partial<Lesson>) => void;
  onDelete: () => void;
  dragHandleProps?: React.HTMLAttributes<HTMLDivElement>;
}

function LessonEditor({ lesson, index, onUpdate, onDelete, dragHandleProps }: LessonEditorProps) {
  const [expanded, setExpanded] = useState(false);
  const meta = LESSON_TYPE_META[lesson.type];
  const MetaIcon = meta.Icon;

  const handleContentChange = (content: any) => {
    onUpdate({ content });
  };

  return (
    <div
      style={{
        background: "rgba(255,255,255,.025)",
        border: "1px solid rgba(255,255,255,.07)",
        borderRadius: 12, overflow: "hidden",
        transition: "border-color .2s",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px" }}>
        <div
          {...dragHandleProps}
          style={{ color: "#47464f", cursor: "grab", display: "flex", alignItems: "center", padding: "2px 4px", borderRadius: 6, transition: "color .15s", flexShrink: 0 }}
          onMouseOver={(e) => (e.currentTarget.style.color = "#C7C4D8")}
          onMouseOut={(e) => (e.currentTarget.style.color = "#47464f")}
        >
          <GripVertical size={14} />
        </div>

        <span style={{ width: 22, height: 22, borderRadius: "50%", background: "rgba(108,99,255,.18)", border: "1px solid rgba(108,99,255,.28)", fontSize: 10, fontWeight: 700, color: "#c4c0ff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          {index + 1}
        </span>

        <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 9px", borderRadius: 999, background: meta.bg, color: meta.color, fontSize: 10, fontWeight: 700, flexShrink: 0 }}>
          <MetaIcon size={10} /> {meta.label}
        </span>

        <input
          value={lesson.title}
          onChange={(e) => onUpdate({ title: e.target.value })}
          placeholder={`Lesson ${index + 1} title…`}
          style={{ ...IS, flex: 1, padding: "6px 10px", fontSize: 13, background: "transparent", border: "1px solid transparent" }}
          onFocus={(e) => { e.target.style.borderColor = "rgba(108,99,255,.45)"; e.target.style.background = "#0d0d18"; }}
          onBlur={(e) => { e.target.style.borderColor = "transparent"; e.target.style.background = "transparent"; }}
        />

        <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
          <Clock size={12} color="#C7C4D8" />
          <input
            type="number" min={1} max={300}
            value={lesson.duration}
            onChange={(e) => onUpdate({ duration: Number(e.target.value) })}
            style={{ ...IS, width: 52, padding: "4px 6px", fontSize: 12, textAlign: "center" }}
            onFocus={focusBorder} onBlur={blurBorder}
          />
          <span style={{ fontSize: 11, color: "#C7C4D8" }}>min</span>
        </div>

        <button
          onClick={() => onUpdate({ isFree: !lesson.isFree })}
          title={lesson.isFree ? "Free preview ON" : "Mark as free preview"}
          style={{
            display: "flex", alignItems: "center", gap: 4,
            padding: "4px 9px", borderRadius: 8, cursor: "pointer",
            fontSize: 10, fontWeight: 700, transition: "all .15s",
            background: lesson.isFree ? "rgba(69,241,197,.12)" : "rgba(255,255,255,.04)",
            border: `1px solid ${lesson.isFree ? "rgba(69,241,197,.3)" : "rgba(255,255,255,.08)"}`,
            color: lesson.isFree ? "#45f1c5" : "#47464f",
          }}
        >
          {lesson.isFree ? <Eye size={10} /> : <EyeOff size={10} />}
          {lesson.isFree ? "Free" : "Paid"}
        </button>

        <button
          onClick={() => setExpanded((p) => !p)}
          style={{ background: "none", border: "none", cursor: "pointer", color: "#C7C4D8", padding: 4 }}
        >
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>

        <button
          onClick={onDelete}
          style={{ background: "rgba(255,180,171,.08)", border: "1px solid rgba(255,180,171,.18)", borderRadius: 8, cursor: "pointer", color: "#ffb4ab", padding: "4px 6px", display: "flex", alignItems: "center", justifyContent: "center", transition: "all .15s" }}
          onMouseOver={(e) => (e.currentTarget.style.background = "rgba(255,180,171,.18)")}
          onMouseOut={(e) => (e.currentTarget.style.background = "rgba(255,180,171,.08)")}
        >
          <Trash2 size={12} />
        </button>
      </div>

      {expanded && (
        <div style={{ padding: "12px 14px 14px", borderTop: "1px solid rgba(255,255,255,.06)", display: "flex", flexDirection: "column", gap: 12, animation: "fadeDown .2s ease" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            <div>
              <label style={{ ...LABEL }}>Lesson type</label>
              <select
                value={lesson.type}
                onChange={(e) => onUpdate({ type: e.target.value as LessonType, content: undefined })}
                style={{ ...IS, padding: "7px 10px", fontSize: 12 }}
                onFocus={focusBorder} onBlur={blurBorder}
              >
                {(["video", "quiz", "reading", "flashcard"] as LessonType[]).map((t) => (
                  <option key={t} value={t}>{LESSON_TYPE_META[t].label}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ ...LABEL }}>XP Reward</label>
              <div style={{ position: "relative" }}>
                <Zap size={12} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#45f1c5" }} />
                <input
                  type="number" min={0} max={1000}
                  value={lesson.xpReward}
                  onChange={(e) => onUpdate({ xpReward: Number(e.target.value) })}
                  style={{ ...IS, paddingLeft: 28, fontSize: 12 }}
                  onFocus={focusBorder} onBlur={blurBorder}
                />
              </div>
            </div>

            {lesson.type === "video" && (
              <div>
                <label style={{ ...LABEL }}>Video URL</label>
                <div style={{ position: "relative" }}>
                  <Play size={12} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#6C63FF" }} />
                  <input
                    value={lesson.videoUrl ?? ""}
                    onChange={(e) => onUpdate({ videoUrl: e.target.value })}
                    placeholder="YouTube / Vimeo / Cloudinary URL…"
                    style={{ ...IS, paddingLeft: 28, fontSize: 12 }}
                    onFocus={focusBorder} onBlur={blurBorder}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Content editors - Lazy loaded with Suspense */}
          {lesson.type === "quiz" && (
            <Suspense fallback={<EditorLoader />}>
              <QuizEditor
                questions={lesson.content?.data?.questions || []}
                onChange={(questions: any[]) => handleContentChange({ type: "quiz", data: { questions, passingScore: lesson.content?.data?.passingScore || 70 } })}
              />
            </Suspense>
          )}
          {lesson.type === "reading" && (
            <Suspense fallback={<EditorLoader />}>
              <ReadingEditor
                markdown={lesson.content?.data?.markdown || ""}
                onChange={(markdown: string) => handleContentChange({ type: "reading", data: { markdown } })}
              />
            </Suspense>
          )}
          {lesson.type === "flashcard" && (
            <Suspense fallback={<EditorLoader />}>
              <FlashcardEditor
                cards={lesson.content?.data?.cards || []}
                onChange={(cards: any[]) => handleContentChange({ type: "flashcard", data: { cards } })}
              />
            </Suspense>
          )}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// DYNAMIC MODULE LIST (giữ nguyên)
// ═══════════════════════════════════════════════════════════════════════════

interface DynamicModuleListProps {
  modules: Module[];
  onChange: (modules: Module[]) => void;
  error?: string;
}

function DynamicModuleList({ modules, onChange, error }: DynamicModuleListProps) {
  const dragModIdx = useRef<number | null>(null);
  const dragOverModIdx = useRef<number | null>(null);

  const updateModule = useCallback((idx: number, patch: Partial<Module>) => {
    onChange(modules.map((m, i) => (i === idx ? { ...m, ...patch } : m)));
  }, [modules, onChange]);

  const addModule = () => {
    onChange([...modules, emptyModule(modules.length + 1)]);
    setTimeout(() => {
      const last = document.getElementById(`module-card-${modules.length}`);
      last?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 60);
  };

  const deleteModule = (idx: number) => {
    if (modules.length === 1) return;
    onChange(modules.filter((_, i) => i !== idx).map((m, i) => ({ ...m, order: i + 1 })));
  };

  const handleModDragStart = (idx: number) => { dragModIdx.current = idx; };
  const handleModDragEnter = (idx: number) => { dragOverModIdx.current = idx; };
  const handleModDragEnd   = () => {
    const from = dragModIdx.current;
    const to   = dragOverModIdx.current;
    if (from === null || to === null || from === to) return;
    const arr = [...modules];
    const [moved] = arr.splice(from, 1);
    arr.splice(to, 0, moved);
    onChange(arr.map((m, i) => ({ ...m, order: i + 1 })));
    dragModIdx.current = null;
    dragOverModIdx.current = null;
  };

  const addLesson = (modIdx: number) => {
    const mod = modules[modIdx];
    updateModule(modIdx, { lessons: [...mod.lessons, emptyLesson()] });
  };

  const updateLesson = (modIdx: number, lessonIdx: number, patch: Partial<Lesson>) => {
    const mod = { ...modules[modIdx] };
    mod.lessons = mod.lessons.map((l, i) => (i === lessonIdx ? { ...l, ...patch } : l));
    mod.duration = totalModuleMinutes(mod);
    updateModule(modIdx, mod);
  };

  const deleteLesson = (modIdx: number, lessonIdx: number) => {
    const mod = modules[modIdx];
    if (mod.lessons.length === 1) return;
    const lessons = mod.lessons.filter((_, i) => i !== lessonIdx);
    updateModule(modIdx, { lessons, duration: lessons.reduce((s, l) => s + l.duration, 0) });
  };

  const dragLessonFrom = useRef<{ mod: number; lesson: number } | null>(null);
  const dragLessonTo   = useRef<{ mod: number; lesson: number } | null>(null);

  const endLessonDrag = () => {
    const from = dragLessonFrom.current;
    const to   = dragLessonTo.current;
    if (!from || !to || (from.mod === to.mod && from.lesson === to.lesson)) return;
    if (from.mod === to.mod) {
      const mod = { ...modules[from.mod] };
      const arr = [...mod.lessons];
      const [moved] = arr.splice(from.lesson, 1);
      arr.splice(to.lesson, 0, moved);
      updateModule(from.mod, { lessons: arr });
    }
    dragLessonFrom.current = null;
    dragLessonTo.current   = null;
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {error && (
        <p style={{ fontSize: 12, color: "#ffb4ab", display: "flex", alignItems: "center", gap: 6 }}>
          <AlertCircle size={13} /> {error}
        </p>
      )}

      {modules.map((mod, mIdx) => (
        <div
          key={mod.id}
          id={`module-card-${mIdx}`}
          draggable
          onDragStart={() => handleModDragStart(mIdx)}
          onDragEnter={() => handleModDragEnter(mIdx)}
          onDragEnd={handleModDragEnd}
          onDragOver={(e) => e.preventDefault()}
          style={{
            background: "rgba(26,26,46,.7)",
            border: "1px solid rgba(255,255,255,.07)",
            borderRadius: 18, overflow: "hidden",
            backdropFilter: "blur(10px)",
            transition: "box-shadow .2s",
          }}
          onMouseOver={(e) => (e.currentTarget.style.boxShadow = "0 4px 20px rgba(108,99,255,.1)")}
          onMouseOut={(e)  => (e.currentTarget.style.boxShadow = "none")}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 16px", background: "rgba(255,255,255,.025)", borderBottom: "1px solid rgba(255,255,255,.07)", cursor: "grab" }}>
            <GripVertical size={17} color="#47464f" />

            <div style={{ width: 28, height: 28, borderRadius: 8, background: "linear-gradient(135deg,#6C63FF,#9B59B6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, color: "#fff", flexShrink: 0, boxShadow: "0 0 10px rgba(108,99,255,.35)" }}>
              {mIdx + 1}
            </div>

            <input
              value={mod.title}
              onChange={(e) => updateModule(mIdx, { title: e.target.value })}
              placeholder={`Module ${mIdx + 1}: e.g. "Introduction to Hooks"`}
              style={{ ...IS, flex: 1, background: "transparent", border: "1px solid transparent", padding: "6px 10px", fontSize: 14, fontWeight: 600 }}
              onFocus={(e) => { e.target.style.borderColor = "rgba(108,99,255,.45)"; e.target.style.background = "#0d0d18"; }}
              onBlur={(e) => { e.target.style.borderColor = "transparent"; e.target.style.background = "transparent"; }}
            />

            <div style={{ display: "flex", gap: 10, fontSize: 11, color: "#C7C4D8", flexShrink: 0 }}>
              <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <BookOpen size={11} /> {mod.lessons.length} lessons
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <Clock size={11} /> {totalModuleMinutes(mod)} min
              </span>
            </div>

            <button
              onClick={() => updateModule(mIdx, { expanded: !mod.expanded })}
              style={{ background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.08)", borderRadius: 8, cursor: "pointer", color: "#C7C4D8", padding: "4px 8px", display: "flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 600 }}
            >
              {mod.expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
              {mod.expanded ? "Collapse" : "Expand"}
            </button>

            <button
              onClick={() => deleteModule(mIdx)}
              disabled={modules.length === 1}
              style={{
                background: "rgba(255,180,171,.08)", border: "1px solid rgba(255,180,171,.18)",
                borderRadius: 8, cursor: modules.length === 1 ? "not-allowed" : "pointer",
                color: modules.length === 1 ? "#47464f" : "#ffb4ab",
                padding: "5px 7px", display: "flex", alignItems: "center",
                transition: "all .15s",
              }}
              onMouseOver={(e) => { if (modules.length > 1) e.currentTarget.style.background = "rgba(255,180,171,.18)"; }}
              onMouseOut={(e) => (e.currentTarget.style.background = "rgba(255,180,171,.08)")}
            >
              <Trash2 size={13} />
            </button>
          </div>

          {mod.expanded && (
            <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
              {mod.lessons.map((lesson, lIdx) => (
                <div
                  key={lesson.id}
                  draggable
                  onDragStart={() => { dragLessonFrom.current = { mod: mIdx, lesson: lIdx }; }}
                  onDragEnter={() => { dragLessonTo.current = { mod: mIdx, lesson: lIdx }; }}
                  onDragEnd={endLessonDrag}
                  onDragOver={(e) => e.preventDefault()}
                >
                  <LessonEditor
                    lesson={lesson}
                    index={lIdx}
                    onUpdate={(patch) => updateLesson(mIdx, lIdx, patch)}
                    onDelete={() => deleteLesson(mIdx, lIdx)}
                  />
                </div>
              ))}

              <button
                onClick={() => addLesson(mIdx)}
                style={{
                  width: "100%", padding: "10px", borderRadius: 10,
                  border: "1px dashed rgba(108,99,255,.35)",
                  background: "rgba(108,99,255,.05)",
                  color: "#9B59B6", fontSize: 13, fontWeight: 600,
                  cursor: "pointer", fontFamily: "Inter,sans-serif",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                  transition: "all .2s",
                }}
                onMouseOver={(e) => { e.currentTarget.style.background = "rgba(108,99,255,.12)"; e.currentTarget.style.borderColor = "rgba(108,99,255,.6)"; }}
                onMouseOut={(e) => { e.currentTarget.style.background = "rgba(108,99,255,.05)"; e.currentTarget.style.borderColor = "rgba(108,99,255,.35)"; }}
              >
                <Plus size={14} /> Add Lesson to Module {mIdx + 1}
              </button>
            </div>
          )}
        </div>
      ))}

      <button
        onClick={addModule}
        style={{
          width: "100%", padding: "14px",
          borderRadius: 16, border: "2px dashed rgba(108,99,255,.3)",
          background: "rgba(108,99,255,.04)", color: "#6C63FF",
          fontSize: 14, fontWeight: 700, cursor: "pointer",
          fontFamily: "Inter,sans-serif", display: "flex",
          alignItems: "center", justifyContent: "center", gap: 9,
          transition: "all .2s",
        }}
        onMouseOver={(e) => { e.currentTarget.style.background = "rgba(108,99,255,.1)"; e.currentTarget.style.borderColor = "rgba(108,99,255,.55)"; }}
        onMouseOut={(e) => { e.currentTarget.style.background = "rgba(108,99,255,.04)"; e.currentTarget.style.borderColor = "rgba(108,99,255,.3)"; }}
      >
        <Plus size={16} />
        Add New Module
      </button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TAG INPUT
// ═══════════════════════════════════════════════════════════════════════════

interface TagInputProps { tags: string[]; onChange: (t: string[]) => void; }
function TagInput({ tags, onChange }: TagInputProps) {
  const [input, setInput] = useState("");
  const add = () => {
    const t = input.trim().toLowerCase();
    if (t && !tags.includes(t)) onChange([...tags, t]);
    setInput("");
  };
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, padding: "8px 10px", background: "#0d0d18", border: "1px solid rgba(255,255,255,.08)", borderRadius: 12, minHeight: 44, alignItems: "center" }}>
      {tags.map((tag) => (
        <span key={tag} style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 10px", borderRadius: 999, background: "rgba(108,99,255,.15)", border: "1px solid rgba(108,99,255,.3)", fontSize: 12, fontWeight: 700, color: "#c4c0ff" }}>
          #{tag}
          <button onClick={() => onChange(tags.filter((t) => t !== tag))} style={{ background: "none", border: "none", cursor: "pointer", color: "#9B59B6", padding: 0, display: "flex" }}>
            <X size={11} />
          </button>
        </span>
      ))}
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); add(); } }}
        onBlur={add}
        placeholder={tags.length === 0 ? "Add tags (press Enter)…" : ""}
        style={{ background: "transparent", border: "none", outline: "none", fontSize: 13, color: "#E4E1EE", fontFamily: "Inter,sans-serif", flex: 1, minWidth: 120 }}
      />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION WRAPPER
// ═══════════════════════════════════════════════════════════════════════════

function Section({ title, subtitle, icon: Icon, children }: {
  title: string; subtitle?: string;
  icon: React.ElementType; children: React.ReactNode;
}) {
  return (
    <div style={{ background: "rgba(26,26,46,.6)", border: "1px solid rgba(255,255,255,.06)", borderRadius: 20, overflow: "hidden", backdropFilter: "blur(12px)" }}>
      <div style={{ padding: "16px 22px", borderBottom: "1px solid rgba(255,255,255,.06)", display: "flex", alignItems: "center", gap: 12, background: "rgba(255,255,255,.02)" }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(108,99,255,.15)", border: "1px solid rgba(108,99,255,.25)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Icon size={17} color="#6C63FF" />
        </div>
        <div>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: "#E4E1EE", margin: 0 }}>{title}</h3>
          {subtitle && <p style={{ fontSize: 12, color: "#C7C4D8", margin: 0 }}>{subtitle}</p>}
        </div>
      </div>
      <div style={{ padding: 22 }}>{children}</div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// LIVE SUMMARY SIDEBAR
// ═══════════════════════════════════════════════════════════════════════════

function CourseSummary({ form }: { form: CourseFormData }) {
  const hours = totalCourseHours(form.modules);
  const lessons = totalLessons(form.modules);
  const xp = totalXP(form.modules);

  const StatusIcon = form.status === "published" ? CheckCircle : form.status === "draft" ? PauseCircle : EyeOff;

  return (
    <div style={{ position: "sticky", top: 24, display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ background: "rgba(26,26,46,.7)", border: "1px solid rgba(255,255,255,.06)", borderRadius: 18, overflow: "hidden" }}>
        <div style={{ aspectRatio: "16/9", background: "#0a0a15", display: "flex", alignItems: "center", justifyContent: "center" }}>
          {form.thumbnailUrl ? (
            <img src={form.thumbnailUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
              <Image size={32} color="#353438" />
              <span style={{ fontSize: 12, color: "#47464f" }}>No thumbnail</span>
            </div>
          )}
        </div>
        <div style={{ padding: "14px 16px" }}>
          <h4 style={{ fontSize: 14, fontWeight: 700, color: "#E4E1EE", marginBottom: 6, lineHeight: 1.4 }}>
            {form.title || <span style={{ color: "#47464f", fontStyle: "italic" }}>Untitled course…</span>}
          </h4>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {[
              { icon: Tag, label: form.category, color: "#C7C4D8" },
              { icon: BarChart2, label: form.level.replace("_", " "), color: "#C7C4D8" },
              { icon: DollarSign, label: form.price === 0 ? "Free" : `$${form.price}`, color: "#45f1c5" },
            ].map(({ icon: I, label, color }) => (
              <span key={label} style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 600, color }}>
                <I size={11} /> {label}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div style={{ background: "rgba(26,26,46,.7)", border: "1px solid rgba(255,255,255,.06)", borderRadius: 18, padding: 16, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        {[
          { label: "Modules", value: form.modules.length, color: "#e3dfff", Icon2: Layers },
          { label: "Lessons", value: lessons, color: "#e3dfff", Icon2: BookOpen },
          { label: "Duration", value: `${hours}h`, color: "#45f1c5", Icon2: Clock },
          { label: "Total XP", value: `+${xp}`, color: "#FFB785", Icon2: Zap },
        ].map(({ label, value, color, Icon2 }) => (
          <div key={label} style={{ background: "rgba(255,255,255,.03)", borderRadius: 12, padding: "10px 12px", border: "1px solid rgba(255,255,255,.05)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 5 }}>
              <Icon2 size={11} color={color} />
              <span style={{ fontSize: 10, fontWeight: 700, color: "#C7C4D8", letterSpacing: ".06em", textTransform: "uppercase" }}>{label}</span>
            </div>
            <span style={{ fontSize: 18, fontWeight: 800, color }}>{value}</span>
          </div>
        ))}
      </div>

      <div style={{ background: "rgba(26,26,46,.7)", border: "1px solid rgba(255,255,255,.06)", borderRadius: 14, padding: "12px 16px", display: "flex", alignItems: "center", gap: 10 }}>
        <StatusIcon size={18} color={form.status === "published" ? "#45f1c5" : form.status === "draft" ? "#FFB785" : "#B0AEC0"} />
        <div>
          <p style={{ fontSize: 10, fontWeight: 700, color: "#C7C4D8", letterSpacing: ".07em", textTransform: "uppercase", marginBottom: 2 }}>Status</p>
          <p style={{ fontSize: 13, fontWeight: 700, color: form.status === "published" ? "#45f1c5" : form.status === "draft" ? "#FFB785" : "#B0AEC0" }}>
            {form.status.charAt(0).toUpperCase() + form.status.slice(1)}
          </p>
        </div>
      </div>

      <div style={{ background: "rgba(108,99,255,.06)", border: "1px solid rgba(108,99,255,.18)", borderRadius: 14, padding: "12px 14px" }}>
        <p style={{ fontSize: 10, fontWeight: 700, color: "#9B59B6", letterSpacing: ".07em", textTransform: "uppercase", marginBottom: 8 }}>Firebase Path</p>
        <code style={{ fontSize: 11, color: "#c4c0ff", lineHeight: 1.8 }}>
          courses/<span style={{ color: "#45f1c5" }}>{"{courseId}"}</span><br />
          └─ modules (embedded)<br />
          └─ lessons (sub-docs)
        </code>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SAVE STATE TYPE
// ═══════════════════════════════════════════════════════════════════════════

type SaveState = "idle" | "saving" | "saved" | "error";

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export default function CourseFormAdmin() {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const isEdit = Boolean(courseId);

  const [form, setForm] = useState<CourseFormData>(defaultForm());
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [loadingData, setLoadingData] = useState(isEdit);
  const [toastMessage, setToastMessage] = useState<{ msg: string; type: string } | null>(null);

  // Load existing course
  const { data: existingCourse, loading: courseLoading } = useDocument<{
    title: string;
    description: string;
    price: number;
    category: string;
    level: CourseLevel;
    status: CourseStatus;
    thumbnailUrl: string;
    language: string;
    tags: string[];
    modules: Module[];
  }>("courses", isEdit ? courseId ?? null : null);

  useEffect(() => {
    if (!isEdit) return;
    if (existingCourse && !courseLoading) {
      setForm({
        title: existingCourse.title || "",
        description: existingCourse.description || "",
        price: existingCourse.price || 0,
        category: existingCourse.category || CATEGORIES[0],
        level: existingCourse.level || "beginner",
        status: existingCourse.status || "draft",
        thumbnailUrl: existingCourse.thumbnailUrl || "",
        totalDurationHours: totalCourseHours(existingCourse.modules || [emptyModule(1)]),
        language: existingCourse.language || "English",
        tags: existingCourse.tags || [],
        modules: existingCourse.modules?.length ? existingCourse.modules : [emptyModule(1)],
      });
      setLoadingData(false);
    } else if (!courseLoading && !existingCourse && isEdit) {
      setLoadingData(false);
    }
  }, [existingCourse, courseLoading, isEdit]);

  useEffect(() => {
    if (Object.keys(touched).length > 0) {
      setErrors(validate(form));
    }
  }, [form, touched]);

  const setField = <K extends keyof CourseFormData>(key: K, val: CourseFormData[K]) => {
    setForm((f) => ({ ...f, [key]: val }));
    setTouched((t) => ({ ...t, [key]: true }));
  };

  const showToast = (msg: string, type: "success" | "error" | "info") => {
    setToastMessage({ msg, type });
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Hàm submit chính – đã được sửa để loại bỏ undefined
  const handleSubmit = async () => {
    setTouched(Object.fromEntries(Object.keys(form).map((k) => [k, true])));
    const errs = validate(form);
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setSaveState("saving");

    // Loại bỏ tất cả các undefined trong modules (bao gồm content, videoUrl, ...)
    const cleanedModules = removeUndefined(form.modules);

    const payload = {
      title: form.title,
      description: form.description,
      price: form.price,
      category: form.category,
      level: form.level,
      status: form.status,
      thumbnailUrl: form.thumbnailUrl,
      language: form.language,
      tags: form.tags,
      modules: cleanedModules,
      totalDurationHours: totalCourseHours(form.modules),
      updatedAt: serverTimestamp(),
    };

    try {
      if (isEdit && courseId) {
        const courseRef = doc(db, "courses", courseId);
        await updateDoc(courseRef, payload);
        showToast("Course updated successfully!", "success");
        navigate(`/admin/courses/${courseId}`);
      } else {
        const newCourseRef = await addDoc(collection(db, "courses"), {
          ...payload,
          createdAt: serverTimestamp(),
          rating: 0,
          ratingCount: 0,
          totalStudents: 0,
        });
        showToast("Course created successfully!", "success");
        navigate(`/admin/courses/${newCourseRef.id}`);
      }
    } catch (err: any) {
      console.error("Save error:", err);
      showToast(`Error: ${err.message}`, "error");
      setSaveState("error");
      setTimeout(() => setSaveState("idle"), 3000);
      return;
    }

    setSaveState("saved");
    setTimeout(() => setSaveState("idle"), 3000);
  };

  if (loadingData) {
    return (
      <div style={{ minHeight: "100vh", background: "#0F0F1A", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
          <Loader size={36} color="#6C63FF" style={{ animation: "spin .8s linear infinite" }} />
          <p style={{ fontSize: 15, fontWeight: 600, color: "#C7C4D8" }}>Loading course from Firestore…</p>
        </div>
      </div>
    );
  }

  const errorCount = Object.keys(errors).length;
  const hasErrors = Object.keys(touched).length > 0 && errorCount > 0;

  return (
    <div style={{ minHeight: "100vh", background: "#0F0F1A", color: "#E4E1EE", fontFamily: "Inter,sans-serif", backgroundImage: "radial-gradient(circle at 5% 0%, rgba(108,99,255,.06) 0%, transparent 50%)" }}>
      <style>
        {`
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap');
          *{box-sizing:border-box;margin:0;padding:0;}
          body{margin:0;}
          @keyframes spin{to{transform:rotate(360deg)}}
          @keyframes fadeDown{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:translateY(0)}}
          @keyframes slideInRight{from{opacity:0;transform:translateX(20px)}to{opacity:1;transform:translateX(0)}}
          input,select,textarea,button{font-family:Inter,sans-serif;}
          ::-webkit-scrollbar{width:5px;} ::-webkit-scrollbar-track{background:#0F0F1A;} ::-webkit-scrollbar-thumb{background:#2a292d;border-radius:10px;}
          textarea::-webkit-resizer{display:none;}
        `}
      </style>

      <header style={{ position: "sticky", top: 0, zIndex: 50, background: "rgba(15,15,26,.92)", backdropFilter: "blur(18px)", borderBottom: "1px solid rgba(255,255,255,.06)" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "12px 24px", display: "flex", alignItems: "center", gap: 16 }}>
          <button onClick={() => navigate("/admin/courses")} style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.08)", borderRadius: 10, padding: "8px 14px", color: "#C7C4D8", fontSize: 13, fontWeight: 600, cursor: "pointer", transition: "all .2s" }}
            onMouseOver={(e) => { e.currentTarget.style.color = "#e3dfff"; }}
            onMouseOut={(e) => { e.currentTarget.style.color = "#C7C4D8"; }}>
            <ArrowLeft size={15} /> Back
          </button>

          <div style={{ flex: 1 }}>
            <h1 style={{ fontSize: 17, fontWeight: 800, color: "#E4E1EE" }}>
              {isEdit ? "Edit Course" : "New Course"}
            </h1>
            <p style={{ fontSize: 11, color: "#C7C4D8", marginTop: 2 }}>
              Firestore: <code style={{ color: "#c4c0ff", background: "rgba(108,99,255,.12)", padding: "1px 5px", borderRadius: 4 }}>
                courses{courseId ? `/${courseId}` : "/[new]"}
              </code>
            </p>
          </div>

          {hasErrors && (
            <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "7px 14px", borderRadius: 10, background: "rgba(255,180,171,.1)", border: "1px solid rgba(255,180,171,.25)", color: "#ffb4ab", fontSize: 12, fontWeight: 700 }}>
              <AlertCircle size={13} />
              {errorCount} error{errorCount > 1 ? "s" : ""} to fix
            </div>
          )}

          {saveState === "saved" && (
            <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "7px 14px", borderRadius: 10, background: "rgba(69,241,197,.1)", border: "1px solid rgba(69,241,197,.25)", color: "#45f1c5", fontSize: 12, fontWeight: 700 }}>
              <CheckCircle size={13} /> Saved to Firestore!
            </div>
          )}
          {saveState === "error" && (
            <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "7px 14px", borderRadius: 10, background: "rgba(255,180,171,.1)", border: "1px solid rgba(255,180,171,.3)", color: "#ffb4ab", fontSize: 12, fontWeight: 700 }}>
              <AlertCircle size={13} /> Save failed – retry
            </div>
          )}

          <button
            onClick={() => { setField("status", "draft"); handleSubmit(); }}
            style={{ padding: "9px 18px", borderRadius: 12, fontSize: 13, fontWeight: 700, cursor: "pointer", background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.12)", color: "#C7C4D8", transition: "all .2s" }}
            onMouseOver={(e) => { e.currentTarget.style.color = "#e3dfff"; }}
            onMouseOut={(e) => { e.currentTarget.style.color = "#C7C4D8"; }}
          >
            Save draft
          </button>

          <button
            onClick={handleSubmit}
            disabled={saveState === "saving"}
            style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "10px 22px", borderRadius: 12, fontSize: 13, fontWeight: 800,
              cursor: saveState === "saving" ? "wait" : "pointer",
              background: "linear-gradient(135deg,#6C63FF,#9B59B6)",
              border: "none", color: "#fff",
              boxShadow: "0 0 20px rgba(108,99,255,.3)",
              opacity: saveState === "saving" ? .75 : 1,
              transition: "opacity .2s",
            }}
          >
            {saveState === "saving"
              ? <><Loader size={14} style={{ animation: "spin .8s linear infinite" }} /> Saving…</>
              : <><Save size={14} /> {isEdit ? "Publish changes" : "Publish course"}</>
            }
          </button>
        </div>
      </header>

      {toastMessage && (
        <div style={{ position: "fixed", bottom: 24, right: 24, zIndex: 99999, background: "rgba(26,26,46,.97)", border: `1px solid ${toastMessage.type === "error" ? "#ffb4ab" : toastMessage.type === "success" ? "#45f1c5" : "#FFB785"}40`, borderRadius: 12, padding: "12px 20px", color: toastMessage.type === "error" ? "#ffb4ab" : toastMessage.type === "success" ? "#45f1c5" : "#FFB785", fontSize: 13, fontWeight: 600, animation: "slideInRight .3s ease" }}>
          {toastMessage.msg}
        </div>
      )}

      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "28px 24px", display: "grid", gridTemplateColumns: "1fr 320px", gap: 24, alignItems: "start" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <Section title="Basic Information" subtitle="Core course identity" icon={GraduationCap}>
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              <InputField label="Course Title" icon={BookOpen} error={touched.title ? errors.title : undefined} hint="Max 120 characters · appears in search results">
                <input
                  value={form.title}
                  onChange={(e) => setField("title", e.target.value)}
                  placeholder="e.g. Advanced React Patterns & Performance"
                  style={{ ...IS, fontSize: 15, fontWeight: 600 }}
                  onFocus={focusBorder} onBlur={blurBorder}
                />
                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 4 }}>
                  <span style={{ fontSize: 10, color: form.title.length > 100 ? "#ffb4ab" : "#47464f" }}>
                    {form.title.length}/120
                  </span>
                </div>
              </InputField>

              <InputField label="Description" icon={FileText} error={touched.description ? errors.description : undefined}>
                <textarea
                  value={form.description}
                  onChange={(e) => setField("description", e.target.value)}
                  rows={3}
                  placeholder="Briefly describe what students will learn and achieve…"
                  style={{ ...IS, resize: "vertical" }}
                  onFocus={focusBorder} onBlur={blurBorder}
                />
              </InputField>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
                <InputField label="Category" icon={Tag} error={touched.category ? errors.category : undefined}>
                  <select value={form.category} onChange={(e) => setField("category", e.target.value)} style={IS} onFocus={focusBorder} onBlur={blurBorder}>
                    {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </InputField>

                <InputField label="Level" icon={BarChart2}>
                  <select value={form.level} onChange={(e) => setField("level", e.target.value as CourseLevel)} style={IS} onFocus={focusBorder} onBlur={blurBorder}>
                    <option value="beginner">Beginner</option>
                    <option value="intermediate">Intermediate</option>
                    <option value="advanced">Advanced</option>
                    <option value="all_levels">All Levels</option>
                  </select>
                </InputField>

                <InputField label="Language">
                  <select value={form.language} onChange={(e) => setField("language", e.target.value)} style={IS} onFocus={focusBorder} onBlur={blurBorder}>
                    {LANGUAGES.map((l) => <option key={l} value={l}>{l}</option>)}
                  </select>
                </InputField>
              </div>

              <InputField label="Tags" hint="Press Enter or comma to add · used for search indexing">
                <TagInput tags={form.tags} onChange={(t) => setField("tags", t)} />
              </InputField>
            </div>
          </Section>

          <Section title="Pricing & Visibility" subtitle="Revenue and publication settings" icon={DollarSign}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <InputField label="Price (VND)" icon={DollarSign} error={touched.price ? errors.price : undefined} hint="Set to 0 for a free course">
                <div style={{ position: "relative" }}>
                  <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#45f1c5", fontSize: 15, fontWeight: 700 }}>$</span>
                  <input
                    type="number" min={0} step={0.01}
                    value={form.price}
                    onChange={(e) => setField("price", Math.max(0, Number(e.target.value)))}
                    style={{ ...IS, paddingLeft: 26 }}
                    onFocus={focusBorder} onBlur={blurBorder}
                  />
                </div>
              </InputField>

              <InputField label="Status">
                <div style={{ display: "flex", gap: 8, height: 44 }}>
                  {(["draft", "published", "archived"] as CourseStatus[]).map((s) => {
                    const colors = { published: "#45f1c5", draft: "#FFB785", archived: "#B0AEC0" };
                    const active = form.status === s;
                    return (
                      <button
                        key={s}
                        onClick={() => setField("status", s)}
                        style={{
                          flex: 1, borderRadius: 12, fontSize: 12, fontWeight: 700,
                          cursor: "pointer", transition: "all .15s",
                          background: active ? `${colors[s]}18` : "rgba(255,255,255,.04)",
                          border: `1px solid ${active ? `${colors[s]}40` : "rgba(255,255,255,.08)"}`,
                          color: active ? colors[s] : "#C7C4D8",
                        }}
                      >
                        {s.charAt(0).toUpperCase() + s.slice(1)}
                      </button>
                    );
                  })}
                </div>
              </InputField>
            </div>
          </Section>

          <Section title="Course Thumbnail" subtitle="Uploads to Cloudinary · courses/thumbnails/" icon={Image}>
            <ThumbnailUploader url={form.thumbnailUrl} onChange={(u) => setField("thumbnailUrl", u)} />
          </Section>

          <Section title="Curriculum" subtitle="Drag to reorder modules and lessons · Stored in Firestore modules array" icon={Layers}>
            <DynamicModuleList
              modules={form.modules}
              onChange={(m) => setField("modules", m)}
              error={touched.modules ? errors.modules : undefined}
            />
          </Section>
        </div>

        <CourseSummary form={form} />
      </div>
    </div>
  );
}
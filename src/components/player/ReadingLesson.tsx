// src/components/player/ReadingLesson.tsx
import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import rehypeSanitize from "rehype-sanitize";
import { LessonCompleteButton } from "./LessonCompleteButton";
import { saveResumeData, getResumeData } from "../../services/progressService";
import {
  Menu,
  BookOpen,
  Clock,
  Lightbulb,
  AlertTriangle,
  Info,
  Bookmark,
  Target,
  AlertCircle,
  X,
  Highlighter,
  StickyNote,
  Volume2,
  VolumeX,
  Sparkles,
} from "lucide-react";
import { countWords, calculateMinReadingTime, detectScrollCheat } from "../../utils/readingUtils";
import { KnowledgeCheck } from "./KnowledgeCheck";

const READING_THRESHOLD = 80;
const MAX_SCROLL_SPIKES = 10;
const MIN_READING_TIME = 30;
const ENGAGEMENT_THRESHOLD = 50;

interface Heading {
  level: number;
  text: string;
  id: string;
}

interface KnowledgeCheckQuestion {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation?: string;
}

interface ReadingLessonProps {
  userId: string;
  courseId: string;
  moduleId: string;
  lessonId: string;
  title: string;
  content: string;
  xpReward: number;
  onComplete?: () => void;
  isCompleted?: boolean;
  lessonType?: "lesson" | "quiz" | "reading" | "video" | "flashcard";
}

// ----- Helper functions (giữ nguyên) -----
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/--+/g, "-")
    .trim();
}

function extractHeadings(markdown: string): Heading[] {
  const headingRegex = /^(#{1,6})\s+(.+)$/gm;
  const headings: Heading[] = [];
  let match;
  const idCount: Record<string, number> = {};
  while ((match = headingRegex.exec(markdown)) !== null) {
    const level = match[1].length;
    const text = match[2].trim();
    const baseId = slugify(text);
    idCount[baseId] = (idCount[baseId] || 0) + 1;
    const id = idCount[baseId] > 1 ? `${baseId}-${idCount[baseId]}` : baseId;
    headings.push({ level, text, id });
  }
  return headings;
}

function estimateReadingTime(markdown: string): number {
  const plainText = markdown.replace(/[#*`\[\]()!]/g, " ").replace(/\s+/g, " ").trim();
  const wordCount = plainText.split(/\s+/).length;
  return Math.max(1, Math.ceil(wordCount / 200));
}

function enhanceContentForCards(content: string): string {
  let transformed = content;
  transformed = transformed.replace(/^>\s*(💡|Tip:|Tip\s+)\s*(.*)$/gim, (_, emoji, text) => `:::tip ${text} :::`);
  transformed = transformed.replace(/^>\s*(⚠️|Warning:|Warning\s+)\s*(.*)$/gim, (_, emoji, text) => `:::warning ${text} :::`);
  transformed = transformed.replace(/^>\s*(ℹ️|Info:|Info\s+)\s*(.*)$/gim, (_, emoji, text) => `:::info ${text} :::`);
  transformed = transformed.replace(/^>\s*(📘|Definition:|Definition\s+)\s*(.*)$/gim, (_, emoji, text) => `:::definition ${text} :::`);
  transformed = transformed.replace(/^>\s*(🎯|Important:|Important\s+)\s*(.*)$/gim, (_, emoji, text) => `:::important ${text} :::`);
  transformed = transformed.replace(/^>\s*(📝|Note:|Note\s+)\s*(.*)$/gim, (_, emoji, text) => `:::note ${text} :::`);
  return transformed;
}

const KnowledgeCard = ({
  icon,
  color,
  title,
  children,
}: {
  icon: React.ReactNode;
  color: string;
  title: string;
  children: React.ReactNode;
}) => (
  <div
    style={{
      background: `rgba(${color},0.1)`,
      borderLeft: `4px solid ${color}`,
      borderRadius: "12px",
      padding: "1rem 1.5rem",
      margin: "1.5rem 0",
    }}
  >
    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
      {icon}
      <strong style={{ color }}>{title}</strong>
    </div>
    <p style={{ margin: 0, color: "#E4E1EE" }}>{children}</p>
  </div>
);

// ----- Component -----
export function ReadingLesson({
  userId,
  courseId,
  moduleId,
  lessonId,
  title,
  content,
  xpReward,
  onComplete,
  isCompleted = false,
  lessonType = "reading",
}: ReadingLessonProps) {
  const [headings, setHeadings] = useState<Heading[]>([]);
  const [readingTime, setReadingTime] = useState(0);
  const [showToc, setShowToc] = useState(false);
  const [activeHeadingId, setActiveHeadingId] = useState<string>("");
  const [isCompletedState, setIsCompletedState] = useState(isCompleted);

  const [actualReadProgress, setActualReadProgress] = useState(0);
  const [readingTimeSpent, setReadingTimeSpent] = useState(0);
  const [scrollSpikeCount, setScrollSpikeCount] = useState(0);
  const [wordCount, setWordCount] = useState(0);
  const [knowledgeCheckPassed, setKnowledgeCheckPassed] = useState(false);
  const [isKnowledgeCheckOpen, setIsKnowledgeCheckOpen] = useState(false);
  const [showCompleteButton, setShowCompleteButton] = useState(false);

  const [engagementScore, setEngagementScore] = useState(0);
  const [sectionInteraction, setSectionInteraction] = useState(0);
  const [totalSections, setTotalSections] = useState(1);
  const [suspectedFastScroll, setSuspectedFastScroll] = useState(false);
  const [focusTimeSeconds, setFocusTimeSeconds] = useState(0);

  // --- NEW STATES ---
  const [readingNotes, setReadingNotes] = useState<Record<string, string>>({});
  const [activeNoteHeadingId, setActiveNoteHeadingId] = useState<string | null>(null);
  const [readingHighlights, setReadingHighlights] = useState<string[]>([]);
  const [readingBookmarks, setReadingBookmarks] = useState<string[]>([]);
  const [focusMode, setFocusMode] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [vocabPopup, setVocabPopup] = useState<{ word: string; x: number; y: number } | null>(null);

  const [toast, setToast] = useState<{ message: string; type: "warning" | "info" | "error"; id: number } | null>(null);

  const contentRef = useRef<HTMLDivElement>(null);
  const lastScrollTopRef = useRef(0);
  const lastScrollTimeRef = useRef(Date.now());
  const timeSpentRef = useRef(0);
  const trackerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isActiveRef = useRef(true);
  const sectionObservedRef = useRef<Set<string>>(new Set());
  const scrollSpikeCountRef = useRef(0);
  const suspectedFastScrollRef = useRef(false);

  const enhancedContent = useMemo(() => enhanceContentForCards(content), [content]);
  const minReadingTimeRequired = useMemo(
    () => Math.max(MIN_READING_TIME, calculateMinReadingTime(wordCount)),
    [wordCount]
  );

  // --- Effects (giữ nguyên) ---
  useEffect(() => {
    const wc = countWords(content);
    setWordCount(wc);
    setReadingTime(estimateReadingTime(content));
    const extracted = extractHeadings(content);
    setHeadings(extracted);
    setTotalSections(Math.max(extracted.length, 1));
  }, [content]);

  useEffect(() => {
    setIsCompletedState(isCompleted);
  }, [isCompleted]);

  const showToast = useCallback((message: string, type: "warning" | "info" | "error") => {
    setToast({ message, type, id: Date.now() });
    setTimeout(() => setToast(null), 4000);
  }, []);

  // --- Load Resume (mở rộng) ---
  useEffect(() => {
    const loadResume = async () => {
      if (!userId || !courseId || !moduleId || !lessonId || isCompletedState) return;
      const data = await getResumeData(userId, courseId, moduleId, lessonId);
      if (data) {
        if (data.readingTracking) {
          const t = data.readingTracking;
          setActualReadProgress(t.actualProgress || 0);
          setReadingTimeSpent(t.timeSpentSeconds || 0);
          setScrollSpikeCount(t.scrollSpikeCount || 0);
          scrollSpikeCountRef.current = t.scrollSpikeCount || 0;
          timeSpentRef.current = t.timeSpentSeconds || 0;
          setKnowledgeCheckPassed(t.knowledgeCheckPassed || false);
          setEngagementScore(t.engagementScore || 0);
          setSectionInteraction(t.sectionInteraction || 0);
          setTotalSections(t.totalSections || 1);
          setSuspectedFastScroll(t.suspectedFastScroll || false);
          suspectedFastScrollRef.current = t.suspectedFastScroll || false;
          setFocusTimeSeconds(t.focusTimeSeconds || 0);
          if ((t.scrollSpikeCount || 0) > MAX_SCROLL_SPIKES && !suspectedFastScrollRef.current) {
            suspectedFastScrollRef.current = true;
            setSuspectedFastScroll(true);
            showToast("Cuộn nhanh được ghi nhận – đọc kỹ để đạt tương tác tốt hơn", "warning");
          }
          sectionObservedRef.current.clear();
        }
        if (data.readingScrollTop !== undefined) {
          const restoreScroll = () => {
            const currentHeight = document.documentElement.scrollHeight;
            const targetTop = data.readingScrollTop!;
            if (currentHeight > window.innerHeight && targetTop <= currentHeight - window.innerHeight) {
              window.scrollTo({ top: targetTop, behavior: "auto" });
            } else {
              let attempts = 0;
              const interval = setInterval(() => {
                const newHeight = document.documentElement.scrollHeight;
                if (newHeight > window.innerHeight && targetTop <= newHeight - window.innerHeight) {
                  window.scrollTo({ top: targetTop, behavior: "auto" });
                  clearInterval(interval);
                } else if (attempts > 10) {
                  clearInterval(interval);
                }
                attempts++;
              }, 200);
            }
          };
          setTimeout(restoreScroll, 300);
        }
        if (data.readingTracking?.knowledgeCheckPassed) {
          setKnowledgeCheckPassed(true);
          setShowCompleteButton(true);
        }
        // NEW: load notes, highlights, bookmarks
        if (data.readingNotes) setReadingNotes(data.readingNotes);
        if (data.readingHighlights) setReadingHighlights(data.readingHighlights);
        if (data.readingBookmarks) setReadingBookmarks(data.readingBookmarks);
      }
    };
    loadResume();
  }, [userId, courseId, moduleId, lessonId, isCompletedState, showToast]);

  // --- Debounced save (mở rộng) ---
  const saveReadingTracking = useCallback(async () => {
    if (isCompletedState) return;
    const scrollTop = window.scrollY;
    await saveResumeData(userId, courseId, moduleId, lessonId, {
      readingScrollTop: scrollTop,
      readingTracking: {
        scrollProgress: actualReadProgress,
        actualProgress: actualReadProgress,
        timeSpentSeconds: readingTimeSpent,
        minTimeRequired: minReadingTimeRequired,
        wordCount,
        scrollSpikeCount: scrollSpikeCountRef.current,
        maxScrollSpikeCount: MAX_SCROLL_SPIKES,
        readWordsCount: 0,
        knowledgeCheckPassed,
        engagementScore,
        sectionInteraction,
        totalSections,
        suspectedFastScroll: suspectedFastScrollRef.current,
        focusTimeSeconds,
        lastActivityAt: Date.now(),
      },
      readingNotes,
      readingHighlights,
      readingBookmarks,
    });
  }, [
    userId,
    courseId,
    moduleId,
    lessonId,
    isCompletedState,
    actualReadProgress,
    readingTimeSpent,
    minReadingTimeRequired,
    wordCount,
    knowledgeCheckPassed,
    engagementScore,
    sectionInteraction,
    totalSections,
    focusTimeSeconds,
    readingNotes,
    readingHighlights,
    readingBookmarks,
  ]);

  const isDirtyRef = useRef(false);
  const markDirty = useCallback(() => {
    isDirtyRef.current = true;
  }, []);
  useEffect(() => {
    const interval = setInterval(() => {
      if (isDirtyRef.current) {
        saveReadingTracking();
        isDirtyRef.current = false;
      }
    }, 10_000);
    return () => clearInterval(interval);
  }, [saveReadingTracking]);

  // --- handleScroll with cheat detection ---
  const handleScroll = useCallback(() => {
    if (!contentRef.current || isCompletedState) return;
    const element = contentRef.current;
    const rect = element.getBoundingClientRect();
    const totalHeight = rect.height;
    const visibleHeight = window.innerHeight;
    const scrolled = window.scrollY - rect.top;
    const percent = totalHeight > visibleHeight
      ? Math.min(100, Math.max(0, (scrolled / (totalHeight - visibleHeight)) * 100))
      : 100;
    setActualReadProgress(percent);

    // ✅ Anti-cheat
    const now = Date.now();
    const currentTop = window.scrollY;
    const timeDelta = now - lastScrollTimeRef.current;
    if (timeDelta > 0) {
      const isCheat = detectScrollCheat(currentTop, lastScrollTopRef.current, timeDelta);
      if (isCheat) {
        scrollSpikeCountRef.current += 1;
        setScrollSpikeCount(scrollSpikeCountRef.current);
        if (scrollSpikeCountRef.current > MAX_SCROLL_SPIKES && !suspectedFastScrollRef.current) {
          suspectedFastScrollRef.current = true;
          setSuspectedFastScroll(true);
          showToast("Cuộn nhanh được ghi nhận – đọc kỹ để đạt tương tác tốt hơn", "warning");
        }
      }
    }
    lastScrollTopRef.current = currentTop;
    lastScrollTimeRef.current = now;

    markDirty();
  }, [isCompletedState, markDirty, showToast]);

  useEffect(() => {
    window.addEventListener("scroll", handleScroll);
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, [handleScroll]);

  // --- Time tracking ---
  useEffect(() => {
    if (isCompletedState) return;

    const interval = setInterval(() => {
      if (!document.hidden && isActiveRef.current) {
        timeSpentRef.current += 1;
        setReadingTimeSpent((prev) => prev + 1);
        setFocusTimeSeconds((prev) => prev + 1);
        markDirty();
      }
    }, 1000);

    trackerIntervalRef.current = interval;

    const handleVisibilityChange = () => {
      isActiveRef.current = !document.hidden;
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      if (trackerIntervalRef.current) clearInterval(trackerIntervalRef.current);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [isCompletedState, markDirty]);

  // --- Section observer ---
  useEffect(() => {
    if (headings.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const id = entry.target.id;
          if (entry.isIntersecting) {
            setActiveHeadingId(id);
            if (!sectionObservedRef.current.has(id)) {
              sectionObservedRef.current.add(id);
              setSectionInteraction((prev) => Math.min(prev + 1, totalSections));
              markDirty();
            }
          }
        });
      },
      { threshold: 0.3, rootMargin: "-80px 0px -70% 0px" }
    );

    headings.forEach((heading) => {
      const el = document.getElementById(heading.id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [headings, totalSections, markDirty]);

  // --- Engagement score ---
  const computeEngagementScore = useCallback(() => {
    const coverage = actualReadProgress;
    const timeRatio = Math.min(readingTimeSpent / minReadingTimeRequired, 1);
    const sectionRatio = totalSections > 0 ? Math.min(sectionInteraction / totalSections, 1) : 1;
    const score = coverage * 0.5 + timeRatio * 0.3 + sectionRatio * 0.2;
    return Math.min(100, Math.round(score));
  }, [actualReadProgress, readingTimeSpent, minReadingTimeRequired, sectionInteraction, totalSections]);

  useEffect(() => {
    const newScore = computeEngagementScore();
    setEngagementScore(newScore);
    markDirty();
  }, [computeEngagementScore, markDirty]);

  // --- Knowledge check trigger ---
  const shouldShowKnowledgeCheck = useMemo(() => {
    const coverageOk = actualReadProgress >= 80;
    const timeOk = readingTimeSpent >= minReadingTimeRequired;
    const engOk = engagementScore >= ENGAGEMENT_THRESHOLD;
    return coverageOk && timeOk && engOk && !knowledgeCheckPassed && !isCompletedState;
  }, [actualReadProgress, readingTimeSpent, minReadingTimeRequired, engagementScore, knowledgeCheckPassed, isCompletedState]);

  useEffect(() => {
    if (shouldShowKnowledgeCheck && !isKnowledgeCheckOpen && !knowledgeCheckPassed) {
      showToast("📝 Bạn đã đọc đủ nội dung! Hãy thử kiểm tra nhanh 3 câu.", "info");
      setTimeout(() => setIsKnowledgeCheckOpen(true), 1200);
    }
  }, [shouldShowKnowledgeCheck, showToast]);

  const handleKnowledgeCheckPass = () => {
    setKnowledgeCheckPassed(true);
    setShowCompleteButton(true);
    setIsKnowledgeCheckOpen(false);
    markDirty();
    saveReadingTracking();
  };

  const handleKnowledgeCheckFail = () => {
    setIsKnowledgeCheckOpen(true);
  };

  // --- Complete button conditions ---
  const canComplete = knowledgeCheckPassed && actualReadProgress >= 80 && !isCompletedState;

  const requirementMessage = useMemo(() => {
    if (isCompletedState) return "";
    if (actualReadProgress < 80) {
      return `📖 Đã đọc ${Math.round(actualReadProgress)}%, cần 80%`;
    }
    if (readingTimeSpent < minReadingTimeRequired) {
      return `⏱️ Cần đọc thêm ${Math.round(minReadingTimeRequired - readingTimeSpent)} giây`;
    }
    if (engagementScore < ENGAGEMENT_THRESHOLD) {
      return `📊 Điểm tương tác ${engagementScore}%, cần ${ENGAGEMENT_THRESHOLD}%`;
    }
    if (!knowledgeCheckPassed) {
      return "📝 Cần vượt qua kiểm tra nhanh để hoàn thành.";
    }
    return "";
  }, [actualReadProgress, readingTimeSpent, minReadingTimeRequired, engagementScore, knowledgeCheckPassed, isCompletedState]);

  // --- Knowledge check questions ---
  const knowledgeCheckQuestions: KnowledgeCheckQuestion[] = useMemo(() => {
    const generated: KnowledgeCheckQuestion[] = [];
    const selectedHeadings = headings.slice(0, 3);

    selectedHeadings.forEach((h, idx) => {
      if (h.text.length < 3) return;

      const wrongOptions = headings
        .filter((_, i) => i !== idx)
        .map((h2) => h2.text)
        .slice(0, 3);

      while (wrongOptions.length < 3) {
        wrongOptions.push("Nội dung không được đề cập trong bài");
      }

      const options = [h.text, ...wrongOptions];

      const shuffled = options.map((opt, i) => ({ opt, idx: i }));
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }

      const correctIndex = shuffled.findIndex((item) => item.opt === h.text);

      const stableId = `kq_${idx}_${h.text.slice(0, 8).replace(/\s+/g, "_")}`;
      generated.push({
        id: stableId,
        question: `Theo bài đọc, nội dung chính của phần "${h.text}" là gì?`,
        options: shuffled.map((item) => item.opt),
        correctIndex,
        explanation: `Đáp án đúng là "${h.text}" – đây là tiêu đề chính của phần này.`,
      });
    });

    if (generated.length === 0) {
      const defaultOptions = [
        "Kiến thức chuyên sâu về chủ đề",
        "Hướng dẫn thực hành",
        "Tổng quan và giới thiệu",
        "Phân tích và đánh giá",
      ];

      const shuffled = defaultOptions.map((opt, i) => ({ opt, idx: i }));
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }

      const correctIndex = shuffled.findIndex((item) => item.opt === "Kiến thức chuyên sâu về chủ đề");

      generated.push({
        id: "kq_default",
        question: "Nội dung chính của bài đọc này là gì?",
        options: shuffled.map((item) => item.opt),
        correctIndex,
        explanation: "Bài đọc cung cấp kiến thức chuyên sâu về chủ đề.",
      });
    }

    return generated.slice(0, 3);
  }, [headings]);

  // --- NEW: TTS ---
  const speak = useCallback(() => {
    const plainText = enhancedContent.replace(/[#*`>[\]()!:]/g, " ").replace(/\s+/g, " ");
    const utterance = new SpeechSynthesisUtterance(plainText);
    utterance.lang = "vi-VN";
    utterance.onend = () => setIsSpeaking(false);
    window.speechSynthesis.speak(utterance);
    setIsSpeaking(true);
  }, [enhancedContent]);

  const stopSpeaking = () => {
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
  };

  // --- NEW: Vocabulary popup via double-click ---
  useEffect(() => {
    const handleDoubleClick = (e: MouseEvent) => {
      const selection = window.getSelection()?.toString().trim();
      if (selection && selection.split(/\s+/).length === 1) {
        setVocabPopup({ word: selection, x: e.clientX, y: e.clientY });
      }
    };
    document.addEventListener("dblclick", handleDoubleClick);
    return () => document.removeEventListener("dblclick", handleDoubleClick);
  }, []);

  // --- NEW: toggle bookmark ---
  const toggleBookmark = (headingId: string) => {
    setReadingBookmarks((prev) =>
      prev.includes(headingId) ? prev.filter((id) => id !== headingId) : [...prev, headingId]
    );
    markDirty();
  };

  // --- NEW: toggle highlight for heading ---
  const toggleHighlight = (headingId: string) => {
    setReadingHighlights((prev) =>
      prev.includes(headingId) ? prev.filter((id) => id !== headingId) : [...prev, headingId]
    );
    markDirty();
  };

  // ---- Render ----
  const markdownComponents = {
    h1: ({ children }: any) => {
      const text = children?.toString() || "";
      const id = slugify(text);
      return (
        <h1
          id={id}
          style={{
            fontSize: "2.5rem",
            fontWeight: 800,
            marginTop: "2rem",
            marginBottom: "1rem",
            color: "#E4E1EE",
          }}
        >
          {children}
        </h1>
      );
    },
    h2: ({ children }: any) => {
      const text = children?.toString() || "";
      const id = slugify(text);
      const isBookmarked = readingBookmarks.includes(id);
      const isHighlighted = readingHighlights.includes(id);
      const note = readingNotes[id] || "";
      return (
        <div style={{ position: "relative" }}>
          <h2
            id={id}
            style={{
              fontSize: "1.8rem",
              fontWeight: 700,
              marginTop: "2rem",
              marginBottom: "1rem",
              color: "#E4E1EE",
              borderLeft: "4px solid #6C63FF",
              paddingLeft: "0.75rem",
            }}
          >
            {children}
            <span style={{ marginLeft: 8, display: "inline-flex", gap: 6, verticalAlign: "middle" }}>
              <button
                onClick={() => toggleBookmark(id)}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: isBookmarked ? "#FFB785" : "#47464f",
                }}
              >
                <Bookmark size={14} fill={isBookmarked ? "#FFB785" : "none"} />
              </button>
              <button
                onClick={() => setActiveNoteHeadingId(id === activeNoteHeadingId ? null : id)}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: note ? "#6C63FF" : "#47464f",
                }}
              >
                <StickyNote size={14} />
              </button>
              <button
                onClick={() => toggleHighlight(id)}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: isHighlighted ? "#FFD700" : "#47464f",
                }}
              >
                <Highlighter size={14} />
              </button>
            </span>
          </h2>
          {isHighlighted && (
            <div
              style={{
                background: "rgba(255,215,0,0.12)",
                padding: "4px 12px",
                borderRadius: 4,
                marginBottom: 8,
                fontSize: 12,
                color: "#FFD700",
              }}
            >
              ✨ Highlighted section
            </div>
          )}
          {activeNoteHeadingId === id && (
            <div
              style={{
                marginTop: 8,
                marginBottom: 16,
                background: "rgba(108,99,255,0.08)",
                borderRadius: 8,
                padding: 12,
                border: "1px solid rgba(108,99,255,0.2)",
              }}
            >
              <textarea
                value={note}
                onChange={(e) => {
                  setReadingNotes((prev) => ({ ...prev, [id]: e.target.value }));
                  markDirty();
                }}
                placeholder="Write your note..."
                rows={2}
                style={{
                  width: "100%",
                  background: "#0d0d18",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 8,
                  padding: 8,
                  color: "#E4E1EE",
                  fontSize: 13,
                  resize: "vertical",
                }}
              />
              <button
                onClick={() => setActiveNoteHeadingId(null)}
                style={{ marginTop: 6, background: "none", border: "none", color: "#C7C4D8", cursor: "pointer", fontSize: 12 }}
              >
                Close
              </button>
            </div>
          )}
        </div>
      );
    },
    h3: ({ children }: any) => {
      const text = children?.toString() || "";
      const id = slugify(text);
      const isBookmarked = readingBookmarks.includes(id);
      const isHighlighted = readingHighlights.includes(id);
      const note = readingNotes[id] || "";
      return (
        <div style={{ position: "relative" }}>
          <h3
            id={id}
            style={{
              fontSize: "1.4rem",
              fontWeight: 600,
              marginTop: "1.5rem",
              marginBottom: "0.75rem",
              color: "#c4c0ff",
            }}
          >
            {children}
            <span style={{ marginLeft: 8, display: "inline-flex", gap: 6, verticalAlign: "middle" }}>
              <button
                onClick={() => toggleBookmark(id)}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: isBookmarked ? "#FFB785" : "#47464f",
                }}
              >
                <Bookmark size={14} fill={isBookmarked ? "#FFB785" : "none"} />
              </button>
              <button
                onClick={() => setActiveNoteHeadingId(id === activeNoteHeadingId ? null : id)}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: note ? "#6C63FF" : "#47464f",
                }}
              >
                <StickyNote size={14} />
              </button>
              <button
                onClick={() => toggleHighlight(id)}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: isHighlighted ? "#FFD700" : "#47464f",
                }}
              >
                <Highlighter size={14} />
              </button>
            </span>
          </h3>
          {isHighlighted && (
            <div
              style={{
                background: "rgba(255,215,0,0.12)",
                padding: "4px 12px",
                borderRadius: 4,
                marginBottom: 8,
                fontSize: 12,
                color: "#FFD700",
              }}
            >
              ✨ Highlighted section
            </div>
          )}
          {activeNoteHeadingId === id && (
            <div
              style={{
                marginTop: 8,
                marginBottom: 16,
                background: "rgba(108,99,255,0.08)",
                borderRadius: 8,
                padding: 12,
                border: "1px solid rgba(108,99,255,0.2)",
              }}
            >
              <textarea
                value={note}
                onChange={(e) => {
                  setReadingNotes((prev) => ({ ...prev, [id]: e.target.value }));
                  markDirty();
                }}
                placeholder="Write your note..."
                rows={2}
                style={{
                  width: "100%",
                  background: "#0d0d18",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 8,
                  padding: 8,
                  color: "#E4E1EE",
                  fontSize: 13,
                  resize: "vertical",
                }}
              />
              <button
                onClick={() => setActiveNoteHeadingId(null)}
                style={{ marginTop: 6, background: "none", border: "none", color: "#C7C4D8", cursor: "pointer", fontSize: 12 }}
              >
                Close
              </button>
            </div>
          )}
        </div>
      );
    },
    // ... các components khác giữ nguyên (h4, h5, h6, p, ul, ol, li, blockquote, code, table, th, td)
    // Để tiết kiệm, tôi giữ nguyên phần còn lại từ file gốc. Bạn đã có sẵn.
    // Nếu cần, hãy copy phần này từ file cũ.
    // Dưới đây là phần placeholder cho các components khác (bạn có thể giữ nguyên từ bản cũ)
    h4: ({ children }: any) => {
      const text = children?.toString() || "";
      const id = slugify(text);
      return (
        <h4
          id={id}
          style={{
            fontSize: "1.2rem",
            fontWeight: 600,
            marginTop: "1.2rem",
            marginBottom: "0.5rem",
            color: "#c4c0ff",
          }}
        >
          {children}
        </h4>
      );
    },
    h5: ({ children }: any) => {
      const text = children?.toString() || "";
      const id = slugify(text);
      return (
        <h5
          id={id}
          style={{
            fontSize: "1.1rem",
            fontWeight: 500,
            marginTop: "1rem",
            marginBottom: "0.5rem",
            color: "#c4c0ff",
          }}
        >
          {children}
        </h5>
      );
    },
    h6: ({ children }: any) => {
      const text = children?.toString() || "";
      const id = slugify(text);
      return (
        <h6
          id={id}
          style={{
            fontSize: "1rem",
            fontWeight: 500,
            marginTop: "1rem",
            marginBottom: "0.5rem",
            color: "#c4c0ff",
          }}
        >
          {children}
        </h6>
      );
    },
    p: ({ children }: any) => (
      <p style={{ fontSize: "1.1rem", lineHeight: 1.8, marginBottom: "1.5rem", color: "#E4E1EE" }}>{children}</p>
    ),
    ul: ({ children }: any) => (
      <ul style={{ marginLeft: "1.5rem", marginBottom: "1.5rem", listStyleType: "disc" }}>{children}</ul>
    ),
    ol: ({ children }: any) => (
      <ol style={{ marginLeft: "1.5rem", marginBottom: "1.5rem", listStyleType: "decimal" }}>{children}</ol>
    ),
    li: ({ children }: any) => (
      <li style={{ marginBottom: "0.5rem", fontSize: "1rem", lineHeight: 1.7 }}>{children}</li>
    ),
    blockquote: ({ children }: any) => {
      const text = children?.toString() || "";
      const matchTip = text.match(/:::tip\s*(.*?)\s*:::/s);
      const matchWarning = text.match(/:::warning\s*(.*?)\s*:::/s);
      const matchInfo = text.match(/:::info\s*(.*?)\s*:::/s);
      const matchDefinition = text.match(/:::definition\s*(.*?)\s*:::/s);
      const matchImportant = text.match(/:::important\s*(.*?)\s*:::/s);
      const matchNote = text.match(/:::note\s*(.*?)\s*:::/s);
      if (matchTip)
        return (
          <KnowledgeCard icon={<Lightbulb size={20} color="#45f1c5" />} color="#45f1c5" title="💡 Tip">
            {matchTip[1]}
          </KnowledgeCard>
        );
      if (matchWarning)
        return (
          <KnowledgeCard icon={<AlertTriangle size={20} color="#ff6b6b" />} color="#ff6b6b" title="⚠️ Warning">
            {matchWarning[1]}
          </KnowledgeCard>
        );
      if (matchInfo)
        return (
          <KnowledgeCard icon={<Info size={20} color="#6C63FF" />} color="#6C63FF" title="ℹ️ Info">
            {matchInfo[1]}
          </KnowledgeCard>
        );
      if (matchDefinition)
        return (
          <KnowledgeCard icon={<BookOpen size={20} color="#c4c0ff" />} color="#c4c0ff" title="📘 Definition">
            {matchDefinition[1]}
          </KnowledgeCard>
        );
      if (matchImportant)
        return (
          <KnowledgeCard icon={<Target size={20} color="#FFB785" />} color="#FFB785" title="🎯 Important">
            {matchImportant[1]}
          </KnowledgeCard>
        );
      if (matchNote)
        return (
          <KnowledgeCard icon={<Bookmark size={20} color="#C7C4D8" />} color="#C7C4D8" title="📝 Note">
            {matchNote[1]}
          </KnowledgeCard>
        );
      return (
        <blockquote
          style={{
            borderLeft: "4px solid #6C63FF",
            paddingLeft: "1.5rem",
            fontStyle: "italic",
            margin: "1.5rem 0",
            color: "#C7C4D8",
          }}
        >
          {children}
        </blockquote>
      );
    },
    code: ({ inline, children }: any) => {
      if (inline) {
        return (
          <code
            style={{
              background: "rgba(108,99,255,0.2)",
              padding: "0.2rem 0.4rem",
              borderRadius: "6px",
              fontSize: "0.9rem",
              color: "#c4c0ff",
            }}
          >
            {children}
          </code>
        );
      }
      return (
        <pre style={{ background: "#0d0d18", padding: "1rem", borderRadius: "12px", overflowX: "auto", margin: "1.5rem 0" }}>
          <code style={{ fontSize: "0.9rem", color: "#E4E1EE" }}>{children}</code>
        </pre>
      );
    },
    table: ({ children }: any) => (
      <div style={{ overflowX: "auto", margin: "1.5rem 0" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", background: "rgba(255,255,255,0.02)", borderRadius: "8px" }}>
          {children}
        </table>
      </div>
    ),
    th: ({ children }: any) => (
      <th style={{ border: "1px solid rgba(255,255,255,0.1)", padding: "0.75rem", textAlign: "left", fontWeight: 700 }}>
        {children}
      </th>
    ),
    td: ({ children }: any) => <td style={{ border: "1px solid rgba(255,255,255,0.1)", padding: "0.75rem" }}>{children}</td>,
  };

  // --- TOC render with bookmarks ---
  const renderToc = () => {
    const bookmarkedHeadings = headings.filter((h) => readingBookmarks.includes(h.id));
    const otherHeadings = headings.filter((h) => !readingBookmarks.includes(h.id));
    return (
      <nav
        style={{
          position: "sticky",
          top: "80px",
          background: "rgba(15,15,26,0.9)",
          borderRadius: "16px",
          padding: "1rem",
          border: "1px solid rgba(255,255,255,0.08)",
          maxHeight: "80vh",
          overflowY: "auto",
        }}
      >
        <h4 style={{ fontSize: "0.9rem", fontWeight: 700, color: "#C7C4D8", marginBottom: "1rem", letterSpacing: "0.05em" }}>
          📑 CONTENTS
        </h4>
        {/* Bookmarks first */}
        {bookmarkedHeadings.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 10, color: "#FFB785", fontWeight: 700, letterSpacing: ".05em", marginBottom: 6 }}>
              📌 BOOKMARKS
            </div>
            {bookmarkedHeadings.map((h) => (
              <div key={h.id} style={{ marginBottom: "0.5rem" }}>
                <a
                  href={`#${h.id}`}
                  onClick={(e) => {
                    e.preventDefault();
                    document.getElementById(h.id)?.scrollIntoView({ behavior: "smooth" });
                  }}
                  style={{
                    display: "block",
                    fontSize: "0.85rem",
                    color: activeHeadingId === h.id ? "#6C63FF" : "#FFB785",
                    textDecoration: "none",
                    paddingLeft: `${(h.level - 1) * 14}px`,
                    transition: "color 0.2s",
                    fontWeight: activeHeadingId === h.id ? 600 : 400,
                  }}
                >
                  {h.text}
                </a>
              </div>
            ))}
          </div>
        )}
        {/* Other headings */}
        {otherHeadings.map((heading) => (
          <div key={heading.id} style={{ marginBottom: "0.5rem" }}>
            <a
              href={`#${heading.id}`}
              onClick={(e) => {
                e.preventDefault();
                document.getElementById(heading.id)?.scrollIntoView({ behavior: "smooth" });
              }}
              style={{
                display: "block",
                fontSize: "0.85rem",
                color: activeHeadingId === heading.id ? "#6C63FF" : "#C7C4D8",
                textDecoration: "none",
                paddingLeft: `${(heading.level - 1) * 14}px`,
                transition: "color 0.2s",
                fontWeight: activeHeadingId === heading.id ? 600 : 400,
              }}
            >
              {heading.text}
            </a>
          </div>
        ))}
      </nav>
    );
  };

  // ---- Main JSX ----
  return (
    <div style={{ maxWidth: "100%", margin: "0 auto", position: "relative" }}>
      {toast && (
        <div
          style={{
            position: "fixed",
            bottom: "20px",
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 1000,
            background: toast.type === "warning" ? "#ffb785" : toast.type === "info" ? "#6C63FF" : "#ff6b6b",
            color: "#0F0F1A",
            padding: "12px 24px",
            borderRadius: "12px",
            boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
            display: "flex",
            alignItems: "center",
            gap: "12px",
            fontSize: "14px",
            fontWeight: 500,
            maxWidth: "90%",
          }}
        >
          <span>{toast.message}</span>
          <button onClick={() => setToast(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "inherit" }}>
            <X size={18} />
          </button>
        </div>
      )}

      {/* Vocabulary Popup */}
      {vocabPopup && (
        <div
          style={{
            position: "fixed",
            left: vocabPopup.x + 12,
            top: vocabPopup.y - 10,
            background: "#1A1A2E",
            border: "1px solid rgba(108,99,255,0.3)",
            borderRadius: 12,
            padding: "12px 16px",
            zIndex: 999,
            maxWidth: 250,
            boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
          }}
          onMouseLeave={() => setVocabPopup(null)}
        >
          <div style={{ fontSize: 16, fontWeight: 700, color: "#E4E1EE" }}>{vocabPopup.word}</div>
          <div style={{ fontSize: 13, color: "#C7C4D8", marginTop: 4 }}>💡 Tra từ điển (AI) — sắp có</div>
          <button
            onClick={() => setVocabPopup(null)}
            style={{ marginTop: 8, background: "none", border: "none", color: "#C7C4D8", cursor: "pointer", fontSize: 12 }}
          >
            Đóng
          </button>
        </div>
      )}

      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 10,
          background: "#0F0F1A",
          paddingTop: "0.5rem",
          borderBottom: "1px solid rgba(255,255,255,0.05)",
        }}
      >
        <div style={{ height: 6, background: "rgba(255,255,255,0.1)", borderRadius: 3, marginBottom: "0.5rem" }}>
          <div
            style={{
              width: `${Math.min(100, actualReadProgress)}%`,
              height: "100%",
              background: canComplete ? "#45f1c5" : "#6C63FF",
              borderRadius: 3,
              transition: "width 0.2s ease",
            }}
          />
        </div>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: "0.75rem",
            color: "#C7C4D8",
            marginBottom: "0.5rem",
            gap: "0.5rem",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
            <span>
              <Clock size={12} style={{ verticalAlign: "middle" }} /> {readingTime} min read
            </span>
            <span>
              <BookOpen size={12} style={{ verticalAlign: "middle" }} /> {Math.round(actualReadProgress)}% read
            </span>
            {readingTimeSpent < minReadingTimeRequired && (
              <span
                style={{
                  fontSize: "0.7rem",
                  background: "rgba(255,255,255,0.05)",
                  padding: "2px 8px",
                  borderRadius: 10,
                }}
              >
                {readingTimeSpent}/{minReadingTimeRequired}s
              </span>
            )}
            {knowledgeCheckPassed && (
              <span style={{ color: "#45f1c5", fontSize: "0.7rem" }}>✅ Đã kiểm tra</span>
            )}
            {!knowledgeCheckPassed && actualReadProgress >= 80 && engagementScore >= ENGAGEMENT_THRESHOLD && (
              <span style={{ color: "#FFB785", fontSize: "0.7rem" }}>📝 Chờ kiểm tra</span>
            )}
            {/* TTS Button */}
            {!isSpeaking ? (
              <button
                onClick={speak}
                style={{
                  background: "rgba(108,99,255,0.15)",
                  border: "none",
                  borderRadius: 20,
                  padding: "2px 10px",
                  fontSize: "0.7rem",
                  color: "#c4c0ff",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <Volume2 size={12} /> Đọc to
              </button>
            ) : (
              <button
                onClick={stopSpeaking}
                style={{
                  background: "rgba(255,180,171,0.15)",
                  border: "none",
                  borderRadius: 20,
                  padding: "2px 10px",
                  fontSize: "0.7rem",
                  color: "#ffb4ab",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <VolumeX size={12} /> Dừng
              </button>
            )}
            {/* Focus mode toggle */}
            <button
              onClick={() => setFocusMode((f) => !f)}
              style={{
                background: focusMode ? "rgba(69,241,197,0.15)" : "rgba(255,255,255,0.05)",
                border: "none",
                borderRadius: 20,
                padding: "2px 10px",
                fontSize: "0.7rem",
                color: focusMode ? "#45f1c5" : "#C7C4D8",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              {focusMode ? "🎯 Thoát Focus" : "🎯 Focus Mode"}
            </button>
          </div>
          <button
            onClick={() => setShowToc(!showToc)}
            style={{
              background: "rgba(108,99,255,0.2)",
              border: "none",
              borderRadius: "20px",
              padding: "0.2rem 0.75rem",
              fontSize: "0.7rem",
              color: "#c4c0ff",
              display: "flex",
              alignItems: "center",
              gap: "0.25rem",
              cursor: "pointer",
            }}
          >
            <Menu size={12} /> {showToc ? "Hide" : "Show"} TOC
          </button>
        </div>
        {suspectedFastScroll && (
          <div
            style={{
              background: "rgba(255,180,0,0.15)",
              color: "#FFB785",
              padding: "4px 12px",
              borderRadius: 8,
              marginBottom: "0.5rem",
              fontSize: "0.75rem",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <AlertCircle size={14} />
            <span>⚠️ Cuộn nhanh được ghi nhận – vẫn có thể hoàn thành nếu đủ điều kiện.</span>
          </div>
        )}
      </div>

      <div style={{ display: "flex", gap: "2rem", maxWidth: "1200px", margin: "0 auto", padding: "0 1rem" }}>
        {!focusMode && (
          <aside
            className="reading-toc-sidebar"
            style={{
              width: "250px",
              display: showToc ? "block" : "none",
              flexShrink: 0,
            }}
          >
            {renderToc()}
          </aside>
        )}

        <main
          ref={contentRef}
          style={{
            flex: 1,
            maxWidth: focusMode ? "680px" : "780px",
            margin: "0 auto",
          }}
        >
          {!focusMode && (
            <h1 style={{ fontSize: "2.8rem", fontWeight: 800, marginBottom: "1rem", color: "#E4E1EE" }}>{title}</h1>
          )}

          {!focusMode && (
            <div
              style={{
                display: "flex",
                gap: 16,
                fontSize: 13,
                color: "#C7C4D8",
                marginBottom: 24,
                padding: "12px 16px",
                background: "rgba(255,255,255,0.03)",
                borderRadius: 12,
              }}
            >
              <span>📝 {wordCount} từ</span>
              <span>⏱️ {Math.ceil(wordCount / 200)} phút đọc</span>
              <span>📌 {readingBookmarks.length} bookmark</span>
            </div>
          )}

          <div style={{ fontSize: "1.1rem", lineHeight: 1.8, color: "#E4E1EE" }}>
            <ReactMarkdown rehypePlugins={[rehypeRaw, rehypeSanitize]} components={markdownComponents}>
              {enhancedContent}
            </ReactMarkdown>
          </div>

          {isKnowledgeCheckOpen && (
            <div style={{ marginTop: "2rem" }}>
              <KnowledgeCheck
                questions={knowledgeCheckQuestions}
                onPass={handleKnowledgeCheckPass}
                onFail={handleKnowledgeCheckFail}
                isOpen={isKnowledgeCheckOpen}
              />
            </div>
          )}

          <div style={{ marginTop: "3rem", textAlign: "center", paddingBottom: "2rem" }}>
            {knowledgeCheckPassed && (
              <div style={{ marginBottom: 12, color: "#45f1c5", fontSize: 14 }}>✅ Đã vượt qua kiểm tra nhanh!</div>
            )}
            <LessonCompleteButton
              userId={userId}
              courseId={courseId}
              moduleId={moduleId}
              lessonId={lessonId}
              xpReward={xpReward}
              onComplete={onComplete}
              disabled={!canComplete}
              isCompleted={isCompletedState}
              lessonType={lessonType}
              requirementsMet={canComplete}
              requirementMessage={requirementMessage}
            />
            {!isCompletedState && !canComplete && (
              <div style={{ marginTop: 8 }}>
                {requirementMessage && (
                  <p style={{ fontSize: "0.85rem", color: "#FFB785" }}>{requirementMessage}</p>
                )}
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Responsive TOC overlay (mobile) */}
      <style>{`
        @media (max-width: 768px) {
          .reading-toc-sidebar {
            position: fixed !important;
            inset: 0 !important;
            width: 100% !important;
            z-index: 999;
            background: #0F0F1A;
            padding: 20px;
            overflow-y: auto;
          }
        }
      `}</style>
    </div>
  );
}
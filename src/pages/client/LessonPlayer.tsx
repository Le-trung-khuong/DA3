// src/pages/client/LessonPlayer.tsx
/**
 * Lesson Player — hỗ trợ Drip Content, Prerequisites, Sidebar, Prev/Next, Pomodoro
 */
import React, { useEffect, useState, useMemo, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useDocument } from "../../hooks/useFirestore";
import { useProgress } from "../../hooks/useProgress";
import { useAuth } from "../../contexts/AuthContext";
import { useUserEnrollment } from "../../hooks/useUserEnrollment";
import { ArrowLeft, ArrowRight, Loader, Lock, AlertCircle } from "lucide-react";
import { VideoLesson } from "../../components/player/VideoLesson";
import { QuizLesson } from "../../components/player/QuizLesson";
import { ReadingLesson } from "../../components/player/ReadingLesson";
import { FlashcardLesson } from "../../components/player/FlashcardLesson";
import { LessonSidebar } from "../../components/player/LessonSidebar";
import { PomodoroWidget } from "../../components/player/PomodoroWidget";
import { useLevelUp } from "../../hooks/useLevelUp";
import { LevelUpNotification } from "../../components/common/LevelUpNotification";
import { updateRecentLessons } from "../../services/recentLessonsService";

// ===== Types =====
interface Lesson {
  id: string;
  title: string;
  type: string;
  duration: number;
  videoUrl?: string;
  xpReward: number;
  isFree: boolean;
  order: number;
  releaseAt?: string | Date;
  prerequisites?: string[];
  content?: {
    type: string;
    data: any;
  };
}

interface Module {
  id: string;
  title: string;
  order: number;
  lessons: Lesson[];
}

interface Course {
  id: string;
  title: string;
  modules: Module[];
}

// ===== Component =====
export default function LessonPlayer() {
  const { courseId, moduleId, lessonId } = useParams<{
    courseId: string;
    moduleId: string;
    lessonId: string;
  }>();
  const navigate = useNavigate();
  const { currentUser, userProfile, loading: authLoading } = useAuth();
  const userId = currentUser?.uid;

  const { data: course, loading: courseLoading, error: courseError } = useDocument<Course>("courses", courseId);
  const { progress, isLessonCompleted, getFlashcardProgress, getQuizScore } = useProgress(userId, courseId);
  const { isEnrolled, loading: enrollmentLoading } = useUserEnrollment(userId, courseId);
  const { levelUpData, clearLevelUp } = useLevelUp(userProfile?.totalXP);

  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [moduleTitle, setModuleTitle] = useState("");
  const [lessonLoading, setLessonLoading] = useState(true);

  // ===== Auth guard =====
  if (!authLoading && !userId) {
    return (
      <div style={{ textAlign: "center", padding: 60, color: "#C7C4D8" }}>
        <p>Vui lòng đăng nhập để tiếp tục.</p>
        <Link to="/login" style={{ color: "#6C63FF", marginTop: 12, display: "inline-block" }}>
          Đăng nhập
        </Link>
      </div>
    );
  }

  // ===== Load lesson =====
  useEffect(() => {
    if (course && moduleId && lessonId) {
      setLessonLoading(true);
      const mod = course.modules.find((m) => m.id === moduleId);
      if (mod) {
        setModuleTitle(mod.title);
        const foundLesson = mod.lessons.find((l) => l.id === lessonId);
        if (foundLesson) {
          setLesson(foundLesson);
        } else {
          navigate(`/courses/${courseId}`);
        }
      } else {
        navigate(`/courses/${courseId}`);
      }
      setLessonLoading(false);
    }
  }, [course, moduleId, lessonId, navigate]);

  // ===== Flat lessons for navigation =====
  const flatLessons = useMemo(() => {
    if (!course) return [];
    const sortedModules = [...course.modules].sort((a, b) => a.order - b.order);
    return sortedModules.flatMap((m) =>
      [...m.lessons].sort((a, b) => a.order - b.order).map((l) => ({ moduleId: m.id, lesson: l }))
    );
  }, [course]);

  const currentFlatIndex = useMemo(
    () => flatLessons.findIndex((x) => x.moduleId === moduleId && x.lesson.id === lessonId),
    [flatLessons, moduleId, lessonId]
  );

  const prevItem = currentFlatIndex > 0 ? flatLessons[currentFlatIndex - 1] : null;
  const nextItem =
    currentFlatIndex >= 0 && currentFlatIndex < flatLessons.length - 1
      ? flatLessons[currentFlatIndex + 1]
      : null;

  const goToLesson = (item: { moduleId: string; lesson: Lesson }) => {
    navigate(`/learn/${courseId}/${item.moduleId}/${item.lesson.id}`);
  };

  // ===== isLessonLocked for sidebar =====
  const isLessonLocked = useCallback(
    (l: Lesson) => {
      if (l.releaseAt && new Date(l.releaseAt) > new Date()) return true;
      if (l.prerequisites?.length) {
        return l.prerequisites.some((id) => !progress.some((p) => p.lessonId === id && p.status === "completed"));
      }
      return false;
    },
    [progress]
  );

  // ===== Save recent lessons =====
  useEffect(() => {
    if (userId && lesson && courseId && moduleId && lessonId) {
      updateRecentLessons(userId, {
        courseId,
        moduleId,
        lessonId,
        lessonTitle: lesson.title,
        viewedAt: Date.now(),
      });
    }
  }, [userId, lesson, courseId, moduleId, lessonId]);

  // ===== Handle complete =====
  const handleLessonComplete = () => {
    navigate(`/learn/${courseId}/${moduleId}/${lessonId}`, { replace: true });
  };

  // ===== Loading =====
  if (courseLoading || lessonLoading || enrollmentLoading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", height: "60vh", gap: 16 }}>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <div
          style={{
            width: 52,
            height: 52,
            borderRadius: 16,
            background: "linear-gradient(135deg,#6C63FF,#9B59B6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 0 28px rgba(108,99,255,0.4)",
            animation: "spin 1.5s linear infinite",
          }}
        >
          <Loader size={24} color="#fff" />
        </div>
        <span style={{ fontSize: 13, color: "#C7C4D8", fontWeight: 600 }}>Đang tải bài học...</span>
      </div>
    );
  }

  if (courseError || !course || !lesson) {
    return (
      <div style={{ textAlign: "center", padding: 60, color: "#C7C4D8" }}>
        <p>Lesson not found. <Link to={`/courses/${courseId}`}>Back to course</Link></p>
      </div>
    );
  }

  // ===== Drip & Prerequisite checks =====
  if (lesson.releaseAt) {
    const releaseDate = new Date(lesson.releaseAt);
    if (releaseDate > new Date()) {
      return (
        <div style={{ textAlign: "center", padding: 40 }}>
          <Lock size={48} color="#6C63FF" />
          <h2 style={{ fontSize: 22, fontWeight: 700, color: "#E4E1EE", marginTop: 16 }}>Bài học chưa được mở</h2>
          <p style={{ fontSize: 14, color: "#C7C4D8" }}>
            Bài học này sẽ được mở vào ngày {releaseDate.toLocaleDateString()} lúc {releaseDate.toLocaleTimeString()}.
          </p>
          <Link
            to={`/courses/${courseId}`}
            style={{ marginTop: 20, display: "inline-block", padding: "10px 24px", borderRadius: 12, background: "linear-gradient(135deg,#6C63FF,#9B59B6)", color: "#fff", textDecoration: "none", fontWeight: 600 }}
          >
            Quay lại khóa học
          </Link>
        </div>
      );
    }
  }

  if (lesson.prerequisites && lesson.prerequisites.length > 0) {
    const missing = lesson.prerequisites.filter(
      (id) => !progress.some((p) => p.lessonId === id && p.status === "completed")
    );
    if (missing.length > 0) {
      const missingTitles = missing.map((id) => {
        const found = course.modules.flatMap((m) => m.lessons).find((l) => l.id === id);
        return found?.title || id;
      });
      return (
        <div style={{ textAlign: "center", padding: 40 }}>
          <AlertCircle size={48} color="#FFB785" />
          <h2 style={{ fontSize: 22, fontWeight: 700, color: "#E4E1EE", marginTop: 16 }}>Yêu cầu bài học tiên quyết</h2>
          <p style={{ fontSize: 14, color: "#C7C4D8" }}>Bạn cần hoàn thành các bài học sau trước khi học bài này:</p>
          <ul style={{ listStyle: "none", padding: 0, marginTop: 16 }}>
            {missingTitles.map((title) => (
              <li key={title} style={{ color: "#FFB785", marginBottom: 4 }}>• {title}</li>
            ))}
          </ul>
          <Link
            to={`/courses/${courseId}`}
            style={{ marginTop: 20, display: "inline-block", padding: "10px 24px", borderRadius: 12, background: "linear-gradient(135deg,#6C63FF,#9B59B6)", color: "#fff", textDecoration: "none", fontWeight: 600 }}
          >
            Quay lại khóa học
          </Link>
        </div>
      );
    }
  }

  // ===== Paid lesson guard =====
  if (!lesson.isFree && !isEnrolled) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          height: "60vh",
          textAlign: "center",
          gap: 20,
        }}
      >
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: "50%",
            background: "rgba(108,99,255,0.12)",
            border: "1px solid rgba(108,99,255,0.3)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Lock size={28} color="#6C63FF" />
        </div>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: "#E4E1EE", marginBottom: 10 }}>Nội dung trả phí</h2>
          <p style={{ fontSize: 15, color: "#C7C4D8", maxWidth: 360 }}>Bài học này yêu cầu bạn đăng ký khóa học. Vui lòng mua khóa học để tiếp tục.</p>
        </div>
        <Link
          to={`/courses/${courseId}`}
          style={{
            padding: "12px 32px",
            borderRadius: 14,
            background: "linear-gradient(135deg,#6C63FF,#9B59B6)",
            color: "#fff",
            fontWeight: 700,
            fontSize: 15,
            textDecoration: "none",
          }}
        >
          Xem khóa học
        </Link>
      </div>
    );
  }

  // ===== Prepare props for children =====
  const completed = moduleId && lessonId ? isLessonCompleted(moduleId, lessonId) : false;

  let quizQuestions = [];
  let passingScore = 70;
  let questionsToShow: number | undefined = undefined;
  if (lesson.type === "quiz" && lesson.content?.type === "quiz") {
    quizQuestions = lesson.content.data.questions || [];
    passingScore = lesson.content.data.passingScore || 70;
    questionsToShow = lesson.content.data.questionsToShow;
  }

  let readingContent = "";
  if (lesson.type === "reading" && lesson.content?.type === "reading") {
    readingContent = lesson.content.data.markdown || "";
  }

  let flashcardCards = [];
  let flashcardProgress = undefined;
  if (lesson.type === "flashcard" && lesson.content?.type === "flashcard") {
    flashcardCards = lesson.content.data.cards || [];
    if (moduleId && lessonId) {
      flashcardProgress = getFlashcardProgress(moduleId, lessonId);
    }
  }

  // Video extras
  let videoChapters = [];
  let videoTranscript = [];
  if (lesson.type === "video" && lesson.content?.type === "video") {
    videoChapters = lesson.content.data.chapters || [];
    videoTranscript = lesson.content.data.transcript || [];
  }

  // ===== Render =====
  return (
    <div style={{ minHeight: "100vh", background: "#0F0F1A" }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeUp { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
      `}</style>

      {/* Sticky breadcrumb with ellipsis fix */}
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 40,
          background: "rgba(15,15,26,0.92)",
          backdropFilter: "blur(16px)",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          padding: "0 24px",
          height: 52,
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        <Link
          to={`/courses/${courseId}`}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            color: "#C7C4D8",
            textDecoration: "none",
            fontSize: 13,
            fontWeight: 600,
            padding: "5px 12px",
            borderRadius: 8,
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.07)",
            transition: "all .15s",
            flexShrink: 0,
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.color = "#E4E1EE";
            e.currentTarget.style.borderColor = "rgba(108,99,255,0.3)";
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.color = "#C7C4D8";
            e.currentTarget.style.borderColor = "rgba(255,255,255,0.07)";
          }}
        >
          <ArrowLeft size={14} /> Khóa học
        </Link>
        <span style={{ color: "rgba(255,255,255,0.2)", fontSize: 16 }}>/</span>
        <span
          style={{
            fontSize: 13,
            color: "#C7C4D8",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            maxWidth: 180,
            minWidth: 0,
          }}
        >
          {course.title}
        </span>
        <span style={{ color: "rgba(255,255,255,0.2)", fontSize: 16 }}>/</span>
        <span
          style={{
            fontSize: 13,
            color: "#E4E1EE",
            fontWeight: 700,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            minWidth: 0,
            maxWidth: 300,
          }}
        >
          {lesson.title}
        </span>
      </div>

      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "28px 24px" }}>
        {levelUpData && (
          <LevelUpNotification
            oldLevel={levelUpData.oldLevel}
            newLevel={levelUpData.newLevel}
            oldTitle={levelUpData.oldTitle}
            newTitle={levelUpData.newTitle}
            oldIcon={levelUpData.oldIcon}
            newIcon={levelUpData.newIcon}
            oldColor={levelUpData.oldColor}
            newColor={levelUpData.newColor}
            onClose={clearLevelUp}
            autoCloseDelay={5000}
          />
        )}

        <div style={{ display: "flex", gap: 24, alignItems: "flex-start" }}>
          {/* Sidebar */}
          <LessonSidebar
            modules={course.modules}
            currentModuleId={moduleId!}
            currentLessonId={lessonId!}
            isLessonCompleted={isLessonCompleted}
            isLessonLocked={isLessonLocked}
            onSelectLesson={(mId, lId) => navigate(`/learn/${courseId}/${mId}/${lId}`)}
          />

          {/* Main content */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {lesson.type === "video" && (
              <VideoLesson
                userId={userId!}
                courseId={courseId!}
                moduleId={moduleId!}
                lessonId={lessonId!}
                title={lesson.title}
                videoUrl={lesson.videoUrl || ""}
                xpReward={lesson.xpReward}
                onComplete={handleLessonComplete}
                isCompleted={completed}
                lessonType="video"
                chapters={videoChapters}
                transcript={videoTranscript}
              />
            )}

            {lesson.type === "quiz" && (
              <QuizLesson
                userId={userId!}
                courseId={courseId!}
                moduleId={moduleId!}
                lessonId={lessonId!}
                title={lesson.title}
                questions={quizQuestions}
                passingScore={passingScore}
                xpReward={lesson.xpReward}
                onComplete={handleLessonComplete}
                isCompleted={completed}
                lessonType="quiz"
                questionsToShow={questionsToShow}
              />
            )}

            {lesson.type === "reading" && (
              <ReadingLesson
                userId={userId!}
                courseId={courseId!}
                moduleId={moduleId!}
                lessonId={lessonId!}
                title={lesson.title}
                content={readingContent}
                xpReward={lesson.xpReward}
                onComplete={handleLessonComplete}
                isCompleted={completed}
                lessonType="reading"
              />
            )}

            {lesson.type === "flashcard" && (
              <FlashcardLesson
                userId={userId!}
                courseId={courseId!}
                moduleId={moduleId!}
                lessonId={lessonId!}
                title={lesson.title}
                cards={flashcardCards}
                xpReward={lesson.xpReward}
                savedProgress={flashcardProgress}
                onComplete={handleLessonComplete}
                isCompleted={completed}
                lessonType="flashcard"
              />
            )}

            {/* Prev / Next */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginTop: 32,
                paddingTop: 24,
                borderTop: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              <button
                onClick={() => prevItem && goToLesson(prevItem)}
                disabled={!prevItem}
                style={{
                  opacity: prevItem ? 1 : 0.4,
                  cursor: prevItem ? "pointer" : "not-allowed",
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 10,
                  padding: "8px 16px",
                  color: "#C7C4D8",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: 13,
                  transition: "all .15s",
                }}
                onMouseOver={(e) => {
                  if (prevItem) {
                    e.currentTarget.style.background = "rgba(255,255,255,0.08)";
                    e.currentTarget.style.borderColor = "rgba(108,99,255,0.3)";
                  }
                }}
                onMouseOut={(e) => {
                  if (prevItem) {
                    e.currentTarget.style.background = "rgba(255,255,255,0.04)";
                    e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)";
                  }
                }}
              >
                <ArrowLeft size={14} /> {prevItem ? prevItem.lesson.title : "Đầu khóa học"}
              </button>
              <button
                onClick={() => nextItem && goToLesson(nextItem)}
                disabled={!nextItem}
                style={{
                  opacity: nextItem ? 1 : 0.4,
                  cursor: nextItem ? "pointer" : "not-allowed",
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 10,
                  padding: "8px 16px",
                  color: "#C7C4D8",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: 13,
                  transition: "all .15s",
                }}
                onMouseOver={(e) => {
                  if (nextItem) {
                    e.currentTarget.style.background = "rgba(255,255,255,0.08)";
                    e.currentTarget.style.borderColor = "rgba(108,99,255,0.3)";
                  }
                }}
                onMouseOut={(e) => {
                  if (nextItem) {
                    e.currentTarget.style.background = "rgba(255,255,255,0.04)";
                    e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)";
                  }
                }}
              >
                {nextItem ? nextItem.lesson.title : "Đã hết bài học"} <ArrowRight size={14} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Pomodoro Widget (floating) */}
      <PomodoroWidget />
    </div>
  );
}
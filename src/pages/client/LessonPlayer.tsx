import React, { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useDocument } from "../../hooks/useFirestore";
import { useProgress } from "../../hooks/useProgress";
import { useAuth } from "../../contexts/AuthContext";
import { useUserEnrollment } from "../../hooks/useUserEnrollment";
import { ArrowLeft, Loader, Lock } from "lucide-react";
import { VideoLesson } from "../../components/player/VideoLesson";
import { QuizLesson } from "../../components/player/QuizLesson";
import { ReadingLesson } from "../../components/player/ReadingLesson";
import { FlashcardLesson } from "../../components/player/FlashcardLesson";
import { useLevelUp } from '../../hooks/useLevelUp';
import { LevelUpNotification } from '../../components/common/LevelUpNotification';

interface Lesson {
  id: string;
  title: string;
  type: string;
  duration: number;
  videoUrl?: string;
  xpReward: number;
  isFree: boolean;
  order: number;
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

export default function LessonPlayer() {
  const { courseId, moduleId, lessonId } = useParams<{
    courseId: string;
    moduleId: string;
    lessonId: string;
  }>();
  const navigate = useNavigate();
  const { currentUser, userProfile, loading: authLoading } = useAuth(); // ✅ THÊM userProfile
  const userId = currentUser?.uid;

  const { data: course, loading: courseLoading, error: courseError } = useDocument<Course>("courses", courseId);
  const { isLessonCompleted, getFlashcardProgress } = useProgress(userId, courseId);
  const { isEnrolled, loading: enrollmentLoading } = useUserEnrollment(userId, courseId);
  const { levelUpData, clearLevelUp } = useLevelUp(userProfile?.totalXP);

  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [moduleTitle, setModuleTitle] = useState("");
  const [lessonLoading, setLessonLoading] = useState(true);

  // ✅ D5: Guard cho userId null
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

  const handleLessonComplete = async () => {
    navigate(`/learn/${courseId}/${moduleId}/${lessonId}`, { replace: true });
  };

  if (courseLoading || lessonLoading || enrollmentLoading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "60vh" }}>
        <Loader size={36} color="#6C63FF" style={{ animation: "spin 0.8s linear infinite" }} />
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

  // ✅ FIX-LESSON-1: Chặn truy cập paid lesson nếu chưa enroll
  // isFree lessons vẫn cho xem; paid lessons yêu cầu enrollment
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
          <h2 style={{ fontSize: 22, fontWeight: 800, color: "#E4E1EE", marginBottom: 10 }}>
            Nội dung trả phí
          </h2>
          <p style={{ fontSize: 15, color: "#C7C4D8", maxWidth: 360 }}>
            Bài học này yêu cầu bạn đăng ký khóa học. Vui lòng mua khóa học để tiếp tục.
          </p>
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

  const completed = moduleId && lessonId ? isLessonCompleted(moduleId, lessonId) : false;

  let quizQuestions = [];
  let passingScore = 70;
  if (lesson.type === "quiz" && lesson.content?.type === "quiz") {
    quizQuestions = lesson.content.data.questions || [];
    passingScore = lesson.content.data.passingScore || 70;
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

  return (
    <div style={{ minHeight: "100vh", background: "#0F0F1A", padding: "24px" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <div style={{ marginBottom: 24 }}>
          <Link
            to={`/courses/${courseId}`}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              color: "#C7C4D8",
              textDecoration: "none",
              fontSize: 14,
              marginBottom: 8,
            }}
          >
            <ArrowLeft size={16} /> Back to course
          </Link>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, color: "#C7C4D8" }}>
            <span>{course.title}</span>
            <span>/</span>
            <span>{moduleTitle}</span>
            <span>/</span>
            <span style={{ color: "#E4E1EE", fontWeight: 600 }}>{lesson.title}</span>
          </div>
        </div>

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
      </div>
    </div>
  );
}
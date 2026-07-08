// src/components/player/LessonSidebar.tsx
import React from "react";
import { CheckCircle, Circle, Lock } from "lucide-react";

// Định nghĩa interface Lesson khớp với LessonPlayer
interface Lesson {
  id: string;
  title: string;
  type: string;
  duration: number;
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

interface LessonSidebarProps {
  modules: Module[];
  currentModuleId: string;
  currentLessonId: string;
  isLessonCompleted: (moduleId: string, lessonId: string) => boolean;
  isLessonLocked: (lesson: Lesson) => boolean;
  onSelectLesson: (moduleId: string, lessonId: string) => void;
}

export function LessonSidebar({
  modules,
  currentModuleId,
  currentLessonId,
  isLessonCompleted,
  isLessonLocked,
  onSelectLesson,
}: LessonSidebarProps) {
  return (
    <aside
      style={{
        width: 280,
        flexShrink: 0,
        position: "sticky",
        top: 68,
        maxHeight: "calc(100vh - 90px)",
        overflowY: "auto",
        paddingRight: 8,
      }}
    >
      {[...modules]
        .sort((a, b) => a.order - b.order)
        .map((m) => (
          <div key={m.id} style={{ marginBottom: 20 }}>
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: "#6C63FF",
                textTransform: "uppercase",
                letterSpacing: ".08em",
                marginBottom: 8,
              }}
            >
              {m.title}
            </div>
            {[...m.lessons]
              .sort((a, b) => a.order - b.order)
              .map((l) => {
                const completed = isLessonCompleted(m.id, l.id);
                const locked = isLessonLocked(l);
                const isCurrent = m.id === currentModuleId && l.id === currentLessonId;
                return (
                  <button
                    key={l.id}
                    onClick={() => !locked && onSelectLesson(m.id, l.id)}
                    disabled={locked}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      width: "100%",
                      textAlign: "left",
                      padding: "8px 10px",
                      borderRadius: 8,
                      background: isCurrent
                        ? "rgba(108,99,255,0.15)"
                        : "transparent",
                      border: "none",
                      cursor: locked ? "not-allowed" : "pointer",
                      color: isCurrent ? "#E4E1EE" : locked ? "#47464f" : "#C7C4D8",
                      fontWeight: isCurrent ? 700 : 400,
                      fontSize: 13,
                      transition: "background .15s",
                    }}
                    onMouseOver={(e) => {
                      if (!locked && !isCurrent) {
                        e.currentTarget.style.background = "rgba(255,255,255,0.04)";
                      }
                    }}
                    onMouseOut={(e) => {
                      if (!locked && !isCurrent) {
                        e.currentTarget.style.background = "transparent";
                      }
                    }}
                  >
                    {locked ? (
                      <Lock size={14} />
                    ) : completed ? (
                      <CheckCircle size={14} color="#45f1c5" />
                    ) : (
                      <Circle size={14} />
                    )}
                    <span style={{ flex: 1 }}>{l.title}</span>
                  </button>
                );
              })}
          </div>
        ))}
    </aside>
  );
}
/**
 * src/components/player/ReadingLesson.tsx
 * Reading lesson with markdown support + HTML rendering
 */

import React from "react";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import { LessonCompleteButton } from "./LessonCompleteButton";

interface ReadingLessonProps {
  userId: string;
  courseId: string;
  moduleId: string;
  lessonId: string;
  title: string;
  content: string; // markdown string (có thể chứa HTML)
  xpReward: number;
  onComplete?: () => void;
}

export function ReadingLesson({
  userId,
  courseId,
  moduleId,
  lessonId,
  title,
  content,
  xpReward,
  onComplete,
}: ReadingLessonProps) {
  return (
    <div style={{ maxWidth: 880, margin: "0 auto" }}>
      <h2
        style={{
          fontSize: 28,
          fontWeight: 800,
          color: "#E4E1EE",
          marginBottom: 24,
          borderLeft: "4px solid #6C63FF",
          paddingLeft: 16,
        }}
      >
        {title}
      </h2>

      <div
        style={{
          background: "rgba(20, 20, 35, 0.8)",
          borderRadius: 20,
          border: "1px solid rgba(255,255,255,0.08)",
          padding: "32px 40px",
          marginBottom: 40,
          backdropFilter: "blur(8px)",
          boxShadow: "0 8px 24px rgba(0,0,0,0.2)",
        }}
      >
        <ReactMarkdown
          rehypePlugins={[rehypeRaw]}
          components={{
            // Headings
            h1: ({ children }) => (
              <h1 style={{ fontSize: 28, fontWeight: 800, color: "#E4E1EE", marginBottom: 16, marginTop: 24 }}>
                {children}
              </h1>
            ),
            h2: ({ children }) => (
              <h2 style={{ fontSize: 22, fontWeight: 700, color: "#E4E1EE", marginBottom: 12, marginTop: 20 }}>
                {children}
              </h2>
            ),
            h3: ({ children }) => (
              <h3 style={{ fontSize: 18, fontWeight: 600, color: "#c4c0ff", marginBottom: 10, marginTop: 16 }}>
                {children}
              </h3>
            ),
            // Paragraph
            p: ({ children }) => (
              <p style={{ fontSize: 16, color: "#C7C4D8", lineHeight: 1.65, marginBottom: 16 }}>
                {children}
              </p>
            ),
            // Lists
            ul: ({ children }) => (
              <ul style={{ marginLeft: 24, marginBottom: 16, color: "#C7C4D8", listStyleType: "disc" }}>
                {children}
              </ul>
            ),
            ol: ({ children }) => (
              <ol style={{ marginLeft: 24, marginBottom: 16, color: "#C7C4D8", listStyleType: "decimal" }}>
                {children}
              </ol>
            ),
            li: ({ children }) => (
              <li style={{ marginBottom: 8, fontSize: 15 }}>{children}</li>
            ),
            // Links
            a: ({ href, children }) => (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: "#6C63FF", textDecoration: "none", borderBottom: "1px solid rgba(108,99,255,0.4)" }}
              >
                {children}
              </a>
            ),
            // Code inline / block – sửa lỗi TypeScript bằng cách nhận toàn bộ props
            code: (props: any) => {
              const { children, inline, className, ...rest } = props;
              if (inline) {
                return (
                  <code
                    style={{
                      background: "rgba(108,99,255,0.15)",
                      padding: "2px 6px",
                      borderRadius: 6,
                      fontSize: 14,
                      color: "#c4c0ff",
                    }}
                  >
                    {children}
                  </code>
                );
              }
              return (
                <pre
                  style={{
                    background: "#0d0d18",
                    padding: 16,
                    borderRadius: 12,
                    overflowX: "auto",
                    marginBottom: 16,
                    border: "1px solid rgba(255,255,255,0.05)",
                  }}
                >
                  <code style={{ fontSize: 13, color: "#E4E1EE" }}>{children}</code>
                </pre>
              );
            },
            // Blockquote
            blockquote: ({ children }) => (
              <blockquote
                style={{
                  borderLeft: "4px solid #6C63FF",
                  paddingLeft: 20,
                  fontStyle: "italic",
                  color: "#A0A0B8",
                  marginBottom: 16,
                  background: "rgba(108,99,255,0.05)",
                  borderRadius: 8,
                  padding: "12px 20px",
                }}
              >
                {children}
              </blockquote>
            ),
            // Table
            table: ({ children }) => (
              <div style={{ overflowX: "auto", marginBottom: 16 }}>
                <table style={{ width: "100%", borderCollapse: "collapse", background: "rgba(255,255,255,0.03)", borderRadius: 8 }}>
                  {children}
                </table>
              </div>
            ),
            th: ({ children }) => (
              <th style={{ border: "1px solid rgba(255,255,255,0.1)", padding: 8, textAlign: "left", fontWeight: 700 }}>
                {children}
              </th>
            ),
            td: ({ children }) => (
              <td style={{ border: "1px solid rgba(255,255,255,0.1)", padding: 8 }}>{children}</td>
            ),
          }}
        >
          {content}
        </ReactMarkdown>
      </div>

      <div style={{ textAlign: "center" }}>
        <LessonCompleteButton
          userId={userId}
          courseId={courseId}
          moduleId={moduleId}
          lessonId={lessonId}
          xpReward={xpReward}
          onComplete={onComplete}
        />
      </div>
    </div>
  );
}
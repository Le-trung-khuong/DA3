/**
 * src/components/admin/QuizEditor.tsx
 * Editor cho quiz lesson (multiple choice) + import từ Excel/CSV/DOCX
 */

import React from "react";
import { Plus, Trash2, ChevronUp, ChevronDown, Upload } from "lucide-react";
import { useFileImport } from "../../hooks/useFileImport";
import { ImportModal } from "../common/ImportModal";
import { parseQuizFile } from "../../services/import/quizParser";
import { QuizQuestion } from "../../types/lesson";

interface QuizEditorProps {
  questions: QuizQuestion[];
  onChange: (questions: QuizQuestion[]) => void;
}

let idCounter = 0;
const generateId = () => `q_${Date.now()}_${++idCounter}`;

export function QuizEditor({ questions, onChange }: QuizEditorProps) {
  const importHook = useFileImport<{ questions: QuizQuestion[] }>({
    parser: async (file) => {
      const result = await parseQuizFile(file);
      if (result.errors.length) {
        throw new Error(result.errors[0].message);
      }
      if (result.warnings.length) {
        console.warn(result.warnings);
      }
      return { questions: result.questions };
    },
    onConfirm: (data) => {
      // Append imported questions (có thể đổi thành replace nếu muốn)
      onChange([...questions, ...data.questions]);
    },
  });

  const addQuestion = () => {
    const newQuestion: QuizQuestion = {
      id: generateId(),
      text: "",
      options: ["", "", "", ""],
      correctOptionIndex: 0,
      explanation: "",
    };
    onChange([...questions, newQuestion]);
  };

  const updateQuestion = (index: number, updates: Partial<QuizQuestion>) => {
    const updated = [...questions];
    updated[index] = { ...updated[index], ...updates };
    onChange(updated);
  };

  const deleteQuestion = (index: number) => {
    onChange(questions.filter((_, i) => i !== index));
  };

  const updateOption = (qIndex: number, optIndex: number, value: string) => {
    const updated = [...questions];
    updated[qIndex].options[optIndex] = value;
    onChange(updated);
  };

  const moveQuestion = (from: number, to: number) => {
    if (to < 0 || to >= questions.length) return;
    const updated = [...questions];
    const [moved] = updated.splice(from, 1);
    updated.splice(to, 0, moved);
    onChange(updated);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <label
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: "#C7C4D8",
            textTransform: "uppercase",
            letterSpacing: ".07em",
          }}
        >
          Quiz Questions
        </label>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={importHook.openModal}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              background: "rgba(108,99,255,.1)",
              border: "1px solid rgba(108,99,255,.3)",
              borderRadius: 8,
              padding: "4px 10px",
              fontSize: 11,
              fontWeight: 600,
              color: "#c4c0ff",
              cursor: "pointer",
            }}
          >
            <Upload size={12} /> Import
          </button>
          <button
            onClick={addQuestion}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              background: "rgba(69,241,197,.1)",
              border: "1px solid rgba(69,241,197,.3)",
              borderRadius: 8,
              padding: "4px 10px",
              fontSize: 11,
              fontWeight: 600,
              color: "#45f1c5",
              cursor: "pointer",
            }}
          >
            <Plus size={12} /> Add Question
          </button>
        </div>
      </div>

      {questions.length === 0 && (
        <div
          style={{
            textAlign: "center",
            padding: 20,
            color: "#47464f",
            fontSize: 12,
          }}
        >
          No questions yet. Click "Add Question" to start.
        </div>
      )}

      {questions.map((q, idx) => (
        <div
          key={q.id}
          style={{
            background: "rgba(0,0,0,.3)",
            border: "1px solid rgba(255,255,255,.06)",
            borderRadius: 12,
            padding: 14,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 12,
            }}
          >
            <div style={{ display: "flex", gap: 4 }}>
              <button
                onClick={() => moveQuestion(idx, idx - 1)}
                disabled={idx === 0}
                style={{
                  background: "none",
                  border: "none",
                  cursor: idx === 0 ? "not-allowed" : "pointer",
                  color: "#47464f",
                }}
              >
                <ChevronUp size={14} />
              </button>
              <button
                onClick={() => moveQuestion(idx, idx + 1)}
                disabled={idx === questions.length - 1}
                style={{
                  background: "none",
                  border: "none",
                  cursor: idx === questions.length - 1 ? "not-allowed" : "pointer",
                  color: "#47464f",
                }}
              >
                <ChevronDown size={14} />
              </button>
            </div>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#C7C4D8" }}>
              Question {idx + 1}
            </span>
            <button
              onClick={() => deleteQuestion(idx)}
              style={{
                marginLeft: "auto",
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "#ffb4ab",
              }}
            >
              <Trash2 size={14} />
            </button>
          </div>

          <div style={{ marginBottom: 12 }}>
            <label
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: "#C7C4D8",
                marginBottom: 4,
                display: "block",
              }}
            >
              Question Text
            </label>
            <input
              type="text"
              value={q.text}
              onChange={(e) => updateQuestion(idx, { text: e.target.value })}
              placeholder="e.g. What is React?"
              style={{
                width: "100%",
                background: "#0d0d18",
                border: "1px solid rgba(255,255,255,.08)",
                borderRadius: 8,
                padding: "8px 12px",
                color: "#E4E1EE",
                fontSize: 13,
              }}
            />
          </div>

          <div style={{ marginBottom: 12 }}>
            <label
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: "#C7C4D8",
                marginBottom: 4,
                display: "block",
              }}
            >
              Options (4 choices)
            </label>
            {q.options.map((opt, optIdx) => (
              <div
                key={optIdx}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: 8,
                }}
              >
                <input
                  type="radio"
                  name={`correct_${q.id}`}
                  checked={q.correctOptionIndex === optIdx}
                  onChange={() =>
                    updateQuestion(idx, { correctOptionIndex: optIdx })
                  }
                  style={{ accentColor: "#45f1c5" }}
                />
                <input
                  type="text"
                  value={opt}
                  onChange={(e) => updateOption(idx, optIdx, e.target.value)}
                  placeholder={`Option ${optIdx + 1}`}
                  style={{
                    flex: 1,
                    background: "#0d0d18",
                    border: "1px solid rgba(255,255,255,.08)",
                    borderRadius: 8,
                    padding: "8px 12px",
                    color: "#E4E1EE",
                    fontSize: 13,
                  }}
                />
              </div>
            ))}
          </div>

          <div>
            <label
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: "#C7C4D8",
                marginBottom: 4,
                display: "block",
              }}
            >
              Explanation (optional)
            </label>
            <textarea
              value={q.explanation || ""}
              onChange={(e) => updateQuestion(idx, { explanation: e.target.value })}
              placeholder="Explain why the answer is correct..."
              rows={2}
              style={{
                width: "100%",
                background: "#0d0d18",
                border: "1px solid rgba(255,255,255,.08)",
                borderRadius: 8,
                padding: "8px 12px",
                color: "#E4E1EE",
                fontSize: 13,
                resize: "vertical",
              }}
            />
          </div>
        </div>
      ))}

      <ImportModal
        state={importHook}
        onClose={importHook.closeModal}
        onFileSelect={importHook.handleFileSelect}
        onConfirm={importHook.confirmImport}
        title="Import Questions from Excel/CSV/DOCX"
        renderPreview={(data, onUpdate) => {
          if (!data) return null;
          return (
            <div>
              <p style={{ marginBottom: 12, color: "#45f1c5" }}>
                {data.questions.length} questions ready to import
              </p>
              <div
                style={{
                  maxHeight: 300,
                  overflow: "auto",
                  fontSize: 13,
                }}
              >
                {data.questions.map((q, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: 8,
                      borderBottom: "1px solid rgba(255,255,255,0.05)",
                    }}
                  >
                    <strong>{q.text}</strong> (Correct: {q.options[q.correctOptionIndex]})
                  </div>
                ))}
              </div>
            </div>
          );
        }}
      />
    </div>
  );
}
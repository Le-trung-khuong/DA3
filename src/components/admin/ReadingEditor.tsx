/**
 * src/components/admin/ReadingEditor.tsx
 * Editor cho reading lesson (markdown) + import từ DOCX, PDF, MD, TXT
 */

import React from "react";
import { Info, Upload } from "lucide-react";
import { useFileImport } from "../../hooks/useFileImport";
import { ImportModal } from "../common/ImportModal";
import { parseReadingFile } from "../../services/import/readingParser";

interface ReadingEditorProps {
  markdown: string;
  onChange: (markdown: string) => void;
}

export function ReadingEditor({ markdown, onChange }: ReadingEditorProps) {
  const importHook = useFileImport<{ markdown: string }>({
    parser: async (file) => {
      const result = await parseReadingFile(file);
      if (result.error) throw new Error(result.error);
      return { markdown: result.markdown };
    },
    onConfirm: (data) => {
      onChange(data.markdown);
    },
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <label
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: "#C7C4D8",
              textTransform: "uppercase",
              letterSpacing: ".07em",
            }}
          >
            Reading Content (Markdown)
          </label>
          <div
            style={{
              fontSize: 11,
              color: "#6C63FF",
              display: "flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            <Info size={12} /> Supports headings, lists, code blocks, etc.
          </div>
        </div>
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
          <Upload size={12} /> Import from file
        </button>
      </div>
      <textarea
        value={markdown}
        onChange={(e) => onChange(e.target.value)}
        placeholder={`# Introduction

Write your content here using Markdown.

## Subheading

- Bullet points
- **Bold text**
- [Links](https://example.com)

\`\`\`javascript
console.log("Code blocks");
\`\`\``}
        rows={12}
        style={{
          width: "100%",
          background: "#0d0d18",
          border: "1px solid rgba(255,255,255,.08)",
          borderRadius: 12,
          padding: "12px",
          color: "#E4E1EE",
          fontSize: 13,
          fontFamily: "monospace",
          resize: "vertical",
        }}
      />
      <div style={{ fontSize: 11, color: "#47464f", textAlign: "right" }}>
        {markdown.length} characters
      </div>

      <ImportModal
        state={importHook}
        onClose={importHook.closeModal}
        onFileSelect={importHook.handleFileSelect}
        onConfirm={importHook.confirmImport}
        title="Import Reading Material"
        accept={{
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [
            ".docx",
          ],
          "application/pdf": [".pdf"],
          "text/markdown": [".md", ".markdown"],
          "text/plain": [".txt"],
        }}
        renderPreview={(data, onUpdate) => {
          if (!data) return null;
          return (
            <div
              style={{
                maxHeight: 400,
                overflow: "auto",
                background: "#0d0d18",
                padding: 12,
                borderRadius: 8,
              }}
            >
              <pre
                style={{
                  whiteSpace: "pre-wrap",
                  fontFamily: "monospace",
                  fontSize: 12,
                  color: "#C7C4D8",
                }}
              >
                {data.markdown.slice(0, 1000)}
                {data.markdown.length > 1000 ? "..." : ""}
              </pre>
            </div>
          );
        }}
      />
    </div>
  );
}
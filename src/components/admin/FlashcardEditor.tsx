/**
 * src/components/admin/FlashcardEditor.tsx
 * Editor cho flashcard lesson + import từ Excel/CSV/DOCX
 */

import React from "react";
import { Plus, Trash2, ChevronUp, ChevronDown, Upload } from "lucide-react";
import { useFileImport } from "../../hooks/useFileImport";
import { ImportModal } from "../common/ImportModal";
import { parseFlashcardFile } from "../../services/import/flashcardParser";
import { FlashcardCard } from "../../types/lesson";

interface FlashcardEditorProps {
  cards: FlashcardCard[];
  onChange: (cards: FlashcardCard[]) => void;
}

let idCounter = 0;
const generateId = () => `fc_${Date.now()}_${++idCounter}`;

export function FlashcardEditor({ cards, onChange }: FlashcardEditorProps) {
  const importHook = useFileImport<{ cards: FlashcardCard[] }>({
    parser: async (file) => {
      const result = await parseFlashcardFile(file);
      if (result.errors.length) {
        throw new Error(result.errors[0].message);
      }
      if (result.warnings.length) {
        console.warn(result.warnings);
      }
      return { cards: result.cards };
    },
    onConfirm: (data) => {
      // Append imported cards
      onChange([...cards, ...data.cards]);
    },
  });

  const addCard = () => {
    const newCard: FlashcardCard = {
      id: generateId(),
      front: "",
      back: "",
      hint: "",
    };
    onChange([...cards, newCard]);
  };

  const updateCard = (index: number, updates: Partial<FlashcardCard>) => {
    const updated = [...cards];
    updated[index] = { ...updated[index], ...updates };
    onChange(updated);
  };

  const deleteCard = (index: number) => {
    onChange(cards.filter((_, i) => i !== index));
  };

  const moveCard = (from: number, to: number) => {
    if (to < 0 || to >= cards.length) return;
    const updated = [...cards];
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
          Flashcards
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
            onClick={addCard}
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
            <Plus size={12} /> Add Card
          </button>
        </div>
      </div>

      {cards.length === 0 && (
        <div
          style={{
            textAlign: "center",
            padding: 20,
            color: "#47464f",
            fontSize: 12,
          }}
        >
          No flashcards yet. Click "Add Card" to start.
        </div>
      )}

      {cards.map((card, idx) => (
        <div
          key={card.id}
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
                onClick={() => moveCard(idx, idx - 1)}
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
                onClick={() => moveCard(idx, idx + 1)}
                disabled={idx === cards.length - 1}
                style={{
                  background: "none",
                  border: "none",
                  cursor: idx === cards.length - 1 ? "not-allowed" : "pointer",
                  color: "#47464f",
                }}
              >
                <ChevronDown size={14} />
              </button>
            </div>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#C7C4D8" }}>
              Card {idx + 1}
            </span>
            <button
              onClick={() => deleteCard(idx)}
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
              Front (Question / Term)
            </label>
            <textarea
              value={card.front}
              onChange={(e) => updateCard(idx, { front: e.target.value })}
              placeholder="e.g. What is React?"
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
              Back (Answer / Definition)
            </label>
            <textarea
              value={card.back}
              onChange={(e) => updateCard(idx, { back: e.target.value })}
              placeholder="e.g. A JavaScript library for building user interfaces"
              rows={3}
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
              Hint (optional)
            </label>
            <input
              type="text"
              value={card.hint || ""}
              onChange={(e) => updateCard(idx, { hint: e.target.value })}
              placeholder="A small hint to help remember"
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
        </div>
      ))}

      <ImportModal
        state={importHook}
        onClose={importHook.closeModal}
        onFileSelect={importHook.handleFileSelect}
        onConfirm={importHook.confirmImport}
        title="Import Flashcards from Excel/CSV/DOCX"
        renderPreview={(data, onUpdate) => {
          if (!data) return null;
          return (
            <div>
              <p style={{ marginBottom: 12, color: "#45f1c5" }}>
                {data.cards.length} cards ready to import
              </p>
              <div
                style={{
                  maxHeight: 300,
                  overflow: "auto",
                  fontSize: 13,
                }}
              >
                {data.cards.slice(0, 20).map((c, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: 8,
                      borderBottom: "1px solid rgba(255,255,255,0.05)",
                    }}
                  >
                    <strong>{c.front}</strong> → {c.back}
                  </div>
                ))}
                {data.cards.length > 20 && (
                  <div style={{ padding: 8, color: "#C7C4D8" }}>
                    ... and {data.cards.length - 20} more
                  </div>
                )}
              </div>
            </div>
          );
        }}
      />
    </div>
  );
}
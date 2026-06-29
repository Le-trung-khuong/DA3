// src/components/common/LevelProgressBar.tsx
import React from "react";

interface LevelProgressBarProps {
  level: number;
  progress: number; // 0 → 1
  xpInLevel: number;
  xpToNext: number;
  totalXP: number;
  color?: string;
  icon?: string;
  title?: string;
  compact?: boolean;
  showLabels?: boolean;
}

export function LevelProgressBar({
  level,
  progress,
  xpInLevel,
  xpToNext,
  totalXP,
  color = "#6C63FF",
  icon = "🥉",
  title = "",
  compact = false,
  showLabels = true,
}: LevelProgressBarProps) {
  const percent = Math.min(Math.round(progress * 100), 100);

  if (compact) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 14, lineHeight: 1 }}>{icon}</span>
        <div
          style={{
            flex: 1,
            height: 6,
            background: "rgba(255,255,255,0.08)",
            borderRadius: 3,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${percent}%`,
              height: "100%",
              background: `linear-gradient(90deg, ${color}, ${color}cc)`,
              borderRadius: 3,
              transition: "width 0.5s ease",
            }}
          />
        </div>
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: "#C7C4D8",
            minWidth: 36,
            textAlign: "right",
          }}
        >
          {percent}%
        </span>
      </div>
    );
  }

  return (
    <div style={{ width: "100%" }}>
      {showLabels && (
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 6,
          }}
        >
          <span
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: "#E4E1EE",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <span>{icon}</span>
            Level {level}
            {title && (
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 500,
                  color: color,
                  opacity: 0.8,
                }}
              >
                · {title}
              </span>
            )}
          </span>
          <span style={{ fontSize: 12, color: "#C7C4D8" }}>
            {xpInLevel.toLocaleString()} / {xpToNext.toLocaleString()} XP
          </span>
        </div>
      )}

      <div
        style={{
          height: 8,
          background: "rgba(255,255,255,0.06)",
          borderRadius: 4,
          overflow: "hidden",
          position: "relative",
        }}
      >
        <div
          style={{
            width: `${percent}%`,
            height: "100%",
            background: `linear-gradient(90deg, ${color}, ${color}cc)`,
            borderRadius: 4,
            transition: "width 0.6s ease",
            boxShadow: `0 0 12px ${color}40`,
          }}
        />
      </div>

      {showLabels && (
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginTop: 4,
          }}
        >
          <span style={{ fontSize: 11, color: "#47464f" }}>
            Total: {totalXP.toLocaleString()} XP
          </span>
          <span style={{ fontSize: 11, color: "#47464f" }}>
            {xpToNext > 0 ? `${xpToNext.toLocaleString()} XP to next level` : "Max level!"}
          </span>
        </div>
      )}
    </div>
  );
}
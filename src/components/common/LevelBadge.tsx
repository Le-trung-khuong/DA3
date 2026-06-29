// src/components/common/LevelBadge.tsx
import React from "react";

interface LevelBadgeProps {
  level: number;
  title?: string;
  icon?: string;
  color?: string;
  size?: "sm" | "md" | "lg";
  showTitle?: boolean;
  className?: string;
}

export function LevelBadge({
  level,
  title = "",
  icon = "🥉",
  color = "#CD7F32",
  size = "md",
  showTitle = false,
  className = "",
}: LevelBadgeProps) {
  const sizes = {
    sm: { fontSize: 11, padding: "2px 8px", gap: 4, iconSize: 12 },
    md: { fontSize: 13, padding: "4px 12px", gap: 6, iconSize: 16 },
    lg: { fontSize: 16, padding: "6px 16px", gap: 8, iconSize: 20 },
  };

  const s = sizes[size];

  return (
    <div
      className={className}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: s.gap,
        padding: s.padding,
        borderRadius: 999,
        background: `${color}18`,
        border: `1px solid ${color}30`,
        color: color,
        fontSize: s.fontSize,
        fontWeight: 700,
        fontFamily: "Inter, sans-serif",
        transition: "all 0.2s ease",
        userSelect: "none",
      }}
    >
      <span style={{ fontSize: s.iconSize, lineHeight: 1 }}>{icon}</span>
      <span>Lv.{level}</span>
      {showTitle && title && (
        <>
          <span style={{ opacity: 0.3, margin: "0 2px" }}>·</span>
          <span style={{ fontSize: s.fontSize * 0.85, opacity: 0.85 }}>{title}</span>
        </>
      )}
    </div>
  );
}
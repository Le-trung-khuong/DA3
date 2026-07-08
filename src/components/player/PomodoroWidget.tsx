// src/components/player/PomodoroWidget.tsx
import React, { useState } from "react";
import { Clock } from "lucide-react";
import PomodoroTimerModal from "../FloatingPomodoroWidget/PomodoroTimerModal";

export function PomodoroWidget() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        style={{
          position: "fixed",
          bottom: 24,
          right: 24,
          width: 56,
          height: 56,
          borderRadius: "50%",
          background: "linear-gradient(135deg,#6C63FF,#9B59B6)",
          border: "none",
          boxShadow: "0 4px 20px rgba(108,99,255,0.4)",
          color: "#fff",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 998,
          transition: "transform .2s, box-shadow .2s",
        }}
        onMouseOver={(e) => {
          e.currentTarget.style.transform = "scale(1.05)";
          e.currentTarget.style.boxShadow = "0 8px 30px rgba(108,99,255,0.5)";
        }}
        onMouseOut={(e) => {
          e.currentTarget.style.transform = "scale(1)";
          e.currentTarget.style.boxShadow = "0 4px 20px rgba(108,99,255,0.4)";
        }}
      >
        <Clock size={24} />
      </button>

      <PomodoroTimerModal isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
}
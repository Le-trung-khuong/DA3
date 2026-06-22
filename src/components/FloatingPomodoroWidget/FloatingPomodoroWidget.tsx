// src/components/FloatingPomodoroWidget/FloatingPomodoroWidget.tsx
import React, { useState, useEffect, useRef } from 'react';
import { usePomodoroContext } from '../../contexts/PomodoroContext';
import { Play, Pause, Maximize2 } from 'lucide-react';
import PomodoroTimerModal from './PomodoroTimerModal';

const formatTime = (seconds: number): string => {
  const secs = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(secs / 60);
  const remainingSecs = secs % 60;
  return `${String(mins).padStart(2, '0')}:${String(remainingSecs).padStart(2, '0')}`;
};

const getStatusLabel = (status: string): string => {
  switch (status) {
    case 'working': return 'Focus';
    case 'shortBreak': return 'Break';
    case 'longBreak': return 'Long Break';
    case 'paused': return 'Paused';
    default: return '';
  }
};

const STATUS_CONFIG: Record<string, { color: string; bg: string; glow: string }> = {
  working:    { color: '#6C63FF', bg: 'rgba(108,99,255,0.15)', glow: 'rgba(108,99,255,0.35)' },
  shortBreak: { color: '#45F1C5', bg: 'rgba(69,241,197,0.12)', glow: 'rgba(69,241,197,0.3)'  },
  longBreak:  { color: '#45F1C5', bg: 'rgba(69,241,197,0.12)', glow: 'rgba(69,241,197,0.3)'  },
  paused:     { color: '#FFB785', bg: 'rgba(255,183,133,0.12)', glow: 'rgba(255,183,133,0.3)' },
};

const ARC_R = 14;
const ARC_C = 2 * Math.PI * ARC_R;

export const FloatingPomodoroWidget: React.FC = () => {
  const { state, pause, resume } = usePomodoroContext();
  const [isOpen, setIsOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const widgetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (widgetRef.current && !widgetRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const shouldShow = ['working', 'shortBreak', 'longBreak', 'paused'].includes(state.status);
  if (!shouldShow) return null;

  const cfg = STATUS_CONFIG[state.status] ?? STATUS_CONFIG.paused;
  const timeStr = formatTime(state.timeLeft);
  const statusLabel = getStatusLabel(state.status);
  const isPaused = state.status === 'paused';
  const progress = state.totalSeconds > 0 ? (state.totalSeconds - state.timeLeft) / state.totalSeconds : 0;
  const arcOffset = ARC_C * (1 - progress);

  const handleTogglePause = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isPaused) resume(); else pause();
  };
  const handleOpenModal = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsModalOpen(true);
    setIsOpen(false);
  };

  return (
    <>
      {/* Vị trí: bottom-right, đủ xa khỏi scrollbar và các nút khác */}
      <div
        ref={widgetRef}
        style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          zIndex: 50,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
        }}
      >
        {/* ── Expanded panel (hiện phía trên widget pill) ── */}
        {isOpen && (
          <div
            style={{
              marginBottom: '10px',
              width: '220px',
              background: 'rgba(15,15,26,0.97)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '20px',
              padding: '16px',
              boxShadow: `0 20px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04)`,
              animation: 'widgetSlideIn 0.18s ease-out',
            }}
          >
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div
                  style={{
                    width: '7px',
                    height: '7px',
                    borderRadius: '50%',
                    background: cfg.color,
                    boxShadow: `0 0 6px ${cfg.glow}`,
                  }}
                />
                <span style={{ color: '#E4E1EE', fontSize: '13px', fontWeight: 600 }}>
                  {statusLabel}
                </span>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#7A788A',
                  cursor: 'pointer',
                  fontSize: '16px',
                  lineHeight: 1,
                  padding: '0 2px',
                  transition: 'color 0.15s',
                }}
                onMouseEnter={e => (e.currentTarget.style.color = '#E4E1EE')}
                onMouseLeave={e => (e.currentTarget.style.color = '#7A788A')}
              >
                ✕
              </button>
            </div>

            {/* Arc + time */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '14px' }}>
              {/* Mini arc */}
              <div style={{ position: 'relative', width: '36px', height: '36px', flexShrink: 0 }}>
                <svg width="36" height="36" viewBox="0 0 36 36" style={{ transform: 'rotate(-90deg)' }}>
                  <circle cx="18" cy="18" r={ARC_R} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="3" />
                  <circle
                    cx="18" cy="18" r={ARC_R}
                    fill="none"
                    stroke={cfg.color}
                    strokeWidth="3"
                    strokeDasharray={ARC_C}
                    strokeDashoffset={arcOffset}
                    strokeLinecap="round"
                    style={{ transition: 'stroke-dashoffset 0.5s linear' }}
                  />
                </svg>
                <div style={{
                  position: 'absolute', inset: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <div
                    style={{
                      width: '6px', height: '6px', borderRadius: '50%',
                      background: cfg.color,
                      opacity: isPaused ? 0.5 : 1,
                    }}
                  />
                </div>
              </div>

              {/* Time */}
              <span
                style={{
                  fontFamily: 'monospace',
                  fontSize: '28px',
                  fontWeight: 700,
                  color: '#ffffff',
                  letterSpacing: '0.05em',
                  lineHeight: 1,
                }}
              >
                {timeStr}
              </span>
            </div>

            {/* Cycle indicator */}
            {state.totalCycles !== undefined && (
              <div style={{ display: 'flex', gap: '4px', marginBottom: '14px' }}>
                {Array.from({ length: state.config?.cyclesBeforeLongBreak ?? 4 }).map((_, i) => (
                  <div
                    key={i}
                    style={{
                      flex: 1,
                      height: '3px',
                      borderRadius: '2px',
                      background: i < (state.currentCycle ?? 0)
                        ? cfg.color
                        : 'rgba(255,255,255,0.08)',
                      transition: 'background 0.3s',
                    }}
                  />
                ))}
              </div>
            )}

            {/* Buttons */}
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={handleTogglePause}
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  padding: '8px 0',
                  borderRadius: '12px',
                  border: 'none',
                  background: cfg.bg,
                  color: cfg.color,
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'opacity 0.15s',
                }}
                onMouseEnter={e => (e.currentTarget.style.opacity = '0.8')}
                onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
              >
                {isPaused ? <Play size={13} /> : <Pause size={13} />}
                {isPaused ? 'Resume' : 'Pause'}
              </button>
              <button
                onClick={handleOpenModal}
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  padding: '8px 0',
                  borderRadius: '12px',
                  border: '1px solid rgba(255,255,255,0.08)',
                  background: 'rgba(255,255,255,0.04)',
                  color: '#9A98A8',
                  fontSize: '13px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
                  e.currentTarget.style.color = '#E4E1EE';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
                  e.currentTarget.style.color = '#9A98A8';
                }}
              >
                <Maximize2 size={13} />
                Expand
              </button>
            </div>
          </div>
        )}

        {/* ── Collapsed pill ── */}
        <button
          onClick={() => setIsOpen(v => !v)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 14px 8px 10px',
            background: 'rgba(15,15,26,0.92)',
            backdropFilter: 'blur(20px)',
            border: `1px solid ${isOpen ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.07)'}`,
            borderRadius: '40px',
            boxShadow: `0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.03)`,
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={e => (e.currentTarget.style.boxShadow = `0 8px 32px rgba(0,0,0,0.5), 0 0 16px ${cfg.glow}`)}
          onMouseLeave={e => (e.currentTarget.style.boxShadow = '0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.03)')}
        >
          {/* Status dot with pulse */}
          <div style={{ position: 'relative', width: '8px', height: '8px' }}>
            <div
              style={{
                position: 'absolute',
                inset: 0,
                borderRadius: '50%',
                background: cfg.color,
                opacity: 0.3,
                animation: isPaused ? 'none' : 'pulse 2s ease-in-out infinite',
                transform: 'scale(1.8)',
              }}
            />
            <div
              style={{
                position: 'absolute',
                inset: 0,
                borderRadius: '50%',
                background: cfg.color,
                boxShadow: `0 0 6px ${cfg.color}`,
              }}
            />
          </div>

          {/* Time */}
          <span
            style={{
              fontFamily: 'monospace',
              fontSize: '14px',
              fontWeight: 700,
              color: '#ffffff',
              letterSpacing: '0.06em',
            }}
          >
            {timeStr}
          </span>

          {/* Divider */}
          <div
            style={{
              width: '1px',
              height: '12px',
              background: 'rgba(255,255,255,0.1)',
            }}
          />

          {/* Label */}
          <span
            style={{
              fontSize: '11px',
              fontWeight: 600,
              color: cfg.color,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
            }}
          >
            {statusLabel}
          </span>
        </button>
      </div>

      <PomodoroTimerModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.15; transform: scale(1.8); }
          50% { opacity: 0.4; transform: scale(2.4); }
        }
        @keyframes widgetSlideIn {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </>
  );
};
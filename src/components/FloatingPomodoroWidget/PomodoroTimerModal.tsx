// src/components/FloatingPomodoroWidget/PomodoroTimerModal.tsx
import React from 'react';
import { X, Play, Pause, RotateCcw, Zap, Coffee, Clock } from 'lucide-react';
import { usePomodoroContext } from '../../contexts/PomodoroContext';

const formatTime = (seconds: number): string => {
  const secs = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(secs / 60);
  const rem = secs % 60;
  return `${String(mins).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
};

const STATUS_CONFIG: Record<string, {
  color: string;
  trackColor: string;
  glow: string;
  label: string;
  icon: React.ReactNode;
  accentBg: string;
}> = {
  working: {
    color: '#6C63FF',
    trackColor: 'rgba(108,99,255,0.12)',
    glow: 'rgba(108,99,255,0.4)',
    label: 'Focus Session',
    icon: <Zap size={14} />,
    accentBg: 'rgba(108,99,255,0.08)',
  },
  shortBreak: {
    color: '#45F1C5',
    trackColor: 'rgba(69,241,197,0.12)',
    glow: 'rgba(69,241,197,0.35)',
    label: 'Short Break',
    icon: <Coffee size={14} />,
    accentBg: 'rgba(69,241,197,0.07)',
  },
  longBreak: {
    color: '#45F1C5',
    trackColor: 'rgba(69,241,197,0.12)',
    glow: 'rgba(69,241,197,0.35)',
    label: 'Long Break',
    icon: <Coffee size={14} />,
    accentBg: 'rgba(69,241,197,0.07)',
  },
  paused: {
    color: '#FFB785',
    trackColor: 'rgba(255,183,133,0.12)',
    glow: 'rgba(255,183,133,0.35)',
    label: 'Paused',
    icon: <Pause size={14} />,
    accentBg: 'rgba(255,183,133,0.07)',
  },
  idle: {
    color: '#C7C4D8',
    trackColor: 'rgba(199,196,216,0.08)',
    glow: 'transparent',
    label: 'Ready',
    icon: <Clock size={14} />,
    accentBg: 'rgba(199,196,216,0.05)',
  },
};

const RING_R = 72;
const RING_CIRC = 2 * Math.PI * RING_R;

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function PomodoroTimerModal({ isOpen, onClose }: Props) {
  const { state, pause, resume, reset } = usePomodoroContext();
  if (!isOpen) return null;

  const isPaused   = state.status === 'paused';
  const isActive   = ['working', 'shortBreak', 'longBreak'].includes(state.status);
  const cfg        = STATUS_CONFIG[state.status] ?? STATUS_CONFIG.idle;
  const progress   = state.totalSeconds > 0 ? (state.totalSeconds - state.timeLeft) / state.totalSeconds : 0;
  const arcOffset  = RING_CIRC * (1 - progress);
  const cycleTotal = state.config?.cyclesBeforeLongBreak ?? 4;
  const cycleDone  = state.currentCycle ?? 0;

  const handleToggle = () => { if (isPaused) resume(); else pause(); };
  const handleReset  = () => { reset(); onClose(); };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        background: 'rgba(0,0,0,0.65)',
        backdropFilter: 'blur(6px)',
        animation: 'modalBgIn 0.2s ease',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: '360px',
          background: '#0F0F1A',
          borderRadius: '28px',
          border: '1px solid rgba(255,255,255,0.07)',
          boxShadow: `0 32px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.03), 0 0 60px ${cfg.glow}`,
          overflow: 'hidden',
          animation: 'modalIn 0.22s cubic-bezier(0.34,1.56,0.64,1)',
        }}
      >
        {/* ── Top color bar ── */}
        <div
          style={{
            height: '3px',
            background: `linear-gradient(90deg, ${cfg.color}00, ${cfg.color}, ${cfg.color}00)`,
            transition: 'background 0.5s',
          }}
        />

        {/* ── Header ── */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 20px 0',
          }}
        >
          {/* Status badge */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '7px',
              padding: '5px 11px',
              borderRadius: '20px',
              background: cfg.accentBg,
              border: `1px solid ${cfg.color}22`,
            }}
          >
            <span style={{ color: cfg.color, display: 'flex' }}>{cfg.icon}</span>
            <span
              style={{
                fontSize: '12px',
                fontWeight: 600,
                color: cfg.color,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
              }}
            >
              {cfg.label}
            </span>
          </div>

          {/* Close */}
          <button
            onClick={onClose}
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '10px',
              border: '1px solid rgba(255,255,255,0.07)',
              background: 'rgba(255,255,255,0.04)',
              color: '#7A788A',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
              e.currentTarget.style.color = '#E4E1EE';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
              e.currentTarget.style.color = '#7A788A';
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* ── Progress ring ── */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            padding: '28px 0 20px',
          }}
        >
          <div style={{ position: 'relative', width: '176px', height: '176px' }}>
            {/* Glow behind ring */}
            <div
              style={{
                position: 'absolute',
                inset: '20px',
                borderRadius: '50%',
                background: `radial-gradient(circle, ${cfg.glow} 0%, transparent 70%)`,
                opacity: 0.35,
                filter: 'blur(12px)',
                transition: 'background 0.5s',
              }}
            />
            <svg
              width="176"
              height="176"
              viewBox="0 0 176 176"
              style={{ transform: 'rotate(-90deg)' }}
            >
              {/* Background track */}
              <circle
                cx="88" cy="88" r={RING_R}
                fill="none"
                stroke="rgba(255,255,255,0.05)"
                strokeWidth="6"
              />
              {/* Subtle inner glow track */}
              <circle
                cx="88" cy="88" r={RING_R}
                fill="none"
                stroke={cfg.color}
                strokeWidth="6"
                opacity="0.08"
                strokeDasharray={RING_CIRC}
                strokeDashoffset="0"
              />
              {/* Progress arc */}
              <circle
                cx="88" cy="88" r={RING_R}
                fill="none"
                stroke={cfg.color}
                strokeWidth="6"
                strokeDasharray={RING_CIRC}
                strokeDashoffset={arcOffset}
                strokeLinecap="round"
                style={{ transition: 'stroke-dashoffset 0.4s linear, stroke 0.5s' }}
              />
            </svg>

            {/* Center content */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '4px',
              }}
            >
              <span
                style={{
                  fontFamily: 'monospace',
                  fontSize: '38px',
                  fontWeight: 800,
                  color: '#ffffff',
                  letterSpacing: '0.04em',
                  lineHeight: 1,
                }}
              >
                {formatTime(state.timeLeft)}
              </span>
              {state.totalSeconds > 0 && (
                <span style={{ fontSize: '12px', color: '#5A5870', fontWeight: 500 }}>
                  {Math.round(progress * 100)}% done
                </span>
              )}
            </div>
          </div>
        </div>

        {/* ── Cycle dots ── */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            gap: '6px',
            marginBottom: '24px',
          }}
        >
          {Array.from({ length: cycleTotal }).map((_, i) => (
            <div
              key={i}
              style={{
                width: i < cycleDone ? '20px' : '8px',
                height: '8px',
                borderRadius: '4px',
                background: i < cycleDone ? cfg.color : 'rgba(255,255,255,0.08)',
                transition: 'all 0.3s ease',
                boxShadow: i < cycleDone ? `0 0 8px ${cfg.glow}` : 'none',
              }}
            />
          ))}
        </div>

        {/* ── Session info strip ── */}
        {state.config && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '1px',
              background: 'rgba(255,255,255,0.04)',
              borderTop: '1px solid rgba(255,255,255,0.05)',
              borderBottom: '1px solid rgba(255,255,255,0.05)',
            }}
          >
            {[
              { label: 'Focus', value: `${state.config.workDuration}m`,      color: '#6C63FF' },
              { label: 'Break', value: `${state.config.shortBreakDuration}m`, color: '#45F1C5' },
              { label: 'Long',  value: `${state.config.longBreakDuration}m`,  color: '#6C63FF' },
            ].map(({ label, value, color }) => (
              <div
                key={label}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  padding: '10px 0',
                  background: '#0F0F1A',
                  gap: '3px',
                }}
              >
                <span style={{ fontSize: '17px', fontWeight: 700, color }}>
                  {value}
                </span>
                <span style={{ fontSize: '10px', color: '#5A5870', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  {label}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* ── Controls ── */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
            padding: '20px 24px 24px',
          }}
        >
          {(isActive || isPaused) ? (
            <>
              {/* Reset */}
              <button
                onClick={handleReset}
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '50%',
                  border: '1px solid rgba(255,255,255,0.08)',
                  background: 'rgba(255,255,255,0.04)',
                  color: '#7A788A',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.15s',
                  flexShrink: 0,
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.09)';
                  e.currentTarget.style.color = '#E4E1EE';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
                  e.currentTarget.style.color = '#7A788A';
                }}
                title="Reset session"
              >
                <RotateCcw size={18} />
              </button>

              {/* Play / Pause — main CTA */}
              <button
                onClick={handleToggle}
                style={{
                  width: '62px',
                  height: '62px',
                  borderRadius: '50%',
                  border: 'none',
                  background: `linear-gradient(135deg, ${cfg.color}, ${cfg.color}bb)`,
                  boxShadow: `0 8px 28px ${cfg.glow}, 0 0 0 6px ${cfg.color}18`,
                  color: '#fff',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.18s ease',
                  flexShrink: 0,
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.transform = 'scale(1.06)';
                  e.currentTarget.style.boxShadow = `0 12px 36px ${cfg.glow}, 0 0 0 8px ${cfg.color}20`;
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform = 'scale(1)';
                  e.currentTarget.style.boxShadow = `0 8px 28px ${cfg.glow}, 0 0 0 6px ${cfg.color}18`;
                }}
              >
                {isPaused ? <Play size={26} style={{ marginLeft: '2px' }} /> : <Pause size={24} />}
              </button>

              {/* Spacer to keep center button centered */}
              <div style={{ width: '44px', flexShrink: 0 }} />
            </>
          ) : (
            /* Idle state */
            <button
              onClick={handleReset}
              style={{
                padding: '12px 36px',
                borderRadius: '40px',
                border: 'none',
                background: `linear-gradient(135deg, #6C63FF, #9B59B6)`,
                boxShadow: '0 8px 28px rgba(108,99,255,0.4)',
                color: '#fff',
                fontSize: '15px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'all 0.18s ease',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.transform = 'scale(1.03)';
                e.currentTarget.style.boxShadow = '0 12px 36px rgba(108,99,255,0.5)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.boxShadow = '0 8px 28px rgba(108,99,255,0.4)';
              }}
            >
              <Play size={18} style={{ marginLeft: '2px' }} />
              Start Session
            </button>
          )}
        </div>
      </div>

      <style>{`
        @keyframes modalBgIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes modalIn {
          from { opacity: 0; transform: scale(0.92) translateY(12px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
    </div>
  );
}
// src/components/client/PomodoroTimer/PomodoroTimer.tsx
import React, { useEffect, useState } from 'react';
import { useAuth } from '../../../hooks/useAuth';
import { usePomodoroContext } from '../../../contexts/PomodoroContext';
import { AchievementDef } from '../../../types/pomodoro';
import { PomodoroSettings } from './PomodoroSettings';
import {
  Play,
  Pause,
  RotateCcw,
  CheckCircle,
  Clock,
  Coffee,
  Zap,
  Award,
  X,
  Bell,
  BellOff,
  Settings,
} from 'lucide-react';

const formatTime = (seconds: number): string => {
  const secs = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(secs / 60);
  const remainingSecs = secs % 60;
  return `${String(mins).padStart(2, '0')}:${String(remainingSecs).padStart(2, '0')}`;
};

const getStatusColor = (status: string): string => {
  switch (status) {
    case 'working': return '#6C63FF';
    case 'shortBreak': return '#45f1c5';
    case 'longBreak': return '#45f1c5';
    case 'paused': return '#FFB785';
    case 'completed': return '#45f1c5';
    default: return '#C7C4D8';
  }
};

const getStatusLabel = (status: string): string => {
  switch (status) {
    case 'idle': return 'Sẵn sàng';
    case 'working': return 'Đang học';
    case 'shortBreak': return 'Nghỉ ngắn';
    case 'longBreak': return 'Nghỉ dài';
    case 'paused': return 'Tạm dừng';
    case 'completed': return 'Hoàn thành';
    default: return '';
  }
};

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'working': return <Zap size={20} color="#6C63FF" />;
    case 'shortBreak': return <Coffee size={20} color="#45f1c5" />;
    case 'longBreak': return <Coffee size={20} color="#45f1c5" />;
    case 'paused': return <Pause size={20} color="#FFB785" />;
    case 'completed': return <CheckCircle size={20} color="#45f1c5" />;
    default: return <Clock size={20} color="#C7C4D8" />;
  }
};

export default function PomodoroTimer() {
  const { currentUser } = useAuth();
  const userId = currentUser?.uid;

  const {
    state,
    config,
    setUserId,
    start,
    pause,
    resume,
    cancel,
    finishSession,
    reset,
    focusResult,
    sessionCompleted,
    newAchievements,
    showAchievement,
    setShowAchievement,
    settingsLoading,
  } = usePomodoroContext();

  const [soundEnabled, setSoundEnabled] = useState(true);
  const [showFocusResult, setShowFocusResult] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // Set userId khi component mount hoặc userId thay đổi
  useEffect(() => {
    if (userId) setUserId(userId);
  }, [userId, setUserId]);

  // Hiển thị focus result khi session hoàn thành
  useEffect(() => {
    if (sessionCompleted && focusResult) {
      setShowFocusResult(true);
      const timer = setTimeout(() => setShowFocusResult(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [sessionCompleted, focusResult]);

  // Play sound khi chuyển trạng thái
  useEffect(() => {
    if (soundEnabled) {
      if (state.status === 'shortBreak' || state.status === 'longBreak') {
        const audio = new Audio('/sounds/break.mp3');
        audio.play().catch(() => {});
      }
      if (state.status === 'working' && state.currentCycle > 0) {
        const audio = new Audio('/sounds/start.mp3');
        audio.play().catch(() => {});
      }
    }
  }, [state.status, state.currentCycle, soundEnabled]);

  const progress = state.totalSeconds > 0
    ? ((state.totalSeconds - state.timeLeft) / state.totalSeconds) * 100
    : 0;

  const isActive = ['working', 'shortBreak', 'longBreak'].includes(state.status);
  const isPaused = state.status === 'paused';
  const isIdle = state.status === 'idle';
  const isCompleted = state.status === 'completed';

  const size = 200;
  const strokeWidth = 10;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (progress / 100) * circumference;

  if (settingsLoading) {
    return (
      <div
        style={{
          background: 'rgba(26,26,46,0.6)',
          borderRadius: '24px',
          padding: '24px',
          maxWidth: '480px',
          margin: '0 auto',
          textAlign: 'center',
        }}
      >
        <p style={{ color: '#C7C4D8' }}>Loading settings...</p>
      </div>
    );
  }

  return (
    <div
      style={{
        background: 'rgba(26,26,46,0.6)',
        borderRadius: '24px',
        border: '1px solid rgba(255,255,255,0.06)',
        padding: '24px',
        maxWidth: '480px',
        margin: '0 auto',
        textAlign: 'center',
        position: 'relative',
      }}
    >
      {/* Achievement Modal */}
      {showAchievement && newAchievements.length > 0 && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            background: 'rgba(15,15,26,0.95)',
            borderRadius: '16px',
            padding: '24px',
            border: '2px solid #6C63FF',
            zIndex: 100,
            minWidth: '280px',
            backdropFilter: 'blur(8px)',
          }}
        >
          <button
            onClick={() => setShowAchievement(false)}
            style={{
              position: 'absolute',
              top: '8px',
              right: '8px',
              background: 'none',
              border: 'none',
              color: '#C7C4D8',
              cursor: 'pointer',
            }}
          >
            <X size={18} />
          </button>
          <div style={{ textAlign: 'center' }}>
            <Award size={48} color="#FFB785" />
            <h3 style={{ color: '#E4E1EE', marginTop: '12px' }}>🎉 New Achievement!</h3>
            {newAchievements.map((ach: AchievementDef, idx: number) => (
              <div key={idx} style={{ marginTop: '8px' }}>
                <div style={{ fontSize: '24px' }}>{ach.icon}</div>
                <div style={{ fontWeight: 700, color: '#E4E1EE' }}>{ach.title}</div>
                <div style={{ fontSize: '13px', color: '#C7C4D8' }}>{ach.description}</div>
                <div style={{ fontSize: '12px', color: '#6C63FF', marginTop: '4px' }}>
                  +{ach.xpReward} XP
                </div>
              </div>
            ))}
            <button
              onClick={() => setShowAchievement(false)}
              style={{
                marginTop: '16px',
                background: '#6C63FF',
                border: 'none',
                borderRadius: '8px',
                padding: '8px 24px',
                color: '#fff',
                cursor: 'pointer',
              }}
            >
              Awesome!
            </button>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettings && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 200,
            padding: '20px',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowSettings(false);
          }}
        >
          <div style={{ maxWidth: '600px', width: '100%' }}>
            <PomodoroSettings onClose={() => setShowSettings(false)} />
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h3 style={{ color: '#E4E1EE', fontSize: '18px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Clock size={20} color="#6C63FF" /> Pomodoro
        </h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            onClick={() => setShowSettings(true)}
            style={{
              background: 'none',
              border: 'none',
              color: '#C7C4D8',
              cursor: 'pointer',
              padding: '4px',
              borderRadius: '8px',
              transition: 'background 0.2s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
            title="Cài đặt"
          >
            <Settings size={18} />
          </button>
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            style={{
              background: 'none',
              border: 'none',
              color: '#C7C4D8',
              cursor: 'pointer',
              padding: '4px',
              borderRadius: '8px',
              transition: 'background 0.2s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
            title={soundEnabled ? 'Tắt âm thanh' : 'Bật âm thanh'}
          >
            {soundEnabled ? <Bell size={16} /> : <BellOff size={16} />}
          </button>
          <span style={{ color: '#C7C4D8', fontSize: '13px' }}>
            {state.totalCycles} cycles
          </span>
        </div>
      </div>

      {/* Timer Circle */}
      <div style={{ position: 'relative', width: size, height: size, margin: '0 auto 16px' }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#2a2a3e"
            strokeWidth={strokeWidth}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={getStatusColor(state.status)}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 0.3s ease' }}
          />
        </svg>
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: '32px', fontWeight: 700, color: '#E4E1EE' }}>
            {formatTime(state.timeLeft)}
          </div>
          <div style={{ fontSize: '13px', color: '#C7C4D8', marginTop: '2px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
            {getStatusIcon(state.status)}
            {getStatusLabel(state.status)}
          </div>
        </div>
      </div>

      {/* Config Display */}
      <div style={{ display: 'flex', justifyContent: 'space-around', marginBottom: '20px', fontSize: '13px', color: '#C7C4D8' }}>
        <span>⏱️ {state.config.workDuration}m</span>
        <span>☕ {state.config.shortBreakDuration}m</span>
        <span>🧘 {state.config.longBreakDuration}m</span>
        <span>🔄 {state.config.cyclesBeforeLongBreak} cycles</span>
      </div>

      {/* Focus Result */}
      {showFocusResult && focusResult && (
        <div
          style={{
            background: focusResult.score >= 70 ? 'rgba(69,241,197,0.1)' : 'rgba(255,180,171,0.1)',
            borderRadius: '12px',
            padding: '12px',
            marginBottom: '16px',
            border: `1px solid ${focusResult.score >= 70 ? 'rgba(69,241,197,0.2)' : 'rgba(255,180,171,0.2)'}`,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: '#C7C4D8', fontSize: '13px' }}>Focus Score</span>
            <span style={{ fontSize: '18px', fontWeight: 700, color: focusResult.score >= 70 ? '#45f1c5' : '#ffb4ab' }}>
              {focusResult.score}
            </span>
          </div>
          <div style={{ fontSize: '12px', color: '#C7C4D8', marginTop: '4px' }}>
            {focusResult.feedback}
          </div>
          <div style={{ display: 'flex', gap: '16px', marginTop: '8px', fontSize: '11px', color: '#47464f' }}>
            <span>Pauses: {focusResult.factors.pauseCount}</span>
            <span>Tab Switches: {focusResult.factors.tabSwitchCount}</span>
          </div>
        </div>
      )}

      {/* Controls */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', flexWrap: 'wrap' }}>
        {isIdle && (
          <button
            onClick={start}
            style={{
              background: 'linear-gradient(135deg,#6C63FF,#9B59B6)',
              border: 'none',
              borderRadius: '40px',
              padding: '10px 32px',
              color: '#fff',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              cursor: 'pointer',
              transition: 'transform 0.2s',
            }}
            onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.02)'}
            onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
          >
            <Play size={18} /> Bắt đầu
          </button>
        )}

        {isActive && (
          <>
            <button
              onClick={pause}
              style={{
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '40px',
                padding: '10px 24px',
                color: '#E4E1EE',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                cursor: 'pointer',
                transition: 'background 0.2s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.15)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
            >
              <Pause size={18} /> Tạm dừng
            </button>
            <button
              onClick={cancel}
              style={{
                background: 'rgba(255,180,171,0.1)',
                border: '1px solid rgba(255,180,171,0.2)',
                borderRadius: '40px',
                padding: '10px 24px',
                color: '#ffb4ab',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                cursor: 'pointer',
                transition: 'background 0.2s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,180,171,0.2)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,180,171,0.1)'}
            >
              <RotateCcw size={18} /> Hủy
            </button>
          </>
        )}

        {isPaused && (
          <>
            <button
              onClick={resume}
              style={{
                background: 'linear-gradient(135deg,#6C63FF,#9B59B6)',
                border: 'none',
                borderRadius: '40px',
                padding: '10px 32px',
                color: '#fff',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                cursor: 'pointer',
                transition: 'transform 0.2s',
              }}
              onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.02)'}
              onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
            >
              <Play size={18} /> Tiếp tục
            </button>
            <button
              onClick={cancel}
              style={{
                background: 'rgba(255,180,171,0.1)',
                border: '1px solid rgba(255,180,171,0.2)',
                borderRadius: '40px',
                padding: '10px 24px',
                color: '#ffb4ab',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                cursor: 'pointer',
              }}
            >
              <RotateCcw size={18} /> Hủy
            </button>
          </>
        )}

        {isCompleted && (
          <button
            onClick={reset}
            style={{
              background: '#45f1c5',
              border: 'none',
              borderRadius: '40px',
              padding: '10px 32px',
              color: '#0F0F1A',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              cursor: 'pointer',
              transition: 'transform 0.2s',
            }}
            onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.02)'}
            onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
          >
            <CheckCircle size={18} /> Bắt đầu mới
          </button>
        )}
      </div>

      {isCompleted && (
        <div style={{ marginTop: '16px', color: '#45f1c5', fontSize: '14px' }}>
          ✅ Phiên hoàn thành! +{state.config.workDuration * 2} XP
        </div>
      )}
    </div>
  );
}
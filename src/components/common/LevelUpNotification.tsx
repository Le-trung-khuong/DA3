// src/components/common/LevelUpNotification.tsx
import React, { useEffect, useState } from 'react';
import { LevelBadge } from './LevelBadge';

interface LevelUpNotificationProps {
  oldLevel: number;
  newLevel: number;
  oldTitle?: string;
  newTitle?: string;
  oldIcon?: string;
  newIcon?: string;
  oldColor?: string;
  newColor?: string;
  onClose?: () => void;
  autoCloseDelay?: number;
}

export function LevelUpNotification({
  oldLevel,
  newLevel,
  oldTitle = '',
  newTitle = '',
  oldIcon = '🥉',
  newIcon = '🥇',
  oldColor = '#CD7F32',
  newColor = '#FFD700',
  onClose,
  autoCloseDelay = 5000,
}: LevelUpNotificationProps) {
  const [visible, setVisible] = useState(true);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    if (autoCloseDelay > 0) {
      const timer = setTimeout(() => {
        setClosing(true);
        setTimeout(() => {
          setVisible(false);
          onClose?.();
        }, 400);
      }, autoCloseDelay);
      return () => clearTimeout(timer);
    }
  }, [autoCloseDelay, onClose]);

  if (!visible) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 24,
        right: 24,
        zIndex: 9999,
        maxWidth: 420,
        width: '100%',
        background: 'rgba(26,26,46,0.97)',
        borderRadius: 20,
        padding: 24,
        border: `2px solid ${newColor}60`,
        boxShadow: `0 12px 40px rgba(0,0,0,0.6), 0 0 40px ${newColor}20`,
        animation: closing ? 'slideOut 0.4s ease' : 'slideIn 0.4s ease',
        backdropFilter: 'blur(12px)',
      }}
    >
      <style>
        {`
          @keyframes slideIn {
            from { opacity: 0; transform: translateX(40px); }
            to { opacity: 1; transform: translateX(0); }
          }
          @keyframes slideOut {
            from { opacity: 1; transform: translateX(0); }
            to { opacity: 0; transform: translateX(40px); }
          }
          @keyframes pulseGlow {
            0%, 100% { box-shadow: 0 0 20px ${newColor}40; }
            50% { box-shadow: 0 0 40px ${newColor}70; }
          }
        `}
      </style>

      <div style={{ animation: 'pulseGlow 2s infinite' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <span style={{ fontSize: 32 }}>🎉</span>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#E4E1EE' }}>
            Level Up!
          </h2>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16, justifyContent: 'center', marginBottom: 16 }}>
          <div style={{ textAlign: 'center' }}>
            <LevelBadge
              level={oldLevel}
              title={oldTitle}
              icon={oldIcon}
              color={oldColor}
              size="lg"
              showTitle={true}
            />
          </div>
          <span style={{ fontSize: 24, color: '#C7C4D8' }}>→</span>
          <div style={{ textAlign: 'center' }}>
            <LevelBadge
              level={newLevel}
              title={newTitle}
              icon={newIcon}
              color={newColor}
              size="lg"
              showTitle={true}
            />
          </div>
        </div>

        <p style={{
          fontSize: 14,
          color: '#C7C4D8',
          textAlign: 'center',
          margin: '0 0 16px 0',
        }}>
          🎊 Chúc mừng! Bạn đã đạt Level {newLevel}!
          {newTitle && ` · ${newTitle} tier unlocked`}
        </p>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
          <button
            onClick={() => {
              setClosing(true);
              setTimeout(() => {
                setVisible(false);
                onClose?.();
              }, 400);
            }}
            style={{
              padding: '8px 24px',
              borderRadius: 12,
              background: 'linear-gradient(135deg, #6C63FF, #9B59B6)',
              border: 'none',
              color: '#fff',
              fontWeight: 700,
              cursor: 'pointer',
              fontSize: 13,
              transition: 'transform 0.2s',
            }}
            onMouseOver={(e) => (e.currentTarget.style.transform = 'scale(1.05)')}
            onMouseOut={(e) => (e.currentTarget.style.transform = 'scale(1)')}
          >
            Tiếp tục
          </button>
        </div>
      </div>
    </div>
  );
}
// src/contexts/PomodoroContext.tsx
import React, { createContext, useContext, ReactNode, useMemo, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { usePomodoro } from '../hooks/usePomodoro';
import { PomodoroState, PomodoroConfig, FocusScoreResult, AchievementDef } from '../types/pomodoro';

interface PomodoroContextValue {
  state: PomodoroState;
  config: PomodoroConfig;
  setUserId: (uid: string) => void;
  start: () => Promise<void>;
  pause: () => void;
  resume: () => void;
  cancel: () => Promise<void>;
  finishSession: () => Promise<void>;
  reset: () => void;
  focusResult: FocusScoreResult | null;
  sessionCompleted: boolean;
  newAchievements: AchievementDef[];
  showAchievement: boolean;
  setShowAchievement: (show: boolean) => void;
  settingsLoading: boolean;
}

const PomodoroContext = createContext<PomodoroContextValue | undefined>(undefined);

export const PomodoroProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { currentUser } = useAuth();
  const pomodoro = usePomodoro();

  // Tự động set userId khi user đăng nhập
  useEffect(() => {
    if (currentUser?.uid) {
      pomodoro.setUserId(currentUser.uid);
    }
  }, [currentUser, pomodoro.setUserId]);

  const value: PomodoroContextValue = useMemo(() => pomodoro, [pomodoro]);
  return <PomodoroContext.Provider value={value}>{children}</PomodoroContext.Provider>;
};

export const usePomodoroContext = (): PomodoroContextValue => {
  const context = useContext(PomodoroContext);
  if (!context) {
    throw new Error('usePomodoroContext must be used within a PomodoroProvider');
  }
  return context;
};
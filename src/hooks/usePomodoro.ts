// src/hooks/usePomodoro.ts
import { useReducer, useEffect, useRef, useCallback, useState } from 'react';
import { 
  PomodoroState, 
  PomodoroAction, 
  PomodoroConfig, 
  PomodoroStatus,
  FocusScoreResult,
  AchievementDef,
  PomodoroSettings
} from '../types/pomodoro';
import { 
  createPomodoroSession,
  updatePomodoroSession,
  completePomodoroSession,
  cancelPomodoroSession,
  calculateFocusScore,
  calculateXp,
  updateDailyAnalytics,
  getAdaptiveDuration
} from '../services/pomodoroService';
import { checkAndUnlockAchievements } from '../services/achievementService';
import { usePomodoroSettings } from './usePomodoroSettings';

const DEFAULT_CONFIG: PomodoroConfig = {
  workDuration: 25,
  shortBreakDuration: 5,
  longBreakDuration: 15,
  cyclesBeforeLongBreak: 4,
  autoStartNext: false,
  autoStartBreak: true,
  soundEnabled: true,
  notificationEnabled: true,
};

const getInitialState = (config: PomodoroConfig): PomodoroState => ({
  status: 'idle',
  timeLeft: config.workDuration * 60,
  totalSeconds: config.workDuration * 60,
  currentCycle: 0,
  totalCycles: 0,
  config,
  isRunning: false,
  startTime: null,
  elapsed: 0,
  sessionId: null,
  pauseCount: 0,
  tabSwitchCount: 0,
  tabSwitchTotalTime: 0,
  earlyCancelCount: 0,
});

function pomodoroReducer(state: PomodoroState, action: PomodoroAction): PomodoroState {
  const { config } = state;

  switch (action.type) {
    case 'UPDATE_CONFIG': {
      const newConfig = action.payload;
      // Nếu đang idle hoặc completed, cập nhật timeLeft theo config mới
      if (state.status === 'idle' || state.status === 'completed') {
        return {
          ...state,
          config: newConfig,
          timeLeft: newConfig.workDuration * 60,
          totalSeconds: newConfig.workDuration * 60,
        };
      }
      // Nếu đang paused, cập nhật config nhưng giữ timeLeft hiện tại
      if (state.status === 'paused') {
        return {
          ...state,
          config: newConfig,
        };
      }
      // Nếu đang chạy, chỉ cập nhật config (không reset timer)
      return {
        ...state,
        config: newConfig,
      };
    }

    case 'START': {
      if (state.status === 'idle') {
        const duration = (action.payload?.config?.workDuration || config.workDuration) * 60;
        return {
          ...state,
          status: 'working',
          timeLeft: duration,
          totalSeconds: duration,
          isRunning: true,
          startTime: Date.now(),
          elapsed: 0,
          sessionId: action.payload?.sessionId || null,
          config: action.payload?.config || config,
        };
      }
      return state;
    }

    case 'PAUSE': {
      if (state.status === 'working' || state.status === 'shortBreak' || state.status === 'longBreak') {
        return { 
          ...state, 
          status: 'paused', 
          isRunning: false, 
          startTime: null,
          pauseCount: state.pauseCount + 1,
        };
      }
      return state;
    }

    case 'RESUME': {
      if (state.status === 'paused') {
        // Xác định status trước đó dựa trên totalSeconds
        let previousStatus: PomodoroStatus = 'working';
        const workDuration = state.config.workDuration * 60;
        const shortBreakDuration = state.config.shortBreakDuration * 60;
        const longBreakDuration = state.config.longBreakDuration * 60;
        
        if (state.totalSeconds === workDuration) {
          previousStatus = 'working';
        } else if (state.totalSeconds === shortBreakDuration) {
          previousStatus = 'shortBreak';
        } else if (state.totalSeconds === longBreakDuration) {
          previousStatus = 'longBreak';
        }
        
        return {
          ...state,
          status: previousStatus,
          isRunning: true,
          startTime: Date.now(),
        };
      }
      return state;
    }

    case 'CANCEL': {
      return { ...getInitialState(config), totalCycles: state.totalCycles };
    }

    case 'TICK': {
      if (!state.isRunning) return state;
      return {
        ...state,
        timeLeft: action.payload.timeLeft,
        elapsed: state.elapsed + action.payload.elapsedDiff,
        startTime: Date.now(),
      };
    }

    case 'TAB_SWITCH': {
      return {
        ...state,
        tabSwitchCount: state.tabSwitchCount + 1,
        tabSwitchTotalTime: state.tabSwitchTotalTime + (action.payload?.duration || 0),
      };
    }

    case 'WORK_COMPLETE': {
      const newCycle = state.currentCycle + 1;
      const totalCycles = state.totalCycles + 1;
      const isLongBreak = newCycle % config.cyclesBeforeLongBreak === 0;
      const breakDuration = isLongBreak ? config.longBreakDuration * 60 : config.shortBreakDuration * 60;
      const breakStatus = isLongBreak ? 'longBreak' : 'shortBreak';

      return {
        ...state,
        status: breakStatus,
        timeLeft: breakDuration,
        totalSeconds: breakDuration,
        currentCycle: newCycle,
        totalCycles,
        isRunning: true,
        startTime: Date.now(),
        elapsed: 0,
      };
    }

    case 'BREAK_COMPLETE': {
      if (state.status === 'shortBreak') {
        const duration = config.workDuration * 60;
        return {
          ...state,
          status: 'working',
          timeLeft: duration,
          totalSeconds: duration,
          isRunning: true,
          startTime: Date.now(),
          elapsed: 0,
        };
      } else if (state.status === 'longBreak') {
        // Long break kết thúc -> hoàn thành chu kỳ, quay về idle
        return {
          ...getInitialState(config),
          totalCycles: state.totalCycles,
        };
      }
      return state;
    }

    case 'COMPLETE': {
      return {
        ...state,
        status: 'completed',
        isRunning: false,
        startTime: null,
      };
    }

    case 'RESET': {
      return getInitialState(config);
    }

    default:
      return state;
  }
}

// Hàm build config từ settings
const buildConfigFromSettings = (settings: PomodoroSettings): PomodoroConfig => ({
  workDuration: settings.workDuration,
  shortBreakDuration: settings.shortBreakDuration,
  longBreakDuration: settings.longBreakDuration,
  cyclesBeforeLongBreak: settings.cyclesBeforeLongBreak,
  autoStartNext: settings.autoStartNextSession || false,
  autoStartBreak: settings.autoStartBreak || false,
  soundEnabled: true,
  notificationEnabled: true,
});

export function usePomodoro(initialConfig?: Partial<PomodoroConfig>) {
  const { settings, loading: settingsLoading } = usePomodoroSettings();
  const userId = useRef<string | null>(null);
  
  // Khởi tạo config từ settings hoặc DEFAULT
  const [config, setConfig] = useState<PomodoroConfig>(() => {
    if (settings && !settingsLoading) {
      return buildConfigFromSettings(settings);
    }
    return { ...DEFAULT_CONFIG, ...initialConfig };
  });

  // State của timer
  const [state, dispatch] = useReducer(pomodoroReducer, config, getInitialState);
  
  // Các ref và state khác
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [focusResult, setFocusResult] = useState<FocusScoreResult | null>(null);
  const [sessionCompleted, setSessionCompleted] = useState(false);
  const [newAchievements, setNewAchievements] = useState<AchievementDef[]>([]);
  const [showAchievement, setShowAchievement] = useState(false);

  // Cập nhật config khi settings thay đổi
  useEffect(() => {
    if (!settingsLoading && settings) {
      const newConfig = buildConfigFromSettings(settings);
      setConfig(newConfig);
      dispatch({ type: 'UPDATE_CONFIG', payload: newConfig });
    }
  }, [settings, settingsLoading]);

  const setUserId = useCallback((uid: string) => {
    userId.current = uid;
  }, []);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // Tab detection
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && state.isRunning) {
        dispatch({ 
          type: 'TAB_SWITCH', 
          payload: { duration: 0 } 
        });
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [state.isRunning]);

  // Hàm xử lý khi work hoàn thành
  const handleWorkComplete = useCallback(async () => {
    if (!userId.current || !state.sessionId) return;

    try {
      const factors = {
        pauseCount: state.pauseCount,
        tabSwitchCount: state.tabSwitchCount,
        earlyCancelCount: state.earlyCancelCount,
        completedSessions: state.totalCycles,
        totalStudyMinutes: state.totalCycles * state.config.workDuration,
      };
      
      const result = await calculateFocusScore(userId.current, factors);
      setFocusResult(result);

      const { xpEarned, bonusXP } = calculateXp(
        state.config.workDuration,
        result.score,
        state.totalCycles > 0
      );

      await completePomodoroSession(state.sessionId, result, xpEarned, bonusXP);

      await updateDailyAnalytics(userId.current, {
        sessionId: state.sessionId,
        focusScore: result.score,
        duration: state.config.workDuration,
        xpEarned,
        hour: new Date().getHours(),
      });

      // Check achievements
      const achievements = await checkAndUnlockAchievements(userId.current, {
        sessions: state.totalCycles + 1,
        focusScore: result.score,
        noPause: state.pauseCount === 0,
      });

      if (achievements.length > 0) {
        setNewAchievements(achievements);
        setShowAchievement(true);
      }

      setSessionCompleted(true);
      dispatch({ type: 'WORK_COMPLETE' });
    } catch (error) {
      console.error('Error completing Pomodoro session:', error);
    }
  }, [userId.current, state.sessionId, state.pauseCount, state.tabSwitchCount, 
      state.earlyCancelCount, state.totalCycles, state.config.workDuration]);

  // Timer loop
  const startTimer = useCallback(() => {
    if (timerRef.current) return;
    
    timerRef.current = setInterval(() => {
      if (!state.isRunning) return;
      if (state.startTime === null) return;

      const now = Date.now();
      const elapsedSeconds = Math.floor((now - state.startTime) / 1000);
      const newTimeLeft = Math.max(0, state.totalSeconds - state.elapsed - elapsedSeconds);

      dispatch({
        type: 'TICK',
        payload: { timeLeft: newTimeLeft, elapsedDiff: elapsedSeconds },
      });

      if (newTimeLeft <= 0) {
        clearTimer();
        if (state.status === 'working') {
          handleWorkComplete();
        } else if (state.status === 'shortBreak' || state.status === 'longBreak') {
          dispatch({ type: 'BREAK_COMPLETE' });
        }
      }
    }, 1000);
  }, [state.isRunning, state.startTime, state.totalSeconds, state.elapsed, state.status, clearTimer, handleWorkComplete]);

  // Effect để start/stop timer
  useEffect(() => {
    if (state.isRunning) {
      startTimer();
    } else {
      clearTimer();
    }
    return clearTimer;
  }, [state.isRunning, startTimer, clearTimer]);

  // Actions
  const start = useCallback(async () => {
    if (state.status === 'idle' && userId.current) {
      try {
        const adaptiveDuration = await getAdaptiveDuration(userId.current);
        const updatedConfig = { ...state.config, workDuration: adaptiveDuration };
        
        const sessionId = await createPomodoroSession(
          userId.current,
          adaptiveDuration
        );
        
        dispatch({ 
          type: 'START', 
          payload: { sessionId, config: updatedConfig } 
        });
      } catch (error) {
        console.error('Error starting Pomodoro session:', error);
        const sessionId = await createPomodoroSession(
          userId.current,
          state.config.workDuration
        );
        dispatch({ 
          type: 'START', 
          payload: { sessionId, config: state.config } 
        });
      }
    }
  }, [state.status, userId.current, state.config]);

  const pause = useCallback(() => {
    if (['working', 'shortBreak', 'longBreak'].includes(state.status)) {
      dispatch({ type: 'PAUSE' });
      if (state.sessionId) {
        updatePomodoroSession(state.sessionId, {
          pauseCount: state.pauseCount + 1,
        }).catch(console.error);
      }
    }
  }, [state.status, state.sessionId, state.pauseCount]);

  const resume = useCallback(() => {
    if (state.status === 'paused') {
      dispatch({ type: 'RESUME' });
    }
  }, [state.status]);

  const cancel = useCallback(async () => {
    if (state.sessionId) {
      await cancelPomodoroSession(state.sessionId);
    }
    dispatch({ type: 'CANCEL' });
  }, [state.sessionId]);

  const finishSession = useCallback(async () => {
    if (state.status === 'working' && state.sessionId) {
      await handleWorkComplete();
    }
  }, [state.status, state.sessionId, handleWorkComplete]);

  const reset = useCallback(() => {
    dispatch({ type: 'RESET' });
    setFocusResult(null);
    setSessionCompleted(false);
  }, []);

  return {
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
  };
}
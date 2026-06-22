import { useReducer, useEffect, useRef, useCallback, useState } from 'react';
import {
  PomodoroState,
  PomodoroAction,
  PomodoroConfig,
  PomodoroStatus,
  FocusScoreResult,
  AchievementDef,
  PomodoroSettings,
} from '../types/pomodoro';
import {
  createPomodoroSession,
  updatePomodoroSession,
  completePomodoroSession,
  cancelPomodoroSession,
  calculateFocusScore,
  calculateXp,
  updateDailyAnalytics,
  getAdaptiveDuration,
} from '../services/pomodoroService';
import { checkAndUnlockAchievements } from '../services/achievementService';
import { usePomodoroSettings } from './usePomodoroSettings';

// ---------- Constants ----------
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

const STORAGE_KEY_PREFIX = 'pomodoro_state_';

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

// ---------- Web Audio API – tạo âm thanh không cần file ----------
let audioContext: AudioContext | null = null;

const getAudioContext = (): AudioContext => {
  if (!audioContext) {
    audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return audioContext;
};

const playBeep = (frequency: number, duration: number, count: number = 1, gap: number = 150) => {
  if (!audioContext) {
    audioContext = getAudioContext();
  }
  // Resume context nếu bị suspend (do autoplay policy)
  if (audioContext.state === 'suspended') {
    audioContext.resume().catch(() => {});
  }
  if (audioContext.state !== 'running') return;

  const playSingle = () => {
    const oscillator = audioContext!.createOscillator();
    const gainNode = audioContext!.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(audioContext!.destination);
    oscillator.frequency.value = frequency;
    oscillator.type = 'sine';
    gainNode.gain.setValueAtTime(0.3, audioContext!.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext!.currentTime + duration / 1000);
    oscillator.start();
    oscillator.stop(audioContext!.currentTime + duration / 1000);
  };

  for (let i = 0; i < count; i++) {
    setTimeout(() => playSingle(), i * (duration + gap));
  }
};

// ---------- Build config ----------
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

// ---------- Storage ----------
const saveStateToStorage = (userId: string, state: PomodoroState) => {
  if (!userId) return;
  const shouldSave = ['working', 'shortBreak', 'longBreak', 'paused'].includes(state.status);
  if (!shouldSave) {
    localStorage.removeItem(STORAGE_KEY_PREFIX + userId);
    return;
  }
  try {
    const data = {
      ...state,
      startTime: null,
      isRunning: false,
      updatedAt: Date.now(),
    };
    localStorage.setItem(STORAGE_KEY_PREFIX + userId, JSON.stringify(data));
  } catch {
    // ignore
  }
};

const loadStateFromStorage = (userId: string): (PomodoroState & { updatedAt?: number }) | null => {
  if (!userId) return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PREFIX + userId);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed.status || !parsed.config) return null;
    return parsed;
  } catch {
    return null;
  }
};

// ---------- Reducer ----------
function pomodoroReducer(state: PomodoroState, action: PomodoroAction): PomodoroState {
  const { config } = state;

  switch (action.type) {
    case 'RESTORE_STATE': {
      const saved = action.payload;
      return {
        ...saved,
        config: state.config,
        startTime: saved.startTime ?? null,
        isRunning: saved.isRunning ?? false,
        timeLeft: Math.min(saved.timeLeft, saved.totalSeconds),
      };
    }

    case 'UPDATE_CONFIG': {
      const newConfig = action.payload;
      if (state.status === 'idle' || state.status === 'completed') {
        return {
          ...state,
          config: newConfig,
          timeLeft: newConfig.workDuration * 60,
          totalSeconds: newConfig.workDuration * 60,
        };
      }
      if (state.status === 'paused') {
        return { ...state, config: newConfig };
      }
      return { ...state, config: newConfig };
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
      if (['working', 'shortBreak', 'longBreak'].includes(state.status)) {
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
        let previousStatus: PomodoroStatus = 'working';
        const w = state.config.workDuration * 60;
        const s = state.config.shortBreakDuration * 60;
        const l = state.config.longBreakDuration * 60;
        if (state.totalSeconds === w) previousStatus = 'working';
        else if (state.totalSeconds === s) previousStatus = 'shortBreak';
        else if (state.totalSeconds === l) previousStatus = 'longBreak';

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
        // Long break kết thúc → chuỗi hoàn thành, về idle
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

// ---------- Hook ----------
export function usePomodoro(initialConfig?: Partial<PomodoroConfig>) {
  const { settings, loading: settingsLoading, reload: reloadSettings } = usePomodoroSettings();
  const userId = useRef<string | null>(null);

  // Khởi tạo config mới nhất
  const [config, setConfig] = useState<PomodoroConfig>(() => {
    if (settings && !settingsLoading) {
      return buildConfigFromSettings(settings);
    }
    return { ...DEFAULT_CONFIG, ...initialConfig };
  });

  // Khởi tạo reducer với state ban đầu
  const [state, dispatch] = useReducer(pomodoroReducer, config, getInitialState);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [focusResult, setFocusResult] = useState<FocusScoreResult | null>(null);
  const [sessionCompleted, setSessionCompleted] = useState(false);
  const [newAchievements, setNewAchievements] = useState<AchievementDef[]>([]);
  const [showAchievement, setShowAchievement] = useState(false);

  // ---------- Lắng nghe sự kiện settings ----------
  useEffect(() => {
    const handleSettingsUpdate = () => {
      reloadSettings();
    };
    window.addEventListener('pomodoro-settings-updated', handleSettingsUpdate);
    return () => window.removeEventListener('pomodoro-settings-updated', handleSettingsUpdate);
  }, [reloadSettings]);

  // Cập nhật config khi settings thay đổi
  useEffect(() => {
    if (!settingsLoading && settings) {
      const newConfig = buildConfigFromSettings(settings);
      setConfig(newConfig);
      dispatch({ type: 'UPDATE_CONFIG', payload: newConfig });
    }
  }, [settings, settingsLoading]);

  // ---------- Lưu / khôi phục state từ localStorage ----------
  const restoreState = useCallback((uid: string) => {
    const saved = loadStateFromStorage(uid);
    if (saved) {
      const { updatedAt, ...stateData } = saved;
      let newState = { ...stateData, config: config };

      if (updatedAt) {
        const elapsedSeconds = Math.floor((Date.now() - updatedAt) / 1000);
        let newTimeLeft = Math.max(0, newState.timeLeft - elapsedSeconds);
        newState.timeLeft = newTimeLeft;
        newState.elapsed = newState.totalSeconds - newTimeLeft;

        if (newTimeLeft > 0 && ['working', 'shortBreak', 'longBreak'].includes(newState.status)) {
          newState.isRunning = true;
          newState.startTime = Date.now();
        } else if (newTimeLeft <= 0) {
          newState = getInitialState(config);
          localStorage.removeItem(STORAGE_KEY_PREFIX + uid);
        } else {
          newState.isRunning = false;
          newState.startTime = null;
        }
      } else {
        newState.isRunning = false;
        newState.startTime = null;
      }

      dispatch({ type: 'RESTORE_STATE', payload: newState });
    }
  }, [config]);

  const setUserId = useCallback((uid: string) => {
    userId.current = uid;
    if (uid) {
      restoreState(uid);
    }
  }, [restoreState]);

  // Lưu state mỗi khi thay đổi
  useEffect(() => {
    if (userId.current) {
      saveStateToStorage(userId.current, state);
    }
  }, [state]);

  // ---------- Âm thanh (Web Audio) ----------
  const prevStatusRef = useRef(state.status);

  useEffect(() => {
    const prev = prevStatusRef.current;

    // Khi work hoàn thành (chuyển từ working sang break)
    if (prev === 'working' && (state.status === 'shortBreak' || state.status === 'longBreak')) {
      // Âm thanh báo kết thúc work: beep 800Hz, 200ms
      playBeep(800, 200, 1);
    }

    // Khi long break kết thúc (chuỗi hoàn thành)
    if (prev === 'longBreak' && state.status === 'idle' && state.totalCycles > 0) {
      // Âm thanh báo hoàn thành chuỗi: 2 tiếng beep 600Hz, 300ms cách nhau 150ms
      playBeep(600, 300, 2, 150);
    }

    prevStatusRef.current = state.status;
  }, [state.status, state.totalCycles]);

  // Trường hợp state chuyển sang 'completed' (nếu có)
  useEffect(() => {
    if (state.status === 'completed' && state.totalCycles > 0) {
      playBeep(600, 300, 2, 150);
    }
  }, [state.status]);

  // ---------- Timer logic ----------
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
        dispatch({ type: 'TAB_SWITCH', payload: { duration: 0 } });
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [state.isRunning]);

  // Handle work complete
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
  }, [
    userId.current,
    state.sessionId,
    state.pauseCount,
    state.tabSwitchCount,
    state.earlyCancelCount,
    state.totalCycles,
    state.config.workDuration,
  ]);

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
  }, [
    state.isRunning,
    state.startTime,
    state.totalSeconds,
    state.elapsed,
    state.status,
    clearTimer,
    handleWorkComplete,
  ]);

  // Start/stop timer
  useEffect(() => {
    if (state.isRunning) {
      startTimer();
    } else {
      clearTimer();
    }
    return clearTimer;
  }, [state.isRunning, startTimer, clearTimer]);

  // ---------- Public actions ----------
  const start = useCallback(async () => {
    if (state.status === 'idle' && userId.current) {
      let duration = state.config.workDuration;
      if (state.config.workDuration === DEFAULT_CONFIG.workDuration) {
        try {
          const adaptive = await getAdaptiveDuration(userId.current);
          duration = adaptive;
        } catch (error) {
          console.error('Error getting adaptive duration:', error);
        }
      }

      const sessionId = await createPomodoroSession(userId.current, duration);
      const updatedConfig = { ...state.config, workDuration: duration };

      dispatch({
        type: 'START',
        payload: { sessionId, config: updatedConfig },
      });
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
    if (userId.current) localStorage.removeItem(STORAGE_KEY_PREFIX + userId.current);
  }, [state.sessionId, userId.current]);

  const finishSession = useCallback(async () => {
    if (state.status === 'working' && state.sessionId) {
      await handleWorkComplete();
    }
  }, [state.status, state.sessionId, handleWorkComplete]);

  const reset = useCallback(() => {
    dispatch({ type: 'RESET' });
    setFocusResult(null);
    setSessionCompleted(false);
    if (userId.current) localStorage.removeItem(STORAGE_KEY_PREFIX + userId.current);
  }, [userId.current]);

  // ---------- Return ----------
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
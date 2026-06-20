import { useReducer, useEffect, useRef, useCallback, useState } from 'react';
import { 
  PomodoroState, 
  PomodoroAction, 
  PomodoroConfig, 
  PomodoroStatus,
  FocusScoreResult,
  AchievementDef
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
        const previousStatus = state.totalSeconds === state.config.workDuration * 60 ? 'working'
          : state.totalSeconds === state.config.shortBreakDuration * 60 ? 'shortBreak'
          : 'longBreak';
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

export function usePomodoro(initialConfig?: Partial<PomodoroConfig>) {
  const config: PomodoroConfig = { ...DEFAULT_CONFIG, ...initialConfig };
  const [state, dispatch] = useReducer(pomodoroReducer, config, getInitialState);
  
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const userId = useRef<string | null>(null);
  const [focusResult, setFocusResult] = useState<FocusScoreResult | null>(null);
  const [sessionCompleted, setSessionCompleted] = useState(false);
  const [newAchievements, setNewAchievements] = useState<AchievementDef[]>([]);
  const [showAchievement, setShowAchievement] = useState(false);

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
  }, [state.isRunning, state.startTime, state.totalSeconds, state.elapsed, state.status, clearTimer]);

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
  }, [userId.current, state.sessionId, state.pauseCount, state.tabSwitchCount, state.earlyCancelCount, state.totalCycles, state.config.workDuration]);

  useEffect(() => {
    if (state.isRunning) {
      startTimer();
    } else {
      clearTimer();
    }
    return clearTimer;
  }, [state.isRunning, startTimer, clearTimer]);

  const start = useCallback(async () => {
    if (state.status === 'idle' && userId.current) {
      try {
        const adaptiveDuration = await getAdaptiveDuration(userId.current);
        const updatedConfig = { ...config, workDuration: adaptiveDuration };
        
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
          config.workDuration
        );
        dispatch({ 
          type: 'START', 
          payload: { sessionId, config } 
        });
      }
    }
  }, [state.status, userId.current, config]);

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
  };
}
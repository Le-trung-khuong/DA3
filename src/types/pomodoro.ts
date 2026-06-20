export type PomodoroStatus = 
  | 'idle'
  | 'working'
  | 'shortBreak'
  | 'longBreak'
  | 'paused'
  | 'completed'
  | 'cancelled';

export interface PomodoroConfig {
  workDuration: number;
  shortBreakDuration: number;
  longBreakDuration: number;
  cyclesBeforeLongBreak: number;
  autoStartNext: boolean;
  autoStartBreak: boolean;
  soundEnabled: boolean;
  notificationEnabled: boolean;
}

export interface PomodoroState {
  status: PomodoroStatus;
  timeLeft: number;
  totalSeconds: number;
  currentCycle: number;
  totalCycles: number;
  config: PomodoroConfig;
  isRunning: boolean;
  startTime: number | null;
  elapsed: number;
  sessionId: string | null;
  pauseCount: number;
  tabSwitchCount: number;
  tabSwitchTotalTime: number;
  earlyCancelCount: number;
}

export type PomodoroAction = 
  | { type: 'START'; payload?: { sessionId?: string; config?: PomodoroConfig } }
  | { type: 'PAUSE' }
  | { type: 'RESUME' }
  | { type: 'CANCEL' }
  | { type: 'TICK'; payload: { timeLeft: number; elapsedDiff: number } }
  | { type: 'TAB_SWITCH'; payload?: { duration: number } }
  | { type: 'WORK_COMPLETE' }
  | { type: 'BREAK_COMPLETE' }
  | { type: 'COMPLETE' }
  | { type: 'RESET' };

export interface FocusScoreFactors {
  pauseCount: number;
  tabSwitchCount: number;
  earlyCancelCount: number;
  completedSessions: number;
  totalStudyMinutes: number;
}

export interface FocusScoreResult {
  score: number;
  grade: 'excellent' | 'good' | 'average' | 'needsImprovement';
  feedback: string;
  factors: FocusScoreFactors;
}

export interface PomodoroSession {
  id: string;
  userId: string;
  courseId?: string;
  lessonId?: string;
  startedAt: Date;
  endedAt: Date;
  workDuration: number;
  actualStudyTime: number;
  pauseCount: number;
  tabSwitchCount: number;
  tabSwitchTotalTime: number;
  earlyCancelCount: number;
  focusScore: number;
  xpEarned: number;
  bonusXP: number;
  status: 'in_progress' | 'completed' | 'cancelled' | 'interrupted';
  completed: boolean;
  noPause: boolean;
  perfectSession: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface DailyAnalytics {
  userId: string;
  date: string;
  totalSessions: number;
  totalStudyMinutes: number;
  avgFocusScore: number;
  totalXP: number;
  sessions: {
    sessionId: string;
    focusScore: number;
    duration: number;
    xpEarned: number;
  }[];
  hourDistribution: {
    hour: number;
    minutes: number;
  }[];
  courseDistribution: {
    courseId: string;
    minutes: number;
  }[];
}

export interface AchievementDef {
  id: string;
  title: string;
  description: string;
  icon: string;
  category: 'beginner' | 'intermediate' | 'expert' | 'special';
  criteria: { type: string; threshold: number };
  xpReward: number;
  rarity: string;
  order: number;
}
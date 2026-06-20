import { db } from '../utils/config';
import { 
  doc, setDoc, updateDoc, getDoc, getDocs, 
  addDoc, collection, query, where, 
  serverTimestamp, Timestamp, increment,
  orderBy, limit 
} from 'firebase/firestore';
import { 
  PomodoroSession, 
  DailyAnalytics, 
  FocusScoreResult,
  FocusScoreFactors 
} from '../types/pomodoro';

// ============ Session Management ============

export const createPomodoroSession = async (
  userId: string,
  workDuration: number,
  courseId?: string,
  lessonId?: string
): Promise<string> => {
  const sessionData = {
    userId,
    courseId: courseId || null,
    lessonId: lessonId || null,
    startedAt: serverTimestamp(),
    workDuration,
    actualStudyTime: 0,
    pauseCount: 0,
    tabSwitchCount: 0,
    tabSwitchTotalTime: 0,
    earlyCancelCount: 0,
    focusScore: 0,
    xpEarned: 0,
    bonusXP: 0,
    status: 'in_progress',
    completed: false,
    noPause: false,
    perfectSession: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const docRef = await addDoc(collection(db, 'pomodoroSessions'), sessionData);
  return docRef.id;
};

export const updatePomodoroSession = async (
  sessionId: string,
  data: Partial<PomodoroSession>
): Promise<void> => {
  const sessionRef = doc(db, 'pomodoroSessions', sessionId);
  await updateDoc(sessionRef, {
    ...data,
    updatedAt: serverTimestamp(),
  });
};

export const completePomodoroSession = async (
  sessionId: string,
  focusScoreResult: FocusScoreResult,
  xpEarned: number,
  bonusXP: number
): Promise<void> => {
  const sessionRef = doc(db, 'pomodoroSessions', sessionId);
  await updateDoc(sessionRef, {
    focusScore: focusScoreResult.score,
    xpEarned,
    bonusXP,
    status: 'completed',
    completed: true,
    endedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
};

export const cancelPomodoroSession = async (
  sessionId: string
): Promise<void> => {
  const sessionRef = doc(db, 'pomodoroSessions', sessionId);
  await updateDoc(sessionRef, {
    status: 'cancelled',
    completed: false,
    endedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
};

// ============ Focus Score Calculation ============

export const calculateFocusScore = async (
  userId: string,
  factors: FocusScoreFactors
): Promise<FocusScoreResult> => {
  let score = 100;
  
  score -= factors.pauseCount * 5;
  score -= factors.tabSwitchCount * 2;
  score -= factors.earlyCancelCount * 10;
  
  if (factors.completedSessions > 0) {
    score += Math.min(factors.completedSessions * 2, 20);
  }
  
  if (factors.totalStudyMinutes > 60) {
    score += Math.min(Math.floor(factors.totalStudyMinutes / 60), 10);
  }
  
  score = Math.max(0, Math.min(100, score));
  
  let grade: 'excellent' | 'good' | 'average' | 'needsImprovement';
  let feedback: string;
  
  if (score >= 90) {
    grade = 'excellent';
    feedback = 'Tuyệt vời! Bạn đã tập trung rất tốt! 🌟';
  } else if (score >= 70) {
    grade = 'good';
    feedback = 'Khá tốt! Hãy cố gắng hơn nữa! 💪';
  } else if (score >= 50) {
    grade = 'average';
    feedback = 'Cần cải thiện sự tập trung. Hãy thử giảm thiểu phân tâm! 📱';
  } else {
    grade = 'needsImprovement';
    feedback = 'Hãy thử học trong không gian yên tĩnh hơn và tắt thông báo! 🎯';
  }
  
  return {
    score,
    grade,
    feedback,
    factors,
  };
};

// ============ XP Calculation ============

export const calculateXp = (
  workDuration: number,
  focusScore: number,
  hasStreak: boolean
): { xpEarned: number; bonusXP: number } => {
  let xpEarned = workDuration;
  
  const bonusMultiplier = focusScore / 100;
  const bonusXP = Math.floor(xpEarned * bonusMultiplier * 0.5);
  
  let streakBonus = 0;
  if (hasStreak) {
    streakBonus = Math.floor(xpEarned * 0.1);
  }
  
  xpEarned += bonusXP + streakBonus;
  
  return { xpEarned, bonusXP: bonusXP + streakBonus };
};

// ============ Analytics ============

export const updateDailyAnalytics = async (
  userId: string,
  sessionData: {
    sessionId: string;
    focusScore: number;
    duration: number;
    xpEarned: number;
    courseId?: string;
    hour: number;
  }
): Promise<void> => {
  const today = new Date().toISOString().slice(0, 10);
  const analyticsRef = doc(db, 'pomodoroAnalytics', `${userId}_${today}`);
  
  const analyticsSnap = await getDoc(analyticsRef);
  
  if (analyticsSnap.exists()) {
    const data = analyticsSnap.data();
    
    const sessions = [...(data.sessions || [])];
    sessions.push({
      sessionId: sessionData.sessionId,
      focusScore: sessionData.focusScore,
      duration: sessionData.duration,
      xpEarned: sessionData.xpEarned,
    });
    
    const hourDistribution = [...(data.hourDistribution || [])];
    const hourIndex = hourDistribution.findIndex((h: any) => h.hour === sessionData.hour);
    if (hourIndex >= 0) {
      hourDistribution[hourIndex].minutes += sessionData.duration;
    } else {
      hourDistribution.push({ hour: sessionData.hour, minutes: sessionData.duration });
    }
    
    const courseDistribution = [...(data.courseDistribution || [])];
    if (sessionData.courseId) {
      const courseIndex = courseDistribution.findIndex((c: any) => c.courseId === sessionData.courseId);
      if (courseIndex >= 0) {
        courseDistribution[courseIndex].minutes += sessionData.duration;
      } else {
        courseDistribution.push({ courseId: sessionData.courseId, minutes: sessionData.duration });
      }
    }
    
    await updateDoc(analyticsRef, {
      totalSessions: data.totalSessions + 1,
      totalStudyMinutes: data.totalStudyMinutes + sessionData.duration,
      avgFocusScore: (data.avgFocusScore * data.totalSessions + sessionData.focusScore) / (data.totalSessions + 1),
      totalXP: data.totalXP + sessionData.xpEarned,
      sessions,
      hourDistribution,
      courseDistribution,
      updatedAt: serverTimestamp(),
    });
  } else {
    const newAnalytics: DailyAnalytics = {
      userId,
      date: today,
      totalSessions: 1,
      totalStudyMinutes: sessionData.duration,
      avgFocusScore: sessionData.focusScore,
      totalXP: sessionData.xpEarned,
      sessions: [{
        sessionId: sessionData.sessionId,
        focusScore: sessionData.focusScore,
        duration: sessionData.duration,
        xpEarned: sessionData.xpEarned,
      }],
      hourDistribution: [{ hour: sessionData.hour, minutes: sessionData.duration }],
      courseDistribution: sessionData.courseId 
        ? [{ courseId: sessionData.courseId, minutes: sessionData.duration }]
        : [],
    };
    
    await setDoc(analyticsRef, newAnalytics);
  }
};

// ============ Adaptive Duration ============

export const getAdaptiveDuration = async (
  userId: string
): Promise<number> => {
  const sessionsRef = collection(db, 'pomodoroSessions');
  const q = query(
    sessionsRef,
    where('userId', '==', userId),
    where('completed', '==', true),
    orderBy('createdAt', 'desc'),
    limit(20)
  );
  const snapshot = await getDocs(q);
  const sessions = snapshot.docs.map(doc => doc.data() as PomodoroSession);
  
  if (sessions.length === 0) {
    return 20;
  }
  
  const avgFocusScore = sessions.reduce((sum, s) => sum + s.focusScore, 0) / sessions.length;
  const totalPauses = sessions.reduce((sum, s) => sum + s.pauseCount, 0);
  const avgPauses = totalPauses / sessions.length;
  const cancelCount = sessions.filter(s => s.status === 'cancelled').length;
  const cancelRate = cancelCount / sessions.length;
  
  let duration = 25;
  
  if (avgFocusScore >= 80) {
    duration = 30;
  } else if (avgFocusScore >= 60) {
    duration = 25;
  } else if (avgFocusScore >= 40) {
    duration = 20;
  } else {
    duration = 15;
  }
  
  if (avgPauses > 3) {
    duration = Math.max(duration - 5, 10);
  }
  
  if (cancelRate > 0.3) {
    duration = Math.max(duration - 5, 10);
  }
  
  return duration;
};
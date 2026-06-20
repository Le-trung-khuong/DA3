import { useState, useEffect } from 'react';
import { db } from '../utils/config';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { DailyAnalytics } from '../types/pomodoro';

interface AnalyticsData {
  daily: {
    date: string;
    totalMinutes: number;
    sessions: number;
    xpEarned: number;
    avgFocus: number;
  }[];
  weekly: {
    totalMinutes: number;
    sessions: number;
    xpEarned: number;
    avgFocus: number;
  };
  monthly: {
    totalMinutes: number;
    sessions: number;
    xpEarned: number;
    avgFocus: number;
  };
  bestTimes: {
    hour: number;
    minutes: number;
  }[];
  courseStats: {
    courseId: string;
    courseName: string;
    minutes: number;
  }[];
}

export function useAnalytics(userId: string | undefined) {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    const fetchAnalytics = async () => {
      setLoading(true);
      
      try {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        
        const analyticsRef = collection(db, 'pomodoroAnalytics');
        const q = query(
          analyticsRef,
          where('userId', '==', userId),
          where('date', '>=', sevenDaysAgo.toISOString().slice(0, 10))
        );
        const snapshot = await getDocs(q);
        
        const dailyData = snapshot.docs.map(doc => {
          const data = doc.data() as DailyAnalytics;
          return {
            date: data.date,
            totalMinutes: data.totalStudyMinutes,
            sessions: data.totalSessions,
            xpEarned: data.totalXP,
            avgFocus: data.avgFocusScore,
          };
        });
        
        const weekly = {
          totalMinutes: dailyData.reduce((sum, d) => sum + d.totalMinutes, 0),
          sessions: dailyData.reduce((sum, d) => sum + d.sessions, 0),
          xpEarned: dailyData.reduce((sum, d) => sum + d.xpEarned, 0),
          avgFocus: dailyData.length > 0 
            ? dailyData.reduce((sum, d) => sum + d.avgFocus, 0) / dailyData.length
            : 0,
        };
        
        const hourDistribution: { [key: number]: number } = {};
        const courseStats: { [key: string]: number } = {};
        
        for (const doc of snapshot.docs) {
          const data = doc.data() as DailyAnalytics;
          data.hourDistribution?.forEach((h: { hour: number; minutes: number }) => {
            hourDistribution[h.hour] = (hourDistribution[h.hour] || 0) + h.minutes;
          });
          data.courseDistribution?.forEach((c: { courseId: string; minutes: number }) => {
            courseStats[c.courseId] = (courseStats[c.courseId] || 0) + c.minutes;
          });
        }
        
        const bestTimes = Object.entries(hourDistribution)
          .map(([hour, minutes]) => ({ hour: parseInt(hour), minutes }))
          .sort((a, b) => b.minutes - a.minutes)
          .slice(0, 5);
        
        const courseStatsWithName = await Promise.all(
          Object.entries(courseStats).map(async ([courseId, minutes]) => {
            try {
              const courseDoc = await getDoc(doc(db, 'courses', courseId));
              const courseName = courseDoc.exists() ? courseDoc.data().title : 'Unknown Course';
              return { courseId, courseName, minutes };
            } catch {
              return { courseId, courseName: 'Unknown Course', minutes };
            }
          })
        );
        
        setData({
          daily: dailyData,
          weekly,
          monthly: { 
            ...weekly, 
            totalMinutes: weekly.totalMinutes * 4,
            sessions: weekly.sessions * 4,
            xpEarned: weekly.xpEarned * 4,
          },
          bestTimes,
          courseStats: courseStatsWithName.sort((a, b) => b.minutes - a.minutes),
        });
      } catch (error) {
        console.error('Error fetching analytics:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchAnalytics();
  }, [userId]);

  return { data, loading };
}
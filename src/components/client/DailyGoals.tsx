// src/components/client/DailyGoals.tsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { DAILY_TASKS } from '../../services/dailyGoalService';
import { CheckCircle, Target } from 'lucide-react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../../utils/config';

const DailyGoals: React.FC = () => {
  const { currentUser } = useAuth();
  const [completedIds, setCompletedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    if (!currentUser) {
      setLoading(false);
      return;
    }

    const ref = doc(db, 'dailyProgress', `${currentUser.uid}_${today}`);
    const unsubscribe = onSnapshot(
      ref,
      (snap) => {
        if (snap.exists()) {
          setCompletedIds(snap.data().completedTasks || []);
        } else {
          setCompletedIds([]);
        }
        setLoading(false);
      },
      (err) => {
        console.error('DailyGoals real-time error:', err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [currentUser, today]);

  if (loading) return <div style={{ color: '#C7C4D8' }}>Đang tải...</div>;

  const total = DAILY_TASKS.length;
  const done = completedIds.length;

  return (
    <div style={{ background: 'rgba(26,26,46,0.7)', borderRadius: 20, border: '1px solid rgba(255,255,255,0.07)', padding: 24, backdropFilter: 'blur(12px)', boxShadow: '0 4px 24px rgba(0,0,0,0.2)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: '#E4E1EE', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Target size={22} color="#6C63FF" /> Nhiệm vụ hằng ngày
        </h2>
        <span style={{
          fontSize: 13, fontWeight: 800,
          color: done === total ? '#45f1c5' : '#C7C4D8',
          background: done === total ? 'rgba(69,241,197,0.12)' : 'rgba(255,255,255,0.05)',
          border: done === total ? '1px solid rgba(69,241,197,0.25)' : '1px solid rgba(255,255,255,0.06)',
          padding: '5px 14px', borderRadius: 999,
          transition: 'all .3s',
        }}>
          {done}/{total} {done === total ? '✓' : ''}
        </span>
      </div>

      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {DAILY_TASKS.map(task => {
          const isDone = completedIds.includes(task.id);
          return (
            <li
              key={task.id}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '11px 14px', borderRadius: 12, marginBottom: 6,
                background: isDone ? 'rgba(69,241,197,0.06)' : 'rgba(255,255,255,0.02)',
                border: isDone ? '1px solid rgba(69,241,197,0.15)' : '1px solid rgba(255,255,255,0.04)',
                transition: 'all .2s',
                opacity: isDone ? 0.75 : 1,
              }}
            >
              {isDone ? (
                <CheckCircle size={20} color="#45f1c5" />
              ) : (
                <div style={{ width: 20, height: 20, borderRadius: '50%', border: '2px solid #47464f', flexShrink: 0 }} />
              )}
              <span style={{ fontSize: 15, color: isDone ? '#47464f' : '#E4E1EE', textDecoration: isDone ? 'line-through' : 'none' }}>
                {task.icon} {task.text}
              </span>
              <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 700, color: isDone ? '#45f1c5' : '#6C63FF', background: isDone ? 'rgba(69,241,197,0.1)' : 'rgba(108,99,255,0.1)', padding: '3px 9px', borderRadius: 999 }}>
                +{task.xpReward} XP
              </span>
            </li>
          );
        })}
      </ul>

      {done === total && (
        <div style={{ marginTop: 16, padding: '14px 16px', background: 'linear-gradient(135deg,rgba(69,241,197,0.12),rgba(0,212,170,0.08))', borderRadius: 12, textAlign: 'center', color: '#45f1c5', border: '1px solid rgba(69,241,197,0.2)', boxShadow: '0 4px 16px rgba(69,241,197,0.1)' }}>
          🎉 Hoàn thành tất cả nhiệm vụ hôm nay!
        </div>
      )}
    </div>
  );
};

export default DailyGoals;
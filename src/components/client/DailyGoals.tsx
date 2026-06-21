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
    <div style={{ background: 'rgba(26,26,46,0.5)', borderRadius: 16, border: '1px solid rgba(255,255,255,0.06)', padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: '#E4E1EE', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Target size={22} color="#6C63FF" /> Nhiệm vụ hằng ngày
        </h2>
        <span style={{ fontSize: 14, color: '#C7C4D8', background: 'rgba(255,255,255,0.05)', padding: '4px 12px', borderRadius: 20 }}>
          {done}/{total}
        </span>
      </div>

      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {DAILY_TASKS.map(task => {
          const isDone = completedIds.includes(task.id);
          return (
            <li
              key={task.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '10px 12px',
                borderRadius: 8,
                marginBottom: 4,
                background: isDone ? 'rgba(255,255,255,0.04)' : 'transparent',
                opacity: isDone ? 0.7 : 1,
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
              <span style={{ marginLeft: 'auto', fontSize: 13, color: '#C7C4D8' }}>
                +{task.xpReward} XP
              </span>
            </li>
          );
        })}
      </ul>

      {done === total && (
        <div style={{ marginTop: 16, padding: 12, background: 'rgba(69,241,197,0.1)', borderRadius: 8, textAlign: 'center', color: '#45f1c5' }}>
          🎉 Hoàn thành tất cả nhiệm vụ hôm nay!
        </div>
      )}
    </div>
  );
};

export default DailyGoals;
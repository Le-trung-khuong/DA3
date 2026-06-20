import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { getDailyGoals, saveDailyGoals, toggleGoalCompletion } from '../../services/dailyGoalService';

const DailyGoals: React.FC = () => {
  const { currentUser } = useAuth();
  const [goals, setGoals] = useState<string[]>([]);
  const [completed, setCompleted] = useState<boolean[]>([]);
  const [newGoal, setNewGoal] = useState('');
  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    if (currentUser) {
      getDailyGoals(currentUser.uid, today).then(data => {
        if (data) {
          setGoals(data.goals || []);
          setCompleted(data.completed || []);
        } else {
          setGoals([]);
          setCompleted([]);
        }
      });
    }
  }, [currentUser, today]);

  const handleAdd = async () => {
    if (!newGoal.trim() || !currentUser) return;
    const newGoals = [...goals, newGoal.trim()];
    const newCompleted = [...completed, false];
    setGoals(newGoals);
    setCompleted(newCompleted);
    await saveDailyGoals(currentUser.uid, today, newGoals, newCompleted);
    setNewGoal('');
  };

  const handleToggle = async (index: number) => {
    if (!currentUser) return;
    await toggleGoalCompletion(currentUser.uid, today, index);
    const newCompleted = [...completed];
    newCompleted[index] = !newCompleted[index];
    setCompleted(newCompleted);
  };

  return (
    <div className="bg-white p-4 rounded shadow">
      <h2 className="text-xl font-bold mb-3">🎯 Mục tiêu hằng ngày</h2>
      <ul className="space-y-2">
        {goals.map((g, i) => (
          <li key={i} className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={completed[i] || false}
              onChange={() => handleToggle(i)}
            />
            <span className={completed[i] ? 'line-through text-gray-400' : ''}>{g}</span>
          </li>
        ))}
      </ul>
      <div className="flex mt-3 gap-2">
        <input
          className="flex-1 border px-2 py-1 rounded"
          value={newGoal}
          onChange={e => setNewGoal(e.target.value)}
          placeholder="Thêm mục tiêu..."
        />
        <button className="bg-blue-500 text-white px-4 py-1 rounded" onClick={handleAdd}>Thêm</button>
      </div>
    </div>
  );
};

export default DailyGoals;
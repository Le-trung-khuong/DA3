// src/components/admin/LearningHeatmap.tsx
import React from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from 'recharts';
import { useLearningHeatmap } from '../../hooks/useLearningHeatmap';
import { useAuth } from '../../contexts/AuthContext';

export default function LearningHeatmap() {
  const { currentUser } = useAuth();
  const { data, loading } = useLearningHeatmap(currentUser?.uid, 30);

  if (loading) return <div style={{ padding: 16, color: '#C7C4D8' }}>Loading...</div>;

  const getColor = (xp: number) => {
    if (xp === 0) return '#2a2a3a';
    if (xp < 50) return '#4a4a7a';
    if (xp < 100) return '#6a6aaa';
    if (xp < 200) return '#8a8ada';
    return '#aaaaff';
  };

  return (
    <div style={{ padding: 16, background: '#1a1a2e', borderRadius: 16 }}>
      <h4 style={{ color: '#E4E1EE' }}>Learning Heatmap (30 ngày)</h4>
      <ResponsiveContainer width="100%" height={100}>
        <BarChart data={data}>
          <XAxis dataKey="date" tick={{ fontSize: 10 }} interval={4} />
          <YAxis hide />
          <Tooltip
            labelFormatter={(label: string) => new Date(label).toLocaleDateString()}
            formatter={(value: number) => [`${value} XP`, 'XP']}
          />
          <Bar dataKey="xp">
            {data.map((entry: { date: string; xp: number }, idx: number) => (
              <Cell key={idx} fill={getColor(entry.xp)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
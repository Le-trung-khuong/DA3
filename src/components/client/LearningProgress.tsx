import React, { useEffect, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { getUserOverallProgress, CourseProgress } from '../../services/progressService';

const LearningProgress: React.FC = () => {
  const { currentUser } = useAuth();
  const [progress, setProgress] = useState<CourseProgress[]>([]);

  useEffect(() => {
    if (currentUser) {
      getUserOverallProgress(currentUser.uid).then(setProgress);
    }
  }, [currentUser]);

  if (progress.length === 0) {
    return (
      <div className="bg-white p-4 rounded shadow mt-4">
        <h2 className="text-xl font-bold mb-3">📚 Tiến độ học tập</h2>
        <p>Chưa có tiến độ học tập nào.</p>
      </div>
    );
  }

  return (
    <div className="bg-white p-4 rounded shadow mt-4">
      <h2 className="text-xl font-bold mb-3">📚 Tiến độ học tập</h2>
      {progress.map(p => (
        <div key={p.courseId} className="mb-2">
          <div className="flex justify-between">
            <span>{p.courseName}</span>
            <span>{p.percent}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded h-2">
            <div className="bg-green-500 h-2 rounded" style={{ width: `${p.percent}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
};

export default LearningProgress;
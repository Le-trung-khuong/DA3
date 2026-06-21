// src/components/player/QuizReview.tsx
import React from 'react';
import { CheckCircle, XCircle } from 'lucide-react';

interface QuizReviewProps {
  questions: any[];
  answers: { [qid: string]: number };
  score: number;
  onClose: () => void;
}

export const QuizReview: React.FC<QuizReviewProps> = ({ questions, answers, score, onClose }) => {
  const correctCount = questions.filter(q => answers[q.id] === q.correctOptionIndex).length;
  const total = questions.length;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ maxWidth: 700, width: '100%', maxHeight: '90vh', overflowY: 'auto', background: '#1A1A2E', borderRadius: 24, padding: 24, border: '1px solid rgba(108,99,255,0.2)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ fontSize: 24, fontWeight: 700, color: '#E4E1EE' }}>📝 Quiz Review</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#C7C4D8', cursor: 'pointer', fontSize: 20 }}>✕</button>
        </div>
        <div style={{ display: 'flex', gap: 20, marginBottom: 24, padding: 16, background: 'rgba(255,255,255,0.04)', borderRadius: 16 }}>
          <div><span style={{ color: '#C7C4D8' }}>Score:</span> <strong style={{ color: '#45f1c5' }}>{Math.round(score)}%</strong></div>
          <div><span style={{ color: '#C7C4D8' }}>Correct:</span> <strong style={{ color: '#45f1c5' }}>{correctCount}/{total}</strong></div>
          <div><span style={{ color: '#C7C4D8' }}>Incorrect:</span> <strong style={{ color: '#ffb4ab' }}>{total - correctCount}</strong></div>
        </div>
        {questions.map((q, idx) => {
          const selected = answers[q.id];
          const isCorrect = selected === q.correctOptionIndex;
          return (
            <div key={q.id} style={{ background: 'rgba(26,26,46,0.6)', borderRadius: 16, padding: 16, marginBottom: 16, border: `1px solid ${isCorrect ? 'rgba(69,241,197,0.2)' : 'rgba(255,180,171,0.2)'}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                {isCorrect ? <CheckCircle size={16} color="#45f1c5" /> : <XCircle size={16} color="#ffb4ab" />}
                <span style={{ fontWeight: 600, color: '#E4E1EE' }}>Q{idx+1}. {q.text}</span>
              </div>
              <div style={{ fontSize: 13, color: '#C7C4D8' }}>Your answer: {selected !== undefined ? q.options[selected] : 'Not answered'}</div>
              {!isCorrect && <div style={{ fontSize: 13, color: '#6C63FF', marginTop: 4 }}>✅ Correct: {q.options[q.correctOptionIndex]}</div>}
              {q.explanation && <div style={{ fontSize: 12, color: '#C7C4D8', marginTop: 8, padding: 8, background: 'rgba(255,255,255,0.04)', borderRadius: 8 }}>💡 {q.explanation}</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
};
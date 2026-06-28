// src/components/player/KnowledgeCheck.tsx
import React, { useState, useRef, useEffect } from 'react';
import { CheckCircle, XCircle } from 'lucide-react';

interface KnowledgeCheckQuestion {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation?: string;
}

interface KnowledgeCheckProps {
  questions: KnowledgeCheckQuestion[];
  onPass: () => void;
  onFail?: () => void;
  isOpen: boolean;
}

export function KnowledgeCheck({ questions, onPass, onFail, isOpen }: KnowledgeCheckProps) {
  const [answers, setAnswers] = useState<{ [key: string]: number }>({});
  const [submitted, setSubmitted] = useState(false);
  const [passed, setPassed] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [validationMessage, setValidationMessage] = useState<string | null>(null);

  // ✅ HIGH-5: Ref để cleanup timeout
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, []);

  if (!isOpen) return null;

  const handleSelect = (questionId: string, index: number) => {
    if (submitted) return;
    setAnswers(prev => ({ ...prev, [questionId]: index }));
  };

  const handleSubmit = () => {
    if (Object.keys(answers).length !== questions.length) {
      // ✅ D3: Thay alert bằng inline validation
      setValidationMessage('Vui lòng trả lời tất cả câu hỏi.');
      return;
    }
    setValidationMessage(null);

    setSubmitted(true);
    const correctCount = questions.filter(q => answers[q.id] === q.correctIndex).length;
    const passThreshold = Math.ceil(questions.length * 0.6);

    const isPassed = correctCount >= passThreshold;
    setPassed(isPassed);
    setShowResults(true);

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    if (isPassed) {
      timeoutRef.current = setTimeout(() => {
        timeoutRef.current = null;
        onPass();
      }, 1500);
    } else if (onFail) {
      timeoutRef.current = setTimeout(() => {
        timeoutRef.current = null;
        onFail();
      }, 1500);
    }
  };

  const handleRetry = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setAnswers({});
    setSubmitted(false);
    setPassed(false);
    setShowResults(false);
    setValidationMessage(null);
  };

  return (
    <div style={{
      background: 'rgba(15,15,26,0.95)',
      borderRadius: 20,
      padding: 28,
      border: '1px solid rgba(108,99,255,0.2)',
      maxWidth: 600,
      margin: '0 auto',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <div style={{
          width: 40,
          height: 40,
          borderRadius: '50%',
          background: 'linear-gradient(135deg,#6C63FF,#9B59B6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <CheckCircle size={20} color="#fff" />
        </div>
        <div>
          <h3 style={{ fontSize: 18, fontWeight: 700, color: '#E4E1EE', margin: 0 }}>
            📝 Kiểm tra nhanh
          </h3>
          <p style={{ fontSize: 13, color: '#C7C4D8', margin: 0 }}>
            Trả lời {questions.length} câu hỏi để xác nhận bạn đã hiểu bài.
          </p>
        </div>
      </div>

      {validationMessage && (
        <div style={{
          color: '#ffb4ab',
          fontSize: 13,
          marginBottom: 12,
          padding: 8,
          background: 'rgba(255,180,171,0.1)',
          borderRadius: 8,
        }}>
          ⚠️ {validationMessage}
        </div>
      )}

      {showResults && (
        <div style={{
          padding: 16,
          borderRadius: 12,
          marginBottom: 20,
          background: passed ? 'rgba(69,241,197,0.1)' : 'rgba(255,180,171,0.1)',
          border: `1px solid ${passed ? 'rgba(69,241,197,0.2)' : 'rgba(255,180,171,0.2)'}`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {passed ? (
              <CheckCircle size={28} color="#45f1c5" />
            ) : (
              <XCircle size={28} color="#ffb4ab" />
            )}
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: passed ? '#45f1c5' : '#ffb4ab' }}>
                {passed ? '✅ Chúc mừng! Bạn đã hiểu bài.' : '❌ Chưa đạt. Hãy đọc lại nội dung.'}
              </div>
              <div style={{ fontSize: 13, color: '#C7C4D8' }}>
                Đúng {questions.filter(q => answers[q.id] === q.correctIndex).length}/{questions.length}
              </div>
            </div>
          </div>
          {!passed && (
            <button
              onClick={handleRetry}
              style={{
                marginTop: 12,
                padding: '6px 16px',
                borderRadius: 8,
                background: 'rgba(108,99,255,0.2)',
                border: '1px solid rgba(108,99,255,0.3)',
                color: '#6C63FF',
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              Làm lại
            </button>
          )}
        </div>
      )}

      {!showResults && questions.map((q, idx) => (
        <div key={q.id} style={{ marginBottom: 20 }}>
          <p style={{ fontWeight: 600, color: '#E4E1EE', marginBottom: 8 }}>
            {idx + 1}. {q.question}
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {q.options.map((opt, oi) => (
              <label
                key={oi}
                onClick={() => handleSelect(q.id, oi)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '10px 14px',
                  borderRadius: 10,
                  background: answers[q.id] === oi ? 'rgba(108,99,255,0.15)' : 'rgba(255,255,255,0.04)',
                  border: answers[q.id] === oi ? '1px solid rgba(108,99,255,0.4)' : '1px solid rgba(255,255,255,0.08)',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                <input
                  type="radio"
                  name={q.id}
                  checked={answers[q.id] === oi}
                  onChange={() => {}}
                  style={{ accentColor: '#6C63FF' }}
                />
                <span style={{ fontSize: 14, color: answers[q.id] === oi ? '#E4E1EE' : '#C7C4D8' }}>
                  {opt}
                </span>
              </label>
            ))}
          </div>
        </div>
      ))}

      {!submitted && !showResults && (
        <button
          onClick={handleSubmit}
          style={{
            width: '100%',
            padding: '12px',
            borderRadius: 12,
            background: 'linear-gradient(135deg,#6C63FF,#9B59B6)',
            border: 'none',
            color: '#fff',
            fontWeight: 700,
            fontSize: 16,
            cursor: 'pointer',
          }}
        >
          Nộp bài
        </button>
      )}
    </div>
  );
}
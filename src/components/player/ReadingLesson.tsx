// src/components/player/ReadingLesson.tsx
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import { LessonCompleteButton } from './LessonCompleteButton';
import { saveResumeData, getResumeData } from '../../services/progressService';
import { Menu, BookOpen, Clock, Lightbulb, AlertTriangle, Info, Bookmark, Target } from 'lucide-react';

interface ReadingLessonProps {
  userId: string;
  courseId: string;
  moduleId: string;
  lessonId: string;
  title: string;
  content: string;
  xpReward: number;
  onComplete?: () => void;
  isCompleted?: boolean;
  lessonType?: 'lesson' | 'quiz' | 'reading' | 'video' | 'flashcard';
}

interface Heading {
  level: number;
  text: string;
  id: string;
}

const slugify = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/--+/g, '-')
    .trim();

const extractHeadings = (markdown: string): Heading[] => {
  const headingRegex = /^(#{1,6})\s+(.+)$/gm;
  const headings: Heading[] = [];
  let match;
  while ((match = headingRegex.exec(markdown)) !== null) {
    const level = match[1].length;
    const text = match[2].trim();
    headings.push({ level, text, id: slugify(text) });
  }
  return headings;
};

const estimateReadingTime = (markdown: string): number => {
  const plainText = markdown.replace(/[#*`\[\]()!]/g, ' ').replace(/\s+/g, ' ').trim();
  const wordCount = plainText.split(/\s+/).length;
  return Math.max(1, Math.ceil(wordCount / 200));
};

const enhanceContentForCards = (content: string): string => {
  let transformed = content;
  transformed = transformed.replace(/^>\s*(💡|Tip:|Tip\s+)\s*(.*)$/gim, (_, emoji, text) => `:::tip ${text} :::`);
  transformed = transformed.replace(/^>\s*(⚠️|Warning:|Warning\s+)\s*(.*)$/gim, (_, emoji, text) => `:::warning ${text} :::`);
  transformed = transformed.replace(/^>\s*(ℹ️|Info:|Info\s+)\s*(.*)$/gim, (_, emoji, text) => `:::info ${text} :::`);
  transformed = transformed.replace(/^>\s*(📘|Definition:|Definition\s+)\s*(.*)$/gim, (_, emoji, text) => `:::definition ${text} :::`);
  transformed = transformed.replace(/^>\s*(🎯|Important:|Important\s+)\s*(.*)$/gim, (_, emoji, text) => `:::important ${text} :::`);
  transformed = transformed.replace(/^>\s*(📝|Note:|Note\s+)\s*(.*)$/gim, (_, emoji, text) => `:::note ${text} :::`);
  return transformed;
};

const KnowledgeCard = ({ icon, color, title, children }: { icon: React.ReactNode; color: string; title: string; children: React.ReactNode }) => (
  <div style={{ background: `rgba(${color},0.1)`, borderLeft: `4px solid ${color}`, borderRadius: '12px', padding: '1rem 1.5rem', margin: '1.5rem 0' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
      {icon}
      <strong style={{ color }}>{title}</strong>
    </div>
    <p style={{ margin: 0, color: '#E4E1EE' }}>{children}</p>
  </div>
);

export function ReadingLesson({
  userId,
  courseId,
  moduleId,
  lessonId,
  title,
  content,
  xpReward,
  onComplete,
  isCompleted = false,
  lessonType = 'reading',
}: ReadingLessonProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [headings, setHeadings] = useState<Heading[]>([]);
  const [readProgress, setReadProgress] = useState(0);
  const [readingTime, setReadingTime] = useState(0);
  const [showToc, setShowToc] = useState(false);
  const [activeHeadingId, setActiveHeadingId] = useState<string>('');

  const enhancedContent = useMemo(() => enhanceContentForCards(content), [content]);

  useEffect(() => {
    setHeadings(extractHeadings(content));
    setReadingTime(estimateReadingTime(content));
  }, [content]);

  useEffect(() => {
    const loadResume = async () => {
      if (!userId || !courseId || !moduleId || !lessonId || isCompleted) return;
      const data = await getResumeData(userId, courseId, moduleId, lessonId);
      if (data?.readingScrollPercent !== undefined && !isCompleted) {
        setTimeout(() => {
          const element = contentRef.current;
          if (element) {
            const totalScroll = element.clientHeight + element.offsetTop - window.innerHeight;
            if (totalScroll > 0) {
              window.scrollTo({ top: totalScroll * (data.readingScrollPercent! / 100), behavior: "auto" });
            }
          }
        }, 100);
      }
    };
    loadResume();
  }, [userId, courseId, moduleId, lessonId, isCompleted]);

  const saveScrollPercent = useCallback(async () => {
    if (!userId || !courseId || !moduleId || !lessonId || isCompleted) return;
    await saveResumeData(userId, courseId, moduleId, lessonId, {
      readingScrollPercent: readProgress,
    });
  }, [userId, courseId, moduleId, lessonId, isCompleted, readProgress]);

  useEffect(() => {
    const debounce = setTimeout(() => {
      saveScrollPercent();
    }, 2000);
    return () => clearTimeout(debounce);
  }, [readProgress, saveScrollPercent]);

  useEffect(() => {
    const handleScroll = () => {
      if (!contentRef.current || isCompleted) return;
      const element = contentRef.current;
      const scrollTop = window.scrollY;
      const offsetTop = element.offsetTop;
      const height = element.clientHeight;
      const viewportHeight = window.innerHeight;
      const totalScrollable = height + offsetTop - viewportHeight;
      const scrolled = scrollTop - offsetTop;
      const percent = totalScrollable > 0 ? Math.min(100, Math.max(0, (scrolled / totalScrollable) * 100)) : 0;
      setReadProgress(percent);
    };
    window.addEventListener('scroll', handleScroll);
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, [isCompleted]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setActiveHeadingId(entry.target.id);
        });
      },
      { rootMargin: '-80px 0px -70% 0px', threshold: 0 }
    );
    headings.forEach((heading) => {
      const el = document.getElementById(heading.id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [headings]);

  const canComplete = readProgress >= 80 && !isCompleted;

  const markdownComponents = {
    h1: ({ children }: any) => {
      const text = children?.toString() || '';
      const id = slugify(text);
      return <h1 id={id} style={{ fontSize: '2.5rem', fontWeight: 800, marginTop: '2rem', marginBottom: '1rem', color: '#E4E1EE' }}>{children}</h1>;
    },
    h2: ({ children }: any) => {
      const text = children?.toString() || '';
      const id = slugify(text);
      return <h2 id={id} style={{ fontSize: '1.8rem', fontWeight: 700, marginTop: '2rem', marginBottom: '1rem', color: '#E4E1EE', borderLeft: '4px solid #6C63FF', paddingLeft: '0.75rem' }}>{children}</h2>;
    },
    h3: ({ children }: any) => {
      const text = children?.toString() || '';
      const id = slugify(text);
      return <h3 id={id} style={{ fontSize: '1.4rem', fontWeight: 600, marginTop: '1.5rem', marginBottom: '0.75rem', color: '#c4c0ff' }}>{children}</h3>;
    },
    p: ({ children }: any) => <p style={{ fontSize: '1.1rem', lineHeight: 1.8, marginBottom: '1.5rem', color: '#E4E1EE' }}>{children}</p>,
    ul: ({ children }: any) => <ul style={{ marginLeft: '1.5rem', marginBottom: '1.5rem', listStyleType: 'disc' }}>{children}</ul>,
    ol: ({ children }: any) => <ol style={{ marginLeft: '1.5rem', marginBottom: '1.5rem', listStyleType: 'decimal' }}>{children}</ol>,
    li: ({ children }: any) => <li style={{ marginBottom: '0.5rem', fontSize: '1rem', lineHeight: 1.7 }}>{children}</li>,
    blockquote: ({ children }: any) => {
      const text = children?.toString() || '';
      const matchTip = text.match(/:::tip\s*(.*?)\s*:::/s);
      const matchWarning = text.match(/:::warning\s*(.*?)\s*:::/s);
      const matchInfo = text.match(/:::info\s*(.*?)\s*:::/s);
      const matchDefinition = text.match(/:::definition\s*(.*?)\s*:::/s);
      const matchImportant = text.match(/:::important\s*(.*?)\s*:::/s);
      const matchNote = text.match(/:::note\s*(.*?)\s*:::/s);
      if (matchTip) return <KnowledgeCard icon={<Lightbulb size={20} color="#45f1c5" />} color="#45f1c5" title="💡 Tip">{matchTip[1]}</KnowledgeCard>;
      if (matchWarning) return <KnowledgeCard icon={<AlertTriangle size={20} color="#ff6b6b" />} color="#ff6b6b" title="⚠️ Warning">{matchWarning[1]}</KnowledgeCard>;
      if (matchInfo) return <KnowledgeCard icon={<Info size={20} color="#6C63FF" />} color="#6C63FF" title="ℹ️ Info">{matchInfo[1]}</KnowledgeCard>;
      if (matchDefinition) return <KnowledgeCard icon={<BookOpen size={20} color="#c4c0ff" />} color="#c4c0ff" title="📘 Definition">{matchDefinition[1]}</KnowledgeCard>;
      if (matchImportant) return <KnowledgeCard icon={<Target size={20} color="#FFB785" />} color="#FFB785" title="🎯 Important">{matchImportant[1]}</KnowledgeCard>;
      if (matchNote) return <KnowledgeCard icon={<Bookmark size={20} color="#C7C4D8" />} color="#C7C4D8" title="📝 Note">{matchNote[1]}</KnowledgeCard>;
      return <blockquote style={{ borderLeft: '4px solid #6C63FF', paddingLeft: '1.5rem', fontStyle: 'italic', margin: '1.5rem 0', color: '#C7C4D8' }}>{children}</blockquote>;
    },
    code: ({ inline, children }: any) => {
      if (inline) {
        return <code style={{ background: 'rgba(108,99,255,0.2)', padding: '0.2rem 0.4rem', borderRadius: '6px', fontSize: '0.9rem', color: '#c4c0ff' }}>{children}</code>;
      }
      return (
        <pre style={{ background: '#0d0d18', padding: '1rem', borderRadius: '12px', overflowX: 'auto', margin: '1.5rem 0' }}>
          <code style={{ fontSize: '0.9rem', color: '#E4E1EE' }}>{children}</code>
        </pre>
      );
    },
    table: ({ children }: any) => (
      <div style={{ overflowX: 'auto', margin: '1.5rem 0' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', background: 'rgba(255,255,255,0.02)', borderRadius: '8px' }}>{children}</table>
      </div>
    ),
    th: ({ children }: any) => <th style={{ border: '1px solid rgba(255,255,255,0.1)', padding: '0.75rem', textAlign: 'left', fontWeight: 700 }}>{children}</th>,
    td: ({ children }: any) => <td style={{ border: '1px solid rgba(255,255,255,0.1)', padding: '0.75rem' }}>{children}</td>,
  };

  const renderToc = () => (
    <nav style={{ position: 'sticky', top: '80px', background: 'rgba(15,15,26,0.9)', borderRadius: '16px', padding: '1rem', border: '1px solid rgba(255,255,255,0.08)', maxHeight: '80vh', overflowY: 'auto' }}>
      <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#C7C4D8', marginBottom: '1rem', letterSpacing: '0.05em' }}>CONTENTS</h4>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {headings.map((heading, idx) => (
          <li key={idx} style={{ marginBottom: '0.5rem' }}>
            <a
              href={`#${heading.id}`}
              onClick={(e) => { e.preventDefault(); document.getElementById(heading.id)?.scrollIntoView({ behavior: 'smooth' }); }}
              style={{
                display: 'block',
                fontSize: '0.85rem',
                color: activeHeadingId === heading.id ? '#6C63FF' : '#C7C4D8',
                textDecoration: 'none',
                paddingLeft: (heading.level - 1) * 0.75,
                transition: 'color 0.2s',
                fontWeight: activeHeadingId === heading.id ? 600 : 400,
              }}
            >
              {heading.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );

  return (
    <div style={{ maxWidth: '100%', margin: '0 auto', position: 'relative' }}>
      <div style={{ position: 'sticky', top: 0, zIndex: 10, background: '#0F0F1A', paddingTop: '0.5rem' }}>
        <div style={{ height: 4, background: 'rgba(255,255,255,0.1)', borderRadius: 2, marginBottom: '0.5rem' }}>
          <div style={{ width: `${readProgress}%`, height: '100%', background: readProgress >= 80 ? '#45f1c5' : '#6C63FF', borderRadius: 2, transition: 'width 0.2s' }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', color: '#C7C4D8', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <Clock size={14} /> {readingTime} min read
            <BookOpen size={14} /> {Math.round(readProgress)}% read
          </div>
          <button
            onClick={() => setShowToc(!showToc)}
            style={{ background: 'rgba(108,99,255,0.2)', border: 'none', borderRadius: '20px', padding: '0.25rem 0.75rem', fontSize: '0.75rem', color: '#c4c0ff', display: 'flex', alignItems: 'center', gap: '0.25rem', cursor: 'pointer' }}
          >
            <Menu size={14} /> {showToc ? 'Hide' : 'Show'} TOC
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '2rem', maxWidth: '1200px', margin: '0 auto', padding: '0 1rem' }}>
        <aside style={{ width: '250px', display: showToc ? 'block' : 'none' }} className="toc-desktop">
          {renderToc()}
        </aside>

        <main ref={contentRef} style={{ flex: 1, maxWidth: '780px', margin: '0 auto' }}>
          <h1 style={{ fontSize: '2.8rem', fontWeight: 800, marginBottom: '1rem', color: '#E4E1EE' }}>{title}</h1>
          <div style={{ fontSize: '1.1rem', lineHeight: 1.8, color: '#E4E1EE' }}>
            <ReactMarkdown rehypePlugins={[rehypeRaw]} components={markdownComponents}>
              {enhancedContent}
            </ReactMarkdown>
          </div>

          <div style={{ marginTop: '3rem', textAlign: 'center', paddingBottom: '2rem' }}>
            <LessonCompleteButton
              userId={userId}
              courseId={courseId}
              moduleId={moduleId}
              lessonId={lessonId}
              xpReward={xpReward}
              onComplete={onComplete}
              disabled={!canComplete}
              isCompleted={isCompleted}
              lessonType={lessonType}
            />
            {!isCompleted && readProgress < 80 && (
              <p style={{ fontSize: '0.85rem', color: '#FFB785', marginTop: '0.75rem' }}>
                📖 Read at least 80% of the content to unlock completion.
              </p>
            )}
          </div>
        </main>
      </div>

      <style>{`
        @media (min-width: 768px) {
          .toc-desktop {
            display: block !important;
          }
        }
        @media (max-width: 767px) {
          .toc-desktop {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}
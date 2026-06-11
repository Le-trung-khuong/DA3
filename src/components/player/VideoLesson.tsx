// src/components/player/VideoLesson.tsx
import React, { useState, useRef, useEffect, useCallback } from "react";
import { Play, Pause, Volume2, VolumeX, Maximize, Settings, Bookmark, FileText, X, CheckCircle } from "lucide-react";
import { LessonCompleteButton } from "./LessonCompleteButton";
import { saveResumeData, getResumeData } from "../../services/progressService";
import { useAuth } from "../../contexts/AuthContext";

interface VideoLessonProps {
  userId: string;
  courseId: string;
  moduleId: string;
  lessonId: string;
  title: string;
  videoUrl: string;
  xpReward: number;
  onComplete?: () => void;
  isCompleted?: boolean;
}

function getYouTubeEmbedUrl(url: string): string | null {
  if (!url) return null;
  const patterns = [
    /youtu\.be\/([a-zA-Z0-9_-]+)/,
    /youtube\.com\/watch\?v=([a-zA-Z0-9_-]+)/,
    /youtube\.com\/embed\/([a-zA-Z0-9_-]+)/
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) return `https://www.youtube.com/embed/${match[1]}`;
  }
  return null;
}

export function VideoLesson({
  userId, courseId, moduleId, lessonId, title, videoUrl, xpReward, onComplete, isCompleted = false
}: VideoLessonProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [showNotes, setShowNotes] = useState(false);
  const [notes, setNotes] = useState("");
  const [showTranscript, setShowTranscript] = useState(false);
  const [bookmarks, setBookmarks] = useState<number[]>([]);
  const [watchProgress, setWatchProgress] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const isYouTube = videoUrl?.includes('youtu.be') || videoUrl?.includes('youtube.com');
  const embedUrl = isYouTube ? getYouTubeEmbedUrl(videoUrl) : null;

  // Load saved notes & bookmarks from localStorage
  useEffect(() => {
    const savedNotes = localStorage.getItem(`notes_${lessonId}`);
    if (savedNotes) setNotes(savedNotes);
    const savedBookmarks = localStorage.getItem(`bookmarks_${lessonId}`);
    if (savedBookmarks) setBookmarks(JSON.parse(savedBookmarks));
  }, [lessonId]);

  // Save notes to localStorage
  useEffect(() => {
    localStorage.setItem(`notes_${lessonId}`, notes);
  }, [notes, lessonId]);

  // Save bookmarks
  useEffect(() => {
    localStorage.setItem(`bookmarks_${lessonId}`, JSON.stringify(bookmarks));
  }, [bookmarks, lessonId]);

  // Update watch progress
  useEffect(() => {
    if (duration > 0) {
      const progress = (currentTime / duration) * 100;
      setWatchProgress(progress);
    }
  }, [currentTime, duration]);

  // ✅ Load resume data
  useEffect(() => {
    const loadResume = async () => {
      if (!userId || !courseId || !moduleId || !lessonId || isCompleted) return;
      const data = await getResumeData(userId, courseId, moduleId, lessonId);
      if (data?.videoCurrentTime && videoRef.current) {
        videoRef.current.currentTime = data.videoCurrentTime;
        setCurrentTime(data.videoCurrentTime);
      }
    };
    loadResume();
  }, [userId, courseId, moduleId, lessonId, isCompleted]);

  // ✅ Auto-save resume data (debounced)
  const saveCurrentTime = useCallback(async () => {
    if (!userId || !courseId || !moduleId || !lessonId || isCompleted) return;
    if (videoRef.current && !isNaN(videoRef.current.currentTime)) {
      await saveResumeData(userId, courseId, moduleId, lessonId, {
        videoCurrentTime: videoRef.current.currentTime,
      });
    }
  }, [userId, courseId, moduleId, lessonId, isCompleted]);

  useEffect(() => {
    if (!videoRef.current || isCompleted) return;
    const interval = setInterval(() => {
      saveCurrentTime();
    }, 5000); // lưu mỗi 5 giây
    return () => clearInterval(interval);
  }, [saveCurrentTime, isCompleted]);

  const handlePlayPause = () => {
    if (videoRef.current) {
      if (isPlaying) videoRef.current.pause();
      else videoRef.current.play();
      setIsPlaying(!isPlaying);
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) setCurrentTime(videoRef.current.currentTime);
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) setDuration(videoRef.current.duration);
  };

  const handleVolume = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const handleFullscreen = () => {
    if (videoRef.current) {
      if (document.fullscreenElement) document.exitFullscreen();
      else videoRef.current.requestFullscreen();
    }
  };

  const handleSpeedChange = (rate: number) => {
    if (videoRef.current) videoRef.current.playbackRate = rate;
    setPlaybackRate(rate);
  };

  const addBookmark = () => {
    if (currentTime > 0 && !bookmarks.includes(currentTime)) {
      setBookmarks([...bookmarks, currentTime].sort((a,b) => a-b));
    }
  };

  const jumpToBookmark = (time: number) => {
    if (videoRef.current) videoRef.current.currentTime = time;
  };

  const formatTime = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${mins}:${s < 10 ? "0" : ""}${s}`;
  };

  const canComplete = watchProgress >= 80 && !isCompleted;

  if (isYouTube && embedUrl) {
    return (
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <h2 style={{ fontSize: 24, fontWeight: 700, color: "#E4E1EE", marginBottom: 20 }}>{title}</h2>
        <div style={{ position: "relative", borderRadius: 16, overflow: "hidden", marginBottom: 24 }}>
          <div style={{ position: "relative", paddingBottom: "56.25%", height: 0 }}>
            <iframe src={embedUrl} title={title} frameBorder="0" allowFullScreen
              style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%" }} />
          </div>
        </div>
        <div style={{ textAlign: "center" }}>
          <LessonCompleteButton
            userId={userId} courseId={courseId} moduleId={moduleId} lessonId={lessonId}
            xpReward={xpReward} onComplete={onComplete} disabled={!canComplete}
            isCompleted={isCompleted}
          />
          {!isCompleted && watchProgress < 80 && (
            <p style={{ fontSize: 12, color: "#FFB785", marginTop: 8 }}>
              Watch at least 80% to unlock completion.
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto" }}>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 24, fontWeight: 700, color: "#E4E1EE" }}>{title}</h2>
        <div style={{ display: "flex", gap: 16, fontSize: 13, color: "#C7C4D8", marginTop: 8 }}>
          <span>📹 Video lesson</span>
          <span>⭐ {xpReward} XP</span>
          {duration > 0 && <span>⏱️ {formatTime(duration)}</span>}
        </div>
      </div>

      <div style={{ position: "relative", background: "#000", borderRadius: 16, overflow: "hidden", marginBottom: 16 }}>
        <video
          ref={videoRef}
          src={videoUrl}
          controls={false}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          style={{ width: "100%", display: "block" }}
        />
        <div style={{
          position: "absolute", bottom: 0, left: 0, right: 0,
          background: "linear-gradient(to top, rgba(0,0,0,0.8), transparent)",
          padding: "12px 16px", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap"
        }}>
          <button onClick={handlePlayPause} style={{ background: "none", border: "none", cursor: "pointer", color: "#fff" }}>
            {isPlaying ? <Pause size={20} /> : <Play size={20} />}
          </button>
          <div style={{ flex: 1, height: 4, background: "rgba(255,255,255,0.3)", borderRadius: 4, position: "relative" }}>
            <div style={{ width: `${(currentTime / duration) * 100}%`, height: "100%", background: "#6C63FF", borderRadius: 4 }} />
          </div>
          <span style={{ fontSize: 12, color: "#fff" }}>{formatTime(currentTime)} / {formatTime(duration)}</span>
          <button onClick={handleVolume} style={{ background: "none", border: "none", cursor: "pointer", color: "#fff" }}>
            {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>
          <button onClick={handleFullscreen} style={{ background: "none", border: "none", cursor: "pointer", color: "#fff" }}>
            <Maximize size={18} />
          </button>
          <select value={playbackRate} onChange={(e) => handleSpeedChange(Number(e.target.value))}
            style={{ background: "rgba(0,0,0,0.7)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 8, padding: "4px 8px", color: "#fff", fontSize: 12, cursor: "pointer" }}>
            {[0.5, 1, 1.25, 1.5, 2].map(rate => (
              <option key={rate} value={rate}>{rate}x</option>
            ))}
          </select>
          <button onClick={addBookmark} style={{ background: "none", border: "none", cursor: "pointer", color: "#fff" }}>
            <Bookmark size={16} />
          </button>
          <button onClick={() => setShowNotes(!showNotes)} style={{ background: "none", border: "none", cursor: "pointer", color: showNotes ? "#6C63FF" : "#fff" }}>
            <FileText size={16} />
          </button>
        </div>
      </div>

      {bookmarks.length > 0 && (
        <div style={{ marginBottom: 16, display: "flex", gap: 8, flexWrap: "wrap" }}>
          {bookmarks.map((time, idx) => (
            <button key={idx} onClick={() => jumpToBookmark(time)}
              style={{ background: "rgba(108,99,255,0.2)", border: "none", borderRadius: 20, padding: "4px 12px", fontSize: 12, color: "#c4c0ff", cursor: "pointer" }}>
              📌 {formatTime(time)}
            </button>
          ))}
        </div>
      )}

      {showNotes && (
        <div style={{ background: "rgba(26,26,46,0.8)", borderRadius: 16, padding: 16, marginBottom: 16, border: "1px solid rgba(108,99,255,0.2)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: "#E4E1EE" }}>📝 My Notes</span>
            <button onClick={() => setShowNotes(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "#C7C4D8" }}><X size={14} /></button>
          </div>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
            placeholder="Write your notes here..."
            rows={4} style={{ width: "100%", background: "#0d0d18", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: 12, color: "#E4E1EE", resize: "vertical" }} />
        </div>
      )}

      {showTranscript && (
        <div style={{ background: "rgba(26,26,46,0.8)", borderRadius: 16, padding: 16, marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: "#E4E1EE" }}>Transcript</span>
            <button onClick={() => setShowTranscript(false)}><X size={14} /></button>
          </div>
          <p style={{ fontSize: 13, color: "#C7C4D8", marginTop: 8 }}>Transcript not available yet.</p>
        </div>
      )}

      <div style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#C7C4D8", marginBottom: 6 }}>
          <span>Watch progress</span>
          <span>{Math.round(watchProgress)}%</span>
        </div>
        <div style={{ height: 6, background: "rgba(255,255,255,0.1)", borderRadius: 3, overflow: "hidden" }}>
          <div style={{ width: `${watchProgress}%`, height: "100%", background: watchProgress >= 80 ? "#45f1c5" : "#6C63FF", transition: "width 0.3s" }} />
        </div>
      </div>

      <div style={{ textAlign: "center" }}>
        <LessonCompleteButton
          userId={userId} courseId={courseId} moduleId={moduleId} lessonId={lessonId}
          xpReward={xpReward} onComplete={onComplete} disabled={!canComplete}
          isCompleted={isCompleted}
        />
        {!isCompleted && watchProgress < 80 && (
          <p style={{ fontSize: 12, color: "#FFB785", marginTop: 8 }}>
            🎯 Watch at least 80% to unlock completion.
          </p>
        )}
      </div>
    </div>
  );
}
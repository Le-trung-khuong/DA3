// src/components/player/VideoLesson.tsx
import React, { useState, useRef, useEffect, useCallback } from "react";
import { Play, Pause, Volume2, VolumeX, Maximize, Bookmark, FileText, X } from "lucide-react";
import { saveResumeData, getResumeData, completeLesson } from "../../services/progressService";

// Constants
const WATCH_THRESHOLD = 80;
const MAX_SKIPS = 3;
const AFK_TIMEOUT = 60;
const AFK_COUNTDOWN = 10;
const TRACKING_SAVE_INTERVAL = 10000;
const UI_UPDATE_INTERVAL = 2000;
const SEEK_THRESHOLD = 10;
const SEGMENT_GAP = 2; // giây, nếu gap > 2s thì tạo segment mới

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
  lessonType?: 'lesson' | 'quiz' | 'reading' | 'video' | 'flashcard';
}

// ===== Helper functions =====
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

function extractVideoId(url: string): string {
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/watch\?v=)([^&?#]+)/);
  return match ? match[1] : '';
}

function mergeSegments(segments: Array<{ start: number; end: number }>): Array<{ start: number; end: number }> {
  // Lọc segment hợp lệ (end >= start)
  const validSegments = segments.filter(s => s.end >= s.start);
  if (!validSegments.length) return [];

  const sorted = [...validSegments].sort((a, b) => a.start - b.start);
  const merged: Array<{ start: number; end: number }> = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const s = sorted[i];
    const last = merged[merged.length - 1];
    if (s.start <= last.end + 1) {
      last.end = Math.max(last.end, s.end);
    } else {
      merged.push(s);
    }
  }

  return merged;
}

function calculateWatchedPercent(segments: Array<{ start: number; end: number }>, duration: number): number {
  if (duration <= 0) return 0;

  const merged = mergeSegments(segments);
  const totalWatched = merged.reduce((sum, seg) => {
    const diff = seg.end - seg.start;
    return sum + Math.max(0, diff);
  }, 0);

  const percent = (totalWatched / duration) * 100;
  return Math.max(0, Math.min(100, percent));
}

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

export function VideoLesson({
  userId,
  courseId,
  moduleId,
  lessonId,
  title,
  videoUrl,
  xpReward,
  onComplete,
  isCompleted = false,
  lessonType = 'video',
}: VideoLessonProps) {
  // ===== UI State =====
  const [displayTime, setDisplayTime] = useState(0);
  const [displayProgress, setDisplayProgress] = useState(0);
  const [actualWatchedPercent, setActualWatchedPercent] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [showNotes, setShowNotes] = useState(false);
  const [notes, setNotes] = useState("");
  const [bookmarks, setBookmarks] = useState<number[]>([]);
  const [isCompletedState, setIsCompletedState] = useState(isCompleted);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [youtubeError, setYoutubeError] = useState<string | null>(null);
  const [showAfkWarning, setShowAfkWarning] = useState(false);
  const [afkCountdown, setAfkCountdown] = useState(0);

  // ===== Refs =====
  const videoRef = useRef<HTMLVideoElement>(null);
  const playerRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const afkIntervalRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rafRef = useRef<number | null>(null);

  // Tracking refs
  const currentTimeRef = useRef(0);
  const durationRef = useRef(0);
  const watchedSegmentsRef = useRef<Array<{ start: number; end: number }>>([]);
  const skipCountRef = useRef(0);
  const afkWarningRef = useRef(false);
  const lastUserActivityRef = useRef(Date.now());
  const lastSaveTimeRef = useRef(0);
  const lastDisplayUpdateRef = useRef(0);
  const trackingRef = useRef({
    isPlaying: false,
    isTracking: false,
    lastTime: 0,
    pausedAt: 0,
    skipCount: 0,
  });

  const isYouTube = videoUrl?.includes('youtu.be') || videoUrl?.includes('youtube.com');
  const embedUrl = isYouTube ? getYouTubeEmbedUrl(videoUrl) : null;

  // ===== Load YouTube API =====
  const loadYouTubeAPI = useCallback((): Promise<void> => {
    return new Promise((resolve) => {
      if (window.YT && window.YT.Player) {
        resolve();
        return;
      }
      const existingScript = document.querySelector('script[src="https://www.youtube.com/iframe_api"]');
      if (existingScript) {
        const checkReady = setInterval(() => {
          if (window.YT && window.YT.Player) {
            clearInterval(checkReady);
            resolve();
          }
        }, 100);
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://www.youtube.com/iframe_api';
      script.onload = () => {
        const checkReady = setInterval(() => {
          if (window.YT && window.YT.Player) {
            clearInterval(checkReady);
            resolve();
          }
        }, 100);
      };
      document.body.appendChild(script);
    });
  }, []);

  // ===== Update progress =====
  const updateProgress = useCallback(() => {
    const percent = calculateWatchedPercent(watchedSegmentsRef.current, durationRef.current);
    setActualWatchedPercent(percent);
    setDisplayProgress(percent);
  }, []);

  // ===== Save tracking =====
  const saveTracking = useCallback(async (force = false) => {
    const now = Date.now();
    if (!force && (now - lastSaveTimeRef.current) < TRACKING_SAVE_INTERVAL) return;
    if (isCompletedState || !durationRef.current) return;

    const merged = mergeSegments(watchedSegmentsRef.current);
    const totalWatched = merged.reduce((sum, seg) => sum + (seg.end - seg.start), 0);
    const ct = currentTimeRef.current;

    await saveResumeData(userId, courseId, moduleId, lessonId, {
      videoCurrentTime: ct,
      videoDuration: durationRef.current,
      videoTracking: {
        watchedSegments: merged,
        totalWatchedSeconds: totalWatched,
        skipCount: skipCountRef.current,
        maxSkipCount: MAX_SKIPS,
        afkWarningCount: afkWarningRef.current ? 1 : 0,
        isAfk: false,
        lastActivityAt: Date.now(),
      },
    });
    lastSaveTimeRef.current = now;
  }, [userId, courseId, moduleId, lessonId, isCompletedState]);

  // ===== Load resume =====
  useEffect(() => {
    const loadResume = async () => {
      if (!userId || !courseId || !moduleId || !lessonId || isCompletedState) return;
      const data = await getResumeData(userId, courseId, moduleId, lessonId);
      if (data) {
        if (data.videoCurrentTime !== undefined) {
          currentTimeRef.current = data.videoCurrentTime;
          setDisplayTime(data.videoCurrentTime);
          trackingRef.current.lastTime = data.videoCurrentTime;
        }
        if (data.videoDuration) durationRef.current = data.videoDuration;
        if (data.videoTracking) {
          watchedSegmentsRef.current = data.videoTracking.watchedSegments || [];
          skipCountRef.current = data.videoTracking.skipCount || 0;
        }
        updateProgress();
      }
    };
    loadResume();
  }, [userId, courseId, moduleId, lessonId, isCompletedState, updateProgress]);

  // ===== UI Update (throttled) =====
  const updateUI = useCallback(() => {
    const progress = calculateWatchedPercent(watchedSegmentsRef.current, durationRef.current);
    setActualWatchedPercent(progress);
    setDisplayProgress(progress);
    setDisplayTime(currentTimeRef.current);
  }, []);

  // ===== Periodic save và UI update =====
  useEffect(() => {
    if (isCompletedState) return;
    const saveInterval = setInterval(() => saveTracking(), TRACKING_SAVE_INTERVAL);
    const uiInterval = setInterval(() => updateUI(), UI_UPDATE_INTERVAL);
    return () => {
      clearInterval(saveInterval);
      clearInterval(uiInterval);
    };
  }, [isCompletedState, saveTracking, updateUI]);

  // ===== AFK Detection =====
  useEffect(() => {
    if (isCompletedState) return;

    const activityEvents = ['mousemove', 'click', 'keydown', 'focus', 'touchstart', 'touchmove'];
    const resetActivity = () => {
      lastUserActivityRef.current = Date.now();
      if (afkWarningRef.current) {
        afkWarningRef.current = false;
        setAfkCountdown(0);
        setShowAfkWarning(false);
        if (videoRef.current && videoRef.current.paused) {
          videoRef.current.play();
          setIsPlaying(true);
          trackingRef.current.isPlaying = true;
        }
        if (playerRef.current && playerRef.current.playVideo) {
          playerRef.current.playVideo();
          setIsPlaying(true);
          trackingRef.current.isPlaying = true;
        }
      }
    };

    activityEvents.forEach(event => window.addEventListener(event, resetActivity));

    const afkInterval = setInterval(() => {
      if (isCompletedState) return;
      const isPaused = videoRef.current ? videoRef.current.paused : true;
      if (!isPlaying || isPaused) return;

      const inactiveSeconds = (Date.now() - lastUserActivityRef.current) / 1000;
      if (inactiveSeconds >= AFK_TIMEOUT) {
        if (afkWarningRef.current) {
          setAfkCountdown(prev => {
            const newCount = prev + 1;
            if (newCount >= AFK_COUNTDOWN) {
              if (videoRef.current) videoRef.current.pause();
              if (playerRef.current && playerRef.current.pauseVideo) playerRef.current.pauseVideo();
              setIsPlaying(false);
              trackingRef.current.isPlaying = false;
              afkWarningRef.current = false;
              setShowAfkWarning(false);
              alert('Bạn đã không tương tác trong thời gian dài. Video đã tạm dừng.');
              return 0;
            }
            setShowAfkWarning(true);
            return newCount;
          });
        } else {
          afkWarningRef.current = true;
          setAfkCountdown(1);
          setShowAfkWarning(true);
        }
      }
    }, 1000);

    return () => {
      activityEvents.forEach(event => window.removeEventListener(event, resetActivity));
      clearInterval(afkInterval);
    };
  }, [isPlaying, isCompletedState]);

  // ===== Video controls handlers =====
  const handlePlayPause = useCallback(() => {
    if (isYouTube && playerRef.current) {
      if (isPlaying) {
        playerRef.current.pauseVideo();
        setIsPlaying(false);
        trackingRef.current.isPlaying = false;
        trackingRef.current.pausedAt = currentTimeRef.current;
        saveTracking(true);
      } else {
        playerRef.current.playVideo();
        setIsPlaying(true);
        trackingRef.current.isPlaying = true;
        lastUserActivityRef.current = Date.now();
        // Start tracking if not already
        if (!rafRef.current) {
          startTracking();
        }
      }
    } else if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
        setIsPlaying(false);
        trackingRef.current.isPlaying = false;
        trackingRef.current.pausedAt = currentTimeRef.current;
        saveTracking(true);
      } else {
        videoRef.current.play();
        setIsPlaying(true);
        trackingRef.current.isPlaying = true;
        lastUserActivityRef.current = Date.now();
      }
    }
  }, [isPlaying, isYouTube, saveTracking]);

  const handleVolume = useCallback(() => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  }, [isMuted]);

  const handleFullscreen = useCallback(() => {
    if (videoRef.current) {
      if (document.fullscreenElement) document.exitFullscreen();
      else videoRef.current.requestFullscreen();
    }
  }, []);

  const handleSpeedChange = useCallback((rate: number) => {
    if (videoRef.current) {
      videoRef.current.playbackRate = rate;
      setPlaybackRate(rate);
    }
  }, []);

  const addBookmark = useCallback(() => {
    const ct = currentTimeRef.current;
    if (ct > 0 && !bookmarks.includes(ct)) {
      setBookmarks([...bookmarks, ct].sort((a, b) => a - b));
    }
  }, [bookmarks]);

  const jumpToBookmark = useCallback((time: number) => {
    if (isYouTube && playerRef.current && playerRef.current.seekTo) {
      playerRef.current.seekTo(time);
      currentTimeRef.current = time;
      trackingRef.current.lastTime = time;
      updateUI();
    } else if (videoRef.current) {
      videoRef.current.currentTime = time;
      currentTimeRef.current = time;
      trackingRef.current.lastTime = time;
      updateUI();
    }
  }, [isYouTube, updateUI]);

  // ===== Update segment (safe) =====
  const updateSegment = useCallback((ct: number) => {
    if (!trackingRef.current.isPlaying) return;

    const segments = watchedSegmentsRef.current;
    const last = segments[segments.length - 1];

    if (!last) {
      segments.push({ start: ct, end: ct });
      return;
    }

    // Chỉ xử lý khi currentTime tăng
    if (ct > last.end) {
      if (ct > last.end + SEGMENT_GAP) {
        segments.push({ start: ct, end: ct });
      } else {
        last.end = ct;
      }
    }
    // Nếu ct <= last.end, bỏ qua (không ghi đè)
  }, []);

  // ===== Handle seek (detect skip) =====
  const handleSeek = useCallback((newTime: number) => {
    const segments = watchedSegmentsRef.current;
    const last = segments[segments.length - 1];
    if (!last) return;

    const delta = newTime - last.end;

    // Chỉ xử lý skip tiến
    if (delta > SEEK_THRESHOLD) {
      skipCountRef.current += 1;
      trackingRef.current.skipCount = skipCountRef.current;

      if (skipCountRef.current > MAX_SKIPS) {
        // Rollback về vị trí cũ
        if (isYouTube && playerRef.current) {
          playerRef.current.seekTo(last.end);
          currentTimeRef.current = last.end;
          setDisplayTime(last.end);
          alert(`Bạn chỉ được skip tối đa ${MAX_SKIPS} lần.`);
          return;
        } else if (videoRef.current) {
          videoRef.current.currentTime = last.end;
          currentTimeRef.current = last.end;
          setDisplayTime(last.end);
          alert(`Bạn chỉ được skip tối đa ${MAX_SKIPS} lần.`);
          return;
        }
      }
    }

    // Cập nhật tracking
    trackingRef.current.lastTime = newTime;
  }, [isYouTube]);

  // ===== Start tracking with RAF =====
  const startTracking = useCallback(() => {
    if (rafRef.current) return;

    const track = () => {
      if (!trackingRef.current.isPlaying) {
        rafRef.current = null;
        return;
      }

      if (isYouTube && playerRef.current && playerRef.current.getCurrentTime) {
        const ct = playerRef.current.getCurrentTime();
        currentTimeRef.current = ct;
        updateSegment(ct);
        const percent = calculateWatchedPercent(watchedSegmentsRef.current, durationRef.current);
        setActualWatchedPercent(percent);
        setDisplayProgress(percent);
        setDisplayTime(ct);
      } else if (videoRef.current && !videoRef.current.paused) {
        const ct = videoRef.current.currentTime;
        currentTimeRef.current = ct;
        updateSegment(ct);
        const percent = calculateWatchedPercent(watchedSegmentsRef.current, durationRef.current);
        setActualWatchedPercent(percent);
        setDisplayProgress(percent);
        setDisplayTime(ct);
      }

      rafRef.current = requestAnimationFrame(track);
    };

    rafRef.current = requestAnimationFrame(track);
  }, [isYouTube, updateSegment]);

  // ===== Stop tracking =====
  const stopTracking = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    trackingRef.current.isPlaying = false;
  }, []);

  // ===== LOGIC CHO VIDEO THƯỜNG (non-YouTube) =====
  useEffect(() => {
    if (isYouTube || !videoRef.current || isCompletedState) return;
    const video = videoRef.current;

    const onTimeUpdate = () => {
      if (!trackingRef.current.isPlaying || video.paused) return;
      const ct = video.currentTime;
      currentTimeRef.current = ct;
      updateSegment(ct);
      const percent = calculateWatchedPercent(watchedSegmentsRef.current, durationRef.current);
      setActualWatchedPercent(percent);
      setDisplayProgress(percent);
      setDisplayTime(ct);
    };

    const onSeeked = () => {
      const ct = video.currentTime;
      handleSeek(ct);
      // Cập nhật UI sau seek
      updateUI();
    };

    const onLoadedMetadata = () => {
      durationRef.current = video.duration;
      updateUI();
    };

    video.addEventListener('timeupdate', onTimeUpdate);
    video.addEventListener('seeked', onSeeked);
    video.addEventListener('loadedmetadata', onLoadedMetadata);

    return () => {
      video.removeEventListener('timeupdate', onTimeUpdate);
      video.removeEventListener('seeked', onSeeked);
      video.removeEventListener('loadedmetadata', onLoadedMetadata);
    };
  }, [isYouTube, isCompletedState, updateSegment, handleSeek, updateUI]);

  // ===== LOGIC CHO YOUTUBE =====
  useEffect(() => {
    if (!isYouTube || !embedUrl || isCompletedState) return;

    let playerInstance: any = null;

    const initPlayer = async () => {
      await loadYouTubeAPI();
      if (!containerRef.current) return;

      const containerId = `youtube-player-${lessonId}`;
      let container = document.getElementById(containerId);
      if (!container) {
        container = document.createElement('div');
        container.id = containerId;
        container.style.width = '100%';
        container.style.height = '100%';
        containerRef.current.appendChild(container);
      }

      const origin = window.location.origin;
      playerInstance = new window.YT.Player(containerId, {
        height: '100%',
        width: '100%',
        videoId: extractVideoId(videoUrl),
        playerVars: {
          controls: 1,
          modestbranding: 1,
          rel: 0,
          fs: 1,
          enablejsapi: 1,
          origin: origin,
          playsinline: 1,
        },
        events: {
          onReady: (event: any) => {
            playerRef.current = event.target;
            const tryGetDuration = () => {
              const dur = event.target.getDuration();
              if (dur && dur > 0) {
                durationRef.current = dur;
                getResumeData(userId, courseId, moduleId, lessonId)
                  .then(data => {
                    if (data?.videoCurrentTime !== undefined && data.videoCurrentTime > 0 && data.videoCurrentTime < dur) {
                      event.target.seekTo(data.videoCurrentTime);
                      currentTimeRef.current = data.videoCurrentTime;
                      setDisplayTime(data.videoCurrentTime);
                      trackingRef.current.lastTime = data.videoCurrentTime;
                    }
                    if (data?.videoTracking) {
                      watchedSegmentsRef.current = data.videoTracking.watchedSegments || [];
                      skipCountRef.current = data.videoTracking.skipCount || 0;
                    }
                    updateUI();
                  })
                  .catch(console.error);
              } else {
                setTimeout(tryGetDuration, 200);
              }
            };
            tryGetDuration();
          },
          onStateChange: (event: any) => {
            const player = event.target;
            if (event.data === window.YT.PlayerState.PLAYING) {
              setIsPlaying(true);
              trackingRef.current.isPlaying = true;
              lastUserActivityRef.current = Date.now();
              // Start RAF tracking
              if (!rafRef.current) {
                startTracking();
              }
            } else if (event.data === window.YT.PlayerState.PAUSED || event.data === window.YT.PlayerState.ENDED) {
              setIsPlaying(false);
              trackingRef.current.isPlaying = false;
              stopTracking();
              if (event.data === window.YT.PlayerState.ENDED) {
                const dur = player.getDuration();
                if (dur > 0) {
                  currentTimeRef.current = dur;
                  updateUI();
                  saveTracking(true);
                }
              }
            } else if (event.data === window.YT.PlayerState.BUFFERING) {
              // Khi buffering, tạm dừng tracking để tránh ghi rác
              trackingRef.current.isPlaying = false;
              if (rafRef.current) {
                cancelAnimationFrame(rafRef.current);
                rafRef.current = null;
              }
            }
          },
          onError: (err: any) => {
            console.error('YouTube player error:', err);
            if (err.data === 150) setYoutubeError('Video không cho phép nhúng. Bạn có thể xem trực tiếp trên YouTube.');
            else if (err.data === 2) setYoutubeError('Video ID không hợp lệ hoặc video bị xóa.');
            else if (err.data === 5) setYoutubeError('Người chơi không thể phát video. Vui lòng thử lại sau.');
            else setYoutubeError('Có lỗi khi phát video. Vui lòng thử lại.');
          }
        }
      });
    };

    initPlayer();

    return () => {
      stopTracking();
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      if (afkIntervalRef.current) clearInterval(afkIntervalRef.current);
      if (playerInstance && playerInstance.destroy) playerInstance.destroy();
      const container = document.getElementById(`youtube-player-${lessonId}`);
      if (container) container.remove();
    };
  }, [isYouTube, embedUrl, lessonId, isCompletedState, videoUrl, userId, courseId, moduleId, loadYouTubeAPI, startTracking, stopTracking, updateUI, saveTracking]);

  // ===== Complete Lesson =====
  const canComplete = actualWatchedPercent >= WATCH_THRESHOLD && !isCompletedState && skipCountRef.current <= MAX_SKIPS;

  const handleComplete = useCallback(async () => {
    if (isSubmitting || isCompletedState) return;
    if (!canComplete) {
      if (skipCountRef.current > MAX_SKIPS) {
        alert(`Bạn đã skip video quá ${MAX_SKIPS} lần. Hãy xem toàn bộ nội dung.`);
      } else {
        alert(`Bạn cần xem ít nhất ${WATCH_THRESHOLD}% video. Hiện tại bạn đã xem ${Math.round(actualWatchedPercent)}%.`);
      }
      return;
    }

    setIsSubmitting(true);
    try {
      await saveTracking(true);
      await completeLesson(userId, courseId, moduleId, lessonId, xpReward, lessonType);
      setIsCompletedState(true);
      if (onComplete) onComplete();
    } catch (err) {
      console.error('Failed to complete video lesson:', err);
      alert('Có lỗi xảy ra khi hoàn thành bài học. Vui lòng thử lại.');
    } finally {
      setIsSubmitting(false);
    }
  }, [userId, courseId, moduleId, lessonId, xpReward, lessonType, isCompletedState, isSubmitting, canComplete, actualWatchedPercent, onComplete, saveTracking]);

  // ===== Helper =====
  const formatTime = (sec: number) => {
    if (!sec || sec <= 0) return "0:00";
    const mins = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${mins}:${s < 10 ? "0" : ""}${s}`;
  };

  // ===== Render =====
  if (isYouTube && embedUrl) {
    return (
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <h2 style={{ fontSize: 24, fontWeight: 700, color: "#E4E1EE", marginBottom: 20 }}>{title}</h2>
        {youtubeError && (
          <div style={{ background: 'rgba(255,180,171,0.1)', border: '1px solid rgba(255,180,171,0.2)', borderRadius: 12, padding: 16, marginBottom: 16 }}>
            <p style={{ color: '#ffb4ab' }}>⚠️ {youtubeError}</p>
            <a href={`https://www.youtube.com/watch?v=${extractVideoId(videoUrl)}`} target="_blank" rel="noopener noreferrer" style={{ color: '#6C63FF', textDecoration: 'underline', display: 'inline-block', marginTop: 8 }}>📺 Xem trực tiếp trên YouTube</a>
          </div>
        )}
        {showAfkWarning && (
          <div style={{ background: 'rgba(255,183,133,0.15)', border: '1px solid rgba(255,183,133,0.3)', borderRadius: 12, padding: 12, marginBottom: 12, textAlign: 'center' }}>
            <p style={{ color: '#FFB785' }}>⚠️ Bạn vẫn đang xem bài học? Video sẽ tạm dừng sau {AFK_COUNTDOWN - afkCountdown} giây.</p>
          </div>
        )}
        <div ref={containerRef} style={{ position: "relative", borderRadius: 16, overflow: "hidden", marginBottom: 24, background: '#000', aspectRatio: '16/9' }} />

        <div style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#C7C4D8", marginBottom: 4 }}>
            <span>Watch progress (actual)</span>
            <span>{Math.round(actualWatchedPercent)}%</span>
          </div>
          <div style={{ height: 6, background: "rgba(255,255,255,0.1)", borderRadius: 3, overflow: "hidden" }}>
            <div style={{ width: `${Math.min(100, actualWatchedPercent)}%`, height: "100%", background: actualWatchedPercent >= WATCH_THRESHOLD ? "#45f1c5" : "#6C63FF", transition: "width 0.3s" }} />
          </div>
          {skipCountRef.current > 0 && <div style={{ fontSize: 11, color: '#FFB785', marginTop: 4 }}>⚠️ Skip: {skipCountRef.current}/{MAX_SKIPS}</div>}
        </div>

        <div style={{ textAlign: "center" }}>
          {!isCompletedState ? (
            <>
              <button onClick={handleComplete} disabled={isSubmitting || !canComplete} style={{
                padding: "10px 32px", borderRadius: 12, border: "none",
                background: canComplete && !isSubmitting ? "linear-gradient(135deg,#45f1c5,#00D4AA)" : "rgba(255,255,255,0.1)",
                color: canComplete && !isSubmitting ? "#0F0F1A" : "#47464f",
                fontWeight: 700, cursor: canComplete && !isSubmitting ? "pointer" : "not-allowed", fontSize: 16, transition: "all 0.2s",
              }}>
                {isSubmitting ? "Đang xử lý..." : canComplete ? "✅ Complete Lesson" : `🎯 Watch at least ${WATCH_THRESHOLD}%`}
              </button>
              {!canComplete && <p style={{ fontSize: 12, color: "#FFB785", marginTop: 8 }}>Đã xem thực tế {Math.round(actualWatchedPercent)}% – cần {WATCH_THRESHOLD}% để hoàn thành。 {skipCountRef.current > MAX_SKIPS && ` (Đã skip ${skipCountRef.current}/${MAX_SKIPS} lần)`}</p>}
            </>
          ) : (
            <div style={{ color: "#45f1c5", fontSize: 16, fontWeight: 600 }}>✅ Lesson completed! +{xpReward} XP</div>
          )}
        </div>
      </div>
    );
  }

  // ===== Render video thường =====
  return (
    <div style={{ maxWidth: 1000, margin: "0 auto" }}>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 24, fontWeight: 700, color: "#E4E1EE" }}>{title}</h2>
        <div style={{ display: "flex", gap: 16, fontSize: 13, color: "#C7C4D8", marginTop: 8 }}>
          <span>📹 Video lesson</span>
          <span>⭐ {xpReward} XP</span>
          {durationRef.current > 0 && <span>⏱️ {formatTime(durationRef.current)}</span>}
        </div>
      </div>

      {showAfkWarning && (
        <div style={{ background: 'rgba(255,183,133,0.15)', border: '1px solid rgba(255,183,133,0.3)', borderRadius: 12, padding: 12, marginBottom: 12, textAlign: 'center' }}>
          <p style={{ color: '#FFB785' }}>⚠️ Bạn vẫn đang xem bài học? Video sẽ tạm dừng sau {AFK_COUNTDOWN - afkCountdown} giây.</p>
        </div>
      )}

      <div style={{ position: "relative", background: "#000", borderRadius: 16, overflow: "hidden", marginBottom: 16 }}>
        <video ref={videoRef} src={videoUrl} controls={false} style={{ width: "100%", display: "block" }} />
        <div style={{
          position: "absolute", bottom: 0, left: 0, right: 0,
          background: "linear-gradient(to top, rgba(0,0,0,0.8), transparent)",
          padding: "12px 16px", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap"
        }}>
          <button onClick={handlePlayPause} style={{ background: "none", border: "none", cursor: "pointer", color: "#fff" }}>
            {isPlaying ? <Pause size={20} /> : <Play size={20} />}
          </button>
          <div style={{ flex: 1, height: 4, background: "rgba(255,255,255,0.3)", borderRadius: 4, position: "relative" }}>
            <div style={{ width: `${(displayTime / durationRef.current) * 100}%`, height: "100%", background: "#6C63FF", borderRadius: 4 }} />
          </div>
          <span style={{ fontSize: 12, color: "#fff" }}>{formatTime(displayTime)} / {formatTime(durationRef.current)}</span>
          <button onClick={handleVolume} style={{ background: "none", border: "none", cursor: "pointer", color: "#fff" }}>
            {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>
          <button onClick={handleFullscreen} style={{ background: "none", border: "none", cursor: "pointer", color: "#fff" }}>
            <Maximize size={18} />
          </button>
          <select value={playbackRate} onChange={(e) => handleSpeedChange(Number(e.target.value))}
            style={{ background: "rgba(0,0,0,0.7)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 8, padding: "4px 8px", color: "#fff", fontSize: 12, cursor: "pointer" }}>
            {[0.5, 1, 1.25, 1.5, 2].map(rate => <option key={rate} value={rate}>{rate}x</option>)}
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

      <div style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#C7C4D8", marginBottom: 6 }}>
          <span>Watch progress (actual)</span>
          <span>{Math.round(actualWatchedPercent)}%</span>
        </div>
        <div style={{ height: 6, background: "rgba(255,255,255,0.1)", borderRadius: 3, overflow: "hidden" }}>
          <div style={{ width: `${Math.min(100, actualWatchedPercent)}%`, height: "100%", background: actualWatchedPercent >= WATCH_THRESHOLD ? "#45f1c5" : "#6C63FF", transition: "width 0.3s" }} />
        </div>
        {skipCountRef.current > 0 && <div style={{ fontSize: 11, color: '#FFB785', marginTop: 4 }}>⚠️ Skip: {skipCountRef.current}/{MAX_SKIPS}</div>}
      </div>

      <div style={{ textAlign: "center" }}>
        {!isCompletedState ? (
          <>
            <button onClick={handleComplete} disabled={isSubmitting || !canComplete} style={{
              padding: "10px 32px", borderRadius: 12, border: "none",
              background: canComplete && !isSubmitting ? "linear-gradient(135deg,#45f1c5,#00D4AA)" : "rgba(255,255,255,0.1)",
              color: canComplete && !isSubmitting ? "#0F0F1A" : "#47464f",
              fontWeight: 700, cursor: canComplete && !isSubmitting ? "pointer" : "not-allowed", fontSize: 16, transition: "all 0.2s",
            }}>
              {isSubmitting ? "Đang xử lý..." : canComplete ? "✅ Complete Lesson" : `🎯 Watch at least ${WATCH_THRESHOLD}%`}
            </button>
            {!canComplete && <p style={{ fontSize: 12, color: "#FFB785", marginTop: 8 }}>Đã xem thực tế {Math.round(actualWatchedPercent)}% – cần {WATCH_THRESHOLD}% để hoàn thành。 {skipCountRef.current > MAX_SKIPS && ` (Đã skip ${skipCountRef.current}/${MAX_SKIPS} lần)`}</p>}
          </>
        ) : (
          <div style={{ color: "#45f1c5", fontSize: 16, fontWeight: 600 }}>✅ Lesson completed! +{xpReward} XP</div>
        )}
      </div>
    </div>
  );
}
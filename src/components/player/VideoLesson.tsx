// src/components/player/VideoLesson.tsx
import React, { useState, useRef, useEffect, useCallback } from "react";
import { Play, Pause, Volume2, VolumeX, Maximize, Bookmark, FileText, X } from "lucide-react";
import { saveResumeData, getResumeData, completeLesson } from "../../services/progressService";

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
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [watchProgress, setWatchProgress] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [showNotes, setShowNotes] = useState(false);
  const [notes, setNotes] = useState("");
  const [bookmarks, setBookmarks] = useState<number[]>([]);
  const [isCompletedState, setIsCompletedState] = useState(isCompleted);
  const [playerReady, setPlayerReady] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [youtubeError, setYoutubeError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const playerRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const intervalRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isYouTube = videoUrl?.includes('youtu.be') || videoUrl?.includes('youtube.com');
  const embedUrl = isYouTube ? getYouTubeEmbedUrl(videoUrl) : null;

  // ============ YouTube API ============
  const loadYouTubeAPI = useCallback((): Promise<void> => {
    return new Promise((resolve) => {
      if (window.YT && window.YT.Player) {
        resolve();
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

  // Khởi tạo YouTube Player
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
        },
        events: {
          onReady: (event: any) => {
            playerRef.current = event.target;
            const tryGetDuration = () => {
              const dur = event.target.getDuration();
              if (dur && dur > 0) {
                setDuration(dur);
                setPlayerReady(true);
                getResumeData(userId, courseId, moduleId, lessonId)
                  .then(data => {
                    if (data?.videoCurrentTime !== undefined && data.videoCurrentTime > 0 && data.videoCurrentTime < dur) {
                      event.target.seekTo(data.videoCurrentTime);
                      setCurrentTime(data.videoCurrentTime);
                    }
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
              if (intervalRef.current) clearInterval(intervalRef.current);
              intervalRef.current = setInterval(() => {
                if (player && player.getCurrentTime) {
                  const ct = player.getCurrentTime();
                  setCurrentTime(ct);
                  if (ct > 0 && !isCompletedState) {
                    saveResumeData(userId, courseId, moduleId, lessonId, { videoCurrentTime: ct })
                      .catch(console.error);
                  }
                }
              }, 1000);
            } else if (
              event.data === window.YT.PlayerState.PAUSED ||
              event.data === window.YT.PlayerState.ENDED
            ) {
              setIsPlaying(false);
              if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
              }
              if (event.data === window.YT.PlayerState.ENDED) {
                const dur = player.getDuration();
                if (dur > 0) {
                  setCurrentTime(dur);
                  setWatchProgress(100);
                }
              }
            }
          },
          // ✅ Xử lý lỗi YouTube, đặc biệt error 150
          onError: (err: any) => {
            console.error('YouTube player error:', err);
            if (err.data === 150) {
              setYoutubeError('Video không cho phép nhúng. Bạn có thể xem trực tiếp trên YouTube.');
            } else if (err.data === 2) {
              setYoutubeError('Video ID không hợp lệ hoặc video bị xóa.');
            } else if (err.data === 5) {
              setYoutubeError('Người chơi không thể phát video. Vui lòng thử lại sau.');
            } else {
              setYoutubeError('Có lỗi khi phát video. Vui lòng thử lại.');
            }
          }
        }
      });
    };

    initPlayer();

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (playerInstance && playerInstance.destroy) {
        playerInstance.destroy();
      }
      const container = document.getElementById(`youtube-player-${lessonId}`);
      if (container) container.remove();
    };
  }, [isYouTube, embedUrl, lessonId, isCompletedState, videoUrl, userId, courseId, moduleId, loadYouTubeAPI]);

  // ============ Tính watchProgress (chỉ để hiển thị) ============
  useEffect(() => {
    if (duration > 0) {
      const progress = Math.min((currentTime / duration) * 100, 100);
      setWatchProgress(progress);
    }
  }, [currentTime, duration]);

  // ============ Complete Lesson (không cần điều kiện 80%) ============
  const handleComplete = useCallback(async () => {
    if (isSubmitting || isCompletedState) return;

    setIsSubmitting(true);
    try {
      await completeLesson(userId, courseId, moduleId, lessonId, xpReward, lessonType);
      setIsCompletedState(true);
      if (onComplete) onComplete();
    } catch (err) {
      console.error('Failed to complete video lesson:', err);
      alert('Có lỗi xảy ra khi hoàn thành bài học. Vui lòng thử lại.');
    } finally {
      setIsSubmitting(false);
    }
  }, [userId, courseId, moduleId, lessonId, xpReward, lessonType, isCompletedState, isSubmitting, onComplete]);

  // ============ Render YouTube ============
  if (isYouTube && embedUrl) {
    return (
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <h2 style={{ fontSize: 24, fontWeight: 700, color: "#E4E1EE", marginBottom: 20 }}>{title}</h2>

        {/* ✅ Hiển thị lỗi YouTube nếu có */}
        {youtubeError && (
          <div style={{
            background: 'rgba(255,180,171,0.1)',
            border: '1px solid rgba(255,180,171,0.2)',
            borderRadius: 12,
            padding: 16,
            marginBottom: 16
          }}>
            <p style={{ color: '#ffb4ab' }}>⚠️ {youtubeError}</p>
            <a
              href={`https://www.youtube.com/watch?v=${extractVideoId(videoUrl)}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: '#6C63FF', textDecoration: 'underline', display: 'inline-block', marginTop: 8 }}
            >
              📺 Xem trực tiếp trên YouTube
            </a>
          </div>
        )}

        <div
          ref={containerRef}
          style={{
            position: "relative",
            borderRadius: 16,
            overflow: "hidden",
            marginBottom: 24,
            background: '#000',
            aspectRatio: '16/9'
          }}
        />

        {/* Progress bar (chỉ hiển thị, không ràng buộc) */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#C7C4D8", marginBottom: 4 }}>
            <span>Watch progress</span>
            <span>{Math.round(watchProgress)}%</span>
          </div>
          <div style={{ height: 6, background: "rgba(255,255,255,0.1)", borderRadius: 3, overflow: "hidden" }}>
            <div
              style={{
                width: `${watchProgress}%`,
                height: "100%",
                background: "#6C63FF",
                transition: "width 0.3s"
              }}
            />
          </div>
        </div>

        <div style={{ textAlign: "center" }}>
          {!isCompletedState ? (
            <button
              onClick={handleComplete}
              disabled={isSubmitting}
              style={{
                padding: "10px 32px",
                borderRadius: 12,
                border: "none",
                background: isSubmitting ? "rgba(255,255,255,0.1)" : "linear-gradient(135deg,#45f1c5,#00D4AA)",
                color: isSubmitting ? "#47464f" : "#0F0F1A",
                fontWeight: 700,
                cursor: isSubmitting ? "not-allowed" : "pointer",
                fontSize: 16,
                transition: "all 0.2s",
              }}
            >
              {isSubmitting ? "Đang xử lý..." : "✅ Complete Lesson"}
            </button>
          ) : (
            <div style={{ color: "#45f1c5", fontSize: 16, fontWeight: 600 }}>
              ✅ Lesson completed! +{xpReward} XP
            </div>
          )}
        </div>
      </div>
    );
  }

  // ============ Render Video thường (non-YouTube) ============
  // Load resume cho video thường
  useEffect(() => {
    const loadResume = async () => {
      if (!userId || !courseId || !moduleId || !lessonId || isCompletedState) return;
      const data = await getResumeData(userId, courseId, moduleId, lessonId);
      if (data?.videoCurrentTime && videoRef.current) {
        videoRef.current.currentTime = data.videoCurrentTime;
        setCurrentTime(data.videoCurrentTime);
      }
    };
    loadResume();
  }, [userId, courseId, moduleId, lessonId, isCompletedState]);

  // Lưu resume cho video thường
  useEffect(() => {
    if (!videoRef.current || isCompletedState) return;
    const interval = setInterval(() => {
      if (videoRef.current && !isNaN(videoRef.current.currentTime)) {
        saveResumeData(userId, courseId, moduleId, lessonId, {
          videoCurrentTime: videoRef.current.currentTime,
        });
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [userId, courseId, moduleId, lessonId, isCompletedState]);

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
      setBookmarks([...bookmarks, currentTime].sort((a, b) => a - b));
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

      <div style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#C7C4D8", marginBottom: 6 }}>
          <span>Watch progress</span>
          <span>{Math.round(watchProgress)}%</span>
        </div>
        <div style={{ height: 6, background: "rgba(255,255,255,0.1)", borderRadius: 3, overflow: "hidden" }}>
          <div style={{ width: `${watchProgress}%`, height: "100%", background: "#6C63FF", transition: "width 0.3s" }} />
        </div>
      </div>

      <div style={{ textAlign: "center" }}>
        {!isCompletedState ? (
          <button
            onClick={handleComplete}
            disabled={isSubmitting}
            style={{
              padding: "10px 32px",
              borderRadius: 12,
              border: "none",
              background: isSubmitting ? "rgba(255,255,255,0.1)" : "linear-gradient(135deg,#45f1c5,#00D4AA)",
              color: isSubmitting ? "#47464f" : "#0F0F1A",
              fontWeight: 700,
              cursor: isSubmitting ? "not-allowed" : "pointer",
              fontSize: 16,
              transition: "all 0.2s",
            }}
          >
            {isSubmitting ? "Đang xử lý..." : "✅ Complete Lesson"}
          </button>
        ) : (
          <div style={{ color: "#45f1c5", fontSize: 16, fontWeight: 600 }}>
            ✅ Lesson completed! +{xpReward} XP
          </div>
        )}
      </div>
    </div>
  );
}
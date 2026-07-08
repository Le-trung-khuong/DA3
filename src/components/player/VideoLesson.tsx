// src/components/player/VideoLesson.tsx
import React, { useState, useRef, useEffect, useCallback } from "react";
import { Play, Pause, Volume2, VolumeX, Maximize, Bookmark, FileText, X } from "lucide-react";
import { saveResumeData, getResumeData, completeLessonClient } from "../../services/progressService";
import {
  useVideoTracking,
  WATCH_THRESHOLD,
  MAX_SKIPS,
  MAX_AFK_WARNINGS,
  SEEK_FORWARD_THRESHOLD,
  AFK_COUNTDOWN_SECONDS,
} from "../../hooks/useVideoTracking";
import { mergeSegments } from "../../utils/videoTracking";
import { loadYouTubeAPI } from "../../utils/youtubeLoader";
import { VideoChapter, TranscriptLine } from "../../types/lesson";

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

function getYouTubeEmbedUrl(url: string): string | null {
  if (!url) return null;
  const patterns = [
    /youtu\.be\/([a-zA-Z0-9_-]+)/,
    /youtube\.com\/watch\?v=([a-zA-Z0-9_-]+)/,
    /youtube\.com\/embed\/([a-zA-Z0-9_-]+)/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) return `https://www.youtube.com/embed/${match[1]}`;
  }
  return null;
}

function extractVideoId(url: string): string {
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/watch\?v=)([^&?#]+)/);
  return match ? match[1] : "";
}

function formatTime(sec: number) {
  if (!sec || sec <= 0) return "0:00";
  const mins = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${mins}:${s < 10 ? "0" : ""}${s}`;
}

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
  lessonType?: "lesson" | "quiz" | "reading" | "video" | "flashcard";
  chapters?: VideoChapter[];
  transcript?: TranscriptLine[];
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
  lessonType = "video",
  chapters = [],
  transcript = [],
}: VideoLessonProps) {
  const [displayTime, setDisplayTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [showNotes, setShowNotes] = useState(false);
  const [notes, setNotes] = useState("");
  const [bookmarks, setBookmarks] = useState<number[]>([]);
  const [isCompletedState, setIsCompletedState] = useState(isCompleted);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [youtubeError, setYoutubeError] = useState<string | null>(null);
  const [youtubeLoading, setYoutubeLoading] = useState(true);
  const [html5Error, setHtml5Error] = useState<string | null>(null);
  const [showTranscript, setShowTranscript] = useState(false);

  const [trackingState, trackingActions] = useVideoTracking(
    userId,
    courseId,
    moduleId,
    lessonId,
    isCompletedState,
    () => {
      if (playerRef.current?.pauseVideo) {
        playerRef.current.pauseVideo();
        setIsPlaying(false);
      }
      if (videoRef.current) {
        videoRef.current.pause();
        setIsPlaying(false);
      }
    }
  );

  const {
    actualWatchedPercent,
    skipCount,
    afkWarningCount,
    progressLocked,
    showAfkWarning,
    afkSecondsLeft,
  } = trackingState;

  const videoRef = useRef<HTMLVideoElement>(null);
  const playerRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  const isYouTube = videoUrl?.includes("youtu.be") || videoUrl?.includes("youtube.com");
  const embedUrl = isYouTube ? getYouTubeEmbedUrl(videoUrl) : null;

  // ===== Load Resume (mở rộng) =====
  useEffect(() => {
    const loadResume = async () => {
      if (!userId || !courseId || !moduleId || !lessonId || isCompletedState) return;
      const data = await getResumeData(userId, courseId, moduleId, lessonId);
      if (data) {
        trackingActions.loadResumeData({
          videoCurrentTime: data.videoCurrentTime,
          videoDuration: data.videoDuration,
          watchedSegments: data.videoTracking?.watchedSegments,
          skipCount: data.videoTracking?.skipCount,
          afkWarningCount: data.videoTracking?.afkWarningCount,
        });
        if (data.videoTracking?.progressLocked) {
          alert(`Bạn đã skip quá ${MAX_SKIPS} lần. Hãy xem lại toàn bộ video.`);
        }
        // new fields
        if (data.videoBookmarks) setBookmarks(data.videoBookmarks);
        if (data.videoNotes) setNotes(data.videoNotes);
      }
    };
    loadResume();
  }, [userId, courseId, moduleId, lessonId, isCompletedState, trackingActions]);

  // ===== Save tracking (mở rộng) =====
  const saveTracking = useCallback(async () => {
    await trackingActions.forceSave();
    // Also save bookmarks & notes
    if (userId && courseId && moduleId && lessonId && !isCompletedState) {
      await saveResumeData(userId, courseId, moduleId, lessonId, {
        videoBookmarks: bookmarks,
        videoNotes: notes,
      });
    }
  }, [trackingActions, userId, courseId, moduleId, lessonId, isCompletedState, bookmarks, notes]);

  // ===== Auto-save bookmarks & notes (debounced) =====
  useEffect(() => {
    if (!userId || !courseId || !moduleId || !lessonId || isCompletedState) return;
    const timeout = setTimeout(() => {
      saveResumeData(userId, courseId, moduleId, lessonId, {
        videoBookmarks: bookmarks,
        videoNotes: notes,
      });
    }, 1000);
    return () => clearTimeout(timeout);
  }, [bookmarks, notes, userId, courseId, moduleId, lessonId, isCompletedState]);

  // ===== Auto-save on unload =====
  useEffect(() => {
    const handleBeforeUnload = () => {
      try {
        const snapshot = trackingActions.getTrackingSnapshot();
        localStorage.setItem(`video_tracking_${lessonId}`, JSON.stringify({
          ...snapshot,
          timestamp: Date.now(),
        }));
      } catch (_) { /* ignore */ }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [trackingActions, lessonId]);

  // ===== Recovery from localStorage =====
  useEffect(() => {
    const recoverFromBackup = async () => {
      try {
        const backup = localStorage.getItem(`video_tracking_${lessonId}`);
        if (backup) {
          const data = JSON.parse(backup);
          if (data.timestamp && Date.now() - data.timestamp < 60000) {
            trackingActions.loadResumeData({
              videoCurrentTime: data.currentTime,
              videoDuration: data.duration,
              watchedSegments: data.segments,
              skipCount: data.skipCount,
              afkWarningCount: data.afkWarningCount,
            });
          }
          localStorage.removeItem(`video_tracking_${lessonId}`);
        }
      } catch (_) { /* ignore */ }
    };
    recoverFromBackup();
  }, [lessonId, trackingActions]);

  // ===== RAF Tracking (YouTube) =====
  useEffect(() => {
    if (!isYouTube || isCompletedState) return;

    let frameId: number | null = null;
    let isActive = true;

    const track = () => {
      if (!isActive || isCompletedState) {
        frameId = requestAnimationFrame(track);
        return;
      }

      if (!playerRef.current) {
        frameId = requestAnimationFrame(track);
        return;
      }

      const player = playerRef.current;
      let isActuallyPlaying = isPlaying;

      try {
        if (player.getPlayerState) {
          const state = player.getPlayerState();
          isActuallyPlaying = state === window.YT?.PlayerState?.PLAYING;
        }
      } catch (_) { /* fallback */ }

      if (isActuallyPlaying && player.getCurrentTime && player.getDuration) {
        const ct = player.getCurrentTime();
        const dur = player.getDuration();
        const prevCt = trackingActions.getTrackingSnapshot().currentTime;
        const delta = ct - prevCt;

        if (delta > SEEK_FORWARD_THRESHOLD) {
          const blocked = trackingActions.onSeek(ct);
          if (blocked) {
            player.seekTo(prevCt);
            frameId = requestAnimationFrame(track);
            return;
          }
        }
        trackingActions.onTick(ct, dur);
        setDisplayTime(ct);
      }

      frameId = requestAnimationFrame(track);
    };

    if (isPlaying) {
      frameId = requestAnimationFrame(track);
    } else {
      if (frameId) {
        cancelAnimationFrame(frameId);
        frameId = null;
      }
    }

    return () => {
      isActive = false;
      if (frameId) {
        cancelAnimationFrame(frameId);
        frameId = null;
      }
    };
  }, [isYouTube, isCompletedState, trackingActions, isPlaying]);

  // ===== Video Element Events (non-YouTube) with error handling =====
  useEffect(() => {
    if (isYouTube || !videoRef.current || isCompletedState) return;
    const video = videoRef.current;

    const onTimeUpdate = () => {
      if (video.paused) return;
      const ct = video.currentTime;
      const dur = video.duration;
      trackingActions.onTick(ct, dur);
      setDisplayTime(ct);
    };

    const onSeeked = () => {
      const ct = video.currentTime;
      const blocked = trackingActions.onSeek(ct);
      if (blocked) {
        const snap = trackingActions.getTrackingSnapshot();
        video.currentTime = snap.currentTime;
        alert(`Bạn chỉ được skip tối đa ${MAX_SKIPS} lần.`);
      }
    };

    const onPlay = () => {
      setIsPlaying(true);
      trackingActions.onPlay();
    };

    const onPause = () => {
      setIsPlaying(false);
      trackingActions.onPause(video.currentTime);
    };

    const onLoadedMetadata = () => {};

    const onError = () => {
      const err = video.error;
      let msg = "Có lỗi khi phát video. Vui lòng thử lại.";
      if (err) {
        if (err.code === err.MEDIA_ERR_NETWORK) msg = "Lỗi mạng khi tải video.";
        else if (err.code === err.MEDIA_ERR_DECODE) msg = "Không thể giải mã video này.";
        else if (err.code === err.MEDIA_ERR_SRC_NOT_SUPPORTED) msg = "Định dạng video không được hỗ trợ.";
      }
      setHtml5Error(msg);
    };

    video.addEventListener("timeupdate", onTimeUpdate);
    video.addEventListener("seeked", onSeeked);
    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    video.addEventListener("loadedmetadata", onLoadedMetadata);
    video.addEventListener("error", onError);

    return () => {
      video.removeEventListener("timeupdate", onTimeUpdate);
      video.removeEventListener("seeked", onSeeked);
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("loadedmetadata", onLoadedMetadata);
      video.removeEventListener("error", onError);
    };
  }, [isYouTube, isCompletedState, trackingActions]);

  // ===== YouTube Player init =====
  useEffect(() => {
    if (!isYouTube || !embedUrl || isCompletedState) return;

    let playerInstance: any = null;
    let mounted = true;

    const initPlayer = async () => {
      setYoutubeLoading(true);
      setYoutubeError(null);

      try {
        await loadYouTubeAPI();
      } catch (err: any) {
        console.error("YouTube API load failed:", err);
        setYoutubeLoading(false);
        setYoutubeError(
          "Không thể tải YouTube Player. Trình duyệt của bạn có thể đang chặn nội dung từ YouTube. " +
          "Thử tắt Tracking Prevention hoặc dùng Chrome/Edge."
        );
        return;
      }

      if (!mounted || !containerRef.current) return;

      const containerId = `youtube-player-${lessonId}`;
      let container = document.getElementById(containerId);
      if (!container) {
        container = document.createElement("div");
        container.id = containerId;
        container.style.width = "100%";
        container.style.height = "100%";
        containerRef.current.appendChild(container);
      }

      const isLocalhost =
        window.location.hostname === "localhost" ||
        window.location.hostname === "127.0.0.1";
      const playerVars: any = {
        controls: 1,
        modestbranding: 1,
        rel: 0,
        fs: 1,
        enablejsapi: 1,
        playsinline: 1,
      };
      if (!isLocalhost) {
        playerVars.origin = window.location.origin;
      }

      try {
        playerInstance = new window.YT.Player(containerId, {
          height: "100%",
          width: "100%",
          videoId: extractVideoId(videoUrl),
          playerVars,
          events: {
            onReady: (event: any) => {
              playerRef.current = event.target;
              const dur = event.target.getDuration();
              if (dur && dur > 0) {
                const snap = trackingActions.getTrackingSnapshot();
                if (snap.currentTime > 0 && snap.currentTime < dur) {
                  event.target.seekTo(snap.currentTime);
                }
              }
              setYoutubeLoading(false);
            },
            onStateChange: (event: any) => {
              const player = event.target;
              if (event.data === window.YT.PlayerState.PLAYING) {
                setIsPlaying(true);
                trackingActions.onPlay();
              } else if (
                event.data === window.YT.PlayerState.PAUSED ||
                event.data === window.YT.PlayerState.ENDED
              ) {
                setIsPlaying(false);
                trackingActions.onPause(player.getCurrentTime());
                if (event.data === window.YT.PlayerState.ENDED) {
                  const dur = player.getDuration();
                  if (dur > 0) {
                    trackingActions.onTick(dur, dur);
                    setDisplayTime(dur);
                    saveTracking();
                  }
                }
              }
            },
            onError: (err: any) => {
              console.error("YouTube player error:", err);
              setYoutubeLoading(false);
              if (err.data === 150 || err.data === 101) {
                setYoutubeError("Video không cho phép nhúng. Bạn có thể xem trực tiếp trên YouTube.");
              } else if (err.data === 2) {
                setYoutubeError("Video ID không hợp lệ hoặc video bị xóa.");
              } else if (err.data === 5) {
                setYoutubeError("Người chơi không thể phát video. Vui lòng thử lại sau.");
              } else {
                setYoutubeError("Có lỗi khi phát video. Vui lòng thử lại.");
              }
            },
          },
        });
      } catch (err) {
        console.error("Failed to create YT.Player:", err);
        setYoutubeLoading(false);
        setYoutubeError("Không thể khởi tạo video player. Vui lòng thử lại.");
      }
    };

    initPlayer();

    return () => {
      mounted = false;
      if (playerInstance && playerInstance.destroy) {
        try {
          playerInstance.destroy();
        } catch (_) {}
      }
      const container = document.getElementById(`youtube-player-${lessonId}`);
      if (container) container.remove();
      playerRef.current = null;
    };
  }, [isYouTube, embedUrl, lessonId, isCompletedState, videoUrl, trackingActions, saveTracking]);

  // ===== UI Controls =====
  const handlePlayPause = useCallback(() => {
    if (isYouTube && playerRef.current) {
      if (isPlaying) {
        playerRef.current.pauseVideo();
        setIsPlaying(false);
        trackingActions.onPause(playerRef.current.getCurrentTime());
        saveTracking();
      } else {
        playerRef.current.playVideo();
        setIsPlaying(true);
        trackingActions.onPlay();
      }
    } else if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
    }
  }, [isPlaying, isYouTube, trackingActions, saveTracking]);

  const handleVolume = useCallback(() => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  }, [isMuted]);

  const handleFullscreen = useCallback(() => {
    if (videoRef.current) {
      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else {
        videoRef.current.requestFullscreen();
      }
    }
  }, []);

  const handleSpeedChange = useCallback((rate: number) => {
    if (videoRef.current) {
      videoRef.current.playbackRate = rate;
      setPlaybackRate(rate);
    }
  }, []);

  const handleSpeedChangeYT = useCallback((rate: number) => {
    if (playerRef.current?.setPlaybackRate) {
      playerRef.current.setPlaybackRate(rate);
      setPlaybackRate(rate);
    }
  }, []);

  const addBookmark = useCallback(() => {
    const ct = trackingActions.getTrackingSnapshot().currentTime;
    if (ct > 0 && !bookmarks.includes(ct)) {
      const updated = [...bookmarks, ct].sort((a, b) => a - b);
      setBookmarks(updated);
      saveResumeData(userId, courseId, moduleId, lessonId, { videoBookmarks: updated });
    }
  }, [bookmarks, trackingActions, userId, courseId, moduleId, lessonId]);

  const jumpToBookmark = useCallback(
    (time: number) => {
      if (isYouTube && playerRef.current?.seekTo) {
        const prevTime = playerRef.current.getCurrentTime();
        playerRef.current.seekTo(time);
        const blocked = trackingActions.onSeek(time);
        if (blocked) playerRef.current.seekTo(prevTime);
      } else if (videoRef.current) {
        const prevTime = videoRef.current.currentTime;
        videoRef.current.currentTime = time;
        const blocked = trackingActions.onSeek(time);
        if (blocked) videoRef.current.currentTime = prevTime;
      }
    },
    [isYouTube, trackingActions]
  );

  const handleProgressBarClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const percent = Math.max(0, Math.min(1, x / rect.width));
      const duration = trackingActions.getTrackingSnapshot().duration;
      if (duration <= 0) return;

      const targetTime = percent * duration;

      if (isYouTube && playerRef.current?.seekTo) {
        const prevTime = playerRef.current.getCurrentTime();
        const blocked = trackingActions.onSeek(targetTime);
        if (blocked) {
          playerRef.current.seekTo(prevTime);
          alert(`Bạn chỉ được skip tối đa ${MAX_SKIPS} lần.`);
        } else {
          playerRef.current.seekTo(targetTime);
        }
      } else if (videoRef.current) {
        const prevTime = videoRef.current.currentTime;
        const blocked = trackingActions.onSeek(targetTime);
        if (blocked) {
          videoRef.current.currentTime = prevTime;
          alert(`Bạn chỉ được skip tối đa ${MAX_SKIPS} lần.`);
        } else {
          videoRef.current.currentTime = targetTime;
        }
      }
    },
    [isYouTube, trackingActions]
  );

  const canComplete =
    actualWatchedPercent >= WATCH_THRESHOLD &&
    !isCompletedState &&
    skipCount <= MAX_SKIPS &&
    afkWarningCount <= MAX_AFK_WARNINGS &&
    !progressLocked;

  const handleComplete = useCallback(async () => {
    if (isSubmitting || isCompletedState || !canComplete) return;
    setIsSubmitting(true);
    try {
      await saveTracking();
      await completeLessonClient(userId, courseId, moduleId, lessonId, xpReward, lessonType);
      setIsCompletedState(true);
      if (onComplete) onComplete();
    } catch (err) {
      console.error("Failed to complete video lesson:", err);
      alert("Có lỗi xảy ra khi hoàn thành bài học. Vui lòng thử lại.");
    } finally {
      setIsSubmitting(false);
    }
  }, [
    userId,
    courseId,
    moduleId,
    lessonId,
    xpReward,
    lessonType,
    isCompletedState,
    isSubmitting,
    canComplete,
    onComplete,
    saveTracking,
  ]);

  const handleAfkResponse = useCallback(() => {
    trackingActions.onUserRespondedToAfk();
    if (videoRef.current?.paused) videoRef.current.play();
    if (playerRef.current?.playVideo) playerRef.current.playVideo();
  }, [trackingActions]);

  // ===== Render Chapters =====
  const renderChapters = () => {
    if (!chapters || chapters.length === 0) return null;
    return (
      <div style={{ marginBottom: 16 }}>
        <h4 style={{ fontSize: 13, color: "#C7C4D8", marginBottom: 8 }}>📑 Chapters</h4>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {chapters.map((c, idx) => (
            <button
              key={idx}
              onClick={() => jumpToBookmark(c.time)}
              style={{
                textAlign: "left",
                background: "none",
                border: "none",
                color: "#C7C4D8",
                cursor: "pointer",
                fontSize: 13,
                padding: "4px 0",
                transition: "color .15s",
              }}
              onMouseOver={(e) => (e.currentTarget.style.color = "#E4E1EE")}
              onMouseOut={(e) => (e.currentTarget.style.color = "#C7C4D8")}
            >
              {formatTime(c.time)} — {c.title}
            </button>
          ))}
        </div>
      </div>
    );
  };

  // ===== Render Transcript =====
  const renderTranscript = () => {
    if (!transcript || transcript.length === 0) return null;
    const activeIndex = transcript.findIndex(line => line.time <= displayTime);
    const activeLineRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
      if (activeLineRef.current) {
        activeLineRef.current.scrollIntoView({ block: "nearest", behavior: "smooth" });
      }
    }, [activeIndex]);
    return (
      <div style={{ marginBottom: 16 }}>
        <button
          onClick={() => setShowTranscript(!showTranscript)}
          style={{
            background: "none",
            border: "none",
            color: "#c4c0ff",
            cursor: "pointer",
            fontSize: 13,
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <FileText size={14} /> {showTranscript ? "Hide" : "Show"} Transcript
        </button>
        {showTranscript && (
          <div
            style={{
              maxHeight: 300,
              overflowY: "auto",
              background: "rgba(0,0,0,0.3)",
              borderRadius: 12,
              padding: 12,
              marginTop: 8,
            }}
          >
            {transcript.map((line, idx) => {
              const isActive = idx === activeIndex;
              return (
                <div
                  key={idx}
                  ref={isActive ? activeLineRef : undefined}
                  onClick={() => jumpToBookmark(line.time)}
                  style={{
                    padding: "6px 8px",
                    cursor: "pointer",
                    borderRadius: 6,
                    background: isActive ? "rgba(108,99,255,0.2)" : "transparent",
                    color: isActive ? "#E4E1EE" : "#C7C4D8",
                    transition: "all .15s",
                  }}
                  onMouseOver={(e) => {
                    if (!isActive) e.currentTarget.style.background = "rgba(255,255,255,0.05)";
                  }}
                  onMouseOut={(e) => {
                    if (!isActive) e.currentTarget.style.background = "transparent";
                  }}
                >
                  <span style={{ fontSize: 11, opacity: 0.6, marginRight: 8 }}>{formatTime(line.time)}</span>
                  {line.text}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  // ===== RENDER =====
  if (isYouTube && embedUrl) {
    return (
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <h2 style={{ fontSize: 24, fontWeight: 700, color: "#E4E1EE", marginBottom: 20 }}>{title}</h2>
        {youtubeError && (
          <div
            style={{
              background: "rgba(255,180,171,0.1)",
              border: "1px solid rgba(255,180,171,0.2)",
              borderRadius: 12,
              padding: 16,
              marginBottom: 16,
            }}
          >
            <p style={{ color: "#ffb4ab" }}>⚠️ {youtubeError}</p>
            <a
              href={`https://www.youtube.com/watch?v=${extractVideoId(videoUrl)}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: "#6C63FF", textDecoration: "underline", display: "inline-block", marginTop: 8 }}
            >
              📺 Xem trực tiếp trên YouTube
            </a>
          </div>
        )}
        {showAfkWarning && (
          <div
            style={{
              background: "rgba(255,183,133,0.15)",
              border: "1px solid rgba(255,183,133,0.3)",
              borderRadius: 12,
              padding: 12,
              marginBottom: 12,
              textAlign: "center",
            }}
          >
            <p style={{ color: "#FFB785" }}>⚠️ Bạn vẫn đang xem bài học? Video sẽ tạm dừng sau {afkSecondsLeft} giây.</p>
            <button
              onClick={handleAfkResponse}
              style={{
                marginTop: 8,
                background: "rgba(108,99,255,0.3)",
                border: "none",
                borderRadius: 8,
                padding: "4px 16px",
                color: "#fff",
                cursor: "pointer",
              }}
            >
              Tôi vẫn đang xem
            </button>
            <p style={{ fontSize: 11, color: "#888", marginTop: 4 }}>Lần cảnh báo: {afkWarningCount}/{MAX_AFK_WARNINGS}</p>
          </div>
        )}
        <div
          style={{
            position: "relative",
            borderRadius: 16,
            overflow: "hidden",
            marginBottom: 24,
            background: "#000",
            aspectRatio: "16/9",
          }}
        >
          {youtubeLoading && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                background: "rgba(15,15,26,0.8)",
                zIndex: 5,
                borderRadius: 16,
              }}
            >
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: "50%",
                  border: "2px solid rgba(108,99,255,0.2)",
                  borderTopColor: "#6C63FF",
                  animation: "spin 0.8s linear infinite",
                }}
              />
              <span style={{ color: "#C7C4D8", fontSize: 13, marginTop: 12 }}>Đang tải video...</span>
            </div>
          )}
          <div ref={containerRef} style={{ width: "100%", height: "100%" }} />
          {/* YouTube controls overlay - speed */}
          <div
            style={{
              position: "absolute",
              bottom: 10,
              right: 10,
              zIndex: 10,
              display: "flex",
              gap: 6,
              background: "rgba(0,0,0,0.6)",
              padding: "4px 8px",
              borderRadius: 8,
              backdropFilter: "blur(4px)",
            }}
          >
            <select
              value={playbackRate}
              onChange={(e) => handleSpeedChangeYT(Number(e.target.value))}
              style={{
                background: "transparent",
                border: "none",
                color: "#fff",
                fontSize: 12,
                cursor: "pointer",
                outline: "none",
              }}
            >
              {[0.5, 1, 1.25, 1.5, 2].map((rate) => (
                <option key={rate} value={rate}>
                  {rate}x
                </option>
              ))}
            </select>
            <button
              onClick={addBookmark}
              style={{
                background: "none",
                border: "none",
                color: "#fff",
                cursor: "pointer",
                padding: "0 4px",
              }}
            >
              <Bookmark size={14} />
            </button>
            <button
              onClick={() => setShowNotes(!showNotes)}
              style={{
                background: "none",
                border: "none",
                color: showNotes ? "#6C63FF" : "#fff",
                cursor: "pointer",
                padding: "0 4px",
              }}
            >
              <FileText size={14} />
            </button>
          </div>
        </div>

        {renderChapters()}
        {renderTranscript()}

        {bookmarks.length > 0 && (
          <div style={{ marginBottom: 16, display: "flex", gap: 8, flexWrap: "wrap" }}>
            {bookmarks.map((time, idx) => (
              <button
                key={idx}
                onClick={() => jumpToBookmark(time)}
                style={{
                  background: "rgba(108,99,255,0.2)",
                  border: "none",
                  borderRadius: 20,
                  padding: "4px 12px",
                  fontSize: 12,
                  color: "#c4c0ff",
                  cursor: "pointer",
                }}
              >
                📌 {formatTime(time)}
              </button>
            ))}
          </div>
        )}

        {showNotes && (
          <div
            style={{
              background: "rgba(26,26,46,0.8)",
              borderRadius: 16,
              padding: 16,
              marginBottom: 16,
              border: "1px solid rgba(108,99,255,0.2)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: "#E4E1EE" }}>📝 My Notes</span>
              <button
                onClick={() => setShowNotes(false)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "#C7C4D8" }}
              >
                <X size={14} />
              </button>
            </div>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Write your notes here..."
              rows={4}
              style={{
                width: "100%",
                background: "#0d0d18",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 12,
                padding: 12,
                color: "#E4E1EE",
                resize: "vertical",
              }}
            />
          </div>
        )}

        <div style={{ marginBottom: 16 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: 12,
              color: "#C7C4D8",
              marginBottom: 4,
            }}
          >
            <span>Watch progress (actual)</span>
            <span>{Math.round(actualWatchedPercent)}%</span>
          </div>
          <div
            style={{
              height: 6,
              background: "rgba(255,255,255,0.1)",
              borderRadius: 3,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${Math.min(100, actualWatchedPercent)}%`,
                height: "100%",
                background: actualWatchedPercent >= WATCH_THRESHOLD ? "#45f1c5" : "#6C63FF",
                transition: "width 0.3s",
              }}
            />
          </div>
          {skipCount > 0 && (
            <div style={{ fontSize: 11, color: "#FFB785", marginTop: 4 }}>
              ⚠️ Skip: {skipCount}/{MAX_SKIPS}
            </div>
          )}
          {afkWarningCount > 0 && (
            <div style={{ fontSize: 11, color: "#FFB785", marginTop: 2 }}>
              ⏸️ AFK warnings: {afkWarningCount}/{MAX_AFK_WARNINGS}
            </div>
          )}
          {progressLocked && (
            <div style={{ fontSize: 11, color: "#ff6b6b", marginTop: 2 }}>
              🔒 Progress locked due to excessive skips.
            </div>
          )}
        </div>

        <div style={{ textAlign: "center" }}>
          {!isCompletedState ? (
            <>
              <button
                onClick={handleComplete}
                disabled={isSubmitting || !canComplete}
                style={{
                  padding: "10px 32px",
                  borderRadius: 12,
                  border: "none",
                  background:
                    canComplete && !isSubmitting
                      ? "linear-gradient(135deg,#45f1c5,#00D4AA)"
                      : "rgba(255,255,255,0.1)",
                  color: canComplete && !isSubmitting ? "#0F0F1A" : "#47464f",
                  fontWeight: 700,
                  cursor: canComplete && !isSubmitting ? "pointer" : "not-allowed",
                  fontSize: 16,
                  transition: "all 0.2s",
                }}
              >
                {isSubmitting
                  ? "Đang xử lý..."
                  : canComplete
                  ? "✅ Complete Lesson"
                  : `🎯 Watch at least ${WATCH_THRESHOLD}%`}
              </button>
              {!canComplete && (
                <p style={{ fontSize: 12, color: "#FFB785", marginTop: 8 }}>
                  {actualWatchedPercent < WATCH_THRESHOLD &&
                    `Đã xem ${Math.round(actualWatchedPercent)}% – cần ${WATCH_THRESHOLD}%`}
                  {skipCount > MAX_SKIPS && ` (Đã skip ${skipCount}/${MAX_SKIPS} lần)`}
                  {afkWarningCount > MAX_AFK_WARNINGS &&
                    ` (AFK warnings ${afkWarningCount}/${MAX_AFK_WARNINGS})`}
                  {progressLocked && " (Progress locked)"}
                </p>
              )}
            </>
          ) : (
            <div style={{ color: "#45f1c5", fontSize: 16, fontWeight: 600 }}>
              ✅ Lesson completed! +{xpReward} XP
            </div>
          )}
        </div>
      </div>
    );
  }

  // ===== HTML5 Video Render =====
  return (
    <div style={{ maxWidth: 1000, margin: "0 auto" }}>
      <style>{`
        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 24, fontWeight: 700, color: "#E4E1EE" }}>{title}</h2>
        <div style={{ display: "flex", gap: 16, fontSize: 13, color: "#C7C4D8", marginTop: 8 }}>
          <span>📹 Video lesson</span>
          <span>⭐ {xpReward} XP</span>
          {trackingActions.getTrackingSnapshot().duration > 0 && (
            <span>⏱️ {formatTime(trackingActions.getTrackingSnapshot().duration)}</span>
          )}
        </div>
      </div>

      {html5Error && (
        <div
          style={{
            background: "rgba(255,180,171,0.1)",
            border: "1px solid rgba(255,180,171,0.2)",
            borderRadius: 12,
            padding: 16,
            marginBottom: 16,
          }}
        >
          <p style={{ color: "#ffb4ab" }}>⚠️ {html5Error}</p>
        </div>
      )}

      {showAfkWarning && (
        <div
          style={{
            background: "rgba(255,183,133,0.15)",
            border: "1px solid rgba(255,183,133,0.3)",
            borderRadius: 12,
            padding: 12,
            marginBottom: 12,
            textAlign: "center",
          }}
        >
          <p style={{ color: "#FFB785" }}>⚠️ Bạn vẫn đang xem bài học? Video sẽ tạm dừng sau {afkSecondsLeft} giây.</p>
          <button
            onClick={handleAfkResponse}
            style={{
              marginTop: 8,
              background: "rgba(108,99,255,0.3)",
              border: "none",
              borderRadius: 8,
              padding: "4px 16px",
              color: "#fff",
              cursor: "pointer",
            }}
          >
            Tôi vẫn đang xem
          </button>
          <p style={{ fontSize: 11, color: "#888", marginTop: 4 }}>Lần cảnh báo: {afkWarningCount}/{MAX_AFK_WARNINGS}</p>
        </div>
      )}

      <div style={{ position: "relative", background: "#000", borderRadius: 16, overflow: "hidden", marginBottom: 16 }}>
        <video ref={videoRef} src={videoUrl} controls={false} style={{ width: "100%", display: "block" }} />
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            background: "linear-gradient(to top, rgba(0,0,0,0.8), transparent)",
            padding: "12px 16px",
            display: "flex",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <button onClick={handlePlayPause} style={{ background: "none", border: "none", cursor: "pointer", color: "#fff" }}>
            {isPlaying ? <Pause size={20} /> : <Play size={20} />}
          </button>
          <div
            style={{
              flex: 1,
              height: 4,
              background: "rgba(255,255,255,0.3)",
              borderRadius: 4,
              position: "relative",
              cursor: "pointer",
            }}
            onClick={handleProgressBarClick}
          >
            <div
              style={{
                width: `${(displayTime / (trackingActions.getTrackingSnapshot().duration || 1)) * 100}%`,
                height: "100%",
                background: "#6C63FF",
                borderRadius: 4,
              }}
            />
            {/* Chapter ticks */}
            {chapters.map((c, idx) => {
              const dur = trackingActions.getTrackingSnapshot().duration || 1;
              const left = (c.time / dur) * 100;
              if (left > 100 || left < 0) return null;
              return (
                <div
                  key={idx}
                  style={{
                    position: "absolute",
                    left: `${left}%`,
                    top: 0,
                    width: 2,
                    height: "100%",
                    background: "rgba(255,255,255,0.5)",
                  }}
                />
              );
            })}
          </div>
          <span style={{ fontSize: 12, color: "#fff" }}>
            {formatTime(displayTime)} / {formatTime(trackingActions.getTrackingSnapshot().duration)}
          </span>
          <button onClick={handleVolume} style={{ background: "none", border: "none", cursor: "pointer", color: "#fff" }}>
            {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>
          <button onClick={handleFullscreen} style={{ background: "none", border: "none", cursor: "pointer", color: "#fff" }}>
            <Maximize size={18} />
          </button>
          <select
            value={playbackRate}
            onChange={(e) => handleSpeedChange(Number(e.target.value))}
            style={{
              background: "rgba(0,0,0,0.7)",
              border: "1px solid rgba(255,255,255,0.2)",
              borderRadius: 8,
              padding: "4px 8px",
              color: "#fff",
              fontSize: 12,
              cursor: "pointer",
            }}
          >
            {[0.5, 1, 1.25, 1.5, 2].map((rate) => (
              <option key={rate} value={rate}>
                {rate}x
              </option>
            ))}
          </select>
          <button onClick={addBookmark} style={{ background: "none", border: "none", cursor: "pointer", color: "#fff" }}>
            <Bookmark size={16} />
          </button>
          <button
            onClick={() => setShowNotes(!showNotes)}
            style={{ background: "none", border: "none", cursor: "pointer", color: showNotes ? "#6C63FF" : "#fff" }}
          >
            <FileText size={16} />
          </button>
        </div>
      </div>

      {renderChapters()}
      {renderTranscript()}

      {bookmarks.length > 0 && (
        <div style={{ marginBottom: 16, display: "flex", gap: 8, flexWrap: "wrap" }}>
          {bookmarks.map((time, idx) => (
            <button
              key={idx}
              onClick={() => jumpToBookmark(time)}
              style={{
                background: "rgba(108,99,255,0.2)",
                border: "none",
                borderRadius: 20,
                padding: "4px 12px",
                fontSize: 12,
                color: "#c4c0ff",
                cursor: "pointer",
              }}
            >
              📌 {formatTime(time)}
            </button>
          ))}
        </div>
      )}

      {showNotes && (
        <div
          style={{
            background: "rgba(26,26,46,0.8)",
            borderRadius: 16,
            padding: 16,
            marginBottom: 16,
            border: "1px solid rgba(108,99,255,0.2)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: "#E4E1EE" }}>📝 My Notes</span>
            <button
              onClick={() => setShowNotes(false)}
              style={{ background: "none", border: "none", cursor: "pointer", color: "#C7C4D8" }}
            >
              <X size={14} />
            </button>
          </div>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Write your notes here..."
            rows={4}
            style={{
              width: "100%",
              background: "#0d0d18",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 12,
              padding: 12,
              color: "#E4E1EE",
              resize: "vertical",
            }}
          />
        </div>
      )}

      <div style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#C7C4D8", marginBottom: 6 }}>
          <span>Watch progress (actual)</span>
          <span>{Math.round(actualWatchedPercent)}%</span>
        </div>
        <div
          style={{
            height: 6,
            background: "rgba(255,255,255,0.1)",
            borderRadius: 3,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${Math.min(100, actualWatchedPercent)}%`,
              height: "100%",
              background: actualWatchedPercent >= WATCH_THRESHOLD ? "#45f1c5" : "#6C63FF",
              transition: "width 0.3s",
            }}
          />
        </div>
        {skipCount > 0 && (
          <div style={{ fontSize: 11, color: "#FFB785", marginTop: 4 }}>⚠️ Skip: {skipCount}/{MAX_SKIPS}</div>
        )}
        {afkWarningCount > 0 && (
          <div style={{ fontSize: 11, color: "#FFB785", marginTop: 2 }}>
            ⏸️ AFK warnings: {afkWarningCount}/{MAX_AFK_WARNINGS}
          </div>
        )}
        {progressLocked && (
          <div style={{ fontSize: 11, color: "#ff6b6b", marginTop: 2 }}>🔒 Progress locked due to excessive skips.</div>
        )}
      </div>

      <div style={{ textAlign: "center" }}>
        {!isCompletedState ? (
          <>
            <button
              onClick={handleComplete}
              disabled={isSubmitting || !canComplete}
              style={{
                padding: "10px 32px",
                borderRadius: 12,
                border: "none",
                background:
                  canComplete && !isSubmitting
                    ? "linear-gradient(135deg,#45f1c5,#00D4AA)"
                    : "rgba(255,255,255,0.1)",
                color: canComplete && !isSubmitting ? "#0F0F1A" : "#47464f",
                fontWeight: 700,
                cursor: canComplete && !isSubmitting ? "pointer" : "not-allowed",
                fontSize: 16,
                transition: "all 0.2s",
              }}
            >
              {isSubmitting
                ? "Đang xử lý..."
                : canComplete
                ? "✅ Complete Lesson"
                : `🎯 Watch at least ${WATCH_THRESHOLD}%`}
            </button>
            {!canComplete && (
              <p style={{ fontSize: 12, color: "#FFB785", marginTop: 8 }}>
                {actualWatchedPercent < WATCH_THRESHOLD &&
                  `Đã xem ${Math.round(actualWatchedPercent)}% – cần ${WATCH_THRESHOLD}%`}
                {skipCount > MAX_SKIPS && ` (Đã skip ${skipCount}/${MAX_SKIPS} lần)`}
                {afkWarningCount > MAX_AFK_WARNINGS &&
                  ` (AFK warnings ${afkWarningCount}/${MAX_AFK_WARNINGS})`}
                {progressLocked && " (Progress locked)"}
              </p>
            )}
          </>
        ) : (
          <div style={{ color: "#45f1c5", fontSize: 16, fontWeight: 600 }}>
            ✅ Lesson completed! +{xpReward} XP
          </div>
        )}
      </div>
    </div>
  );
}
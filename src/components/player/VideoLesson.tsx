/**
 * src/components/player/VideoLesson.tsx
 * Video lesson player
 */

import React, { useState, useRef } from "react";
import { Play, Pause, Volume2, VolumeX, Maximize } from "lucide-react";
import { LessonCompleteButton } from "./LessonCompleteButton";

interface VideoLessonProps {
  userId: string;
  courseId: string;
  moduleId: string;
  lessonId: string;
  title: string;
  videoUrl: string;
  xpReward: number;
  onComplete?: () => void;
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
}: VideoLessonProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const handlePlayPause = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
    }
  };

  const handleVolume = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const handleFullscreen = () => {
    if (videoRef.current) {
      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else {
        videoRef.current.requestFullscreen();
      }
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  const progress = duration ? (currentTime / duration) * 100 : 0;

  return (
    <div style={{ maxWidth: 900, margin: "0 auto" }}>
      <h2 style={{ fontSize: 24, fontWeight: 700, color: "#E4E1EE", marginBottom: 20 }}>{title}</h2>

      {/* Video Player */}
      <div style={{ position: "relative", background: "#000", borderRadius: 16, overflow: "hidden", marginBottom: 24 }}>
        <video
          ref={videoRef}
          src={videoUrl}
          controls={false}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          style={{ width: "100%", display: "block" }}
        />
        {/* Custom Controls (optional) */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            background: "linear-gradient(to top, rgba(0,0,0,0.7), transparent)",
            padding: "12px 16px",
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <button onClick={handlePlayPause} style={{ background: "none", border: "none", cursor: "pointer", color: "#fff" }}>
            {isPlaying ? <Pause size={20} /> : <Play size={20} />}
          </button>
          <div style={{ flex: 1, height: 4, background: "rgba(255,255,255,0.3)", borderRadius: 4, position: "relative" }}>
            <div style={{ width: `${progress}%`, height: "100%", background: "#6C63FF", borderRadius: 4 }} />
          </div>
          <span style={{ fontSize: 12, color: "#fff" }}>{formatTime(currentTime)} / {formatTime(duration)}</span>
          <button onClick={handleVolume} style={{ background: "none", border: "none", cursor: "pointer", color: "#fff" }}>
            {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>
          <button onClick={handleFullscreen} style={{ background: "none", border: "none", cursor: "pointer", color: "#fff" }}>
            <Maximize size={18} />
          </button>
        </div>
      </div>

      {/* Complete Button */}
      <div style={{ marginTop: 24, textAlign: "center" }}>
        <LessonCompleteButton
          userId={userId}
          courseId={courseId}
          moduleId={moduleId}
          lessonId={lessonId}
          xpReward={xpReward}
          onComplete={onComplete}
          disabled={!videoUrl}
        />
      </div>
    </div>
  );
}
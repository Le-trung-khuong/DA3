// src/hooks/useVideoTracking.ts
import { useRef, useCallback, useEffect, useState } from 'react';
import { WatchedSegment, mergeSegments, calculateWatchedPercent } from '../utils/videoTracking';
import { saveResumeData } from '../services/progressService';

export const WATCH_THRESHOLD = 80;
export const MAX_SKIPS = 3;
export const MAX_AFK_WARNINGS = 3;
export const AFK_IDLE_SECONDS = 60;
export const AFK_COUNTDOWN_SECONDS = 10;
export const SEEK_FORWARD_THRESHOLD = 10;
export const SEGMENT_GAP = 2;
export const SAVE_INTERVAL_MS = 10_000;

export interface VideoTrackingState {
  actualWatchedPercent: number;
  skipCount: number;
  afkWarningCount: number;
  progressLocked: boolean;
  showAfkWarning: boolean;
  afkSecondsLeft: number;
}

export interface VideoTrackingActions {
  onTick: (currentTime: number, duration: number) => void;
  onSeek: (newTime: number) => boolean;
  onPlay: () => void;
  onPause: (currentTime: number) => void;
  onUserRespondedToAfk: () => void;
  forceSave: () => Promise<void>;
  loadResumeData: (data: {
    videoCurrentTime?: number;
    videoDuration?: number;
    watchedSegments?: WatchedSegment[];
    skipCount?: number;
    afkWarningCount?: number;
  }) => void;
  getTrackingSnapshot: () => {
    segments: WatchedSegment[];
    skipCount: number;
    afkWarningCount: number;
    currentTime: number;
    duration: number;
  };
  resetTracking: () => void;
}

export function useVideoTracking(
  userId: string,
  courseId: string,
  moduleId: string,
  lessonId: string,
  isCompleted: boolean,
  onAfkTimeout?: () => void // ✅ Thêm callback
): [VideoTrackingState, VideoTrackingActions] {
  const segmentsRef = useRef<WatchedSegment[]>([]);
  const skipCountRef = useRef(0);
  const afkWarningCountRef = useRef(0);
  const durationRef = useRef(0);
  const currentTimeRef = useRef(0);
  const isPlayingRef = useRef(false);
  const progressLockedRef = useRef(false);
  const lastActivityRef = useRef(Date.now());
  const lastSaveRef = useRef(0);
  const afkActiveRef = useRef(false);

  const [state, setState] = useState<VideoTrackingState>({
    actualWatchedPercent: 0,
    skipCount: 0,
    afkWarningCount: 0,
    progressLocked: false,
    showAfkWarning: false,
    afkSecondsLeft: AFK_COUNTDOWN_SECONDS,
  });

  const syncState = useCallback(() => {
    const percent = calculateWatchedPercent(segmentsRef.current, durationRef.current);
    setState(prev => ({
      ...prev,
      actualWatchedPercent: percent,
      skipCount: skipCountRef.current,
      afkWarningCount: afkWarningCountRef.current,
      progressLocked: progressLockedRef.current,
    }));
  }, []);

  const onTick = useCallback((ct: number, dur: number) => {
    if (!isPlayingRef.current || progressLockedRef.current || isCompleted) return;
    if (dur > 0) durationRef.current = dur;
    currentTimeRef.current = ct;

    const segs = segmentsRef.current;
    const last = segs[segs.length - 1];

    if (!last) {
      segs.push({ start: ct, end: ct });
      return;
    }
    if (ct > last.end) {
      if (ct > last.end + SEGMENT_GAP) {
        segs.push({ start: ct, end: ct });
      } else {
        last.end = ct;
      }
    }
  }, [isCompleted]);

  const onSeek = useCallback((newTime: number): boolean => {
    const segs = segmentsRef.current;
    const last = segs[segs.length - 1];
    const prevTime = last ? last.end : currentTimeRef.current;
    const delta = newTime - prevTime;

    if (delta > SEEK_FORWARD_THRESHOLD) {
      skipCountRef.current += 1;
      if (skipCountRef.current > MAX_SKIPS) {
        progressLockedRef.current = true;
        syncState();
        return true;
      }
    }
    currentTimeRef.current = newTime;
    syncState();
    return false;
  }, [syncState]);

  const onPlay = useCallback(() => {
    isPlayingRef.current = true;
    lastActivityRef.current = Date.now();
  }, []);

  const onPause = useCallback((ct: number) => {
    isPlayingRef.current = false;
    currentTimeRef.current = ct;
    syncState();
  }, [syncState]);

  const forceSave = useCallback(async () => {
    if (isCompleted || !durationRef.current) return;
    const merged = mergeSegments(segmentsRef.current);
    const totalWatched = merged.reduce((s, seg) => s + seg.end - seg.start, 0);
    await saveResumeData(userId, courseId, moduleId, lessonId, {
      videoCurrentTime: currentTimeRef.current,
      videoDuration: durationRef.current,
      videoTracking: {
        watchedSegments: merged,
        totalWatchedSeconds: totalWatched,
        skipCount: skipCountRef.current,
        maxSkipCount: MAX_SKIPS,
        afkWarningCount: afkWarningCountRef.current,
        isAfk: false,
        lastActivityAt: Date.now(),
        progressLocked: progressLockedRef.current,
      },
    });
    lastSaveRef.current = Date.now();
  }, [userId, courseId, moduleId, lessonId, isCompleted]);

  useEffect(() => {
    if (isCompleted) return;
    const id = setInterval(() => {
      if (Date.now() - lastSaveRef.current >= SAVE_INTERVAL_MS) {
        forceSave();
      }
    }, SAVE_INTERVAL_MS);
    return () => clearInterval(id);
  }, [isCompleted, forceSave]);

  // AFK Detection
  useEffect(() => {
    if (isCompleted) return;

    const activityEvents = ['mousemove', 'click', 'keydown', 'focus', 'touchstart'];
    const resetActivity = () => { lastActivityRef.current = Date.now(); };
    activityEvents.forEach(e => window.addEventListener(e, resetActivity, { passive: true }));

    let countdownTimer: ReturnType<typeof setInterval> | null = null;

    const afkChecker = setInterval(() => {
      if (!isPlayingRef.current || afkActiveRef.current) return;
      const idleSec = (Date.now() - lastActivityRef.current) / 1000;
      if (idleSec >= AFK_IDLE_SECONDS) {
        afkActiveRef.current = true;
        afkWarningCountRef.current += 1;
        let remaining = AFK_COUNTDOWN_SECONDS;

        setState(prev => ({
          ...prev,
          showAfkWarning: true,
          afkSecondsLeft: remaining,
          afkWarningCount: afkWarningCountRef.current,
        }));

        countdownTimer = setInterval(() => {
          remaining -= 1;
          setState(prev => ({ ...prev, afkSecondsLeft: remaining }));

          if (remaining <= 0) {
            clearInterval(countdownTimer!);
            isPlayingRef.current = false;
            afkActiveRef.current = false;
            // ✅ UX-2: Gọi callback để pause video
            if (onAfkTimeout) {
              onAfkTimeout();
            }
            setState(prev => ({
              ...prev,
              showAfkWarning: false,
              afkSecondsLeft: AFK_COUNTDOWN_SECONDS,
            }));
          }
        }, 1000);
      }
    }, 1000);

    return () => {
      activityEvents.forEach(e => window.removeEventListener(e, resetActivity));
      clearInterval(afkChecker);
      if (countdownTimer) clearInterval(countdownTimer);
    };
  }, [isCompleted, onAfkTimeout]);

  const onUserRespondedToAfk = useCallback(() => {
    afkActiveRef.current = false;
    lastActivityRef.current = Date.now();
    setState(prev => ({
      ...prev,
      showAfkWarning: false,
      afkSecondsLeft: AFK_COUNTDOWN_SECONDS,
    }));
  }, []);

  const loadResumeData = useCallback((data: {
    videoCurrentTime?: number;
    videoDuration?: number;
    watchedSegments?: WatchedSegment[];
    skipCount?: number;
    afkWarningCount?: number;
  }) => {
    if (data.videoCurrentTime !== undefined) currentTimeRef.current = data.videoCurrentTime;
    if (data.videoDuration) durationRef.current = data.videoDuration;
    if (data.watchedSegments) segmentsRef.current = [...data.watchedSegments];
    if (data.skipCount !== undefined) skipCountRef.current = data.skipCount;
    if (data.afkWarningCount !== undefined) afkWarningCountRef.current = data.afkWarningCount;
    syncState();
  }, [syncState]);

  const getTrackingSnapshot = useCallback(() => ({
    segments: mergeSegments(segmentsRef.current),
    skipCount: skipCountRef.current,
    afkWarningCount: afkWarningCountRef.current,
    currentTime: currentTimeRef.current,
    duration: durationRef.current,
  }), []);

  const resetTracking = useCallback(() => {
    segmentsRef.current = [];
    skipCountRef.current = 0;
    afkWarningCountRef.current = 0;
    progressLockedRef.current = false;
    currentTimeRef.current = 0;
    durationRef.current = 0;
    syncState();
  }, [syncState]);

  const actions: VideoTrackingActions = {
    onTick,
    onSeek,
    onPlay,
    onPause,
    onUserRespondedToAfk,
    forceSave,
    loadResumeData,
    getTrackingSnapshot,
    resetTracking,
  };

  return [state, actions];
}
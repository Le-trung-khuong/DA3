// src/hooks/usePomodoroSettings.ts
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './useAuth';
import { PomodoroSettingsService } from '../services/pomodoroSettingsService';
import { PomodoroSettings, DEFAULT_POMODORO_SETTINGS } from '../types/pomodoro';

export function usePomodoroSettings() {
  const { currentUser } = useAuth(); // currentUser từ AuthContext
  const userId = currentUser?.uid || '';

  const [settings, setSettings] = useState<PomodoroSettings>(DEFAULT_POMODORO_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadSettings = useCallback(async () => {
    if (!userId) {
      setSettings({ ...DEFAULT_POMODORO_SETTINGS });
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const data = await PomodoroSettingsService.getSettings(userId);
      setSettings(data);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to load settings');
      setSettings({ ...DEFAULT_POMODORO_SETTINGS });
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const saveSettings = useCallback(
    async (newSettings: Partial<PomodoroSettings>) => {
      if (!userId) {
        setSettings((prev) => ({ ...prev, ...newSettings }));
        return;
      }
      try {
        await PomodoroSettingsService.updateSettings(userId, newSettings);
        setSettings((prev) => ({ ...prev, ...newSettings }));
        setError(null);
      } catch (err: any) {
        setError(err.message || 'Failed to save settings');
        throw err;
      }
    },
    [userId]
  );

  const resetSettings = useCallback(async () => {
    if (!userId) {
      setSettings({ ...DEFAULT_POMODORO_SETTINGS });
      return;
    }
    try {
      await PomodoroSettingsService.resetSettings(userId);
      setSettings({ ...DEFAULT_POMODORO_SETTINGS });
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to reset settings');
      throw err;
    }
  }, [userId]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  return {
    settings,
    loading,
    error,
    saveSettings,
    resetSettings,
    reload: loadSettings,
  };
}
// src/services/pomodoroSettingsService.ts
import { db } from '../utils/config';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { PomodoroSettings, DEFAULT_POMODORO_SETTINGS } from '../types/pomodoro';

export class PomodoroSettingsService {
  private static COLLECTION = 'pomodoroSettings';

  static async getSettings(userId: string): Promise<PomodoroSettings> {
    if (!userId) return { ...DEFAULT_POMODORO_SETTINGS };

    const docRef = doc(db, this.COLLECTION, userId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const data = docSnap.data();
      return {
        workDuration: data.workDuration ?? DEFAULT_POMODORO_SETTINGS.workDuration,
        shortBreakDuration: data.shortBreakDuration ?? DEFAULT_POMODORO_SETTINGS.shortBreakDuration,
        longBreakDuration: data.longBreakDuration ?? DEFAULT_POMODORO_SETTINGS.longBreakDuration,
        cyclesBeforeLongBreak: data.cyclesBeforeLongBreak ?? DEFAULT_POMODORO_SETTINGS.cyclesBeforeLongBreak,
        autoStartBreak: data.autoStartBreak ?? DEFAULT_POMODORO_SETTINGS.autoStartBreak,
        autoStartNextSession: data.autoStartNextSession ?? DEFAULT_POMODORO_SETTINGS.autoStartNextSession,
        updatedAt: data.updatedAt?.toDate?.()?.toISOString?.() ?? new Date().toISOString(),
      };
    } else {
      // Tạo mới với default
      await setDoc(docRef, {
        ...DEFAULT_POMODORO_SETTINGS,
        userId,
        updatedAt: serverTimestamp(),
      });
      return { ...DEFAULT_POMODORO_SETTINGS };
    }
  }

  static async updateSettings(userId: string, settings: Partial<PomodoroSettings>): Promise<void> {
    if (!userId) throw new Error('User ID is required');

    const docRef = doc(db, this.COLLECTION, userId);
    const updateData: any = { ...settings, updatedAt: serverTimestamp() };
    // Loại bỏ undefined
    Object.keys(updateData).forEach((key) => {
      if (updateData[key] === undefined) delete updateData[key];
    });

    await setDoc(docRef, updateData, { merge: true });
  }

  static async resetSettings(userId: string): Promise<void> {
    await this.updateSettings(userId, DEFAULT_POMODORO_SETTINGS);
  }
}
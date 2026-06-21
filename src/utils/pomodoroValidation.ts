// src/utils/pomodoroValidation.ts
export interface ValidationError {
  field: string;
  message: string;
}

export function validatePomodoroSettings(
  workDuration: number,
  shortBreakDuration: number,
  longBreakDuration: number,
  cyclesBeforeLongBreak: number
): ValidationError[] {
  const errors: ValidationError[] = [];

  if (workDuration < 5 || workDuration > 60) {
    errors.push({
      field: 'workDuration',
      message: 'Work time must be between 5 and 60 minutes.',
    });
  }

  if (shortBreakDuration < 1 || shortBreakDuration > 15) {
    errors.push({
      field: 'shortBreakDuration',
      message: 'Short break must be between 1 and 15 minutes.',
    });
  }

  if (longBreakDuration < 5 || longBreakDuration > 60) {
    errors.push({
      field: 'longBreakDuration',
      message: 'Long break must be between 5 and 60 minutes.',
    });
  }

  if (cyclesBeforeLongBreak < 1 || cyclesBeforeLongBreak > 10) {
    errors.push({
      field: 'cyclesBeforeLongBreak',
      message: 'Cycles must be between 1 and 10.',
    });
  }

  return errors;
}
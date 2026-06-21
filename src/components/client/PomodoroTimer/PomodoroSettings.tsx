// src/components/client/PomodoroTimer/PomodoroSettings.tsx
import React, { useState, useEffect } from 'react';
import { usePomodoroSettings } from '../../../hooks/usePomodoroSettings';
import { PRESETS, PomodoroSettings as PomodoroSettingsType, DEFAULT_POMODORO_SETTINGS } from '../../../types/pomodoro';
import { validatePomodoroSettings, ValidationError } from '../../../utils/pomodoroValidation';
import { 
  X, 
  Clock, 
  Coffee, 
  Brain, 
  Save,
  RotateCcw,
  Zap,
  Award,
  Target,
  Flame,
  ChevronRight,
  Check
} from 'lucide-react';

type SettingsField = keyof Pick<
  PomodoroSettingsType,
  'workDuration' | 'shortBreakDuration' | 'longBreakDuration' | 'cyclesBeforeLongBreak'
>;

interface FieldConfig {
  label: string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  min: number;
  max: number;
  step: number;
  suffix: string;
}

const FIELD_CONFIGS: Record<SettingsField, FieldConfig> = {
  workDuration: {
    label: 'Work Duration',
    icon: <Clock size={18} />,
    color: '#6C63FF',
    bgColor: 'rgba(108,99,255,0.12)',
    min: 5,
    max: 60,
    step: 1,
    suffix: 'min',
  },
  shortBreakDuration: {
    label: 'Short Break',
    icon: <Coffee size={18} />,
    color: '#45f1c5',
    bgColor: 'rgba(69,241,197,0.12)',
    min: 1,
    max: 15,
    step: 1,
    suffix: 'min',
  },
  longBreakDuration: {
    label: 'Long Break',
    icon: <Brain size={18} />,
    color: '#6C63FF',
    bgColor: 'rgba(108,99,255,0.12)',
    min: 5,
    max: 60,
    step: 1,
    suffix: 'min',
  },
  cyclesBeforeLongBreak: {
    label: 'Cycles',
    icon: <Target size={18} />,
    color: '#FFB785',
    bgColor: 'rgba(255,183,133,0.12)',
    min: 1,
    max: 10,
    step: 1,
    suffix: '',
  },
};

interface Props {
  onClose?: () => void;
}

export const PomodoroSettings: React.FC<Props> = ({ onClose }) => {
  const { settings, loading, saveSettings, resetSettings } = usePomodoroSettings();
  const [localSettings, setLocalSettings] = useState<PomodoroSettingsType>(settings);
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);

  const handleChange = (field: SettingsField, value: number) => {
    setLocalSettings((prev) => ({ ...prev, [field]: value }));
    setIsDirty(true);
    setSelectedPresetId(null);
    setErrors([]);
  };

  const handleStep = (field: SettingsField, direction: 1 | -1) => {
    const config = FIELD_CONFIGS[field];
    const current = localSettings[field];
    let newVal = current + direction * config.step;
    newVal = Math.min(Math.max(newVal, config.min), config.max);
    handleChange(field, newVal);
  };

  const handleSave = async () => {
    const { workDuration, shortBreakDuration, longBreakDuration, cyclesBeforeLongBreak } = localSettings;
    const validationErrors = validatePomodoroSettings(
      workDuration,
      shortBreakDuration,
      longBreakDuration,
      cyclesBeforeLongBreak
    );

    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }

    setErrors([]);
    setIsSaving(true);
    try {
      await saveSettings(localSettings);
      setIsDirty(false);
      setTimeout(() => {
        if (onClose) onClose();
      }, 300);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  const applyPreset = (presetId: string) => {
    const preset = PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    setSelectedPresetId(presetId);
    setLocalSettings({
      ...localSettings,
      workDuration: preset.workDuration,
      shortBreakDuration: preset.shortBreakDuration,
      longBreakDuration: preset.longBreakDuration,
      cyclesBeforeLongBreak: preset.cyclesBeforeLongBreak,
    });
    setIsDirty(true);
    setErrors([]);
  };

  const handleReset = () => {
    setLocalSettings({ ...DEFAULT_POMODORO_SETTINGS });
    setIsDirty(true);
    setSelectedPresetId(null);
    setErrors([]);
  };

  if (loading) {
    return (
      <div style={{
        background: 'rgba(26,26,46,0.95)',
        borderRadius: 24,
        border: '1px solid rgba(255,255,255,0.06)',
        padding: 40,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: 300,
      }}>
        <div style={{
          width: 40,
          height: 40,
          borderRadius: '50%',
          border: '3px solid rgba(108,99,255,0.2)',
          borderTopColor: '#6C63FF',
          animation: 'spin 0.8s linear infinite',
        }} />
      </div>
    );
  }

  return (
    <div style={{
      background: 'rgba(26,26,46,0.95)',
      borderRadius: 24,
      border: '1px solid rgba(255,255,255,0.06)',
      backdropFilter: 'blur(12px)',
      maxHeight: '90vh',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '20px 24px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            background: 'linear-gradient(135deg, rgba(108,99,255,0.2), rgba(155,89,182,0.2))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <Clock size={20} color="#6C63FF" />
          </div>
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: '#E4E1EE', margin: 0 }}>
              Pomodoro Settings
            </h2>
            <p style={{ fontSize: 13, color: '#C7C4D8', margin: 0 }}>
              Customize your focus experience
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            border: '1px solid rgba(255,255,255,0.06)',
            background: 'rgba(255,255,255,0.05)',
            color: '#C7C4D8',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s',
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
            e.currentTarget.style.color = '#E4E1EE';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
            e.currentTarget.style.color = '#C7C4D8';
          }}
        >
          <X size={18} />
        </button>
      </div>

      {/* Content */}
      <div style={{
        padding: '20px 24px',
        overflowY: 'auto',
        flex: 1,
      }}>
        {/* Presets */}
        <div style={{ marginBottom: 24 }}>
          <h4 style={{
            fontSize: 11,
            fontWeight: 600,
            color: '#C7C4D8',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            marginBottom: 12,
          }}>
            Quick Presets
          </h4>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
            gap: 8,
          }}>
            {PRESETS.map((preset) => (
              <button
                key={preset.id}
                onClick={() => applyPreset(preset.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '10px 14px',
                  borderRadius: 12,
                  border: `1px solid ${
                    selectedPresetId === preset.id
                      ? 'rgba(108,99,255,0.3)'
                      : 'rgba(255,255,255,0.06)'
                  }`,
                  background: selectedPresetId === preset.id
                    ? 'rgba(108,99,255,0.08)'
                    : 'rgba(255,255,255,0.03)',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  textAlign: 'left',
                }}
                onMouseOver={(e) => {
                  if (selectedPresetId !== preset.id) {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
                  }
                }}
                onMouseOut={(e) => {
                  if (selectedPresetId !== preset.id) {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
                  }
                }}
              >
                <span style={{ fontSize: 20 }}>{preset.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: selectedPresetId === preset.id ? '#6C63FF' : '#E4E1EE',
                  }}>
                    {preset.label}
                  </div>
                  <div style={{
                    fontSize: 10,
                    color: '#C7C4D8',
                  }}>
                    {preset.workDuration}/{preset.shortBreakDuration}/{preset.longBreakDuration}
                  </div>
                </div>
                {selectedPresetId === preset.id && (
                  <Check size={14} color="#6C63FF" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Divider */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          marginBottom: 20,
        }}>
          <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.06)' }} />
          <span style={{
            fontSize: 11,
            fontWeight: 600,
            color: '#C7C4D8',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
          }}>
            Custom Settings
          </span>
          <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.06)' }} />
        </div>

        {/* Fields */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {Object.entries(FIELD_CONFIGS).map(([field, config]) => {
            const key = field as SettingsField;
            const value = localSettings[key];
            const error = errors.find((e) => e.field === key);
            const progress = ((value - config.min) / (config.max - config.min)) * 100;

            return (
              <div key={key}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 6,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{
                      width: 28,
                      height: 28,
                      borderRadius: 8,
                      background: config.bgColor,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: config.color,
                    }}>
                      {config.icon}
                    </div>
                    <label style={{
                      fontSize: 13,
                      fontWeight: 500,
                      color: '#E4E1EE',
                    }}>
                      {config.label}
                    </label>
                  </div>
                  <span style={{
                    fontSize: 16,
                    fontWeight: 700,
                    color: config.color,
                  }}>
                    {value}{config.suffix}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <button
                    onClick={() => handleStep(key, -1)}
                    disabled={value <= config.min}
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 8,
                      border: '1px solid rgba(255,255,255,0.06)',
                      background: 'rgba(255,255,255,0.05)',
                      color: value <= config.min ? '#47464f' : '#E4E1EE',
                      cursor: value <= config.min ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 16,
                      fontWeight: 600,
                      transition: 'all 0.2s',
                    }}
                    onMouseOver={(e) => {
                      if (value > config.min) {
                        e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
                      }
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                    }}
                  >
                    −
                  </button>

                  <div style={{ flex: 1, position: 'relative' }}>
                    <input
                      type="range"
                      min={config.min}
                      max={config.max}
                      step={config.step}
                      value={value}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        handleChange(key, val);
                      }}
                      style={{
                        width: '100%',
                        height: 4,
                        borderRadius: 2,
                        background: `linear-gradient(to right, ${config.color} ${progress}%, rgba(255,255,255,0.1) ${progress}%)`,
                        appearance: 'none',
                        outline: 'none',
                        cursor: 'pointer',
                      }}
                    />
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: 9,
                      color: '#47464f',
                      marginTop: 2,
                    }}>
                      <span>{config.min}{config.suffix}</span>
                      <span>{config.max}{config.suffix}</span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleStep(key, 1)}
                    disabled={value >= config.max}
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 8,
                      border: '1px solid rgba(255,255,255,0.06)',
                      background: 'rgba(255,255,255,0.05)',
                      color: value >= config.max ? '#47464f' : '#E4E1EE',
                      cursor: value >= config.max ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 16,
                      fontWeight: 600,
                      transition: 'all 0.2s',
                    }}
                    onMouseOver={(e) => {
                      if (value < config.max) {
                        e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
                      }
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                    }}
                  >
                    +
                  </button>
                </div>

                {error && (
                  <div style={{
                    marginTop: 4,
                    padding: '4px 10px',
                    borderRadius: 6,
                    background: 'rgba(255,107,107,0.1)',
                    border: '1px solid rgba(255,107,107,0.15)',
                  }}>
                    <p style={{
                      fontSize: 11,
                      color: '#ff6b6b',
                      margin: 0,
                    }}>
                      {error.message}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Summary */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 8,
          marginTop: 20,
          padding: 12,
          borderRadius: 12,
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.06)',
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 9, color: '#C7C4D8', textTransform: 'uppercase' }}>Work</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#6C63FF' }}>
              {localSettings.workDuration}m
            </div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 9, color: '#C7C4D8', textTransform: 'uppercase' }}>Short</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#45f1c5' }}>
              {localSettings.shortBreakDuration}m
            </div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 9, color: '#C7C4D8', textTransform: 'uppercase' }}>Long</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#6C63FF' }}>
              {localSettings.longBreakDuration}m
            </div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 9, color: '#C7C4D8', textTransform: 'uppercase' }}>Cycles</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#FFB785' }}>
              {localSettings.cyclesBeforeLongBreak}
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
        gap: 10,
        padding: '16px 24px',
        borderTop: '1px solid rgba(255,255,255,0.06)',
        background: 'rgba(0,0,0,0.2)',
        borderRadius: '0 0 24px 24px',
      }}>
        {isDirty && (
          <button
            onClick={handleReset}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 16px',
              borderRadius: 10,
              border: '1px solid rgba(255,255,255,0.06)',
              background: 'rgba(255,255,255,0.03)',
              color: '#C7C4D8',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 500,
              transition: 'all 0.2s',
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
            }}
          >
            <RotateCcw size={14} />
            Reset
          </button>
        )}
        <button
          onClick={onClose}
          style={{
            padding: '8px 20px',
            borderRadius: 10,
            border: '1px solid rgba(255,255,255,0.06)',
            background: 'rgba(255,255,255,0.03)',
            color: '#C7C4D8',
            cursor: 'pointer',
            fontSize: 13,
            fontWeight: 500,
            transition: 'all 0.2s',
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
          }}
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={!isDirty || isSaving}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 24px',
            borderRadius: 10,
            border: 'none',
            background: isDirty && !isSaving
              ? 'linear-gradient(135deg, #6C63FF, #9B59B6)'
              : 'rgba(255,255,255,0.06)',
            color: isDirty && !isSaving ? '#fff' : '#47464f',
            cursor: isDirty && !isSaving ? 'pointer' : 'not-allowed',
            fontSize: 13,
            fontWeight: 600,
            transition: 'all 0.2s',
          }}
          onMouseOver={(e) => {
            if (isDirty && !isSaving) {
              e.currentTarget.style.transform = 'scale(1.02)';
              e.currentTarget.style.boxShadow = '0 4px 20px rgba(108,99,255,0.3)';
            }
          }}
          onMouseOut={(e) => {
            if (isDirty && !isSaving) {
              e.currentTarget.style.transform = 'scale(1)';
              e.currentTarget.style.boxShadow = 'none';
            }
          }}
        >
          {isSaving ? (
            <>
              <div style={{
                width: 14,
                height: 14,
                borderRadius: '50%',
                border: '2px solid rgba(255,255,255,0.3)',
                borderTopColor: '#fff',
                animation: 'spin 0.8s linear infinite',
              }} />
              Saving...
            </>
          ) : (
            <>
              <Save size={16} />
              Save Settings
            </>
          )}
        </button>
      </div>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};
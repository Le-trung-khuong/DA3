/**
 * src/pages/client/Register.tsx
 * Trang đăng ký - Smart Review LMS
 * Redesigned: split-panel layout, aurora ambient, password strength indicator
 */

import React, { useState, useMemo } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { Link, useNavigate } from 'react-router-dom';

/* ─── Password strength ────────────────────────────────────────── */
interface StrengthResult {
    score: number;       // 0-4
    label: string;
    color: string;
}

function calcStrength(pw: string): StrengthResult {
    if (!pw) return { score: 0, label: '', color: '' };
    let score = 0;
    if (pw.length >= 8)                   score++;
    if (pw.length >= 12)                  score++;
    if (/[A-Z]/.test(pw))                 score++;
    if (/[0-9]/.test(pw))                 score++;
    if (/[^A-Za-z0-9]/.test(pw))         score++;
    const capped = Math.min(score, 4) as 0 | 1 | 2 | 3 | 4;
    const map: Record<number, { label: string; color: string }> = {
        0: { label: '',         color: '' },
        1: { label: 'Yếu',      color: '#EF4444' },
        2: { label: 'Trung bình', color: '#F59E0B' },
        3: { label: 'Tốt',      color: '#3B82F6' },
        4: { label: 'Mạnh',     color: '#10B981' },
    };
    return { score: capped, ...map[capped] };
}

/* ─── Icon helpers ─────────────────────────────────────────────── */
const IconUser = () => (
    <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75"
            d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
);
const IconMail = () => (
    <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75"
            d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
);
const IconLock = () => (
    <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75"
            d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
    </svg>
);
const IconEyeOff = () => (
    <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75"
            d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
    </svg>
);
const IconEye = () => (
    <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75"
            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75"
            d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
);
const IconSpin = () => (
    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" className="sr-spin">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
);

/* ─── Input field ──────────────────────────────────────────────── */
interface FieldProps {
    id: string;
    type: string;
    placeholder: string;
    value: string;
    onChange: (v: string) => void;
    icon: React.ReactNode;
    disabled?: boolean;
    autoComplete?: string;
    trailing?: React.ReactNode;
    hint?: React.ReactNode;
    hasError?: boolean;
}

const Field: React.FC<FieldProps> = ({
    id, type, placeholder, value, onChange, icon,
    disabled, autoComplete, trailing, hint, hasError,
}) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ position: 'relative' }}>
            <span style={{
                position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)',
                color: '#6B6899', pointerEvents: 'none', display: 'flex', alignItems: 'center',
            }}>
                {icon}
            </span>
            <input
                id={id}
                type={type}
                placeholder={placeholder}
                value={value}
                onChange={e => onChange(e.target.value)}
                disabled={disabled}
                autoComplete={autoComplete}
                style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    background: '#0C0B18',
                    border: `1px solid ${hasError ? 'rgba(239,68,68,0.5)' : 'rgba(108,99,255,0.15)'}`,
                    borderRadius: 12,
                    color: '#E8E6FF',
                    fontSize: 14,
                    padding: '11px 40px 11px 40px',
                    outline: 'none',
                    transition: 'border-color 0.2s, box-shadow 0.2s',
                }}
                onFocus={e => {
                    e.currentTarget.style.borderColor = '#6C63FF';
                    e.currentTarget.style.boxShadow = '0 0 0 3px rgba(108,99,255,0.12)';
                }}
                onBlur={e => {
                    e.currentTarget.style.borderColor = hasError
                        ? 'rgba(239,68,68,0.5)' : 'rgba(108,99,255,0.15)';
                    e.currentTarget.style.boxShadow = 'none';
                }}
            />
            {trailing && (
                <span style={{
                    position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                    display: 'flex', alignItems: 'center',
                }}>
                    {trailing}
                </span>
            )}
        </div>
        {hint}
    </div>
);

/* ─── Eye toggle button ─────────────────────────────────────────── */
const EyeToggle: React.FC<{ show: boolean; onToggle: () => void }> = ({ show, onToggle }) => (
    <button
        type="button"
        onClick={onToggle}
        tabIndex={-1}
        style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: '#6B6899', padding: 0, lineHeight: 0,
            transition: 'color 0.15s',
        }}
        onMouseEnter={e => (e.currentTarget.style.color = '#C4B5FD')}
        onMouseLeave={e => (e.currentTarget.style.color = '#6B6899')}
    >
        {show ? <IconEyeOff /> : <IconEye />}
    </button>
);

/* ─── Strength bar ──────────────────────────────────────────────── */
const StrengthBar: React.FC<{ password: string }> = ({ password }) => {
    const { score, label, color } = useMemo(() => calcStrength(password), [password]);
    if (!password) return null;
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ display: 'flex', gap: 4 }}>
                {[1, 2, 3, 4].map(i => (
                    <div key={i} style={{
                        flex: 1, height: 3, borderRadius: 2,
                        background: i <= score ? color : 'rgba(255,255,255,0.08)',
                        transition: 'background 0.25s ease',
                    }} />
                ))}
            </div>
            <span style={{ fontSize: 11, color: color || '#6B6899', fontWeight: 500, textAlign: 'right' }}>
                {label}
            </span>
        </div>
    );
};

/* ─── Brand panel features ──────────────────────────────────────── */
const features = [
    { icon: '⚡', text: 'Học theo phương pháp Spaced Repetition thông minh' },
    { icon: '🎯', text: 'Lộ trình cá nhân hoá với AI gợi ý khoá học phù hợp' },
    { icon: '📊', text: 'Theo dõi tiến độ học tập chi tiết, trực quan' },
];

/* ─── Main component ────────────────────────────────────────────── */
const Register: React.FC = () => {
    const { signUp } = useAuth();
    const navigate = useNavigate();

    const [fullName, setFullName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    const passwordsMatch = confirmPassword ? password === confirmPassword : true;

    const translateFirebaseError = (err: any): string => {
        const code = err?.code || err?.message || '';
        if (code.includes('email-already-in-use')) return 'Email này đã được đăng ký.';
        if (code.includes('weak-password'))         return 'Mật khẩu phải có ít nhất 6 ký tự.';
        if (code.includes('invalid-email'))         return 'Địa chỉ email không hợp lệ.';
        if (code.includes('network-request-failed')) return 'Mất kết nối mạng. Kiểm tra internet và thử lại.';
        return 'Đã xảy ra lỗi. Vui lòng thử lại.';
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        if (!fullName.trim()) { setError('Vui lòng nhập họ và tên.'); return; }
        if (!email.trim())    { setError('Vui lòng nhập email.'); return; }
        // ✅ FIX-REG-1: Nâng min password lên 8 ký tự (Firebase cho phép 6,
        // nhưng 8+ là best practice bảo mật thực tế)
        if (password.length < 8) { setError('Mật khẩu phải có ít nhất 8 ký tự.'); return; }
        if (password !== confirmPassword) { setError('Hai mật khẩu không khớp.'); return; }
        setLoading(true);
        try {
            await signUp(email, password, fullName);
            // ✅ FIX-REG-2: Không navigate ngay — nhắc user xác thực email trước
            setError('');
            navigate('/login', {
              state: {
                message: 'Tài khoản đã được tạo! Vui lòng kiểm tra email để xác thực trước khi đăng nhập.',
              },
            });
        } catch (err: any) {
            setError(translateFirebaseError(err));
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            {/* Global styles injected once */}
            <style>{`
                @keyframes sr-spin { to { transform: rotate(360deg); } }
                @keyframes sr-fade-up {
                    from { opacity: 0; transform: translateY(16px); }
                    to   { opacity: 1; transform: translateY(0); }
                }
                @keyframes sr-orb-1 {
                    0%, 100% { transform: translate(0,0) scale(1); }
                    50%      { transform: translate(40px,-30px) scale(1.08); }
                }
                @keyframes sr-orb-2 {
                    0%, 100% { transform: translate(0,0) scale(1); }
                    50%      { transform: translate(-30px,40px) scale(1.05); }
                }
                @keyframes sr-orb-3 {
                    0%, 100% { transform: translate(0,0) scale(1); }
                    50%      { transform: translate(20px,20px) scale(1.06); }
                }
                .sr-spin { animation: sr-spin 0.8s linear infinite; }
                .sr-fade-up { animation: sr-fade-up 0.45s cubic-bezier(.22,1,.36,1) both; }
                .sr-orb-1 { animation: sr-orb-1 9s ease-in-out infinite; }
                .sr-orb-2 { animation: sr-orb-2 12s ease-in-out infinite; }
                .sr-orb-3 { animation: sr-orb-3 15s ease-in-out infinite; }
                * { box-sizing: border-box; }
                input:-webkit-autofill,
                input:-webkit-autofill:hover,
                input:-webkit-autofill:focus {
                    -webkit-box-shadow: 0 0 0px 1000px #0C0B18 inset !important;
                    -webkit-text-fill-color: #E8E6FF !important;
                    caret-color: #E8E6FF;
                }
            `}</style>

            {/* ── Root shell ── */}
            <div style={{
                minHeight: '100dvh',
                display: 'flex',
                background: '#08070F',
                fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
                WebkitFontSmoothing: 'antialiased',
            }}>

                {/* ══ Brand panel (left) ══ */}
                <div style={{
                    display: 'none',         // mobile: hidden — shown via media query shim below
                    flex: '0 0 44%',
                    position: 'relative',
                    overflow: 'hidden',
                    background: 'linear-gradient(155deg, #110E24 0%, #0D0B1E 60%, #08070F 100%)',
                    padding: '56px 48px',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                }} className="sr-brand-panel">

                    {/* Aurora orbs */}
                    <div className="sr-orb-1" style={{
                        position: 'absolute', top: '10%', left: '15%',
                        width: 320, height: 320, borderRadius: '50%',
                        background: 'radial-gradient(circle, rgba(108,99,255,0.22) 0%, transparent 70%)',
                        filter: 'blur(40px)', pointerEvents: 'none',
                    }} />
                    <div className="sr-orb-2" style={{
                        position: 'absolute', bottom: '18%', right: '8%',
                        width: 260, height: 260, borderRadius: '50%',
                        background: 'radial-gradient(circle, rgba(167,139,250,0.18) 0%, transparent 70%)',
                        filter: 'blur(50px)', pointerEvents: 'none',
                    }} />
                    <div className="sr-orb-3" style={{
                        position: 'absolute', top: '55%', left: '50%',
                        width: 180, height: 180, borderRadius: '50%',
                        background: 'radial-gradient(circle, rgba(192,132,252,0.14) 0%, transparent 70%)',
                        filter: 'blur(35px)', pointerEvents: 'none',
                    }} />

                    {/* Logo */}
                    <div style={{ position: 'relative', zIndex: 1 }}>
                        <div style={{
                            fontSize: 28, fontWeight: 900, letterSpacing: '0.04em',
                            background: 'linear-gradient(130deg, #A78BFA, #7C3AED)',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                        }}>
                            Smart Review
                        </div>
                        <div style={{ fontSize: 12, color: '#6B6899', marginTop: 2, letterSpacing: '0.05em' }}>
                            Learning Management System
                        </div>
                    </div>

                    {/* Hero copy */}
                    <div style={{ position: 'relative', zIndex: 1, flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 12 }}>
                        <h2 style={{
                            fontSize: 32, fontWeight: 800, color: '#EDE9FE',
                            lineHeight: 1.2, margin: 0,
                            letterSpacing: '-0.01em',
                        }}>
                            Học thông minh hơn.<br />
                            <span style={{
                                background: 'linear-gradient(120deg, #A78BFA, #C084FC)',
                                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                            }}>
                                Nhớ lâu hơn.
                            </span>
                        </h2>
                        <p style={{ fontSize: 14, color: '#7C7AA8', lineHeight: 1.65, margin: 0, maxWidth: 300 }}>
                            Nền tảng học tập kết hợp AI và Spaced Repetition giúp bạn ghi nhớ kiến thức hiệu quả hơn gấp nhiều lần.
                        </p>

                        {/* Feature list */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 16 }}>
                            {features.map((f, i) => (
                                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                                    <div style={{
                                        width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                                        background: 'rgba(108,99,255,0.12)',
                                        border: '1px solid rgba(108,99,255,0.2)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontSize: 15,
                                    }}>
                                        {f.icon}
                                    </div>
                                    <p style={{ fontSize: 13, color: '#9D9BC0', lineHeight: 1.55, margin: 0, paddingTop: 6 }}>
                                        {f.text}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Footer tag */}
                    <div style={{ position: 'relative', zIndex: 1, fontSize: 11, color: '#3D3B5E' }}>
                        © 2025 Smart Review. ĐACS3 Project.
                    </div>
                </div>

                {/* ══ Right panel — form ══ */}
                <div style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '32px 24px',
                    overflowY: 'auto',
                }}>
                    <div className="sr-fade-up" style={{ width: '100%', maxWidth: 420 }}>

                        {/* Mobile-only logo */}
                        <div style={{
                            textAlign: 'center',
                            marginBottom: 32,
                        }} className="sr-mobile-logo">
                            <div style={{
                                fontSize: 22, fontWeight: 900, letterSpacing: '0.04em',
                                background: 'linear-gradient(130deg, #A78BFA, #7C3AED)',
                                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                                display: 'inline-block',
                            }}>
                                Smart Review
                            </div>
                        </div>

                        {/* Card */}
                        <div style={{
                            background: 'rgba(20,18,40,0.85)',
                            backdropFilter: 'blur(16px)',
                            border: '1px solid rgba(108,99,255,0.12)',
                            borderRadius: 20,
                            padding: '36px 36px 32px',
                        }}>

                            {/* Heading */}
                            <div style={{ marginBottom: 28 }}>
                                <h1 style={{
                                    fontSize: 22, fontWeight: 700, color: '#EDE9FE',
                                    margin: '0 0 4px', letterSpacing: '-0.01em',
                                }}>
                                    Tạo tài khoản
                                </h1>
                                <p style={{ fontSize: 13, color: '#6B6899', margin: 0 }}>
                                    Đã có tài khoản?{' '}
                                    <Link
                                        to="/login"
                                        style={{ color: '#A78BFA', textDecoration: 'none', fontWeight: 500 }}
                                        onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
                                        onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}
                                    >
                                        Đăng nhập
                                    </Link>
                                </p>
                            </div>

                            {/* Error banner */}
                            {error && (
                                <div style={{
                                    background: 'rgba(239,68,68,0.08)',
                                    border: '1px solid rgba(239,68,68,0.25)',
                                    borderRadius: 10,
                                    padding: '10px 14px',
                                    marginBottom: 20,
                                    fontSize: 13,
                                    color: '#FCA5A5',
                                    display: 'flex',
                                    gap: 8,
                                    alignItems: 'flex-start',
                                }}>
                                    <span style={{ lineHeight: '20px' }}>⚠</span>
                                    <span style={{ lineHeight: '20px' }}>{error}</span>
                                </div>
                            )}

                            {/* Form */}
                            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

                                <Field
                                    id="fullName"
                                    type="text"
                                    placeholder="Họ và tên"
                                    value={fullName}
                                    onChange={setFullName}
                                    icon={<IconUser />}
                                    disabled={loading}
                                    autoComplete="name"
                                />

                                <Field
                                    id="email"
                                    type="email"
                                    placeholder="Email"
                                    value={email}
                                    onChange={setEmail}
                                    icon={<IconMail />}
                                    disabled={loading}
                                    autoComplete="email"
                                />

                                <Field
                                    id="password"
                                    type={showPassword ? 'text' : 'password'}
                                    placeholder="Mật khẩu"
                                    value={password}
                                    onChange={setPassword}
                                    icon={<IconLock />}
                                    disabled={loading}
                                    autoComplete="new-password"
                                    trailing={
                                        <EyeToggle show={showPassword}
                                            onToggle={() => setShowPassword(p => !p)} />
                                    }
                                    hint={<StrengthBar password={password} />}
                                />

                                <Field
                                    id="confirmPassword"
                                    type={showConfirmPassword ? 'text' : 'password'}
                                    placeholder="Xác nhận mật khẩu"
                                    value={confirmPassword}
                                    onChange={setConfirmPassword}
                                    icon={<IconLock />}
                                    disabled={loading}
                                    autoComplete="new-password"
                                    hasError={!passwordsMatch}
                                    trailing={
                                        <>
                                            {confirmPassword && (
                                                <span style={{
                                                    fontSize: 14, marginRight: 8,
                                                    color: passwordsMatch ? '#10B981' : '#EF4444',
                                                }}>
                                                    {passwordsMatch ? '✓' : '✗'}
                                                </span>
                                            )}
                                            <EyeToggle show={showConfirmPassword}
                                                onToggle={() => setShowConfirmPassword(p => !p)} />
                                        </>
                                    }
                                />

                                {/* Divider */}
                                <div style={{
                                    height: 1,
                                    background: 'linear-gradient(90deg, transparent, rgba(108,99,255,0.12), transparent)',
                                    margin: '4px 0',
                                }} />

                                {/* Submit */}
                                <button
                                    type="submit"
                                    disabled={loading}
                                    style={{
                                        width: '100%',
                                        padding: '13px 0',
                                        borderRadius: 12,
                                        border: 'none',
                                        background: loading
                                            ? 'rgba(108,99,255,0.4)'
                                            : 'linear-gradient(135deg, #6C63FF 0%, #9B59B6 100%)',
                                        color: '#fff',
                                        fontSize: 14,
                                        fontWeight: 600,
                                        letterSpacing: '0.02em',
                                        cursor: loading ? 'not-allowed' : 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: 8,
                                        boxShadow: loading ? 'none' : '0 4px 20px rgba(108,99,255,0.3)',
                                        transition: 'all 0.2s ease',
                                    }}
                                    onMouseEnter={e => {
                                        if (!loading) {
                                            e.currentTarget.style.boxShadow = '0 6px 28px rgba(108,99,255,0.45)';
                                            e.currentTarget.style.transform = 'translateY(-1px)';
                                        }
                                    }}
                                    onMouseLeave={e => {
                                        e.currentTarget.style.boxShadow = '0 4px 20px rgba(108,99,255,0.3)';
                                        e.currentTarget.style.transform = 'translateY(0)';
                                    }}
                                >
                                    {loading ? (
                                        <>
                                            <IconSpin />
                                            Đang tạo tài khoản…
                                        </>
                                    ) : (
                                        'Tạo tài khoản'
                                    )}
                                </button>

                                {/* Terms note */}
                                <p style={{
                                    fontSize: 11, color: '#4A4870', textAlign: 'center', margin: 0,
                                    lineHeight: 1.55,
                                }}>
                                    Bằng cách đăng ký, bạn đồng ý với{' '}
                                    <Link to="/terms" style={{ color: '#6B6899', textDecoration: 'underline' }}>
                                        điều khoản sử dụng
                                    </Link>
                                    {' '}của Smart Review.
                                </p>
                            </form>
                        </div>
                    </div>
                </div>
            </div>

            {/* Responsive — show brand panel on wide screens */}
            <style>{`
                @media (min-width: 860px) {
                    .sr-brand-panel   { display: flex !important; }
                    .sr-mobile-logo   { display: none !important; }
                }
                @media (max-width: 859px) {
                    .sr-brand-panel   { display: none !important; }
                    .sr-mobile-logo   { display: block !important; }
                }
            `}</style>
        </>
    );
};

export default Register;
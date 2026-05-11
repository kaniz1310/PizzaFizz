// src/Pages/ForgotPassword.jsx
// ─────────────────────────────────────────────────────
// 3-step password reset flow (no email needed):
//
//  Step 1 — Enter your email address
//  Step 2 — Verify with your registered phone number
//  Step 3 — Set a new password
// ─────────────────────────────────────────────────────
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { verifyPhone, resetPassword } from "../api";

export default function ForgotPassword() {
    const navigate = useNavigate();

    // step: 1 = enter email, 2 = verify phone, 3 = new password, 4 = success
    const [step, setStep] = useState(1);
    const [email, setEmail] = useState("");
    const [phone, setPhone] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPass, setConfirmPass] = useState("");
    const [userName, setUserName] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [showPass, setShowPass] = useState(false);

    // ── Step 1 → 2: check email exists ────────────────
    function handleEmailNext() {
        if (!email.trim()) { setError("Please enter your email."); return; }
        setError("");
        setStep(2);
    }

    // ── Step 2 → 3: verify phone ───────────────────────
    async function handleVerifyPhone() {
        if (!phone.trim()) { setError("Please enter your phone number."); return; }
        setLoading(true);
        setError("");
        try {
            const data = await verifyPhone({ email: email.trim(), phone: phone.trim() });
            setUserName(data.name);
            setStep(3);
        } catch (err) {
            setError(err.message || "Verification failed.");
        } finally {
            setLoading(false);
        }
    }

    // ── Step 3 → 4: reset password ────────────────────
    async function handleResetPassword() {
        if (!newPassword) { setError("Please enter a new password."); return; }
        if (newPassword.length < 6) { setError("Password must be at least 6 characters."); return; }
        if (newPassword !== confirmPass) { setError("Passwords do not match."); return; }
        setLoading(true);
        setError("");
        try {
            await resetPassword({
                email: email.trim(),
                phone: phone.trim(),
                new_password: newPassword,
            });
            setStep(4);
        } catch (err) {
            setError(err.message || "Reset failed. Please try again.");
        } finally {
            setLoading(false);
        }
    }

    return (
        <div style={styles.page}>
            <div style={styles.card}>

                {/* ── Progress dots ── */}
                {step < 4 && (
                    <div style={styles.dots}>
                        {[1, 2, 3].map(n => (
                            <div key={n} style={{
                                ...styles.dot,
                                background: step >= n ? "#e63329" : "#e5e7eb",
                                transform: step === n ? "scale(1.3)" : "scale(1)",
                            }} />
                        ))}
                    </div>
                )}

                {/* ══════════════════════════════════════════
            STEP 1 — Enter email
        ══════════════════════════════════════════ */}
                {step === 1 && (
                    <>
                        <div style={styles.iconWrap}>🔑</div>
                        <h2 style={styles.heading}>Forgot Password?</h2>
                        <p style={styles.sub}>
                            No problem! Enter your email and we'll verify your identity using your phone number.
                        </p>

                        {error && <ErrorBox msg={error} />}

                        <Field
                            label="Email Address"
                            type="email"
                            value={email}
                            onChange={setEmail}
                            placeholder="your@email.com"
                        />

                        <button onClick={handleEmailNext} style={styles.primaryBtn}>
                            Continue →
                        </button>

                        <BackToLogin navigate={navigate} />
                    </>
                )}

                {/* ══════════════════════════════════════════
            STEP 2 — Verify phone number
        ══════════════════════════════════════════ */}
                {step === 2 && (
                    <>
                        <div style={styles.iconWrap}>📱</div>
                        <h2 style={styles.heading}>Verify Your Identity</h2>
                        <p style={styles.sub}>
                            Enter the phone number registered with{" "}
                            <strong style={{ color: "#e63329" }}>{email}</strong>
                        </p>

                        {error && <ErrorBox msg={error} />}

                        <Field
                            label="Registered Phone Number"
                            type="tel"
                            value={phone}
                            onChange={setPhone}
                            placeholder="+880 17000 00001"
                        />

                        <p style={styles.hint}>
                            💡 This is the phone number you used when you registered.
                        </p>

                        <button
                            onClick={handleVerifyPhone}
                            disabled={loading}
                            style={styles.primaryBtn}
                        >
                            {loading ? "Verifying…" : "Verify Phone →"}
                        </button>

                        <button onClick={() => { setStep(1); setError(""); }} style={styles.backBtn}>
                            ← Back
                        </button>
                    </>
                )}

                {/* ══════════════════════════════════════════
            STEP 3 — Set new password
        ══════════════════════════════════════════ */}
                {step === 3 && (
                    <>
                        <div style={styles.iconWrap}>🔒</div>
                        <h2 style={styles.heading}>Set New Password</h2>
                        <p style={styles.sub}>
                            Identity verified! Welcome back,{" "}
                            <strong style={{ color: "#e63329" }}>{userName}</strong>.
                            Choose a strong new password.
                        </p>

                        {error && <ErrorBox msg={error} />}

                        {/* Password strength indicator */}
                        <PasswordStrength password={newPassword} />

                        <div style={{ position: "relative" }}>
                            <Field
                                label="New Password"
                                type={showPass ? "text" : "password"}
                                value={newPassword}
                                onChange={setNewPassword}
                                placeholder="Min. 6 characters"
                            />
                            <button
                                onClick={() => setShowPass(p => !p)}
                                style={styles.eyeBtn}
                            >
                                {showPass ? "🙈" : "👁️"}
                            </button>
                        </div>

                        <Field
                            label="Confirm New Password"
                            type="password"
                            value={confirmPass}
                            onChange={setConfirmPass}
                            placeholder="Re-enter password"
                        />

                        {/* Match indicator */}
                        {confirmPass && (
                            <p style={{
                                fontSize: ".82rem", marginBottom: 8, fontWeight: 700,
                                color: newPassword === confirmPass ? "#16a34a" : "#e63329",
                            }}>
                                {newPassword === confirmPass ? "✅ Passwords match" : "❌ Passwords don't match"}
                            </p>
                        )}

                        <button
                            onClick={handleResetPassword}
                            disabled={loading}
                            style={styles.primaryBtn}
                        >
                            {loading ? "Resetting…" : "Reset Password 🔐"}
                        </button>

                        <button onClick={() => { setStep(2); setError(""); }} style={styles.backBtn}>
                            ← Back
                        </button>
                    </>
                )}

                {/* ══════════════════════════════════════════
            STEP 4 — Success
        ══════════════════════════════════════════ */}
                {step === 4 && (
                    <div style={{ textAlign: "center" }}>
                        <div style={{ fontSize: "5rem", marginBottom: 16, animation: "pop .5s" }}>
                            🎉
                        </div>
                        <h2 style={{ ...styles.heading, color: "#16a34a" }}>
                            Password Reset!
                        </h2>
                        <p style={styles.sub}>
                            Your password has been updated successfully.
                            You can now sign in with your new password.
                        </p>

                        <div style={styles.successBox}>
                            <div>✅ Account: <strong>{email}</strong></div>
                            <div style={{ marginTop: 4, fontSize: ".85rem", color: "#888" }}>
                                Password changed just now
                            </div>
                        </div>

                        <button
                            onClick={() => navigate("/login")}
                            style={{ ...styles.primaryBtn, background: "#16a34a" }}
                        >
                            Go to Sign In →
                        </button>
                    </div>
                )}

            </div>

            <style>{`
        @keyframes pop {
          0%  { transform: scale(0) rotate(-10deg); }
          70% { transform: scale(1.2) rotate(3deg); }
          100%{ transform: scale(1) rotate(0); }
        }
      `}</style>
        </div>
    );
}

// ── Password strength meter ───────────────────────────
function PasswordStrength({ password }) {
    if (!password) return null;

    let strength = 0;
    if (password.length >= 6) strength++;
    if (password.length >= 10) strength++;
    if (/[A-Z]/.test(password)) strength++;
    if (/[0-9]/.test(password)) strength++;
    if (/[^A-Za-z0-9]/.test(password)) strength++;

    const levels = [
        { label: "Too short", color: "#dc2626" },
        { label: "Weak", color: "#ea580c" },
        { label: "Fair", color: "#ca8a04" },
        { label: "Good", color: "#16a34a" },
        { label: "Strong", color: "#15803d" },
        { label: "Very strong", color: "#166534" },
    ];
    const level = levels[Math.min(strength, levels.length - 1)];

    return (
        <div style={{ marginBottom: 12 }}>
            <div style={{ display: "flex", gap: 4, marginBottom: 4 }}>
                {[0, 1, 2, 3, 4].map(i => (
                    <div key={i} style={{
                        flex: 1, height: 4, borderRadius: 4,
                        background: i < strength ? level.color : "#e5e7eb",
                        transition: "background .3s",
                    }} />
                ))}
            </div>
            <span style={{ fontSize: ".75rem", color: level.color, fontWeight: 700 }}>
                {level.label}
            </span>
        </div>
    );
}

// ── Reusable sub-components ───────────────────────────
function Field({ label, type, value, onChange, placeholder }) {
    return (
        <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontWeight: 700, marginBottom: 6, fontSize: ".9rem" }}>
                {label}
            </label>
            <input
                type={type}
                value={value}
                onChange={e => onChange(e.target.value)}
                placeholder={placeholder}
                style={styles.input}
                onFocus={e => (e.target.style.borderColor = "#e63329")}
                onBlur={e => (e.target.style.borderColor = "#e5e7eb")}
            />
        </div>
    );
}

function ErrorBox({ msg }) {
    return (
        <div style={styles.errorBox}>⚠️ {msg}</div>
    );
}

function BackToLogin({ navigate }) {
    return (
        <p style={{ textAlign: "center", marginTop: 16, fontSize: ".9rem", color: "#888" }}>
            Remember your password?{" "}
            <span
                onClick={() => navigate("/login")}
                style={{ color: "#e63329", fontWeight: 700, cursor: "pointer" }}
            >
                Sign in
            </span>
        </p>
    );
}

// ── Styles ────────────────────────────────────────────
const styles = {
    page: {
        minHeight: "calc(100vh - 68px)",
        display: "flex", alignItems: "center",
        justifyContent: "center", padding: "40px 16px",
        background: "#fff8f0",
    },
    card: {
        width: "100%", maxWidth: 440, background: "#fff",
        borderRadius: 24, padding: 40,
        boxShadow: "0 8px 40px rgba(0,0,0,.1)",
    },

    dots: { display: "flex", justifyContent: "center", gap: 8, marginBottom: 24 },
    dot: {
        width: 10, height: 10, borderRadius: "50%",
        transition: "all .3s",
    },

    iconWrap: {
        fontSize: "3rem", textAlign: "center",
        display: "block", marginBottom: 12,
    },
    heading: {
        fontFamily: "'Boogaloo', cursive",
        fontSize: "2rem", color: "#e63329",
        marginBottom: 8, textAlign: "center",
    },
    sub: {
        color: "#888", marginBottom: 24,
        fontSize: ".9rem", textAlign: "center", lineHeight: 1.6,
    },
    hint: {
        fontSize: ".82rem", color: "#888",
        marginBottom: 16, lineHeight: 1.5,
        background: "#f0fdf4", borderRadius: 10,
        padding: "8px 12px", border: "1px solid #86efac",
    },

    errorBox: {
        background: "#fff0ee", border: "2px solid #e63329",
        borderRadius: 12, padding: "10px 16px", marginBottom: 16,
        color: "#e63329", fontWeight: 700, fontSize: ".88rem",
    },

    input: {
        width: "100%", padding: "12px 16px",
        border: "2px solid #e5e7eb", borderRadius: 12,
        fontFamily: "Nunito, sans-serif", fontSize: "1rem", outline: "none",
    },

    eyeBtn: {
        position: "absolute", right: 12, top: 34,
        background: "none", border: "none",
        cursor: "pointer", fontSize: "1.1rem",
    },

    primaryBtn: {
        width: "100%", padding: 14,
        background: "#e63329", color: "#fff", border: "none",
        borderRadius: 50, fontFamily: "'Boogaloo', cursive",
        fontSize: "1.3rem", cursor: "pointer", marginTop: 4,
        transition: "opacity .2s",
    },
    backBtn: {
        width: "100%", padding: 10, marginTop: 10,
        background: "transparent", color: "#888",
        border: "2px solid #e5e7eb", borderRadius: 50,
        fontFamily: "Nunito, sans-serif", fontWeight: 700,
        fontSize: ".9rem", cursor: "pointer",
    },

    successBox: {
        background: "#f0fdf4", border: "2px solid #16a34a",
        borderRadius: 12, padding: "14px 20px",
        marginBottom: 24, color: "#166534", fontSize: ".9rem",
    },
};
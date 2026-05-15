// src/Pages/Login.jsx
// One login page for ALL roles: customer, rider, owner
// Redirects to the correct dashboard based on role after login

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { loginUser } from "../api";

// Where each role goes after login
const ROLE_REDIRECT = {
    customer: "/customize",
    rider: "/rider/dashboard",
    owner: "/admin",
    admin: "/admin",
};

// Demo accounts shown as quick-fill buttons
const DEMO_ACCOUNTS = [
    { label: "🧑 Customer", email: "customer@pizza.com", password: "pizza123", color: "#f97316", bg: "#fff7ed" },
    { label: "🛵 Rider", email: "rider@pizza.com", password: "rider123", color: "#3b82f6", bg: "#eff6ff" },
    { label: "👨‍🍳 Owner", email: "owner@pizza.com", password: "owner123", color: "#e63329", bg: "#fff0ee" },
];

export default function Login() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const navigate = useNavigate();

    async function handleLogin() {
        if (!email || !password) { setError("Please fill all fields"); return; }
        setLoading(true);
        setError("");
        try {
            const data = await loginUser({ email, password });
            localStorage.setItem("token", data.token);
            localStorage.setItem("user", JSON.stringify(data.user));
            window.dispatchEvent(new Event("pizzafizz-auth"));
            const dest = ROLE_REDIRECT[data.user.role] || "/";
            navigate(dest);
        } catch (err) {
            if (err.message === "Failed to fetch") {
                setError("Cannot connect to backend. Run: py -3.11 -m uvicorn main:app --port 8000");
            } else {
                setError(err.message || "Invalid email or password");
            }
        } finally {
            setLoading(false);
        }
    }

    function quickFill(email, password) {
        setEmail(email);
        setPassword(password);
        setError("");
    }

    return (
        <div style={styles.page}>
            <div style={styles.card}>

                {/* Logo */}
                <div style={{ textAlign: "center", marginBottom: 4 }}>
                    <span style={styles.logo}>Pizza<span style={{ color: "#fbbf24" }}>Fizz</span> 🍕</span>
                </div>
                <h2 style={styles.heading}>Welcome Back!</h2>
                <p style={styles.sub}>Sign in to your account</p>

                {/* Role badges */}
                <div style={styles.roleBadges}>
                    <span style={styles.roleBadge}>🧑 Customer</span>
                    <span style={{ color: "#ddd" }}>·</span>
                    <span style={styles.roleBadge}>🛵 Rider</span>
                    <span style={{ color: "#ddd" }}>·</span>
                    <span style={styles.roleBadge}>👨‍🍳 Owner</span>
                </div>

                {error && <div style={styles.errorBox}>⚠️ {error}</div>}

                <Field label="Email" type="email" value={email} onChange={setEmail} placeholder="your@email.com" />
                <Field label="Password" type="password" value={password} onChange={setPassword} placeholder="••••••••" />

                <div style={{ textAlign: "right", marginBottom: 12 }}>
                    <span
                        onClick={() => navigate("/forgot")}
                        style={{ color: "#e63329", fontSize: ".85rem", cursor: "pointer", fontWeight: 700 }}
                    >
                        Forgot password?
                    </span>
                </div>

                <button onClick={handleLogin} disabled={loading} style={styles.loginBtn}>
                    {loading ? "Signing in…" : "Sign In →"}
                </button>

                {/* Demo quick-fill */}
                <div style={styles.demoSection}>
                    <p style={styles.demoLabel}>— Quick demo login —</p>
                    <div style={styles.demoRow}>
                        {DEMO_ACCOUNTS.map(acc => (
                            <button
                                key={acc.label}
                                onClick={() => quickFill(acc.email, acc.password)}
                                style={{
                                    flex: 1, padding: "8px 4px",
                                    borderRadius: 12,
                                    border: `2px dashed ${acc.color}`,
                                    background: acc.bg,
                                    color: acc.color,
                                    cursor: "pointer",
                                    fontFamily: "Nunito,sans-serif",
                                    fontWeight: 700, fontSize: ".78rem",
                                }}
                            >
                                {acc.label}
                            </button>
                        ))}
                    </div>
                </div>

                <p style={styles.switchText}>
                    Don't have an account?{" "}
                    <span onClick={() => navigate("/register")} style={styles.link}>
                        Register here
                    </span>
                </p>
            </div>
        </div>
    );
}

function Field({ label, type, value, onChange, placeholder }) {
    return (
        <div style={{ marginBottom: 14 }}>
            <label style={{ display: "block", fontWeight: 700, marginBottom: 5, fontSize: ".9rem" }}>
                {label}
            </label>
            <input
                type={type} value={value} placeholder={placeholder}
                onChange={e => onChange(e.target.value)}
                style={styles.input}
                onFocus={e => (e.target.style.borderColor = "#e63329")}
                onBlur={e => (e.target.style.borderColor = "#e5e7eb")}
            />
        </div>
    );
}

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
    logo: {
        fontFamily: "'Boogaloo',cursive",
        fontSize: "1.6rem", color: "#e63329",
    },
    heading: {
        fontFamily: "'Boogaloo',cursive",
        fontSize: "2rem", color: "#1c0a00",
        textAlign: "center", marginBottom: 4,
    },
    sub: { textAlign: "center", color: "#888", marginBottom: 12, fontSize: ".9rem" },

    roleBadges: {
        display: "flex", justifyContent: "center",
        gap: 8, marginBottom: 20, flexWrap: "wrap",
    },
    roleBadge: {
        background: "#fff8f0", color: "#7c2d12",
        border: "1px solid #fde68a", borderRadius: 50,
        padding: "3px 12px", fontSize: ".78rem", fontWeight: 700,
    },

    errorBox: {
        background: "#fff0ee", border: "2px solid #e63329",
        borderRadius: 12, padding: "10px 14px", marginBottom: 14,
        color: "#e63329", fontWeight: 700, fontSize: ".85rem",
    },
    input: {
        width: "100%", padding: "12px 16px",
        border: "2px solid #e5e7eb", borderRadius: 12,
        fontFamily: "Nunito,sans-serif", fontSize: "1rem", outline: "none",
    },
    loginBtn: {
        width: "100%", padding: 14,
        background: "#e63329", color: "#fff", border: "none",
        borderRadius: 50, fontFamily: "'Boogaloo',cursive",
        fontSize: "1.3rem", cursor: "pointer", marginBottom: 4,
    },
    demoSection: { marginTop: 16 },
    demoLabel: {
        textAlign: "center", color: "#aaa",
        fontSize: ".8rem", marginBottom: 8,
    },
    demoRow: { display: "flex", gap: 8 },
    switchText: { textAlign: "center", marginTop: 16, fontSize: ".9rem", color: "#888" },
    link: { color: "#e63329", fontWeight: 700, cursor: "pointer" },
};
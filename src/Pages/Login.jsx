// ════════════════════════════════════════════════════════
//  Login.jsx
//  Paste over your existing Login.jsx
//
//  🔧 Only thing you need to change:
//     - The loginUser() function body — keep YOUR existing
//       API call logic, just replace the JSX/styling below.
// ════════════════════════════════════════════════════════
import { useState } from "react";
import { useNavigate } from "react-router-dom";
// 👇 Keep YOUR existing api import
import { loginUser } from "../api";

export default function Login() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const navigate = useNavigate();

    // ── Keep YOUR existing login logic here ───────────────
    async function handleLogin() {
        if (!email || !password) { setError("Please fill all fields"); return; }
        setLoading(true);
        setError("");
        try {
            const data = await loginUser({ email, password });
            // Adjust based on what your API returns:
            localStorage.setItem("token", data.token || data.access_token);
            localStorage.setItem("user", JSON.stringify(data.user));
            const role = data.user?.role;
            navigate(role === "owner" || role === "admin" ? "/admin" : "/");
        } catch (err) {
            setError(err.message || "Invalid email or password");
        } finally {
            setLoading(false);
        }
    }

    // Demo quick-fill (remove if you don't want it)
    function quickFill(role) {
        setEmail(role === "customer" ? "customer@pizza.com" : "owner@pizza.com");
        setPassword(role === "customer" ? "pizza123" : "owner123");
    }

    return (
        <div style={styles.page}>
            <div style={styles.card}>
                <h2 style={styles.heading}>Welcome Back! 👋</h2>
                <p style={styles.sub}>Sign in to order your favourite pizza</p>

                {error && (
                    <div style={styles.errorBox}>⚠️ {error}</div>
                )}

                <Field label="Email / Phone" type="text" value={email} onChange={setEmail} />
                <Field label="Password" type="password" value={password} onChange={setPassword} />

                {/* Forgot password link — update route to match yours */}
                <div style={{ textAlign: "right", marginBottom: 8 }}>
                    <span
                        onClick={() => navigate("/forgot-password")}
                        style={{ color: "#e63329", fontSize: ".85rem", cursor: "pointer", fontWeight: 700 }}
                    >
                        Forgot password?
                    </span>
                </div>

                <button onClick={handleLogin} disabled={loading} style={styles.submitBtn}>
                    {loading ? "Signing in…" : "Sign In 🍕"}
                </button>

                {/* Demo buttons — remove these in production */}
                <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                    <DemoBtn label="🧑 Demo Customer" color="#f97316" bg="#fff7ed" onClick={() => quickFill("customer")} />
                    <DemoBtn label="👨‍🍳 Demo Owner" color="#e63329" bg="#fff0ee" onClick={() => quickFill("owner")} />
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

// ── Reusable input field ──────────────────────────────────────
function Field({ label, type, value, onChange }) {
    return (
        <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontWeight: 700, marginBottom: 6, fontSize: ".9rem" }}>
                {label}
            </label>
            <input
                type={type}
                value={value}
                onChange={e => onChange(e.target.value)}
                style={styles.input}
                onFocus={e => (e.target.style.borderColor = "#e63329")}
                onBlur={e => (e.target.style.borderColor = "#e5e7eb")}
            />
        </div>
    );
}

function DemoBtn({ label, color, bg, onClick }) {
    return (
        <button onClick={onClick} style={{
            flex: 1, padding: 8, borderRadius: 12,
            border: `2px dashed ${color}`, background: bg,
            cursor: "pointer", fontFamily: "Nunito,sans-serif",
            fontWeight: 700, fontSize: ".8rem", color,
        }}>
            {label}
        </button>
    );
}

// ── Styles ────────────────────────────────────────────────────
const styles = {
    page: {
        minHeight: "calc(100vh - 68px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px 16px",
    },
    card: {
        width: "100%",
        maxWidth: 440,
        background: "#fff",
        borderRadius: 24,
        padding: 40,
        boxShadow: "0 8px 40px rgba(0,0,0,.1)",
    },
    heading: {
        fontFamily: "'Boogaloo', cursive",
        fontSize: "2rem",
        color: "#e63329",
        marginBottom: 6,
    },
    sub: { color: "#888", marginBottom: 24, fontSize: ".95rem" },
    errorBox: {
        background: "#fff0ee",
        border: "2px solid #e63329",
        borderRadius: 12,
        padding: "10px 16px",
        marginBottom: 16,
        color: "#e63329",
        fontWeight: 700,
        fontSize: ".9rem",
    },
    input: {
        width: "100%",
        padding: "12px 16px",
        border: "2px solid #e5e7eb",
        borderRadius: 12,
        fontFamily: "Nunito, sans-serif",
        fontSize: "1rem",
        outline: "none",
        transition: "border-color .2s",
    },
    submitBtn: {
        width: "100%",
        padding: 14,
        background: "#e63329",
        color: "#fff",
        border: "none",
        borderRadius: 50,
        fontFamily: "'Boogaloo', cursive",
        fontSize: "1.3rem",
        cursor: "pointer",
        marginTop: 4,
        transition: "background .2s",
    },
    switchText: { textAlign: "center", marginTop: 16, fontSize: ".9rem", color: "#888" },
    link: { color: "#e63329", fontWeight: 700, cursor: "pointer" },
};
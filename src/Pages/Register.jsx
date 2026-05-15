// src/Pages/Register.jsx
// One register page — user picks Customer or Rider role
// Owner accounts are created by admin only (not public registration)

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { registerUser } from "../api";

const ROLE_REDIRECT = {
    customer: "/customize",
    rider: "/rider/dashboard",
};

export default function Register() {
    const [role, setRole] = useState("customer"); // customer | rider
    const [form, setForm] = useState({
        name: "", phone: "", address: "", email: "", password: "", confirmPassword: "",
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const navigate = useNavigate();

    const set = key => e => setForm(f => ({ ...f, [key]: e.target.value }));

    async function handleRegister() {
        if (!form.name || !form.phone || !form.address || !form.password) {
            setError("Please fill all required fields"); return;
        }
        if (form.password.length < 6) {
            setError("Password must be at least 6 characters"); return;
        }
        if (form.password !== form.confirmPassword) {
            setError("Passwords do not match"); return;
        }
        setLoading(true);
        setError("");
        try {
            const data = await registerUser({ ...form, role });
            localStorage.setItem("token", data.token);
            localStorage.setItem("user", JSON.stringify(data.user));
            window.dispatchEvent(new Event("pizzafizz-auth"));
            navigate(ROLE_REDIRECT[data.user.role] || "/");
        } catch (err) {
            setError(err.message || "Registration failed");
        } finally {
            setLoading(false);
        }
    }

    return (
        <div style={styles.page}>
            <div style={styles.card}>

                {/* Logo */}
                <div style={{ textAlign: "center", marginBottom: 4 }}>
                    <span style={styles.logo}>Pizza<span style={{ color: "#fbbf24" }}>Fizz</span> 🍕</span>
                </div>
                <h2 style={styles.heading}>Create Account</h2>
                <p style={styles.sub}>Join the PizzaFizz family</p>

                {/* ── Role selector ── */}
                <p style={styles.roleLabel}>I want to join as:</p>
                <div style={styles.roleRow}>
                    <RoleCard
                        icon="🧑"
                        title="Customer"
                        desc="Order delicious pizzas"
                        selected={role === "customer"}
                        onClick={() => setRole("customer")}
                        color="#f97316"
                    />
                    <RoleCard
                        icon="🛵"
                        title="Rider"
                        desc="Deliver orders & earn money"
                        selected={role === "rider"}
                        onClick={() => setRole("rider")}
                        color="#3b82f6"
                    />
                </div>

                {/* Note about owner */}
                <p style={styles.ownerNote}>
                    👨‍🍳 Owner accounts are created by the admin.
                </p>

                {error && <div style={styles.errorBox}>⚠️ {error}</div>}

                {/* ── Fields ── */}
                {[
                    { label: "Full Name *", key: "name", type: "text", ph: "John Doe" },
                    { label: "Phone Number *", key: "phone", type: "tel", ph: "+880 17..." },
                    {
                        label: role === "rider"
                            ? "Base Location *"
                            : "Delivery Address *", key: "address", type: "text", ph: role === "rider"
                                ? "Mohakhali, Dhaka"
                                : "House 12, Road 5, Dhaka"
                    },
                    { label: "Email (optional)", key: "email", type: "email", ph: "your@email.com" },
                    { label: "Password *", key: "password", type: "password", ph: "Min. 6 characters" },
                    { label: "Confirm Password *", key: "confirmPassword", type: "password", ph: "Re-enter password" },
                ].map(({ label, key, type, ph }) => (
                    <div key={key} style={{ marginBottom: 12 }}>
                        <label style={styles.fieldLabel}>{label}</label>
                        <input
                            type={type}
                            value={form[key]}
                            onChange={set(key)}
                            placeholder={ph}
                            style={styles.input}
                            onFocus={e => (e.target.style.borderColor = role === "rider" ? "#3b82f6" : "#e63329")}
                            onBlur={e => (e.target.style.borderColor = "#e5e7eb")}
                        />
                    </div>
                ))}

                <button
                    onClick={handleRegister}
                    disabled={loading}
                    style={{
                        ...styles.submitBtn,
                        background: role === "rider" ? "#3b82f6" : "#e63329",
                    }}
                >
                    {loading
                        ? "Creating…"
                        : role === "rider"
                            ? "🛵 Join as Rider"
                            : "🍕 Create Account"}
                </button>

                <p style={styles.switchText}>
                    Already have an account?{" "}
                    <span onClick={() => navigate("/login")} style={styles.link}>Sign in</span>
                </p>
            </div>
        </div>
    );
}

// ── Role selection card ───────────────────────────────
function RoleCard({ icon, title, desc, selected, onClick, color }) {
    return (
        <div
            onClick={onClick}
            style={{
                flex: 1, padding: "16px 12px", borderRadius: 16, cursor: "pointer",
                border: `2px solid ${selected ? color : "#e5e7eb"}`,
                background: selected ? `${color}10` : "#f9f9f9",
                textAlign: "center", transition: "all .2s",
            }}
        >
            <div style={{ fontSize: "2rem", marginBottom: 6 }}>{icon}</div>
            <div style={{ fontWeight: 800, fontSize: ".95rem", color: selected ? color : "#1c0a00" }}>
                {title}
            </div>
            <div style={{ fontSize: ".75rem", color: "#888", marginTop: 3 }}>{desc}</div>
            {selected && (
                <div style={{
                    marginTop: 8, background: color, color: "#fff",
                    borderRadius: 50, padding: "2px 10px",
                    fontSize: ".72rem", fontWeight: 700, display: "inline-block",
                }}>
                    ✓ Selected
                </div>
            )}
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
        width: "100%", maxWidth: 460, background: "#fff",
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
    sub: { textAlign: "center", color: "#888", marginBottom: 20, fontSize: ".9rem" },

    roleLabel: { fontWeight: 700, fontSize: ".9rem", marginBottom: 10, color: "#555" },
    roleRow: { display: "flex", gap: 12, marginBottom: 12 },

    ownerNote: {
        background: "#f0fdf4", border: "1px solid #86efac",
        borderRadius: 10, padding: "8px 12px", marginBottom: 16,
        fontSize: ".78rem", color: "#166534", textAlign: "center",
    },

    errorBox: {
        background: "#fff0ee", border: "2px solid #e63329",
        borderRadius: 12, padding: "10px 14px", marginBottom: 14,
        color: "#e63329", fontWeight: 700, fontSize: ".85rem",
    },
    fieldLabel: { display: "block", fontWeight: 700, marginBottom: 5, fontSize: ".88rem" },
    input: {
        width: "100%", padding: "11px 16px",
        border: "2px solid #e5e7eb", borderRadius: 12,
        fontFamily: "Nunito,sans-serif", fontSize: "1rem", outline: "none",
    },
    submitBtn: {
        width: "100%", padding: 14, color: "#fff", border: "none",
        borderRadius: 50, fontFamily: "'Boogaloo',cursive",
        fontSize: "1.3rem", cursor: "pointer", marginTop: 8,
    },
    switchText: { textAlign: "center", marginTop: 16, fontSize: ".9rem", color: "#888" },
    link: { color: "#e63329", fontWeight: 700, cursor: "pointer" },
};
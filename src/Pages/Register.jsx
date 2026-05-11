// ════════════════════════════════════════════════════════
//  Register.jsx
//  Paste over your existing Register.jsx
//
//  🔧 Only change: keep YOUR registerUser() API call logic
// ════════════════════════════════════════════════════════
import { useState } from "react";
import { useNavigate } from "react-router-dom";
// 👇 Keep YOUR existing api import
import { registerUser } from "../api";

export default function Register() {
    const [form, setForm] = useState({
        name: "", phone: "", address: "", email: "", password: "", confirmPassword: "",
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const navigate = useNavigate();

    const set = key => e => setForm(f => ({ ...f, [key]: e.target.value }));

    async function handleRegister() {
        if (!form.name || !form.phone || !form.address || !form.password) {
            setError("Please fill all required fields");
            return;
        }
        if (form.password !== form.confirmPassword) {
            setError("Passwords do not match");
            return;
        }
        setLoading(true);
        setError("");
        try {
            // 👇 Keep YOUR existing register API call
            const data = await registerUser(form);
            localStorage.setItem("token", data.token || data.access_token);
            localStorage.setItem("user", JSON.stringify(data.user));
            navigate("/");
        } catch (err) {
            setError(err.message || "Registration failed");
        } finally {
            setLoading(false);
        }
    }

    const fields = [
        { label: "Full Name *", key: "name", type: "text", ph: "John Doe" },
        { label: "Phone Number *", key: "phone", type: "text", ph: "+880 17..." },
        { label: "Delivery Address *", key: "address", type: "text", ph: "House 12, Road 5, Dhaka" },
        { label: "Email (optional)", key: "email", type: "email", ph: "your@email.com" },
        { label: "Password *", key: "password", type: "password", ph: "••••••••" },
        { label: "Confirm Password *", key: "confirmPassword", type: "password", ph: "••••••••" },
    ];

    return (
        <div style={styles.page}>
            <div style={styles.card}>
                <h2 style={styles.heading}>Create Account 🎉</h2>
                <p style={styles.sub}>Join PizzaFizz and start building!</p>

                {error && <div style={styles.errorBox}>⚠️ {error}</div>}

                {fields.map(({ label, key, type, ph }) => (
                    <div key={key} style={{ marginBottom: 14 }}>
                        <label style={{ display: "block", fontWeight: 700, marginBottom: 5, fontSize: ".9rem" }}>
                            {label}
                        </label>
                        <input
                            type={type}
                            value={form[key]}
                            onChange={set(key)}
                            placeholder={ph}
                            style={styles.input}
                            onFocus={e => (e.target.style.borderColor = "#e63329")}
                            onBlur={e => (e.target.style.borderColor = "#e5e7eb")}
                        />
                    </div>
                ))}

                <button onClick={handleRegister} disabled={loading} style={styles.submitBtn}>
                    {loading ? "Creating…" : "Create Account 🍕"}
                </button>

                <p style={styles.switchText}>
                    Already have an account?{" "}
                    <span onClick={() => navigate("/login")} style={styles.link}>Sign in</span>
                </p>
            </div>
        </div>
    );
}

const styles = {
    page: {
        minHeight: "calc(100vh - 68px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "40px 16px",
    },
    card: {
        width: "100%", maxWidth: 440, background: "#fff",
        borderRadius: 24, padding: 40, boxShadow: "0 8px 40px rgba(0,0,0,.1)",
    },
    heading: { fontFamily: "'Boogaloo', cursive", fontSize: "2rem", color: "#e63329", marginBottom: 6 },
    sub: { color: "#888", marginBottom: 20, fontSize: ".95rem" },
    errorBox: {
        background: "#fff0ee", border: "2px solid #e63329", borderRadius: 12,
        padding: "10px 16px", marginBottom: 16, color: "#e63329", fontWeight: 700, fontSize: ".9rem",
    },
    input: {
        width: "100%", padding: "11px 16px", border: "2px solid #e5e7eb",
        borderRadius: 12, fontFamily: "Nunito,sans-serif", fontSize: "1rem", outline: "none",
    },
    submitBtn: {
        width: "100%", padding: 14, background: "#e63329", color: "#fff", border: "none",
        borderRadius: 50, fontFamily: "'Boogaloo', cursive", fontSize: "1.3rem",
        cursor: "pointer", marginTop: 8,
    },
    switchText: { textAlign: "center", marginTop: 16, fontSize: ".9rem", color: "#888" },
    link: { color: "#e63329", fontWeight: 700, cursor: "pointer" },
};
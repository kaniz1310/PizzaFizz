// src/components/Navbar.jsx
// Shows different links based on role:
// Customer → My Orders
// Rider    → My Deliveries
// Owner    → Dashboard

import { useNavigate } from "react-router-dom";
import { useCart } from "../Context/CartContext";

export default function Navbar() {
    const { cartCount } = useCart();
    const navigate = useNavigate();
    const user = JSON.parse(localStorage.getItem("user") || "null");

    function handleLogout() {
        localStorage.removeItem("user");
        localStorage.removeItem("token");
        window.dispatchEvent(new Event("pizzafizz-auth"));
        navigate("/login");
    }

    // Role-specific colors
    const roleColor = {
        customer: "#e63329",
        rider: "#3b82f6",
        owner: "#7c2d12",
        admin: "#7c2d12",
    };
    const headerBg = user ? (roleColor[user.role] || "#e63329") : "#e63329";

    return (
        <header style={{ ...styles.header, background: headerBg }}>

            {/* Logo */}
            <div onClick={() => navigate("/")} style={styles.logo}>
                Pizza<span style={{ color: "#fbbf24" }}>Fizz</span> 🍕
                {/* Role tag */}
                {user && (
                    <span style={styles.roleTag}>
                        {user.role === "customer" ? "🧑" : user.role === "rider" ? "🛵" : "👨‍🍳"}
                    </span>
                )}
            </div>

            <div style={styles.right}>

                {user && (
                    <span style={styles.greeting}>Hi, {user.name?.split(" ")[0]}!</span>
                )}

                {/* ── Customer links ── */}
                {user?.role === "customer" && (
                    <>
                        <button onClick={() => navigate("/cart")} style={styles.cartBtn}>
                            🛒 Cart <span style={styles.badge}>{cartCount}</span>
                        </button>
                        <button onClick={() => navigate("/my-orders")} style={styles.outlineBtn}>
                            🧾 My Orders
                        </button>
                        <button onClick={() => navigate("/menu")} style={styles.outlineBtn}>
                            🍕 Menu
                        </button>
                    </>
                )}

                {/* ── Rider links ── */}
                {user?.role === "rider" && (
                    <>
                        <button onClick={() => navigate("/rider/dashboard")} style={{
                            ...styles.outlineBtn,
                            background: "rgba(255,255,255,.15)",
                        }}>
                            🛵 Dashboard
                        </button>
                        <button onClick={() => navigate("/rider/dashboard")} style={styles.cartBtn}>
                            📦 My Deliveries
                        </button>
                    </>
                )}

                {/* ── Owner links ── */}
                {(user?.role === "owner" || user?.role === "admin") && (
                    <>
                        <button onClick={() => navigate("/admin")} style={styles.cartBtn}>
                            👨‍🍳 Dashboard
                        </button>
                    </>
                )}

                {/* ── Not logged in ── */}
                {!user && (
                    <>
                        <button onClick={() => navigate("/cart")} style={styles.cartBtn}>
                            🛒 Cart <span style={styles.badge}>{cartCount}</span>
                        </button>
                        <button onClick={() => navigate("/login")} style={styles.outlineBtn}>
                            Sign In
                        </button>
                        <button
                            onClick={() => navigate("/register")}
                            style={{ ...styles.outlineBtn, background: "#fbbf24", color: "#1c0a00", border: "none" }}
                        >
                            Register
                        </button>
                    </>
                )}

                {/* Sign out (always when logged in) */}
                {user && (
                    <button onClick={handleLogout} style={styles.outlineBtn}>
                        Sign Out
                    </button>
                )}
            </div>
        </header>
    );
}

const styles = {
    header: {
        padding: "14px 24px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        boxShadow: "0 4px 0 rgba(0,0,0,.2)",
        position: "sticky", top: 0, zIndex: 100,
        transition: "background .3s",
    },
    logo: {
        fontFamily: "'Boogaloo',cursive",
        fontSize: "1.8rem", color: "#fff",
        cursor: "pointer", userSelect: "none",
        display: "flex", alignItems: "center", gap: 8,
    },
    roleTag: {
        background: "rgba(255,255,255,.2)",
        borderRadius: 50, padding: "2px 10px",
        fontSize: ".9rem",
    },
    right: { display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" },
    greeting: { color: "rgba(255,255,255,.85)", fontWeight: 700, fontSize: ".88rem" },
    cartBtn: {
        background: "#fbbf24", color: "#1c0a00", border: "none",
        borderRadius: 50, padding: "8px 16px", cursor: "pointer",
        fontFamily: "Nunito,sans-serif", fontWeight: 800, fontSize: ".88rem",
        display: "flex", alignItems: "center", gap: 5,
    },
    badge: {
        background: "#1c0a00", color: "#fff", borderRadius: "50%",
        width: 20, height: 20, display: "flex",
        alignItems: "center", justifyContent: "center",
        fontSize: ".7rem", fontWeight: 700,
    },
    outlineBtn: {
        background: "transparent", border: "2px solid rgba(255,255,255,.7)",
        color: "#fff", borderRadius: 50, padding: "7px 14px",
        cursor: "pointer", fontFamily: "Nunito,sans-serif",
        fontWeight: 700, fontSize: ".85rem",
    },
};
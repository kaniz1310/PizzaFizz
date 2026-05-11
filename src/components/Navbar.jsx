// src/components/Navbar.jsx
import { useNavigate } from "react-router-dom";
import { useCart } from "../Context/CartContext";

export default function Navbar() {
    const { cartCount } = useCart();
    const navigate = useNavigate();

    const user = JSON.parse(localStorage.getItem("user") || "null");

    function handleLogout() {
        localStorage.removeItem("user");
        localStorage.removeItem("token");
        navigate("/login");
    }

    return (
        <header style={styles.header}>
            {/* Logo */}
            <div onClick={() => navigate("/")} style={styles.logo}>
                Pizza<span style={{ color: "#fbbf24" }}>Fizz</span> 🍕
            </div>

            {/* Right side */}
            <div style={styles.right}>
                {user && (
                    <span style={styles.greeting}>
                        Hi, {user.name?.split(" ")[0]}!
                    </span>
                )}

                {/* Cart — always visible */}
                <button onClick={() => navigate("/cart")} style={styles.cartBtn}>
                    🛒 Cart
                    <span style={styles.badge}>{cartCount}</span>
                </button>

                {user ? (
                    <>
                        {/* Customer links */}
                        {user.role === "customer" && (
                            <button
                                onClick={() => navigate("/my-orders")}
                                style={styles.outlineBtn}
                            >
                                🧾 My Orders
                            </button>
                        )}

                        {/* Owner dashboard link */}
                        {(user.role === "owner" || user.role === "admin") && (
                            <button
                                onClick={() => navigate("/admin")}
                                style={styles.outlineBtn}
                            >
                                👨‍🍳 Dashboard
                            </button>
                        )}

                        <button onClick={handleLogout} style={styles.outlineBtn}>
                            Sign Out
                        </button>
                    </>
                ) : (
                    <>
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
            </div>
        </header>
    );
}

const styles = {
    header: {
        background: "#e63329",
        padding: "14px 32px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        boxShadow: "0 4px 0 #7c2d12",
        position: "sticky", top: 0, zIndex: 100,
    },
    logo: {
        fontFamily: "'Boogaloo', cursive",
        fontSize: "2rem", color: "#fff",
        cursor: "pointer", userSelect: "none",
    },
    right: {
        display: "flex", gap: 8,
        alignItems: "center", flexWrap: "wrap",
    },
    greeting: {
        color: "rgba(255,255,255,.85)",
        fontWeight: 700, fontSize: ".9rem",
    },
    cartBtn: {
        background: "#fbbf24", color: "#1c0a00", border: "none",
        borderRadius: 50, padding: "8px 18px", cursor: "pointer",
        fontFamily: "Nunito, sans-serif", fontWeight: 800, fontSize: ".9rem",
        display: "flex", alignItems: "center", gap: 6,
    },
    badge: {
        background: "#1c0a00", color: "#fff", borderRadius: "50%",
        width: 22, height: 22, display: "flex",
        alignItems: "center", justifyContent: "center",
        fontSize: ".72rem", fontWeight: 700,
    },
    outlineBtn: {
        background: "transparent", border: "2px solid #fff",
        color: "#fff", borderRadius: 50, padding: "8px 16px",
        cursor: "pointer", fontFamily: "Nunito, sans-serif",
        fontWeight: 700, fontSize: ".85rem",
    },
};
// src/Pages/Confirm.jsx
import { useLocation, useNavigate } from "react-router-dom";

export default function Confirm() {
    const navigate = useNavigate();
    const location = useLocation();
    const order = location.state?.order;

    return (
        <div style={styles.page}>
            <div style={styles.card}>

                {/* Success icon */}
                <div style={styles.successCircle}>✅</div>
                <h2 style={styles.heading}>Order Placed!</h2>
                <p style={styles.sub}>
                    We received your order and are preparing it now.
                </p>

                {/* Order ID */}
                {order && (
                    <div style={styles.orderIdBox}>
                        Order <strong>#{order.id}</strong>
                    </div>
                )}

                {/* Order details */}
                {order && (
                    <div style={styles.detailsBox}>
                        <h4 style={styles.detailsTitle}>📋 Order Details</h4>
                        {order.items?.map((item, i) => (
                            <div key={i} style={styles.detailItem}>
                                <span>🍕 {item.qty}× {item.size} ({item.crust} crust, {item.sauce} sauce
                                    {item.toppings?.length
                                        ? " + " + item.toppings.map(t => t.label || t).join(", ")
                                        : ""})
                                </span>
                                <span style={{ fontWeight: 700 }}>৳{item.price * item.qty}</span>
                            </div>
                        ))}
                        <div style={styles.detailTotal}>
                            <span>Delivery</span>
                            <span>৳{order.delivery || 50}</span>
                        </div>
                        <div style={{ ...styles.detailTotal, fontSize: "1.1rem", color: "#e63329" }}>
                            <span><strong>Total</strong></span>
                            <span><strong>৳{order.total}</strong></span>
                        </div>
                    </div>
                )}

                {/* Status tracker */}
                <div style={styles.tracker}>
                    <div style={styles.trackerLine} />
                    {[
                        { icon: "✅", label: "Confirmed", done: true },
                        { icon: "👨‍🍳", label: "Preparing", active: true },
                        { icon: "🛵", label: "On the Way" },
                        { icon: "🏠", label: "Delivered" },
                    ].map(({ icon, label, done, active }) => (
                        <div key={label} style={styles.step}>
                            <div style={{
                                ...styles.dot,
                                background: done ? "#16a34a" : active ? "#f97316" : "#e5e7eb",
                                animation: active ? "pulse 1.4s ease-in-out infinite" : "none",
                            }}>
                                {icon}
                            </div>
                            <div style={styles.stepLabel}>{label}</div>
                        </div>
                    ))}
                </div>

                <p style={styles.eta}>
                    Estimated delivery: <strong>30–45 minutes</strong>
                </p>

                <div style={{ display: "flex", gap: 12, marginTop: 20 }}>
                    <button onClick={() => navigate("/customize")} style={styles.yellowBtn}>
                        🍕 Order More
                    </button>
                    <button onClick={() => navigate("/")} style={styles.outlineBtn}>
                        🏠 Home
                    </button>
                </div>
            </div>

            <style>{`
        @keyframes pulse {
          0%,100% { box-shadow: 0 0 0 0 rgba(249,115,22,.4); }
          50%      { box-shadow: 0 0 0 12px rgba(249,115,22,0); }
        }
        @keyframes pop {
          0%  { transform: scale(0) rotate(-10deg); }
          70% { transform: scale(1.15) rotate(3deg); }
          100%{ transform: scale(1) rotate(0); }
        }
      `}</style>
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
        width: "100%", maxWidth: 540, background: "#fff",
        borderRadius: 24, padding: 40,
        boxShadow: "0 8px 40px rgba(0,0,0,.1)", textAlign: "center",
    },
    successCircle: {
        fontSize: "4rem", display: "block",
        marginBottom: 12, animation: "pop .5s ease-out",
    },
    heading: { fontFamily: "'Boogaloo',cursive", fontSize: "2.2rem", color: "#16a34a" },
    sub: { color: "#888", margin: "8px 0 16px" },

    orderIdBox: {
        background: "#f0fdf4", border: "2px solid #16a34a",
        borderRadius: 12, padding: "10px 20px",
        fontFamily: "'Boogaloo',cursive", fontSize: "1.2rem",
        color: "#16a34a", display: "inline-block", marginBottom: 20,
    },

    detailsBox: {
        background: "#fff8f0", border: "2px solid #fbbf24",
        borderRadius: 16, padding: 16, marginBottom: 24, textAlign: "left",
    },
    detailsTitle: {
        fontFamily: "'Boogaloo',cursive", fontSize: "1.1rem",
        color: "#7c2d12", marginBottom: 10,
    },
    detailItem: {
        display: "flex", justifyContent: "space-between",
        fontSize: ".85rem", color: "#444", marginBottom: 6,
        paddingBottom: 6, borderBottom: "1px solid #fde68a",
    },
    detailTotal: {
        display: "flex", justifyContent: "space-between",
        fontSize: ".95rem", color: "#666", marginTop: 8,
    },

    tracker: {
        display: "flex", justifyContent: "space-between",
        margin: "24px 0 8px", position: "relative",
    },
    trackerLine: {
        position: "absolute", top: 22, left: 0, right: 0,
        height: 3, background: "#e5e7eb", zIndex: 0,
    },
    step: { flex: 1, textAlign: "center", position: "relative", zIndex: 1 },
    dot: {
        width: 44, height: 44, borderRadius: "50%",
        margin: "0 auto 6px",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: "1.3rem",
    },
    stepLabel: { fontSize: ".72rem", fontWeight: 700, color: "#888" },
    eta: { fontSize: ".85rem", color: "#aaa" },

    yellowBtn: {
        flex: 1, padding: "12px 0",
        background: "#fbbf24", color: "#1c0a00", border: "none",
        borderRadius: 50, fontFamily: "'Boogaloo',cursive",
        fontSize: "1.1rem", cursor: "pointer",
    },
    outlineBtn: {
        flex: 1, padding: "12px 0",
        background: "transparent", color: "#e63329",
        border: "2px solid #e63329", borderRadius: 50,
        fontFamily: "'Boogaloo',cursive", fontSize: "1.1rem", cursor: "pointer",
    },
};
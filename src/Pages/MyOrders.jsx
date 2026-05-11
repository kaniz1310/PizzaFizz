// src/Pages/MyOrders.jsx
// Customer's personal order history page
// Route: /my-orders
// Shows all past orders with current status + live updates via WebSocket

import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { fetchOrders } from "../api";

// Status config
const STATUS = {
    New: { color: "#b45309", bg: "#fef3c7", icon: "🆕", label: "New" },
    Making: { color: "#1d4ed8", bg: "#dbeafe", icon: "👨‍🍳", label: "Making" },
    Ready: { color: "#065f46", bg: "#d1fae5", icon: "✅", label: "Ready" },
    Delivered: { color: "#374151", bg: "#f3f4f6", icon: "🏠", label: "Delivered" },
};

// Progress steps shown on each order card
const STEPS = ["New", "Making", "Ready", "Delivered"];

export default function MyOrders() {
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const navigate = useNavigate();
    const wsRef = useRef(null);

    const user = JSON.parse(localStorage.getItem("user") || "null");
    const token = localStorage.getItem("token");

    // ── Redirect if not logged in ──────────────────────
    useEffect(() => {
        if (!user || !token) {
            navigate("/login");
        }
    }, []);

    // ── Fetch orders from backend ───────────────────────
    useEffect(() => {
        async function load() {
            setLoading(true);
            try {
                const data = await fetchOrders(token);
                setOrders(data);
            } catch (err) {
                setError(err.message || "Failed to load orders");
            } finally {
                setLoading(false);
            }
        }
        if (token) load();
    }, [token]);

    // ── WebSocket — live status updates ────────────────
    useEffect(() => {
        function connect() {
            const ws = new WebSocket("ws://127.0.0.1:8000/ws");
            wsRef.current = ws;

            ws.onmessage = (event) => {
                const msg = JSON.parse(event.data);
                if (msg.type === "ORDER_UPDATE") {
                    // Update the status of this order in real time
                    setOrders(prev =>
                        prev.map(o =>
                            o.id === msg.order_id ? { ...o, status: msg.status } : o
                        )
                    );
                }
            };

            ws.onclose = () => setTimeout(connect, 3000);
        }
        connect();
        return () => wsRef.current?.close();
    }, []);

    if (!user) return null;

    return (
        <div style={styles.wrap}>

            {/* Header */}
            <div style={styles.header}>
                <div>
                    <h2 style={styles.title}>🧾 My Orders</h2>
                    <p style={styles.sub}>Track all your pizza orders in real time</p>
                </div>
                <button onClick={() => navigate("/customize")} style={styles.buildBtn}>
                    + Build New Pizza
                </button>
            </div>

            {/* Loading */}
            {loading && (
                <div style={styles.centerBox}>
                    <div style={{ fontSize: "3rem", marginBottom: 12 }}>⏳</div>
                    <p style={{ color: "#888" }}>Loading your orders…</p>
                </div>
            )}

            {/* Error */}
            {error && (
                <div style={styles.errorBox}>⚠️ {error}</div>
            )}

            {/* Empty state */}
            {!loading && !error && orders.length === 0 && (
                <div style={styles.centerBox}>
                    <div style={{ fontSize: "5rem", marginBottom: 16 }}>🍕</div>
                    <h3 style={styles.emptyTitle}>No orders yet!</h3>
                    <p style={{ color: "#aaa", marginBottom: 20 }}>
                        You haven't placed any orders yet.
                    </p>
                    <button onClick={() => navigate("/customize")} style={styles.buildBtn}>
                        Build Your First Pizza
                    </button>
                </div>
            )}

            {/* Orders list */}
            {orders.map(order => (
                <OrderCard key={order.id} order={order} />
            ))}

        </div>
    );
}

// ── Single order card ─────────────────────────────────
function OrderCard({ order }) {
    const s = STATUS[order.status] || STATUS.New;
    const currentStep = STEPS.indexOf(order.status);

    return (
        <div style={styles.card}>

            {/* Top row — order ID + status badge */}
            <div style={styles.cardTop}>
                <div>
                    <span style={styles.orderId}>#{order.id}</span>
                    <span style={styles.orderDate}>{order.created_at}</span>
                </div>
                <span style={{
                    ...styles.badge,
                    background: s.bg,
                    color: s.color,
                }}>
                    {s.icon} {s.label}
                </span>
            </div>

            {/* Progress bar */}
            <div style={styles.progressWrap}>
                {/* Background line */}
                <div style={styles.progressLine} />
                {/* Filled line */}
                <div style={{
                    ...styles.progressFill,
                    width: `${(currentStep / (STEPS.length - 1)) * 100}%`,
                }} />
                {/* Steps */}
                {STEPS.map((step, i) => {
                    const done = i <= currentStep;
                    const active = i === currentStep;
                    return (
                        <div key={step} style={styles.stepWrap}>
                            <div style={{
                                ...styles.stepDot,
                                background: done ? "#e63329" : "#e5e7eb",
                                transform: active ? "scale(1.3)" : "scale(1)",
                                boxShadow: active ? "0 0 0 4px rgba(230,51,41,.2)" : "none",
                            }}>
                                {done ? "✓" : ""}
                            </div>
                            <div style={{
                                ...styles.stepLabel,
                                color: done ? "#e63329" : "#aaa",
                                fontWeight: active ? 800 : 400,
                            }}>
                                {step}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Items */}
            <div style={styles.itemsBox}>
                {(order.items || []).map((item, i) => (
                    <div key={i} style={styles.itemRow}>
                        <span>
                            🍕 {item.qty}× <strong>{item.size}</strong> —{" "}
                            {item.crust} crust, {item.sauce} sauce
                            {item.toppings?.length
                                ? " + " + item.toppings.map(t => t.label || t).join(", ")
                                : ""}
                        </span>
                        <span style={styles.itemPrice}>৳{item.price * item.qty}</span>
                    </div>
                ))}
            </div>

            {/* Footer — total + delivery info */}
            <div style={styles.cardFooter}>
                <div style={styles.deliveryInfo}>
                    <span>📍 {order.customer_address}</span>
                </div>
                <div style={styles.totalBox}>
                    <span style={{ fontSize: ".85rem", color: "rgba(255,255,255,.8)" }}>
                        Subtotal ৳{order.subtotal} + Delivery ৳{order.delivery || 50}
                    </span>
                    <span style={styles.totalAmount}>৳{order.total}</span>
                </div>
            </div>

            {/* Status message */}
            <div style={{
                ...styles.statusMsg,
                background: s.bg,
                color: s.color,
            }}>
                {order.status === "New" && "⏳ Your order has been received! We'll start preparing it shortly."}
                {order.status === "Making" && "👨‍🍳 Your pizza is being freshly made right now!"}
                {order.status === "Ready" && "✅ Your pizza is ready and on its way to you!"}
                {order.status === "Delivered" && "🏠 Order delivered! Enjoy your pizza! 🍕"}
            </div>

        </div>
    );
}

// ── Styles ────────────────────────────────────────────
const styles = {
    wrap: { maxWidth: 750, margin: "0 auto", padding: "32px 16px" },

    header: {
        display: "flex", justifyContent: "space-between",
        alignItems: "flex-start", marginBottom: 28, flexWrap: "wrap", gap: 12,
    },
    title: {
        fontFamily: "'Boogaloo', cursive",
        fontSize: "2.2rem", color: "#e63329", marginBottom: 4,
    },
    sub: { color: "#888", fontSize: ".95rem" },
    buildBtn: {
        background: "#e63329", color: "#fff", border: "none",
        borderRadius: 50, padding: "10px 22px", cursor: "pointer",
        fontFamily: "Nunito, sans-serif", fontWeight: 700, fontSize: ".9rem",
    },

    centerBox: {
        textAlign: "center", padding: "60px 20px",
        display: "flex", flexDirection: "column", alignItems: "center",
    },
    emptyTitle: {
        fontFamily: "'Boogaloo', cursive",
        fontSize: "1.8rem", color: "#555", marginBottom: 8,
    },
    errorBox: {
        background: "#fff0ee", border: "2px solid #e63329",
        borderRadius: 12, padding: "12px 16px", marginBottom: 20,
        color: "#e63329", fontWeight: 700,
    },

    // Order card
    card: {
        background: "#fff", borderRadius: 20, marginBottom: 20,
        boxShadow: "0 4px 20px rgba(0,0,0,.08)", overflow: "hidden",
    },
    cardTop: {
        display: "flex", justifyContent: "space-between",
        alignItems: "center", padding: "16px 20px",
        borderBottom: "1px solid #f3f4f6",
    },
    orderId: {
        fontFamily: "'Boogaloo', cursive",
        fontSize: "1.2rem", color: "#1c0a00", marginRight: 10,
    },
    orderDate: { fontSize: ".8rem", color: "#aaa" },
    badge: {
        padding: "4px 14px", borderRadius: 50,
        fontSize: ".82rem", fontWeight: 800,
    },

    // Progress tracker
    progressWrap: {
        display: "flex", justifyContent: "space-between",
        alignItems: "flex-start", padding: "20px 24px 8px",
        position: "relative",
    },
    progressLine: {
        position: "absolute", top: 30, left: 44, right: 44,
        height: 3, background: "#e5e7eb", zIndex: 0,
    },
    progressFill: {
        position: "absolute", top: 30, left: 44,
        height: 3, background: "#e63329",
        zIndex: 1, transition: "width .5s ease",
    },
    stepWrap: {
        flex: 1, display: "flex", flexDirection: "column",
        alignItems: "center", position: "relative", zIndex: 2,
    },
    stepDot: {
        width: 28, height: 28, borderRadius: "50%",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: ".75rem", color: "#fff", fontWeight: 800,
        transition: "all .3s",
    },
    stepLabel: {
        fontSize: ".72rem", marginTop: 6, textAlign: "center",
        transition: "all .3s",
    },

    // Items
    itemsBox: {
        padding: "12px 20px",
        background: "#fff8f0",
        borderTop: "1px solid #fde68a",
        borderBottom: "1px solid #fde68a",
    },
    itemRow: {
        display: "flex", justifyContent: "space-between",
        fontSize: ".85rem", color: "#444",
        padding: "4px 0", borderBottom: "1px dashed #fde68a",
    },
    itemPrice: { fontWeight: 700, color: "#e63329", whiteSpace: "nowrap", marginLeft: 8 },

    // Footer
    cardFooter: {
        background: "linear-gradient(135deg, #e63329, #f97316)",
        padding: "14px 20px", color: "#fff",
    },
    deliveryInfo: { fontSize: ".82rem", opacity: .85, marginBottom: 6 },
    totalBox: {
        display: "flex", justifyContent: "space-between",
        alignItems: "center", flexWrap: "wrap", gap: 4,
    },
    totalAmount: {
        fontFamily: "'Boogaloo', cursive", fontSize: "1.5rem",
    },

    // Status message
    statusMsg: {
        padding: "10px 20px", fontSize: ".85rem", fontWeight: 700,
        textAlign: "center",
    },
};
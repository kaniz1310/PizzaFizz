// src/Pages/MyOrders.jsx
import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { fetchOrders } from "../api";

const STATUS_CONFIG = {
    "New": { color: "#b45309", bg: "#fef3c7", icon: "🆕", label: "New", msg: "⏳ Order received! We'll start soon." },
    "Making": { color: "#1d4ed8", bg: "#dbeafe", icon: "👨‍🍳", label: "Making", msg: "👨‍🍳 Your pizza is being made fresh!" },
    "Ready": { color: "#065f46", bg: "#d1fae5", icon: "✅", label: "Ready", msg: "✅ Ready! Waiting for rider pickup." },
    "Out for Delivery": { color: "#e63329", bg: "#fff0ee", icon: "🛵", label: "Out for Delivery", msg: "🛵 Rider is on the way to you!" },
    "Delivered": { color: "#374151", bg: "#f3f4f6", icon: "🏠", label: "Delivered", msg: "🏠 Delivered! Enjoy your pizza! 🍕" },
};
const STEPS = ["New", "Making", "Ready", "Out for Delivery", "Delivered"];

export default function MyOrders() {
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [toast, setToast] = useState(null);
    const [wsStatus, setWsStatus] = useState("connecting");
    const [updatedIds, setUpdatedIds] = useState(new Set());
    const navigate = useNavigate();
    const wsRef = useRef(null);

    const user = JSON.parse(localStorage.getItem("user") || "null");
    const token = localStorage.getItem("token");

    useEffect(() => { if (!user || !token) navigate("/login"); }, []);

    useEffect(() => {
        async function load() {
            setLoading(true);
            try { setOrders(await fetchOrders(token)); }
            catch (err) { setError(err.message); }
            finally { setLoading(false); }
        }
        if (token) load();
    }, [token]);

    function showToast(msg, color = "#1c0a00") {
        setToast({ msg, color });
        setTimeout(() => setToast(null), 4000);
    }

    function flashOrder(id) {
        setUpdatedIds(prev => new Set([...prev, id]));
        setTimeout(() => setUpdatedIds(prev => { const n = new Set(prev); n.delete(id); return n; }), 2500);
    }

    useEffect(() => {
        function connect() {
            const ws = new WebSocket("ws://127.0.0.1:8000/ws");
            wsRef.current = ws;
            ws.onopen = () => setWsStatus("live");
            ws.onmessage = (e) => {
                const msg = JSON.parse(e.data);
                if (msg.type === "ORDER_UPDATE" || msg.type === "RIDER_ASSIGNED") {
                    const oid = msg.order_id || msg.order?.id;
                    const status = msg.status || msg.order?.status;
                    setOrders(prev => prev.map(o => o.id === oid ? { ...o, status, rider_name: msg.order?.rider_name || o.rider_name } : o));
                    flashOrder(oid);
                    const cfg = STATUS_CONFIG[status];
                    if (cfg) showToast(`Order #${oid}: ${cfg.msg}`, cfg.color);
                }
            };
            ws.onclose = () => { setWsStatus("offline"); setTimeout(connect, 3000); };
        }
        connect();
        return () => wsRef.current?.close();
    }, []);

    if (!user) return null;

    return (
        <div style={{ background: "#fff8f0", minHeight: "calc(100vh - 68px)" }}>
            <div style={{ maxWidth: 750, margin: "0 auto", padding: "32px 16px" }}>

                {/* Header */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28, flexWrap: "wrap", gap: 12 }}>
                    <div>
                        <h2 style={styles.title}>🧾 My Orders</h2>
                        <p style={{ color: "#888", fontSize: ".9rem" }}>Live status updates — no refresh needed</p>
                    </div>
                    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                        <div style={styles.wsChip}>
                            <span style={{ width: 9, height: 9, borderRadius: "50%", display: "inline-block", background: wsStatus === "live" ? "#16a34a" : "#dc2626", marginRight: 6 }} />
                            {wsStatus === "live" ? "🔴 Live" : "Offline"}
                        </div>
                        <button onClick={() => navigate("/customize")} style={styles.buildBtn}>+ New Pizza</button>
                    </div>
                </div>

                {loading && <div style={{ textAlign: "center", padding: 40, color: "#888" }}>⏳ Loading…</div>}
                {error && <div style={styles.errorBox}>⚠️ {error}</div>}

                {!loading && !error && orders.length === 0 && (
                    <div style={{ textAlign: "center", padding: "60px 20px" }}>
                        <div style={{ fontSize: "5rem", marginBottom: 12 }}>🍕</div>
                        <h3 style={{ fontFamily: "'Boogaloo',cursive", fontSize: "1.8rem", color: "#555" }}>No orders yet!</h3>
                        <button onClick={() => navigate("/customize")} style={styles.buildBtn}>Build Your First Pizza</button>
                    </div>
                )}

                {orders.map(order => (
                    <OrderCard
                        key={order.id}
                        order={order}
                        isFlashing={updatedIds.has(order.id)}
                        onTrack={() => navigate(`/track/${order.id}`)}
                    />
                ))}
            </div>

            {/* Toast */}
            <div style={{
                position: "fixed", bottom: 28, left: "50%",
                background: toast?.color || "#1c0a00", color: "#fff",
                padding: "14px 28px", borderRadius: 50,
                fontWeight: 700, fontSize: ".92rem", zIndex: 999,
                transition: "transform .35s ease", pointerEvents: "none",
                boxShadow: "0 4px 20px rgba(0,0,0,.25)",
                transform: toast ? "translateX(-50%) translateY(0)" : "translateX(-50%) translateY(120px)",
            }}>
                {toast?.msg}
            </div>
        </div>
    );
}

function OrderCard({ order, isFlashing, onTrack }) {
    const s = STATUS_CONFIG[order.status] || STATUS_CONFIG["New"];
    const currentStep = STEPS.indexOf(order.status);

    return (
        <div style={{
            background: "#fff", borderRadius: 20, marginBottom: 20,
            boxShadow: "0 4px 20px rgba(0,0,0,.08)", overflow: "hidden",
            border: isFlashing ? `2px solid ${s.color}` : "2px solid transparent",
            transition: "border .3s",
        }}>
            {/* Top */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px", borderBottom: "1px solid #f3f4f6" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontFamily: "'Boogaloo',cursive", fontSize: "1.2rem", color: "#1c0a00" }}>#{order.id}</span>
                    <span style={{ fontSize: ".78rem", color: "#bbb" }}>{order.created_at}</span>
                </div>
                <span style={{ padding: "4px 14px", borderRadius: 50, fontSize: ".82rem", fontWeight: 800, background: s.bg, color: s.color }}>
                    {s.icon} {s.label}
                </span>
            </div>

            {/* Rider info if assigned */}
            {order.rider_name && (
                <div style={{ background: "#fff0ee", padding: "8px 20px", fontSize: ".85rem", color: "#e63329", fontWeight: 700 }}>
                    🛵 Your rider: <strong>{order.rider_name}</strong>
                </div>
            )}

            {/* Progress */}
            <div style={{ padding: "20px 24px 8px", position: "relative", display: "flex", justifyContent: "space-between" }}>
                <div style={{ position: "absolute", top: 30, left: 44, right: 44, height: 3, background: "#e5e7eb", zIndex: 0 }} />
                <div style={{ position: "absolute", top: 30, left: 44, height: 3, background: s.color, zIndex: 1, transition: "width .6s ease", width: `${Math.max(0, (currentStep / (STEPS.length - 1)) * 100)}%` }} />
                {STEPS.map((step, i) => {
                    const done = i <= currentStep;
                    const active = i === currentStep;
                    return (
                        <div key={step} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", zIndex: 2 }}>
                            <div style={{ width: 26, height: 26, borderRadius: "50%", background: done ? s.color : "#e5e7eb", display: "flex", alignItems: "center", justifyContent: "center", fontSize: ".7rem", color: "#fff", fontWeight: 800, transform: active ? "scale(1.3)" : "scale(1)", transition: "all .4s", boxShadow: active ? `0 0 0 5px ${s.bg}` : "none" }}>
                                {done ? "✓" : ""}
                            </div>
                            <div style={{ fontSize: ".62rem", marginTop: 6, color: done ? s.color : "#bbb", fontWeight: active ? 800 : 500, textAlign: "center" }}>
                                {step}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Items */}
            <div style={{ padding: "10px 20px", background: "#fff8f0", borderTop: "1px solid #fde68a", borderBottom: "1px solid #fde68a" }}>
                {(order.items || []).map((item, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: ".83rem", color: "#444", padding: "4px 0", borderBottom: "1px dashed #fde68a" }}>
                        <span>🍕 {item.qty}× {item.size} — {item.crust} crust, {item.sauce} sauce</span>
                        <span style={{ fontWeight: 700, color: "#e63329" }}>৳{item.price * item.qty}</span>
                    </div>
                ))}
            </div>

            {/* Footer */}
            <div style={{ background: "linear-gradient(135deg,#e63329,#f97316)", padding: "14px 20px", color: "#fff" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                    <div style={{ fontSize: ".82rem", opacity: .85 }}>📍 {order.customer_address}</div>
                    <span style={{ fontFamily: "'Boogaloo',cursive", fontSize: "1.4rem" }}>৳{order.total}</span>
                </div>
                {/* Track button for active deliveries */}
                {order.status === "Out for Delivery" && (
                    <button onClick={onTrack} style={{ marginTop: 10, width: "100%", padding: "10px 0", background: "#fff", color: "#e63329", border: "none", borderRadius: 50, fontFamily: "'Boogaloo',cursive", fontSize: "1.1rem", cursor: "pointer", fontWeight: 700 }}>
                        📍 Track Live on Map
                    </button>
                )}
            </div>

            {/* Status message */}
            <div style={{ padding: "10px 20px", background: s.bg, color: s.color, fontSize: ".85rem", fontWeight: 700, textAlign: "center" }}>
                {s.msg}
            </div>
        </div>
    );
}

const styles = {
    title: { fontFamily: "'Boogaloo',cursive", fontSize: "2.2rem", color: "#e63329", marginBottom: 4 },
    wsChip: { display: "flex", alignItems: "center", background: "#fff", border: "2px solid #e5e7eb", borderRadius: 50, padding: "6px 14px", fontWeight: 700, fontSize: ".82rem", color: "#555" },
    buildBtn: { background: "#e63329", color: "#fff", border: "none", borderRadius: 50, padding: "10px 20px", cursor: "pointer", fontFamily: "Nunito,sans-serif", fontWeight: 700, fontSize: ".9rem" },
    errorBox: { background: "#fff0ee", border: "2px solid #e63329", borderRadius: 12, padding: "12px 20px", marginBottom: 20, color: "#e63329", fontWeight: 700 },
};
// src/Pages/AdminPanel.jsx
// Owner dashboard — manage orders + assign riders

import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { fetchOrders, fetchStats, updateOrderStatus, fetchRiders, assignRider } from "../api";

export default function AdminPanel() {
    const [orders, setOrders] = useState([]);
    const [stats, setStats] = useState(null);
    const [riders, setRiders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [toast, setToast] = useState("");
    const [wsStatus, setWsStatus] = useState("connecting");
    const navigate = useNavigate();
    const wsRef = useRef(null);

    const user = JSON.parse(localStorage.getItem("user") || "null");
    const token = localStorage.getItem("token");

    useEffect(() => {
        if (!user || (user.role !== "owner" && user.role !== "admin")) navigate("/login");
    }, []);

    function showToast(msg) {
        setToast(msg);
        setTimeout(() => setToast(""), 3000);
    }

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const [o, s, r] = await Promise.all([
                fetchOrders(token),
                fetchStats(token),
                fetchRiders(token),
            ]);
            setOrders(o);
            setStats(s);
            setRiders(r);
        } catch (err) {
            showToast("❌ " + err.message);
        } finally {
            setLoading(false);
        }
    }, [token]);

    useEffect(() => { load(); }, [load]);

    // WebSocket
    useEffect(() => {
        function connect() {
            const ws = new WebSocket("ws://127.0.0.1:8000/ws");
            wsRef.current = ws;
            ws.onopen = () => setWsStatus("live");
            ws.onmessage = (e) => {
                const msg = JSON.parse(e.data);
                if (msg.type === "NEW_ORDER") {
                    setOrders(prev => [msg.order, ...prev]);
                    showToast(`🆕 New order! #${msg.order.id}`);
                    setStats(prev => prev ? {
                        ...prev, totalOrders: prev.totalOrders + 1, newOrders: prev.newOrders + 1,
                    } : prev);
                }
                if (msg.type === "ORDER_UPDATE" || msg.type === "RIDER_ASSIGNED") {
                    load();
                }
            };
            ws.onclose = () => { setWsStatus("offline"); setTimeout(connect, 3000); };
        }
        connect();
        return () => wsRef.current?.close();
    }, [load]);

    async function handleStatus(orderId, status) {
        try {
            await updateOrderStatus(orderId, status, token);
            setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status } : o));
            showToast(`✅ Order #${orderId} → ${status}`);
        } catch (err) { showToast("❌ " + err.message); }
    }

    async function handleAssignRider(orderId, riderId) {
        try {
            await assignRider(orderId, riderId, token);
            showToast(`🛵 Rider assigned to #${orderId}!`);
            load();
        } catch (err) { showToast("❌ " + err.message); }
    }

    if (!user || (user.role !== "owner" && user.role !== "admin")) return null;

    return (
        <div style={{ maxWidth: 960, margin: "0 auto", padding: "32px 16px" }}>

            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
                <div>
                    <h2 style={styles.pageTitle}>👨‍🍳 Owner Dashboard</h2>
                    <p style={{ color: "#888" }}>Manage orders & assign riders</p>
                </div>
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    <div style={styles.wsChip}>
                        <span style={{
                            width: 9, height: 9, borderRadius: "50%", display: "inline-block",
                            background: wsStatus === "live" ? "#16a34a" : "#dc2626",
                            marginRight: 6,
                        }} />
                        {wsStatus === "live" ? "🔴 Live" : "Offline"}
                    </div>
                    <button onClick={load} style={styles.refreshBtn}>🔄 Refresh</button>
                </div>
            </div>

            {/* Stats */}
            {stats && (
                <div style={styles.statsGrid}>
                    {[
                        { num: stats.totalOrders, label: "Total Orders", color: "#e63329" },
                        { num: `৳${stats.revenue}`, label: "Revenue", color: "#16a34a" },
                        { num: stats.newOrders, label: "🆕 New", color: "#f97316" },
                        { num: stats.making || 0, label: "👨‍🍳 Making", color: "#3b82f6" },
                        { num: stats.ready || 0, label: "✅ Ready", color: "#8b5cf6" },
                        { num: stats.delivering || 0, label: "🚚 Delivering", color: "#e63329" },
                        { num: stats.availableRiders || 0, label: "🛵 Riders", color: "#0891b2" },
                    ].map(({ num, label, color }) => (
                        <div key={label} style={styles.statCard}>
                            <div style={{ fontFamily: "'Boogaloo',cursive", fontSize: "2rem", color }}>{num}</div>
                            <div style={{ fontSize: ".75rem", color: "#888", fontWeight: 700 }}>{label}</div>
                        </div>
                    ))}
                </div>
            )}

            {/* Available riders summary */}
            {riders.length > 0 && (
                <div style={styles.riderSummary}>
                    <h4 style={styles.riderSummaryTitle}>🛵 Available Riders</h4>
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                        {riders.map(r => (
                            <div key={r.id} style={{
                                display: "flex", alignItems: "center", gap: 8,
                                background: r.is_available ? "#f0fdf4" : "#f9f9f9",
                                border: `1px solid ${r.is_available ? "#86efac" : "#e5e7eb"}`,
                                borderRadius: 50, padding: "6px 14px",
                                fontSize: ".82rem", fontWeight: 700,
                                color: r.is_available ? "#166534" : "#888",
                            }}>
                                <span>{r.is_available ? "🟢" : "⚫"}</span>
                                <span>{r.name}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Orders */}
            {loading && <p style={{ color: "#888", textAlign: "center", padding: 40 }}>Loading orders…</p>}

            {!loading && orders.length === 0 && (
                <div style={{ textAlign: "center", padding: "60px 20px" }}>
                    <div style={{ fontSize: "4rem" }}>📭</div>
                    <h3 style={{ fontFamily: "'Boogaloo',cursive", fontSize: "1.8rem", color: "#555", marginTop: 12 }}>No orders yet!</h3>
                </div>
            )}

            {orders.map(order => (
                <OrderCard
                    key={order.id}
                    order={order}
                    riders={riders}
                    onStatus={handleStatus}
                    onAssignRider={handleAssignRider}
                />
            ))}

            {/* Toast */}
            <div style={{
                ...styles.toast,
                transform: toast ? "translateX(-50%) translateY(0)" : "translateX(-50%) translateY(80px)",
            }}>
                {toast}
            </div>
        </div>
    );
}

// ── Order card ────────────────────────────────────────
function OrderCard({ order, riders, onStatus, onAssignRider }) {
    const [selectedRider, setSelectedRider] = useState("");

    const STATUS_COLORS = {
        "New": { bg: "#fef3c7", color: "#b45309", label: "🆕 New" },
        "Making": { bg: "#dbeafe", color: "#1d4ed8", label: "👨‍🍳 Making" },
        "Ready": { bg: "#d1fae5", color: "#065f46", label: "✅ Ready" },
        "Out for Delivery": { bg: "#fff0ee", color: "#e63329", label: "🚚 Delivering" },
        "Delivered": { bg: "#f3f4f6", color: "#374151", label: "🏠 Delivered" },
    };
    const s = STATUS_COLORS[order.status] || STATUS_COLORS["New"];

    return (
        <div style={{
            ...styles.orderCard,
            borderLeft: `4px solid ${s.color}`,
        }}>
            {/* Header */}
            <div style={styles.orderHeader}>
                <div>
                    <strong style={{ fontSize: "1.05rem" }}>#{order.id}</strong>
                    <span style={{ color: "#aaa", fontSize: ".78rem", marginLeft: 8 }}>{order.created_at}</span>
                </div>
                <span style={{ ...styles.badge, background: s.bg, color: s.color }}>{s.label}</span>
            </div>

            {/* Customer */}
            <div style={styles.customerRow}>
                <span>👤 <strong>{order.customer_name}</strong></span>
                {order.customer_phone && <span>📞 {order.customer_phone}</span>}
                {order.customer_address && <span>📍 {order.customer_address}</span>}
            </div>

            {/* Rider info if assigned */}
            {order.rider_name && (
                <div style={styles.riderAssigned}>
                    🛵 Assigned to: <strong>{order.rider_name}</strong>
                </div>
            )}

            {/* Items */}
            <div style={styles.itemsBox}>
                {(order.items || []).map((item, i) => (
                    <div key={i} style={styles.itemRow}>
                        <span>🍕 {item.qty}× {item.size} ({item.crust} crust, {item.sauce} sauce
                            {item.toppings?.length ? " + " + item.toppings.map(t => t.label || t).join(", ") : ""})</span>
                        <span style={{ fontWeight: 700, color: "#e63329" }}>৳{item.price * item.qty}</span>
                    </div>
                ))}
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8, flexWrap: "wrap", gap: 8 }}>
                <span style={{ fontFamily: "'Boogaloo',cursive", fontSize: "1.2rem", color: "#e63329" }}>
                    Total: ৳{order.total}
                </span>
            </div>

            {/* Action buttons */}
            <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap", alignItems: "center" }}>
                {order.status === "New" && (
                    <ActionBtn color="#3b82f6" onClick={() => onStatus(order.id, "Making")}>
                        👨‍🍳 Start Making
                    </ActionBtn>
                )}
                {order.status === "Making" && (
                    <ActionBtn color="#16a34a" onClick={() => onStatus(order.id, "Ready")}>
                        ✅ Mark Ready
                    </ActionBtn>
                )}
                {order.status === "Ready" && !order.rider_id && (
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                        <select
                            value={selectedRider}
                            onChange={e => setSelectedRider(e.target.value)}
                            style={styles.riderSelect}
                        >
                            <option value="">Select a rider…</option>
                            {riders.filter(r => r.is_available).map(r => (
                                <option key={r.id} value={r.id}>{r.name} — {r.phone}</option>
                            ))}
                        </select>
                        <ActionBtn
                            color="#e63329"
                            onClick={() => selectedRider && onAssignRider(order.id, selectedRider)}
                        >
                            🛵 Assign Rider
                        </ActionBtn>
                    </div>
                )}
                {order.status === "Out for Delivery" && (
                    <span style={{ color: "#e63329", fontWeight: 700, fontSize: ".9rem" }}>
                        🛵 Out for delivery with {order.rider_name}
                    </span>
                )}
                {order.status === "Delivered" && (
                    <span style={{ color: "#16a34a", fontWeight: 700, fontSize: ".9rem" }}>
                        ✅ Delivered
                    </span>
                )}
            </div>
        </div>
    );
}

function ActionBtn({ children, color, onClick }) {
    return (
        <button onClick={onClick} style={{
            padding: "8px 18px", borderRadius: 50, border: "none",
            cursor: "pointer", fontFamily: "Nunito,sans-serif",
            fontWeight: 700, fontSize: ".85rem",
            background: color, color: "#fff",
        }}>
            {children}
        </button>
    );
}

const styles = {
    pageTitle: { fontFamily: "'Boogaloo',cursive", fontSize: "2.2rem", color: "#e63329", marginBottom: 4 },
    wsChip: {
        display: "flex", alignItems: "center",
        background: "#fff", border: "2px solid #e5e7eb",
        borderRadius: 50, padding: "6px 14px",
        fontWeight: 700, fontSize: ".82rem", color: "#444",
    },
    refreshBtn: {
        padding: "8px 18px", borderRadius: 50,
        border: "2px solid #e63329", background: "#fff",
        color: "#e63329", cursor: "pointer",
        fontWeight: 700, fontFamily: "Nunito,sans-serif",
    },
    statsGrid: {
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))",
        gap: 12, marginBottom: 20,
    },
    statCard: {
        background: "#fff", borderRadius: 16, padding: "16px 12px",
        boxShadow: "0 4px 16px rgba(0,0,0,.06)", textAlign: "center",
    },
    riderSummary: {
        background: "#fff", borderRadius: 16, padding: 16,
        boxShadow: "0 4px 16px rgba(0,0,0,.06)", marginBottom: 20,
    },
    riderSummaryTitle: {
        fontFamily: "'Boogaloo',cursive",
        fontSize: "1.1rem", color: "#7c2d12", marginBottom: 10,
    },
    orderCard: {
        background: "#fff", borderRadius: 20, padding: 20,
        marginBottom: 16, boxShadow: "0 4px 16px rgba(0,0,0,.06)",
    },
    orderHeader: {
        display: "flex", justifyContent: "space-between",
        alignItems: "center", marginBottom: 10,
    },
    badge: {
        padding: "4px 12px", borderRadius: 50,
        fontSize: ".78rem", fontWeight: 800,
    },
    customerRow: {
        fontSize: ".85rem", color: "#444", marginBottom: 8,
        display: "flex", flexWrap: "wrap", gap: "4px 20px",
    },
    riderAssigned: {
        background: "#fff0ee", color: "#e63329",
        borderRadius: 8, padding: "6px 12px",
        fontSize: ".82rem", fontWeight: 700, marginBottom: 8,
    },
    itemsBox: {
        background: "#fff8f0", borderRadius: 10,
        padding: "10px 14px", borderTop: "1px solid #fde68a",
    },
    itemRow: {
        display: "flex", justifyContent: "space-between",
        fontSize: ".83rem", color: "#555", padding: "4px 0",
        borderBottom: "1px dashed #fde68a",
    },
    riderSelect: {
        padding: "8px 14px", borderRadius: 50,
        border: "2px solid #e5e7eb", outline: "none",
        fontFamily: "Nunito,sans-serif", fontSize: ".85rem",
        background: "#fff", cursor: "pointer",
    },
    toast: {
        position: "fixed", bottom: 24, left: "50%",
        background: "#1c0a00", color: "#fff",
        padding: "12px 24px", borderRadius: 50,
        fontWeight: 700, fontSize: ".9rem",
        zIndex: 999, transition: "transform .35s",
        pointerEvents: "none",
    },
};
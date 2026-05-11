// src/Pages/AdminPanel.jsx
// Owner dashboard — receives new orders live via WebSocket
import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { fetchOrders, fetchStats, updateOrderStatus } from "../api";

export default function AdminPanel() {
    const [orders, setOrders] = useState([]);
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [toast, setToast] = useState("");
    const [wsStatus, setWsStatus] = useState("connecting"); // connecting | live | offline
    const navigate = useNavigate();
    const wsRef = useRef(null);

    const user = JSON.parse(localStorage.getItem("user") || "null");
    const token = localStorage.getItem("token");

    // ── Redirect if not owner ──────────────────────────
    useEffect(() => {
        if (!user || (user.role !== "owner" && user.role !== "admin")) {
            navigate("/login");
        }
    }, []);

    function showToast(msg) {
        setToast(msg);
        setTimeout(() => setToast(""), 3000);
    }

    // ── Fetch orders + stats ───────────────────────────
    const load = useCallback(async () => {
        setLoading(true);
        try {
            const [o, s] = await Promise.all([
                fetchOrders(token),
                fetchStats(token),
            ]);
            setOrders(o);
            setStats(s);
        } catch (err) {
            showToast("❌ " + (err.message || "Failed to load"));
        } finally {
            setLoading(false);
        }
    }, [token]);

    useEffect(() => { load(); }, [load]);

    // ── WebSocket — live order notifications ───────────
    useEffect(() => {
        function connect() {
            const ws = new WebSocket("ws://127.0.0.1:8000/ws");
            wsRef.current = ws;

            ws.onopen = () => {
                setWsStatus("live");
                console.log("🔔 WebSocket connected");
            };

            ws.onmessage = (event) => {
                const msg = JSON.parse(event.data);

                if (msg.type === "NEW_ORDER") {
                    // Add new order to top of list
                    setOrders(prev => [msg.order, ...prev]);
                    showToast(`🆕 New order arrived! #${msg.order.id}`);
                    // Update stats
                    setStats(prev => prev ? {
                        ...prev,
                        totalOrders: prev.totalOrders + 1,
                        newOrders: prev.newOrders + 1,
                        revenue: prev.revenue + msg.order.total,
                    } : prev);
                }

                if (msg.type === "ORDER_UPDATE") {
                    // Update status of existing order
                    setOrders(prev =>
                        prev.map(o => o.id === msg.order_id ? { ...o, status: msg.status } : o)
                    );
                }
            };

            ws.onclose = () => {
                setWsStatus("offline");
                // Auto-reconnect after 3 seconds
                setTimeout(connect, 3000);
            };

            ws.onerror = () => {
                setWsStatus("offline");
                ws.close();
            };
        }

        connect();
        return () => wsRef.current?.close();
    }, []);

    // ── Update order status ────────────────────────────
    async function handleStatus(orderId, status) {
        try {
            await updateOrderStatus(orderId, status, token);
            setOrders(prev =>
                prev.map(o => o.id === orderId ? { ...o, status } : o)
            );
            showToast(`✅ Order #${orderId} → ${status}`);
        } catch (err) {
            showToast("❌ " + (err.message || "Update failed"));
        }
    }

    if (!user || (user.role !== "owner" && user.role !== "admin")) return null;

    return (
        <div style={styles.wrap}>

            {/* Header */}
            <div style={styles.topRow}>
                <div>
                    <h2 style={styles.pageTitle}>👨‍🍳 Owner Dashboard</h2>
                    <p style={styles.pageSub}>Manage all incoming pizza orders</p>
                </div>
                {/* WebSocket status indicator */}
                <div style={styles.wsChip}>
                    <span style={{
                        ...styles.wsDot,
                        background: wsStatus === "live" ? "#16a34a" : wsStatus === "connecting" ? "#f97316" : "#dc2626",
                        animation: wsStatus === "live" ? "wsPulse 2s infinite" : "none",
                    }} />
                    {wsStatus === "live" ? "🔴 Live" : wsStatus === "connecting" ? "Connecting…" : "Offline"}
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
                        { num: stats.pizzasMade, label: "🍕 Pizzas Made", color: "#7c2d12" },
                    ].map(({ num, label, color }) => (
                        <div key={label} style={styles.statCard}>
                            <div style={{ ...styles.statNum, color }}>{num}</div>
                            <div style={styles.statLabel}>{label}</div>
                        </div>
                    ))}
                </div>
            )}

            {/* Controls */}
            <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
                <button onClick={load} style={styles.refreshBtn}>🔄 Refresh</button>
                <FilterTabs orders={orders} />
            </div>

            {loading && (
                <div style={styles.loadingBox}>⏳ Loading orders…</div>
            )}

            {!loading && orders.length === 0 && (
                <div style={styles.emptyBox}>
                    <div style={{ fontSize: "4rem" }}>📭</div>
                    <h3 style={{ fontFamily: "'Boogaloo',cursive", fontSize: "1.8rem", color: "#555", marginTop: 12 }}>
                        No orders yet!
                    </h3>
                    <p style={{ color: "#aaa" }}>Orders appear here instantly when customers place them.</p>
                </div>
            )}

            {/* Orders */}
            {orders.map(order => (
                <OrderCard
                    key={order.id}
                    order={order}
                    onStatusChange={handleStatus}
                />
            ))}

            {/* Toast */}
            <div style={{
                ...styles.toast,
                transform: toast
                    ? "translateX(-50%) translateY(0)"
                    : "translateX(-50%) translateY(80px)",
            }}>
                {toast}
            </div>

            <style>{`
        @keyframes wsPulse {
          0%,100% { opacity: 1; }
          50%      { opacity: .4; }
        }
      `}</style>
        </div>
    );
}

// ── Order Card ───────────────────────────────────────
function OrderCard({ order, onStatusChange }) {
    const statusColors = {
        New: { bg: "#fef3c7", color: "#b45309", label: "🆕 New" },
        Making: { bg: "#dbeafe", color: "#1d4ed8", label: "👨‍🍳 Making" },
        Ready: { bg: "#d1fae5", color: "#065f46", label: "✅ Ready" },
        Delivered: { bg: "#f3f4f6", color: "#374151", label: "🏠 Delivered" },
    };
    const s = statusColors[order.status] || statusColors.New;

    return (
        <div style={{
            ...styles.orderCard,
            borderLeft: `4px solid ${s.color}`,
            animation: order.status === "New" ? "slideIn .4s ease-out" : "none",
        }}>

            {/* Top row */}
            <div style={styles.orderHeader}>
                <div>
                    <strong style={{ fontSize: "1.1rem" }}>#{order.id}</strong>
                    <span style={{ color: "#888", fontSize: ".8rem", marginLeft: 10 }}>
                        {order.created_at}
                    </span>
                </div>
                <span style={{
                    padding: "4px 14px", borderRadius: 50,
                    fontSize: ".8rem", fontWeight: 800,
                    background: s.bg, color: s.color,
                }}>
                    {s.label}
                </span>
            </div>

            {/* Customer info */}
            <div style={styles.customerRow}>
                <div>👤 <strong>{order.customer_name}</strong></div>
                {order.customer_phone && <div>📞 {order.customer_phone}</div>}
                {order.customer_address && <div>📍 {order.customer_address}</div>}
                {order.customer_email && <div>✉️ {order.customer_email}</div>}
            </div>

            {/* Items */}
            <div style={styles.itemsList}>
                {(order.items || []).map((item, i) => (
                    <div key={i} style={styles.itemRow}>
                        <span>
                            🍕 {item.qty}× <strong>{item.size}</strong> ({item.crust} crust,
                            {" "}{item.sauce} sauce
                            {item.toppings?.length
                                ? " + " + item.toppings.map(t => t.label || t).join(", ")
                                : ""})
                        </span>
                        <span style={{ fontWeight: 700, color: "#e63329" }}>
                            ৳{item.price * item.qty}
                        </span>
                    </div>
                ))}
            </div>

            {/* Total */}
            <div style={styles.orderTotal}>
                <span>Subtotal ৳{order.subtotal} + Delivery ৳{order.delivery || 50}</span>
                <span style={{ fontFamily: "'Boogaloo',cursive", fontSize: "1.3rem", color: "#e63329" }}>
                    Total: ৳{order.total}
                </span>
            </div>

            {/* Action buttons */}
            <div style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
                {order.status === "New" && (
                    <ActionBtn color="#3b82f6" onClick={() => onStatusChange(order.id, "Making")}>
                        👨‍🍳 Start Making
                    </ActionBtn>
                )}
                {order.status === "Making" && (
                    <ActionBtn color="#16a34a" onClick={() => onStatusChange(order.id, "Ready")}>
                        ✅ Mark Ready
                    </ActionBtn>
                )}
                {order.status === "Ready" && (
                    <ActionBtn color="#7c2d12" onClick={() => onStatusChange(order.id, "Delivered")}>
                        🛵 Mark Delivered
                    </ActionBtn>
                )}
                {order.status === "Delivered" && (
                    <span style={{ color: "#16a34a", fontWeight: 700, fontSize: ".9rem" }}>
                        ✅ Delivered
                    </span>
                )}
            </div>

            <style>{`
        @keyframes slideIn {
          from { opacity:0; transform: translateY(-12px); }
          to   { opacity:1; transform: translateY(0); }
        }
      `}</style>
        </div>
    );
}

// Dummy filter tabs (visual only — extend if needed)
function FilterTabs({ orders }) {
    const counts = {
        All: orders.length,
        New: orders.filter(o => o.status === "New").length,
        Making: orders.filter(o => o.status === "Making").length,
        Ready: orders.filter(o => o.status === "Ready").length,
        Delivered: orders.filter(o => o.status === "Delivered").length,
    };
    const [active, setActive] = useState("All");
    return (
        <div style={{ display: "flex", gap: 6 }}>
            {Object.entries(counts).map(([label, count]) => (
                <button
                    key={label}
                    onClick={() => setActive(label)}
                    style={{
                        padding: "6px 14px", borderRadius: 50, cursor: "pointer",
                        fontFamily: "Nunito,sans-serif", fontWeight: 700, fontSize: ".8rem",
                        border: "2px solid #e63329",
                        background: active === label ? "#e63329" : "#fff",
                        color: active === label ? "#fff" : "#e63329",
                    }}
                >
                    {label} ({count})
                </button>
            ))}
        </div>
    );
}

function ActionBtn({ children, color, onClick }) {
    return (
        <button onClick={onClick} style={{
            padding: "8px 20px", borderRadius: 50, border: "none",
            cursor: "pointer", fontFamily: "Nunito,sans-serif",
            fontWeight: 700, fontSize: ".85rem",
            background: color, color: "#fff",
        }}>
            {children}
        </button>
    );
}

const styles = {
    wrap: { maxWidth: 960, margin: "0 auto", padding: "32px 16px" },
    topRow: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24, flexWrap: "wrap", gap: 12 },
    pageTitle: { fontFamily: "'Boogaloo',cursive", fontSize: "2.2rem", color: "#e63329", marginBottom: 4 },
    pageSub: { color: "#888" },

    wsChip: {
        display: "flex", alignItems: "center", gap: 8,
        background: "#fff", border: "2px solid #e5e7eb",
        borderRadius: 50, padding: "6px 16px",
        fontWeight: 700, fontSize: ".85rem", color: "#444",
    },
    wsDot: {
        width: 10, height: 10, borderRadius: "50%", display: "inline-block",
    },

    statsGrid: {
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
        gap: 14, marginBottom: 24,
    },
    statCard: {
        background: "#fff", borderRadius: 18, padding: "18px 16px",
        boxShadow: "0 4px 16px rgba(0,0,0,.06)", textAlign: "center",
    },
    statNum: { fontFamily: "'Boogaloo',cursive", fontSize: "2rem" },
    statLabel: { fontSize: ".78rem", color: "#888", fontWeight: 700, marginTop: 2 },

    refreshBtn: {
        padding: "8px 20px", borderRadius: 50,
        border: "2px solid #e63329", background: "#fff", color: "#e63329",
        cursor: "pointer", fontWeight: 700, fontFamily: "Nunito,sans-serif",
    },

    loadingBox: { textAlign: "center", padding: 40, color: "#888", fontSize: "1.1rem" },
    emptyBox: { textAlign: "center", padding: "60px 20px" },

    orderCard: {
        background: "#fff", borderRadius: 20, padding: 20, marginBottom: 16,
        boxShadow: "0 4px 16px rgba(0,0,0,.06)",
    },
    orderHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
    customerRow: { fontSize: ".85rem", color: "#444", marginBottom: 12, display: "flex", flexWrap: "wrap", gap: "4px 20px" },
    itemsList: { background: "#fff8f0", borderRadius: 12, padding: 12, marginBottom: 10 },
    itemRow: {
        display: "flex", justifyContent: "space-between",
        fontSize: ".85rem", color: "#555", marginBottom: 4,
        paddingBottom: 4, borderBottom: "1px solid #fde68a",
    },
    orderTotal: {
        display: "flex", justifyContent: "space-between",
        alignItems: "center", flexWrap: "wrap", gap: 4,
        fontSize: ".82rem", color: "#888",
    },

    toast: {
        position: "fixed", bottom: 24, left: "50%",
        background: "#1c0a00", color: "#fff",
        padding: "12px 24px", borderRadius: 50,
        fontWeight: 700, fontSize: ".95rem",
        zIndex: 999, transition: "transform .3s", pointerEvents: "none",
    },
};
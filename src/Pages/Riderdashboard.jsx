// src/Pages/RiderDashboard.jsx
// Full rider dashboard:
// - Online/Offline toggle
// - Delivery orders list
// - Live map (Leaflet, free, no API key)
// - Earnings dashboard
// - Complete delivery button

import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
    fetchRiderOrders, completeDelivery,
    updateRiderLocation, setAvailability, fetchRiderEarnings,
} from "../api";

export default function RiderDashboard() {
    const navigate = useNavigate();
    const [orders, setOrders] = useState([]);
    const [earnings, setEarnings] = useState(null);
    const [isOnline, setIsOnline] = useState(true);
    const [activeTab, setActiveTab] = useState("deliveries"); // deliveries | earnings | map
    const [loading, setLoading] = useState(true);
    const [toast, setToast] = useState("");
    const [riderPos, setRiderPos] = useState({ lat: 23.7937, lng: 90.4066 });
    const mapRef = useRef(null);
    const mapInstance = useRef(null);
    const riderMarker = useRef(null);
    const wsRef = useRef(null);

    const user = JSON.parse(localStorage.getItem("user") || "null");
    const token = localStorage.getItem("token");

    // ── Guard ──────────────────────────────────────────
    useEffect(() => {
        if (!user || user.role !== "rider") navigate("/rider/login");
    }, []);

    function showToast(msg) {
        setToast(msg);
        setTimeout(() => setToast(""), 3000);
    }

    // ── Load data ──────────────────────────────────────
    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const [o, e] = await Promise.all([
                fetchRiderOrders(token),
                fetchRiderEarnings(token),
            ]);
            setOrders(o);
            setEarnings(e);
        } catch (err) {
            showToast("❌ " + err.message);
        } finally {
            setLoading(false);
        }
    }, [token]);

    useEffect(() => { loadData(); }, [loadData]);

    // ── WebSocket — receive new assignments ────────────
    useEffect(() => {
        function connect() {
            const ws = new WebSocket("ws://127.0.0.1:8000/ws");
            wsRef.current = ws;
            ws.onmessage = (e) => {
                const msg = JSON.parse(e.data);
                if (msg.type === "RIDER_ASSIGNED" && msg.order?.rider_id === user?.id) {
                    showToast(`🆕 New delivery assigned! Order #${msg.order_id}`);
                    loadData();
                }
                if (msg.type === "ORDER_UPDATE") {
                    setOrders(prev => prev.map(o =>
                        o.id === msg.order_id ? { ...o, status: msg.status } : o
                    ));
                }
            };
            ws.onclose = () => setTimeout(connect, 3000);
        }
        connect();
        return () => wsRef.current?.close();
    }, []);

    // ── GPS tracking — update location every 10s ───────
    useEffect(() => {
        if (!isOnline) return;
        function sendLocation(pos) {
            const { latitude: lat, longitude: lng } = pos.coords;
            setRiderPos({ lat, lng });
            updateRiderLocation(lat, lng, token).catch(() => { });
            // Update map marker
            if (riderMarker.current) {
                riderMarker.current.setLatLng([lat, lng]);
            }
        }
        const watcher = navigator.geolocation?.watchPosition(sendLocation, () => {
            // Fallback: simulate movement in Dhaka for demo
            const interval = setInterval(() => {
                setRiderPos(prev => ({
                    lat: prev.lat + (Math.random() - 0.5) * 0.001,
                    lng: prev.lng + (Math.random() - 0.5) * 0.001,
                }));
            }, 5000);
            return () => clearInterval(interval);
        }, { enableHighAccuracy: true });

        return () => navigator.geolocation?.clearWatch(watcher);
    }, [isOnline, token]);

    // ── Init Leaflet map ───────────────────────────────
    useEffect(() => {
        if (activeTab !== "map") return;
        // Small delay to let the div render
        setTimeout(() => {
            if (!mapRef.current || mapInstance.current) return;

            const L = window.L;
            if (!L) return;

            const map = L.map(mapRef.current).setView(
                [riderPos.lat, riderPos.lng], 14
            );
            mapInstance.current = map;

            L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
                attribution: "© OpenStreetMap contributors",
            }).addTo(map);

            // Rider marker
            const riderIcon = L.divIcon({
                html: `<div style="background:#e63329;width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:1.3rem;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.3)">🛵</div>`,
                className: "",
                iconSize: [36, 36],
                iconAnchor: [18, 18],
            });
            riderMarker.current = L.marker([riderPos.lat, riderPos.lng], { icon: riderIcon })
                .addTo(map)
                .bindPopup("📍 You are here");

            // Add delivery destination markers
            orders.filter(o => o.status === "Out for Delivery").forEach(order => {
                if (order.customer_lat && order.customer_lng) {
                    const destIcon = L.divIcon({
                        html: `<div style="background:#fbbf24;width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:1.3rem;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.3)">🏠</div>`,
                        className: "",
                        iconSize: [36, 36],
                        iconAnchor: [18, 18],
                    });
                    L.marker([order.customer_lat, order.customer_lng], { icon: destIcon })
                        .addTo(map)
                        .bindPopup(`📦 Deliver to: ${order.customer_name}<br>${order.customer_address}`);
                }
            });
        }, 300);

        return () => {
            if (mapInstance.current) {
                mapInstance.current.remove();
                mapInstance.current = null;
            }
        };
    }, [activeTab]);

    // ── Toggle online ──────────────────────────────────
    async function handleToggleOnline() {
        try {
            await setAvailability(!isOnline, token);
            setIsOnline(p => !p);
            showToast(!isOnline ? "✅ You are now Online!" : "⏸️ You are now Offline");
        } catch (err) {
            showToast("❌ " + err.message);
        }
    }

    // ── Complete delivery ──────────────────────────────
    async function handleComplete(orderId) {
        try {
            const data = await completeDelivery(orderId, token);
            showToast(`🎉 Delivered! ${data.message}`);
            loadData();
        } catch (err) {
            showToast("❌ " + err.message);
        }
    }

    function handleLogout() {
        localStorage.removeItem("user");
        localStorage.removeItem("token");
        navigate("/rider/login");
    }

    const activeDeliveries = orders.filter(o => o.status === "Out for Delivery");
    const pastDeliveries = orders.filter(o => o.status === "Delivered");

    if (!user || user.role !== "rider") return null;

    return (
        <>
            {/* Leaflet CSS */}
            <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
            <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" />

            <div style={{ background: "#fff8f0", minHeight: "100vh" }}>

                {/* ── Rider Header ── */}
                <div style={styles.header}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <div style={styles.avatar}>🛵</div>
                        <div>
                            <div style={styles.riderName}>{user.name}</div>
                            <div style={styles.riderSub}>Delivery Rider</div>
                        </div>
                    </div>

                    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                        {/* Online toggle */}
                        <button
                            onClick={handleToggleOnline}
                            style={{
                                ...styles.onlineToggle,
                                background: isOnline ? "#16a34a" : "#6b7280",
                            }}
                        >
                            <span style={styles.toggleDot} />
                            {isOnline ? "🟢 Online" : "⚫ Offline"}
                        </button>

                        <button onClick={handleLogout} style={styles.logoutBtn}>
                            Sign Out
                        </button>
                    </div>
                </div>

                {/* ── Stats bar ── */}
                {earnings && (
                    <div style={styles.statsBar}>
                        {[
                            { icon: "💰", label: "Total Earned", value: `৳${earnings.total}` },
                            { icon: "📅", label: "Today", value: `৳${earnings.today}` },
                            { icon: "📦", label: "Deliveries", value: earnings.deliveries },
                            { icon: "🚚", label: "Active", value: activeDeliveries.length },
                        ].map(({ icon, label, value }) => (
                            <div key={label} style={styles.statBox}>
                                <div style={styles.statIcon}>{icon}</div>
                                <div style={styles.statValue}>{value}</div>
                                <div style={styles.statLabel}>{label}</div>
                            </div>
                        ))}
                    </div>
                )}

                {/* ── Tabs ── */}
                <div style={styles.tabs}>
                    {[
                        { key: "deliveries", label: "🚚 Deliveries" },
                        { key: "map", label: "🗺️ Live Map" },
                        { key: "earnings", label: "💰 Earnings" },
                    ].map(tab => (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key)}
                            style={{
                                ...styles.tab,
                                borderBottom: activeTab === tab.key
                                    ? "3px solid #e63329" : "3px solid transparent",
                                color: activeTab === tab.key ? "#e63329" : "#888",
                                fontWeight: activeTab === tab.key ? 800 : 600,
                            }}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                <div style={{ maxWidth: 800, margin: "0 auto", padding: "24px 16px" }}>

                    {/* ══ DELIVERIES TAB ══ */}
                    {activeTab === "deliveries" && (
                        <div>
                            {loading && <p style={{ textAlign: "center", color: "#888" }}>Loading…</p>}

                            {/* Active deliveries */}
                            {activeDeliveries.length > 0 && (
                                <>
                                    <h3 style={styles.sectionTitle}>🚦 Active Deliveries</h3>
                                    {activeDeliveries.map(order => (
                                        <DeliveryCard
                                            key={order.id}
                                            order={order}
                                            onComplete={handleComplete}
                                            isActive
                                        />
                                    ))}
                                </>
                            )}

                            {activeDeliveries.length === 0 && !loading && (
                                <div style={styles.emptyBox}>
                                    <div style={{ fontSize: "4rem", marginBottom: 12 }}>🛵</div>
                                    <h4 style={styles.emptyTitle}>No active deliveries</h4>
                                    <p style={{ color: "#aaa" }}>
                                        {isOnline
                                            ? "You'll be notified when a delivery is assigned to you."
                                            : "Go online to start receiving deliveries!"}
                                    </p>
                                    {!isOnline && (
                                        <button onClick={handleToggleOnline} style={styles.goOnlineBtn}>
                                            Go Online
                                        </button>
                                    )}
                                </div>
                            )}

                            {/* Past deliveries */}
                            {pastDeliveries.length > 0 && (
                                <>
                                    <h3 style={{ ...styles.sectionTitle, marginTop: 32 }}>
                                        ✅ Completed ({pastDeliveries.length})
                                    </h3>
                                    {pastDeliveries.slice(0, 5).map(order => (
                                        <DeliveryCard key={order.id} order={order} isActive={false} />
                                    ))}
                                </>
                            )}
                        </div>
                    )}

                    {/* ══ MAP TAB ══ */}
                    {activeTab === "map" && (
                        <div>
                            <div style={styles.mapHeader}>
                                <h3 style={styles.sectionTitle}>📍 Your Location</h3>
                                <div style={styles.coordChip}>
                                    {riderPos.lat.toFixed(4)}, {riderPos.lng.toFixed(4)}
                                </div>
                            </div>
                            <div
                                ref={mapRef}
                                style={styles.mapBox}
                            />
                            <div style={styles.mapLegend}>
                                <span>🛵 You</span>
                                <span>🏠 Delivery destination</span>
                            </div>
                        </div>
                    )}

                    {/* ══ EARNINGS TAB ══ */}
                    {activeTab === "earnings" && earnings && (
                        <div>
                            {/* Summary cards */}
                            <div style={styles.earningsGrid}>
                                <EarningCard icon="💰" label="Total Earnings" value={`৳${earnings.total}`} color="#16a34a" />
                                <EarningCard icon="📅" label="Today's Earnings" value={`৳${earnings.today}`} color="#f97316" />
                                <EarningCard icon="📦" label="Total Deliveries" value={earnings.deliveries} color="#3b82f6" />
                                <EarningCard icon="⭐" label="Earn per delivery" value="10% of order" color="#8b5cf6" />
                            </div>

                            {/* Recent earnings */}
                            <h3 style={{ ...styles.sectionTitle, marginTop: 24 }}>
                                📋 Recent Transactions
                            </h3>

                            {earnings.recent.length === 0 && (
                                <div style={styles.emptyBox}>
                                    <p style={{ color: "#aaa" }}>No earnings yet. Complete deliveries to earn!</p>
                                </div>
                            )}

                            {earnings.recent.map((e, i) => (
                                <div key={i} style={styles.earningRow}>
                                    <div>
                                        <div style={{ fontWeight: 700, fontSize: ".9rem" }}>
                                            Order #{e.order_id}
                                        </div>
                                        <div style={{ fontSize: ".78rem", color: "#aaa" }}>
                                            {e.created_at}
                                        </div>
                                    </div>
                                    <div style={{
                                        fontFamily: "'Boogaloo', cursive",
                                        fontSize: "1.3rem", color: "#16a34a",
                                    }}>
                                        +৳{e.amount}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Toast */}
            <div style={{
                ...styles.toast,
                transform: toast
                    ? "translateX(-50%) translateY(0)"
                    : "translateX(-50%) translateY(100px)",
            }}>
                {toast}
            </div>
        </>
    );
}

// ── Delivery card ─────────────────────────────────────
function DeliveryCard({ order, onComplete, isActive }) {
    return (
        <div style={{
            ...styles.deliveryCard,
            borderLeft: isActive ? "4px solid #e63329" : "4px solid #16a34a",
        }}>
            <div style={styles.deliveryTop}>
                <div>
                    <span style={styles.orderId}>#{order.id}</span>
                    <span style={styles.orderTime}>{order.created_at}</span>
                </div>
                <span style={{
                    padding: "3px 12px", borderRadius: 50, fontSize: ".78rem", fontWeight: 800,
                    background: isActive ? "#fff0ee" : "#f0fdf4",
                    color: isActive ? "#e63329" : "#16a34a",
                }}>
                    {isActive ? "🚚 Delivering" : "✅ Delivered"}
                </span>
            </div>

            {/* Customer info */}
            <div style={styles.customerInfo}>
                <div>👤 <strong>{order.customer_name}</strong></div>
                <div>📞 {order.customer_phone}</div>
                <div>📍 {order.customer_address}</div>
            </div>

            {/* Items */}
            <div style={styles.itemsList}>
                {(order.items || []).map((item, i) => (
                    <span key={i} style={styles.itemChip}>
                        🍕 {item.qty}× {item.size}
                    </span>
                ))}
            </div>

            {/* Total + action */}
            <div style={styles.deliveryFooter}>
                <span style={styles.orderTotal}>৳{order.total}</span>
                {isActive && onComplete && (
                    <button
                        onClick={() => onComplete(order.id)}
                        style={styles.completeBtn}
                    >
                        ✅ Mark Delivered
                    </button>
                )}
            </div>
        </div>
    );
}

function EarningCard({ icon, label, value, color }) {
    return (
        <div style={styles.earningCard}>
            <div style={{ fontSize: "2rem", marginBottom: 6 }}>{icon}</div>
            <div style={{ fontFamily: "'Boogaloo',cursive", fontSize: "1.8rem", color }}>
                {value}
            </div>
            <div style={{ fontSize: ".78rem", color: "#888", fontWeight: 700 }}>{label}</div>
        </div>
    );
}

const styles = {
    header: {
        background: "#1c0a00",
        padding: "16px 24px",
        display: "flex", justifyContent: "space-between",
        alignItems: "center", flexWrap: "wrap", gap: 12,
    },
    avatar: {
        width: 48, height: 48, borderRadius: "50%",
        background: "#e63329", display: "flex",
        alignItems: "center", justifyContent: "center",
        fontSize: "1.5rem",
    },
    riderName: { color: "#fff", fontFamily: "'Boogaloo',cursive", fontSize: "1.2rem" },
    riderSub: { color: "#fbbf24", fontSize: ".78rem", fontWeight: 700 },
    onlineToggle: {
        display: "flex", alignItems: "center", gap: 8,
        border: "none", borderRadius: 50, padding: "8px 18px",
        color: "#fff", cursor: "pointer", fontWeight: 700,
        fontFamily: "Nunito,sans-serif", fontSize: ".88rem",
        transition: "background .3s",
    },
    toggleDot: {
        width: 8, height: 8, borderRadius: "50%",
        background: "rgba(255,255,255,.7)",
    },
    logoutBtn: {
        background: "transparent", border: "2px solid rgba(255,255,255,.3)",
        color: "rgba(255,255,255,.8)", borderRadius: 50,
        padding: "7px 16px", cursor: "pointer",
        fontFamily: "Nunito,sans-serif", fontWeight: 700, fontSize: ".85rem",
    },

    statsBar: {
        background: "#e63329",
        display: "flex", justifyContent: "space-around",
        padding: "16px", flexWrap: "wrap", gap: 8,
    },
    statBox: { textAlign: "center", color: "#fff" },
    statIcon: { fontSize: "1.2rem" },
    statValue: { fontFamily: "'Boogaloo',cursive", fontSize: "1.5rem" },
    statLabel: { fontSize: ".7rem", opacity: .8, fontWeight: 700 },

    tabs: {
        display: "flex",
        background: "#fff",
        boxShadow: "0 2px 8px rgba(0,0,0,.06)",
    },
    tab: {
        flex: 1, padding: "14px 8px",
        background: "none", border: "none",
        cursor: "pointer", fontFamily: "Nunito,sans-serif",
        fontSize: ".88rem", transition: "all .2s",
    },

    sectionTitle: {
        fontFamily: "'Boogaloo',cursive",
        fontSize: "1.4rem", color: "#7c2d12", marginBottom: 14,
    },

    deliveryCard: {
        background: "#fff", borderRadius: 16, padding: 18,
        marginBottom: 14, boxShadow: "0 4px 16px rgba(0,0,0,.06)",
    },
    deliveryTop: {
        display: "flex", justifyContent: "space-between",
        alignItems: "center", marginBottom: 10,
    },
    orderId: { fontFamily: "'Boogaloo',cursive", fontSize: "1.1rem", color: "#1c0a00", marginRight: 8 },
    orderTime: { fontSize: ".75rem", color: "#bbb" },
    customerInfo: {
        fontSize: ".85rem", color: "#444",
        display: "flex", flexWrap: "wrap",
        gap: "4px 20px", marginBottom: 10,
    },
    itemsList: { display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 },
    itemChip: {
        background: "#fff8f0", color: "#7c2d12",
        border: "1px solid #fde68a", borderRadius: 50,
        padding: "3px 10px", fontSize: ".78rem", fontWeight: 700,
    },
    deliveryFooter: {
        display: "flex", justifyContent: "space-between", alignItems: "center",
    },
    orderTotal: { fontFamily: "'Boogaloo',cursive", fontSize: "1.3rem", color: "#e63329" },
    completeBtn: {
        background: "#16a34a", color: "#fff", border: "none",
        borderRadius: 50, padding: "9px 20px", cursor: "pointer",
        fontFamily: "Nunito,sans-serif", fontWeight: 700, fontSize: ".88rem",
    },

    emptyBox: {
        textAlign: "center", padding: "48px 20px",
        background: "#fff", borderRadius: 20,
        boxShadow: "0 4px 16px rgba(0,0,0,.06)",
    },
    emptyTitle: {
        fontFamily: "'Boogaloo',cursive",
        fontSize: "1.5rem", color: "#555", marginBottom: 8,
    },
    goOnlineBtn: {
        background: "#16a34a", color: "#fff", border: "none",
        borderRadius: 50, padding: "10px 24px", cursor: "pointer",
        fontFamily: "'Boogaloo',cursive", fontSize: "1.1rem", marginTop: 12,
    },

    mapHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
    coordChip: {
        background: "#1c0a00", color: "#fbbf24",
        borderRadius: 50, padding: "4px 14px",
        fontSize: ".78rem", fontWeight: 700, fontFamily: "monospace",
    },
    mapBox: {
        width: "100%", height: 420, borderRadius: 16,
        overflow: "hidden", boxShadow: "0 4px 20px rgba(0,0,0,.12)",
        border: "3px solid #e63329",
    },
    mapLegend: {
        display: "flex", gap: 24, marginTop: 10,
        fontSize: ".85rem", color: "#888", fontWeight: 700,
    },

    earningsGrid: {
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
        gap: 14,
    },
    earningCard: {
        background: "#fff", borderRadius: 16, padding: 20,
        textAlign: "center", boxShadow: "0 4px 16px rgba(0,0,0,.06)",
    },
    earningRow: {
        background: "#fff", borderRadius: 12, padding: "14px 18px",
        marginBottom: 8, display: "flex", justifyContent: "space-between",
        alignItems: "center", boxShadow: "0 2px 8px rgba(0,0,0,.04)",
    },

    toast: {
        position: "fixed", bottom: 24, left: "50%",
        background: "#1c0a00", color: "#fff",
        padding: "12px 24px", borderRadius: 50,
        fontWeight: 700, fontSize: ".9rem",
        zIndex: 999, transition: "transform .35s ease",
        pointerEvents: "none", whiteSpace: "nowrap",
        boxShadow: "0 4px 20px rgba(0,0,0,.25)",
    },
};
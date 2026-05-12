// src/Pages/TrackOrder.jsx
// Customer sees live map with rider location + order status
// Route: /track/:orderId

import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { trackOrder } from "../api";

const STATUS_CONFIG = {
    "New": { step: 0, icon: "🆕", color: "#b45309", msg: "Order received!" },
    "Making": { step: 1, icon: "👨‍🍳", color: "#1d4ed8", msg: "Being prepared fresh!" },
    "Ready": { step: 2, icon: "✅", color: "#065f46", msg: "Ready for pickup by rider" },
    "Out for Delivery": { step: 3, icon: "🛵", color: "#e63329", msg: "Rider is on the way!" },
    "Delivered": { step: 4, icon: "🏠", color: "#374151", msg: "Delivered! Enjoy your pizza!" },
};
const STEPS = ["New", "Making", "Ready", "Out for Delivery", "Delivered"];

export default function TrackOrder() {
    const { orderId } = useParams();
    const navigate = useNavigate();
    const [orderData, setOrderData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const mapRef = useRef(null);
    const mapInstance = useRef(null);
    const riderMarker = useRef(null);
    const wsRef = useRef(null);

    const token = localStorage.getItem("token");

    // ── Load order data ────────────────────────────────
    async function load() {
        try {
            const data = await trackOrder(orderId, token);
            setOrderData(data);
        } catch (err) {
            setError(err.message || "Order not found");
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => { load(); }, [orderId]);

    // ── WebSocket — live rider location + status ───────
    useEffect(() => {
        function connect() {
            const ws = new WebSocket("ws://127.0.0.1:8000/ws");
            wsRef.current = ws;

            ws.onmessage = (e) => {
                const msg = JSON.parse(e.data);

                if (msg.type === "RIDER_LOCATION" && orderData?.order?.rider_id === msg.rider_id) {
                    // Move rider marker on map
                    if (riderMarker.current) {
                        riderMarker.current.setLatLng([msg.lat, msg.lng]);
                    }
                }

                if (msg.type === "ORDER_UPDATE" && msg.order_id === orderId) {
                    setOrderData(prev => prev ? {
                        ...prev,
                        order: { ...prev.order, status: msg.status }
                    } : prev);
                }

                if (msg.type === "RIDER_ASSIGNED" && msg.order_id === orderId) {
                    load(); // Reload to get rider info
                }
            };

            ws.onclose = () => setTimeout(connect, 3000);
        }
        connect();
        return () => wsRef.current?.close();
    }, [orderId, orderData?.order?.rider_id]);

    // ── Init map ───────────────────────────────────────
    useEffect(() => {
        if (!orderData || mapInstance.current) return;

        setTimeout(() => {
            if (!mapRef.current) return;
            const L = window.L;
            if (!L) return;

            const customerLat = orderData.order.customer_lat || 23.7937;
            const customerLng = orderData.order.customer_lng || 90.4066;
            const riderLat = orderData.rider?.lat || 23.7830;
            const riderLng = orderData.rider?.lng || 90.4050;

            const map = L.map(mapRef.current).setView(
                [customerLat, customerLng], 13
            );
            mapInstance.current = map;

            L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
                attribution: "© OpenStreetMap contributors",
            }).addTo(map);

            // Customer marker
            const homeIcon = L.divIcon({
                html: `<div style="background:#fbbf24;width:38px;height:38px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:1.3rem;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.3)">🏠</div>`,
                className: "", iconSize: [38, 38], iconAnchor: [19, 19],
            });
            L.marker([customerLat, customerLng], { icon: homeIcon })
                .addTo(map)
                .bindPopup("📍 Your delivery address");

            // Restaurant marker
            const shopIcon = L.divIcon({
                html: `<div style="background:#e63329;width:38px;height:38px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:1.3rem;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.3)">🍕</div>`,
                className: "", iconSize: [38, 38], iconAnchor: [19, 19],
            });
            L.marker([23.7945, 90.4017], { icon: shopIcon })
                .addTo(map)
                .bindPopup("🍕 PizzaFizz Kitchen");

            // Rider marker (if assigned)
            if (orderData.rider) {
                const riderIcon = L.divIcon({
                    html: `<div style="background:#16a34a;width:42px;height:42px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:1.5rem;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.3);animation:pulse 1.5s infinite">🛵</div>`,
                    className: "", iconSize: [42, 42], iconAnchor: [21, 21],
                });
                riderMarker.current = L.marker([riderLat, riderLng], { icon: riderIcon })
                    .addTo(map)
                    .bindPopup(`🛵 ${orderData.rider.name} is on the way!`);

                // Fit map to show both rider and customer
                map.fitBounds([
                    [customerLat, customerLng],
                    [riderLat, riderLng],
                ], { padding: [40, 40] });
            }
        }, 300);

        return () => {
            if (mapInstance.current) {
                mapInstance.current.remove();
                mapInstance.current = null;
            }
        };
    }, [orderData]);

    if (loading) {
        return (
            <div style={styles.centerPage}>
                <div style={{ fontSize: "3rem", marginBottom: 12 }}>⏳</div>
                <p style={{ color: "#888" }}>Loading tracking info…</p>
            </div>
        );
    }

    if (error) {
        return (
            <div style={styles.centerPage}>
                <div style={{ fontSize: "3rem", marginBottom: 12 }}>❌</div>
                <p style={{ color: "#e63329", fontWeight: 700 }}>{error}</p>
                <button onClick={() => navigate("/my-orders")} style={styles.backBtn}>
                    ← My Orders
                </button>
            </div>
        );
    }

    const { order, rider } = orderData;
    const statusCfg = STATUS_CONFIG[order.status] || STATUS_CONFIG["New"];
    const currentStep = STEPS.indexOf(order.status);

    return (
        <>
            <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
            <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" />

            <div style={{ background: "#fff8f0", minHeight: "calc(100vh - 68px)" }}>

                {/* ── Header ── */}
                <div style={styles.header}>
                    <button onClick={() => navigate("/my-orders")} style={styles.backBtn2}>
                        ← Back
                    </button>
                    <div>
                        <h2 style={styles.title}>📍 Track Order</h2>
                        <p style={styles.orderId}>#{order.id}</p>
                    </div>
                    <div style={{
                        background: statusCfg.color, color: "#fff",
                        borderRadius: 50, padding: "6px 16px",
                        fontWeight: 800, fontSize: ".85rem",
                    }}>
                        {statusCfg.icon} {order.status}
                    </div>
                </div>

                <div style={{ maxWidth: 760, margin: "0 auto", padding: "24px 16px" }}>

                    {/* ── Status message ── */}
                    <div style={{
                        ...styles.statusBanner,
                        background: statusCfg.color,
                    }}>
                        <span style={{ fontSize: "2rem" }}>{statusCfg.icon}</span>
                        <div>
                            <div style={{ fontFamily: "'Boogaloo',cursive", fontSize: "1.3rem" }}>
                                {order.status}
                            </div>
                            <div style={{ fontSize: ".88rem", opacity: .9 }}>
                                {statusCfg.msg}
                            </div>
                        </div>
                    </div>

                    {/* ── Progress tracker ── */}
                    <div style={styles.progressWrap}>
                        <div style={styles.progressLine} />
                        <div style={{
                            ...styles.progressFill,
                            width: `${(currentStep / (STEPS.length - 1)) * 100}%`,
                        }} />
                        {STEPS.map((step, i) => {
                            const done = i <= currentStep;
                            const active = i === currentStep;
                            return (
                                <div key={step} style={styles.stepWrap}>
                                    <div style={{
                                        ...styles.stepDot,
                                        background: done ? statusCfg.color : "#e5e7eb",
                                        transform: active ? "scale(1.3)" : "scale(1)",
                                        boxShadow: active ? `0 0 0 5px rgba(230,51,41,.15)` : "none",
                                        transition: "all .4s",
                                    }}>
                                        {done ? "✓" : ""}
                                    </div>
                                    <div style={{
                                        ...styles.stepLabel,
                                        color: done ? statusCfg.color : "#bbb",
                                        fontWeight: active ? 800 : 500,
                                        fontSize: ".65rem",
                                    }}>
                                        {step}
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* ── Rider info (if assigned) ── */}
                    {rider && (
                        <div style={styles.riderCard}>
                            <div style={styles.riderAvatar}>🛵</div>
                            <div style={{ flex: 1 }}>
                                <div style={{ fontWeight: 800, fontSize: "1rem" }}>{rider.name}</div>
                                <div style={{ fontSize: ".85rem", color: "#888" }}>Your delivery rider</div>
                                {rider.phone && (
                                    <div style={{ fontSize: ".85rem", color: "#e63329", marginTop: 2 }}>
                                        📞 {rider.phone}
                                    </div>
                                )}
                            </div>
                            <div style={styles.liveChip}>🔴 Live</div>
                        </div>
                    )}

                    {/* ── Map ── */}
                    <div style={styles.mapCard}>
                        <div style={{ fontFamily: "'Boogaloo',cursive", fontSize: "1.2rem", color: "#7c2d12", marginBottom: 10 }}>
                            🗺️ Live Map
                        </div>
                        <div ref={mapRef} style={styles.mapBox} />
                        <div style={styles.mapLegend}>
                            <span>🍕 Kitchen</span>
                            <span>🛵 Rider</span>
                            <span>🏠 You</span>
                        </div>
                    </div>

                    {/* ── Order summary ── */}
                    <div style={styles.summaryCard}>
                        <h4 style={styles.summaryTitle}>📋 Order Summary</h4>
                        {(order.items || []).map((item, i) => (
                            <div key={i} style={styles.summaryRow}>
                                <span>🍕 {item.qty}× {item.size} — {item.crust} crust, {item.sauce} sauce</span>
                                <span style={{ fontWeight: 700, color: "#e63329" }}>৳{item.price * item.qty}</span>
                            </div>
                        ))}
                        <div style={styles.summaryTotal}>
                            <span>Total</span>
                            <span>৳{order.total}</span>
                        </div>
                    </div>

                </div>
            </div>

            <style>{`
        @keyframes pulse {
          0%,100% { box-shadow: 0 0 0 0 rgba(22,163,74,.4); }
          50%      { box-shadow: 0 0 0 10px rgba(22,163,74,0); }
        }
      `}</style>
        </>
    );
}

const styles = {
    centerPage: {
        minHeight: "calc(100vh - 68px)", display: "flex",
        flexDirection: "column", alignItems: "center", justifyContent: "center",
        textAlign: "center", padding: 20,
    },
    header: {
        background: "#1c0a00", padding: "16px 24px",
        display: "flex", alignItems: "center",
        justifyContent: "space-between", gap: 12, flexWrap: "wrap",
    },
    title: { fontFamily: "'Boogaloo',cursive", fontSize: "1.5rem", color: "#fff", marginBottom: 0 },
    orderId: { color: "#fbbf24", fontSize: ".82rem", fontWeight: 700 },
    backBtn: {
        background: "#e63329", color: "#fff", border: "none",
        borderRadius: 50, padding: "10px 20px", cursor: "pointer",
        fontFamily: "Nunito,sans-serif", fontWeight: 700, marginTop: 12,
    },
    backBtn2: {
        background: "transparent", color: "rgba(255,255,255,.7)",
        border: "2px solid rgba(255,255,255,.2)", borderRadius: 50,
        padding: "7px 16px", cursor: "pointer",
        fontFamily: "Nunito,sans-serif", fontWeight: 700, fontSize: ".85rem",
    },

    statusBanner: {
        borderRadius: 16, padding: "18px 24px", color: "#fff",
        display: "flex", alignItems: "center", gap: 16, marginBottom: 24,
    },

    progressWrap: {
        display: "flex", justifyContent: "space-between",
        padding: "20px 16px 8px", position: "relative",
        background: "#fff", borderRadius: 16,
        boxShadow: "0 4px 16px rgba(0,0,0,.06)", marginBottom: 20,
    },
    progressLine: {
        position: "absolute", top: 30, left: 40, right: 40,
        height: 3, background: "#e5e7eb", zIndex: 0,
    },
    progressFill: {
        position: "absolute", top: 30, left: 40,
        height: 3, background: "#e63329", zIndex: 1, transition: "width .6s ease",
    },
    stepWrap: { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", zIndex: 2 },
    stepDot: {
        width: 26, height: 26, borderRadius: "50%",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: ".72rem", color: "#fff", fontWeight: 800,
    },
    stepLabel: { marginTop: 6, textAlign: "center", lineHeight: 1.2 },

    riderCard: {
        background: "#fff", borderRadius: 16, padding: "16px 20px",
        display: "flex", alignItems: "center", gap: 14, marginBottom: 20,
        boxShadow: "0 4px 16px rgba(0,0,0,.06)",
        border: "2px solid #16a34a",
    },
    riderAvatar: {
        width: 50, height: 50, borderRadius: "50%",
        background: "#16a34a", display: "flex",
        alignItems: "center", justifyContent: "center", fontSize: "1.5rem",
    },
    liveChip: {
        background: "#dcfce7", color: "#16a34a",
        borderRadius: 50, padding: "4px 12px",
        fontSize: ".78rem", fontWeight: 800,
    },

    mapCard: {
        background: "#fff", borderRadius: 16, padding: 20,
        boxShadow: "0 4px 16px rgba(0,0,0,.06)", marginBottom: 20,
    },
    mapBox: {
        width: "100%", height: 360, borderRadius: 12,
        overflow: "hidden", border: "2px solid #e5e7eb",
    },
    mapLegend: {
        display: "flex", gap: 20, marginTop: 10,
        fontSize: ".82rem", color: "#888", fontWeight: 700,
    },

    summaryCard: {
        background: "#fff", borderRadius: 16, padding: 20,
        boxShadow: "0 4px 16px rgba(0,0,0,.06)",
    },
    summaryTitle: {
        fontFamily: "'Boogaloo',cursive",
        fontSize: "1.2rem", color: "#7c2d12", marginBottom: 12,
    },
    summaryRow: {
        display: "flex", justifyContent: "space-between",
        fontSize: ".85rem", color: "#444", padding: "6px 0",
        borderBottom: "1px dashed #fde68a",
    },
    summaryTotal: {
        display: "flex", justifyContent: "space-between",
        fontFamily: "'Boogaloo',cursive", fontSize: "1.3rem",
        color: "#e63329", marginTop: 10, paddingTop: 8,
        borderTop: "2px solid #fde68a",
    },
};
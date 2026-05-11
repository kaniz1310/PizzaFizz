// src/Pages/Cart.jsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCart } from "../Context/CartContext";
import { placeOrder } from "../api";

export default function Cart() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [toast, setToast] = useState("");

    const { cart, removeFromCart, updateQty, clearCart } = useCart();

    // ── Safe price calculation ─────────────────────────────────
    // parseFloat guards against undefined/NaN coming from context
    const subtotal = cart.reduce((sum, item) => {
        const price = parseFloat(item.price) || 0;
        const qty = parseInt(item.qty) || 1;
        return sum + price * qty;
    }, 0);

    const delivery = 50;
    const total = subtotal + delivery;

    function showToast(msg) {
        setToast(msg);
        setTimeout(() => setToast(""), 3000);
    }

    // ── Parse any error into a readable string ─────────────────
    function parseError(err) {
        if (!err) return "Something went wrong";
        if (typeof err === "string") return err;
        if (err.message) {
            // If message is "[object Object]" unwrap it
            if (err.message === "[object Object]") return "Order failed — check backend is running";
            return err.message;
        }
        if (err.detail) {
            if (Array.isArray(err.detail)) {
                return err.detail.map(d => d.msg || JSON.stringify(d)).join(", ");
            }
            return String(err.detail);
        }
        return JSON.stringify(err);
    }

    async function handlePlaceOrder() {
        const user = JSON.parse(localStorage.getItem("user") || "null");
        const token = localStorage.getItem("token");

        if (!user || !token) {
            showToast("⚠️ Please sign in first!");
            setTimeout(() => navigate("/login"), 1200);
            return;
        }
        if (!cart.length) return;

        setLoading(true);
        try {
            const payload = {
                items: cart.map(item => ({
                    name: item.name || `${item.size} Pizza`,
                    size: item.size || "Medium",
                    crust: item.crust || "Classic",
                    sauce: item.sauce || "Tomato",
                    toppings: (item.toppings || []).map(t =>
                        typeof t === "string"
                            ? { label: t, icon: "", price: 0 }
                            : { label: t.label || "", icon: t.icon || "", price: t.price || 0 }
                    ),
                    price: parseFloat(item.price) || 0,
                    qty: parseInt(item.qty) || 1,
                })),
                subtotal,
                total,
            };

            const data = await placeOrder(payload, token);
            clearCart();
            showToast("🎉 Order placed successfully!");
            setTimeout(() => {
                navigate("/confirm", { state: { order: data.order } });
            }, 700);

        } catch (err) {
            showToast("❌ " + parseError(err));
        } finally {
            setLoading(false);
        }
    }

    // ── Empty cart ─────────────────────────────────────────────
    if (!cart.length) {
        return (
            <div style={styles.emptyWrap}>
                <div style={{ fontSize: "5rem" }}>🛒</div>
                <h3 style={styles.emptyTitle}>Your cart is empty!</h3>
                <p style={{ color: "#aaa", marginBottom: 8 }}>Go build a pizza first 🍕</p>
                <button onClick={() => navigate("/customize")} style={styles.yellowBtn}>
                    Build a Pizza
                </button>
            </div>
        );
    }

    const user = JSON.parse(localStorage.getItem("user") || "null");

    return (
        <div style={styles.wrap}>
            <h2 style={styles.pageTitle}>🛒 Your Cart</h2>

            {/* ── Cart items ── */}
            {cart.map(item => {
                const qty = parseInt(item.qty) || 1;
                const price = parseFloat(item.price) || 0;
                return (
                    <div key={item.id} style={styles.cartItem}>
                        <div style={{ fontSize: "2.5rem" }}>🍕</div>

                        <div style={{ flex: 1 }}>
                            <h4 style={styles.itemName}>
                                {item.name || `${item.size} Pizza`} — {item.crust} Crust
                            </h4>
                            <p style={styles.itemSub}>
                                {item.sauce} sauce
                                {item.toppings?.length
                                    ? " • " + item.toppings.map(t => t.label || t).join(", ")
                                    : ""}
                            </p>

                            {/* Qty controls */}
                            <div style={styles.qtyRow}>
                                <QtyBtn onClick={() => updateQty(item.id, qty - 1)}>−</QtyBtn>
                                <span style={styles.qtyNum}>{qty}</span>
                                <QtyBtn onClick={() => updateQty(item.id, qty + 1)}>+</QtyBtn>
                            </div>
                        </div>

                        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
                            <span style={styles.itemPrice}>৳{price * qty}</span>
                            <button onClick={() => removeFromCart(item.id)} style={styles.removeBtn}>🗑</button>
                        </div>
                    </div>
                );
            })}

            {/* ── Order summary ── */}
            <div style={styles.summaryCard}>
                <h3 style={styles.summaryTitle}>Order Summary</h3>

                {/* Delivery address */}
                <div style={styles.deliveryBox}>
                    <div style={{ fontWeight: 700, marginBottom: 6, fontSize: ".9rem" }}>
                        📦 Deliver to:
                    </div>
                    {user ? (
                        <div style={{ fontSize: ".88rem", lineHeight: 1.7 }}>
                            <div>{user.name}</div>
                            <div>{user.address}</div>
                            <div>{user.phone}</div>
                        </div>
                    ) : (
                        <div style={{ color: "#fbbf24", fontSize: ".88rem" }}>
                            ⚠️ Please sign in to place an order
                        </div>
                    )}
                </div>

                <SRow label="Subtotal" value={`৳${subtotal}`} />
                <SRow label="Delivery" value={`৳${delivery}`} />

                <div style={styles.totalRow}>
                    <span>Total</span>
                    <span>৳{total}</span>
                </div>

                <button
                    onClick={handlePlaceOrder}
                    disabled={loading}
                    style={{
                        ...styles.orderBtn,
                        opacity: loading ? 0.7 : 1,
                        cursor: loading ? "not-allowed" : "pointer",
                    }}
                >
                    {loading ? "⏳ Placing Order…" : "🎉 Place Order"}
                </button>
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
        </div>
    );
}

// ── Sub-components ─────────────────────────────────────────────
function QtyBtn({ children, onClick }) {
    return (
        <button onClick={onClick} style={styles.qtyBtn}>{children}</button>
    );
}

function SRow({ label, value }) {
    return (
        <div style={styles.summaryRow}>
            <span>{label}</span>
            <span>{value}</span>
        </div>
    );
}

// ── Styles ─────────────────────────────────────────────────────
const styles = {
    wrap: { maxWidth: 700, margin: "0 auto", padding: "32px 16px" },
    pageTitle: {
        fontFamily: "'Boogaloo', cursive",
        fontSize: "2.2rem", color: "#e63329", marginBottom: 24,
    },

    cartItem: {
        background: "#fff", borderRadius: 20, padding: 20, marginBottom: 16,
        boxShadow: "0 4px 16px rgba(0,0,0,.06)",
        display: "flex", gap: 16, alignItems: "center",
    },
    itemName: { fontWeight: 800, fontSize: "1rem" },
    itemSub: { fontSize: ".82rem", color: "#888", marginTop: 2 },
    itemPrice: {
        fontFamily: "'Boogaloo', cursive",
        fontSize: "1.4rem", color: "#e63329",
    },
    removeBtn: {
        background: "none", border: "none",
        fontSize: "1.3rem", cursor: "pointer", color: "#ccc",
    },

    qtyRow: { display: "flex", alignItems: "center", gap: 8, marginTop: 8 },
    qtyBtn: {
        width: 30, height: 30, borderRadius: "50%",
        border: "2px solid #e63329", background: "#fff", color: "#e63329",
        fontSize: "1.1rem", fontWeight: 900, cursor: "pointer",
        display: "flex", alignItems: "center", justifyContent: "center",
    },
    qtyNum: { fontWeight: 800, fontSize: "1rem", minWidth: 24, textAlign: "center" },

    summaryCard: {
        background: "linear-gradient(135deg, #e63329, #f97316)",
        borderRadius: 20, padding: 24, color: "#fff", marginTop: 24,
    },
    summaryTitle: {
        fontFamily: "'Boogaloo', cursive",
        fontSize: "1.5rem", marginBottom: 16,
    },
    deliveryBox: {
        background: "rgba(0,0,0,.15)",
        borderRadius: 12, padding: "12px 16px", marginBottom: 16,
    },
    summaryRow: {
        display: "flex", justifyContent: "space-between",
        marginBottom: 8, fontSize: ".95rem",
    },
    totalRow: {
        display: "flex", justifyContent: "space-between",
        borderTop: "2px solid rgba(255,255,255,.3)",
        paddingTop: 10, marginTop: 8,
        fontFamily: "'Boogaloo', cursive", fontSize: "1.8rem",
    },
    orderBtn: {
        width: "100%", padding: 16,
        background: "#fff", color: "#e63329", border: "none",
        borderRadius: 50, fontFamily: "'Boogaloo', cursive",
        fontSize: "1.4rem", marginTop: 16,
    },

    emptyWrap: {
        textAlign: "center", padding: "80px 20px",
        minHeight: "calc(100vh - 68px)",
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
    },
    emptyTitle: {
        fontFamily: "'Boogaloo', cursive",
        fontSize: "1.8rem", marginTop: 12, color: "#555",
    },
    yellowBtn: {
        background: "#fbbf24", color: "#1c0a00", border: "none",
        borderRadius: 50, padding: "12px 28px", cursor: "pointer",
        fontFamily: "'Boogaloo', cursive", fontSize: "1.1rem", marginTop: 16,
    },

    toast: {
        position: "fixed", bottom: 24, left: "50%",
        background: "#1c0a00", color: "#fff",
        padding: "12px 28px", borderRadius: 50,
        fontWeight: 700, fontSize: ".95rem",
        zIndex: 999, transition: "transform .35s ease",
        pointerEvents: "none", whiteSpace: "nowrap",
    },
};
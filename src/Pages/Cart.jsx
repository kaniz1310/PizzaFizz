// src/Pages/Cart.jsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCart } from "../Context/CartContext";
import { placeOrder, initiatePayment, getMe } from "../api";

export default function Cart() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [toast, setToast] = useState("");
    const [paymentMethod, setPaymentMethod] = useState("");
    const [paymentConfirmed, setPaymentConfirmed] = useState(false);
    const [paymentForm, setPaymentForm] = useState({
        bkash_number: "",
        bkash_otp: "",
        card_last4: "",
    });

    const { cart, removeFromCart, updateQty, clearCart } = useCart();

    // Price calculations
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

    function selectPaymentMethod(method) {
        setPaymentMethod(method);
        setPaymentConfirmed(false);
    }

    function updatePaymentField(field, value) {
        setPaymentForm(prev => ({ ...prev, [field]: value }));
    }

    function hasPaymentDetails() {
        if (!paymentMethod) return false;
        if (paymentMethod === "cod") return true;
        if (paymentMethod === "bkash") {
            return paymentForm.bkash_number.trim() && paymentForm.bkash_otp.trim();
        }
        if (paymentMethod === "card") {
            return paymentForm.card_last4.trim().length === 4;
        }
        return false;
    }

    const canPlaceOrder = Boolean(paymentMethod && hasPaymentDetails() && paymentConfirmed);

    // Improved error parser
    function parseError(err) {
        if (!err) return "Something went wrong";
        if (typeof err === "string") return err;
        if (err.message) return err.message;
        if (err.detail) {
            if (Array.isArray(err.detail)) {
                return err.detail.map(d => d.msg || JSON.stringify(d)).join(", ");
            }
            return String(err.detail);
        }
        return JSON.stringify(err);
    }

    async function handlePlaceOrder() {
        const token = localStorage.getItem("token");
        const user = JSON.parse(localStorage.getItem("user") || "null");

        if (!token || !user) {
            showToast("⚠️ Please sign in first!");
            setTimeout(() => navigate("/login"), 1500);
            return;
        }

        if (!cart.length) return;
        if (!paymentMethod || !hasPaymentDetails() || !paymentConfirmed) {
            showToast("Please complete payment details and confirmation.");
            return;
        }

        setLoading(true);

        try {
            // Optional: Verify token is still valid
            // await getMe(token);

            const payload = {
                items: cart.map(item => ({
                    name: item.name || `${item.size} Pizza`,
                    size: item.size || "Medium",
                    crust: item.crust || "Classic",
                    sauce: item.sauce || "Tomato",
                    toppings: (item.toppings || []).map(t =>
                        typeof t === "string" ? { label: t } : t
                    ),
                    price: parseFloat(item.price) || 0,
                    qty: parseInt(item.qty) || 1,
                })),
                subtotal,
                total,
                payment_method: paymentMethod,
                ...(paymentMethod === "bkash" && {
                    bkash_number: paymentForm.bkash_number,
                    bkash_otp: paymentForm.bkash_otp,
                }),
                ...(paymentMethod === "card" && {
                    card_last4: paymentForm.card_last4,
                }),
            };

            console.log("📤 Sending order with token:", token.substring(0, 30) + "...");

            const data = paymentMethod === "cod"
                ? await placeOrder(payload, token)
                : await initiatePayment(payload, token);

            clearCart();
            showToast(data.message || "✅ Order placed successfully!");

            setTimeout(() => {
                navigate("/confirm", { state: { order: data.order || data } });
            }, 800);

        } catch (err) {
            console.error("❌ Place Order Error:", err);
            const errorMsg = parseError(err);
            showToast("❌ " + errorMsg);

            // Auto logout on authentication issues
            if (errorMsg.includes("401") ||
                errorMsg.toLowerCase().includes("unauthorized") ||
                errorMsg.toLowerCase().includes("user not found")) {
                localStorage.removeItem("token");
                localStorage.removeItem("user");
                showToast("Session expired. Please login again.");
                setTimeout(() => navigate("/login"), 1800);
            }
        } finally {
            setLoading(false);
        }
    }

    // Empty Cart View
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

            {/* Cart Items */}
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

            {/* Order Summary */}
            <div style={styles.summaryCard}>
                <h3 style={styles.summaryTitle}>Order Summary</h3>

                {/* Delivery Address */}
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

                {/* Payment Section */}
                <div style={styles.paymentBox}>
                    <div style={{ fontWeight: 800, marginBottom: 10, fontSize: ".92rem" }}>
                        Payment method required
                    </div>

                    <div style={styles.paymentOptions}>
                        {[
                            { value: "cod", label: "Cash" },
                            { value: "bkash", label: "bKash" },
                            { value: "card", label: "Card" },
                        ].map(option => (
                            <button
                                key={option.value}
                                type="button"
                                onClick={() => selectPaymentMethod(option.value)}
                                style={{
                                    ...styles.paymentOption,
                                    background: paymentMethod === option.value ? "#fff" : "rgba(255,255,255,.15)",
                                    color: paymentMethod === option.value ? "#e63329" : "#fff",
                                }}
                            >
                                {option.label}
                            </button>
                        ))}
                    </div>

                    {paymentMethod === "bkash" && (
                        <div>
                            <input
                                value={paymentForm.bkash_number}
                                onChange={e => updatePaymentField("bkash_number", e.target.value)}
                                placeholder="bKash number: 01XXXXXXXXX"
                                style={styles.paymentInput}
                            />
                            <input
                                value={paymentForm.bkash_otp}
                                onChange={e => updatePaymentField("bkash_otp", e.target.value)}
                                placeholder="bKash OTP"
                                style={styles.paymentInput}
                            />
                        </div>
                    )}

                    {paymentMethod === "card" && (
                        <input
                            value={paymentForm.card_last4}
                            onChange={e => updatePaymentField("card_last4", e.target.value.replace(/\D/g, "").slice(0, 4))}
                            placeholder="Last 4 digits of card"
                            style={styles.paymentInput}
                        />
                    )}

                    <div style={styles.paymentNote}>
                        {paymentMethod === "cod" && "Cash on delivery: confirm you will pay the rider when the pizza arrives."}
                        {paymentMethod === "bkash" && "bKash sandbox checkout will validate the number and OTP before creating the order."}
                        {paymentMethod === "card" && "Card checkout is initiated before the order is confirmed."}
                    </div>

                    {paymentMethod && (
                        <label style={{
                            ...styles.paymentConfirm,
                            opacity: hasPaymentDetails() ? 1 : 0.55,
                        }}>
                            <input
                                type="checkbox"
                                checked={paymentConfirmed}
                                disabled={!hasPaymentDetails()}
                                onChange={e => setPaymentConfirmed(e.target.checked)}
                            />
                            <span>
                                {paymentMethod === "cod"
                                    ? "I confirm I will pay cash on delivery."
                                    : "I confirm these payment details are correct."}
                            </span>
                        </label>
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
                    disabled={loading || !canPlaceOrder}
                    style={{
                        ...styles.orderBtn,
                        opacity: loading || !canPlaceOrder ? 0.62 : 1,
                        cursor: loading || !canPlaceOrder ? "not-allowed" : "pointer",
                    }}
                >
                    {loading ? "Processing..." : paymentMethod === "cod" ? "Confirm COD & Place Order" : "Confirm Payment & Place Order"}
                </button>
            </div>

            {/* Toast Notification */}
            <div style={{
                ...styles.toast,
                transform: toast ? "translateX(-50%) translateY(0)" : "translateX(-50%) translateY(100px)",
            }}>
                {toast}
            </div>
        </div>
    );
}

// Sub Components
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

// Styles
const styles = {
    wrap: { maxWidth: 700, margin: "0 auto", padding: "32px 16px" },
    pageTitle: { fontFamily: "'Boogaloo', cursive", fontSize: "2.2rem", color: "#e63329", marginBottom: 24 },

    cartItem: {
        background: "#fff", borderRadius: 20, padding: 20, marginBottom: 16,
        boxShadow: "0 4px 16px rgba(0,0,0,.06)", display: "flex", gap: 16, alignItems: "center",
    },
    itemName: { fontWeight: 800, fontSize: "1rem" },
    itemSub: { fontSize: ".82rem", color: "#888", marginTop: 2 },
    itemPrice: { fontFamily: "'Boogaloo', cursive", fontSize: "1.4rem", color: "#e63329" },
    removeBtn: { background: "none", border: "none", fontSize: "1.3rem", cursor: "pointer", color: "#ccc" },

    qtyRow: { display: "flex", alignItems: "center", gap: 8, marginTop: 8 },
    qtyBtn: {
        width: 30, height: 30, borderRadius: "50%", border: "2px solid #e63329",
        background: "#fff", color: "#e63329", fontSize: "1.1rem", fontWeight: 900,
        cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
    },
    qtyNum: { fontWeight: 800, fontSize: "1rem", minWidth: 24, textAlign: "center" },

    summaryCard: {
        background: "linear-gradient(135deg, #e63329, #f97316)", borderRadius: 20,
        padding: 24, color: "#fff", marginTop: 24,
    },
    summaryTitle: { fontFamily: "'Boogaloo', cursive", fontSize: "1.5rem", marginBottom: 16 },
    deliveryBox: { background: "rgba(0,0,0,.15)", borderRadius: 12, padding: "12px 16px", marginBottom: 16 },
    paymentBox: { background: "rgba(0,0,0,.15)", borderRadius: 12, padding: "12px 16px", marginBottom: 16 },
    paymentOptions: { display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8, marginBottom: 10 },
    paymentOption: {
        border: "1px solid rgba(255,255,255,.45)", borderRadius: 10, padding: "8px 6px",
        cursor: "pointer", fontWeight: 800, fontSize: ".8rem",
    },
    paymentInput: {
        width: "100%", border: "none", borderRadius: 10, padding: "10px 12px",
        marginTop: 8, outline: "none", fontSize: ".9rem",
    },
    paymentNote: { fontSize: ".75rem", opacity: 0.9, marginTop: 8, lineHeight: 1.4 },
    paymentConfirm: { display: "flex", alignItems: "center", gap: 8, marginTop: 10, fontSize: ".82rem", fontWeight: 800, cursor: "pointer" },

    summaryRow: { display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: ".95rem" },
    totalRow: {
        display: "flex", justifyContent: "space-between", borderTop: "2px solid rgba(255,255,255,.3)",
        paddingTop: 10, marginTop: 8, fontFamily: "'Boogaloo', cursive", fontSize: "1.8rem",
    },
    orderBtn: {
        width: "100%", padding: 16, background: "#fff", color: "#e63329", border: "none",
        borderRadius: 50, fontFamily: "'Boogaloo', cursive", fontSize: "1.4rem", marginTop: 16,
    },

    emptyWrap: { textAlign: "center", padding: "80px 20px", minHeight: "calc(100vh - 68px)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" },
    emptyTitle: { fontFamily: "'Boogaloo', cursive", fontSize: "1.8rem", marginTop: 12, color: "#555" },
    yellowBtn: {
        background: "#fbbf24", color: "#1c0a00", border: "none", borderRadius: 50,
        padding: "12px 28px", cursor: "pointer", fontFamily: "'Boogaloo', cursive", fontSize: "1.1rem", marginTop: 16,
    },

    toast: {
        position: "fixed", bottom: 24, left: "50%", background: "#1c0a00", color: "#fff",
        padding: "12px 28px", borderRadius: 50, fontWeight: 700, fontSize: ".95rem",
        zIndex: 999, transition: "transform .35s ease", pointerEvents: "none", whiteSpace: "nowrap",
    },
};
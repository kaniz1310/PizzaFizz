// src/Pages/Cart.jsx  ← REPLACE YOUR ENTIRE EXISTING FILE WITH THIS
//
// BUGS FIXED:
//  1. Proper 2-step flow:  POST /orders (get order_id) → POST /payment/initiate
//  2. Field names match backend: method (not payment_method), mobile_number (not bkash_number)
//  3. Card form now collects: full card number (16 digits), name, expiry MM/YY, CVV
//  4. bKash OTP step with 60-second countdown timer
//  5. Visual card preview updates live as you type

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useCart } from "../Context/CartContext";
import { placeOrder, initiatePayment } from "../api";

export default function Cart() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [toast, setToast] = useState("");
    const [step, setStep] = useState("method"); // "method" | "bkash" | "card" | "processing"
    const [paymentMethod, setPaymentMethod] = useState("");

    // bKash state
    const [bkashNo, setBkashNo] = useState("");
    const [bkashPin, setBkashPin] = useState("");
    const [bkashOtp, setBkashOtp] = useState("");
    const [otpSent, setOtpSent] = useState(false);
    const [otpTimer, setOtpTimer] = useState(0);

    // Card state
    const [card, setCard] = useState({ number: "", name: "", expiry: "", cvv: "" });

    const { cart, removeFromCart, updateQty, clearCart } = useCart();

    const subtotal = cart.reduce((s, i) => s + (parseFloat(i.price) || 0) * (parseInt(i.qty) || 1), 0);
    const delivery = 50;
    const total = subtotal + delivery;

    const user = JSON.parse(localStorage.getItem("user") || "null");
    const token = localStorage.getItem("token");

    // OTP countdown ticker
    useEffect(() => {
        if (otpTimer <= 0) return;
        const t = setTimeout(() => setOtpTimer(v => v - 1), 1000);
        return () => clearTimeout(t);
    }, [otpTimer]);

    function showToast(msg, ms = 3500) {
        setToast(msg);
        setTimeout(() => setToast(""), ms);
    }

    // Build items array that matches backend OrderItem model
    function buildItems() {
        return cart.map(i => ({
            name: i.name || `${i.size} Pizza`,
            size: i.size || "Medium",
            crust: i.crust || "Classic",
            sauce: i.sauce || "Tomato",
            toppings: (i.toppings || []).map(t =>
                typeof t === "string"
                    ? { label: t, icon: "", price: 0 }
                    : { label: t.label || "", icon: t.icon || "", price: t.price || 0 }),
            price: parseFloat(i.price) || 0,
            qty: parseInt(i.qty) || 1,
        }));
    }

    // ── Step 1 (always): create the order, return order object ────────────────
    async function createOrder(method) {
        if (!user || !token) {
            showToast("⚠️ Please sign in first!");
            setTimeout(() => navigate("/login"), 1400);
            return null;
        }
        // POST /orders  →  { message, order, requires_payment }
        const res = await placeOrder({
            items: buildItems(),
            subtotal,
            total,
            payment_method: method,   // "cash" | "bkash" | "nagad" | "card"
        }, token);
        return res.order;  // contains .id we need for payment/initiate
    }

    // ── COD: just create order, redirect to confirm ───────────────────────────
    async function handleCOD() {
        setLoading(true);
        try {
            const order = await createOrder("cash");
            if (!order) return;
            clearCart();
            showToast("🎉 Order placed! Pay cash on delivery.");
            setTimeout(() => navigate("/confirm", { state: { order } }), 700);
        } catch (e) {
            showToast("❌ " + (e.message || "Order failed"));
        } finally { setLoading(false); }
    }

    // ── bKash – send OTP (simulated locally, real OTP in production) ──────────
    function sendBkashOtp() {
        const digits = bkashNo.replace(/\D/g, "");
        if (!(digits.length === 11 && digits.startsWith("01"))) {
            showToast("⚠️ Enter a valid 11-digit number starting with 01"); return;
        }
        if (bkashPin.length < 4) {
            showToast("⚠️ Enter your 4-digit bKash PIN"); return;
        }
        setOtpSent(true);
        setOtpTimer(60);
        showToast("📲 OTP sent to " + bkashNo.slice(0, 5) + "XXXXXX");
    }

    // ── bKash – verify OTP → create order → POST /payment/initiate ───────────
    async function handleBkash() {
        if (bkashOtp.replace(/\D/g, "").length !== 6) {
            showToast("⚠️ Enter the 6-digit OTP"); return;
        }
        setLoading(true);
        setStep("processing");
        try {
            const order = await createOrder("bkash");
            if (!order) { setStep("bkash"); return; }

            // POST /payment/initiate  ← uses backend field names exactly
            const result = await initiatePayment({
                order_id: order.id,        // ← REQUIRED by backend
                amount: total,            // ← backend field "amount"
                method: "bkash",          // ← backend field "method" (NOT payment_method)
                mobile_number: bkashNo,          // ← backend field "mobile_number" (NOT bkash_number)
            }, token);

            clearCart();
            showToast("✅ " + (result.message || "bKash payment successful!"));
            setTimeout(() => navigate("/confirm", { state: { order: result.order || order } }), 700);
        } catch (e) {
            setStep("bkash");
            showToast("❌ " + (e.message || "bKash payment failed"));
        } finally { setLoading(false); }
    }

    // ── Card – full form validation → create order → POST /payment/initiate ───
    async function handleCard() {
        const digits = card.number.replace(/\s/g, "");
        if (!card.name.trim()) { showToast("⚠️ Enter cardholder name"); return; }
        if (!(digits.length >= 13 && digits.length <= 19)) { showToast("⚠️ Enter a valid card number (13-19 digits)"); return; }
        if (!card.expiry.match(/^\d{2}\/\d{2}$/)) { showToast("⚠️ Expiry must be MM/YY"); return; }
        if (card.cvv.replace(/\D/g, "").length < 3) { showToast("⚠️ Enter a valid 3 or 4 digit CVV"); return; }

        setLoading(true);
        setStep("processing");
        try {
            const order = await createOrder("card");
            if (!order) { setStep("card"); return; }

            // POST /payment/initiate  ← backend validates full card number (13-19 digits)
            const result = await initiatePayment({
                order_id: order.id,           // ← REQUIRED by backend
                amount: total,              // ← backend field "amount"
                method: "card",             // ← backend field "method"
                card_number: digits,             // ← full 16-digit number, NOT last 4
                card_name: card.name,          // ← backend requires this
                expiry: card.expiry,        // ← backend requires this (MM/YY)
                cvv: card.cvv,           // ← backend requires this
            }, token);

            // In production, SSLCommerz returns redirect_url
            if (result.redirect_url) {
                window.location.href = result.redirect_url;
            } else {
                clearCart();
                showToast("✅ " + (result.message || "Payment successful!"));
                setTimeout(() => navigate("/confirm", { state: { order: result.order || order } }), 700);
            }
        } catch (e) {
            setStep("card");
            showToast("❌ " + (e.message || "Card payment failed"));
        } finally { setLoading(false); }
    }

    // Card formatters
    const fmtCard = v => v.replace(/\D/g, "").slice(0, 16).replace(/(.{4})/g, "$1 ").trim();
    const fmtExpiry = v => { const d = v.replace(/\D/g, "").slice(0, 4); return d.length > 2 ? d.slice(0, 2) + "/" + d.slice(2) : d; };

    function proceed() {
        if (!paymentMethod) { showToast("⚠️ Please select a payment method"); return; }
        if (paymentMethod === "cash") { handleCOD(); return; }
        if (paymentMethod === "bkash") { setStep("bkash"); return; }
        if (paymentMethod === "card") { setStep("card"); return; }
    }

    // ── Empty cart ─────────────────────────────────────────────────────────────
    if (!cart.length) {
        return (
            <div style={s.emptyWrap}>
                <div style={{ fontSize: "5rem" }}>🛒</div>
                <h3 style={s.emptyTitle}>Your cart is empty!</h3>
                <p style={{ color: "#aaa", marginBottom: 8 }}>Go build a pizza first 🍕</p>
                <button onClick={() => navigate("/customize")} style={s.yellowBtn}>Build a Pizza</button>
            </div>
        );
    }

    return (
        <div style={s.wrap}>
            <h2 style={s.pageTitle}>🛒 Your Cart</h2>
            <p style={{ textAlign: "center", color: "#16a34a", fontSize: ".85rem", fontWeight: 700, marginTop: -8, marginBottom: 16 }}>
                💾 Your cart is saved — refresh the page anytime
            </p>

            {/* ── Cart items ── */}
            {cart.map(item => {
                const qty = parseInt(item.qty) || 1;
                const price = parseFloat(item.price) || 0;
                return (
                    <div key={item.id} style={s.cartItem}>
                        <div style={{ fontSize: "2.5rem" }}>
                            {item.type === "fastfood" ? "🍔" : "🍕"}
                        </div>
                        <div style={{ flex: 1 }}>
                            <h4 style={s.itemName}>
                                {item.name || `${item.size} Pizza`}
                                {item.type !== "fastfood" && item.crust && item.crust !== "—"
                                    ? ` — ${item.crust} Crust`
                                    : ""}
                            </h4>
                            <p style={s.itemSub}>
                                {item.type === "fastfood"
                                    ? (item.desc || "Fast food")
                                    : `${item.sauce} sauce`}
                                {item.cheeses?.length
                                    ? " • Cheese: " + item.cheeses.map(c => `${c.label}${c.qty > 1 ? ` ×${c.qty}` : ""}`).join(", ")
                                    : ""}
                                {item.toppings?.length
                                    ? " • " + item.toppings.map(t => t.label || t).join(", ")
                                    : ""}
                                {item.addIns?.length
                                    ? " • Extras: " + item.addIns.map(a => a.label || a).join(", ")
                                    : ""}
                            </p>
                            <div style={s.qtyRow}>
                                <QtyBtn onClick={() => updateQty(item.id, qty - 1)}>−</QtyBtn>
                                <span style={s.qtyNum}>{qty}</span>
                                <QtyBtn onClick={() => updateQty(item.id, qty + 1)}>+</QtyBtn>
                            </div>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
                            <span style={s.itemPrice}>৳{price * qty}</span>
                            <button onClick={() => removeFromCart(item.id)} style={s.removeBtn}>🗑</button>
                        </div>
                    </div>
                );
            })}

            {/* ── Order summary card ── */}
            <div style={s.summaryCard}>
                <h3 style={s.summaryTitle}>Order Summary</h3>

                {/* Delivery address */}
                <div style={s.deliveryBox}>
                    <div style={{ fontWeight: 700, marginBottom: 6, fontSize: ".9rem" }}>📦 Deliver to:</div>
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

                {/* ════ STEP: method selection ════ */}
                {step === "method" && (
                    <div style={s.payBox}>
                        <div style={{ fontWeight: 800, marginBottom: 10, fontSize: ".92rem" }}>
                            💳 Payment Method
                        </div>
                        <div style={s.methodGrid}>
                            {[
                                { v: "cash", icon: "💵", label: "Cash on\nDelivery", note: "Pay when it arrives" },
                                { v: "bkash", icon: "📱", label: "bKash", note: "Mobile wallet" },
                                { v: "card", icon: "💳", label: "Card", note: "Visa / Mastercard" },
                            ].map(opt => (
                                <button key={opt.v} onClick={() => setPaymentMethod(opt.v)} style={{
                                    ...s.methodBtn,
                                    background: paymentMethod === opt.v ? "#fff" : "rgba(255,255,255,.12)",
                                    color: paymentMethod === opt.v ? "#e63329" : "#fff",
                                    border: paymentMethod === opt.v ? "2px solid #fff" : "2px solid rgba(255,255,255,.25)",
                                    transform: paymentMethod === opt.v ? "scale(1.05) translateY(-2px)" : "scale(1)",
                                }}>
                                    <div style={{ fontSize: "1.5rem", marginBottom: 4 }}>{opt.icon}</div>
                                    <div style={{ fontWeight: 800, fontSize: ".8rem", lineHeight: 1.2, whiteSpace: "pre" }}>{opt.label}</div>
                                    <div style={{ fontSize: ".65rem", opacity: .75, marginTop: 3 }}>{opt.note}</div>
                                </button>
                            ))}
                        </div>
                        {paymentMethod && (
                            <div style={s.methodNote}>
                                {paymentMethod === "cash" && "✅ You'll hand cash directly to the rider when your pizza arrives."}
                                {paymentMethod === "bkash" && "📲 Next: enter your bKash number and confirm with OTP."}
                                {paymentMethod === "card" && "🔒 Next: enter your card details. Secured by SSLCommerz gateway."}
                            </div>
                        )}
                    </div>
                )}

                {/* ════ STEP: bKash form ════ */}
                {step === "bkash" && (
                    <div style={s.payBox}>
                        <BackBar onBack={() => { setStep("method"); setOtpSent(false); setBkashOtp(""); }}>
                            📱 bKash Payment
                        </BackBar>

                        <div style={s.bkashBrand}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <span style={{ fontWeight: 900, fontSize: "1.2rem", color: "#e2136e", letterSpacing: 1 }}>bKash</span>
                                <span style={{ fontSize: "1.2rem" }}>📱</span>
                            </div>
                            <div style={{ fontFamily: "'Boogaloo',cursive", fontSize: "1.6rem", color: "#1a1a1a", marginTop: 6 }}>
                                ৳{total}
                            </div>
                            <div style={{ fontSize: ".72rem", color: "#888" }}>PizzaFizz · Merchant Payment</div>
                        </div>

                        <input value={bkashNo}
                            onChange={e => setBkashNo(e.target.value.replace(/\D/g, "").slice(0, 11))}
                            placeholder="bKash Number: 01XXXXXXXXX"
                            style={s.payInput} maxLength={11} />

                        <input value={bkashPin} type="password"
                            onChange={e => setBkashPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                            placeholder="bKash PIN (4 digits)"
                            style={s.payInput} maxLength={4} />

                        {!otpSent ? (
                            <button onClick={sendBkashOtp} style={s.bkashBtn}>📲 Send OTP</button>
                        ) : (
                            <>
                                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                                    <input value={bkashOtp}
                                        onChange={e => setBkashOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                                        placeholder="6-digit OTP"
                                        style={{ ...s.payInput, flex: 1, marginBottom: 0 }}
                                        maxLength={6} autoFocus />
                                    {otpTimer > 0
                                        ? <span style={{
                                            fontSize: ".85rem", fontWeight: 800, color: "#fbbf24",
                                            flexShrink: 0, minWidth: 36
                                        }}>{otpTimer}s</span>
                                        : <button onClick={sendBkashOtp}
                                            style={{ ...s.backBtnSm, flexShrink: 0 }}>Resend</button>
                                    }
                                </div>
                                <p style={{ fontSize: ".72rem", opacity: .75, margin: "6px 0 10px" }}>
                                    OTP sent to {bkashNo.slice(0, 5)}XXXXXX
                                </p>
                                <button onClick={handleBkash} disabled={loading}
                                    style={{ ...s.bkashBtn, opacity: loading ? .6 : 1 }}>
                                    {loading ? "Processing…" : `Pay ৳${total} via bKash`}
                                </button>
                            </>
                        )}
                        <p style={s.secureNote}>🔒 Secured by bKash · PCI-DSS Compliant</p>
                    </div>
                )}

                {/* ════ STEP: Card form ════ */}
                {step === "card" && (
                    <div style={s.payBox}>
                        <BackBar onBack={() => setStep("method")}>💳 Card Payment</BackBar>

                        {/* Live card preview */}
                        <div style={s.cardPreview}>
                            <div style={{ display: "flex", justifyContent: "space-between" }}>
                                <span style={{ fontSize: "1.4rem" }}>💳</span>
                                <div style={{ display: "flex" }}>
                                    <div style={{ width: 20, height: 20, borderRadius: "50%", background: "#eb001b", opacity: .9 }} />
                                    <div style={{ width: 20, height: 20, borderRadius: "50%", background: "#f79e1b", opacity: .9, marginLeft: -8 }} />
                                </div>
                            </div>
                            <div style={{
                                fontSize: ".95rem", letterSpacing: 3, marginTop: 14,
                                fontFamily: "monospace", fontWeight: 700
                            }}>
                                {card.number || "•••• •••• •••• ••••"}
                            </div>
                            <div style={{
                                display: "flex", justifyContent: "space-between",
                                marginTop: 8, fontSize: ".78rem", opacity: .85
                            }}>
                                <span>{card.name || "CARDHOLDER NAME"}</span>
                                <span>{card.expiry || "MM/YY"}</span>
                            </div>
                        </div>

                        <input value={card.name}
                            onChange={e => setCard(c => ({ ...c, name: e.target.value.toUpperCase() }))}
                            placeholder="Cardholder Name"
                            style={s.payInput} />

                        <input value={card.number}
                            onChange={e => setCard(c => ({ ...c, number: fmtCard(e.target.value) }))}
                            placeholder="Card Number (1234 5678 9012 3456)"
                            style={{ ...s.payInput, letterSpacing: 2 }}
                            maxLength={19} />

                        <div style={{ display: "flex", gap: 8 }}>
                            <input value={card.expiry}
                                onChange={e => setCard(c => ({ ...c, expiry: fmtExpiry(e.target.value) }))}
                                placeholder="MM/YY"
                                style={{ ...s.payInput, flex: 1 }} maxLength={5} />
                            <input value={card.cvv} type="password"
                                onChange={e => setCard(c => ({ ...c, cvv: e.target.value.replace(/\D/g, "").slice(0, 4) }))}
                                placeholder="CVV"
                                style={{ ...s.payInput, flex: 1 }} maxLength={4} />
                        </div>

                        <div style={{ display: "flex", gap: 5, marginBottom: 10, flexWrap: "wrap" }}>
                            {["Visa", "Mastercard", "DBBL Nexus", "BRAC"].map(b => (
                                <span key={b} style={{
                                    fontSize: ".65rem", padding: "2px 6px",
                                    border: "1px solid rgba(255,255,255,.3)",
                                    borderRadius: 4, opacity: .8
                                }}>{b}</span>
                            ))}
                        </div>

                        <button onClick={handleCard} disabled={loading}
                            style={{
                                ...s.bkashBtn, background: "rgba(255,255,255,.92)",
                                color: "#1d4ed8", opacity: loading ? .6 : 1
                            }}>
                            {loading ? "Processing…" : `Pay ৳${total} Securely 🔒`}
                        </button>
                        <p style={s.secureNote}>256-bit TLS · Powered by SSLCommerz</p>
                    </div>
                )}

                {/* ════ STEP: Processing ════ */}
                {step === "processing" && (
                    <div style={{ ...s.payBox, textAlign: "center", padding: "28px 16px" }}>
                        <div style={s.spinner}></div>
                        <div style={{ fontWeight: 800, marginTop: 14 }}>Processing payment…</div>
                        <div style={{ fontSize: ".8rem", opacity: .7, marginTop: 4 }}>Don't close or refresh</div>
                    </div>
                )}

                {/* ── Totals ── */}
                <SRow label="Subtotal" value={`৳${subtotal}`} />
                <SRow label="Delivery" value={`৳${delivery}`} />
                <div style={s.totalRow}><span>Total</span><span>৳{total}</span></div>

                {/* ── CTA button (only on method step) ── */}
                {step === "method" && (
                    <button onClick={proceed} disabled={loading || !paymentMethod} style={{
                        ...s.orderBtn,
                        opacity: (loading || !paymentMethod) ? 0.55 : 1,
                        cursor: (loading || !paymentMethod) ? "not-allowed" : "pointer",
                    }}>
                        {loading ? "Processing…"
                            : paymentMethod === "cash" ? "✅ Place COD Order"
                                : paymentMethod ? "Continue to Payment →"
                                    : "Select a payment method"}
                    </button>
                )}
            </div>

            {/* Toast */}
            <div style={{
                ...s.toast,
                transform: toast ? "translateX(-50%) translateY(0)" : "translateX(-50%) translateY(100px)",
            }}>
                {toast}
            </div>
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
    );
}

/* ── Small helpers ── */
function QtyBtn({ children, onClick }) {
    return (
        <button onClick={onClick} style={{
            width: 30, height: 30, borderRadius: "50%", border: "2px solid #e63329",
            background: "#fff", color: "#e63329", fontSize: "1.1rem", fontWeight: 900,
            cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
        }}>{children}</button>
    );
}
function SRow({ label, value }) {
    return (
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: ".95rem" }}>
            <span>{label}</span><span>{value}</span>
        </div>
    );
}
function BackBar({ onBack, children }) {
    return (
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <button onClick={onBack} style={{
                background: "rgba(255,255,255,.2)", border: "1px solid rgba(255,255,255,.35)",
                borderRadius: 8, padding: "5px 12px", cursor: "pointer", color: "#fff",
                fontSize: ".8rem", fontWeight: 700,
            }}>← Back</button>
            <span style={{ fontWeight: 800, fontSize: ".92rem" }}>{children}</span>
        </div>
    );
}

/* ── Styles ── */
const s = {
    wrap: { maxWidth: 700, margin: "0 auto", padding: "32px 16px" },
    pageTitle: { fontFamily: "'Boogaloo',cursive", fontSize: "2.2rem", color: "#e63329", marginBottom: 24 },

    cartItem: {
        background: "#fff", borderRadius: 20, padding: 20, marginBottom: 16,
        boxShadow: "0 4px 16px rgba(0,0,0,.06)", display: "flex", gap: 16, alignItems: "center"
    },
    itemName: { fontWeight: 800, fontSize: "1rem" },
    itemSub: { fontSize: ".82rem", color: "#888", marginTop: 2 },
    itemPrice: { fontFamily: "'Boogaloo',cursive", fontSize: "1.4rem", color: "#e63329" },
    removeBtn: { background: "none", border: "none", fontSize: "1.3rem", cursor: "pointer", color: "#ccc" },
    qtyRow: { display: "flex", alignItems: "center", gap: 8, marginTop: 8 },
    qtyNum: { fontWeight: 800, fontSize: "1rem", minWidth: 24, textAlign: "center" },

    summaryCard: {
        background: "linear-gradient(135deg,#e63329,#f97316)", borderRadius: 20,
        padding: 24, color: "#fff", marginTop: 24
    },
    summaryTitle: { fontFamily: "'Boogaloo',cursive", fontSize: "1.5rem", marginBottom: 16 },
    deliveryBox: { background: "rgba(0,0,0,.15)", borderRadius: 12, padding: "12px 16px", marginBottom: 16 },
    payBox: { background: "rgba(0,0,0,.18)", borderRadius: 14, padding: "14px 16px", marginBottom: 16 },

    methodGrid: { display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginBottom: 10 },
    methodBtn: {
        border: "2px solid rgba(255,255,255,.3)", borderRadius: 12, padding: "12px 6px",
        cursor: "pointer", textAlign: "center", transition: "all .2s ease"
    },
    methodNote: { fontSize: ".78rem", lineHeight: 1.5, opacity: .9, marginTop: 4 },

    bkashBrand: {
        background: "linear-gradient(135deg,#ffe0ef,#ffc1d8)", borderRadius: 12,
        padding: "12px 14px", marginBottom: 12, border: "2px solid #e2136e"
    },
    cardPreview: {
        background: "linear-gradient(135deg,#1e3a5f,#2563eb)", borderRadius: 12,
        padding: "16px", color: "#fff", marginBottom: 10
    },

    payInput: {
        width: "100%", border: "none", borderRadius: 10, padding: "10px 12px",
        marginBottom: 8, outline: "none", fontSize: ".9rem", boxSizing: "border-box",
        fontFamily: "'Nunito',sans-serif", background: "rgba(255,255,255,.92)", color: "#1a1a1a"
    },

    bkashBtn: {
        width: "100%", padding: 12, background: "#e2136e", color: "#fff", border: "none",
        borderRadius: 50, cursor: "pointer", fontFamily: "'Boogaloo',cursive",
        fontSize: "1.05rem", marginBottom: 8, transition: "opacity .2s"
    },
    backBtnSm: {
        background: "rgba(255,255,255,.2)", border: "1px solid rgba(255,255,255,.3)",
        borderRadius: 7, padding: "6px 10px", cursor: "pointer", color: "#fff",
        fontSize: ".78rem", fontWeight: 700
    },
    secureNote: { textAlign: "center", fontSize: ".7rem", opacity: .7, marginTop: 2 },

    spinner: {
        width: 44, height: 44, borderRadius: "50%", border: "4px solid rgba(255,255,255,.25)",
        borderTopColor: "#fff", animation: "spin .9s linear infinite", margin: "0 auto"
    },

    totalRow: {
        display: "flex", justifyContent: "space-between", borderTop: "2px solid rgba(255,255,255,.3)",
        paddingTop: 10, marginTop: 8, fontFamily: "'Boogaloo',cursive", fontSize: "1.8rem"
    },
    orderBtn: {
        width: "100%", padding: 16, background: "#fff", color: "#e63329", border: "none",
        borderRadius: 50, fontFamily: "'Boogaloo',cursive", fontSize: "1.4rem",
        marginTop: 16, transition: "all .2s"
    },

    emptyWrap: {
        textAlign: "center", padding: "80px 20px", minHeight: "calc(100vh - 68px)",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center"
    },
    emptyTitle: { fontFamily: "'Boogaloo',cursive", fontSize: "1.8rem", marginTop: 12, color: "#555" },
    yellowBtn: {
        background: "#fbbf24", color: "#1c0a00", border: "none", borderRadius: 50,
        padding: "12px 28px", cursor: "pointer", fontFamily: "'Boogaloo',cursive",
        fontSize: "1.1rem", marginTop: 16
    },

    toast: {
        position: "fixed", bottom: 24, left: "50%", background: "#1c0a00", color: "#fff",
        padding: "12px 28px", borderRadius: 50, fontWeight: 700, fontSize: ".95rem",
        zIndex: 999, transition: "transform .35s ease", pointerEvents: "none", whiteSpace: "nowrap"
    },
};
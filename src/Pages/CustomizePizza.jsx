// src/Pages/CustomizePizza.jsx
// ✅ Anyone can visit this page and build a pizza
// ✅ Login is only required when clicking "Add to Cart"
//    (and even then, just shows a toast — not a redirect)

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCart } from "../Context/CartContext";

// ── Menu Data ─────────────────────────────────────────────────
const SIZES = [
    { label: "Small", icon: "🍕", price: 199 },
    { label: "Medium", icon: "🍕", price: 299 },
    { label: "Large", icon: "🍕", price: 399 },
    { label: "XL", icon: "🍕", price: 499 },
];
const CRUSTS = [
    { label: "Thin", icon: "〰️", price: 0 },
    { label: "Classic", icon: "⭕", price: 30 },
    { label: "Stuffed", icon: "🧀", price: 60 },
    { label: "Whole Wheat", icon: "🌾", price: 40 },
];
const SAUCES = [
    { label: "Tomato", icon: "🍅", price: 0 },
    { label: "BBQ", icon: "🔥", price: 20 },
    { label: "Pesto", icon: "🌿", price: 30 },
    { label: "White", icon: "🤍", price: 25 },
];
const TOPPINGS = [
    { label: "Pepperoni", icon: "🍖", price: 50 },
    { label: "Mushrooms", icon: "🍄", price: 30 },
    { label: "Olives", icon: "🫒", price: 25 },
    { label: "Jalapeños", icon: "🌶️", price: 30 },
    { label: "Onions", icon: "🧅", price: 20 },
    { label: "Bell Pepper", icon: "🫑", price: 25 },
    { label: "Corn", icon: "🌽", price: 20 },
    { label: "Chicken", icon: "🍗", price: 70 },
    { label: "Paneer", icon: "🧊", price: 60 },
    { label: "Bacon", icon: "🥓", price: 80 },
];

const EMPTY = {
    size: null, sizePrice: 0,
    crust: null, crustPrice: 0,
    sauce: null, saucePrice: 0,
    toppings: [], toppingPrice: 0,
};

export default function CustomizePizza() {
    const [pizza, setPizza] = useState(EMPTY);
    const [toast, setToast] = useState("");
    const navigate = useNavigate();
    const { addToCart } = useCart();

    function showToast(msg) {
        setToast(msg);
        setTimeout(() => setToast(""), 2500);
    }

    function selectSingle(type, label, price) {
        setPizza(p => ({ ...p, [type]: label, [`${type}Price`]: price }));
    }

    function toggleTopping(item) {
        setPizza(prev => {
            const exists = prev.toppings.find(t => t.label === item.label);
            if (exists) {
                return {
                    ...prev,
                    toppings: prev.toppings.filter(t => t.label !== item.label),
                    toppingPrice: prev.toppingPrice - item.price,
                };
            }
            if (prev.toppings.length >= 6) {
                showToast("⚠️ Max 6 toppings!");
                return prev;
            }
            return {
                ...prev,
                toppings: [...prev.toppings, item],
                toppingPrice: prev.toppingPrice + item.price,
            };
        });
    }

    function handleAdd() {
        // ✅ Validate selections first
        if (!pizza.size) { showToast("⚠️ Please choose a size!"); return; }
        if (!pizza.crust) { showToast("⚠️ Please choose a crust!"); return; }
        if (!pizza.sauce) { showToast("⚠️ Please choose a sauce!"); return; }

        // ✅ Check login — but just show a toast, don't redirect to register
        const user = JSON.parse(localStorage.getItem("user") || "null");
        if (!user) {
            showToast("⚠️ Please sign in to add to cart!");
            setTimeout(() => navigate("/login"), 1500);
            return;
        }

        const price = pizza.sizePrice + pizza.crustPrice + pizza.saucePrice + pizza.toppingPrice;

        addToCart({
            id: Date.now(),
            name: `${pizza.size} Pizza`,
            size: pizza.size,
            crust: pizza.crust,
            sauce: pizza.sauce,
            toppings: pizza.toppings,
            price,
            qty: 1,
        });

        setPizza(EMPTY);
        showToast("🍕 Pizza added to cart!");
    }

    const total = pizza.sizePrice + pizza.crustPrice + pizza.saucePrice + pizza.toppingPrice;

    return (
        <div style={{ maxWidth: 960, margin: "0 auto", padding: "32px 16px" }}>

            <h2 style={styles.pageTitle}>🎮 Build Your Pizza</h2>
            <p style={styles.pageSub}>Choose size, crust, sauce &amp; up to 6 toppings</p>

            <div style={styles.grid}>

                {/* ── LEFT: Selectors ── */}
                <div style={styles.left}>
                    <Section title="📏 Choose Size">
                        <OptionGrid
                            items={SIZES}
                            selected={pizza.size}
                            onSelect={item => selectSingle("size", item.label, item.price)}
                        />
                    </Section>

                    <Section title="🥖 Choose Crust">
                        <OptionGrid
                            items={CRUSTS}
                            selected={pizza.crust}
                            onSelect={item => selectSingle("crust", item.label, item.price)}
                        />
                    </Section>

                    <Section title="🍅 Choose Sauce">
                        <OptionGrid
                            items={SAUCES}
                            selected={pizza.sauce}
                            onSelect={item => selectSingle("sauce", item.label, item.price)}
                        />
                    </Section>

                    <Section title="🌶️ Add Toppings (max 6)">
                        <OptionGrid
                            items={TOPPINGS}
                            selected={pizza.toppings.map(t => t.label)}
                            onSelect={toggleTopping}
                            multi
                        />
                    </Section>
                </div>

                {/* ── RIGHT: Live Preview ── */}
                <div style={styles.previewWrap}>
                    <div style={styles.previewCard}>
                        <h3 style={styles.previewTitle}>Your Pizza Preview</h3>

                        {/* Visual pizza */}
                        <div style={styles.pizzaPlate}>
                            <div style={styles.sauceLayer} />
                            <div style={styles.cheeseLayer} />
                            <div style={styles.toppingsLayer}>
                                {pizza.toppings.map(t => (
                                    <span key={t.label} title={t.label}>{t.icon}</span>
                                ))}
                            </div>
                        </div>

                        {/* Price */}
                        <div style={styles.price}>
                            ৳{total}
                            <span style={styles.priceSub}> total</span>
                        </div>

                        {/* Summary */}
                        <p style={styles.summary}>
                            {[
                                pizza.size && `${pizza.size} size`,
                                pizza.crust && `${pizza.crust} crust`,
                                pizza.sauce && `${pizza.sauce} sauce`,
                                pizza.toppings.length && pizza.toppings.map(t => t.label).join(", "),
                            ].filter(Boolean).join(" • ") || "👆 Choose your options above!"}
                        </p>

                        <button onClick={handleAdd} style={styles.addBtn}>
                            🛒 Add to Cart
                        </button>

                        <button onClick={() => navigate("/cart")} style={styles.viewCartBtn}>
                            View Cart →
                        </button>
                    </div>
                </div>

            </div>

            {/* Toast */}
            <div style={{
                ...styles.toast,
                transform: toast
                    ? "translateX(-50%) translateY(0)"
                    : "translateX(-50%) translateY(80px)",
            }}>
                {toast}
            </div>
        </div>
    );
}

// ── Sub-components ────────────────────────────────────────────

function Section({ title, children }) {
    return (
        <div style={styles.section}>
            <h4 style={styles.sectionTitle}>{title}</h4>
            {children}
        </div>
    );
}

function OptionGrid({ items, selected, onSelect, multi = false }) {
    return (
        <div style={styles.optionGrid}>
            {items.map(item => {
                const isSelected = multi
                    ? Array.isArray(selected) && selected.includes(item.label)
                    : selected === item.label;
                const activeColor = multi ? "#16a34a" : "#e63329";
                return (
                    <button
                        key={item.label}
                        onClick={() => onSelect(item)}
                        style={{
                            ...styles.optionBtn,
                            border: `2px solid ${isSelected ? activeColor : "#e5e7eb"}`,
                            background: isSelected ? (multi ? "#f0fdf4" : "#fff0ee") : "#f9f9f9",
                            color: isSelected ? activeColor : "#1c0a00",
                        }}
                    >
                        <span style={{ fontSize: "1.5rem" }}>{item.icon}</span>
                        <span>{item.label}</span>
                        {item.price > 0 && (
                            <span style={{ fontSize: ".7rem", color: "#888", fontWeight: 400 }}>
                                +৳{item.price}
                            </span>
                        )}
                    </button>
                );
            })}
        </div>
    );
}

// ── Styles ────────────────────────────────────────────────────
const styles = {
    pageTitle: {
        fontFamily: "'Boogaloo', cursive",
        fontSize: "2.2rem", color: "#e63329",
        textAlign: "center", marginBottom: 6,
    },
    pageSub: { textAlign: "center", color: "#888", marginBottom: 28 },

    grid: {
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
        gap: 24, alignItems: "start",
    },
    left: { display: "flex", flexDirection: "column", gap: 20 },

    section: {
        background: "#fff", borderRadius: 20, padding: 20,
        boxShadow: "0 4px 16px rgba(0,0,0,.06)",
    },
    sectionTitle: {
        fontFamily: "'Boogaloo', cursive",
        fontSize: "1.2rem", color: "#7c2d12", marginBottom: 14,
    },
    optionGrid: {
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(86px, 1fr))",
        gap: 8,
    },
    optionBtn: {
        padding: "10px 6px", borderRadius: 14, cursor: "pointer",
        fontFamily: "Nunito, sans-serif", fontSize: ".8rem", fontWeight: 700,
        textAlign: "center", display: "flex", flexDirection: "column",
        alignItems: "center", gap: 3, transition: "all .15s",
    },

    previewWrap: { position: "sticky", top: 90 },
    previewCard: {
        background: "#fff", borderRadius: 24, padding: 28,
        boxShadow: "0 4px 20px rgba(0,0,0,.08)", textAlign: "center",
    },
    previewTitle: {
        fontFamily: "'Boogaloo', cursive",
        fontSize: "1.4rem", color: "#7c2d12", marginBottom: 16,
    },

    pizzaPlate: {
        width: 200, height: 200, borderRadius: "50%",
        margin: "0 auto 16px",
        background: "radial-gradient(circle, #f59e0b 0%, #d97706 40%, #92400e 80%, #78350f 100%)",
        position: "relative", boxShadow: "0 8px 32px rgba(0,0,0,.2)",
    },
    sauceLayer: {
        position: "absolute", width: "76%", height: "76%", borderRadius: "50%",
        background: "radial-gradient(circle, #dc2626 0%, #b91c1c 100%)",
        top: "12%", left: "12%",
    },
    cheeseLayer: {
        position: "absolute", width: "64%", height: "64%", borderRadius: "50%",
        background: "radial-gradient(circle, #fde68a 0%, #fbbf24 100%)",
        top: "18%", left: "18%",
    },
    toppingsLayer: {
        position: "absolute", width: "64%", height: "64%", borderRadius: "50%",
        top: "18%", left: "18%",
        display: "flex", flexWrap: "wrap",
        alignItems: "center", justifyContent: "center",
        fontSize: "1.1rem", gap: 2, overflow: "hidden",
    },

    price: {
        fontFamily: "'Boogaloo', cursive",
        fontSize: "2.2rem", color: "#e63329", margin: "8px 0",
    },
    priceSub: {
        fontSize: "1rem", color: "#888",
        fontFamily: "Nunito, sans-serif", fontWeight: 400,
    },
    summary: {
        fontSize: ".85rem", color: "#666",
        lineHeight: 1.8, minHeight: 48, marginBottom: 8,
    },
    addBtn: {
        width: "100%", padding: 14,
        background: "#16a34a", color: "#fff", border: "none",
        borderRadius: 50, fontFamily: "'Boogaloo', cursive",
        fontSize: "1.3rem", cursor: "pointer",
        boxShadow: "0 4px 0 #166534", marginBottom: 8,
    },
    viewCartBtn: {
        width: "100%", padding: 10,
        background: "transparent", color: "#e63329",
        border: "2px solid #e63329", borderRadius: 50,
        fontFamily: "'Boogaloo', cursive",
        fontSize: "1rem", cursor: "pointer",
    },

    toast: {
        position: "fixed", bottom: 24, left: "50%",
        background: "#1c0a00", color: "#fff",
        padding: "12px 24px", borderRadius: 50,
        fontWeight: 700, fontSize: ".95rem",
        zIndex: 999, transition: "transform .3s",
        pointerEvents: "none", whiteSpace: "nowrap",
    },
};
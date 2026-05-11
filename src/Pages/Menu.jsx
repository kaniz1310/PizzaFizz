// src/Pages/Menu.jsx
// Full Menu page — Bootstrap 5 + custom CSS + JS interactions
// Route: /menu

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useCart } from "../Context/CartContext";

// ── Menu Data ─────────────────────────────────────────
const MENU = [
    {
        category: "🔥 Bestsellers",
        items: [
            {
                id: 1,
                name: "Pepperoni Fiesta",
                desc: "Classic tomato sauce, double pepperoni, mozzarella, oregano",
                price: 499,
                badge: "🏆 #1",
                badgeColor: "#f59e0b",
                image: "https://images.unsplash.com/photo-1628840042765-356cda07504e?w=400&q=80",
                size: "Large", crust: "Classic", sauce: "Tomato",
                toppings: [{ label: "Pepperoni", icon: "🍖", price: 50 }],
            },
            {
                id: 2,
                name: "BBQ Chicken Blast",
                desc: "Smoky BBQ sauce, grilled chicken, red onions, bell pepper",
                price: 549,
                badge: "🔥 Hot",
                badgeColor: "#e63329",
                image: "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=400&q=80",
                size: "Large", crust: "Stuffed", sauce: "BBQ",
                toppings: [
                    { label: "Chicken", icon: "🍗", price: 70 },
                    { label: "Onions", icon: "🧅", price: 20 },
                    { label: "Bell Pepper", icon: "🫑", price: 25 },
                ],
            },
            {
                id: 3,
                name: "Veggie Supreme",
                desc: "Pesto sauce, mushrooms, olives, corn, bell pepper, paneer",
                price: 429,
                badge: "🌿 Veg",
                badgeColor: "#16a34a",
                image: "https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=400&q=80",
                size: "Large", crust: "Thin", sauce: "Pesto",
                toppings: [
                    { label: "Mushrooms", icon: "🍄", price: 30 },
                    { label: "Olives", icon: "🫒", price: 25 },
                    { label: "Corn", icon: "🌽", price: 20 },
                    { label: "Paneer", icon: "🧊", price: 60 },
                ],
            },
        ],
    },
    {
        category: "🧀 Cheese Lovers",
        items: [
            {
                id: 4,
                name: "Four Cheese Dream",
                desc: "White sauce, mozzarella, cheddar, parmesan, gouda, fresh basil",
                price: 579,
                badge: "🧀 New",
                badgeColor: "#f97316",
                image: "https://images.unsplash.com/photo-1571407970349-bc81e7e96d47?w=400&q=80",
                size: "Large", crust: "Stuffed", sauce: "White",
                toppings: [],
            },
            {
                id: 5,
                name: "Stuffed Crust Margherita",
                desc: "Fresh tomato sauce, buffalo mozzarella, fresh basil, EVOO",
                price: 449,
                badge: "❤️ Classic",
                badgeColor: "#e63329",
                image: "https://images.unsplash.com/photo-1604382354936-07c5d9983bd3?w=400&q=80",
                size: "Large", crust: "Stuffed", sauce: "Tomato",
                toppings: [],
            },
        ],
    },
    {
        category: "🌶️ Spicy Specials",
        items: [
            {
                id: 6,
                name: "Jalapeño Inferno",
                desc: "BBQ sauce, pepperoni, jalapeños, bacon, red chilli flakes",
                price: 569,
                badge: "🌶️ Extra Hot",
                badgeColor: "#dc2626",
                image: "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=400&q=80",
                size: "Large", crust: "Classic", sauce: "BBQ",
                toppings: [
                    { label: "Pepperoni", icon: "🍖", price: 50 },
                    { label: "Jalapeños", icon: "🌶️", price: 30 },
                    { label: "Bacon", icon: "🥓", price: 80 },
                ],
            },
            {
                id: 7,
                name: "Spicy Chicken Ranch",
                desc: "White sauce, spicy chicken, jalapeños, onions, corn",
                price: 529,
                badge: "🔥 Spicy",
                badgeColor: "#e63329",
                image: "https://images.unsplash.com/photo-1588315029754-2dd089d39a1a?w=400&q=80",
                size: "Large", crust: "Whole Wheat", sauce: "White",
                toppings: [
                    { label: "Chicken", icon: "🍗", price: 70 },
                    { label: "Jalapeños", icon: "🌶️", price: 30 },
                    { label: "Onions", icon: "🧅", price: 20 },
                ],
            },
        ],
    },
    {
        category: "🌾 Healthy Choice",
        items: [
            {
                id: 8,
                name: "Garden Pesto Delight",
                desc: "Pesto sauce, whole wheat crust, mushrooms, olives, bell pepper",
                price: 399,
                badge: "💚 Healthy",
                badgeColor: "#16a34a",
                image: "https://images.unsplash.com/photo-1555072956-7758afb20e8f?w=400&q=80",
                size: "Medium", crust: "Whole Wheat", sauce: "Pesto",
                toppings: [
                    { label: "Mushrooms", icon: "🍄", price: 30 },
                    { label: "Olives", icon: "🫒", price: 25 },
                    { label: "Bell Pepper", icon: "🫑", price: 25 },
                ],
            },
            {
                id: 9,
                name: "Thin Crust Paneer",
                desc: "Tomato sauce, thin crust, paneer, onions, bell pepper, corn",
                price: 429,
                badge: "🌿 Veg",
                badgeColor: "#16a34a",
                image: "https://images.unsplash.com/photo-1593560708920-61dd98c46a4e?w=400&q=80",
                size: "Medium", crust: "Thin", sauce: "Tomato",
                toppings: [
                    { label: "Paneer", icon: "🧊", price: 60 },
                    { label: "Onions", icon: "🧅", price: 20 },
                    { label: "Corn", icon: "🌽", price: 20 },
                ],
            },
        ],
    },
];

const ALL_CATEGORIES = ["All", ...MENU.map(c => c.category)];

export default function Menu() {
    const navigate = useNavigate();
    const { addToCart, cartCount } = useCart();

    const [activeCategory, setActiveCategory] = useState("All");
    const [search, setSearch] = useState("");
    const [sortBy, setSortBy] = useState("default");
    const [addedId, setAddedId] = useState(null);  // for button animation
    const [toast, setToast] = useState("");

    // ── Filter + sort logic ───────────────────────────
    const allItems = MENU.flatMap(c =>
        c.items.map(item => ({ ...item, category: c.category }))
    );

    let filtered = activeCategory === "All"
        ? allItems
        : allItems.filter(i => i.category === activeCategory);

    if (search.trim()) {
        const q = search.toLowerCase();
        filtered = filtered.filter(i =>
            i.name.toLowerCase().includes(q) ||
            i.desc.toLowerCase().includes(q)
        );
    }

    if (sortBy === "price-asc") filtered = [...filtered].sort((a, b) => a.price - b.price);
    if (sortBy === "price-desc") filtered = [...filtered].sort((a, b) => b.price - a.price);
    if (sortBy === "name") filtered = [...filtered].sort((a, b) => a.name.localeCompare(b.name));

    // ── Add to cart ───────────────────────────────────
    function handleAddToCart(item) {
        const user = JSON.parse(localStorage.getItem("user") || "null");
        if (!user) {
            showToast("⚠️ Please sign in to add to cart!");
            setTimeout(() => navigate("/login"), 1500);
            return;
        }

        addToCart({
            id: Date.now(),
            name: item.name,
            size: item.size,
            crust: item.crust,
            sauce: item.sauce,
            toppings: item.toppings,
            price: item.price,
            qty: 1,
        });

        setAddedId(item.id);
        setTimeout(() => setAddedId(null), 1500);
        showToast(`🍕 ${item.name} added to cart!`);
    }

    function showToast(msg) {
        setToast(msg);
        setTimeout(() => setToast(""), 2500);
    }

    // Group filtered items back by category for display
    const grouped = MENU.map(cat => ({
        ...cat,
        items: filtered.filter(i => i.category === cat.category),
    })).filter(cat => cat.items.length > 0);

    return (
        <>
            {/* Bootstrap 5 CDN */}
            <link
                rel="stylesheet"
                href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css"
            />

            <div style={{ background: "#fff8f0", minHeight: "calc(100vh - 68px)" }}>

                {/* ── Hero banner ── */}
                <div style={styles.hero}>
                    <div style={styles.heroOverlay} />
                    <div style={{ position: "relative", zIndex: 1, textAlign: "center" }}>
                        <h1 style={styles.heroTitle}>
                            Our Full Menu 🍕
                        </h1>
                        <p style={styles.heroSub}>
                            Handcrafted with love · Fresh every time · Delivered hot
                        </p>

                        {/* Search bar */}
                        <div style={styles.searchWrap}>
                            <span style={styles.searchIcon}>🔍</span>
                            <input
                                type="text"
                                placeholder="Search pizzas… e.g. 'BBQ', 'cheese', 'spicy'"
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                style={styles.searchInput}
                            />
                            {search && (
                                <button onClick={() => setSearch("")} style={styles.clearBtn}>✕</button>
                            )}
                        </div>
                    </div>
                </div>

                <div className="container py-4">

                    {/* ── Filter + Sort bar ── */}
                    <div style={styles.filterBar}>
                        {/* Category pills */}
                        <div style={styles.pills}>
                            {ALL_CATEGORIES.map(cat => (
                                <button
                                    key={cat}
                                    onClick={() => setActiveCategory(cat)}
                                    style={{
                                        ...styles.pill,
                                        background: activeCategory === cat ? "#e63329" : "#fff",
                                        color: activeCategory === cat ? "#fff" : "#555",
                                        border: activeCategory === cat
                                            ? "2px solid #e63329"
                                            : "2px solid #e5e7eb",
                                        fontWeight: activeCategory === cat ? 800 : 600,
                                    }}
                                >
                                    {cat}
                                </button>
                            ))}
                        </div>

                        {/* Sort dropdown */}
                        <select
                            value={sortBy}
                            onChange={e => setSortBy(e.target.value)}
                            style={styles.sortSelect}
                        >
                            <option value="default">Sort: Featured</option>
                            <option value="price-asc">Price: Low → High</option>
                            <option value="price-desc">Price: High → Low</option>
                            <option value="name">Name: A → Z</option>
                        </select>
                    </div>

                    {/* ── Results count ── */}
                    <p style={{ color: "#888", fontSize: ".88rem", marginBottom: 24 }}>
                        Showing <strong style={{ color: "#e63329" }}>{filtered.length}</strong> pizza{filtered.length !== 1 ? "s" : ""}
                        {search && <> matching "<strong>{search}</strong>"</>}
                    </p>

                    {/* ── No results ── */}
                    {filtered.length === 0 && (
                        <div style={styles.noResults}>
                            <div style={{ fontSize: "4rem", marginBottom: 12 }}>😕</div>
                            <h4 style={{ fontFamily: "'Boogaloo',cursive", fontSize: "1.6rem", color: "#555" }}>
                                No pizzas found!
                            </h4>
                            <p style={{ color: "#aaa" }}>Try a different search or category.</p>
                            <button
                                onClick={() => { setSearch(""); setActiveCategory("All"); }}
                                style={styles.resetBtn}
                            >
                                Show All Pizzas
                            </button>
                        </div>
                    )}

                    {/* ── Menu sections ── */}
                    {grouped.map(cat => (
                        <div key={cat.category} style={{ marginBottom: 48 }}>

                            {/* Category heading */}
                            <div style={styles.catHeading}>
                                <h3 style={styles.catTitle}>{cat.category}</h3>
                                <div style={styles.catLine} />
                            </div>

                            {/* Pizza cards grid */}
                            <div className="row g-4">
                                {cat.items.map(item => (
                                    <div key={item.id} className="col-12 col-sm-6 col-lg-4">
                                        <PizzaCard
                                            item={item}
                                            isAdded={addedId === item.id}
                                            onAdd={() => handleAddToCart(item)}
                                            onCustomize={() => navigate("/customize")}
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}

                    {/* ── Bottom CTA ── */}
                    <div style={styles.bottomCta}>
                        <h3 style={styles.ctaTitle}>
                            Want something more custom? 🎮
                        </h3>
                        <p style={{ color: "rgba(255,255,255,.85)", marginBottom: 20 }}>
                            Build your own pizza exactly the way you like it!
                        </p>
                        <button
                            onClick={() => navigate("/customize")}
                            style={styles.ctaBtn}
                        >
                            🎮 Build Your Own Pizza
                        </button>
                    </div>

                </div>
            </div>

            {/* ── Floating cart button (shows when items added) ── */}
            {cartCount > 0 && (
                <button
                    onClick={() => navigate("/cart")}
                    style={styles.floatingCart}
                >
                    🛒 View Cart ({cartCount})
                </button>
            )}

            {/* ── Toast ── */}
            <div style={{
                ...styles.toast,
                transform: toast
                    ? "translateX(-50%) translateY(0)"
                    : "translateX(-50%) translateY(100px)",
            }}>
                {toast}
            </div>

            <style>{`
        @keyframes cardIn {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes addPop {
          0%   { transform: scale(1); }
          40%  { transform: scale(.92); }
          70%  { transform: scale(1.06); }
          100% { transform: scale(1); }
        }
        @keyframes floatIn {
          from { opacity:0; transform: translateX(-50%) translateY(20px); }
          to   { opacity:1; transform: translateX(-50%) translateY(0); }
        }
        .pizza-card {
          animation: cardIn .4s ease both;
          transition: transform .25s ease, box-shadow .25s ease;
        }
        .pizza-card:hover {
          transform: translateY(-6px);
          box-shadow: 0 16px 40px rgba(230,51,41,.18) !important;
        }
        .pizza-card img {
          transition: transform .4s ease;
        }
        .pizza-card:hover img {
          transform: scale(1.07);
        }
        .add-btn-pop {
          animation: addPop .35s ease;
        }
      `}</style>
        </>
    );
}

// ── Pizza card component ──────────────────────────────
function PizzaCard({ item, isAdded, onAdd, onCustomize }) {
    return (
        <div
            className="pizza-card"
            style={{
                background: "#fff",
                borderRadius: 20,
                overflow: "hidden",
                boxShadow: "0 4px 20px rgba(0,0,0,.08)",
                height: "100%",
                display: "flex",
                flexDirection: "column",
            }}
        >
            {/* Image with badge */}
            <div style={{ position: "relative", overflow: "hidden", height: 210 }}>
                <img
                    src={item.image}
                    alt={item.name}
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    onError={e => {
                        e.target.src = "https://images.unsplash.com/photo-1628840042765-356cda07504e?w=400&q=80";
                    }}
                />
                {/* Badge */}
                <span style={{
                    position: "absolute", top: 12, left: 12,
                    background: item.badgeColor, color: "#fff",
                    borderRadius: 50, padding: "4px 12px",
                    fontSize: ".78rem", fontWeight: 800,
                    boxShadow: "0 2px 8px rgba(0,0,0,.2)",
                }}>
                    {item.badge}
                </span>

                {/* Price tag */}
                <span style={{
                    position: "absolute", top: 12, right: 12,
                    background: "#1c0a00", color: "#fbbf24",
                    borderRadius: 50, padding: "4px 12px",
                    fontSize: ".9rem", fontWeight: 800,
                    fontFamily: "'Boogaloo', cursive",
                }}>
                    ৳{item.price}
                </span>
            </div>

            {/* Content */}
            <div style={{ padding: "16px 18px", flex: 1, display: "flex", flexDirection: "column" }}>
                <h5 style={{
                    fontFamily: "'Boogaloo', cursive",
                    fontSize: "1.3rem", color: "#1c0a00", marginBottom: 6,
                }}>
                    {item.name}
                </h5>

                <p style={{
                    fontSize: ".83rem", color: "#888", lineHeight: 1.6,
                    marginBottom: 12, flex: 1,
                }}>
                    {item.desc}
                </p>

                {/* Pizza specs */}
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
                    {[item.size, item.crust + " crust", item.sauce].map(tag => (
                        <span key={tag} style={styles.tag}>{tag}</span>
                    ))}
                </div>

                {/* Toppings */}
                {item.toppings.length > 0 && (
                    <div style={{ marginBottom: 14 }}>
                        <div style={{ fontSize: ".75rem", color: "#aaa", fontWeight: 700, marginBottom: 4 }}>
                            TOPPINGS
                        </div>
                        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                            {item.toppings.map(t => (
                                <span key={t.label} style={styles.toppingChip}>
                                    {t.icon} {t.label}
                                </span>
                            ))}
                        </div>
                    </div>
                )}

                {/* Buttons */}
                <div style={{ display: "flex", gap: 8 }}>
                    <button
                        onClick={onAdd}
                        className={isAdded ? "add-btn-pop" : ""}
                        style={{
                            flex: 1, padding: "10px 0",
                            background: isAdded ? "#16a34a" : "#e63329",
                            color: "#fff", border: "none", borderRadius: 50,
                            fontFamily: "'Boogaloo', cursive", fontSize: "1rem",
                            cursor: "pointer", transition: "background .3s",
                        }}
                    >
                        {isAdded ? "✅ Added!" : "🛒 Add to Cart"}
                    </button>

                    <button
                        onClick={onCustomize}
                        style={{
                            padding: "10px 14px",
                            background: "transparent", color: "#e63329",
                            border: "2px solid #e63329", borderRadius: 50,
                            fontFamily: "'Boogaloo', cursive", fontSize: ".9rem",
                            cursor: "pointer", whiteSpace: "nowrap",
                        }}
                        title="Customize this pizza"
                    >
                        ✏️
                    </button>
                </div>
            </div>
        </div>
    );
}

// ── Styles ────────────────────────────────────────────
const styles = {
    hero: {
        background: "linear-gradient(135deg, #1c0a00 0%, #7c2d12 50%, #e63329 100%)",
        padding: "60px 20px 48px",
        position: "relative",
        overflow: "hidden",
    },
    heroOverlay: {
        position: "absolute", inset: 0,
        background: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23ffffff\' fill-opacity=\'0.03\'%3E%3Ccircle cx=\'30\' cy=\'30\' r=\'30\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")',
    },
    heroTitle: {
        fontFamily: "'Boogaloo', cursive",
        fontSize: "clamp(2.5rem, 5vw, 4rem)",
        color: "#fff", marginBottom: 8,
    },
    heroSub: {
        color: "rgba(255,255,255,.75)",
        fontSize: "1rem", marginBottom: 28,
    },
    searchWrap: {
        position: "relative", maxWidth: 520,
        margin: "0 auto", display: "flex", alignItems: "center",
    },
    searchIcon: {
        position: "absolute", left: 16,
        fontSize: "1.1rem", pointerEvents: "none",
    },
    searchInput: {
        width: "100%", padding: "14px 48px",
        borderRadius: 50, border: "none", outline: "none",
        fontFamily: "Nunito, sans-serif", fontSize: ".95rem",
        boxShadow: "0 4px 20px rgba(0,0,0,.2)",
        background: "#fff",
    },
    clearBtn: {
        position: "absolute", right: 14,
        background: "#e5e7eb", border: "none", borderRadius: "50%",
        width: 26, height: 26, cursor: "pointer",
        fontSize: ".8rem", color: "#666",
        display: "flex", alignItems: "center", justifyContent: "center",
    },

    filterBar: {
        display: "flex", justifyContent: "space-between",
        alignItems: "center", flexWrap: "wrap",
        gap: 12, marginBottom: 16,
        padding: "16px 20px",
        background: "#fff", borderRadius: 16,
        boxShadow: "0 2px 12px rgba(0,0,0,.06)",
    },
    pills: { display: "flex", gap: 8, flexWrap: "wrap" },
    pill: {
        padding: "6px 16px", borderRadius: 50,
        cursor: "pointer", fontSize: ".82rem",
        fontFamily: "Nunito, sans-serif",
        transition: "all .2s",
    },
    sortSelect: {
        padding: "8px 14px", borderRadius: 50,
        border: "2px solid #e5e7eb", outline: "none",
        fontFamily: "Nunito, sans-serif", fontSize: ".85rem",
        background: "#fff", cursor: "pointer", color: "#555",
    },

    catHeading: {
        display: "flex", alignItems: "center",
        gap: 16, marginBottom: 20,
    },
    catTitle: {
        fontFamily: "'Boogaloo', cursive",
        fontSize: "1.6rem", color: "#7c2d12",
        whiteSpace: "nowrap", marginBottom: 0,
    },
    catLine: {
        flex: 1, height: 2,
        background: "linear-gradient(to right, #e63329, transparent)",
        borderRadius: 2,
    },

    tag: {
        background: "#fff8f0", color: "#7c2d12",
        border: "1px solid #fde68a",
        borderRadius: 50, padding: "2px 10px",
        fontSize: ".72rem", fontWeight: 700,
    },
    toppingChip: {
        background: "#f0fdf4", color: "#166534",
        border: "1px solid #86efac",
        borderRadius: 50, padding: "2px 8px",
        fontSize: ".72rem", fontWeight: 600,
    },

    noResults: {
        textAlign: "center", padding: "60px 20px",
        background: "#fff", borderRadius: 20,
        marginBottom: 32,
    },
    resetBtn: {
        background: "#e63329", color: "#fff",
        border: "none", borderRadius: 50,
        padding: "10px 24px", cursor: "pointer",
        fontFamily: "Nunito, sans-serif", fontWeight: 700,
        marginTop: 12,
    },

    bottomCta: {
        background: "linear-gradient(135deg, #e63329, #f97316)",
        borderRadius: 24, padding: "40px 32px",
        textAlign: "center", color: "#fff",
        marginBottom: 32,
    },
    ctaTitle: {
        fontFamily: "'Boogaloo', cursive",
        fontSize: "2rem", marginBottom: 8,
    },
    ctaBtn: {
        background: "#fbbf24", color: "#1c0a00",
        border: "none", borderRadius: 50,
        padding: "14px 36px", cursor: "pointer",
        fontFamily: "'Boogaloo', cursive",
        fontSize: "1.3rem",
        boxShadow: "0 4px 0 #b45309",
    },

    floatingCart: {
        position: "fixed", bottom: 24, left: "50%",
        transform: "translateX(-50%)",
        background: "#1c0a00", color: "#fbbf24",
        border: "none", borderRadius: 50,
        padding: "14px 28px", cursor: "pointer",
        fontFamily: "'Boogaloo', cursive", fontSize: "1.1rem",
        boxShadow: "0 8px 24px rgba(0,0,0,.3)",
        zIndex: 90,
        animation: "floatIn .4s ease",
    },

    toast: {
        position: "fixed", bottom: 80, left: "50%",
        background: "#1c0a00", color: "#fff",
        padding: "12px 24px", borderRadius: 50,
        fontWeight: 700, fontSize: ".9rem",
        zIndex: 999, transition: "transform .35s ease",
        pointerEvents: "none", whiteSpace: "nowrap",
        boxShadow: "0 4px 20px rgba(0,0,0,.25)",
    },
};
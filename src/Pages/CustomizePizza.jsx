// Step-by-step pizza builder — game-like wizard + AI preview + favorites
import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useCart } from "../Context/CartContext";
import { generatePizzaImage } from "../api";
import { saveFavorite } from "../utils/favorites";
import FavoritesStrip from "../components/FavoritesStrip";
import {
    SIZES, CRUSTS, SAUCES, CHEESE_TYPES, TOPPINGS, EXTRA_ADD_INS,
    MAX_TOPPINGS, MAX_CHEESE_PORTIONS, WIZARD_STEPS, EMPTY_PIZZA,
    calcPizzaTotal, pizzaToCartPayload, itemToPizzaState,
} from "../data/pizzaOptions";

export default function CustomizePizza() {
    const [step, setStep] = useState(0);
    const [pizza, setPizza] = useState(EMPTY_PIZZA);
    const [toast, setToast] = useState("");
    const [favName, setFavName] = useState("");
    const [aiImage, setAiImage] = useState(null);
    const [aiLoading, setAiLoading] = useState(false);
    const [aiError, setAiError] = useState("");
    const aiRequested = useRef(false);

    const navigate = useNavigate();
    const location = useLocation();
    const { addToCart } = useCart();

    // Restore from navigation (favorite load)
    useEffect(() => {
        if (location.state?.pizzaState) {
            setPizza(location.state.pizzaState);
            setStep(0);
        }
    }, [location.state]);

    function showToast(msg) {
        setToast(msg);
        setTimeout(() => setToast(""), 2800);
    }

    const total = calcPizzaTotal(pizza);
    const current = WIZARD_STEPS[step];
    const progress = ((step + 1) / WIZARD_STEPS.length) * 100;

    function selectSingle(type, label, price) {
        setPizza((p) => ({ ...p, [type]: label, [`${type}Price`]: price }));
    }

    function toggleTopping(item) {
        setPizza((prev) => {
            const exists = prev.toppings.find((t) => t.label === item.label);
            if (exists) {
                return {
                    ...prev,
                    toppings: prev.toppings.filter((t) => t.label !== item.label),
                    toppingPrice: prev.toppingPrice - item.price,
                };
            }
            if (prev.toppings.length >= MAX_TOPPINGS) {
                showToast(`⚠️ Max ${MAX_TOPPINGS} toppings!`);
                return prev;
            }
            return {
                ...prev,
                toppings: [...prev.toppings, item],
                toppingPrice: prev.toppingPrice + item.price,
            };
        });
    }

    function toggleAddIn(item) {
        setPizza((prev) => {
            const exists = prev.addIns.find((a) => a.label === item.label);
            if (exists) {
                return {
                    ...prev,
                    addIns: prev.addIns.filter((a) => a.label !== item.label),
                    addInPrice: prev.addInPrice - item.price,
                };
            }
            return {
                ...prev,
                addIns: [...prev.addIns, item],
                addInPrice: prev.addInPrice + item.price,
            };
        });
    }

    function changeCheeseQty(cheese, delta) {
        setPizza((prev) => {
            const existing = prev.cheeses.find((c) => c.label === cheese.label);
            if (!existing && delta < 0) return prev;
            if (!existing && delta > 0) {
                return {
                    ...prev,
                    cheeses: [{ ...cheese, qty: 1 }],
                    cheesePrice: prev.cheesePrice + cheese.pricePerPortion,
                };
            }
            const newQty = existing.qty + delta;
            if (newQty <= 0) {
                return {
                    ...prev,
                    cheeses: prev.cheeses.filter((c) => c.label !== cheese.label),
                    cheesePrice: prev.cheesePrice - existing.qty * cheese.pricePerPortion,
                };
            }
            if (newQty > MAX_CHEESE_PORTIONS) {
                showToast(`⚠️ Max ${MAX_CHEESE_PORTIONS} portions per cheese!`);
                return prev;
            }
            return {
                ...prev,
                cheeses: prev.cheeses.map((c) =>
                    c.label === cheese.label ? { ...c, qty: newQty } : c
                ),
                cheesePrice: prev.cheesePrice + delta * cheese.pricePerPortion,
            };
        });
    }

    function validateStep(idx = step) {
        if (idx === 0 && !pizza.size) return "Pick a size to continue!";
        if (idx === 1 && (!pizza.crust || !pizza.sauce)) return "Choose crust and sauce!";
        return null;
    }

    function goNext() {
        const err = validateStep();
        if (err) { showToast(`⚠️ ${err}`); return; }
        if (step < WIZARD_STEPS.length - 1) setStep((s) => s + 1);
    }

    function goBack() {
        if (step > 0) setStep((s) => s - 1);
    }

    const fetchAiImage = useCallback(async () => {
        if (!pizza.crust || !pizza.sauce) return;
        setAiLoading(true);
        setAiError("");
        const res = await generatePizzaImage({
            crust: pizza.crust,
            sauce: pizza.sauce,
            toppings: pizza.toppings,
            cheeses: pizza.cheeses,
            addIns: pizza.addIns,
        });
        setAiLoading(false);
        if (res.imageUrl) {
            setAiImage(res.imageUrl);
            aiRequested.current = true;
        } else {
            setAiError(res.error || "Could not generate image");
        }
    }, [pizza.crust, pizza.sauce, pizza.toppings, pizza.cheeses, pizza.addIns]);

    // Auto-generate AI preview on finish step
    useEffect(() => {
        if (current?.id !== "finish") return;
        if (!pizza.crust || !pizza.sauce) return;
        const t = setTimeout(() => {
            if (!aiRequested.current) fetchAiImage();
        }, 400);
        return () => clearTimeout(t);
    }, [current?.id, pizza.crust, pizza.sauce, fetchAiImage]);

    useEffect(() => {
        if (current?.id !== "finish") {
            aiRequested.current = false;
            setAiImage(null);
            setAiError("");
        }
    }, [current?.id]);

    function handleAdd() {
        const err = validateStep(0) || validateStep(1);
        if (err) { showToast(`⚠️ ${err}`); return; }

        const user = JSON.parse(localStorage.getItem("user") || "null");
        if (!user) {
            showToast("⚠️ Please sign in to add to cart!");
            setTimeout(() => navigate("/login"), 1500);
            return;
        }

        const merged = addToCart(pizzaToCartPayload(pizza));
        setPizza(EMPTY_PIZZA);
        setStep(0);
        aiRequested.current = false;
        setAiImage(null);
        showToast(
            merged
                ? "🍕 Same pizza — quantity bumped! (saved to cart)"
                : "🍕 Added to cart! Safe to refresh — we remember it."
        );
    }

    function handleSaveFavorite() {
        const user = JSON.parse(localStorage.getItem("user") || "null");
        if (!user) {
            showToast("⚠️ Sign in to save favorites!");
            return;
        }
        if (!pizza.size) { showToast("⚠️ Build a pizza first!"); return; }
        const res = saveFavorite(pizzaToCartPayload(pizza), favName);
        if (res.ok) {
            showToast(`⭐ Saved as "${res.entry.name}"!`);
            setFavName("");
        } else {
            showToast(`⚠️ ${res.error}`);
        }
    }

    function loadFavorite(fav) {
        setPizza(itemToPizzaState(fav.item));
        setStep(0);
        showToast(`Loaded "${fav.name}" — tweak & go!`);
    }

    function reorderFavorite(fav) {
        const user = JSON.parse(localStorage.getItem("user") || "null");
        if (!user) {
            showToast("⚠️ Sign in first!");
            return;
        }
        const merged = addToCart({ ...fav.item, qty: 1 });
        showToast(
            merged
                ? `🛒 ${fav.name} — qty updated!`
                : `🛒 ${fav.name} added to cart!`
        );
    }

    const previewExtras = [
        ...pizza.cheeses.map((c) => `${c.label} ×${c.qty}`),
        ...pizza.toppings.map((t) => t.label),
        ...pizza.addIns.map((a) => a.label),
    ];

    return (
        <div style={{ background: "#fff8f0", minHeight: "calc(100vh - 68px)" }}>
            <div style={{ maxWidth: 1000, margin: "0 auto", padding: "28px 16px 48px" }}>

                <h2 style={styles.pageTitle}>🎮 Build Your Pizza</h2>
                <p style={styles.pageSub}>Level up your pizza — one step at a time!</p>

                <FavoritesStrip onLoad={loadFavorite} onReorder={reorderFavorite} />

                {/* Progress */}
                <div style={styles.progressWrap}>
                    <div style={{ ...styles.progressBar, width: `${progress}%` }} />
                    <div style={styles.stepsRow}>
                        {WIZARD_STEPS.map((s, i) => (
                            <button
                                key={s.id}
                                type="button"
                                onClick={() => {
                                    if (i < step) setStep(i);
                                    else if (i === step + 1) goNext();
                                }}
                                style={{
                                    ...styles.stepDot,
                                    background: i <= step ? "#e63329" : "#e5e7eb",
                                    color: i <= step ? "#fff" : "#888",
                                    transform: i === step ? "scale(1.15)" : "scale(1)",
                                    cursor: i <= step ? "pointer" : "default",
                                }}
                                title={s.title}
                            >
                                {i < step ? "✓" : s.emoji}
                            </button>
                        ))}
                    </div>
                    <p style={styles.stepLabel}>
                        Step {step + 1}/{WIZARD_STEPS.length} — <strong>{current.emoji} {current.title}</strong>
                        <span style={{ color: "#aaa" }}> · {current.hint}</span>
                    </p>
                </div>

                <div style={styles.grid}>
                    {/* Step content */}
                    <div style={styles.stepPanel}>
                        {step === 0 && (
                            <Section title="📏 How big?">
                                <OptionGrid items={SIZES} selected={pizza.size}
                                    onSelect={(item) => selectSingle("size", item.label, item.price)} />
                            </Section>
                        )}
                        {step === 1 && (
                            <>
                                <Section title="🥖 Crust style">
                                    <OptionGrid items={CRUSTS} selected={pizza.crust}
                                        onSelect={(item) => selectSingle("crust", item.label, item.price)} />
                                </Section>
                                <Section title="🍅 Sauce base">
                                    <OptionGrid items={SAUCES} selected={pizza.sauce}
                                        onSelect={(item) => selectSingle("sauce", item.label, item.price)} />
                                </Section>
                            </>
                        )}
                        {step === 2 && (
                            <Section title="🧀 Cheese" hint={`Optional · max ${MAX_CHEESE_PORTIONS} portions each`}>
                                <CheeseGrid cheeses={CHEESE_TYPES} selected={pizza.cheeses} onChangeQty={changeCheeseQty} />
                                <p style={styles.skipHint}>No cheese? Tap Next — totally fine!</p>
                            </Section>
                        )}
                        {step === 3 && (
                            <Section title={`🌶️ Toppings (max ${MAX_TOPPINGS})`}>
                                <OptionGrid items={TOPPINGS} selected={pizza.toppings.map((t) => t.label)}
                                    onSelect={toggleTopping} multi accent="#16a34a" />
                            </Section>
                        )}
                        {step === 4 && (
                            <>
                                <Section title="✨ Extra add-ins" hint="Stack as many as you like">
                                    <OptionGrid items={EXTRA_ADD_INS} selected={pizza.addIns.map((a) => a.label)}
                                        onSelect={toggleAddIn} multi accent="#f97316" />
                                </Section>
                                <Section title="⭐ Save this combo">
                                    <div style={styles.favRow}>
                                        <input
                                            value={favName}
                                            onChange={(e) => setFavName(e.target.value)}
                                            placeholder='Name it… e.g. "Friday Night"'
                                            style={styles.favInput}
                                        />
                                        <button type="button" onClick={handleSaveFavorite} style={styles.favSaveBtn}>
                                            Save ⭐
                                        </button>
                                    </div>
                                </Section>
                            </>
                        )}

                        <div style={styles.navRow}>
                            <button type="button" onClick={goBack} disabled={step === 0} style={{
                                ...styles.navBtn,
                                opacity: step === 0 ? 0.4 : 1,
                            }}>
                                ← Back
                            </button>
                            {step < WIZARD_STEPS.length - 1 ? (
                                <button type="button" onClick={goNext} style={{ ...styles.navBtn, ...styles.navNext }}>
                                    Next →
                                </button>
                            ) : (
                                <button type="button" onClick={handleAdd} style={{ ...styles.navBtn, ...styles.navAdd }}>
                                    🛒 Add to Cart
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Preview */}
                    <div style={styles.previewWrap}>
                        <div style={styles.previewCard}>
                            <h3 style={styles.previewTitle}>Live Preview</h3>

                            <div style={styles.previewImageBox}>
                                {aiImage ? (
                                    <img src={aiImage} alt="Your AI pizza" style={styles.aiImg} />
                                ) : (
                                    <div style={styles.pizzaPlate}>
                                        <div style={styles.sauceLayer} />
                                        <div style={{
                                            ...styles.cheeseLayer,
                                            opacity: pizza.cheeses.length ? 1 : 0.85,
                                        }} />
                                        <div style={styles.toppingsLayer}>
                                            {pizza.cheeses.map((c) => (
                                                <span key={`c-${c.label}`}>{c.icon}</span>
                                            ))}
                                            {pizza.toppings.map((t) => (
                                                <span key={t.label}>{t.icon}</span>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                {aiLoading && (
                                    <div style={styles.aiOverlay}>
                                        <span>🤖 AI is cooking your preview…</span>
                                    </div>
                                )}
                            </div>

                            {step === 4 && (
                                <button
                                    type="button"
                                    onClick={() => { aiRequested.current = false; fetchAiImage(); }}
                                    disabled={aiLoading || !pizza.crust}
                                    style={styles.aiBtn}
                                >
                                    {aiLoading ? "⏳ Generating…" : aiImage ? "🔄 Regenerate AI Photo" : "✨ Generate AI Pizza Photo"}
                                </button>
                            )}
                            {aiError && <p style={styles.aiErr}>{aiError}</p>}

                            <div style={styles.price}>৳{total}<span style={styles.priceSub}> total</span></div>
                            <PriceBreakdown pizza={pizza} total={total} />

                            <p style={styles.summary}>
                                {[
                                    pizza.size && `${pizza.size}`,
                                    pizza.crust && `${pizza.crust} crust`,
                                    pizza.sauce && `${pizza.sauce}`,
                                    previewExtras.length > 0 && previewExtras.join(", "),
                                ].filter(Boolean).join(" · ") || "Start building!"}
                            </p>

                            {step === 4 && (
                                <button type="button" onClick={handleAdd} style={styles.addBtn}>
                                    🛒 Add to Cart — ৳{total}
                                </button>
                            )}
                            <button type="button" onClick={() => navigate("/cart")} style={styles.viewCartBtn}>
                                View Cart →
                            </button>
                            <p style={styles.persistNote}>💾 Cart auto-saves — refresh-safe!</p>
                        </div>
                    </div>
                </div>
            </div>

            <div style={{
                ...styles.toast,
                transform: toast ? "translateX(-50%) translateY(0)" : "translateX(-50%) translateY(80px)",
            }}>
                {toast}
            </div>

            <style>{`
                @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.6} }
                @keyframes slideIn { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
                .step-panel-anim { animation: slideIn .35s ease; }
            `}</style>
        </div>
    );
}

function Section({ title, hint, children }) {
    return (
        <div style={styles.section} className="step-panel-anim">
            <h4 style={styles.sectionTitle}>{title}</h4>
            {hint && <p style={styles.sectionHint}>{hint}</p>}
            {children}
        </div>
    );
}

function OptionGrid({ items, selected, onSelect, multi = false, accent = "#e63329" }) {
    return (
        <div style={styles.optionGrid}>
            {items.map((item) => {
                const isSelected = multi
                    ? Array.isArray(selected) && selected.includes(item.label)
                    : selected === item.label;
                return (
                    <button key={item.label} type="button" onClick={() => onSelect(item)} style={{
                        ...styles.optionBtn,
                        border: `2px solid ${isSelected ? accent : "#e5e7eb"}`,
                        background: isSelected
                            ? multi ? (accent === "#f97316" ? "#fff7ed" : "#f0fdf4") : "#fff0ee"
                            : "#f9f9f9",
                        color: isSelected ? accent : "#1c0a00",
                    }}>
                        <span style={{ fontSize: "1.5rem" }}>{item.icon}</span>
                        <span>{item.label}</span>
                        {(item.price > 0 || item.pricePerPortion > 0) && (
                            <span style={{ fontSize: ".7rem", color: "#888", fontWeight: 400 }}>
                                +৳{item.price ?? item.pricePerPortion}
                            </span>
                        )}
                    </button>
                );
            })}
        </div>
    );
}

function CheeseGrid({ cheeses, selected, onChangeQty }) {
    return (
        <div style={styles.cheeseGrid}>
            {cheeses.map((cheese) => {
                const entry = selected.find((c) => c.label === cheese.label);
                const qty = entry?.qty || 0;
                const isActive = qty > 0;
                return (
                    <div key={cheese.label} style={{
                        ...styles.cheeseCard,
                        border: `2px solid ${isActive ? "#f59e0b" : "#e5e7eb"}`,
                        background: isActive ? "#fffbeb" : "#f9f9f9",
                    }}>
                        <span style={{ fontSize: "1.6rem" }}>{cheese.icon}</span>
                        <span style={styles.cheeseLabel}>{cheese.label}</span>
                        <span style={styles.cheesePrice}>৳{cheese.pricePerPortion}/portion</span>
                        <div style={styles.qtyRow}>
                            <button type="button" onClick={() => onChangeQty(cheese, -1)}
                                style={{ ...styles.qtyBtn, opacity: qty === 0 ? 0.35 : 1 }}
                                disabled={qty === 0}>−</button>
                            <span style={{ ...styles.qtyNum, color: isActive ? "#d97706" : "#aaa" }}>{qty}</span>
                            <button type="button" onClick={() => onChangeQty(cheese, 1)} style={styles.qtyBtn}>+</button>
                        </div>
                        {isActive && <span style={styles.cheeseLineTotal}>+৳{qty * cheese.pricePerPortion}</span>}
                    </div>
                );
            })}
        </div>
    );
}

function PriceBreakdown({ pizza, total }) {
    const rows = [
        { label: "Size", amount: pizza.sizePrice, show: pizza.size },
        { label: "Crust", amount: pizza.crustPrice, show: pizza.crust },
        { label: "Sauce", amount: pizza.saucePrice, show: pizza.sauce },
        { label: "Cheese", amount: pizza.cheesePrice, show: pizza.cheesePrice > 0 },
        { label: "Toppings", amount: pizza.toppingPrice, show: pizza.toppingPrice > 0 },
        { label: "Add-ins", amount: pizza.addInPrice, show: pizza.addInPrice > 0 },
    ].filter((r) => r.show);
    if (!rows.length) return null;
    return (
        <div style={styles.breakdown}>
            {rows.map((r) => (
                <div key={r.label} style={styles.breakdownRow}>
                    <span>{r.label}</span><span>৳{r.amount}</span>
                </div>
            ))}
            <div style={{ ...styles.breakdownRow, ...styles.breakdownTotal }}>
                <span>Total</span><span>৳{total}</span>
            </div>
        </div>
    );
}

const styles = {
    pageTitle: {
        fontFamily: "'Boogaloo', cursive", fontSize: "2.4rem",
        color: "#e63329", textAlign: "center", marginBottom: 4,
    },
    pageSub: { textAlign: "center", color: "#888", marginBottom: 20 },
    progressWrap: {
        background: "#fff", borderRadius: 20, padding: "18px 20px",
        marginBottom: 24, boxShadow: "0 4px 16px rgba(0,0,0,.06)",
    },
    progressBar: {
        height: 6, background: "linear-gradient(90deg, #e63329, #f97316)",
        borderRadius: 6, marginBottom: 14, transition: "width .4s ease",
    },
    stepsRow: { display: "flex", justifyContent: "space-between", marginBottom: 10 },
    stepDot: {
        width: 40, height: 40, borderRadius: "50%", border: "none",
        fontSize: "1.1rem", fontWeight: 800, transition: "all .25s",
        boxShadow: "0 2px 8px rgba(0,0,0,.1)",
    },
    stepLabel: { fontSize: ".88rem", color: "#555", margin: 0, textAlign: "center" },
    grid: {
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
        gap: 24, alignItems: "start",
    },
    stepPanel: { display: "flex", flexDirection: "column", gap: 16 },
    section: {
        background: "#fff", borderRadius: 20, padding: 20,
        boxShadow: "0 4px 16px rgba(0,0,0,.06)",
    },
    sectionTitle: {
        fontFamily: "'Boogaloo', cursive", fontSize: "1.25rem",
        color: "#7c2d12", marginBottom: 4,
    },
    sectionHint: { fontSize: ".78rem", color: "#aaa", marginBottom: 12 },
    skipHint: { fontSize: ".8rem", color: "#16a34a", marginTop: 12, fontWeight: 600 },
    optionGrid: {
        display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(86px, 1fr))", gap: 8,
    },
    optionBtn: {
        padding: "10px 6px", borderRadius: 14, cursor: "pointer",
        fontFamily: "Nunito, sans-serif", fontSize: ".8rem", fontWeight: 700,
        textAlign: "center", display: "flex", flexDirection: "column",
        alignItems: "center", gap: 3,
    },
    cheeseGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: 10 },
    cheeseCard: {
        borderRadius: 16, padding: "14px 10px", textAlign: "center",
        display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
    },
    cheeseLabel: { fontFamily: "Nunito, sans-serif", fontSize: ".82rem", fontWeight: 800 },
    cheesePrice: { fontSize: ".68rem", color: "#888" },
    qtyRow: { display: "flex", alignItems: "center", gap: 8, marginTop: 6 },
    qtyBtn: {
        width: 28, height: 28, borderRadius: "50%", border: "2px solid #f59e0b",
        background: "#fff", color: "#d97706", fontWeight: 800, cursor: "pointer",
    },
    qtyNum: { fontFamily: "'Boogaloo', cursive", fontSize: "1.1rem", minWidth: 20 },
    cheeseLineTotal: { fontSize: ".72rem", fontWeight: 800, color: "#d97706" },
    navRow: { display: "flex", gap: 10, marginTop: 8 },
    navBtn: {
        flex: 1, padding: "14px 0", borderRadius: 50, border: "2px solid #e5e7eb",
        background: "#fff", fontFamily: "'Boogaloo', cursive", fontSize: "1.1rem",
        cursor: "pointer", color: "#555",
    },
    navNext: { background: "#e63329", color: "#fff", border: "none", boxShadow: "0 4px 0 #b91c1c" },
    navAdd: { background: "#16a34a", color: "#fff", border: "none", boxShadow: "0 4px 0 #166534" },
    favRow: { display: "flex", gap: 8 },
    favInput: {
        flex: 1, padding: "10px 14px", borderRadius: 50, border: "2px solid #fde68a",
        outline: "none", fontFamily: "Nunito, sans-serif",
    },
    favSaveBtn: {
        padding: "10px 18px", borderRadius: 50, border: "none",
        background: "#fbbf24", color: "#1c0a00",
        fontFamily: "'Boogaloo', cursive", fontWeight: 700, cursor: "pointer",
    },
    previewWrap: { position: "sticky", top: 90 },
    previewCard: {
        background: "#fff", borderRadius: 24, padding: 24,
        boxShadow: "0 8px 32px rgba(230,51,41,.12)", textAlign: "center",
    },
    previewTitle: {
        fontFamily: "'Boogaloo', cursive", fontSize: "1.35rem", color: "#7c2d12", marginBottom: 12,
    },
    previewImageBox: { position: "relative", marginBottom: 12 },
    aiImg: {
        width: "100%", maxWidth: 220, height: 220, objectFit: "cover",
        borderRadius: "50%", margin: "0 auto", display: "block",
        boxShadow: "0 8px 24px rgba(0,0,0,.15)",
    },
    pizzaPlate: {
        width: 200, height: 200, borderRadius: "50%", margin: "0 auto",
        background: "radial-gradient(circle, #f59e0b 0%, #d97706 40%, #92400e 80%, #78350f 100%)",
        position: "relative", boxShadow: "0 8px 32px rgba(0,0,0,.2)",
    },
    sauceLayer: {
        position: "absolute", width: "76%", height: "76%", borderRadius: "50%",
        background: "radial-gradient(circle, #dc2626, #b91c1c)",
        top: "12%", left: "12%",
    },
    cheeseLayer: {
        position: "absolute", width: "64%", height: "64%", borderRadius: "50%",
        background: "radial-gradient(circle, #fde68a, #fbbf24)",
        top: "18%", left: "18%",
    },
    toppingsLayer: {
        position: "absolute", width: "64%", height: "64%", borderRadius: "50%",
        top: "18%", left: "18%", display: "flex", flexWrap: "wrap",
        alignItems: "center", justifyContent: "center", fontSize: "1.1rem", gap: 2,
    },
    aiOverlay: {
        position: "absolute", inset: 0, display: "flex", alignItems: "center",
        justifyContent: "center", background: "rgba(255,255,255,.85)",
        borderRadius: "50%", fontSize: ".8rem", fontWeight: 700, color: "#7c2d12",
        animation: "pulse 1.2s infinite",
    },
    aiBtn: {
        width: "100%", padding: "10px 0", marginBottom: 10,
        background: "linear-gradient(135deg, #7c3aed, #a855f7)",
        color: "#fff", border: "none", borderRadius: 50,
        fontFamily: "'Boogaloo', cursive", fontSize: ".95rem", cursor: "pointer",
    },
    aiErr: { fontSize: ".75rem", color: "#dc2626", marginBottom: 8 },
    price: { fontFamily: "'Boogaloo', cursive", fontSize: "2rem", color: "#e63329" },
    priceSub: { fontSize: ".9rem", color: "#888", fontFamily: "Nunito, sans-serif" },
    breakdown: {
        background: "#fff8f0", borderRadius: 14, padding: "10px 12px",
        marginBottom: 10, textAlign: "left",
    },
    breakdownRow: {
        display: "flex", justifyContent: "space-between",
        fontSize: ".78rem", color: "#666", padding: "2px 0",
    },
    breakdownTotal: {
        borderTop: "1px dashed #fde68a", marginTop: 4, paddingTop: 6,
        fontWeight: 800, color: "#e63329",
    },
    summary: { fontSize: ".82rem", color: "#666", lineHeight: 1.6, minHeight: 40, marginBottom: 10 },
    addBtn: {
        width: "100%", padding: 14, background: "#16a34a", color: "#fff",
        border: "none", borderRadius: 50, fontFamily: "'Boogaloo', cursive",
        fontSize: "1.2rem", cursor: "pointer", marginBottom: 8,
        boxShadow: "0 4px 0 #166534",
    },
    viewCartBtn: {
        width: "100%", padding: 10, background: "transparent", color: "#e63329",
        border: "2px solid #e63329", borderRadius: 50,
        fontFamily: "'Boogaloo', cursive", cursor: "pointer",
    },
    persistNote: { fontSize: ".72rem", color: "#16a34a", marginTop: 10, fontWeight: 700 },
    toast: {
        position: "fixed", bottom: 24, left: "50%",
        background: "#1c0a00", color: "#fff", padding: "12px 24px",
        borderRadius: 50, fontWeight: 700, zIndex: 999,
        transition: "transform .3s", pointerEvents: "none",
    },
};

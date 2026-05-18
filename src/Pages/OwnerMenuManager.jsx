// Owner menu management — add/edit/delete items, pricing, discounts, photos

import { useState, useEffect, useCallback } from "react";
import {
    fetchAdminMenu,
    createMenuItem,
    updateMenuItem,
    deleteMenuItem,
} from "../api";
import "../styles/menu-admin.css";

const EMPTY_FORM = {
    section: "pizza",
    category: "🔥 Bestsellers",
    name: "",
    description: "",
    price: "",
    discount_percent: "0",
    badge: "",
    badge_color: "#e63329",
    image_url: "",
    size: "Large",
    crust: "Classic",
    sauce: "Tomato",
    is_available: true,
};

export default function OwnerMenuManager({ token, showToast }) {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [form, setForm] = useState(EMPTY_FORM);
    const [editingId, setEditingId] = useState(null);
    const [busy, setBusy] = useState(false);
    const [filter, setFilter] = useState("all");

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const data = await fetchAdminMenu(token);
            setItems(data.items || []);
        } catch (err) {
            showToast("❌ " + err.message);
        } finally {
            setLoading(false);
        }
    }, [token, showToast]);

    useEffect(() => { load(); }, [load]);

    useEffect(() => {
        let ws;
        let timer;
        function connect() {
            ws = new WebSocket("ws://127.0.0.1:8000/ws");
            ws.onmessage = (e) => {
                try {
                    const msg = JSON.parse(e.data);
                    if (msg.type === "MENU_UPDATE") load();
                } catch { /* ignore */ }
            };
            ws.onclose = () => { timer = setTimeout(connect, 4000); };
        }
        connect();
        return () => { clearTimeout(timer); ws?.close(); };
    }, [load]);

    function setField(key, value) {
        setForm((f) => ({ ...f, [key]: value }));
    }

    function startEdit(item) {
        setEditingId(item.id);
        setForm({
            section: item.section || "pizza",
            category: item.category || "",
            name: item.name || "",
            description: item.desc || item.description || "",
            price: String(item.original_price ?? item.price ?? ""),
            discount_percent: String(item.discount_percent ?? 0),
            badge: item.badge || "",
            badge_color: item.badgeColor || item.badge_color || "#e63329",
            image_url: item.image || "",
            size: item.size || "",
            crust: item.crust || "",
            sauce: item.sauce || "",
            is_available: item.is_available !== false,
        });
        window.scrollTo({ top: 0, behavior: "smooth" });
    }

    function cancelEdit() {
        setEditingId(null);
        setForm(EMPTY_FORM);
    }

    function handlePhotoFile(e) {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 900_000) {
            showToast("⚠️ Image too large (max ~900KB). Use a URL instead.");
            return;
        }
        const reader = new FileReader();
        reader.onload = () => setField("image_url", reader.result);
        reader.readAsDataURL(file);
    }

    async function handleSubmit(e) {
        e.preventDefault();
        const price = parseFloat(form.price);
        if (!form.name.trim() || !price || price <= 0) {
            showToast("Name and valid price are required");
            return;
        }
        const payload = {
            section: form.section,
            category: form.category.trim() || "📋 General",
            name: form.name.trim(),
            description: form.description.trim(),
            price,
            discount_percent: parseFloat(form.discount_percent) || 0,
            badge: form.badge.trim() || null,
            badge_color: form.badge_color || "#e63329",
            image_url: form.image_url.trim(),
            size: form.section === "pizza" ? (form.size || "Large") : "",
            crust: form.section === "pizza" ? (form.crust || "Classic") : "",
            sauce: form.section === "pizza" ? (form.sauce || "Tomato") : "",
            toppings: [],
            tags: [],
            is_available: form.is_available,
        };

        setBusy(true);
        try {
            if (editingId) {
                await updateMenuItem(editingId, payload, token);
                showToast("✅ Item updated — customers see it live");
            } else {
                await createMenuItem(payload, token);
                showToast("✅ Item added to menu");
            }
            cancelEdit();
            load();
        } catch (err) {
            showToast("❌ " + err.message);
        } finally {
            setBusy(false);
        }
    }

    async function toggleAvailable(item) {
        try {
            await updateMenuItem(item.id, { is_available: !item.is_available }, token);
            showToast(item.is_available ? "Item hidden from menu" : "Item is live again");
            load();
        } catch (err) {
            showToast("❌ " + err.message);
        }
    }

    async function applyDiscount(item, percent) {
        try {
            await updateMenuItem(item.id, { discount_percent: percent }, token);
            showToast(percent ? `Discount set to ${percent}%` : "Discount removed");
            load();
        } catch (err) {
            showToast("❌ " + err.message);
        }
    }

    async function adjustPrice(item, delta) {
        const base = item.original_price ?? item.price;
        const next = Math.max(1, Math.round((base + delta) * 100) / 100);
        try {
            await updateMenuItem(item.id, { price: next }, token);
            showToast(`Price updated to ৳${next}`);
            load();
        } catch (err) {
            showToast("❌ " + err.message);
        }
    }

    async function handleDelete(item) {
        if (!window.confirm(`Delete "${item.name}" permanently?`)) return;
        try {
            await deleteMenuItem(item.id, token);
            showToast("🗑️ Item deleted");
            if (editingId === item.id) cancelEdit();
            load();
        } catch (err) {
            showToast("❌ " + err.message);
        }
    }

    const filtered = items.filter((i) => {
        if (filter === "pizza") return i.section === "pizza";
        if (filter === "fastfood") return i.section === "fastfood";
        if (filter === "off") return !i.is_available;
        return true;
    });

    return (
        <div className="pf-menu-admin">
            <div className="pf-menu-toolbar pf-no-print">
                <a href="/menu" target="_blank" rel="noopener noreferrer" className="pf-btn-primary" style={{ textDecoration: "none", display: "inline-block" }}>
                    👁 View customer menu
                </a>
                <a href="/" target="_blank" rel="noopener noreferrer" className="pf-btn-outline" style={{ textDecoration: "none", display: "inline-block" }}>
                    🏠 View homepage
                </a>
                <button type="button" className="pf-btn-outline" onClick={load}>🔃 Refresh</button>
                <select className="pf-input" value={filter} onChange={(e) => setFilter(e.target.value)} style={{ width: "auto" }}>
                    <option value="all">All items</option>
                    <option value="pizza">Pizzas only</option>
                    <option value="fastfood">Fast food only</option>
                    <option value="off">Unavailable</option>
                </select>
            </div>

            <div className="pf-menu-form pf-no-print">
                <h4>{editingId ? "✏️ Edit menu item" : "➕ Add new menu item"}</h4>
                <form onSubmit={handleSubmit}>
                    <div className="pf-menu-form-grid">
                        <label>
                            Type
                            <select className="pf-input" value={form.section} onChange={(e) => setField("section", e.target.value)}>
                                <option value="pizza">🍕 Pizza</option>
                                <option value="fastfood">🍔 Fast food</option>
                            </select>
                        </label>
                        <label>
                            Category
                            <input className="pf-input" value={form.category} onChange={(e) => setField("category", e.target.value)} placeholder="🔥 Bestsellers" required />
                        </label>
                        <label>
                            Name
                            <input className="pf-input" value={form.name} onChange={(e) => setField("name", e.target.value)} required />
                        </label>
                        <label>
                            Price (৳)
                            <input className="pf-input" type="number" min="1" step="1" value={form.price} onChange={(e) => setField("price", e.target.value)} required />
                        </label>
                        <label>
                            Discount %
                            <input className="pf-input" type="number" min="0" max="100" value={form.discount_percent} onChange={(e) => setField("discount_percent", e.target.value)} />
                        </label>
                        <label>
                            Badge (optional)
                            <input className="pf-input" value={form.badge} onChange={(e) => setField("badge", e.target.value)} placeholder="🔥 Hot" />
                        </label>
                        {form.section === "pizza" && (
                            <>
                                <label>Size<input className="pf-input" value={form.size} onChange={(e) => setField("size", e.target.value)} /></label>
                                <label>Crust<input className="pf-input" value={form.crust} onChange={(e) => setField("crust", e.target.value)} /></label>
                                <label>Sauce<input className="pf-input" value={form.sauce} onChange={(e) => setField("sauce", e.target.value)} /></label>
                            </>
                        )}
                        <label style={{ gridColumn: "1 / -1" }}>
                            Description / info for customers
                            <textarea className="pf-input" value={form.description} onChange={(e) => setField("description", e.target.value)} placeholder="Ingredients, allergens, story…" />
                        </label>
                        <label style={{ gridColumn: "1 / -1" }}>
                            Photo URL
                            <input className="pf-input" value={form.image_url.startsWith("data:") ? "" : form.image_url} onChange={(e) => setField("image_url", e.target.value)} placeholder="https://…" />
                        </label>
                        <label>
                            Upload photo
                            <input type="file" accept="image/*" onChange={handlePhotoFile} />
                        </label>
                        <label className="pf-avail-toggle" style={{ alignSelf: "end" }}>
                            <input type="checkbox" checked={form.is_available} onChange={(e) => setField("is_available", e.target.checked)} />
                            Available on menu
                        </label>
                    </div>
                    {form.image_url && (
                        <img src={form.image_url} alt="Preview" className="pf-photo-preview" />
                    )}
                    <div style={{ display: "flex", gap: 10, marginTop: 16, flexWrap: "wrap" }}>
                        <button type="submit" className="pf-btn-primary" disabled={busy}>
                            {busy ? "Saving…" : editingId ? "Save changes" : "Add item"}
                        </button>
                        {editingId && (
                            <button type="button" className="pf-btn-outline" onClick={cancelEdit}>Cancel</button>
                        )}
                    </div>
                </form>
            </div>

            {loading && <p style={{ textAlign: "center", color: "#888" }}>Loading menu…</p>}

            <div className="pf-menu-grid">
                {filtered.map((item) => (
                    <div key={item.id} className={`pf-menu-card ${!item.is_available ? "unavailable" : ""}`}>
                        <img src={item.image || "https://images.unsplash.com/photo-1628840042765-356cda07504e?w=400&q=80"} alt={item.name} />
                        <div className="pf-menu-card-body">
                            <div style={{ fontWeight: 800, fontSize: "1rem" }}>{item.name}</div>
                            <div style={{ fontSize: ".78rem", color: "#888", marginBottom: 6 }}>
                                {item.section === "pizza" ? "🍕" : "🍔"} {item.category}
                                {!item.is_available && " · Hidden"}
                            </div>
                            <div style={{ fontFamily: "'Boogaloo',cursive", fontSize: "1.2rem", color: "#e63329" }}>
                                ৳{item.price}
                                {item.discount_percent > 0 && (
                                    <span style={{ fontSize: ".75rem", color: "#16a34a", marginLeft: 8 }}>
                                        ({item.discount_percent}% off · was ৳{item.original_price})
                                    </span>
                                )}
                            </div>
                            <p style={{ fontSize: ".8rem", color: "#666", margin: "8px 0", lineHeight: 1.4 }}>
                                {(item.desc || "").slice(0, 100)}{(item.desc || "").length > 100 ? "…" : ""}
                            </p>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                                <button type="button" className="pf-btn-outline" style={{ padding: "6px 12px", fontSize: ".75rem" }} onClick={() => startEdit(item)}>Edit</button>
                                <button type="button" className="pf-btn-outline" style={{ padding: "6px 12px", fontSize: ".75rem" }} onClick={() => toggleAvailable(item)}>
                                    {item.is_available ? "Hide" : "Show"}
                                </button>
                                <button type="button" className="pf-btn-outline" style={{ padding: "6px 12px", fontSize: ".75rem" }} onClick={() => applyDiscount(item, item.discount_percent ? 0 : 15)}>
                                    {item.discount_percent ? "Remove %" : "15% off"}
                                </button>
                                <button type="button" className="pf-btn-outline" style={{ padding: "6px 12px", fontSize: ".75rem" }} onClick={() => adjustPrice(item, -50)}>−৳50</button>
                                <button type="button" className="pf-btn-outline" style={{ padding: "6px 12px", fontSize: ".75rem" }} onClick={() => adjustPrice(item, 50)}>+৳50</button>
                                <button type="button" style={{ padding: "6px 12px", fontSize: ".75rem", border: "2px solid #dc2626", background: "#fff", color: "#dc2626", borderRadius: 999, cursor: "pointer", fontWeight: 700 }} onClick={() => handleDelete(item)}>Delete</button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {!loading && filtered.length === 0 && (
                <p style={{ textAlign: "center", color: "#aaa" }}>No items in this filter. Add one above.</p>
            )}
        </div>
    );
}
// Saved pizzas & quick reorder — localStorage per user

function favoritesKey() {
    try {
        const user = JSON.parse(localStorage.getItem("user") || "null");
        if (user?.id != null) return `pizzafizz_favorites_u${user.id}`;
        if (user?.phone) return `pizzafizz_favorites_${user.phone}`;
    } catch {
        /* ignore */
    }
    return null;
}

export function getFavorites() {
    const key = favoritesKey();
    if (!key) return [];
    try {
        const raw = localStorage.getItem(key);
        const list = raw ? JSON.parse(raw) : [];
        return Array.isArray(list) ? list : [];
    } catch {
        return [];
    }
}

export function saveFavorite(item, customName) {
    const key = favoritesKey();
    if (!key) return { ok: false, error: "Sign in to save favorites" };

    const name =
        customName?.trim() ||
        item.name ||
        `${item.size || "Custom"} ${item.crust || ""} Pizza`.trim();

    const entry = {
        id: `fav_${Date.now()}`,
        name,
        savedAt: new Date().toISOString(),
        item: {
            name: item.name,
            size: item.size,
            crust: item.crust,
            sauce: item.sauce,
            cheeses: item.cheeses || [],
            toppings: item.toppings || [],
            addIns: item.addIns || [],
            price: parseFloat(item.price) || 0,
            type: item.type || "pizza",
        },
    };

    const list = getFavorites();
    const dup = list.findIndex(
        (f) =>
            f.item.size === entry.item.size &&
            f.item.crust === entry.item.crust &&
            f.item.sauce === entry.item.sauce &&
            f.name === entry.name
    );
    if (dup >= 0) list[dup] = entry;
    else list.unshift(entry);

    localStorage.setItem(key, JSON.stringify(list.slice(0, 12)));
    return { ok: true, entry };
}

export function removeFavorite(id) {
    const key = favoritesKey();
    if (!key) return;
    const list = getFavorites().filter((f) => f.id !== id);
    localStorage.setItem(key, JSON.stringify(list));
}

export function favoriteSummary(fav) {
    const i = fav.item;
    const parts = [
        i.size,
        i.crust && `${i.crust} crust`,
        i.sauce && `${i.sauce} sauce`,
    ].filter(Boolean);
    const extras = [
        ...(i.cheeses || []).map((c) => `${c.label}×${c.qty || 1}`),
        ...(i.toppings || []).map((t) => t.label || t),
        ...(i.addIns || []).map((a) => a.label || a),
    ];
    if (extras.length) parts.push(extras.slice(0, 4).join(", "));
    return parts.join(" · ");
}

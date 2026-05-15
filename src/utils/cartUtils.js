// Fingerprint cart lines so identical pizzas merge qty instead of duplicating.

function labels(list) {
    return (list || [])
        .map((x) => (typeof x === "string" ? x : x.label || ""))
        .filter(Boolean)
        .sort()
        .join(",");
}

function cheeseKey(list) {
    return (list || [])
        .map((c) => `${c.label || ""}:${c.qty || 1}`)
        .filter((s) => s && !s.startsWith(":"))
        .sort()
        .join(",");
}

export function cartItemKey(item) {
    if (!item) return "";
    return [
        item.type || "pizza",
        item.name || "",
        item.size || "",
        item.crust || "",
        item.sauce || "",
        labels(item.toppings),
        cheeseKey(item.cheeses),
        labels(item.addIns),
    ].join("|");
}

export function orderItemToCartItem(orderItem) {
    return {
        name: orderItem.name || `${orderItem.size || "Medium"} Pizza`,
        size: orderItem.size || "Medium",
        crust: orderItem.crust || "Classic",
        sauce: orderItem.sauce || "Tomato",
        toppings: orderItem.toppings || [],
        cheeses: orderItem.cheeses || [],
        addIns: orderItem.addIns || [],
        price: parseFloat(orderItem.price) || 0,
        qty: parseInt(orderItem.qty, 10) || 1,
        type: orderItem.type || "pizza",
    };
}

export function getCartStorageKey() {
    try {
        const user = JSON.parse(localStorage.getItem("user") || "null");
        if (user?.id != null) return `pizzafizz_cart_u${user.id}`;
        if (user?.phone) return `pizzafizz_cart_${user.phone}`;
    } catch {
        /* ignore */
    }
    return "pizzafizz_cart_guest";
}

export function loadCartFromStorage() {
    try {
        const raw = localStorage.getItem(getCartStorageKey());
        const parsed = raw ? JSON.parse(raw) : [];
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

export function saveCartToStorage(cart) {
    try {
        localStorage.setItem(getCartStorageKey(), JSON.stringify(cart));
    } catch {
        /* quota / private mode */
    }
}

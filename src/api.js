// src/api.js
const BASE = "http://localhost:8000";

async function apiFetch(path, options = {}, token = null) {
    const headers = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    const res = await fetch(`${BASE}${path}`, { headers, ...options });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Request failed");
    return data;
}

// ── Auth ──────────────────────────────────────────────
export const registerUser = (body) =>
    apiFetch("/register", { method: "POST", body: JSON.stringify(body) });

export const loginUser = (body) =>
    apiFetch("/login", { method: "POST", body: JSON.stringify(body) });

export const getMe = (token) =>
    apiFetch("/me", {}, token);

// ── Forgot Password ───────────────────────────────────
export const verifyPhone = (body) =>
    apiFetch("/forgot/verify-phone", { method: "POST", body: JSON.stringify(body) });

export const resetPassword = (body) =>
    apiFetch("/forgot/reset-password", { method: "POST", body: JSON.stringify(body) });

// ── Orders ────────────────────────────────────────────
export const placeOrder = (body, token) =>
    apiFetch("/orders", { method: "POST", body: JSON.stringify(body) }, token);

export const fetchOrders = (token) =>
    apiFetch("/orders", {}, token);

export const updateOrderStatus = (orderId, status, token) =>
    apiFetch(`/orders/${orderId}/status`, {
        method: "PATCH", body: JSON.stringify({ status }),
    }, token);

// ── Stats ─────────────────────────────────────────────
export const fetchStats = (token) =>
    apiFetch("/stats", {}, token);

// ── AI Image ──────────────────────────────────────────
export const generatePizzaImage = async (pizzaData) => {
    try {
        const toppingNames = (pizzaData.toppings || []).map(t =>
            typeof t === "string" ? t : t.label
        );
        const res = await fetch(`${BASE}/generate`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                crust: pizzaData.crust || "",
                sauce: pizzaData.sauce || "",
                toppings: toppingNames,
            }),
        });
        return await res.json();
    } catch (err) {
        return { error: "Failed to connect to backend" };
    }
};
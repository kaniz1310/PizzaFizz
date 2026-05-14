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
export const registerUser = (body) => apiFetch("/register", { method: "POST", body: JSON.stringify(body) });
export const loginUser = (body) => apiFetch("/login", { method: "POST", body: JSON.stringify(body) });
export const getMe = (token) => apiFetch("/me", {}, token);

// ── Forgot password ───────────────────────────────────
export const verifyPhone = (body) => apiFetch("/forgot/verify-phone", { method: "POST", body: JSON.stringify(body) });
export const resetPassword = (body) => apiFetch("/forgot/reset-password", { method: "POST", body: JSON.stringify(body) });

// ── Orders ────────────────────────────────────────────
export const placeOrder = (body, token) => apiFetch("/orders", { method: "POST", body: JSON.stringify(body) }, token);
export const placeCodOrder = (body, token) => apiFetch("/orders/cod", { method: "POST", body: JSON.stringify(body) }, token);
export const initiatePayment = (body, token) => apiFetch("/payment/initiate", { method: "POST", body: JSON.stringify(body) }, token);
export const fetchOrders = (token) => apiFetch("/orders", {}, token);
export const updateOrderStatus = (id, status, token) => apiFetch(`/orders/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }, token);

// ── Reviews ───────────────────────────────────────────
export const submitReview = (body, token) => apiFetch("/reviews", { method: "POST", body: JSON.stringify(body) }, token);
export const fetchReviews = (token) => apiFetch("/reviews", {}, token);
export const fetchMyReviews = (token) => apiFetch("/reviews/my", {}, token);

// ── Loyalty Points ────────────────────────────────────
export const fetchLoyalty = (token) => apiFetch("/loyalty", {}, token);
export const validatePoints = (points, token) => apiFetch(`/loyalty/validate?points=${points}`, {}, token);

// ── Analytics ─────────────────────────────────────────
export const fetchAnalytics = (token) => apiFetch("/analytics", {}, token);

// ── Stats ─────────────────────────────────────────────
export const fetchStats = (token) => apiFetch("/stats", {}, token);

// ── Riders ────────────────────────────────────────────
export const fetchRiders = (token) => apiFetch("/riders", {}, token);
export const assignRider = (orderId, riderId, t) => apiFetch(`/orders/${orderId}/assign-rider`, { method: "POST", body: JSON.stringify({ order_id: orderId, rider_id: riderId }) }, t);
export const fetchRiderOrders = (token) => apiFetch("/rider/orders", {}, token);
export const completeDelivery = (orderId, token) => apiFetch(`/rider/complete/${orderId}`, { method: "POST" }, token);
export const updateRiderLocation = (lat, lng, token) => apiFetch("/rider/location", { method: "PATCH", body: JSON.stringify({ lat, lng }) }, token);
export const setAvailability = (is_available, token) => apiFetch("/rider/availability", { method: "PATCH", body: JSON.stringify({ is_available }) }, token);
export const fetchRiderEarnings = (token) => apiFetch("/rider/earnings", {}, token);
export const trackOrder = (orderId, token) => apiFetch(`/delivery/track/${orderId}`, {}, token);

// ── AI Image ──────────────────────────────────────────
export const generatePizzaImage = async (pizzaData) => {
    try {
        const res = await fetch(`${BASE}/generate`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                crust: pizzaData.crust || "",
                sauce: pizzaData.sauce || "",
                toppings: (pizzaData.toppings || []).map(t => typeof t === "string" ? t : t.label),
            }),
        });
        return await res.json();
    } catch {
        return { error: "Failed to connect" };
    }
};

// ── Push Notifications (Browser API) ─────────────────
export async function requestNotificationPermission() {
    if (!("Notification" in window)) return false;
    if (Notification.permission === "granted") return true;
    const perm = await Notification.requestPermission();
    return perm === "granted";
}

export function sendPushNotification(title, body, icon = "🍕") {
    if (Notification.permission !== "granted") return;
    new Notification(title, {
        body,
        icon: "/vite.svg",
        badge: "/vite.svg",
        tag: "pizzafizz",
    });
} 

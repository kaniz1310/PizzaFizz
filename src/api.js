// src/api.js
const BASE = "http://localhost:8000";

async function apiFetch(path, options = {}, token = null) {
    try {
        const headers = {
            "Content-Type": "application/json",
        };

        if (token) {
            headers["Authorization"] = `Bearer ${token}`;
        }

        const response = await fetch(`${BASE}${path}`, {
            ...options,
            headers,
        });

        let data = {};

        try {
            data = await response.json();
        } catch {
            data = {};
        }

        if (!response.ok) {
            throw new Error(
                data.detail ||
                data.message ||
                `Request failed with status ${response.status}`
            );
        }

        return data;
    } catch (error) {
        console.error("API ERROR:", error);
        throw error;
    }
}

// ── Auth ──────────────────────────────────────────────
export const registerUser = (body) =>
    apiFetch("/register", {
        method: "POST",
        body: JSON.stringify(body),
    });

export const loginUser = (body) =>
    apiFetch("/login", {
        method: "POST",
        body: JSON.stringify(body),
    });

export const getMe = (token) =>
    apiFetch("/me", {}, token);

// ── Forgot password ───────────────────────────────────
export const verifyPhone = (body) =>
    apiFetch("/forgot/verify-phone", {
        method: "POST",
        body: JSON.stringify(body),
    });

export const resetPassword = (body) =>
    apiFetch("/forgot/reset-password", {
        method: "POST",
        body: JSON.stringify(body),
    });

// ── Orders ────────────────────────────────────────────
export const placeOrder = (body, token) =>
    apiFetch(
        "/orders",
        {
            method: "POST",
            body: JSON.stringify(body),
        },
        token
    );

export const initiatePayment = (body, token) =>
    apiFetch(
        "/payment/initiate",
        {
            method: "POST",
            body: JSON.stringify(body),
        },
        token
    );

export const fetchOrders = (token) =>
    apiFetch("/orders", {}, token);

export const updateOrderStatus = (id, status, token) =>
    apiFetch(
        `/orders/${id}/status`,
        {
            method: "PATCH",
            body: JSON.stringify({ status }),
        },
        token
    );

// ── Reviews ───────────────────────────────────────────
export const submitReview = (body, token) =>
    apiFetch(
        "/reviews",
        {
            method: "POST",
            body: JSON.stringify(body),
        },
        token
    );

export const fetchReviews = (token) =>
    apiFetch("/reviews", {}, token);

export const fetchMyReviews = (token) =>
    apiFetch("/reviews/my", {}, token);

// ── Loyalty Points ────────────────────────────────────
export const fetchLoyalty = (token) =>
    apiFetch("/loyalty", {}, token);

export const validatePoints = (points, token) =>
    apiFetch(`/loyalty/validate?points=${points}`, {}, token);

// ── Analytics ─────────────────────────────────────────
export const fetchAnalytics = (token) =>
    apiFetch("/analytics", {}, token);

// ── Stats ─────────────────────────────────────────────
export const fetchStats = (token) =>
    apiFetch("/stats", {}, token);

// ── Riders ────────────────────────────────────────────
export const fetchRiders = (token) =>
    apiFetch("/riders", {}, token);

export const assignRider = (orderId, riderId, token) =>
    apiFetch(
        `/orders/${orderId}/assign-rider`,
        {
            method: "POST",
            body: JSON.stringify({
                order_id: orderId,
                rider_id: riderId,
            }),
        },
        token
    );

export const fetchRiderOrders = (token) =>
    apiFetch("/rider/orders", {}, token);

export const completeDelivery = (orderId, token) =>
    apiFetch(
        `/rider/complete/${orderId}`,
        {
            method: "POST",
        },
        token
    );

export const updateRiderLocation = (lat, lng, token) =>
    apiFetch(
        "/rider/location",
        {
            method: "PATCH",
            body: JSON.stringify({ lat, lng }),
        },
        token
    );

export const setAvailability = (is_available, token) =>
    apiFetch(
        "/rider/availability",
        {
            method: "PATCH",
            body: JSON.stringify({ is_available }),
        },
        token
    );

export const fetchRiderEarnings = (token) =>
    apiFetch("/rider/earnings", {}, token);

export const riderWithdraw = (body, token) =>
    apiFetch(
        "/rider/withdraw",
        {
            method: "POST",
            body: JSON.stringify(body),
        },
        token
    );

export const fetchOwnerFinancials = (token) =>
    apiFetch("/owner/financials", {}, token);

export const addOwnerInvestment = (body, token) =>
    apiFetch(
        "/owner/investments",
        {
            method: "POST",
            body: JSON.stringify(body),
        },
        token
    );

export const fetchOwnerInvestments = (token) =>
    apiFetch("/owner/investments", {}, token);

/** Downloads CSV; uses raw fetch because response is not JSON. */
export async function downloadOwnerReportCsv(token) {
    const response = await fetch(`${BASE}/owner/report?fmt=csv`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
        let detail = `Request failed (${response.status})`;
        try {
            const err = await response.json();
            detail = err.detail || err.message || detail;
        } catch { /* ignore */ }
        throw new Error(detail);
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "pizzafizz-owner-report.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}

export const trackOrder = (orderId, token) =>
    apiFetch(`/delivery/track/${orderId}`, {}, token);

// ── Menu (dynamic) ────────────────────────────────────
export const fetchPublicMenu = () => apiFetch("/menu");

export const fetchAdminMenu = (token) =>
    apiFetch("/menu/admin", {}, token);

export const createMenuItem = (body, token) =>
    apiFetch("/menu", { method: "POST", body: JSON.stringify(body) }, token);

export const updateMenuItem = (id, body, token) =>
    apiFetch(`/menu/${id}`, { method: "PATCH", body: JSON.stringify(body) }, token);

export const deleteMenuItem = (id, token) =>
    apiFetch(`/menu/${id}`, { method: "DELETE" }, token);

// ── AI Image ──────────────────────────────────────────
export const generatePizzaImage = async (pizzaData) => {
    try {
        const toppings = [
            ...(pizzaData.toppings || []).map((t) =>
                typeof t === "string" ? t : t.label
            ),
            ...(pizzaData.cheeses || []).map((c) =>
                typeof c === "string" ? c : `${c.label} cheese`
            ),
            ...(pizzaData.addIns || []).map((a) =>
                typeof a === "string" ? a : a.label
            ),
        ].filter(Boolean);

        const response = await fetch(`${BASE}/generate`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                crust: pizzaData.crust || "classic",
                sauce: pizzaData.sauce || "tomato",
                toppings,
            }),
        });

        let data = {};
        try {
            const text = await response.text();
            if (text) data = JSON.parse(text);
        } catch {
            data = {};
        }
        if (!response.ok) {
            return {
                error: data.detail || data.message || `Generation failed (${response.status})`,
            };
        }
        if (data.image) {
            return {
                imageUrl: data.image.startsWith("data:")
                    ? data.image
                    : `data:image/jpeg;base64,${data.image}`,
            };
        }
        return { error: "No image returned" };
    } catch (error) {
        console.error("Generate image error:", error);
        const local = buildLocalPizzaPreview(pizzaData);
        if (local) return { imageUrl: local, offline: true };
        return { error: "Could not reach the kitchen AI — start the backend on port 8000." };
    }
};

/** Client-side SVG preview when backend is offline */
function buildLocalPizzaPreview(pizzaData) {
    const toppings = [
        ...(pizzaData.toppings || []).map((t) =>
            typeof t === "string" ? t : t.label
        ),
        ...(pizzaData.cheeses || []).map((c) =>
            typeof c === "string" ? c : `${c.label}`
        ),
    ].filter(Boolean).slice(0, 8);
    const sauce = (pizzaData.sauce || "tomato").toLowerCase();
    const sauceColor = sauce.includes("bbq") ? "#6b3a2a"
        : sauce.includes("pesto") ? "#4a7c59"
            : sauce.includes("white") || sauce.includes("garlic") ? "#f5f0e8"
                : "#c0392b";
    const colors = ["#c0392b", "#e67e22", "#27ae60", "#2980b9", "#8e44ad"];
    const pos = [[150, 130], [200, 100], [250, 120], [170, 170], [230, 160], [190, 200]];
    let dots = toppings.map((_, i) => {
        const [x, y] = pos[i % pos.length];
        return `<circle cx="${x}" cy="${y}" r="12" fill="${colors[i % colors.length]}" stroke="#fff" stroke-width="2"/>`;
    }).join("");
    if (!dots) dots = '<circle cx="200" cy="200" r="10" fill="#e63329"/>';
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">
<circle cx="200" cy="200" r="185" fill="#d4a04a" stroke="#8b5e2a" stroke-width="3"/>
<circle cx="200" cy="200" r="158" fill="${sauceColor}"/>
<circle cx="200" cy="200" r="140" fill="#e8c84a" opacity="0.9"/>
${dots}
</svg>`;
    return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;
}

// ── Push Notifications ────────────────────────────────
export async function requestNotificationPermission() {
    if (!("Notification" in window)) return false;

    if (Notification.permission === "granted") {
        return true;
    }

    const permission = await Notification.requestPermission();

    return permission === "granted";
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
import { useState, useEffect, useCallback } from "react";
import { fetchPublicMenu } from "../api";

const WS_URL = "ws://127.0.0.1:8000/ws";

export default function useLiveMenu() {
    const [pizzaMenu, setPizzaMenu] = useState([]);
    const [fastFoodMenu, setFastFoodMenu] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [updatedAt, setUpdatedAt] = useState(null);

    const reloadMenu = useCallback(async () => {
        setLoading(true);
        try {
            const data = await fetchPublicMenu();
            setPizzaMenu(data.pizzas || []);
            setFastFoodMenu(data.fastfood || []);
            setUpdatedAt(data.updated_at || null);
            setError(null);
        } catch (err) {
            setError(err.message || "Could not load menu");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        reloadMenu();
    }, [reloadMenu]);

    useEffect(() => {
        let ws;
        let timer;
        function connect() {
            ws = new WebSocket(WS_URL);
            ws.onmessage = (e) => {
                try {
                    const msg = JSON.parse(e.data);
                    if (msg.type === "MENU_UPDATE") reloadMenu();
                } catch { /* ignore */ }
            };
            ws.onclose = () => {
                timer = setTimeout(connect, 4000);
            };
        }
        connect();
        return () => {
            clearTimeout(timer);
            if (ws) ws.close();
        };
    }, [reloadMenu]);

    return { pizzaMenu, fastFoodMenu, loading, error, updatedAt, reloadMenu };
}

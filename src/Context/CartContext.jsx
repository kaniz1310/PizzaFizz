// src/Context/CartContext.jsx — persisted cart + merge duplicate lines
import { createContext, useState, useContext, useEffect, useCallback } from "react";
import {
    cartItemKey,
    loadCartFromStorage,
    saveCartToStorage,
    getCartStorageKey,
} from "../utils/cartUtils";

const CartContext = createContext();

export const CartProvider = ({ children }) => {
    const [cart, setCart] = useState(() => loadCartFromStorage());
    const [cartHydrated, setCartHydrated] = useState(false);

    // Persist whenever cart changes
    useEffect(() => {
        if (!cartHydrated) {
            setCartHydrated(true);
            return;
        }
        saveCartToStorage(cart);
    }, [cart, cartHydrated]);

    // Reload cart when user logs in/out (different storage key)
    useEffect(() => {
        const reload = () => setCart(loadCartFromStorage());
        const onStorage = (e) => {
            if (e.key === getCartStorageKey()) reload();
        };
        window.addEventListener("storage", onStorage);
        window.addEventListener("pizzafizz-auth", reload);
        return () => {
            window.removeEventListener("storage", onStorage);
            window.removeEventListener("pizzafizz-auth", reload);
        };
    }, []);

    const reloadCart = useCallback(() => {
        setCart(loadCartFromStorage());
    }, []);

    const addToCart = useCallback((item) => {
        const incoming = { ...item, qty: item.qty || 1 };
        delete incoming.id;

        const key = cartItemKey(incoming);
        let merged = false;

        setCart((prev) => {
            const idx = prev.findIndex((line) => cartItemKey(line) === key);
            if (idx >= 0) {
                merged = true;
                const next = [...prev];
                next[idx] = {
                    ...next[idx],
                    qty: (next[idx].qty || 1) + (incoming.qty || 1),
                };
                return next;
            }
            return [
                ...prev,
                { ...incoming, id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}` },
            ];
        });

        return merged;
    }, []);

    const addManyToCart = useCallback(
        (items) => {
            items.forEach((item) => addToCart(item));
        },
        [addToCart]
    );

    const updateQty = useCallback((id, newQty) => {
        if (newQty <= 0) {
            setCart((prev) => prev.filter((item) => item.id !== id));
        } else {
            setCart((prev) =>
                prev.map((item) => (item.id === id ? { ...item, qty: newQty } : item))
            );
        }
    }, []);

    const removeFromCart = useCallback((id) => {
        setCart((prev) => prev.filter((item) => item.id !== id));
    }, []);

    const clearCart = useCallback(() => {
        setCart([]);
        saveCartToStorage([]);
    }, []);

    const cartCount = cart.reduce((sum, item) => sum + (item.qty || 1), 0);

    const cartTotal = cart.reduce((sum, item) => {
        return sum + (parseFloat(item.price) || 0) * (item.qty || 1);
    }, 0);

    return (
        <CartContext.Provider
            value={{
                cart,
                addToCart,
                addManyToCart,
                updateQty,
                removeFromCart,
                clearCart,
                reloadCart,
                cartCount,
                cartTotal,
            }}
        >
            {children}
        </CartContext.Provider>
    );
};

export const useCart = () => useContext(CartContext);

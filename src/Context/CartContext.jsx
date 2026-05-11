// src/Context/CartContext.jsx
import { createContext, useState, useContext } from "react";

const CartContext = createContext();

export const CartProvider = ({ children }) => {
    const [cart, setCart] = useState([]);

    // Add a pizza to cart
    const addToCart = (item) => {
        setCart(prev => [...prev, { ...item, id: Date.now(), qty: 1 }]);
    };

    // Update quantity — removes item if qty drops to 0
    const updateQty = (id, newQty) => {
        if (newQty <= 0) {
            removeFromCart(id);
        } else {
            setCart(prev =>
                prev.map(item => item.id === id ? { ...item, qty: newQty } : item)
            );
        }
    };

    // Remove one item from cart
    const removeFromCart = (id) => {
        setCart(prev => prev.filter(item => item.id !== id));
    };

    // Empty the whole cart (called after order is placed)
    const clearCart = () => {
        setCart([]);
    };

    // Total number of pizzas in cart
    const cartCount = cart.reduce((sum, item) => sum + (item.qty || 1), 0);

    // Total price of all items
    const cartTotal = cart.reduce((sum, item) => {
        return sum + (parseFloat(item.price) || 0) * (item.qty || 1);
    }, 0);

    return (
        <CartContext.Provider value={{
            cart,
            addToCart,
            updateQty,
            removeFromCart,
            clearCart,
            cartCount,
            cartTotal,
        }}>
            {children}
        </CartContext.Provider>
    );
};

export const useCart = () => {
    return useContext(CartContext);
};
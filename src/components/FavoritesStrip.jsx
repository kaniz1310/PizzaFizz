// Quick-access saved pizzas — customize page & navbar area
import { useState, useEffect } from "react";
import { getFavorites, removeFavorite, favoriteSummary } from "../utils/favorites";

export default function FavoritesStrip({ onLoad, onReorder, compact = false }) {
    const [favorites, setFavorites] = useState([]);
    const user = JSON.parse(localStorage.getItem("user") || "null");

    useEffect(() => {
        setFavorites(getFavorites());
    }, [user?.id]);

    if (!user || favorites.length === 0) return null;

    return (
        <div style={{
            ...s.wrap,
            padding: compact ? "12px 14px" : "16px 18px",
            marginBottom: compact ? 16 : 24,
        }}>
            <div style={s.head}>
                <span style={s.title}>⭐ Your Favorites</span>
                <span style={s.count}>{favorites.length} saved</span>
            </div>
            <div style={s.scroll}>
                {favorites.map((fav) => (
                    <div key={fav.id} style={s.chip}>
                        <div style={s.chipBody}>
                            <strong style={s.chipName}>{fav.name}</strong>
                            <span style={s.chipSub}>{favoriteSummary(fav)}</span>
                            <span style={s.chipPrice}>৳{fav.item.price}</span>
                        </div>
                        <div style={s.chipActions}>
                            {onLoad && (
                                <button type="button" onClick={() => onLoad(fav)} style={s.loadBtn} title="Edit in builder">
                                    ✏️
                                </button>
                            )}
                            {onReorder && (
                                <button type="button" onClick={() => onReorder(fav)} style={s.cartBtn} title="Add to cart">
                                    🛒
                                </button>
                            )}
                            <button
                                type="button"
                                onClick={() => {
                                    removeFavorite(fav.id);
                                    setFavorites(getFavorites());
                                }}
                                style={s.delBtn}
                                title="Remove"
                            >
                                ✕
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

const s = {
    wrap: {
        background: "linear-gradient(135deg, #fffbeb, #fff8f0)",
        border: "2px solid #fde68a",
        borderRadius: 20,
    },
    head: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 10,
    },
    title: {
        fontFamily: "'Boogaloo', cursive",
        fontSize: "1.15rem",
        color: "#7c2d12",
    },
    count: { fontSize: ".75rem", color: "#aaa", fontWeight: 700 },
    scroll: {
        display: "flex",
        gap: 10,
        overflowX: "auto",
        paddingBottom: 4,
    },
    chip: {
        flex: "0 0 auto",
        minWidth: 200,
        maxWidth: 260,
        background: "#fff",
        borderRadius: 14,
        padding: "10px 12px",
        display: "flex",
        gap: 8,
        alignItems: "center",
        boxShadow: "0 2px 8px rgba(0,0,0,.06)",
    },
    chipBody: { flex: 1, minWidth: 0 },
    chipName: {
        display: "block",
        fontSize: ".85rem",
        color: "#1c0a00",
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
    },
    chipSub: {
        display: "block",
        fontSize: ".68rem",
        color: "#888",
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
    },
    chipPrice: { fontSize: ".75rem", fontWeight: 800, color: "#e63329" },
    chipActions: { display: "flex", flexDirection: "column", gap: 4 },
    loadBtn: {
        border: "none", background: "#fff8f0", borderRadius: 8,
        padding: "4px 8px", cursor: "pointer", fontSize: ".9rem",
    },
    cartBtn: {
        border: "none", background: "#16a34a", color: "#fff",
        borderRadius: 8, padding: "4px 8px", cursor: "pointer", fontSize: ".9rem",
    },
    delBtn: {
        border: "none", background: "transparent", color: "#ccc",
        cursor: "pointer", fontSize: ".75rem", padding: 0,
    },
};

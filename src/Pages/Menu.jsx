// src/Pages/Menu.jsx
// Full Menu page — Bootstrap 5 + custom CSS + JS interactions
// Route: /menu

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCart } from "../Context/CartContext";

// ── Pizza Menu Data ─────────────────────────────────────
const PIZZA_MENU = [
    {
        category: "🔥 Bestsellers",
        items: [
            {
                id: 1,
                name: "Pepperoni Fiesta",
                desc: "Classic tomato sauce, double pepperoni, mozzarella, oregano",
                price: 499,
                badge: "🏆 #1",
                badgeColor: "#f59e0b",
                image: "https://images.unsplash.com/photo-1628840042765-356cda07504e?w=400&q=80",
                size: "Large", crust: "Classic", sauce: "Tomato",
                toppings: [{ label: "Pepperoni", icon: "🍖", price: 50 }],
            },
            {
                id: 2,
                name: "BBQ Chicken Blast",
                desc: "Smoky BBQ sauce, grilled chicken, red onions, bell pepper",
                price: 549,
                badge: "🔥 Hot",
                badgeColor: "#e63329",
                image: "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=400&q=80",
                size: "Large", crust: "Stuffed", sauce: "BBQ",
                toppings: [
                    { label: "Chicken", icon: "🍗", price: 70 },
                    { label: "Onions", icon: "🧅", price: 20 },
                    { label: "Bell Pepper", icon: "🫑", price: 25 },
                ],
            },
            {
                id: 3,
                name: "Veggie Supreme",
                desc: "Pesto sauce, mushrooms, olives, corn, bell pepper, paneer",
                price: 429,
                badge: "🌿 Veg",
                badgeColor: "#16a34a",
                image: "https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=400&q=80",
                size: "Large", crust: "Thin", sauce: "Pesto",
                toppings: [
                    { label: "Mushrooms", icon: "🍄", price: 30 },
                    { label: "Olives", icon: "🫒", price: 25 },
                    { label: "Corn", icon: "🌽", price: 20 },
                    { label: "Paneer", icon: "🧊", price: 60 },
                ],
            },
            {
                id: 10,
                name: "Hawaiian Luau",
                desc: "Tomato sauce, ham, pineapple, mozzarella, sweet chilli drizzle",
                price: 479,
                badge: "🍍 Sweet",
                badgeColor: "#f97316",
                image: "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=400&q=80",
                size: "Large", crust: "Classic", sauce: "Tomato",
                toppings: [
                    { label: "Ham", icon: "🥓", price: 60 },
                    { label: "Pineapple", icon: "🍍", price: 30 },
                ],
            },
        ],
    },
    {
        category: "🧀 Cheese Lovers",
        items: [
            {
                id: 4,
                name: "Four Cheese Dream",
                desc: "White sauce, mozzarella, cheddar, parmesan, gouda, fresh basil",
                price: 579,
                badge: "🧀 New",
                badgeColor: "#f97316",
                image: "https://images.unsplash.com/photo-1571407970349-bc81e7e96d47?w=400&q=80",
                size: "Large", crust: "Stuffed", sauce: "White",
                toppings: [],
            },
            {
                id: 5,
                name: "Stuffed Crust Margherita",
                desc: "Fresh tomato sauce, buffalo mozzarella, fresh basil, EVOO",
                price: 449,
                badge: "❤️ Classic",
                badgeColor: "#e63329",
                image: "https://images.unsplash.com/photo-1604382354936-07c5d9983bd3?w=400&q=80",
                size: "Large", crust: "Stuffed", sauce: "Tomato",
                toppings: [],
            },
            {
                id: 11,
                name: "Cheddar Bacon Melt",
                desc: "White sauce, triple cheddar, crispy bacon bits, caramelized onions",
                price: 599,
                badge: "🧀 Rich",
                badgeColor: "#f59e0b",
                image: "https://images.unsplash.com/photo-1566843978265-3d9988c1a49c?w=400&q=80",
                size: "Large", crust: "Stuffed", sauce: "White",
                toppings: [
                    { label: "Bacon", icon: "🥓", price: 80 },
                    { label: "Onions", icon: "🧅", price: 20 },
                ],
            },
        ],
    },
    {
        category: "🌶️ Spicy Specials",
        items: [
            {
                id: 6,
                name: "Jalapeño Inferno",
                desc: "BBQ sauce, pepperoni, jalapeños, bacon, red chilli flakes",
                price: 569,
                badge: "🌶️ Extra Hot",
                badgeColor: "#dc2626",
                image: "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=400&q=80",
                size: "Large", crust: "Classic", sauce: "BBQ",
                toppings: [
                    { label: "Pepperoni", icon: "🍖", price: 50 },
                    { label: "Jalapeños", icon: "🌶️", price: 30 },
                    { label: "Bacon", icon: "🥓", price: 80 },
                ],
            },
            {
                id: 7,
                name: "Spicy Chicken Ranch",
                desc: "White sauce, spicy chicken, jalapeños, onions, corn",
                price: 529,
                badge: "🔥 Spicy",
                badgeColor: "#e63329",
                image: "https://images.unsplash.com/photo-1588315029754-2dd089d39a1a?w=400&q=80",
                size: "Large", crust: "Whole Wheat", sauce: "White",
                toppings: [
                    { label: "Chicken", icon: "🍗", price: 70 },
                    { label: "Jalapeños", icon: "🌶️", price: 30 },
                    { label: "Onions", icon: "🧅", price: 20 },
                ],
            },
            {
                id: 12,
                name: "Buffalo Ranch Chicken",
                desc: "Buffalo sauce, crispy chicken, ranch drizzle, celery, blue cheese crumbles",
                price: 559,
                badge: "🌶️ Fiery",
                badgeColor: "#dc2626",
                image: "https://images.unsplash.com/photo-1593560708920-61dd98c46a4e?w=400&q=80",
                size: "Large", crust: "Classic", sauce: "Buffalo",
                toppings: [
                    { label: "Chicken", icon: "🍗", price: 70 },
                    { label: "Ranch", icon: "🥛", price: 25 },
                ],
            },
            {
                id: 13,
                name: "Peri-Peri Paneer",
                desc: "Peri-peri sauce, spiced paneer, capsicum, onions, coriander",
                price: 489,
                badge: "🌶️ Medium",
                badgeColor: "#ea580c",
                image: "https://images.unsplash.com/photo-1555072956-7758afb20e8f?w=400&q=80",
                size: "Medium", crust: "Thin", sauce: "Peri-Peri",
                toppings: [
                    { label: "Paneer", icon: "🧊", price: 60 },
                    { label: "Capsicum", icon: "🫑", price: 25 },
                ],
            },
        ],
    },
    {
        category: "🍖 Meat Lovers",
        items: [
            {
                id: 14,
                name: "Meat Lovers Feast",
                desc: "Tomato sauce, pepperoni, sausage, ham, bacon, ground beef, mozzarella",
                price: 649,
                badge: "🍖 Loaded",
                badgeColor: "#b91c1c",
                image: "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=400&q=80",
                size: "Large", crust: "Classic", sauce: "Tomato",
                toppings: [
                    { label: "Pepperoni", icon: "🍖", price: 50 },
                    { label: "Sausage", icon: "🌭", price: 55 },
                    { label: "Bacon", icon: "🥓", price: 80 },
                ],
            },
            {
                id: 15,
                name: "Bacon Cheeseburger Pizza",
                desc: "Special burger sauce, beef crumble, bacon, cheddar, pickles, onions",
                price: 619,
                badge: "🍔 Fusion",
                badgeColor: "#f59e0b",
                image: "https://images.unsplash.com/photo-1628840042765-356cda07504e?w=400&q=80",
                size: "Large", crust: "Thick", sauce: "Burger",
                toppings: [
                    { label: "Beef", icon: "🥩", price: 90 },
                    { label: "Pickles", icon: "🥒", price: 15 },
                ],
            },
            {
                id: 16,
                name: "Smoky Sausage Supreme",
                desc: "BBQ sauce, Italian sausage, caramelized onions, smoked gouda",
                price: 589,
                badge: "🔥 Smoky",
                badgeColor: "#7c2d12",
                image: "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=400&q=80",
                size: "Large", crust: "Stuffed", sauce: "BBQ",
                toppings: [
                    { label: "Sausage", icon: "🌭", price: 55 },
                    { label: "Onions", icon: "🧅", price: 20 },
                ],
            },
        ],
    },
    {
        category: "⭐ Chef's Special",
        items: [
            {
                id: 17,
                name: "Truffle Portobello",
                desc: "Truffle cream, portobello mushrooms, arugula, parmesan shavings",
                price: 699,
                badge: "⭐ Premium",
                badgeColor: "#7c3aed",
                image: "https://images.unsplash.com/photo-1571407970349-bc81e7e96d47?w=400&q=80",
                size: "Large", crust: "Thin", sauce: "Truffle",
                toppings: [{ label: "Mushrooms", icon: "🍄", price: 30 }],
            },
            {
                id: 18,
                name: "Mediterranean Feta",
                desc: "Tomato base, feta, olives, sun-dried tomatoes, artichoke, oregano",
                price: 549,
                badge: "🫒 Gourmet",
                badgeColor: "#0891b2",
                image: "https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=400&q=80",
                size: "Large", crust: "Thin", sauce: "Tomato",
                toppings: [
                    { label: "Feta", icon: "🧀", price: 45 },
                    { label: "Olives", icon: "🫒", price: 25 },
                ],
            },
            {
                id: 19,
                name: "Seafood Marinara",
                desc: "Garlic butter base, prawns, calamari, cherry tomatoes, parsley",
                price: 749,
                badge: "🦐 Seafood",
                badgeColor: "#0284c7",
                image: "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=400&q=80",
                size: "Large", crust: "Classic", sauce: "Marinara",
                toppings: [
                    { label: "Prawns", icon: "🦐", price: 120 },
                    { label: "Calamari", icon: "🦑", price: 90 },
                ],
            },
        ],
    },
    {
        category: "🌾 Healthy Choice",
        items: [
            {
                id: 8,
                name: "Garden Pesto Delight",
                desc: "Pesto sauce, whole wheat crust, mushrooms, olives, bell pepper",
                price: 399,
                badge: "💚 Healthy",
                badgeColor: "#16a34a",
                image: "https://images.unsplash.com/photo-1555072956-7758afb20e8f?w=400&q=80",
                size: "Medium", crust: "Whole Wheat", sauce: "Pesto",
                toppings: [
                    { label: "Mushrooms", icon: "🍄", price: 30 },
                    { label: "Olives", icon: "🫒", price: 25 },
                    { label: "Bell Pepper", icon: "🫑", price: 25 },
                ],
            },
            {
                id: 9,
                name: "Thin Crust Paneer",
                desc: "Tomato sauce, thin crust, paneer, onions, bell pepper, corn",
                price: 429,
                badge: "🌿 Veg",
                badgeColor: "#16a34a",
                image: "https://images.unsplash.com/photo-1593560708920-61dd98c46a4e?w=400&q=80",
                size: "Medium", crust: "Thin", sauce: "Tomato",
                toppings: [
                    { label: "Paneer", icon: "🧊", price: 60 },
                    { label: "Onions", icon: "🧅", price: 20 },
                    { label: "Corn", icon: "🌽", price: 20 },
                ],
            },
            {
                id: 20,
                name: "Spinach & Ricotta Light",
                desc: "Whole wheat crust, spinach, ricotta, cherry tomatoes, light mozzarella",
                price: 419,
                badge: "💚 Light",
                badgeColor: "#16a34a",
                image: "https://images.unsplash.com/photo-1604382354936-07c5d9983bd3?w=400&q=80",
                size: "Medium", crust: "Whole Wheat", sauce: "Tomato",
                toppings: [
                    { label: "Spinach", icon: "🥬", price: 25 },
                    { label: "Ricotta", icon: "🧀", price: 40 },
                ],
            },
        ],
    },
];

// ── Fast Food Menu Data ─────────────────────────────────
const FAST_FOOD_MENU = [
    {
        category: "🍔 Burgers & Wraps",
        items: [
            {
                id: 101,
                name: "Classic Cheeseburger",
                desc: "Juicy beef patty, cheddar, lettuce, tomato, pickles, special sauce",
                price: 249,
                badge: "🏆 Best",
                badgeColor: "#f59e0b",
                image: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400&q=80",
                tags: ["Beef", "Grilled"],
            },
            {
                id: 102,
                name: "Double Smash Burger",
                desc: "Two smashed patties, double cheese, caramelized onions, smoky mayo",
                price: 349,
                badge: "🔥 Popular",
                badgeColor: "#e63329",
                image: "https://images.unsplash.com/photo-1550547660-bb7461c5d0a0?w=400&q=80",
                tags: ["Beef", "Double Patty"],
            },
            {
                id: 103,
                name: "Crispy Chicken Zinger",
                desc: "Spicy fried chicken fillet, coleslaw, jalapeño mayo, brioche bun",
                price: 279,
                badge: "🌶️ Spicy",
                badgeColor: "#dc2626",
                image: "https://images.unsplash.com/photo-1606755962773-d324e0a13086?w=400&q=80",
                tags: ["Chicken", "Crispy"],
            },
            {
                id: 104,
                name: "Grilled Veggie Burger",
                desc: "Plant-based patty, avocado, lettuce, tomato, herb aioli",
                price: 229,
                badge: "🌿 Veg",
                badgeColor: "#16a34a",
                image: "https://images.unsplash.com/photo-1520072959219-cadbf9d2b4d7?w=400&q=80",
                tags: ["Veggie", "Grilled"],
            },
            {
                id: 105,
                name: "BBQ Chicken Wrap",
                desc: "Grilled chicken strips, BBQ sauce, lettuce, cheese, tortilla wrap",
                price: 219,
                badge: "🌯 Wrap",
                badgeColor: "#f97316",
                image: "https://images.unsplash.com/photo-1626700051175-6818013e1d4f?w=400&q=80",
                tags: ["Chicken", "To-Go"],
            },
        ],
    },
    {
        category: "🍟 Sides & Snacks",
        items: [
            {
                id: 106,
                name: "Golden French Fries",
                desc: "Crispy shoestring fries, lightly salted, served hot",
                price: 129,
                badge: "Classic",
                badgeColor: "#f59e0b",
                image: "https://images.unsplash.com/photo-1573080496219-b080a1b07336?w=400&q=80",
                tags: ["Veg", "Shareable"],
            },
            {
                id: 107,
                name: "Loaded Cheese Fries",
                desc: "Fries topped with cheddar sauce, bacon bits, spring onions",
                price: 199,
                badge: "🧀 Cheesy",
                badgeColor: "#f97316",
                image: "https://images.unsplash.com/photo-1630384060421-cb20d0e0649d?w=400&q=80",
                tags: ["Loaded", "Bacon"],
            },
            {
                id: 108,
                name: "Crispy Onion Rings",
                desc: "Beer-battered onion rings with chipotle ranch dip",
                price: 149,
                badge: "Crispy",
                badgeColor: "#ea580c",
                image: "https://images.unsplash.com/photo-1639024471283-03518883512d?w=400&q=80",
                tags: ["Veg", "Dip Included"],
            },
            {
                id: 109,
                name: "Nachos Supreme",
                desc: "Tortilla chips, melted cheese, salsa, jalapeños, sour cream, guacamole",
                price: 249,
                badge: "🧀 Loaded",
                badgeColor: "#f59e0b",
                image: "https://images.unsplash.com/photo-1513456852971-13cafff8f0a0?w=400&q=80",
                tags: ["Shareable", "Mexican"],
            },
            {
                id: 110,
                name: "Garlic Breadsticks",
                desc: "Warm breadsticks brushed with garlic butter, parmesan, marinara dip",
                price: 169,
                badge: "🧄 Garlic",
                badgeColor: "#7c2d12",
                image: "https://images.unsplash.com/photo-1619535860431-ba1d8fa12536?w=400&q=80",
                tags: ["Veg", "6 Pieces"],
            },
        ],
    },
    {
        category: "🍗 Chicken & Wings",
        items: [
            {
                id: 111,
                name: "Hot Buffalo Wings (6pc)",
                desc: "Crispy wings tossed in buffalo sauce, celery sticks, blue cheese dip",
                price: 299,
                badge: "🌶️ Hot",
                badgeColor: "#dc2626",
                image: "https://images.unsplash.com/photo-1608039829572-78524f79c4c7?w=400&q=80",
                tags: ["6 Pieces", "Spicy"],
            },
            {
                id: 112,
                name: "Honey BBQ Wings (6pc)",
                desc: "Glazed wings in sweet honey BBQ sauce, sesame seeds",
                price: 299,
                badge: "🍯 Sweet",
                badgeColor: "#f59e0b",
                image: "https://images.unsplash.com/photo-1567620832904-9fe5cf7bcfe6?w=400&q=80",
                tags: ["6 Pieces", "Glazed"],
            },
            {
                id: 113,
                name: "Popcorn Chicken Bucket",
                desc: "Bite-sized crispy chicken bites with honey mustard & BBQ dips",
                price: 259,
                badge: "🍗 Crispy",
                badgeColor: "#e63329",
                image: "https://images.unsplash.com/photo-1626082927389-6d0973466df6?w=400&q=80",
                tags: ["Shareable", "2 Dips"],
            },
            {
                id: 114,
                name: "Chicken Tenders (4pc)",
                desc: "Hand-breaded tenders, golden fried, choice of ranch or honey mustard",
                price: 279,
                badge: "Kids Fav",
                badgeColor: "#0891b2",
                image: "https://images.unsplash.com/photo-1562967914-608f82629710?w=400&q=80",
                tags: ["4 Pieces", "Tender"],
            },
        ],
    },
    {
        category: "🥤 Drinks & Desserts",
        items: [
            {
                id: 115,
                name: "Chocolate Fudge Brownie",
                desc: "Warm gooey brownie with chocolate chips, vanilla ice cream scoop",
                price: 179,
                badge: "🍫 Sweet",
                badgeColor: "#7c2d12",
                image: "https://images.unsplash.com/photo-1607920591416-4a7a3d65a3b8?w=400&q=80",
                tags: ["Dessert", "Warm"],
            },
            {
                id: 116,
                name: "New York Cheesecake",
                desc: "Creamy baked cheesecake slice with berry compote drizzle",
                price: 199,
                badge: "🍰 Classic",
                badgeColor: "#f97316",
                image: "https://images.unsplash.com/photo-1524351199678-941a58a3df50?w=400&q=80",
                tags: ["Dessert", "Chilled"],
            },
            {
                id: 117,
                name: "Oreo Milkshake",
                desc: "Thick vanilla shake blended with Oreo cookies, whipped cream",
                price: 169,
                badge: "🥤 Shake",
                badgeColor: "#1c0a00",
                image: "https://images.unsplash.com/photo-1572490122747-3968b75cc699?w=400&q=80",
                tags: ["Cold", "400ml"],
            },
            {
                id: 118,
                name: "Fresh Lemonade",
                desc: "House-made lemonade with fresh lemons, mint, crushed ice",
                price: 99,
                badge: "🍋 Fresh",
                badgeColor: "#16a34a",
                image: "https://images.unsplash.com/photo-1621263764928-df1444c5e859?w=400&q=80",
                tags: ["Cold", "Refreshing"],
            },
            {
                id: 119,
                name: "Soft Drink (500ml)",
                desc: "Chilled cola, lemon-lime, or orange — pick your favourite fizz",
                price: 79,
                badge: "🥤 Cold",
                badgeColor: "#0284c7",
                image: "https://images.unsplash.com/photo-1622483767028-3ff66e34bb44?w=400&q=80",
                tags: ["500ml", "Chilled"],
            },
        ],
    },
];

const PIZZA_CATEGORIES = ["All", ...PIZZA_MENU.map(c => c.category)];
const FAST_FOOD_CATEGORIES = ["All", ...FAST_FOOD_MENU.map(c => c.category)];
const MENU_SECTIONS = [
    { id: "pizzas", label: "🍕 Pizzas", icon: "🍕" },
    { id: "fastfood", label: "🍔 Fast Food", icon: "🍔" },
    { id: "all", label: "📋 Full Menu", icon: "📋" },
];

export default function Menu() {
    const navigate = useNavigate();
    const { addToCart, cartCount } = useCart();

    const [menuSection, setMenuSection] = useState("all");
    const [activeCategory, setActiveCategory] = useState("All");
    const [search, setSearch] = useState("");
    const [sortBy, setSortBy] = useState("default");
    const [addedId, setAddedId] = useState(null);
    const [toast, setToast] = useState("");

    const categoryList = menuSection === "fastfood"
        ? FAST_FOOD_CATEGORIES
        : PIZZA_CATEGORIES;

    function filterMenu(menuData) {
        const allItems = menuData.flatMap(c =>
            c.items.map(item => ({ ...item, category: c.category }))
        );

        let filtered = activeCategory === "All"
            ? allItems
            : allItems.filter(i => i.category === activeCategory);

        if (search.trim()) {
            const q = search.toLowerCase();
            filtered = filtered.filter(i =>
                i.name.toLowerCase().includes(q) ||
                i.desc.toLowerCase().includes(q)
            );
        }

        if (sortBy === "price-asc") filtered = [...filtered].sort((a, b) => a.price - b.price);
        if (sortBy === "price-desc") filtered = [...filtered].sort((a, b) => b.price - a.price);
        if (sortBy === "name") filtered = [...filtered].sort((a, b) => a.name.localeCompare(b.name));

        return menuData.map(cat => ({
            ...cat,
            items: filtered.filter(i => i.category === cat.category),
        })).filter(cat => cat.items.length > 0);
    }

    const pizzaGrouped = filterMenu(PIZZA_MENU);
    const fastFoodGrouped = filterMenu(FAST_FOOD_MENU);

    const pizzaCount = pizzaGrouped.reduce((n, c) => n + c.items.length, 0);
    const fastFoodCount = fastFoodGrouped.reduce((n, c) => n + c.items.length, 0);

    const showPizzas = menuSection === "pizzas" || menuSection === "all";
    const showFastFood = menuSection === "fastfood" || menuSection === "all";
    const totalShowing = (showPizzas ? pizzaCount : 0) + (showFastFood ? fastFoodCount : 0);

    function handleSectionChange(section) {
        setMenuSection(section);
        setActiveCategory("All");
    }

    function handleAddToCart(item, isFastFood = false) {
        const user = JSON.parse(localStorage.getItem("user") || "null");
        if (!user) {
            showToast("⚠️ Please sign in to add to cart!");
            setTimeout(() => navigate("/login"), 1500);
            return;
        }

        let merged = false;
        if (isFastFood) {
            merged = addToCart({
                name: item.name,
                price: item.price,
                type: "fastfood",
                desc: item.desc,
                size: "Regular",
                crust: "—",
                sauce: "—",
                toppings: [],
            });
            showToast(
                merged
                    ? `🍔 ${item.name} — qty updated in cart!`
                    : `🍔 ${item.name} added to cart!`
            );
        } else {
            merged = addToCart({
                name: item.name,
                size: item.size,
                crust: item.crust,
                sauce: item.sauce,
                toppings: item.toppings,
                price: item.price,
                qty: 1,
            });
            showToast(
                merged
                    ? `🍕 ${item.name} — qty updated in cart!`
                    : `🍕 ${item.name} added to cart!`
            );
        }

        setAddedId(item.id);
        setTimeout(() => setAddedId(null), 1500);
    }

    function showToast(msg) {
        setToast(msg);
        setTimeout(() => setToast(""), 2500);
    }

    return (
        <>
            <link
                rel="stylesheet"
                href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css"
            />

            <div style={{ background: "#fff8f0", minHeight: "calc(100vh - 68px)" }}>
                {/* Hero */}
                <div style={styles.hero}>
                    <div style={styles.heroOverlay} />
                    <div style={{ position: "relative", zIndex: 1, textAlign: "center" }}>
                        <h1 style={styles.heroTitle}>Our Full Menu 🍕🍔</h1>
                        <p style={styles.heroSub}>
                            Pizzas · Burgers · Wings · Sides · Delivered hot to your door
                        </p>
                        <div style={styles.searchWrap}>
                            <span style={styles.searchIcon}>🔍</span>
                            <input
                                type="text"
                                placeholder={
                                    menuSection === "fastfood"
                                        ? "Search fast food… e.g. 'burger', 'wings', 'fries'"
                                        : menuSection === "pizzas"
                                            ? "Search pizzas… e.g. 'BBQ', 'cheese', 'spicy'"
                                            : "Search menu… pizzas, burgers, wings, drinks…"
                                }
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                style={styles.searchInput}
                            />
                            {search && (
                                <button onClick={() => setSearch("")} style={styles.clearBtn}>✕</button>
                            )}
                        </div>
                    </div>
                </div>

                <div className="container py-4">
                    {/* Section switcher */}
                    <div style={styles.sectionTabs}>
                        {MENU_SECTIONS.map(sec => (
                            <button
                                key={sec.id}
                                onClick={() => handleSectionChange(sec.id)}
                                style={{
                                    ...styles.sectionTab,
                                    background: menuSection === sec.id
                                        ? "linear-gradient(135deg, #e63329, #f97316)"
                                        : "#fff",
                                    color: menuSection === sec.id ? "#fff" : "#555",
                                    border: menuSection === sec.id
                                        ? "2px solid #e63329"
                                        : "2px solid #e5e7eb",
                                    boxShadow: menuSection === sec.id
                                        ? "0 4px 16px rgba(230,51,41,.25)"
                                        : "none",
                                }}
                            >
                                {sec.label}
                            </button>
                        ))}
                    </div>

                    {/* Filter + Sort */}
                    <div style={styles.filterBar}>
                        <div style={styles.pills}>
                            {categoryList.map(cat => (
                                <button
                                    key={cat}
                                    onClick={() => setActiveCategory(cat)}
                                    style={{
                                        ...styles.pill,
                                        background: activeCategory === cat ? "#e63329" : "#fff",
                                        color: activeCategory === cat ? "#fff" : "#555",
                                        border: activeCategory === cat
                                            ? "2px solid #e63329"
                                            : "2px solid #e5e7eb",
                                        fontWeight: activeCategory === cat ? 800 : 600,
                                    }}
                                >
                                    {cat}
                                </button>
                            ))}
                        </div>
                        <select
                            value={sortBy}
                            onChange={e => setSortBy(e.target.value)}
                            style={styles.sortSelect}
                        >
                            <option value="default">Sort: Featured</option>
                            <option value="price-asc">Price: Low → High</option>
                            <option value="price-desc">Price: High → Low</option>
                            <option value="name">Name: A → Z</option>
                        </select>
                    </div>

                    <p style={{ color: "#888", fontSize: ".88rem", marginBottom: 24 }}>
                        Showing <strong style={{ color: "#e63329" }}>{totalShowing}</strong> item{totalShowing !== 1 ? "s" : ""}
                        {search && <> matching "<strong>{search}</strong>"</>}
                    </p>

                    {totalShowing === 0 && (
                        <div style={styles.noResults}>
                            <div style={{ fontSize: "4rem", marginBottom: 12 }}>😕</div>
                            <h4 style={{ fontFamily: "'Boogaloo',cursive", fontSize: "1.6rem", color: "#555" }}>
                                No items found!
                            </h4>
                            <p style={{ color: "#aaa" }}>Try a different search or category.</p>
                            <button
                                onClick={() => { setSearch(""); setActiveCategory("All"); setMenuSection("all"); }}
                                style={styles.resetBtn}
                            >
                                Show Full Menu
                            </button>
                        </div>
                    )}

                    {/* ── Pizza sections ── */}
                    {showPizzas && pizzaCount > 0 && (
                        <div style={{ marginBottom: menuSection === "all" ? 16 : 0 }}>
                            {menuSection === "all" && (
                                <div style={styles.mainSectionBanner}>
                                    <h2 style={styles.mainSectionTitle}>🍕 Our Pizzas</h2>
                                    <p style={styles.mainSectionSub}>
                                        {pizzaCount} handcrafted pizzas · Fresh dough daily
                                    </p>
                                </div>
                            )}
                            {pizzaGrouped.map(cat => (
                                <MenuCategorySection key={cat.category} category={cat.category}>
                                    <div className="row g-4">
                                        {cat.items.map(item => (
                                            <div key={item.id} className="col-12 col-sm-6 col-lg-4">
                                                <PizzaCard
                                                    item={item}
                                                    isAdded={addedId === item.id}
                                                    onAdd={() => handleAddToCart(item, false)}
                                                    onCustomize={() => navigate("/customize")}
                                                />
                                            </div>
                                        ))}
                                    </div>
                                </MenuCategorySection>
                            ))}
                        </div>
                    )}

                    {/* ── Fast food sections ── */}
                    {showFastFood && fastFoodCount > 0 && (
                        <div
                            style={{
                                marginTop: showPizzas && pizzaCount > 0 && menuSection === "all" ? 24 : 0,
                                paddingTop: showPizzas && pizzaCount > 0 && menuSection === "all" ? 32 : 0,
                                borderTop: showPizzas && pizzaCount > 0 && menuSection === "all"
                                    ? "3px dashed #fde68a"
                                    : "none",
                            }}
                        >
                            {menuSection === "all" && (
                                <div style={{ ...styles.mainSectionBanner, background: "linear-gradient(135deg, #1c0a00, #44403c)" }}>
                                    <h2 style={{ ...styles.mainSectionTitle, color: "#fbbf24" }}>🍔 Fast Food & More</h2>
                                    <p style={{ ...styles.mainSectionSub, color: "rgba(255,255,255,.75)" }}>
                                        {fastFoodCount} burgers, wings, sides & drinks · Perfect with your pizza
                                    </p>
                                </div>
                            )}
                            {fastFoodGrouped.map(cat => (
                                <MenuCategorySection key={cat.category} category={cat.category} accent="#f97316">
                                    <div className="row g-4">
                                        {cat.items.map(item => (
                                            <div key={item.id} className="col-12 col-sm-6 col-lg-4">
                                                <FastFoodCard
                                                    item={item}
                                                    isAdded={addedId === item.id}
                                                    onAdd={() => handleAddToCart(item, true)}
                                                />
                                            </div>
                                        ))}
                                    </div>
                                </MenuCategorySection>
                            ))}
                        </div>
                    )}

                    {/* Bottom CTA — pizzas only */}
                    {(menuSection === "pizzas" || menuSection === "all") && (
                        <div style={styles.bottomCta}>
                            <h3 style={styles.ctaTitle}>Want something more custom? 🎮</h3>
                            <p style={{ color: "rgba(255,255,255,.85)", marginBottom: 20 }}>
                                Build your own pizza exactly the way you like it!
                            </p>
                            <button onClick={() => navigate("/customize")} style={styles.ctaBtn}>
                                🎮 Build Your Own Pizza
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {cartCount > 0 && (
                <button onClick={() => navigate("/cart")} style={styles.floatingCart}>
                    🛒 View Cart ({cartCount})
                </button>
            )}

            <div style={{
                ...styles.toast,
                transform: toast
                    ? "translateX(-50%) translateY(0)"
                    : "translateX(-50%) translateY(100px)",
            }}>
                {toast}
            </div>

            <style>{`
        @keyframes cardIn {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes addPop {
          0%   { transform: scale(1); }
          40%  { transform: scale(.92); }
          70%  { transform: scale(1.06); }
          100% { transform: scale(1); }
        }
        @keyframes floatIn {
          from { opacity:0; transform: translateX(-50%) translateY(20px); }
          to   { opacity:1; transform: translateX(-50%) translateY(0); }
        }
        .pizza-card, .fastfood-card {
          animation: cardIn .4s ease both;
          transition: transform .25s ease, box-shadow .25s ease;
        }
        .pizza-card:hover, .fastfood-card:hover {
          transform: translateY(-6px);
          box-shadow: 0 16px 40px rgba(230,51,41,.18) !important;
        }
        .fastfood-card:hover {
          box-shadow: 0 16px 40px rgba(249,115,22,.2) !important;
        }
        .pizza-card img, .fastfood-card img {
          transition: transform .4s ease;
        }
        .pizza-card:hover img, .fastfood-card:hover img {
          transform: scale(1.07);
        }
        .add-btn-pop { animation: addPop .35s ease; }
      `}</style>
        </>
    );
}

function MenuCategorySection({ category, children, accent = "#e63329" }) {
    return (
        <div style={{ marginBottom: 48 }}>
            <div style={styles.catHeading}>
                <h3 style={styles.catTitle}>{category}</h3>
                <div style={{ ...styles.catLine, background: `linear-gradient(to right, ${accent}, transparent)` }} />
            </div>
            {children}
        </div>
    );
}

function PizzaCard({ item, isAdded, onAdd, onCustomize }) {
    return (
        <div
            className="pizza-card"
            style={{
                background: "#fff",
                borderRadius: 20,
                overflow: "hidden",
                boxShadow: "0 4px 20px rgba(0,0,0,.08)",
                height: "100%",
                display: "flex",
                flexDirection: "column",
            }}
        >
            <CardImage item={item} fallback="https://images.unsplash.com/photo-1628840042765-356cda07504e?w=400&q=80" />
            <div style={{ padding: "16px 18px", flex: 1, display: "flex", flexDirection: "column" }}>
                <h5 style={{ fontFamily: "'Boogaloo', cursive", fontSize: "1.3rem", color: "#1c0a00", marginBottom: 6 }}>
                    {item.name}
                </h5>
                <p style={{ fontSize: ".83rem", color: "#888", lineHeight: 1.6, marginBottom: 12, flex: 1 }}>
                    {item.desc}
                </p>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
                    {[item.size, item.crust + " crust", item.sauce].map(tag => (
                        <span key={tag} style={styles.tag}>{tag}</span>
                    ))}
                </div>
                {item.toppings.length > 0 && (
                    <div style={{ marginBottom: 14 }}>
                        <div style={{ fontSize: ".75rem", color: "#aaa", fontWeight: 700, marginBottom: 4 }}>
                            TOPPINGS
                        </div>
                        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                            {item.toppings.map(t => (
                                <span key={t.label} style={styles.toppingChip}>
                                    {t.icon} {t.label}
                                </span>
                            ))}
                        </div>
                    </div>
                )}
                <div style={{ display: "flex", gap: 8 }}>
                    <button
                        onClick={onAdd}
                        className={isAdded ? "add-btn-pop" : ""}
                        style={{
                            flex: 1, padding: "10px 0",
                            background: isAdded ? "#16a34a" : "#e63329",
                            color: "#fff", border: "none", borderRadius: 50,
                            fontFamily: "'Boogaloo', cursive", fontSize: "1rem",
                            cursor: "pointer", transition: "background .3s",
                        }}
                    >
                        {isAdded ? "✅ Added!" : "🛒 Add to Cart"}
                    </button>
                    <button
                        onClick={onCustomize}
                        style={{
                            padding: "10px 14px",
                            background: "transparent", color: "#e63329",
                            border: "2px solid #e63329", borderRadius: 50,
                            fontFamily: "'Boogaloo', cursive", fontSize: ".9rem",
                            cursor: "pointer",
                        }}
                        title="Customize this pizza"
                    >
                        ✏️
                    </button>
                </div>
            </div>
        </div>
    );
}

function FastFoodCard({ item, isAdded, onAdd }) {
    return (
        <div
            className="fastfood-card"
            style={{
                background: "#fff",
                borderRadius: 20,
                overflow: "hidden",
                boxShadow: "0 4px 20px rgba(0,0,0,.08)",
                height: "100%",
                display: "flex",
                flexDirection: "column",
                border: "2px solid #fff7ed",
            }}
        >
            <CardImage item={item} fallback="https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400&q=80" />
            <div style={{ padding: "16px 18px", flex: 1, display: "flex", flexDirection: "column" }}>
                <h5 style={{ fontFamily: "'Boogaloo', cursive", fontSize: "1.3rem", color: "#1c0a00", marginBottom: 6 }}>
                    {item.name}
                </h5>
                <p style={{ fontSize: ".83rem", color: "#888", lineHeight: 1.6, marginBottom: 12, flex: 1 }}>
                    {item.desc}
                </p>
                {item.tags?.length > 0 && (
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
                        {item.tags.map(tag => (
                            <span key={tag} style={styles.fastFoodTag}>{tag}</span>
                        ))}
                    </div>
                )}
                <button
                    onClick={onAdd}
                    className={isAdded ? "add-btn-pop" : ""}
                    style={{
                        width: "100%", padding: "11px 0",
                        background: isAdded ? "#16a34a" : "linear-gradient(135deg, #f97316, #ea580c)",
                        color: "#fff", border: "none", borderRadius: 50,
                        fontFamily: "'Boogaloo', cursive", fontSize: "1rem",
                        cursor: "pointer", transition: "background .3s",
                        boxShadow: isAdded ? "none" : "0 3px 0 #c2410c",
                    }}
                >
                    {isAdded ? "✅ Added!" : "🛒 Add to Cart"}
                </button>
            </div>
        </div>
    );
}

function CardImage({ item, fallback }) {
    return (
        <div style={{ position: "relative", overflow: "hidden", height: 210 }}>
            <img
                src={item.image}
                alt={item.name}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
                onError={e => { e.target.src = fallback; }}
            />
            <span style={{
                position: "absolute", top: 12, left: 12,
                background: item.badgeColor, color: "#fff",
                borderRadius: 50, padding: "4px 12px",
                fontSize: ".78rem", fontWeight: 800,
                boxShadow: "0 2px 8px rgba(0,0,0,.2)",
            }}>
                {item.badge}
            </span>
            <span style={{
                position: "absolute", top: 12, right: 12,
                background: "#1c0a00", color: "#fbbf24",
                borderRadius: 50, padding: "4px 12px",
                fontSize: ".9rem", fontWeight: 800,
                fontFamily: "'Boogaloo', cursive",
            }}>
                ৳{item.price}
            </span>
        </div>
    );
}

const styles = {
    hero: {
        background: "linear-gradient(135deg, #1c0a00 0%, #7c2d12 50%, #e63329 100%)",
        padding: "60px 20px 48px",
        position: "relative",
        overflow: "hidden",
    },
    heroOverlay: {
        position: "absolute", inset: 0,
        background: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23ffffff\' fill-opacity=\'0.03\'%3E%3Ccircle cx=\'30\' cy=\'30\' r=\'30\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")',
    },
    heroTitle: {
        fontFamily: "'Boogaloo', cursive",
        fontSize: "clamp(2.5rem, 5vw, 4rem)",
        color: "#fff", marginBottom: 8,
    },
    heroSub: {
        color: "rgba(255,255,255,.75)",
        fontSize: "1rem", marginBottom: 28,
    },
    searchWrap: {
        position: "relative", maxWidth: 520,
        margin: "0 auto", display: "flex", alignItems: "center",
    },
    searchIcon: {
        position: "absolute", left: 16,
        fontSize: "1.1rem", pointerEvents: "none",
    },
    searchInput: {
        width: "100%", padding: "14px 48px",
        borderRadius: 50, border: "none", outline: "none",
        fontFamily: "Nunito, sans-serif", fontSize: ".95rem",
        boxShadow: "0 4px 20px rgba(0,0,0,.2)",
        background: "#fff",
    },
    clearBtn: {
        position: "absolute", right: 14,
        background: "#e5e7eb", border: "none", borderRadius: "50%",
        width: 26, height: 26, cursor: "pointer",
        fontSize: ".8rem", color: "#666",
        display: "flex", alignItems: "center", justifyContent: "center",
    },
    sectionTabs: {
        display: "flex", gap: 10, flexWrap: "wrap",
        marginBottom: 16, justifyContent: "center",
    },
    sectionTab: {
        padding: "10px 22px", borderRadius: 50,
        cursor: "pointer", fontSize: ".95rem",
        fontFamily: "'Boogaloo', cursive",
        fontWeight: 700, transition: "all .25s",
    },
    filterBar: {
        display: "flex", justifyContent: "space-between",
        alignItems: "center", flexWrap: "wrap",
        gap: 12, marginBottom: 16,
        padding: "16px 20px",
        background: "#fff", borderRadius: 16,
        boxShadow: "0 2px 12px rgba(0,0,0,.06)",
    },
    pills: { display: "flex", gap: 8, flexWrap: "wrap" },
    pill: {
        padding: "6px 16px", borderRadius: 50,
        cursor: "pointer", fontSize: ".82rem",
        fontFamily: "Nunito, sans-serif",
        transition: "all .2s",
    },
    sortSelect: {
        padding: "8px 14px", borderRadius: 50,
        border: "2px solid #e5e7eb", outline: "none",
        fontFamily: "Nunito, sans-serif", fontSize: ".85rem",
        background: "#fff", cursor: "pointer", color: "#555",
    },
    mainSectionBanner: {
        background: "linear-gradient(135deg, #7c2d12, #e63329)",
        borderRadius: 20, padding: "28px 32px",
        marginBottom: 32, textAlign: "center",
    },
    mainSectionTitle: {
        fontFamily: "'Boogaloo', cursive",
        fontSize: "clamp(1.8rem, 4vw, 2.4rem)",
        color: "#fff", marginBottom: 6,
    },
    mainSectionSub: {
        color: "rgba(255,255,255,.85)",
        fontSize: ".95rem", marginBottom: 0,
    },
    catHeading: {
        display: "flex", alignItems: "center",
        gap: 16, marginBottom: 20,
    },
    catTitle: {
        fontFamily: "'Boogaloo', cursive",
        fontSize: "1.6rem", color: "#7c2d12",
        whiteSpace: "nowrap", marginBottom: 0,
    },
    catLine: {
        flex: 1, height: 2, borderRadius: 2,
    },
    tag: {
        background: "#fff8f0", color: "#7c2d12",
        border: "1px solid #fde68a",
        borderRadius: 50, padding: "2px 10px",
        fontSize: ".72rem", fontWeight: 700,
    },
    fastFoodTag: {
        background: "#fff7ed", color: "#c2410c",
        border: "1px solid #fed7aa",
        borderRadius: 50, padding: "3px 11px",
        fontSize: ".72rem", fontWeight: 700,
    },
    toppingChip: {
        background: "#f0fdf4", color: "#166534",
        border: "1px solid #86efac",
        borderRadius: 50, padding: "2px 8px",
        fontSize: ".72rem", fontWeight: 600,
    },
    noResults: {
        textAlign: "center", padding: "60px 20px",
        background: "#fff", borderRadius: 20,
        marginBottom: 32,
    },
    resetBtn: {
        background: "#e63329", color: "#fff",
        border: "none", borderRadius: 50,
        padding: "10px 24px", cursor: "pointer",
        fontFamily: "Nunito, sans-serif", fontWeight: 700,
        marginTop: 12,
    },
    bottomCta: {
        background: "linear-gradient(135deg, #e63329, #f97316)",
        borderRadius: 24, padding: "40px 32px",
        textAlign: "center", color: "#fff",
        marginTop: 16, marginBottom: 32,
    },
    ctaTitle: {
        fontFamily: "'Boogaloo', cursive",
        fontSize: "2rem", marginBottom: 8,
    },
    ctaBtn: {
        background: "#fbbf24", color: "#1c0a00",
        border: "none", borderRadius: 50,
        padding: "14px 36px", cursor: "pointer",
        fontFamily: "'Boogaloo', cursive",
        fontSize: "1.3rem",
        boxShadow: "0 4px 0 #b45309",
    },
    floatingCart: {
        position: "fixed", bottom: 24, left: "50%",
        transform: "translateX(-50%)",
        background: "#1c0a00", color: "#fbbf24",
        border: "none", borderRadius: 50,
        padding: "14px 28px", cursor: "pointer",
        fontFamily: "'Boogaloo', cursive", fontSize: "1.1rem",
        boxShadow: "0 8px 24px rgba(0,0,0,.3)",
        zIndex: 90,
        animation: "floatIn .4s ease",
    },
    toast: {
        position: "fixed", bottom: 80, left: "50%",
        background: "#1c0a00", color: "#fff",
        padding: "12px 24px", borderRadius: 50,
        fontWeight: 700, fontSize: ".9rem",
        zIndex: 999, transition: "transform .35s ease",
        pointerEvents: "none", whiteSpace: "nowrap",
        boxShadow: "0 4px 20px rgba(0,0,0,.25)",
    },
};

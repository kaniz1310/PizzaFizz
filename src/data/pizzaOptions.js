// Shared pizza builder options (customize wizard + favorites restore)

export const SIZES = [
    { label: "Small", icon: "🍕", price: 199 },
    { label: "Medium", icon: "🍕", price: 299 },
    { label: "Large", icon: "🍕", price: 399 },
    { label: "XL", icon: "🍕", price: 499 },
];

export const CRUSTS = [
    { label: "Thin", icon: "〰️", price: 0 },
    { label: "Classic", icon: "⭕", price: 30 },
    { label: "Stuffed", icon: "🧀", price: 60 },
    { label: "Whole Wheat", icon: "🌾", price: 40 },
];

export const SAUCES = [
    { label: "Tomato", icon: "🍅", price: 0 },
    { label: "BBQ", icon: "🔥", price: 20 },
    { label: "Pesto", icon: "🌿", price: 30 },
    { label: "White", icon: "🤍", price: 25 },
    { label: "Buffalo", icon: "🌶️", price: 25 },
    { label: "Garlic Butter", icon: "🧄", price: 30 },
];

export const CHEESE_TYPES = [
    { label: "Mozzarella", icon: "🧀", pricePerPortion: 35 },
    { label: "Cheddar", icon: "🟡", pricePerPortion: 40 },
    { label: "Parmesan", icon: "🧈", pricePerPortion: 45 },
    { label: "Gouda", icon: "🧀", pricePerPortion: 42 },
    { label: "Feta", icon: "🥛", pricePerPortion: 38 },
    { label: "Blue Cheese", icon: "💙", pricePerPortion: 55 },
];

export const TOPPINGS = [
    { label: "Pepperoni", icon: "🍖", price: 50 },
    { label: "Sausage", icon: "🌭", price: 55 },
    { label: "Meatball", icon: "🧆", price: 60 },
    { label: "Beef", icon: "🥩", price: 70 },
    { label: "Chicken", icon: "🍗", price: 70 },
    { label: "Bacon", icon: "🥓", price: 80 },
    { label: "Ham", icon: "🍖", price: 55 },
    { label: "Mushrooms", icon: "🍄", price: 30 },
    { label: "Capsicum", icon: "🫑", price: 25 },
    { label: "Bell Pepper", icon: "🫑", price: 25 },
    { label: "Onions", icon: "🧅", price: 20 },
    { label: "Olives", icon: "🫒", price: 25 },
    { label: "Jalapeños", icon: "🌶️", price: 30 },
    { label: "Corn", icon: "🌽", price: 20 },
    { label: "Tomatoes", icon: "🍅", price: 20 },
    { label: "Spinach", icon: "🥬", price: 25 },
    { label: "Paneer", icon: "🧊", price: 60 },
    { label: "Pineapple", icon: "🍍", price: 30 },
    { label: "Prawns", icon: "🦐", price: 90 },
    { label: "Anchovies", icon: "🐟", price: 45 },
];

export const EXTRA_ADD_INS = [
    { label: "Extra Cheese", icon: "🧀", price: 45 },
    { label: "Extra Sauce", icon: "🍅", price: 25 },
    { label: "Extra Spice", icon: "🌶️", price: 15 },
    { label: "Chilli Flakes", icon: "🔥", price: 10 },
    { label: "Extra Garlic", icon: "🧄", price: 20 },
    { label: "Oregano Boost", icon: "🌿", price: 10 },
    { label: "Ranch Drizzle", icon: "🥛", price: 30 },
    { label: "BBQ Drizzle", icon: "🔥", price: 25 },
    { label: "Double Meat", icon: "🍖", price: 80 },
    { label: "Honey Glaze", icon: "🍯", price: 20 },
];

export const MAX_TOPPINGS = 8;
export const MAX_CHEESE_PORTIONS = 3;

export const WIZARD_STEPS = [
    { id: "size", title: "Pick Size", emoji: "📏", hint: "How hungry are you?" },
    { id: "base", title: "Crust & Sauce", emoji: "🥖", hint: "Build the foundation" },
    { id: "cheese", title: "Cheese", emoji: "🧀", hint: "Optional — go melty" },
    { id: "toppings", title: "Toppings", emoji: "🌶️", hint: `Up to ${MAX_TOPPINGS} picks` },
    { id: "finish", title: "Finish", emoji: "✨", hint: "Extras & your AI preview" },
];

export const EMPTY_PIZZA = {
    size: null, sizePrice: 0,
    crust: null, crustPrice: 0,
    sauce: null, saucePrice: 0,
    cheeses: [], cheesePrice: 0,
    toppings: [], toppingPrice: 0,
    addIns: [], addInPrice: 0,
};

export function calcPizzaTotal(pizza) {
    return (
        pizza.sizePrice +
        pizza.crustPrice +
        pizza.saucePrice +
        pizza.cheesePrice +
        pizza.toppingPrice +
        pizza.addInPrice
    );
}

export function pizzaToCartPayload(pizza) {
    return {
        name: `${pizza.size} Custom Pizza`,
        size: pizza.size,
        crust: pizza.crust,
        sauce: pizza.sauce,
        cheeses: pizza.cheeses,
        toppings: pizza.toppings,
        addIns: pizza.addIns,
        price: calcPizzaTotal(pizza),
        type: "pizza",
    };
}

/** Restore wizard state from a saved favorite or cart line */
export function itemToPizzaState(item) {
    const sizeRow = SIZES.find((s) => s.label === item.size);
    const crustRow = CRUSTS.find((c) => c.label === item.crust);
    const sauceRow = SAUCES.find((s) => s.label === item.sauce);

    const cheeses = (item.cheeses || []).map((c) => {
        const base = CHEESE_TYPES.find((x) => x.label === c.label) || c;
        const qty = c.qty || 1;
        return { ...base, qty };
    });

    const toppings = (item.toppings || []).map((t) => {
        if (typeof t === "string") return TOPPINGS.find((x) => x.label === t) || { label: t, icon: "🍕", price: 0 };
        return TOPPINGS.find((x) => x.label === t.label) || t;
    });

    const addIns = (item.addIns || []).map((a) => {
        if (typeof a === "string") return EXTRA_ADD_INS.find((x) => x.label === a) || { label: a, icon: "✨", price: 0 };
        return EXTRA_ADD_INS.find((x) => x.label === a.label) || a;
    });

    const cheesePrice = cheeses.reduce((s, c) => s + (c.pricePerPortion || 0) * (c.qty || 1), 0);
    const toppingPrice = toppings.reduce((s, t) => s + (t.price || 0), 0);
    const addInPrice = addIns.reduce((s, a) => s + (a.price || 0), 0);

    return {
        size: item.size,
        sizePrice: (sizeRow?.price ?? parseFloat(item.price)) || 0,
        crust: item.crust,
        crustPrice: crustRow?.price ?? 0,
        sauce: item.sauce,
        saucePrice: sauceRow?.price ?? 0,
        cheeses,
        cheesePrice,
        toppings,
        toppingPrice,
        addIns,
        addInPrice,
    };
}

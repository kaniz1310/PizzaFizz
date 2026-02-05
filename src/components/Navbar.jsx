import { useState } from "react";

function Navbar() {

    const pizzas = [
        "Pepperoni",
        "Cheese Burst",
        "Veg Supreme",
        "BBQ Chicken",
        "Mushroom Delight"
    ];

    const [query, setQuery] = useState("");
    const [show, setShow] = useState(false);

    const filtered = pizzas.filter(p =>
        p.toLowerCase().includes(query.toLowerCase())
    );

    return (
        <nav className="modern-nav sticky-top shadow-sm">

            <div className="nav-inner">

                {/* Logo */}
                <div className="logo-wrap">
                    <span className="logo-icon">🍕</span>
                    <span className="logo-text">PizzaFizz</span>
                </div>



                {/* Right Side */}
                <div className="nav-right">

                    {/* Search */}
                    <div className="search-box">
                        <input
                            type="text"
                            placeholder="Search..."
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            onFocus={() => setShow(true)}
                            onBlur={() => setTimeout(() => setShow(false), 200)}
                        />

                        <i className="bi bi-search"></i>

                        {show && query && (
                            <div className="search-dropdown">
                                {filtered.length > 0 ? (
                                    filtered.map((item, i) => (
                                        <button
                                            key={i}
                                            onClick={() => {
                                                setQuery(item);
                                                setShow(false);
                                            }}
                                        >
                                            {item}
                                        </button>
                                    ))
                                ) : (
                                    <div className="no-result">No results</div>
                                )}
                            </div>
                        )}
                    </div>


                    {/* Cart */}
                    <button className="icon-btn fancy">
                        <i className="bi bi-cart3"></i>
                        <span className="badge">2</span>
                    </button>

                    {/* Login */}
                    <button className="btn-glass">Login</button>

                    {/* Register */}
                    <button className="btn-primary-glow">Register</button>

                    {/* Profile */}
                    <button className="icon-btn dark fancy" data-bs-toggle="dropdown">
                        <i className="bi bi-person"></i>
                    </button>


                    <ul className="dropdown-menu dropdown-menu-end">
                        <li><a className="dropdown-item">Profile</a></li>
                        <li><a className="dropdown-item">Orders</a></li>
                        <li><hr className="dropdown-divider" /></li>
                        <li><a className="dropdown-item text-danger">Logout</a></li>
                    </ul>
                </div>

            </div>

        </nav >
    );
}

export default Navbar;

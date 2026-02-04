function Navbar() {
    return (
        <nav className="navbar navbar-expand-lg navbar-dark bg-dark px-4">
            <a className="navbar-brand fw-bold" href="#">
                🍕 PizzaFizz
            </a>

            <div className="ms-auto d-flex gap-2">
                <input
                    className="form-control"
                    type="search"
                    placeholder="Search pizza..."
                    style={{ width: "200px" }}
                />

                <button className="btn btn-outline-light">Login</button>
                <button className="btn btn-warning">Register</button>
            </div>
        </nav>
    );
}

export default Navbar;

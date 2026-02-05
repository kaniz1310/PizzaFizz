import banner1 from "../assets/banner1.jpg";
import banner2 from "../assets/banner2.jpg";
import banner3 from "../assets/banner3.jpg";

import pizza1 from "../assets/pizza1.jpg";
import pizza2 from "../assets/pizza2.jpg";
import pizza3 from "../assets/pizza3.jpg";

function Home() {
    return (
        <div className="container text-center my-5">

            {/* Banner / Carousel */}
            <div
                id="pizzaBanner"
                className="carousel slide mb-5"
                data-bs-ride="carousel"
            >
                <div className="carousel-inner rounded">

                    <div className="carousel-item active">
                        <img
                            src={banner1}
                            className="d-block w-100"
                            style={{ height: "450px", objectFit: "cover" }}
                            alt="Banner 1"
                        />
                        <div className="carousel-caption">
                            <h1 className="fw-bold">Hot & Fresh Pizzas 🍕</h1>
                            <p>Made with love. Delivered fast.</p>
                            <button className="btn btn-danger">Order Now</button>
                        </div>
                    </div>

                    <div className="carousel-item">
                        <img
                            src={banner2}
                            className="d-block w-100"
                            style={{ height: "450px", objectFit: "cover" }}
                            alt="Banner 2"
                        />
                        <div className="carousel-caption">
                            <h1 className="fw-bold">Cheesy & Delicious</h1>
                            <p>Your favourite flavours await</p>
                            <button className="btn btn-danger">Explore Menu</button>
                        </div>
                    </div>

                    <div className="carousel-item">
                        <img
                            src={banner3}
                            className="d-block w-100"
                            style={{ height: "450px", objectFit: "cover" }}
                            alt="Banner 3"
                        />
                        <div className="carousel-caption">
                            <h1 className="fw-bold">Best Pizza in Town</h1>
                            <p>Fresh ingredients. Perfect taste.</p>
                            <button className="btn btn-danger">Order Today</button>
                        </div>
                    </div>

                </div>

                <button
                    className="carousel-control-prev"
                    type="button"
                    data-bs-target="#pizzaBanner"
                    data-bs-slide="prev"
                >
                    <span className="carousel-control-prev-icon"></span>
                </button>

                <button
                    className="carousel-control-next"
                    type="button"
                    data-bs-target="#pizzaBanner"
                    data-bs-slide="next"
                >
                    <span className="carousel-control-next-icon"></span>
                </button>
            </div>

            {/* Top 3 Pizzas */}
            <h2 className="fw-bold mb-4">Top 3 Pizzas 🍕</h2>

            <div className="row justify-content-center g-4">
                {[pizza1, pizza2, pizza3].map((img, i) => (
                    <div className="col-md-4" key={i}>
                        <div className="card">
                            <img src={img} className="card-img-top" alt="Pizza" />
                            <div className="card-body">
                                <h5 className="card-title">Delicious Pizza</h5>
                                <p className="card-text">$10</p>
                                <button className="btn btn-danger">Add to Cart</button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Menu Button */}
            <div className="mt-5">
                <button className="btn btn-lg btn-outline-dark">
                    View Full Menu
                </button>
            </div>

        </div>
    );
}

export default Home;

import banner1 from "../assets/banner1.jpg";
import banner2 from "../assets/banner2.jpg";
import banner3 from "../assets/banner3.jpg";
import pizza1 from "../assets/pizza1.jpg";
import pizza2 from "../assets/pizza2.jpg";
import pizza3 from "../assets/pizza3.jpg";
import { useNavigate } from "react-router-dom";
import { Link } from "react-router-dom";
import Menu from "./Menu";


function Home() {


    const navigate = useNavigate();

    return (
        <div className="container text-center my-5">


            <div id="pizzaBanner"
                className="carousel slide mb-5"
                data-bs-ride="carousel"
            >
                <div className="carousel-inner rounded">

                    <div className="carousel-item active">
                        <div className="banner">
                            <img
                                src={banner1}
                                className="d-block w-100"
                                style={{ height: "450px", objectFit: "cover" }}
                                alt="Banner 1"
                            />
                        </div>
                        <div className="carousel-caption">
                            <h1 style={styles.h1}>
                                Build Your <span style={{ color: "#fbbf24" }}>Dream Pizza</span>
                                <br />Like a Game!
                            </h1>

                            <p style={styles.subtitle}>
                                Pick your size, crust, sauce &amp; toppings — then submit your order!
                            </p>
                            <button onClick={() => navigate("/customize")} style={styles.btn}>
                                🎮 Start Building!
                            </button>

                            <style>{`
        @keyframes float {
          0%,100% { transform: translateY(0); }
          50%      { transform: translateY(-20px); }
        }
      `}

                            </style>
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
                <button
                    className="btn btn-lg btn-outline-dark"
                    onClick={() => navigate("/menu")}
                >
                    View Full Menu
                </button>
            </div>

        </div>
    );

}

export default Home;
const styles = {

    h1: {
        fontFamily: "'Boogaloo', cursive",
        fontSize: "clamp(2.5rem, 6vw, 4.5rem)",
        color: "#fff",
        lineHeight: 1.1,
        marginBottom: 16,
    },
    subtitle: {
        color: "rgba(255,255,255,.9)",
        fontSize: "1.15rem",
        marginBottom: 28,
        maxWidth: 500,
    },
    btn: {
        background: "#fbbf24", color: "#1c0a00", border: "none",
        borderRadius: 50, padding: "16px 44px",
        fontFamily: "'Boogaloo', cursive", fontSize: "1.5rem",
        cursor: "pointer", boxShadow: "0 6px 0 #b45309",
    },
};

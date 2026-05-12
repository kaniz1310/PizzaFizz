// src/components/Footer.jsx
import { Link } from 'react-router-dom';

const Footer = () => {
    return (
        <footer className="bg-dark text-light py-5 mt-5">
            <div className="container">
                <div className="row gy-4">
                    {/* Brand */}
                    <div className="col-lg-4 col-md-6">
                        <h3 className="text-warning fw-bold mb-3">
                            PizzaFizz <span className="fs-1">🍕</span>
                        </h3>
                        <p className="text-secondary">
                            Crafting happiness, one delicious slice at a time.
                            Fresh ingredients, fast delivery!
                        </p>
                    </div>

                    {/* Quick Links */}
                    <div className="col-lg-2 col-md-6">
                        <h5 className="text-white mb-3">Quick Links</h5>
                        <ul className="list-unstyled">
                            <li className="mb-2"><Link to="/menu" className="text-secondary text-decoration-none">Menu</Link></li>
                            <li className="mb-2"><Link to="/customize" className="text-secondary text-decoration-none">Build Your Pizza</Link></li>
                            <li className="mb-2"><Link to="/deals" className="text-secondary text-decoration-none">Deals</Link></li>
                            <li><Link to="/myorders" className="text-secondary text-decoration-none">My Orders</Link></li>
                        </ul>
                    </div>

                    {/* Contact */}
                    <div className="col-lg-3 col-md-6">
                        <h5 className="text-white mb-3">Contact Us</h5>
                        <p className="mb-1 text-secondary">
                            <i className="bi bi-telephone-fill me-2"></i> +880 123 456 789
                        </p>
                        <p className="mb-1 text-secondary">
                            <i className="bi bi-envelope-fill me-2"></i> hello@pizzafizz.com
                        </p>
                        <p className="text-secondary">
                            <i className="bi bi-geo-alt-fill me-2"></i> Dhaka, Bangladesh
                        </p>
                    </div>

                    {/* Social & Newsletter */}
                    <div className="col-lg-3 col-md-6">
                        <h5 className="text-white mb-3">Follow Us</h5>
                        <div className="d-flex gap-3 fs-3 mb-4">
                            <a href="#" className="text-warning"><i className="bi bi-facebook"></i></a>
                            <a href="#" className="text-warning"><i className="bi bi-instagram"></i></a>
                            <a href="#" className="text-warning"><i className="bi bi-twitter-x"></i></a>
                            <a href="#" className="text-warning"><i className="bi bi-youtube"></i></a>
                        </div>

                        <h6 className="text-white">Stay Updated</h6>
                        <div className="input-group">
                            <input type="email" className="form-control" placeholder="Your email" />
                            <button className="btn btn-warning">Subscribe</button>
                        </div>
                    </div>
                </div>

                <hr className="border-secondary my-4" />
                <div className="text-center text-secondary small">
                    © 2026 PizzaFizz. All rights reserved. Made with ❤️ for pizza lovers.
                </div>
            </div>
        </footer>
    );
};

export default Footer;
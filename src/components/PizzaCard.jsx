function PizzaCard({ name, price, image }) {
    return (
        <div className="card" style={{ width: "18rem" }}>
            <img src={image} className="card-img-top" alt={name} />
            <div className="card-body text-center">
                <h5 className="card-title">{name}</h5>
                <p className="card-text">${price}</p>
                <button className="btn btn-danger">Add to Cart</button>
            </div>
        </div>
    );
}

export default PizzaCard;

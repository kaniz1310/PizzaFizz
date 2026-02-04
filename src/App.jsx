import Navbar from "./components/Navbar";
import Banner from "./components/Banner";
import PizzaCard from "./components/PizzaCard";

import pizza1 from "./assets/pizza1.jpg";
import pizza2 from "./assets/pizza2.jpg";
import pizza3 from "./assets/pizza3.jpg";

function App() {
  return (
    <>
      <Navbar />
      <Banner />

      <div className="container my-5">
        <h2 className="text-center mb-4 fw-bold">
          Top 3 Pizzas 🍕
        </h2>

        <div className="d-flex justify-content-center gap-4 flex-wrap">
          <PizzaCard name="Pepperoni Pizza" price="12" image={pizza1} />
          <PizzaCard name="Cheese Burst" price="10" image={pizza2} />
          <PizzaCard name="Veg Supreme" price="9" image={pizza3} />
        </div>
      </div>

      <div className="text-center mb-5">
        <button className="btn btn-lg btn-outline-dark">
          View Full Menu
        </button>
      </div>
    </>
  );
}

export default App;

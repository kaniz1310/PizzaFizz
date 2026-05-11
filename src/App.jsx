// src/App.jsx
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { CartProvider } from "./Context/CartContext";

import Navbar from "./components/Navbar";
import Home from "./Pages/Home";
import Login from "./Pages/Login";
import Register from "./Pages/Register";
import ForgotPassword from "./Pages/ForgotPassword";
import AdminPanel from "./Pages/AdminPanel";
import CustomizePizza from "./Pages/CustomizePizza";
import Cart from "./Pages/Cart";
import Confirm from "./Pages/Confirm";
import MyOrders from "./Pages/MyOrders";
import Menu from "./Pages/Menu";
function App() {
  return (
    <BrowserRouter>
      <CartProvider>
        <Navbar />
        <Routes>
          {/* Public */}
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot" element={<ForgotPassword />} />

          <Route path="/menu" element={<Menu />} />
          {/* Pizza flow */}
          <Route path="/customize" element={<CustomizePizza />} />
          <Route path="/cart" element={<Cart />} />
          <Route path="/confirm" element={<Confirm />} />

          {/* Customer */}
          <Route path="/my-orders" element={<MyOrders />} />

          {/* Owner */}
          <Route path="/admin" element={<AdminPanel />} />
        </Routes>
      </CartProvider>
    </BrowserRouter>
  );
}

export default App;
// src/App.jsx
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { CartProvider } from "./Context/CartContext";

import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import Home from "./Pages/Home";
import Login from "./Pages/Login";
import Register from "./Pages/Register";
import ForgotPassword from "./Pages/ForgotPassword";
import CustomizePizza from "./Pages/CustomizePizza";
import Cart from "./Pages/Cart";
import Confirm from "./Pages/Confirm";
import MyOrders from "./Pages/MyOrders";
import Menu from "./Pages/Menu";

import AdminPanel from "./Pages/AdminPanel";
import Riderdashboard from "./Pages/Riderdashboard";
import Trackorder from "./Pages/Trackorder";



// ── Route guard: redirect if not the right role ──────
function RoleRoute({ role, children }) {
  const user = JSON.parse(localStorage.getItem("user") || "null");
  if (!user) return <Navigate to="/login" replace />;
  if (role && user.role !== role && user.role !== "admin") {
    // Redirect each role to their home
    if (user.role === "rider") return <Navigate to="/rider/dashboard" replace />;
    if (user.role === "owner") return <Navigate to="/admin" replace />;
    return <Navigate to="/" replace />;
  }
  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <CartProvider>
        <Navbar />
        <Routes>

          {/* ── Public ── */}
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot" element={<ForgotPassword />} />
          <Route path="/menu" element={<Menu />} />

          {/* ── Customer ── */}
          <Route path="/customize" element={<CustomizePizza />} />
          <Route path="/cart" element={<Cart />} />
          <Route path="/confirm" element={<Confirm />} />
          <Route path="/my-orders" element={<MyOrders />} />
          <Route path="/track/:orderId" element={<Trackorder />} />

          {/* ── Owner ── */}
          <Route path="/admin" element={
            <RoleRoute role="owner"><AdminPanel /></RoleRoute>
          } />

          {/* ── Rider ── */}
          <Route path="/rider/dashboard" element={
            <RoleRoute role="rider"><Riderdashboard /></RoleRoute>
          } />

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/" replace />} />

        </Routes>
        <Footer />
      </CartProvider>
    </BrowserRouter>
  );
}
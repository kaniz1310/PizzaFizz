# pizza-backend/main.py
# Full PizzaFizz backend with Rider Delivery System

from fastapi import FastAPI, HTTPException, Depends, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from typing import Optional, List
import sqlite3
import uuid
import bcrypt
import jwt
import os
import json
import base64
import requests
from datetime import datetime, timedelta
from dotenv import load_dotenv

load_dotenv()

SECRET_KEY = os.getenv("SECRET_KEY", "pizzafizz-secret-key")
DB_PATH = "pizzafizz.db"
security = HTTPBearer()

app = FastAPI(title="PizzaFizz API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ══════════════════════════════════════════════════════
#  WEBSOCKET MANAGER
# ══════════════════════════════════════════════════════
class ConnectionManager:
    def __init__(self):
        self.active: list = []

    async def connect(self, ws: WebSocket):
        await ws.accept()
        self.active.append(ws)

    def disconnect(self, ws: WebSocket):
        if ws in self.active:
            self.active.remove(ws)

    async def broadcast(self, message: dict):
        dead = []
        for ws in self.active:
            try:
                await ws.send_json(message)
            except:
                dead.append(ws)
        for ws in dead:
            self.disconnect(ws)


manager = ConnectionManager()


# ══════════════════════════════════════════════════════
#  DATABASE
# ══════════════════════════════════════════════════════
def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_db()
    c = conn.cursor()

    # Users table (customers + owners + riders)
    c.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id       TEXT PRIMARY KEY,
            name     TEXT NOT NULL,
            email    TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            phone    TEXT,
            address  TEXT,
            role     TEXT DEFAULT 'customer',
            lat      REAL DEFAULT 23.8103,
            lng      REAL DEFAULT 90.4125,
            is_available INTEGER DEFAULT 1
        )
    """)

    # Orders table
    c.execute("""
        CREATE TABLE IF NOT EXISTS orders (
            id               TEXT PRIMARY KEY,
            user_id          TEXT,
            customer_name    TEXT,
            customer_email   TEXT,
            customer_address TEXT,
            customer_phone   TEXT,
            customer_lat     REAL DEFAULT 23.8103,
            customer_lng     REAL DEFAULT 90.4125,
            items            TEXT,
            subtotal         REAL,
            delivery         REAL DEFAULT 50,
            total            REAL,
            status           TEXT DEFAULT 'New',
            rider_id         TEXT DEFAULT NULL,
            rider_name       TEXT DEFAULT NULL,
            created_at       TEXT
        )
    """)

    # Rider earnings table
    c.execute("""
        CREATE TABLE IF NOT EXISTS rider_earnings (
            id         TEXT PRIMARY KEY,
            rider_id   TEXT,
            order_id   TEXT,
            amount     REAL,
            created_at TEXT
        )
    """)

    # Seed demo accounts
    if c.execute("SELECT COUNT(*) FROM users").fetchone()[0] == 0:
        accounts = [
            ("customer@pizza.com", "Demo Customer", "pizza123", "customer",
             "+880170000001", "123, Gulshan, Dhaka", 23.7937, 90.4066),
            ("owner@pizza.com", "Pizza Owner", "owner123", "owner",
             "+880170000002", "PizzaFizz HQ, Banani, Dhaka", 23.7945, 90.4017),
            ("rider@pizza.com", "Demo Rider", "rider123", "rider",
             "+880170000003", "Mohakhali, Dhaka", 23.7830, 90.4050),
            ("rider2@pizza.com", "Karim Rider", "rider123", "rider",
             "+880170000004", "Tejgaon, Dhaka", 23.7693, 90.3986),
        ]
        for email, name, pw, role, phone, addr, lat, lng in accounts:
            h = bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()
            c.execute(
                "INSERT INTO users VALUES (?,?,?,?,?,?,?,?,?,?)",
                (str(uuid.uuid4()), name, email, h, phone, addr, role, lat, lng, 1)
            )

    conn.commit()
    conn.close()


# ══════════════════════════════════════════════════════
#  JWT
# ══════════════════════════════════════════════════════
def create_token(uid: str) -> str:
    return jwt.encode(
        {"sub": uid, "exp": datetime.utcnow() + timedelta(hours=24)},
        SECRET_KEY, algorithm="HS256"
    )


def get_current_user(creds: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = jwt.decode(creds.credentials, SECRET_KEY,
                             algorithms=["HS256"])
    except jwt.ExpiredSignatureError:
        raise HTTPException(401, "Session expired.")
    except jwt.InvalidTokenError:
        raise HTTPException(401, "Invalid token.")
    conn = get_db()
    row = conn.execute("SELECT * FROM users WHERE id=?",
                       (payload["sub"],)).fetchone()
    conn.close()
    if not row:
        raise HTTPException(401, "User not found.")
    return dict(row)


def require_owner(user=Depends(get_current_user)):
    if user["role"] not in ("owner", "admin"):
        raise HTTPException(403, "Owner access only.")
    return user


def require_rider(user=Depends(get_current_user)):
    if user["role"] != "rider":
        raise HTTPException(403, "Rider access only.")
    return user


def safe_user(u):
    return {k: v for k, v in u.items() if k != "password"}


# ══════════════════════════════════════════════════════
#  PYDANTIC MODELS
# ══════════════════════════════════════════════════════
class RegisterBody(BaseModel):
    name: str
    email: str
    password: str
    phone: str
    address: str
    role: Optional[str] = "customer"
    lat:  Optional[float] = 23.8103
    lng:  Optional[float] = 90.4125


class LoginBody(BaseModel):
    email: str
    password: str


class VerifyPhoneBody(BaseModel):
    email: str
    phone: str


class ResetPasswordBody(BaseModel):
    email: str
    phone: str
    new_password: str


class ToppingItem(BaseModel):
    label: str
    icon:  Optional[str] = ""
    price: Optional[float] = 0


class OrderItem(BaseModel):
    name:     Optional[str] = ""
    size:     str
    crust: str
    sauce: str
    toppings: Optional[List[ToppingItem]] = []
    price:    float
    qty: int = 1


class OrderBody(BaseModel):
    items:       List[OrderItem]
    subtotal:    float
    total:       float
    customer_lat: Optional[float] = 23.8103
    customer_lng: Optional[float] = 90.4125


class StatusBody(BaseModel):
    status: str


class AssignRiderBody(BaseModel):
    order_id:  str
    rider_id:  str


class LocationBody(BaseModel):
    lat: float
    lng: float


class AvailabilityBody(BaseModel):
    is_available: bool


class PizzaImageBody(BaseModel):
    crust:    Optional[str] = ""
    sauce:    Optional[str] = ""
    toppings: Optional[List[str]] = []


# ══════════════════════════════════════════════════════
#  ROUTES
# ══════════════════════════════════════════════════════

@app.get("/")
def home():
    return {"message": "PizzaFizz API running 🍕"}


# ── Auth ──────────────────────────────────────────────

@app.post("/register")
def register(body: RegisterBody):
    email = body.email.lower().strip()
    conn = get_db()
    if conn.execute("SELECT id FROM users WHERE email=?", (email,)).fetchone():
        conn.close()
        raise HTTPException(409, "Email already registered.")
    uid = str(uuid.uuid4())
    h = bcrypt.hashpw(body.password.encode(), bcrypt.gensalt()).decode()
    role = body.role if body.role in ("customer", "rider") else "customer"
    conn.execute(
        "INSERT INTO users VALUES (?,?,?,?,?,?,?,?,?,?)",
        (uid, body.name, email, h, body.phone, body.address,
         role, body.lat, body.lng, 1)
    )
    conn.commit()
    user = dict(conn.execute(
        "SELECT * FROM users WHERE id=?", (uid,)).fetchone())
    conn.close()
    return {"token": create_token(uid), "user": safe_user(user)}


@app.post("/login")
def login(body: LoginBody):
    email = body.email.lower().strip()
    conn = get_db()
    row = conn.execute("SELECT * FROM users WHERE email=?",
                       (email,)).fetchone()
    conn.close()
    if not row or not bcrypt.checkpw(body.password.encode(), row["password"].encode()):
        raise HTTPException(401, "Invalid email or password.")
    return {"token": create_token(dict(row)["id"]), "user": safe_user(dict(row))}


@app.get("/me")
def get_me(current_user=Depends(get_current_user)):
    return {"user": safe_user(current_user)}


# ── Forgot password ───────────────────────────────────

@app.post("/forgot/verify-phone")
def verify_phone(body: VerifyPhoneBody):
    email = body.email.lower().strip()
    conn = get_db()
    row = conn.execute("SELECT * FROM users WHERE email=?",
                       (email,)).fetchone()
    conn.close()
    if not row:
        raise HTTPException(404, "No account found with this email.")
    if (row["phone"] or "").replace(" ", "") != body.phone.strip().replace(" ", ""):
        raise HTTPException(400, "Phone number does not match.")
    return {"verified": True, "name": row["name"], "email": email}


@app.post("/forgot/reset-password")
def reset_password(body: ResetPasswordBody):
    if len(body.new_password) < 6:
        raise HTTPException(400, "Password must be at least 6 characters.")
    email = body.email.lower().strip()
    conn = get_db()
    row = conn.execute("SELECT * FROM users WHERE email=?",
                       (email,)).fetchone()
    if not row:
        conn.close()
        raise HTTPException(404, "Account not found.")
    if (row["phone"] or "").replace(" ", "") != body.phone.strip().replace(" ", ""):
        conn.close()
        raise HTTPException(400, "Verification failed.")
    h = bcrypt.hashpw(body.new_password.encode(), bcrypt.gensalt()).decode()
    conn.execute("UPDATE users SET password=? WHERE email=?", (h, email))
    conn.commit()
    conn.close()
    return {"message": "Password reset successfully!"}


# ── Orders ────────────────────────────────────────────

@app.post("/orders")
async def place_order(body: OrderBody, current_user=Depends(get_current_user)):
    oid = "PF-" + str(uuid.uuid4())[:6].upper()
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    items_json = json.dumps([
        {"name": i.name, "size": i.size, "crust": i.crust, "sauce": i.sauce,
         "toppings": [t.dict() for t in i.toppings], "price": i.price, "qty": i.qty}
        for i in body.items
    ])
    conn = get_db()
    conn.execute(
        """INSERT INTO orders VALUES
           (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
        (oid, current_user["id"], current_user["name"], current_user["email"],
         current_user["address"], current_user["phone"],
         body.customer_lat, body.customer_lng,
         items_json, body.subtotal, 50, body.total,
         "New", None, None, now)
    )
    conn.commit()
    order = dict(conn.execute(
        "SELECT * FROM orders WHERE id=?", (oid,)).fetchone())
    conn.close()
    order["items"] = json.loads(order["items"])
    await manager.broadcast({"type": "NEW_ORDER", "order": order})
    return {"message": "Order placed!", "order": order}


@app.get("/orders")
def get_orders(current_user=Depends(get_current_user)):
    conn = get_db()
    if current_user["role"] in ("owner", "admin"):
        rows = conn.execute(
            "SELECT * FROM orders ORDER BY created_at DESC").fetchall()
    elif current_user["role"] == "rider":
        # Rider sees orders assigned to them
        rows = conn.execute(
            "SELECT * FROM orders WHERE rider_id=? ORDER BY created_at DESC",
            (current_user["id"],)
        ).fetchall()
    else:
        rows = conn.execute(
            "SELECT * FROM orders WHERE user_id=? ORDER BY created_at DESC",
            (current_user["id"],)
        ).fetchall()
    conn.close()
    result = []
    for row in rows:
        o = dict(row)
        o["items"] = json.loads(o["items"])
        result.append(o)
    return result


@app.patch("/orders/{order_id}/status")
async def update_status(order_id: str, body: StatusBody, current_user=Depends(get_current_user)):
    valid = ["New", "Making", "Ready", "Out for Delivery", "Delivered"]
    if body.status not in valid:
        raise HTTPException(400, f"Status must be one of {valid}")

    # Riders can only update their assigned orders to Out for Delivery or Delivered
    if current_user["role"] == "rider":
        conn = get_db()
        order = conn.execute(
            "SELECT * FROM orders WHERE id=?", (order_id,)).fetchone()
        if not order or order["rider_id"] != current_user["id"]:
            conn.close()
            raise HTTPException(403, "Not your order.")
        conn.close()
    elif current_user["role"] not in ("owner", "admin"):
        raise HTTPException(403, "Not authorized.")

    conn = get_db()
    r = conn.execute("UPDATE orders SET status=? WHERE id=?",
                     (body.status, order_id))
    conn.commit()
    if r.rowcount == 0:
        conn.close()
        raise HTTPException(404, "Order not found.")
    order = dict(conn.execute(
        "SELECT * FROM orders WHERE id=?", (order_id,)).fetchone())
    conn.close()
    order["items"] = json.loads(order["items"])

    await manager.broadcast({
        "type": "ORDER_UPDATE", "order_id": order_id,
        "status": body.status, "order": order
    })
    return {"message": "Status updated", "order": order}


# ── Rider system ──────────────────────────────────────

@app.get("/riders")
def get_riders(current_user=Depends(require_owner)):
    """Owner gets list of all available riders."""
    conn = get_db()
    rows = conn.execute(
        "SELECT * FROM users WHERE role='rider' ORDER BY name"
    ).fetchall()
    conn.close()
    return [safe_user(dict(r)) for r in rows]


@app.post("/orders/{order_id}/assign-rider")
async def assign_rider(order_id: str, body: AssignRiderBody, current_user=Depends(require_owner)):
    """
    Owner assigns a rider to a Ready order.
    Status automatically changes to 'Out for Delivery'.
    """
    conn = get_db()
    rider = conn.execute("SELECT * FROM users WHERE id=? AND role='rider'",
                         (body.rider_id,)).fetchone()
    if not rider:
        conn.close()
        raise HTTPException(404, "Rider not found.")

    conn.execute(
        "UPDATE orders SET rider_id=?, rider_name=?, status=? WHERE id=?",
        (body.rider_id, rider["name"], "Out for Delivery", order_id)
    )
    conn.commit()
    order = dict(conn.execute(
        "SELECT * FROM orders WHERE id=?", (order_id,)).fetchone())
    conn.close()
    order["items"] = json.loads(order["items"])

    # Notify everyone — rider gets new delivery, customer sees status update
    await manager.broadcast({
        "type":       "RIDER_ASSIGNED",
        "order_id":   order_id,
        "rider_name": rider["name"],
        "order":      order,
    })
    return {"message": f"Rider {rider['name']} assigned!", "order": order}


@app.get("/rider/orders")
def get_rider_orders(current_user=Depends(require_rider)):
    """Rider sees their assigned deliveries."""
    conn = get_db()
    rows = conn.execute(
        "SELECT * FROM orders WHERE rider_id=? ORDER BY created_at DESC",
        (current_user["id"],)
    ).fetchall()
    conn.close()
    result = []
    for row in rows:
        o = dict(row)
        o["items"] = json.loads(o["items"])
        result.append(o)
    return result


@app.post("/rider/complete/{order_id}")
async def complete_delivery(order_id: str, current_user=Depends(require_rider)):
    """Rider marks delivery as complete. Earnings recorded."""
    conn = get_db()
    order = conn.execute("SELECT * FROM orders WHERE id=?",
                         (order_id,)).fetchone()
    if not order:
        conn.close()
        raise HTTPException(404, "Order not found.")
    if order["rider_id"] != current_user["id"]:
        conn.close()
        raise HTTPException(403, "Not your delivery.")

    # Mark delivered
    conn.execute(
        "UPDATE orders SET status='Delivered' WHERE id=?", (order_id,))

    # Record earnings (10% of order total)
    earning = round(float(order["total"]) * 0.10, 2)
    conn.execute(
        "INSERT INTO rider_earnings VALUES (?,?,?,?,?)",
        (str(uuid.uuid4()), current_user["id"], order_id,
         earning, datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
    )
    conn.commit()

    updated = dict(conn.execute(
        "SELECT * FROM orders WHERE id=?", (order_id,)).fetchone())
    conn.close()
    updated["items"] = json.loads(updated["items"])

    await manager.broadcast({
        "type":     "ORDER_UPDATE",
        "order_id": order_id,
        "status":   "Delivered",
        "order":    updated,
    })
    return {"message": "Delivery completed! ৳" + str(earning) + " earned.", "earning": earning}


@app.patch("/rider/location")
async def update_rider_location(body: LocationBody, current_user=Depends(require_rider)):
    """Rider updates their GPS location. Broadcast to all (customer tracking)."""
    conn = get_db()
    conn.execute("UPDATE users SET lat=?, lng=? WHERE id=?",
                 (body.lat, body.lng, current_user["id"]))
    conn.commit()
    conn.close()

    await manager.broadcast({
        "type":     "RIDER_LOCATION",
        "rider_id": current_user["id"],
        "name":     current_user["name"],
        "lat":      body.lat,
        "lng":      body.lng,
    })
    return {"message": "Location updated"}


@app.patch("/rider/availability")
def set_availability(body: AvailabilityBody, current_user=Depends(require_rider)):
    """Rider toggles online/offline status."""
    conn = get_db()
    conn.execute("UPDATE users SET is_available=? WHERE id=?",
                 (1 if body.is_available else 0, current_user["id"]))
    conn.commit()
    conn.close()
    return {"message": "Availability updated", "is_available": body.is_available}


@app.get("/rider/earnings")
def get_rider_earnings(current_user=Depends(require_rider)):
    """Rider sees their total and recent earnings."""
    conn = get_db()
    rows = conn.execute(
        "SELECT * FROM rider_earnings WHERE rider_id=? ORDER BY created_at DESC",
        (current_user["id"],)
    ).fetchall()
    total = conn.execute(
        "SELECT COALESCE(SUM(amount),0) FROM rider_earnings WHERE rider_id=?",
        (current_user["id"],)
    ).fetchone()[0]
    today = datetime.now().strftime("%Y-%m-%d")
    today_earn = conn.execute(
        "SELECT COALESCE(SUM(amount),0) FROM rider_earnings WHERE rider_id=? AND created_at LIKE ?",
        (current_user["id"], today + "%")
    ).fetchone()[0]
    deliveries = conn.execute(
        "SELECT COUNT(*) FROM orders WHERE rider_id=? AND status='Delivered'",
        (current_user["id"],)
    ).fetchone()[0]
    conn.close()
    return {
        "total":       round(total, 2),
        "today":       round(today_earn, 2),
        "deliveries":  deliveries,
        "recent":      [dict(r) for r in rows[:10]],
    }


@app.get("/delivery/track/{order_id}")
def track_order(order_id: str, current_user=Depends(get_current_user)):
    """Customer tracks their order + rider location."""
    conn = get_db()
    order = conn.execute("SELECT * FROM orders WHERE id=?",
                         (order_id,)).fetchone()
    if not order:
        conn.close()
        raise HTTPException(404, "Order not found.")

    order = dict(order)
    order["items"] = json.loads(order["items"])

    rider_location = None
    if order["rider_id"]:
        rider = conn.execute(
            "SELECT id, name, phone, lat, lng, is_available FROM users WHERE id=?",
            (order["rider_id"],)
        ).fetchone()
        if rider:
            rider_location = dict(rider)

    conn.close()
    return {"order": order, "rider": rider_location}


# ── Stats ─────────────────────────────────────────────

@app.get("/stats")
def get_stats(current_user=Depends(require_owner)):
    conn = get_db()
    total = conn.execute("SELECT COUNT(*) FROM orders").fetchone()[0]
    revenue = conn.execute(
        "SELECT COALESCE(SUM(total),0) FROM orders").fetchone()[0]
    new_count = conn.execute(
        "SELECT COUNT(*) FROM orders WHERE status='New'").fetchone()[0]
    making = conn.execute(
        "SELECT COUNT(*) FROM orders WHERE status='Making'").fetchone()[0]
    ready = conn.execute(
        "SELECT COUNT(*) FROM orders WHERE status='Ready'").fetchone()[0]
    delivering = conn.execute(
        "SELECT COUNT(*) FROM orders WHERE status='Out for Delivery'").fetchone()[0]
    riders = conn.execute(
        "SELECT COUNT(*) FROM users WHERE role='rider' AND is_available=1").fetchone()[0]
    all_items = conn.execute("SELECT items FROM orders").fetchall()
    conn.close()
    pizza_count = sum(
        item.get("qty", 1)
        for row in all_items
        for item in json.loads(row[0])
    )
    return {
        "totalOrders":  total,
        "revenue":      int(revenue),
        "newOrders":    new_count,
        "making":       making,
        "ready":        ready,
        "delivering":   delivering,
        "pizzasMade":   pizza_count,
        "availableRiders": riders,
    }


# ── AI Image ──────────────────────────────────────────

@app.post("/generate")
def generate(data: PizzaImageBody):
    try:
        prompt = f"realistic pizza, {data.crust} crust, {data.sauce} sauce, {', '.join(data.toppings or [])}, top view"
        response = requests.get(
            f"https://image.pollinations.ai/prompt/{prompt}", timeout=30)
        if response.status_code != 200:
            raise HTTPException(502, "AI failed.")
        return {"image": base64.b64encode(response.content).decode()}
    except:
        raise HTTPException(500, "Image generation failed.")


# ── WebSocket ─────────────────────────────────────────

@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    await manager.connect(ws)
    try:
        while True:
            await ws.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(ws)


# ── Startup ───────────────────────────────────────────
init_db()
print("🍕  PizzaFizz API        →  http://localhost:8000")
print("🚚  Rider system active")
print("📦  Database             →  pizzafizz.db")
print("📖  API Docs             →  http://localhost:8000/docs")

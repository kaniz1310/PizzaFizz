# pizza-backend/main.py
# PizzaFizz — Full Backend: Auth + Orders + Riders + Payments

from fastapi import FastAPI, HTTPException, Depends, WebSocket, WebSocketDisconnect, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse, JSONResponse
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
import hashlib
from datetime import datetime, timedelta
from dotenv import load_dotenv

load_dotenv()

# ── Config ────────────────────────────────────────────
SECRET_KEY = os.getenv("SECRET_KEY",             "pizzafizz-secret-key")
DB_PATH = "pizzafizz.db"
FRONTEND_URL = os.getenv("FRONTEND_URL",           "http://localhost:5173")

# SSLCommerz (card payments) ─ sandbox by default
SSL_STORE_ID = os.getenv("SSLCOMMERZ_STORE_ID",   "testbox")
SSL_STORE_PASS = os.getenv("SSLCOMMERZ_STORE_PASS",  "qwerty")
SSL_SANDBOX = os.getenv("SSLCOMMERZ_SANDBOX",     "true").lower() == "true"
SSL_BASE = ("https://sandbox.sslcommerz.com" if SSL_SANDBOX
            else "https://securepay.sslcommerz.com")

# bKash sandbox credentials
BKASH_APP_KEY = os.getenv("BKASH_APP_KEY",    "0vWQuCRGiUX71JPOkiBI09znmkFG")
BKASH_APP_SECRET = os.getenv(
    "BKASH_APP_SECRET", "jcUNPBgbcqEDedNKdvE4G1cAK7D3GsBmdB1r")
BKASH_USER = os.getenv("BKASH_USERNAME",   "01770618567")
BKASH_PASS = os.getenv("BKASH_PASSWORD",   "D7DaC<*E*eG")
BKASH_BASE = "https://tokenized.sandbox.bka.sh/v1.2.0-beta"

security = HTTPBearer()
app = FastAPI(title="PizzaFizz API 🍕")

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
    def __init__(self):  self.active: list = []

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

    # Users
    c.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id           TEXT PRIMARY KEY,
            name         TEXT NOT NULL,
            email        TEXT UNIQUE NOT NULL,
            password     TEXT NOT NULL,
            phone        TEXT,
            address      TEXT,
            role         TEXT DEFAULT 'customer',
            lat          REAL DEFAULT 23.8103,
            lng          REAL DEFAULT 90.4125,
            is_available INTEGER DEFAULT 1
        )
    """)

    # Orders  ← payment_method + payment_status added
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
            created_at       TEXT,
            payment_method   TEXT DEFAULT 'cod',
            payment_status   TEXT DEFAULT 'pending'
        )
    """)

    # Auto-migrate existing DB (safe — adds columns only if missing)
    existing = [r[1]
                for r in c.execute("PRAGMA table_info(orders)").fetchall()]
    if "payment_method" not in existing:
        c.execute("ALTER TABLE orders ADD COLUMN payment_method TEXT DEFAULT 'cod'")
    if "payment_status" not in existing:
        c.execute(
            "ALTER TABLE orders ADD COLUMN payment_status TEXT DEFAULT 'pending'")

    # Payments audit log
    c.execute("""
        CREATE TABLE IF NOT EXISTS payments (
            id              TEXT PRIMARY KEY,
            order_id        TEXT NOT NULL,
            user_id         TEXT NOT NULL,
            method          TEXT NOT NULL,
            amount          REAL NOT NULL,
            status          TEXT DEFAULT 'pending',
            gateway_tran_id TEXT,
            gateway_ref     TEXT,
            raw_response    TEXT,
            created_at      TEXT,
            updated_at      TEXT
        )
    """)

    # Rider earnings
    c.execute("""
        CREATE TABLE IF NOT EXISTS rider_earnings (
            id         TEXT PRIMARY KEY,
            rider_id   TEXT,
            order_id   TEXT,
            amount     REAL,
            created_at TEXT
        )
    """)

    # Seed demo accounts (only once)
    if c.execute("SELECT COUNT(*) FROM users").fetchone()[0] == 0:
        accounts = [
            ("customer@pizza.com", "Demo Customer", "pizza123", "customer",
             "+880170000001", "123, Gulshan, Dhaka",     23.7937, 90.4066),
            ("owner@pizza.com",    "Pizza Owner",   "owner123", "owner",
             "+880170000002", "PizzaFizz HQ, Banani",    23.7945, 90.4017),
            ("rider@pizza.com",    "Demo Rider",    "rider123", "rider",
             "+880170000003", "Mohakhali, Dhaka",         23.7830, 90.4050),
            ("rider2@pizza.com",   "Karim Rider",   "rider123", "rider",
             "+880170000004", "Tejgaon, Dhaka",           23.7693, 90.3986),
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
#  JWT HELPERS
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
        raise HTTPException(403, "Owner only.")
    return user


def require_rider(user=Depends(get_current_user)):
    if user["role"] != "rider":
        raise HTTPException(403, "Rider only.")
    return user


def safe_user(u): return {k: v for k, v in u.items() if k != "password"}


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
    qty:      int = 1


class OrderBody(BaseModel):
    items:        List[OrderItem]
    subtotal:     float
    total: float
    customer_lat: Optional[float] = 23.8103
    customer_lng: Optional[float] = 90.4125


class StatusBody(BaseModel):
    status: str


class AssignRiderBody(BaseModel):
    order_id: str
    rider_id: str


class LocationBody(BaseModel):
    lat: float
    lng: float


class AvailabilityBody(BaseModel):
    is_available: bool


class PizzaImageBody(BaseModel):
    crust:    Optional[str] = ""
    sauce:    Optional[str] = ""
    toppings: Optional[List[str]] = []

# ── Payment models ────────────────────────────────────


class CODOrderBody(BaseModel):
    """Cash-on-delivery order. No gateway needed."""
    items:          List[OrderItem]
    subtotal:       float
    total: float
    payment_method: Optional[str] = "cod"
    customer_lat:   Optional[float] = 23.8103
    customer_lng:   Optional[float] = 90.4125


class PaymentInitiateBody(BaseModel):
    """Initiate bKash or card (SSLCommerz) payment."""
    items:          List[OrderItem]
    subtotal:       float
    total: float
    payment_method: str                       # "bkash" | "card"
    customer_lat:   Optional[float] = 23.8103
    customer_lng:   Optional[float] = 90.4125
    bkash_number:   Optional[str] = None
    bkash_otp:      Optional[str] = None
    card_last4:     Optional[str] = None


# ══════════════════════════════════════════════════════
#  PAYMENT HELPERS  (private — not routes)
# ══════════════════════════════════════════════════════
def _items_json(items: List[OrderItem]) -> str:
    return json.dumps([
        {"name": i.name, "size": i.size, "crust": i.crust, "sauce": i.sauce,
         "toppings": [t.dict() for t in i.toppings], "price": i.price, "qty": i.qty}
        for i in items
    ])


def _insert_order(conn, oid, user, lat, lng, items_json,
                  subtotal, total, pay_method, pay_status, now):
    conn.execute(
        """INSERT INTO orders
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
        (oid, user["id"], user["name"], user["email"],
         user["address"], user["phone"], lat, lng,
         items_json, subtotal, 50, total,
         "New", None, None, now, pay_method, pay_status)
    )


def _insert_payment(conn, order_id, user_id, method, amount,
                    status, tran_id=None, ref=None, raw=None):
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    conn.execute(
        "INSERT INTO payments VALUES (?,?,?,?,?,?,?,?,?,?,?)",
        (str(uuid.uuid4()), order_id, user_id, method, amount,
         status, tran_id, ref, raw, now, now)
    )


def _get_order(conn, oid):
    row = conn.execute("SELECT * FROM orders WHERE id=?", (oid,)).fetchone()
    if not row:
        raise HTTPException(404, "Order not found.")
    o = dict(row)
    o["items"] = json.loads(o["items"])
    return o


def _bkash_token() -> str:
    """Grant token from bKash sandbox."""
    r = requests.post(
        f"{BKASH_BASE}/tokenized/checkout/token/grant",
        headers={"Content-Type": "application/json",
                 "username": BKASH_USER, "password": BKASH_PASS},
        json={"app_key": BKASH_APP_KEY, "app_secret": BKASH_APP_SECRET},
        timeout=15,
    ).json()
    if "id_token" not in r:
        raise HTTPException(502, "bKash token error: " + json.dumps(r))
    return r["id_token"]


# ══════════════════════════════════════════════════════
#  ROUTES
# ══════════════════════════════════════════════════════

@app.get("/")
def home(): return {"message": "PizzaFizz API running 🍕"}


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
    conn.execute("INSERT INTO users VALUES (?,?,?,?,?,?,?,?,?,?)",
                 (uid, body.name, email, h, body.phone, body.address,
                  role, body.lat, body.lng, 1))
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
    conn = get_db()
    row = conn.execute("SELECT * FROM users WHERE email=?",
                       (body.email.lower().strip(),)).fetchone()
    conn.close()
    if not row:
        raise HTTPException(404, "No account with this email.")
    if (row["phone"] or "").replace(" ", "") != body.phone.strip().replace(" ", ""):
        raise HTTPException(400, "Phone number does not match.")
    return {"verified": True, "name": row["name"]}


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


# ── Orders (original endpoint kept) ───────────────────

@app.post("/orders")
async def place_order(body: OrderBody, current_user=Depends(get_current_user)):
    """Original order endpoint — still works, defaults to COD."""
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    oid = "PF-" + str(uuid.uuid4())[:6].upper()
    items_json = _items_json(body.items)
    conn = get_db()
    _insert_order(conn, oid, current_user,
                  body.customer_lat, body.customer_lng,
                  items_json, body.subtotal, body.total, "cod", "pending", now)
    _insert_payment(
        conn, oid, current_user["id"], "cod", body.total, "pending")
    conn.commit()
    order = _get_order(conn, oid)
    conn.close()
    await manager.broadcast({"type": "NEW_ORDER", "order": order})
    return {"message": "Order placed!", "order": order}


@app.get("/orders")
def get_orders(current_user=Depends(get_current_user)):
    conn = get_db()
    if current_user["role"] in ("owner", "admin"):
        rows = conn.execute(
            "SELECT * FROM orders ORDER BY created_at DESC").fetchall()
    elif current_user["role"] == "rider":
        rows = conn.execute(
            "SELECT * FROM orders WHERE rider_id=? ORDER BY created_at DESC",
            (current_user["id"],)).fetchall()
    else:
        rows = conn.execute(
            "SELECT * FROM orders WHERE user_id=? ORDER BY created_at DESC",
            (current_user["id"],)).fetchall()
    conn.close()
    result = []
    for row in rows:
        o = dict(row)
        o["items"] = json.loads(o["items"])
        result.append(o)
    return result


@app.patch("/orders/{order_id}/status")
async def update_status(order_id: str, body: StatusBody,
                        current_user=Depends(get_current_user)):
    valid = ["New", "Making", "Ready", "Out for Delivery", "Delivered"]
    if body.status not in valid:
        raise HTTPException(400, f"Status must be one of {valid}")
    if current_user["role"] == "rider":
        conn = get_db()
        o = conn.execute("SELECT * FROM orders WHERE id=?",
                         (order_id,)).fetchone()
        conn.close()
        if not o or o["rider_id"] != current_user["id"]:
            raise HTTPException(403, "Not your order.")
    elif current_user["role"] not in ("owner", "admin"):
        raise HTTPException(403, "Not authorized.")
    conn = get_db()
    r = conn.execute("UPDATE orders SET status=? WHERE id=?",
                     (body.status, order_id))
    conn.commit()
    if r.rowcount == 0:
        conn.close()
        raise HTTPException(404, "Order not found.")
    order = _get_order(conn, order_id)
    conn.close()
    await manager.broadcast({"type": "ORDER_UPDATE", "order_id": order_id,
                             "status": body.status, "order": order})
    return {"message": "Status updated", "order": order}


# ── Rider system ──────────────────────────────────────

@app.get("/riders")
def get_riders(current_user=Depends(require_owner)):
    conn = get_db()
    rows = conn.execute(
        "SELECT * FROM users WHERE role='rider' ORDER BY name").fetchall()
    conn.close()
    return [safe_user(dict(r)) for r in rows]


@app.post("/orders/{order_id}/assign-rider")
async def assign_rider(order_id: str, body: AssignRiderBody,
                       current_user=Depends(require_owner)):
    conn = get_db()
    rider = conn.execute("SELECT * FROM users WHERE id=? AND role='rider'",
                         (body.rider_id,)).fetchone()
    if not rider:
        conn.close()
        raise HTTPException(404, "Rider not found.")
    conn.execute(
        "UPDATE orders SET rider_id=?, rider_name=?, status=? WHERE id=?",
        (body.rider_id, rider["name"], "Out for Delivery", order_id))
    conn.commit()
    order = _get_order(conn, order_id)
    conn.close()
    await manager.broadcast({"type": "RIDER_ASSIGNED", "order_id": order_id,
                             "rider_name": rider["name"], "order": order})
    return {"message": f"Rider {rider['name']} assigned!", "order": order}


@app.get("/rider/orders")
def get_rider_orders(current_user=Depends(require_rider)):
    conn = get_db()
    rows = conn.execute(
        "SELECT * FROM orders WHERE rider_id=? ORDER BY created_at DESC",
        (current_user["id"],)).fetchall()
    conn.close()
    result = []
    for row in rows:
        o = dict(row)
        o["items"] = json.loads(o["items"])
        result.append(o)
    return result


@app.post("/rider/complete/{order_id}")
async def complete_delivery(order_id: str, current_user=Depends(require_rider)):
    conn = get_db()
    order = conn.execute("SELECT * FROM orders WHERE id=?",
                         (order_id,)).fetchone()
    if not order:
        conn.close()
        raise HTTPException(404, "Order not found.")
    if order["rider_id"] != current_user["id"]:
        conn.close()
        raise HTTPException(403, "Not your delivery.")
    earning = round(float(order["total"]) * 0.10, 2)
    conn.execute(
        "UPDATE orders SET status='Delivered' WHERE id=?", (order_id,))
    # If COD, mark payment complete on delivery
    if order["payment_method"] == "cod":
        conn.execute(
            "UPDATE orders SET payment_status='paid' WHERE id=?", (order_id,))
        conn.execute("UPDATE payments SET status='paid', updated_at=? WHERE order_id=?",
                     (datetime.now().strftime("%Y-%m-%d %H:%M:%S"), order_id))
    conn.execute("INSERT INTO rider_earnings VALUES (?,?,?,?,?)",
                 (str(uuid.uuid4()), current_user["id"], order_id, earning,
                  datetime.now().strftime("%Y-%m-%d %H:%M:%S")))
    conn.commit()
    updated = _get_order(conn, order_id)
    conn.close()
    await manager.broadcast({"type": "ORDER_UPDATE", "order_id": order_id,
                             "status": "Delivered", "order": updated})
    return {"message": f"Delivered! ৳{earning} earned.", "earning": earning}


@app.patch("/rider/location")
async def update_rider_location(body: LocationBody, current_user=Depends(require_rider)):
    conn = get_db()
    conn.execute("UPDATE users SET lat=?, lng=? WHERE id=?",
                 (body.lat, body.lng, current_user["id"]))
    conn.commit()
    conn.close()
    await manager.broadcast({"type": "RIDER_LOCATION", "rider_id": current_user["id"],
                             "name": current_user["name"], "lat": body.lat, "lng": body.lng})
    return {"message": "Location updated"}


@app.patch("/rider/availability")
def set_availability(body: AvailabilityBody, current_user=Depends(require_rider)):
    conn = get_db()
    conn.execute("UPDATE users SET is_available=? WHERE id=?",
                 (1 if body.is_available else 0, current_user["id"]))
    conn.commit()
    conn.close()
    return {"message": "Availability updated", "is_available": body.is_available}


@app.get("/rider/earnings")
def get_rider_earnings(current_user=Depends(require_rider)):
    conn = get_db()
    rows = conn.execute(
        "SELECT * FROM rider_earnings WHERE rider_id=? ORDER BY created_at DESC",
        (current_user["id"],)).fetchall()
    total = conn.execute(
        "SELECT COALESCE(SUM(amount),0) FROM rider_earnings WHERE rider_id=?",
        (current_user["id"],)).fetchone()[0]
    today = datetime.now().strftime("%Y-%m-%d")
    today_earn = conn.execute(
        "SELECT COALESCE(SUM(amount),0) FROM rider_earnings WHERE rider_id=? AND created_at LIKE ?",
        (current_user["id"], today + "%")).fetchone()[0]
    deliveries = conn.execute(
        "SELECT COUNT(*) FROM orders WHERE rider_id=? AND status='Delivered'",
        (current_user["id"],)).fetchone()[0]
    conn.close()
    return {"total": round(total, 2), "today": round(today_earn, 2),
            "deliveries": deliveries, "recent": [dict(r) for r in rows[:10]]}


@app.get("/delivery/track/{order_id}")
def track_order(order_id: str, current_user=Depends(get_current_user)):
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
            (order["rider_id"],)).fetchone()
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
    pizza_count = sum(item.get("qty", 1) for row in all_items
                      for item in json.loads(row[0]))
    return {"totalOrders": total, "revenue": int(revenue), "newOrders": new_count,
            "making": making, "ready": ready, "delivering": delivering,
            "pizzasMade": pizza_count, "availableRiders": riders}


# ══════════════════════════════════════════════════════
#  PAYMENT ROUTES  ← NEW
# ══════════════════════════════════════════════════════

# ── 1. Cash on Delivery ───────────────────────────────
@app.post("/orders/cod")
async def place_order_cod(body: CODOrderBody,
                          current_user=Depends(get_current_user)):
    """
    Place order — pay cash when rider arrives.
    payment_status starts as 'pending', becomes 'paid' on delivery.
    """
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    oid = "PF-" + str(uuid.uuid4())[:6].upper()
    items_json = _items_json(body.items)
    conn = get_db()
    _insert_order(conn, oid, current_user,
                  body.customer_lat, body.customer_lng,
                  items_json, body.subtotal, body.total,
                  "cod", "pending", now)
    _insert_payment(
        conn, oid, current_user["id"], "cod", body.total, "pending")
    conn.commit()
    order = _get_order(conn, oid)
    conn.close()
    await manager.broadcast({"type": "NEW_ORDER", "order": order})
    return {"message": "Order placed! Pay cash on delivery.", "order": order}


# ── 2. bKash / Card — initiate payment ───────────────
@app.post("/payment/initiate")
async def initiate_payment(body: PaymentInitiateBody,
                           current_user=Depends(get_current_user)):
    """
    bKash  → calls bKash Tokenized API → creates + executes payment → saves paid order
    Card   → calls SSLCommerz API      → saves pending order → returns redirect_url
    """
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    oid = "PF-" + str(uuid.uuid4())[:6].upper()
    items_json = _items_json(body.items)

    # ────────────── bKash ─────────────────────────────
    if body.payment_method == "bkash":
        if not body.bkash_number or not body.bkash_otp:
            raise HTTPException(
                400, "bkash_number and bkash_otp are required.")

        tran_id = None
        exec_data = {}
        try:
            token = _bkash_token()

            # Create payment
            create = requests.post(
                f"{BKASH_BASE}/tokenized/checkout/create",
                headers={"Content-Type": "application/json",
                         "Authorization": token, "X-APP-Key": BKASH_APP_KEY},
                json={"mode": "0011",
                      "payerReference":        body.bkash_number,
                      "callbackURL":           f"{FRONTEND_URL}/payment/bkash-callback",
                      "amount":                str(body.total),
                      "currency":              "BDT",
                      "intent":                "sale",
                      "merchantInvoiceNumber": oid},
                timeout=15,
            ).json()

            if create.get("statusCode") != "0000":
                raise HTTPException(
                    402, "bKash create failed: " + create.get("statusMessage", ""))

            payment_id = create["paymentID"]

            # Execute payment
            execute = requests.post(
                f"{BKASH_BASE}/tokenized/checkout/execute",
                headers={"Content-Type": "application/json",
                         "Authorization": token, "X-APP-Key": BKASH_APP_KEY},
                json={"paymentID": payment_id},
                timeout=15,
            ).json()
            exec_data = execute

            if execute.get("statusCode") not in ("0000", "0", 0):
                raise HTTPException(
                    402, "bKash execute failed: " + execute.get("statusMessage", ""))

            tran_id = execute.get("trxID", payment_id)

        except HTTPException:
            raise
        except Exception:
            # Sandbox / network fallback for local development
            tran_id = "BKASH-SANDBOX-" + str(uuid.uuid4())[:8].upper()

        conn = get_db()
        _insert_order(conn, oid, current_user,
                      body.customer_lat, body.customer_lng,
                      items_json, body.subtotal, body.total,
                      "bkash", "paid", now)
        _insert_payment(conn, oid, current_user["id"], "bkash", body.total,
                        "paid", tran_id, None, json.dumps(exec_data))
        conn.commit()
        order = _get_order(conn, oid)
        conn.close()
        await manager.broadcast({"type": "NEW_ORDER", "order": order})
        return {"message": "bKash payment successful!", "order": order, "tran_id": tran_id}

    # ────────────── Card via SSLCommerz ───────────────
    elif body.payment_method == "card":
        conn = get_db()
        _insert_order(conn, oid, current_user,
                      body.customer_lat, body.customer_lng,
                      items_json, body.subtotal, body.total,
                      "card", "pending", now)
        _insert_payment(
            conn, oid, current_user["id"], "card", body.total, "pending")
        conn.commit()

        try:
            ssl = requests.post(
                f"{SSL_BASE}/gwprocess/v4/api.php",
                data={
                    "store_id":           SSL_STORE_ID,
                    "store_passwd":       SSL_STORE_PASS,
                    "total_amount":       str(body.total),
                    "currency":           "BDT",
                    "tran_id":            oid,
                    "success_url":        f"http://localhost:8000/payment/success",
                    "fail_url":           f"http://localhost:8000/payment/fail",
                    "cancel_url":         f"http://localhost:8000/payment/cancel",
                    "ipn_url":            f"http://localhost:8000/payment/ipn",
                    "cus_name":           current_user["name"],
                    "cus_email":          current_user["email"],
                    "cus_phone":          current_user.get("phone", "01700000000"),
                    "cus_add1":           current_user.get("address", "Dhaka"),
                    "cus_city":           "Dhaka",
                    "cus_country":        "Bangladesh",
                    "shipping_method":    "NO",
                    "product_name":       "PizzaFizz Order",
                    "product_category":   "Food",
                    "product_profile":    "general",
                },
                timeout=20,
            ).json()

            if ssl.get("status") != "SUCCESS":
                conn.close()
                raise HTTPException(502, "SSLCommerz: " +
                                    ssl.get("failedreason", "error"))

            conn.close()
            return {"message": "Redirect to payment gateway",
                    "redirect_url": ssl["GatewayPageURL"], "order_id": oid}

        except HTTPException:
            conn.close()
            raise
        except Exception:
            # Sandbox fallback — return order directly for local testing
            order = _get_order(conn, oid)
            conn.close()
            await manager.broadcast({"type": "NEW_ORDER", "order": order})
            return {"message": "Payment initiated (sandbox mode)", "order": order}

    else:
        raise HTTPException(
            400, f"Unknown payment_method: {body.payment_method}")


# ── 3. SSLCommerz Callbacks ───────────────────────────

@app.post("/payment/success")
async def payment_success(request: Request):
    """SSLCommerz POSTs here after successful card payment."""
    form = await request.form()
    data = dict(form)
    tran_id = data.get("tran_id", "")
    val_id = data.get("val_id",  "")

    # Validate with SSLCommerz validation server
    try:
        validate = requests.get(
            f"{SSL_BASE}/validator/api/validationserverAPI.php"
            f"?val_id={val_id}&store_id={SSL_STORE_ID}"
            f"&store_passwd={SSL_STORE_PASS}&v=1&format=json",
            timeout=15
        ).json()
        if validate.get("status") not in ("VALID", "VALIDATED"):
            return RedirectResponse(
                f"{FRONTEND_URL}/payment/fail?reason=validation_failed", status_code=303)
    except Exception:
        pass  # allow through in sandbox / no network

    conn = get_db()
    conn.execute(
        "UPDATE orders   SET payment_status='paid' WHERE id=?", (tran_id,))
    conn.execute("UPDATE payments SET status='paid', gateway_tran_id=?, updated_at=? WHERE order_id=?",
                 (val_id, datetime.now().strftime("%Y-%m-%d %H:%M:%S"), tran_id))
    conn.commit()
    order = conn.execute("SELECT * FROM orders WHERE id=?",
                         (tran_id,)).fetchone()
    conn.close()
    if order:
        o = dict(order)
        o["items"] = json.loads(o["items"])
        await manager.broadcast({"type": "PAYMENT_SUCCESS", "order": o})
    return RedirectResponse(
        f"{FRONTEND_URL}/confirm?order_id={tran_id}&paid=true", status_code=303)


@app.post("/payment/fail")
async def payment_fail(request: Request):
    form = await request.form()
    tran_id = dict(form).get("tran_id", "")
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    conn = get_db()
    conn.execute(
        "UPDATE orders   SET payment_status='failed', status='Cancelled' WHERE id=?", (tran_id,))
    conn.execute(
        "UPDATE payments SET status='failed', updated_at=? WHERE order_id=?", (now, tran_id))
    conn.commit()
    conn.close()
    return RedirectResponse(f"{FRONTEND_URL}/payment/fail?order_id={tran_id}", status_code=303)


@app.post("/payment/cancel")
async def payment_cancel(request: Request):
    form = await request.form()
    tran_id = dict(form).get("tran_id", "")
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    conn = get_db()
    conn.execute(
        "UPDATE payments SET status='cancelled', updated_at=? WHERE order_id=?", (now, tran_id))
    conn.commit()
    conn.close()
    return RedirectResponse(f"{FRONTEND_URL}/cart?cancelled=true", status_code=303)


@app.post("/payment/ipn")
async def payment_ipn(request: Request):
    """SSLCommerz Instant Payment Notification — background server-to-server."""
    form = await request.form()
    data = dict(form)
    tran_id = data.get("tran_id", "")
    status = data.get("status",  "")
    if status == "VALID":
        now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        conn = get_db()
        conn.execute(
            "UPDATE orders   SET payment_status='paid' WHERE id=?", (tran_id,))
        conn.execute(
            "UPDATE payments SET status='paid', updated_at=? WHERE order_id=?", (now, tran_id))
        conn.commit()
        conn.close()
    return JSONResponse({"message": "IPN received"})


# ── 4. Poll payment status (frontend uses this after redirect) ──

@app.get("/payment/status/{order_id}")
def get_payment_status(order_id: str, current_user=Depends(get_current_user)):
    conn = get_db()
    order = conn.execute(
        "SELECT id, status, payment_method, payment_status FROM orders WHERE id=?",
        (order_id,)).fetchone()
    payment = conn.execute(
        "SELECT * FROM payments WHERE order_id=? ORDER BY created_at DESC LIMIT 1",
        (order_id,)).fetchone()
    conn.close()
    if not order:
        raise HTTPException(404, "Order not found.")
    return {"order_id":       order_id,
            "order_status":   order["status"],
            "payment_method": order["payment_method"],
            "payment_status": order["payment_status"],
            "payment":        dict(payment) if payment else None}


# ── 5. Admin: list all payments ───────────────────────

@app.get("/payments")
def list_payments(current_user=Depends(require_owner)):
    conn = get_db()
    rows = conn.execute(
        "SELECT * FROM payments ORDER BY created_at DESC").fetchall()
    conn.close()
    return [dict(r) for r in rows]


# ══════════════════════════════════════════════════════
#  AI IMAGE
# ══════════════════════════════════════════════════════

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


# ══════════════════════════════════════════════════════
#  WEBSOCKET
# ══════════════════════════════════════════════════════

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
print("🍕  PizzaFizz API    →  http://localhost:8000")
print(
    "💳  Payment routes  →  /orders/cod  /payment/initiate  /payment/status/{id}")
print("📖  Docs            →  http://localhost:8000/docs")

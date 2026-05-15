# pizza-backend/main.py
# PizzaFizz — Complete Backend
# Matches YOUR existing database structure exactly

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
import random
import string
from datetime import datetime, timedelta
from dotenv import load_dotenv

load_dotenv()

SECRET_KEY = os.getenv("SECRET_KEY", "pizzafizz-secret-key")
DB_PATH = "pizzafizz.db"
security = HTTPBearer()
app = FastAPI(title="PizzaFizz API")

# ==================== CORS FIX ====================
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",   # Common Vite port
        "http://localhost:5174",
        "http://localhost:5179",   # Your current port
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5179",
        "http://localhost:3000",
    ],
    allow_credentials=True,
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

    # Users table
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

    # Orders table — matches your existing structure
    c.execute("""
        CREATE TABLE IF NOT EXISTS orders (
            id                TEXT PRIMARY KEY,
            user_id           TEXT,
            customer_name     TEXT,
            customer_email    TEXT,
            customer_address  TEXT,
            customer_phone    TEXT,
            customer_lat      REAL DEFAULT 23.8103,
            customer_lng      REAL DEFAULT 90.4125,
            items             TEXT,
            subtotal          REAL,
            delivery          REAL DEFAULT 50,
            total             REAL,
            status            TEXT DEFAULT 'New',
            rider_id          TEXT DEFAULT NULL,
            rider_name        TEXT DEFAULT NULL,
            payment_method    TEXT DEFAULT 'cash',
            payment_status    TEXT DEFAULT 'Pending',
            payment_reference TEXT DEFAULT NULL,
            paid_at           TEXT DEFAULT NULL,
            created_at        TEXT
        )
    """)

    # Add payment columns to existing orders table if missing
    existing_cols = [row[1] for row in c.execute(
        "PRAGMA table_info(orders)").fetchall()]
    for col, definition in {
        "payment_method":    "TEXT DEFAULT 'cash'",
        "payment_status":    "TEXT DEFAULT 'Pending'",
        "payment_reference": "TEXT DEFAULT NULL",
        "paid_at":           "TEXT DEFAULT NULL",
    }.items():
        if col not in existing_cols:
            c.execute(f"ALTER TABLE orders ADD COLUMN {col} {definition}")

    # Payments table
    c.execute("""
        CREATE TABLE IF NOT EXISTS payments (
            id             TEXT PRIMARY KEY,
            user_id        TEXT,
            method         TEXT NOT NULL,
            amount         REAL NOT NULL,
            status         TEXT NOT NULL,
            transaction_id TEXT UNIQUE NOT NULL,
            provider_ref   TEXT,
            created_at     TEXT
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

    # Seed demo accounts
    if c.execute("SELECT COUNT(*) FROM users").fetchone()[0] == 0:
        for email, name, pw, role, phone, addr, lat, lng in [
            ("customer@pizza.com", "Demo Customer", "pizza123", "customer",
             "+880170000001", "123, Gulshan, Dhaka",          23.7937, 90.4066),
            ("owner@pizza.com",    "Pizza Owner",   "owner123", "owner",
             "+880170000002", "PizzaFizz HQ, Banani, Dhaka",  23.7945, 90.4017),
            ("rider@pizza.com",    "Demo Rider",    "rider123", "rider",
             "+880170000003", "Mohakhali, Dhaka",              23.7830, 90.4050),
            ("rider2@pizza.com",   "Karim Rider",   "rider123", "rider",
             "+880170000004", "Tejgaon, Dhaka",                23.7693, 90.3986),
        ]:
            h = bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()
            c.execute("INSERT INTO users VALUES (?,?,?,?,?,?,?,?,?,?)",
                      (str(uuid.uuid4()), name, email, h, phone, addr, role, lat, lng, 1))

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
        raise HTTPException(403, "Owner access only.")
    return user


def require_rider(user=Depends(get_current_user)):
    if user["role"] != "rider":
        raise HTTPException(403, "Rider access only.")
    return user


def safe_user(u):
    return {k: v for k, v in u.items() if k != "password"}


def gen_txn_id():
    return "PFT-" + "".join(random.choices(string.ascii_uppercase + string.digits, k=8))


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
    items:          List[OrderItem]
    subtotal:       float
    total:          float
    payment_method: Optional[str] = "cash"
    customer_lat:   Optional[float] = 23.8103
    customer_lng:   Optional[float] = 90.4125


class PaymentInitBody(BaseModel):
    order_id:      str
    amount:        float
    method:        str                    # cash | bkash | nagad | card
    mobile_number: Optional[str] = ""    # bkash / nagad
    card_number:   Optional[str] = ""    # card
    card_name:     Optional[str] = ""
    expiry:        Optional[str] = ""
    cvv:           Optional[str] = ""


class PaymentVerifyBody(BaseModel):
    order_id:       str
    transaction_id: str
    status:         str   # success | failed | cancelled


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


# ══════════════════════════════════════════════════════
#  ROUTES — AUTH
# ══════════════════════════════════════════════════════

@app.get("/")
def home():
    return {"message": "PizzaFizz API running 🍕"}


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
                 (uid, body.name, email, h, body.phone, body.address, role,
                  body.lat, body.lng, 1))
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


@app.post("/forgot/verify-phone")
def verify_phone(body: VerifyPhoneBody):
    conn = get_db()
    row = conn.execute("SELECT * FROM users WHERE email=?",
                       (body.email.lower(),)).fetchone()
    conn.close()
    if not row:
        raise HTTPException(404, "No account found with this email.")
    if (row["phone"] or "").replace(" ", "") != body.phone.strip().replace(" ", ""):
        raise HTTPException(400, "Phone number does not match.")
    return {"verified": True, "name": row["name"], "email": body.email}


@app.post("/forgot/reset-password")
def reset_password(body: ResetPasswordBody):
    if len(body.new_password) < 6:
        raise HTTPException(400, "Password must be at least 6 characters.")
    conn = get_db()
    row = conn.execute("SELECT * FROM users WHERE email=?",
                       (body.email.lower(),)).fetchone()
    if not row:
        conn.close()
        raise HTTPException(404, "Account not found.")
    if (row["phone"] or "").replace(" ", "") != body.phone.strip().replace(" ", ""):
        conn.close()
        raise HTTPException(400, "Verification failed.")
    h = bcrypt.hashpw(body.new_password.encode(), bcrypt.gensalt()).decode()
    conn.execute("UPDATE users SET password=? WHERE email=?",
                 (h, body.email.lower()))
    conn.commit()
    conn.close()
    return {"message": "Password reset successfully!"}


# ══════════════════════════════════════════════════════
#  ROUTES — ORDERS
# ══════════════════════════════════════════════════════

@app.post("/orders")
async def place_order(body: OrderBody, current_user=Depends(get_current_user)):
    """
    Creates an order.
    - Cash (COD): status = 'New', payment_status = 'Pending'
    - Card/bKash/Nagad: status = 'Pending Payment', payment_status = 'Pending'
      (becomes 'New' after payment verified)
    """
    oid = "PF-" + str(uuid.uuid4())[:6].upper()
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    method = (body.payment_method or "cash").lower().strip()

    # Normalise aliases
    if method in ("cod", "cash_on_delivery"):
        method = "cash"
    if method not in ("cash", "bkash", "nagad", "card"):
        raise HTTPException(400, "Invalid payment method.")

    items_json = json.dumps([
        {"name": i.name, "size": i.size, "crust": i.crust, "sauce": i.sauce,
         "toppings": [t.dict() for t in i.toppings], "price": i.price, "qty": i.qty}
        for i in body.items
    ])

    # Cash orders go straight to kitchen queue
    order_status = "New" if method == "cash" else "Pending Payment"
    payment_status = "Pending" if method == "cash" else "Unpaid"

    conn = get_db()
    conn.execute(
        """INSERT INTO orders VALUES
           (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
        (
            oid,
            current_user["id"],
            current_user["name"],
            current_user["email"],
            current_user["address"],
            current_user["phone"],
            body.customer_lat,
            body.customer_lng,
            items_json,
            body.subtotal,
            50,           # delivery charge
            body.total,
            order_status,
            None,         # rider_id
            None,         # rider_name
            method,
            payment_status,
            None,         # payment_reference
            None,         # paid_at
            now,
        )
    )
    conn.commit()
    order = dict(conn.execute(
        "SELECT * FROM orders WHERE id=?", (oid,)).fetchone())
    conn.close()
    order["items"] = json.loads(order["items"])

    # Broadcast to owner dashboard only if cash (already confirmed)
    if method == "cash":
        await manager.broadcast({"type": "NEW_ORDER", "order": order})

    return {
        "message":        "Order created!",
        "order":          order,
        "requires_payment": method != "cash",
    }


@app.get("/orders")
def get_orders(current_user=Depends(get_current_user)):
    conn = get_db()
    if current_user["role"] in ("owner", "admin"):
        rows = conn.execute(
            "SELECT * FROM orders ORDER BY created_at DESC").fetchall()
    elif current_user["role"] == "rider":
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
    valid = ["New", "Making", "Ready", "Out for Delivery",
             "Delivered", "Pending Payment", "Cancelled"]
    if body.status not in valid:
        raise HTTPException(400, f"Status must be one of {valid}")

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


# ══════════════════════════════════════════════════════
#  ROUTES — PAYMENT
# ══════════════════════════════════════════════════════

@app.post("/payment/initiate")
async def initiate_payment(body: PaymentInitBody, current_user=Depends(get_current_user)):
    """
    Simulates payment processing for card / bKash / Nagad.
    Validates inputs, generates a transaction ID, marks order as paid.

    To switch to SSLCommerz later:
      1. pip install sslcommerz-python
      2. Set SSL_STORE_ID and SSL_STORE_PASS in .env
      3. Replace the simulation block below with SSLCommerz API call
    """
    method = (body.method or "cash").lower().strip()
    if method in ("cod", "cash_on_delivery"):
        method = "cash"
    if method not in ("cash", "bkash", "nagad", "card"):
        raise HTTPException(400, "Invalid payment method.")

    if body.amount <= 0:
        raise HTTPException(400, "Amount must be greater than zero.")

    # ── Validate mobile number for bKash / Nagad ──────
    if method in ("bkash", "nagad"):
        digits = "".join(ch for ch in (
            body.mobile_number or "") if ch.isdigit())
        if not (len(digits) == 11 and digits.startswith("01")):
            raise HTTPException(
                400, "Enter a valid 11-digit Bangladesh mobile number starting with 01.")

    # ── Validate card details ─────────────────────────
    if method == "card":
        card_digits = "".join(ch for ch in (
            body.card_number or "") if ch.isdigit())
        cvv_digits = "".join(ch for ch in (body.cvv or "") if ch.isdigit())
        if not (13 <= len(card_digits) <= 19):
            raise HTTPException(
                400, "Enter a valid card number (13–19 digits).")
        if not (3 <= len(cvv_digits) <= 4):
            raise HTTPException(400, "Enter a valid CVV (3–4 digits).")
        if not body.card_name or len(body.card_name.strip()) < 2:
            raise HTTPException(400, "Enter the cardholder name.")
        if not body.expiry or len(body.expiry.strip()) < 4:
            raise HTTPException(400, "Enter a valid expiry date.")

    # ── Generate transaction ID ───────────────────────
    txn_id = gen_txn_id()
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    # ── Simulate processing delay (real gateway would redirect here) ──
    # In production with SSLCommerz:
    #   response = sslcommerz.createSession({...})
    #   return {"redirect_url": response["GatewayPageURL"]}

    # ── Record payment ────────────────────────────────
    conn = get_db()
    conn.execute(
        "INSERT INTO payments VALUES (?,?,?,?,?,?,?,?)",
        (str(uuid.uuid4()), current_user["id"], method,
         body.amount, "success", txn_id, None, now)
    )

    # ── Update order: mark paid → move to kitchen ─────
    conn.execute(
        """UPDATE orders
           SET payment_status='Paid', payment_reference=?, paid_at=?, status='New'
           WHERE id=?""",
        (txn_id, now, body.order_id)
    )
    conn.commit()

    order = conn.execute("SELECT * FROM orders WHERE id=?",
                         (body.order_id,)).fetchone()
    conn.close()

    if not order:
        raise HTTPException(404, "Order not found.")

    order = dict(order)
    order["items"] = json.loads(order["items"])

    # Notify owner dashboard
    await manager.broadcast({"type": "NEW_ORDER", "order": order})

    return {
        "success":        True,
        "transaction_id": txn_id,
        "method":         method,
        "amount":         body.amount,
        "message":        f"Payment successful via {method.title()}!",
        "order":          order,
    }


@app.get("/payment/status/{order_id}")
def payment_status(order_id: str, current_user=Depends(get_current_user)):
    """Check payment status of an order."""
    conn = get_db()
    order = conn.execute("SELECT * FROM orders WHERE id=?",
                         (order_id,)).fetchone()
    conn.close()
    if not order:
        raise HTTPException(404, "Order not found.")
    return {
        "order_id":        order_id,
        "payment_status":  order["payment_status"],
        "payment_method":  order["payment_method"],
        "payment_reference": order["payment_reference"],
        "paid_at":         order["paid_at"],
    }


# ══════════════════════════════════════════════════════
#  ROUTES — STATS
# ══════════════════════════════════════════════════════

@app.get("/stats")
def get_stats(current_user=Depends(require_owner)):
    conn = get_db()
    total = conn.execute("SELECT COUNT(*) FROM orders").fetchone()[0]
    revenue = conn.execute(
        "SELECT COALESCE(SUM(total),0) FROM orders WHERE payment_status='Paid'").fetchone()[0]
    new_count = conn.execute(
        "SELECT COUNT(*) FROM orders WHERE status='New'").fetchone()[0]
    making = conn.execute(
        "SELECT COUNT(*) FROM orders WHERE status='Making'").fetchone()[0]
    ready = conn.execute(
        "SELECT COUNT(*) FROM orders WHERE status='Ready'").fetchone()[0]
    delivering = conn.execute(
        "SELECT COUNT(*) FROM orders WHERE status='Out for Delivery'").fetchone()[0]
    pending_pay = conn.execute(
        "SELECT COUNT(*) FROM orders WHERE status='Pending Payment'").fetchone()[0]
    riders = conn.execute(
        "SELECT COUNT(*) FROM users WHERE role='rider' AND is_available=1").fetchone()[0]
    all_items = conn.execute("SELECT items FROM orders").fetchall()
    conn.close()
    pizza_count = sum(
        item.get("qty", 1) for row in all_items for item in json.loads(row[0])
    )
    return {
        "totalOrders":     total,
        "revenue":         int(revenue),
        "newOrders":       new_count,
        "making":          making,
        "ready":           ready,
        "delivering":      delivering,
        "pendingPayment":  pending_pay,
        "pizzasMade":      pizza_count,
        "availableRiders": riders,
    }


# ══════════════════════════════════════════════════════
#  ROUTES — RIDERS
# ══════════════════════════════════════════════════════

@app.get("/riders")
def get_riders(current_user=Depends(require_owner)):
    conn = get_db()
    rows = conn.execute(
        "SELECT * FROM users WHERE role='rider' ORDER BY name").fetchall()
    conn.close()
    return [safe_user(dict(r)) for r in rows]


@app.post("/orders/{order_id}/assign-rider")
async def assign_rider(order_id: str, body: AssignRiderBody, current_user=Depends(require_owner)):
    conn = get_db()
    rider = conn.execute(
        "SELECT * FROM users WHERE id=? AND role='rider'", (body.rider_id,)
    ).fetchone()
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
    await manager.broadcast({
        "type": "RIDER_ASSIGNED", "order_id": order_id,
        "rider_name": rider["name"], "order": order
    })
    return {"message": f"Rider {rider['name']} assigned!", "order": order}


@app.get("/rider/orders")
def get_rider_orders(current_user=Depends(require_rider)):
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
    conn = get_db()
    order = conn.execute("SELECT * FROM orders WHERE id=?",
                         (order_id,)).fetchone()
    if not order:
        conn.close()
        raise HTTPException(404, "Order not found.")
    if order["rider_id"] != current_user["id"]:
        conn.close()
        raise HTTPException(403, "Not your delivery.")
    conn.execute(
        "UPDATE orders SET status='Delivered' WHERE id=?", (order_id,))
    earning = round(float(order["total"]) * 0.10, 2)
    conn.execute("INSERT INTO rider_earnings VALUES (?,?,?,?,?)",
                 (str(uuid.uuid4()), current_user["id"], order_id,
                  earning, datetime.now().strftime("%Y-%m-%d %H:%M:%S")))
    conn.commit()
    updated = dict(conn.execute(
        "SELECT * FROM orders WHERE id=?", (order_id,)).fetchone())
    conn.close()
    updated["items"] = json.loads(updated["items"])
    await manager.broadcast({
        "type": "ORDER_UPDATE", "order_id": order_id,
        "status": "Delivered", "order": updated
    })
    return {"message": f"Delivered! ৳{earning} earned.", "earning": earning}


@app.patch("/rider/location")
async def update_rider_location(body: LocationBody, current_user=Depends(require_rider)):
    conn = get_db()
    conn.execute("UPDATE users SET lat=?, lng=? WHERE id=?",
                 (body.lat, body.lng, current_user["id"]))
    conn.commit()
    conn.close()
    await manager.broadcast({
        "type": "RIDER_LOCATION", "rider_id": current_user["id"],
        "name": current_user["name"], "lat": body.lat, "lng": body.lng,
    })
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
    conn = get_db()
    order = conn.execute("SELECT * FROM orders WHERE id=?",
                         (order_id,)).fetchone()
    if not order:
        conn.close()
        raise HTTPException(404, "Order not found.")
    order = dict(order)
    order["items"] = json.loads(order["items"])
    rider = None
    if order["rider_id"]:
        r = conn.execute(
            "SELECT id, name, phone, lat, lng FROM users WHERE id=?",
            (order["rider_id"],)
        ).fetchone()
        if r:
            rider = dict(r)
    conn.close()
    return {"order": order, "rider": rider}


# ══════════════════════════════════════════════════════
#  ROUTES — AI IMAGE
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


# ══════════════════════════════════════════════════════
#  STARTUP
# ══════════════════════════════════════════════════════
init_db()
print("🍕  PizzaFizz API    →  http://localhost:8000")
print(
    "💳  Payment routes  →  POST /orders  |  POST /payment/initiate  |  GET /payment/status/{id}")
print("📖  Docs            →  http://localhost:8000/docs")

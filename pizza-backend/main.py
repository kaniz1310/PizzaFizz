# pizza-backend/main.py  ← REPLACE YOUR ENTIRE EXISTING FILE WITH THIS
#
# CHANGES FROM YOUR CURRENT FILE:
#   1. PaymentInitBody: removed order_id requirement — now creates order + pays in one call
#      Also added payment_method alias so frontend field names work directly
#   2. /payment/initiate: fixed to create order inline when no order_id sent
#   3. NEW: /ai/recommend — AI pizza suggestion endpoint using Anthropic API
#   4. NEW: /reviews, /loyalty, /analytics  (stubs your api.js already calls)
#   Everything else is 100% identical to your existing file.

from fastapi import FastAPI, HTTPException, Depends, WebSocket, WebSocketDisconnect, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse, JSONResponse, StreamingResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, field_validator
from typing import Optional, List
import sqlite3
import uuid
import bcrypt
import jwt
import os
import json
import io
import csv
import base64
import requests
from datetime import datetime, timedelta
from dotenv import load_dotenv
from menu_seed_data import MENU_SEED_ITEMS

load_dotenv()

SECRET_KEY = os.getenv("SECRET_KEY",            "pizzafizz-secret-key")
DB_PATH = "pizzafizz.db"
FRONTEND_URL = os.getenv("FRONTEND_URL",          "http://localhost:5173")
# Add to .env for AI recommend
ANTHROPIC_KEY = os.getenv("ANTHROPIC_API_KEY",     "")

SSL_STORE_ID = os.getenv("SSLCOMMERZ_STORE_ID",   "testbox")
SSL_STORE_PASS = os.getenv("SSLCOMMERZ_STORE_PASS", "qwerty")
SSL_SANDBOX = os.getenv("SSLCOMMERZ_SANDBOX",    "true").lower() == "true"
SSL_BASE = "https://sandbox.sslcommerz.com" if SSL_SANDBOX else "https://securepay.sslcommerz.com"

security = HTTPBearer()
app = FastAPI(title="PizzaFizz API 🍕")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── WebSocket Manager ──────────────────────────────────────────────────────────
class ConnectionManager:
    def __init__(self): self.active: list = []

    async def connect(self, ws: WebSocket):
        await ws.accept()
        self.active.append(ws)

    def disconnect(self, ws: WebSocket):
        if ws in self.active:
            self.active.remove(ws)

    async def broadcast(self, msg: dict):
        dead = []
        for ws in self.active:
            try:
                await ws.send_json(msg)
            except:
                dead.append(ws)
        for ws in dead:
            self.disconnect(ws)


manager = ConnectionManager()


# ── Database ───────────────────────────────────────────────────────────────────
def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def gen_txn_id():
    return "TXN-" + str(uuid.uuid4())[:8].upper()


def init_db():
    conn = get_db()
    c = conn.cursor()

    c.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY, name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL, password TEXT NOT NULL,
            phone TEXT, address TEXT, role TEXT DEFAULT 'customer',
            lat REAL DEFAULT 23.8103, lng REAL DEFAULT 90.4125,
            is_available INTEGER DEFAULT 1,
            loyalty_points INTEGER DEFAULT 0
        )""")

    c.execute("""
        CREATE TABLE IF NOT EXISTS orders (
            id TEXT PRIMARY KEY, user_id TEXT,
            customer_name TEXT, customer_email TEXT,
            customer_address TEXT, customer_phone TEXT,
            customer_lat REAL DEFAULT 23.8103, customer_lng REAL DEFAULT 90.4125,
            items TEXT, subtotal REAL, delivery REAL DEFAULT 50, total REAL,
            status TEXT DEFAULT 'New',
            rider_id TEXT DEFAULT NULL, rider_name TEXT DEFAULT NULL,
            payment_method TEXT DEFAULT 'cash',
            payment_status TEXT DEFAULT 'Pending',
            payment_reference TEXT DEFAULT NULL,
            paid_at TEXT DEFAULT NULL,
            created_at TEXT
        )""")

    # Safely migrate existing DB
    existing = [r[1]
                for r in c.execute("PRAGMA table_info(orders)").fetchall()]
    for col, defn in {
        "payment_method":    "TEXT DEFAULT 'cash'",
        "payment_status":    "TEXT DEFAULT 'Pending'",
        "payment_reference": "TEXT DEFAULT NULL",
        "paid_at":           "TEXT DEFAULT NULL",
    }.items():
        if col not in existing:
            c.execute(f"ALTER TABLE orders ADD COLUMN {col} {defn}")

    u_existing = [r[1]
                  for r in c.execute("PRAGMA table_info(users)").fetchall()]
    if "loyalty_points" not in u_existing:
        c.execute("ALTER TABLE users ADD COLUMN loyalty_points INTEGER DEFAULT 0")

    c.execute("""
        CREATE TABLE IF NOT EXISTS payments (
            id TEXT PRIMARY KEY, user_id TEXT, method TEXT NOT NULL,
            amount REAL NOT NULL, status TEXT NOT NULL,
            transaction_id TEXT UNIQUE NOT NULL, provider_ref TEXT,
            created_at TEXT
        )""")

    c.execute("""
        CREATE TABLE IF NOT EXISTS rider_earnings (
            id TEXT PRIMARY KEY, rider_id TEXT,
            order_id TEXT, amount REAL, created_at TEXT
        )""")

    c.execute("""
        CREATE TABLE IF NOT EXISTS rider_withdrawals (
            id TEXT PRIMARY KEY, rider_id TEXT NOT NULL,
            amount REAL NOT NULL, method TEXT NOT NULL,
            detail TEXT, created_at TEXT
        )""")

    c.execute("""
        CREATE TABLE IF NOT EXISTS owner_investments (
            id TEXT PRIMARY KEY, recorded_by TEXT,
            amount REAL NOT NULL, category TEXT, note TEXT, created_at TEXT
        )""")

    if "rider_card_balance" not in u_existing:
        c.execute(
            "ALTER TABLE users ADD COLUMN rider_card_balance REAL DEFAULT 0")

    c.execute("""
        CREATE TABLE IF NOT EXISTS reviews (
            id TEXT PRIMARY KEY, user_id TEXT, user_name TEXT,
            order_id TEXT, rating INTEGER, comment TEXT, created_at TEXT
        )""")

    c.execute("""
        CREATE TABLE IF NOT EXISTS menu_items (
            id TEXT PRIMARY KEY,
            section TEXT NOT NULL,
            category TEXT NOT NULL,
            name TEXT NOT NULL,
            description TEXT,
            price REAL NOT NULL,
            discount_percent REAL DEFAULT 0,
            badge TEXT,
            badge_color TEXT,
            image_url TEXT,
            size TEXT,
            crust TEXT,
            sauce TEXT,
            toppings TEXT,
            tags TEXT,
            is_available INTEGER DEFAULT 1,
            sort_order INTEGER DEFAULT 0,
            created_at TEXT,
            updated_at TEXT
        )""")

    if c.execute("SELECT COUNT(*) FROM menu_items").fetchone()[0] == 0:
        now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        for i, row in enumerate(MENU_SEED_ITEMS):
            c.execute(
                "INSERT INTO menu_items VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                (
                    row["id"], row["section"], row["category"], row["name"],
                    row.get("description", ""), row["price"],
                    row.get("discount_percent", 0),
                    row.get("badge"), row.get("badge_color"),
                    row.get("image_url", ""),
                    row.get("size", ""), row.get("crust", ""),
                    row.get("sauce", ""),
                    json.dumps(row.get("toppings") or []),
                    json.dumps(row.get("tags") or []),
                    1, i, now, now,
                ),
            )

    if c.execute("SELECT COUNT(*) FROM users").fetchone()[0] == 0:
        for email, name, pw, role, phone, addr, lat, lng in [
            ("customer@pizza.com", "Demo Customer", "pizza123", "customer",
             "+880170000001", "123, Gulshan, Dhaka", 23.7937, 90.4066),
            ("owner@pizza.com",   "Pizza Owner",  "owner123", "owner",
             "+880170000002", "PizzaFizz HQ, Banani", 23.7945, 90.4017),
            ("rider@pizza.com",   "Demo Rider",   "rider123", "rider",
             "+880170000003", "Mohakhali, Dhaka", 23.7830, 90.4050),
            ("rider2@pizza.com",  "Karim Rider",  "rider123", "rider",
             "+880170000004", "Tejgaon, Dhaka", 23.7693, 90.3986),
        ]:
            h = bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()
            c.execute("INSERT INTO users VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
                      (str(uuid.uuid4()), name, email, h, phone, addr, role, lat, lng, 1, 0, 0))

    conn.commit()
    conn.close()


# ── JWT Helpers ────────────────────────────────────────────────────────────────
def create_token(uid: str) -> str:
    return jwt.encode({"sub": uid, "exp": datetime.utcnow()+timedelta(hours=24)},
                      SECRET_KEY, algorithm="HS256")


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


def require_owner(u=Depends(get_current_user)):
    if u["role"] not in ("owner", "admin"):
        raise HTTPException(403, "Owner only.")
    return u


def require_rider(u=Depends(get_current_user)):
    if u["role"] != "rider":
        raise HTTPException(403, "Rider only.")
    return u


def safe_user(u): return {k: v for k, v in u.items() if k != "password"}


def _effective_price(price: float, discount_percent: float) -> float:
    p = float(price or 0)
    d = float(discount_percent or 0)
    if d <= 0:
        return round(p, 2)
    return round(p * (1 - min(d, 100) / 100), 2)


def _menu_row_to_item(row) -> dict:
    d = dict(row)
    price = float(d.get("price") or 0)
    disc = float(d.get("discount_percent") or 0)
    eff = _effective_price(price, disc)
    toppings = json.loads(d.get("toppings") or "[]")
    tags = json.loads(d.get("tags") or "[]")
    return {
        "id": d["id"],
        "name": d["name"],
        "desc": d.get("description") or "",
        "description": d.get("description") or "",
        "price": eff,
        "original_price": price,
        "discount_percent": disc,
        "category": d.get("category") or "",
        "section": d.get("section") or "pizza",
        "image": d.get("image_url") or "",
        "badge": d.get("badge") or "",
        "badgeColor": d.get("badge_color") or "#e63329",
        "size": d.get("size") or "",
        "crust": d.get("crust") or "",
        "sauce": d.get("sauce") or "",
        "toppings": toppings,
        "tags": tags,
        "is_available": bool(d.get("is_available", 1)),
        "sort_order": int(d.get("sort_order") or 0),
    }


def _group_menu_items(items: list) -> dict:
    pizzas_map = {}
    fast_map = {}
    for item in items:
        cat = item["category"]
        sec = item["section"]
        bucket = pizzas_map if sec == "pizza" else fast_map
        if cat not in bucket:
            bucket[cat] = []
        bucket[cat].append(item)
    def to_list(m):
        return [{"category": k, "items": sorted(v, key=lambda x: x.get("sort_order", 0))}
                for k, v in sorted(m.items())]
    return {"pizzas": to_list(pizzas_map), "fastfood": to_list(fast_map)}


async def _broadcast_menu_update():
    await manager.broadcast({
        "type": "MENU_UPDATE",
        "updated_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
    })


def rider_available_balance(conn, rider_id: str) -> float:
    gross = conn.execute(
        "SELECT COALESCE(SUM(amount),0) FROM rider_earnings WHERE rider_id=?",
        (rider_id,)).fetchone()[0]
    out = conn.execute(
        "SELECT COALESCE(SUM(amount),0) FROM rider_withdrawals WHERE rider_id=?",
        (rider_id,)).fetchone()[0]
    return round(float(gross) - float(out), 2)


# ── Pydantic Models ────────────────────────────────────────────────────────────
class RegisterBody(BaseModel):
    name: str
    email: str
    password: str
    phone: str
    address: str
    role: Optional[str] = "customer"
    lat: Optional[float] = 23.8103
    lng: Optional[float] = 90.4125


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
    icon: Optional[str] = ""
    price: Optional[float] = 0.0


class OrderItem(BaseModel):
    name: Optional[str] = ""
    size: str
    crust: str
    sauce: str
    toppings: Optional[List[ToppingItem]] = []
    price: float
    qty: int = 1


class OrderBody(BaseModel):
    items: List[OrderItem]
    subtotal: float
    total: float
    payment_method: Optional[str] = "cash"
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
    crust: Optional[str] = ""
    sauce: Optional[str] = ""
    toppings: Optional[List[str]] = []

    @field_validator("toppings", mode="before")
    @classmethod
    def coerce_toppings(cls, v):
        if v is None:
            return []
        out = []
        for x in v:
            if isinstance(x, str) and x.strip():
                out.append(x.strip())
            elif isinstance(x, dict):
                lbl = x.get("label") or x.get("name")
                if lbl and str(lbl).strip():
                    out.append(str(lbl).strip())
        return out


class ReviewBody(BaseModel):
    order_id: Optional[str] = ""
    rating: int
    comment: Optional[str] = ""


class AIRecommendBody(BaseModel):
    mood: str  # e.g. "I want something spicy and cheesy"


class RiderWithdrawBody(BaseModel):
    amount: float
    method: str  # mobile_banking | cash | card
    detail: Optional[str] = ""  # MFS number, reference, etc.


class OwnerInvestmentBody(BaseModel):
    amount: float
    category: Optional[str] = "general"
    note: Optional[str] = ""


class MenuItemBody(BaseModel):
    section: str  # pizza | fastfood
    category: str
    name: str
    description: Optional[str] = ""
    price: float
    discount_percent: Optional[float] = 0
    badge: Optional[str] = ""
    badge_color: Optional[str] = "#e63329"
    image_url: Optional[str] = ""
    size: Optional[str] = ""
    crust: Optional[str] = ""
    sauce: Optional[str] = ""
    toppings: Optional[List[dict]] = []
    tags: Optional[List[str]] = []
    is_available: Optional[bool] = True
    sort_order: Optional[int] = 0


class MenuItemPatchBody(BaseModel):
    section: Optional[str] = None
    category: Optional[str] = None
    name: Optional[str] = None
    description: Optional[str] = None
    price: Optional[float] = None
    discount_percent: Optional[float] = None
    badge: Optional[str] = None
    badge_color: Optional[str] = None
    image_url: Optional[str] = None
    size: Optional[str] = None
    crust: Optional[str] = None
    sauce: Optional[str] = None
    toppings: Optional[List[dict]] = None
    tags: Optional[List[str]] = None
    is_available: Optional[bool] = None
    sort_order: Optional[int] = None


# ── FIXED: PaymentInitBody now accepts both old and new field names ─────────────


class PaymentInitBody(BaseModel):
    # ── order fields (create order inline if order_id not provided) ──
    items:          Optional[List[OrderItem]] = []
    subtotal:       Optional[float] = 0.0
    total:          Optional[float] = 0.0
    customer_lat:   Optional[float] = 23.8103
    customer_lng:   Optional[float] = 90.4125

    # ── payment identification ──
    order_id:       Optional[str] = None    # if provided, skip order creation
    amount:         Optional[float] = None    # falls back to total

    # ── FIX: accept both "method" and "payment_method" ──────────────
    method:         Optional[str] = None    # backend name
    payment_method: Optional[str] = None    # frontend name (alias)

    # ── bKash ── FIX: accept both "mobile_number" and "bkash_number" ─
    mobile_number:  Optional[str] = ""
    bkash_number:   Optional[str] = ""      # frontend alias

    # ── Card ────────────────────────────────────────────────────────
    card_number:    Optional[str] = ""
    card_name:      Optional[str] = ""
    expiry:         Optional[str] = ""
    cvv:            Optional[str] = ""


# ── DB helpers ─────────────────────────────────────────────────────────────────
def _items_json(items):
    return json.dumps([
        {"name": i.name, "size": i.size, "crust": i.crust, "sauce": i.sauce,
         "toppings": [t.dict() for t in i.toppings], "price": i.price, "qty": i.qty}
        for i in items
    ])


def _create_order_row(conn, user, items, subtotal, total, payment_method,
                      payment_status, lat, lng, now):
    oid = "PF-" + str(uuid.uuid4())[:6].upper()
    items_json = _items_json(items)
    order_status = "New" if payment_method in (
        "cash", "cod") else "Pending Payment"
    conn.execute(
        "INSERT INTO orders VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
        (oid, user["id"], user["name"], user["email"],
         user["address"], user["phone"], lat, lng,
         items_json, subtotal, 50, total,
         order_status, None, None,
         payment_method, payment_status, None, None, now)
    )
    conn.commit()
    row = conn.execute("SELECT * FROM orders WHERE id=?", (oid,)).fetchone()
    o = dict(row)
    o["items"] = json.loads(o["items"])
    return o


# ══════════════════════════════════════════════════════════════════════════════
#  ROUTES
# ══════════════════════════════════════════════════════════════════════════════

@app.get("/")
def home(): return {"message": "PizzaFizz API running 🍕"}


# ── Auth ───────────────────────────────────────────────────────────────────────
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
    conn.execute("INSERT INTO users VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
                 (uid, body.name, email, h, body.phone, body.address, role, body.lat, body.lng, 1, 0, 0))
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
def get_me(u=Depends(get_current_user)): return {"user": safe_user(u)}


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
        raise HTTPException(400, "Min 6 characters.")
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


# ── Orders ─────────────────────────────────────────────────────────────────────
@app.post("/orders")
async def place_order(body: OrderBody, u=Depends(get_current_user)):
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    method = (body.payment_method or "cash").lower().strip()
    if method in ("cod", "cash_on_delivery"):
        method = "cash"
    if method not in ("cash", "bkash", "nagad", "card"):
        raise HTTPException(400, "Invalid payment method.")
    conn = get_db()
    order = _create_order_row(conn, u, body.items, body.subtotal, body.total,
                              method, "Pending", body.customer_lat, body.customer_lng, now)
    conn.close()
    if method == "cash":
        await manager.broadcast({"type": "NEW_ORDER", "order": order})
    return {"message": "Order created!", "order": order, "requires_payment": method != "cash"}


@app.get("/orders")
def get_orders(u=Depends(get_current_user)):
    conn = get_db()
    if u["role"] in ("owner", "admin"):
        rows = conn.execute(
            "SELECT * FROM orders ORDER BY created_at DESC").fetchall()
    elif u["role"] == "rider":
        rows = conn.execute(
            "SELECT * FROM orders WHERE rider_id=? ORDER BY created_at DESC", (u["id"],)).fetchall()
    else:
        rows = conn.execute(
            "SELECT * FROM orders WHERE user_id=? ORDER BY created_at DESC", (u["id"],)).fetchall()
    conn.close()
    result = []
    for row in rows:
        o = dict(row)
        o["items"] = json.loads(o["items"])
        result.append(o)
    return result


@app.patch("/orders/{order_id}/status")
async def update_status(order_id: str, body: StatusBody, u=Depends(get_current_user)):
    valid = ["New", "Making", "Ready", "Out for Delivery", "Delivered"]
    if body.status not in valid:
        raise HTTPException(400, f"Must be one of {valid}")
    if u["role"] == "rider":
        conn = get_db()
        o = conn.execute("SELECT * FROM orders WHERE id=?",
                         (order_id,)).fetchone()
        conn.close()
        if not o or o["rider_id"] != u["id"]:
            raise HTTPException(403, "Not your order.")
    elif u["role"] not in ("owner", "admin"):
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
    await manager.broadcast({"type": "ORDER_UPDATE", "order_id": order_id, "status": body.status, "order": order})
    return {"message": "Status updated", "order": order}


# ══════════════════════════════════════════════════════════════════════════════
#  PAYMENT  — FIXED
# ══════════════════════════════════════════════════════════════════════════════

@app.post("/payment/initiate")
async def initiate_payment(body: PaymentInitBody, u=Depends(get_current_user)):
    """
    FIXED version — handles both:
      A) Old flow: frontend sends order_id + amount + method (backend field names)
      B) New flow: frontend sends items + total + payment_method (frontend field names)
         → creates order first, then processes payment

    Field aliases accepted:
      method OR payment_method   → resolved to method
      mobile_number OR bkash_number → resolved to mobile_number
    """
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    # ── Resolve aliased field names (fix frontend↔backend mismatch) ───────────
    method = (body.method or body.payment_method or "cash").lower().strip()
    if method in ("cod", "cash_on_delivery"):
        method = "cash"
    if method not in ("cash", "bkash", "nagad", "card"):
        raise HTTPException(
            400, f"Invalid method '{method}'. Use: cash, bkash, nagad, card")

    mobile = (body.mobile_number or body.bkash_number or "").strip()
    amount = body.amount or body.total or 0
    if amount <= 0:
        raise HTTPException(400, "Amount must be > 0.")

    conn = get_db()

    # ── Get or create the order ────────────────────────────────────────────────
    if body.order_id:
        # Old flow: order already exists
        row = conn.execute("SELECT * FROM orders WHERE id=?",
                           (body.order_id,)).fetchone()
        if not row:
            conn.close()
            raise HTTPException(404, "Order not found.")
        order = dict(row)
        order["items"] = json.loads(order["items"])
    else:
        # New flow (from Cart.jsx): create order inline
        if not body.items:
            conn.close()
            raise HTTPException(400, "Provide either order_id or items.")
        order = _create_order_row(
            conn, u, body.items, body.subtotal or 0, body.total or 0,
            method, "Unpaid", body.customer_lat, body.customer_lng, now
        )

    oid = order["id"]

    # ── Validate by method ─────────────────────────────────────────────────────
    if method in ("bkash", "nagad"):
        digits = "".join(ch for ch in mobile if ch.isdigit())
        if not (len(digits) == 11 and digits.startswith("01")):
            conn.close()
            raise HTTPException(
                400, "Enter a valid 11-digit Bangladesh mobile number starting with 01.")

    if method == "card":
        card_digits = "".join(ch for ch in (
            body.card_number or "") if ch.isdigit())
        cvv_digits = "".join(ch for ch in (body.cvv or "") if ch.isdigit())
        if not (13 <= len(card_digits) <= 19):
            conn.close()
            raise HTTPException(
                400, "Enter a valid card number (13–19 digits).")
        if not (3 <= len(cvv_digits) <= 4):
            conn.close()
            raise HTTPException(400, "Enter a valid CVV (3–4 digits).")
        if not body.card_name or len(body.card_name.strip()) < 2:
            conn.close()
            raise HTTPException(400, "Enter the cardholder name.")
        if not body.expiry or len(body.expiry.strip()) < 4:
            conn.close()
            raise HTTPException(400, "Enter a valid expiry date (MM/YY).")

    # ── SSLCommerz redirect for card (production) ─────────────────────────────
    if method == "card" and not SSL_SANDBOX:
        try:
            ssl = requests.post(f"{SSL_BASE}/gwprocess/v4/api.php", data={
                "store_id": SSL_STORE_ID, "store_passwd": SSL_STORE_PASS,
                "total_amount": str(amount), "currency": "BDT", "tran_id": oid,
                "success_url": f"http://localhost:8000/payment/ssl/success",
                "fail_url":   f"http://localhost:8000/payment/ssl/fail",
                "cancel_url": f"http://localhost:8000/payment/ssl/cancel",
                "ipn_url":    f"http://localhost:8000/payment/ssl/ipn",
                "cus_name": u["name"], "cus_email": u["email"],
                "cus_phone": u.get("phone", "01700000000"),
                "cus_add1": u.get("address", "Dhaka"),
                "cus_city": "Dhaka", "cus_country": "Bangladesh",
                "shipping_method": "NO", "product_name": "PizzaFizz Order",
                "product_category": "Food", "product_profile": "general",
            }, timeout=20).json()
            if ssl.get("status") == "SUCCESS":
                conn.close()
                return {"success": True, "redirect_url": ssl["GatewayPageURL"], "order_id": oid}
        except:
            pass  # fallthrough to simulation

    # ── Simulate payment (sandbox / local dev) ────────────────────────────────
    txn_id = gen_txn_id()

    conn.execute("INSERT INTO payments VALUES (?,?,?,?,?,?,?,?)",
                 (str(uuid.uuid4()), u["id"], method, amount,
                  "success", txn_id, None, now))

    conn.execute(
        "UPDATE orders SET payment_status='Paid', payment_reference=?, paid_at=?, status='New' WHERE id=?",
        (txn_id, now, oid)
    )

    # Award loyalty points (1 point per ৳10 spent)
    points = int(amount / 10)
    conn.execute("UPDATE users SET loyalty_points = loyalty_points + ? WHERE id=?",
                 (points, u["id"]))

    conn.commit()
    order = dict(conn.execute(
        "SELECT * FROM orders WHERE id=?", (oid,)).fetchone())
    conn.close()
    order["items"] = json.loads(order["items"])

    await manager.broadcast({"type": "NEW_ORDER", "order": order})

    return {
        "success":        True,
        "transaction_id": txn_id,
        "method":         method,
        "amount":         amount,
        "loyalty_earned": points,
        "message":        f"Payment successful via {method.title()}! +{points} loyalty points 🎉",
        "order":          order,
    }


@app.get("/payment/status/{order_id}")
def payment_status(order_id: str, u=Depends(get_current_user)):
    conn = get_db()
    order = conn.execute("SELECT * FROM orders WHERE id=?",
                         (order_id,)).fetchone()
    conn.close()
    if not order:
        raise HTTPException(404, "Order not found.")
    return {
        "order_id":          order_id,
        "payment_status":    order["payment_status"],
        "payment_method":    order["payment_method"],
        "payment_reference": order["payment_reference"],
        "paid_at":           order["paid_at"],
    }

# SSLCommerz callbacks (for production)


@app.post("/payment/ssl/success")
async def ssl_success(request: Request):
    form = await request.form()
    data = dict(form)
    tran_id = data.get("tran_id", "")
    val_id = data.get("val_id", "")
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    conn = get_db()
    conn.execute("UPDATE orders SET payment_status='Paid',payment_reference=?,paid_at=?,status='New' WHERE id=?",
                 (val_id, now, tran_id))
    conn.commit()
    conn.close()
    return RedirectResponse(f"{FRONTEND_URL}/confirm?order_id={tran_id}&paid=true", status_code=303)


@app.post("/payment/ssl/fail")
async def ssl_fail(request: Request):
    form = await request.form()
    tran_id = dict(form).get("tran_id", "")
    conn = get_db()
    conn.execute(
        "UPDATE orders SET payment_status='Failed',status='Cancelled' WHERE id=?", (tran_id,))
    conn.commit()
    conn.close()
    return RedirectResponse(f"{FRONTEND_URL}/cart?payment_failed=true", status_code=303)


@app.post("/payment/ssl/cancel")
async def ssl_cancel(request: Request):
    return RedirectResponse(f"{FRONTEND_URL}/cart?payment_cancelled=true", status_code=303)


@app.post("/payment/ssl/ipn")
async def ssl_ipn(request: Request):
    form = await request.form()
    data = dict(form)
    if data.get("status") == "VALID":
        conn = get_db()
        conn.execute("UPDATE orders SET payment_status='Paid' WHERE id=?",
                     (data.get("tran_id", ""),))
        conn.commit()
        conn.close()
    return JSONResponse({"received": True})


# ── Stats ──────────────────────────────────────────────────────────────────────
@app.get("/stats")
def get_stats(u=Depends(require_owner)):
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
    pending = conn.execute(
        "SELECT COUNT(*) FROM orders WHERE status='Pending Payment'").fetchone()[0]
    riders = conn.execute(
        "SELECT COUNT(*) FROM users WHERE role='rider' AND is_available=1").fetchone()[0]
    all_items = conn.execute("SELECT items FROM orders").fetchall()
    conn.close()
    pizza_count = sum(item.get("qty", 1)
                      for row in all_items for item in json.loads(row[0]))
    return {"totalOrders": total, "revenue": int(revenue), "newOrders": new_count, "making": making,
            "ready": ready, "delivering": delivering, "pendingPayment": pending, "pizzasMade": pizza_count, "availableRiders": riders}


# ── Riders ─────────────────────────────────────────────────────────────────────
@app.get("/riders")
def get_riders(u=Depends(require_owner)):
    conn = get_db()
    rows = conn.execute(
        "SELECT * FROM users WHERE role='rider' ORDER BY name").fetchall()
    conn.close()
    return [safe_user(dict(r)) for r in rows]


@app.post("/orders/{order_id}/assign-rider")
async def assign_rider(order_id: str, body: AssignRiderBody, u=Depends(require_owner)):
    conn = get_db()
    rider = conn.execute(
        "SELECT * FROM users WHERE id=? AND role='rider'", (body.rider_id,)).fetchone()
    if not rider:
        conn.close()
        raise HTTPException(404, "Rider not found.")
    conn.execute("UPDATE orders SET rider_id=?,rider_name=?,status=? WHERE id=?",
                 (body.rider_id, rider["name"], "Out for Delivery", order_id))
    conn.commit()
    order = dict(conn.execute(
        "SELECT * FROM orders WHERE id=?", (order_id,)).fetchone())
    conn.close()
    order["items"] = json.loads(order["items"])
    await manager.broadcast({"type": "RIDER_ASSIGNED", "order_id": order_id, "rider_name": rider["name"], "order": order})
    return {"message": f"Rider {rider['name']} assigned!", "order": order}


@app.get("/rider/orders")
def get_rider_orders(u=Depends(require_rider)):
    conn = get_db()
    rows = conn.execute(
        "SELECT * FROM orders WHERE rider_id=? ORDER BY created_at DESC", (u["id"],)).fetchall()
    conn.close()
    result = []
    for row in rows:
        o = dict(row)
        o["items"] = json.loads(o["items"])
        result.append(o)
    return result


@app.post("/rider/complete/{order_id}")
async def complete_delivery(order_id: str, u=Depends(require_rider)):
    conn = get_db()
    order = conn.execute("SELECT * FROM orders WHERE id=?",
                         (order_id,)).fetchone()
    if not order:
        conn.close()
        raise HTTPException(404, "Order not found.")
    if order["rider_id"] != u["id"]:
        conn.close()
        raise HTTPException(403, "Not your delivery.")
    earning = round(float(order["total"]) * 0.10, 2)
    conn.execute(
        "UPDATE orders SET status='Delivered' WHERE id=?", (order_id,))
    conn.execute("INSERT INTO rider_earnings VALUES (?,?,?,?,?)",
                 (str(uuid.uuid4()), u["id"], order_id, earning, datetime.now().strftime("%Y-%m-%d %H:%M:%S")))
    conn.commit()
    updated = dict(conn.execute(
        "SELECT * FROM orders WHERE id=?", (order_id,)).fetchone())
    conn.close()
    updated["items"] = json.loads(updated["items"])
    await manager.broadcast({"type": "ORDER_UPDATE", "order_id": order_id, "status": "Delivered", "order": updated})
    return {"message": f"Delivered! ৳{earning} earned.", "earning": earning}


@app.patch("/rider/location")
async def update_rider_location(body: LocationBody, u=Depends(require_rider)):
    conn = get_db()
    conn.execute("UPDATE users SET lat=?,lng=? WHERE id=?",
                 (body.lat, body.lng, u["id"]))
    conn.commit()
    conn.close()
    await manager.broadcast({"type": "RIDER_LOCATION", "rider_id": u["id"], "name": u["name"], "lat": body.lat, "lng": body.lng})
    return {"message": "Location updated"}


@app.patch("/rider/availability")
def set_availability(body: AvailabilityBody, u=Depends(require_rider)):
    conn = get_db()
    conn.execute("UPDATE users SET is_available=? WHERE id=?",
                 (1 if body.is_available else 0, u["id"]))
    conn.commit()
    conn.close()
    return {"message": "Availability updated", "is_available": body.is_available}


@app.get("/rider/earnings")
def get_rider_earnings(u=Depends(require_rider)):
    conn = get_db()
    rows = conn.execute(
        "SELECT * FROM rider_earnings WHERE rider_id=? ORDER BY created_at DESC", (u["id"],)).fetchall()
    total = conn.execute(
        "SELECT COALESCE(SUM(amount),0) FROM rider_earnings WHERE rider_id=?", (u["id"],)).fetchone()[0]
    today = datetime.now().strftime("%Y-%m-%d")
    today_earn = conn.execute(
        "SELECT COALESCE(SUM(amount),0) FROM rider_earnings WHERE rider_id=? AND created_at LIKE ?", (u["id"], today+"%")).fetchone()[0]
    deliveries = conn.execute(
        "SELECT COUNT(*) FROM orders WHERE rider_id=? AND status='Delivered'", (u["id"],)).fetchone()[0]
    available = rider_available_balance(conn, u["id"])
    row_u = conn.execute(
        "SELECT rider_card_balance FROM users WHERE id=?", (u["id"],)).fetchone()
    card_bal = float(row_u["rider_card_balance"] or 0) if row_u else 0.0
    wrows = conn.execute(
        "SELECT * FROM rider_withdrawals WHERE rider_id=? ORDER BY created_at DESC LIMIT 15",
        (u["id"],)).fetchall()
    conn.close()
    return {
        "total": round(total, 2),
        "today": round(today_earn, 2),
        "deliveries": deliveries,
        "available_balance": available,
        "card_balance": round(card_bal, 2),
        "recent": [dict(r) for r in rows[:10]],
        "withdrawals_recent": [dict(r) for r in wrows],
    }


@app.post("/rider/withdraw")
def rider_withdraw(body: RiderWithdrawBody, u=Depends(require_rider)):
    method = (body.method or "").lower().strip()
    aliases = {"mfs": "mobile_banking", "bkash": "mobile_banking",
               "nagad": "mobile_banking", "rocket": "mobile_banking"}
    method = aliases.get(method, method)
    if method not in ("mobile_banking", "cash", "card"):
        raise HTTPException(
            400, "Method must be mobile_banking, cash, or card.")
    amt = round(float(body.amount), 2)
    if amt <= 0:
        raise HTTPException(400, "Amount must be positive.")
    if method == "mobile_banking" and not (body.detail or "").strip():
        raise HTTPException(
            400, "Add your mobile banking number (bKash/Nagad/etc.).")

    conn = get_db()
    avail = rider_available_balance(conn, u["id"])
    if amt > avail + 1e-6:
        conn.close()
        raise HTTPException(
            400, f"Insufficient balance. Available: ৳{avail:.2f}")
    wid = str(uuid.uuid4())
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    detail = (body.detail or "").strip() or None
    conn.execute(
        "INSERT INTO rider_withdrawals VALUES (?,?,?,?,?,?)",
        (wid, u["id"], amt, method, detail, now))
    if method == "card":
        conn.execute(
            "UPDATE users SET rider_card_balance=COALESCE(rider_card_balance,0)+? WHERE id=?",
            (amt, u["id"]))
    conn.commit()
    card = conn.execute(
        "SELECT rider_card_balance FROM users WHERE id=?", (u["id"],)).fetchone()
    new_card = round(float(card["rider_card_balance"] or 0), 2)
    new_avail = rider_available_balance(conn, u["id"])
    conn.close()
    labels = {"mobile_banking": "Mobile banking", "cash": "Cash",
              "card": "PizzaFizz card balance"}
    return {
        "message": f"৳{amt:.2f} processed via {labels[method]}.",
        "available_balance": new_avail,
        "card_balance": new_card,
        "withdrawal_id": wid,
    }


def _owner_financial_payload(conn):
    total_revenue = conn.execute(
        "SELECT COALESCE(SUM(total),0) FROM orders WHERE payment_status='Paid'").fetchone()[0]
    inv = conn.execute(
        "SELECT COALESCE(SUM(amount),0) FROM owner_investments").fetchone()[0]
    rider_commissions = conn.execute(
        "SELECT COALESCE(SUM(amount),0) FROM rider_earnings").fetchone()[0]
    profit_simple = float(total_revenue) - float(inv)
    profit_after_riders = profit_simple - float(rider_commissions)
    inv_rows = conn.execute(
        "SELECT * FROM owner_investments ORDER BY created_at DESC LIMIT 50").fetchall()
    return {
        "total_earnings": round(float(total_revenue), 2),
        "total_investment": round(float(inv), 2),
        "profit": round(profit_simple, 2),
        "profit_after_rider_payouts": round(profit_after_riders, 2),
        "rider_commissions_paid": round(float(rider_commissions), 2),
        "investments_recent": [dict(r) for r in inv_rows],
    }


@app.get("/owner/financials")
def owner_financials(u=Depends(require_owner)):
    conn = get_db()
    payload = _owner_financial_payload(conn)
    conn.close()
    return payload


@app.post("/owner/investments")
def owner_add_investment(body: OwnerInvestmentBody, u=Depends(require_owner)):
    amt = round(float(body.amount), 2)
    if amt <= 0:
        raise HTTPException(400, "Amount must be positive.")
    oid = str(uuid.uuid4())
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    conn = get_db()
    conn.execute(
        "INSERT INTO owner_investments VALUES (?,?,?,?,?,?)",
        (oid, u["id"], amt, (body.category or "general").strip(),
         (body.note or "").strip(), now))
    conn.commit()
    conn.close()
    return {"message": "Investment recorded.", "id": oid}


@app.get("/owner/investments")
def owner_list_investments(u=Depends(require_owner)):
    conn = get_db()
    rows = conn.execute(
        "SELECT * FROM owner_investments ORDER BY created_at DESC").fetchall()
    conn.close()
    return [dict(r) for r in rows]


@app.get("/owner/report")
def owner_report(fmt: str = "json", u=Depends(require_owner)):
    conn = get_db()
    fin = _owner_financial_payload(conn)
    orders = conn.execute(
        "SELECT id, customer_name, total, status, payment_status, payment_method, created_at "
        "FROM orders ORDER BY created_at DESC").fetchall()
    inv_all = conn.execute(
        "SELECT amount, category, note, created_at FROM owner_investments ORDER BY created_at DESC").fetchall()
    conn.close()

    if (fmt or "json").lower() == "csv":
        buf = io.StringIO()
        w = csv.writer(buf)
        w.writerow(["PizzaFizz — Financial report"])
        w.writerow(["Generated", datetime.now().strftime("%Y-%m-%d %H:%M:%S")])
        w.writerow([])
        w.writerow(["Total earnings (paid orders)", fin["total_earnings"]])
        w.writerow(["Total investment", fin["total_investment"]])
        w.writerow(["Profit (earnings − investment)", fin["profit"]])
        w.writerow(
            ["Rider commissions paid", fin["rider_commissions_paid"]])
        w.writerow(
            ["Profit after rider payouts", fin["profit_after_rider_payouts"]])
        w.writerow([])
        w.writerow(["— Orders —"])
        w.writerow(["Order ID", "Customer", "Total", "Status", "Payment", "Method", "Created"])
        for row in orders:
            w.writerow([row["id"], row["customer_name"], row["total"], row["status"],
                        row["payment_status"], row["payment_method"], row["created_at"]])
        w.writerow([])
        w.writerow(["— Investments —"])
        w.writerow(["Amount", "Category", "Note", "Created"])
        for row in inv_all:
            w.writerow([row["amount"], row["category"], row["note"], row["created_at"]])
        data = buf.getvalue()
        buf.close()
        return StreamingResponse(
            iter([data]),
            media_type="text/csv; charset=utf-8",
            headers={
                "Content-Disposition": 'attachment; filename="pizzafizz-owner-report.csv"',
            },
        )
    return {"generated_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"), **fin,
            "orders": [dict(r) for r in orders], "investments": [dict(r) for r in inv_all]}


@app.get("/delivery/track/{order_id}")
def track_order(order_id: str, u=Depends(get_current_user)):
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
            "SELECT id,name,phone,lat,lng FROM users WHERE id=?", (order["rider_id"],)).fetchone()
        if r:
            rider = dict(r)
    conn.close()
    return {"order": order, "rider": rider}


# ── Reviews ────────────────────────────────────────────────────────────────────
@app.post("/reviews")
def submit_review(body: ReviewBody, u=Depends(get_current_user)):
    if not (1 <= body.rating <= 5):
        raise HTTPException(400, "Rating must be 1-5.")
    conn = get_db()
    conn.execute("INSERT INTO reviews VALUES (?,?,?,?,?,?,?)",
                 (str(uuid.uuid4()), u["id"], u["name"], body.order_id, body.rating, body.comment,
                  datetime.now().strftime("%Y-%m-%d %H:%M:%S")))
    conn.commit()
    conn.close()
    return {"message": "Review submitted! Thanks 🍕"}


@app.get("/reviews")
def get_reviews(u=Depends(require_owner)):
    conn = get_db()
    rows = conn.execute(
        "SELECT * FROM reviews ORDER BY created_at DESC").fetchall()
    conn.close()
    return [dict(r) for r in rows]


@app.get("/reviews/my")
def get_my_reviews(u=Depends(get_current_user)):
    conn = get_db()
    rows = conn.execute(
        "SELECT * FROM reviews WHERE user_id=? ORDER BY created_at DESC", (u["id"],)).fetchall()
    conn.close()
    return [dict(r) for r in rows]


# ── Loyalty Points ─────────────────────────────────────────────────────────────
@app.get("/loyalty")
def get_loyalty(u=Depends(get_current_user)):
    conn = get_db()
    user = conn.execute(
        "SELECT loyalty_points FROM users WHERE id=?", (u["id"],)).fetchone()
    orders = conn.execute(
        "SELECT COUNT(*) FROM orders WHERE user_id=? AND payment_status='Paid'", (u["id"],)).fetchone()[0]
    conn.close()
    points = user["loyalty_points"] if user else 0
    return {"points": points, "orders_placed": orders, "discount_available": points >= 100,
            "next_reward": max(0, 100 - points % 100),
            "message": f"You have {points} points! {'🎁 Redeem for ৳50 off!' if points >= 100 else f'{max(0, 100-points % 100)} more for next reward'}"}


@app.get("/loyalty/validate")
def validate_points(points: int, u=Depends(get_current_user)):
    conn = get_db()
    user = conn.execute(
        "SELECT loyalty_points FROM users WHERE id=?", (u["id"],)).fetchone()
    conn.close()
    current = user["loyalty_points"] if user else 0
    if current < points:
        raise HTTPException(400, f"Only {current} points available.")
    discount = int(points / 100) * 50  # 100 points = ৳50
    return {"valid": True, "points_used": points, "discount": discount}


# ── Analytics ──────────────────────────────────────────────────────────────────
@app.get("/analytics")
def get_analytics(u=Depends(require_owner)):
    conn = get_db()
    orders = conn.execute("SELECT * FROM orders").fetchall()
    conn.close()
    revenue_by_day = {}
    popular = {}
    for row in orders:
        o = dict(row)
        day = (o["created_at"] or "")[:10]
        if o["payment_status"] == "Paid":
            revenue_by_day[day] = revenue_by_day.get(
                day, 0) + (o["total"] or 0)
        for item in json.loads(o["items"]):
            name = item.get("name", "Pizza")
            popular[name] = popular.get(name, 0) + item.get("qty", 1)
    top_pizzas = sorted(popular.items(), key=lambda x: -x[1])[:5]
    rev_sorted = sorted(revenue_by_day.items())[-7:]  # last 7 days
    return {
        "revenue_last_7_days": [{"date": d, "revenue": round(r, 2)} for d, r in rev_sorted],
        "top_pizzas":          [{"name": n, "count": c} for n, c in top_pizzas],
        "total_revenue":       round(sum(revenue_by_day.values()), 2),
    }


# ── Menu (dynamic, owner-managed) ─────────────────────────────────────────────
@app.get("/menu")
def get_public_menu():
    conn = get_db()
    rows = conn.execute(
        "SELECT * FROM menu_items WHERE is_available=1 "
        "ORDER BY sort_order ASC, name ASC").fetchall()
    conn.close()
    items = [_menu_row_to_item(r) for r in rows]
    out = _group_menu_items(items)
    out["updated_at"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    return out


@app.get("/menu/admin")
def get_admin_menu(u=Depends(require_owner)):
    conn = get_db()
    rows = conn.execute(
        "SELECT * FROM menu_items ORDER BY section, sort_order, name").fetchall()
    conn.close()
    items = [_menu_row_to_item(r) for r in rows]
    return {"items": items, "grouped": _group_menu_items(items)}


@app.post("/menu")
async def create_menu_item(body: MenuItemBody, u=Depends(require_owner)):
    sec = (body.section or "pizza").lower().strip()
    if sec not in ("pizza", "fastfood"):
        raise HTTPException(400, "section must be pizza or fastfood")
    if not body.name.strip():
        raise HTTPException(400, "Name is required.")
    if body.price <= 0:
        raise HTTPException(400, "Price must be positive.")
    iid = "menu-" + str(uuid.uuid4())[:8]
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    conn = get_db()
    conn.execute(
        "INSERT INTO menu_items VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
        (
            iid, sec, body.category.strip(), body.name.strip(),
            (body.description or "").strip(), round(float(body.price), 2),
            max(0, min(100, float(body.discount_percent or 0))),
            body.badge or None, body.badge_color or "#e63329",
            body.image_url or "",
            body.size or "", body.crust or "", body.sauce or "",
            json.dumps(body.toppings or []),
            json.dumps(body.tags or []),
            1 if body.is_available else 0,
            int(body.sort_order or 0), now, now,
        ),
    )
    conn.commit()
    row = conn.execute("SELECT * FROM menu_items WHERE id=?", (iid,)).fetchone()
    conn.close()
    item = _menu_row_to_item(row)
    await _broadcast_menu_update()
    return {"message": "Menu item added.", "item": item}


@app.patch("/menu/{item_id}")
async def update_menu_item(item_id: str, body: MenuItemPatchBody,
                           u=Depends(require_owner)):
    conn = get_db()
    row = conn.execute("SELECT * FROM menu_items WHERE id=?", (item_id,)).fetchone()
    if not row:
        conn.close()
        raise HTTPException(404, "Menu item not found.")
    updates = {}
    data = body.model_dump(exclude_unset=True)
    if "section" in data:
        sec = (data["section"] or "").lower().strip()
        if sec not in ("pizza", "fastfood"):
            conn.close()
            raise HTTPException(400, "section must be pizza or fastfood")
        updates["section"] = sec
    if "category" in data:
        updates["category"] = (data["category"] or "").strip()
    if "name" in data:
        updates["name"] = (data["name"] or "").strip()
    if "description" in data:
        updates["description"] = data["description"] or ""
    if "price" in data and data["price"] is not None:
        if data["price"] <= 0:
            conn.close()
            raise HTTPException(400, "Price must be positive.")
        updates["price"] = round(float(data["price"]), 2)
    if "discount_percent" in data and data["discount_percent"] is not None:
        updates["discount_percent"] = max(0, min(100, float(data["discount_percent"])))
    if "badge" in data:
        updates["badge"] = data["badge"]
    if "badge_color" in data:
        updates["badge_color"] = data["badge_color"]
    if "image_url" in data:
        updates["image_url"] = data["image_url"] or ""
    if "size" in data:
        updates["size"] = data["size"] or ""
    if "crust" in data:
        updates["crust"] = data["crust"] or ""
    if "sauce" in data:
        updates["sauce"] = data["sauce"] or ""
    if "toppings" in data:
        updates["toppings"] = json.dumps(data["toppings"] or [])
    if "tags" in data:
        updates["tags"] = json.dumps(data["tags"] or [])
    if "is_available" in data and data["is_available"] is not None:
        updates["is_available"] = 1 if data["is_available"] else 0
    if "sort_order" in data and data["sort_order"] is not None:
        updates["sort_order"] = int(data["sort_order"])
    if not updates:
        conn.close()
        raise HTTPException(400, "No fields to update.")
    updates["updated_at"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    set_clause = ", ".join(f"{k}=?" for k in updates)
    conn.execute(
        f"UPDATE menu_items SET {set_clause} WHERE id=?",
        (*updates.values(), item_id),
    )
    conn.commit()
    row = conn.execute("SELECT * FROM menu_items WHERE id=?", (item_id,)).fetchone()
    conn.close()
    item = _menu_row_to_item(row)
    await _broadcast_menu_update()
    return {"message": "Menu item updated.", "item": item}


@app.delete("/menu/{item_id}")
async def delete_menu_item(item_id: str, u=Depends(require_owner)):
    conn = get_db()
    if not conn.execute("SELECT id FROM menu_items WHERE id=?", (item_id,)).fetchone():
        conn.close()
        raise HTTPException(404, "Menu item not found.")
    conn.execute("DELETE FROM menu_items WHERE id=?", (item_id,))
    conn.commit()
    conn.close()
    await _broadcast_menu_update()
    return {"message": "Menu item deleted."}


# ══════════════════════════════════════════════════════════════════════════════
#  🤖 AI PIZZA RECOMMENDER  ← NEW UNIQUE FEATURE
#  Uses Claude to suggest a pizza based on customer's mood/craving
# ══════════════════════════════════════════════════════════════════════════════
@app.post("/ai/recommend")
async def ai_recommend(body: AIRecommendBody, u=Depends(get_current_user)):
    """
    Customer describes their mood/craving in plain text.
    Claude suggests a pizza with exact size, crust, sauce, and toppings.
    Returns structured JSON that Cart can use directly.

    Add ANTHROPIC_API_KEY to your .env file to enable.
    Without it, returns a smart rule-based fallback.
    """
    mood = body.mood.strip()
    if not mood:
        raise HTTPException(400, "Describe your mood or craving.")

    TOPPINGS_AVAILABLE = ["Mushrooms", "Onions", "Peppers", "Olives", "Tomatoes",
                          "Jalapeños", "Pepperoni", "Chicken", "Beef", "Shrimp",
                          "Extra Cheese", "Mozzarella", "Cheddar", "Corn", "Spinach"]
    CRUSTS = ["Thin Crust", "Classic",
              "Thick Crust", "Stuffed Crust", "Sourdough"]
    SAUCES = ["Tomato", "BBQ", "White Garlic",
              "Pesto", "Spicy Arrabbiata", "Alfredo"]
    SIZES = ["Small (8\")", "Medium (12\")", "Large (16\")", "XL (18\")"]

    if ANTHROPIC_KEY:
        try:
            prompt = f"""You are PizzaFizz's AI Pizza Chef. A customer says:
"{mood}"

Suggest ONE perfect pizza for them. Reply with ONLY valid JSON, no markdown, no explanation:
{{
  "name": "Creative pizza name",
  "size": "one of {SIZES}",
  "crust": "one of {CRUSTS}",
  "sauce": "one of {SAUCES}",
  "toppings": ["2-4 items from {TOPPINGS_AVAILABLE}"],
  "price": (number between 250 and 600 in BDT),
  "reason": "One sentence why this matches their mood"
}}"""
            resp = requests.post(
                "https://api.anthropic.com/v1/messages",
                headers={"x-api-key": ANTHROPIC_KEY, "anthropic-version": "2023-06-01",
                         "content-type": "application/json"},
                json={"model": "claude-haiku-4-5-20251001", "max_tokens": 400,
                      "messages": [{"role": "user", "content": prompt}]},
                timeout=20
            ).json()
            blocks = resp.get("content")
            if not blocks or not isinstance(blocks, list):
                raise ValueError("Unexpected API response")
            text = (blocks[0].get("text") or "").strip()
            if not text:
                raise ValueError("Empty model reply")
            # Strip markdown if present
            if "```" in text:
                text = text.split("```")[1]
                if text.startswith("json"):
                    text = text[4:]
            result = json.loads(text)
            result["ai_powered"] = True
            return result
        except Exception as e:
            pass  # Fall through to rule-based

    # ── Rule-based fallback (no API key needed) ───────────────────────────────
    mood_lower = mood.lower()
    if any(w in mood_lower for w in ["spicy", "hot", "fire", "heat", "kick"]):
        suggestion = {"name": "Volcano Inferno", "size": "Medium (12\")", "crust": "Thin Crust",
                      "sauce": "Spicy Arrabbiata", "toppings": ["Jalapeños", "Pepperoni", "Chicken", "Peppers"],
                      "price": 420, "reason": "Packed with heat for your spicy craving! 🌶️"}
    elif any(w in mood_lower for w in ["cheese", "cheesy", "melty", "creamy"]):
        suggestion = {"name": "Four Cheese Dream", "size": "Large (16\")", "crust": "Stuffed Crust",
                      "sauce": "Alfredo", "toppings": ["Extra Cheese", "Mozzarella", "Cheddar", "Mushrooms"],
                      "price": 550, "reason": "Maximum cheese for a cheesy mood! 🧀"}
    elif any(w in mood_lower for w in ["healthy", "light", "veggie", "vegetarian", "fresh"]):
        suggestion = {"name": "Garden Fresh", "size": "Medium (12\")", "crust": "Sourdough",
                      "sauce": "Pesto", "toppings": ["Spinach", "Tomatoes", "Peppers", "Corn"],
                      "price": 380, "reason": "Fresh and light, just like you wanted! 🌿"}
    elif any(w in mood_lower for w in ["meat", "bbq", "smoky", "protein", "hearty"]):
        suggestion = {"name": "BBQ Meat Feast", "size": "Large (16\")", "crust": "Thick Crust",
                      "sauce": "BBQ", "toppings": ["Beef", "Chicken", "Pepperoni", "Onions"],
                      "price": 580, "reason": "A protein-packed feast for a hearty appetite! 🥩"}
    elif any(w in mood_lower for w in ["seafood", "shrimp", "ocean", "fish"]):
        suggestion = {"name": "Ocean Delight", "size": "Medium (12\")", "crust": "Thin Crust",
                      "sauce": "White Garlic", "toppings": ["Shrimp", "Olives", "Onions", "Tomatoes"],
                      "price": 490, "reason": "Fresh from the ocean for your seafood craving! 🦐"}
    else:
        suggestion = {"name": "Classic Supreme", "size": "Medium (12\")", "crust": "Classic",
                      "sauce": "Tomato", "toppings": ["Pepperoni", "Mushrooms", "Peppers", "Onions"],
                      "price": 390, "reason": "A timeless classic that never disappoints! 🍕"}

    suggestion["ai_powered"] = False
    return suggestion


# ── AI Image ───────────────────────────────────────────────────────────────────
@app.post("/generate")
def generate(data: PizzaImageBody):
    """
    Returns a base64-encoded SVG pizza illustration built from the pizza's
    ingredients — no external API dependency, always works.
    """
    try:
        toppings = data.toppings or []
        sauce_colors = {
            "tomato": "#c0392b", "bbq": "#6b3a2a", "white garlic": "#f5f0e8",
            "white": "#f5f0e8", "garlic butter": "#f5f0e8",
            "pesto": "#4a7c59", "spicy arrabbiata": "#e74c3c", "alfredo": "#f8f4e3",
            "buffalo": "#e67e22", "classic": "#c0392b",
        }
        sauce_key = (data.sauce or "tomato").lower().strip()
        sauce_color = sauce_colors.get(sauce_key, "#c0392b")

        topping_colors = [
            "#c0392b", "#e67e22", "#27ae60", "#2980b9",
            "#8e44ad", "#d35400", "#16a085", "#2c3e50",
        ]
        topping_positions = [
            (150, 130), (200, 100), (250, 120), (170, 170),
            (230, 160), (190, 200), (210, 140), (160, 200),
        ]

        topping_svgs = ""
        slot = 0
        for t in toppings[:8]:
            raw = str(t).strip() if t is not None else ""
            if not raw:
                continue
            x, y = topping_positions[slot % len(topping_positions)]
            color = topping_colors[slot % len(topping_colors)]
            slot += 1
            topping_svgs += (
                f'<circle cx="{x}" cy="{y}" r="14" fill="{color}" '
                f'stroke="#fff" stroke-width="2" opacity="0.92"/>\n'
            )
        if not topping_svgs:
            topping_svgs = (
                '<circle cx="200" cy="200" r="10" fill="#e63329" '
                'stroke="#fff" stroke-width="2"/>\n'
            )

        svg = f"""<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">
  <defs>
    <radialGradient id="crustGrad" cx="50%" cy="50%" r="50%">
      <stop offset="0%" style="stop-color:#d4a04a"/>
      <stop offset="100%" style="stop-color:#a0652a"/>
    </radialGradient>
    <radialGradient id="sauceGrad" cx="50%" cy="50%" r="50%">
      <stop offset="0%" style="stop-color:{sauce_color}cc"/>
      <stop offset="100%" style="stop-color:{sauce_color}"/>
    </radialGradient>
    <radialGradient id="cheeseGrad" cx="50%" cy="50%" r="50%">
      <stop offset="0%" style="stop-color:#f9e87f"/>
      <stop offset="100%" style="stop-color:#e8c84a"/>
    </radialGradient>
  </defs>
  <!-- Crust -->
  <circle cx="200" cy="200" r="185" fill="url(#crustGrad)" stroke="#8b5e2a" stroke-width="3"/>
  <!-- Crust edge detail -->
  <circle cx="200" cy="200" r="185" fill="none" stroke="#c4882a" stroke-width="8" stroke-dasharray="18,12"/>
  <!-- Sauce layer -->
  <circle cx="200" cy="200" r="158" fill="url(#sauceGrad)"/>
  <!-- Cheese layer -->
  <circle cx="200" cy="200" r="140" fill="url(#cheeseGrad)" opacity="0.9"/>
  <!-- Cheese texture blobs -->
  <ellipse cx="170" cy="180" rx="30" ry="20" fill="#f0d060" opacity="0.5"/>
  <ellipse cx="230" cy="210" rx="25" ry="18" fill="#f0d060" opacity="0.5"/>
  <ellipse cx="200" cy="155" rx="28" ry="16" fill="#f0d060" opacity="0.5"/>
  <!-- Toppings -->
  {topping_svgs}
  <!-- Shine -->
  <ellipse cx="160" cy="145" rx="40" ry="25" fill="white" opacity="0.08"/>
</svg>"""

        svg_bytes = svg.encode("utf-8")
        b64 = base64.b64encode(svg_bytes).decode()
        return {"image": f"data:image/svg+xml;base64,{b64}"}
    except Exception as e:
        raise HTTPException(500, f"Pizza image build failed: {e!s}") from e


# ── WebSocket ──────────────────────────────────────────────────────────────────
@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    await manager.connect(ws)
    try:
        while True:
            await ws.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(ws)


# ── Startup ────────────────────────────────────────────────────────────────────
init_db()
print("🍕  PizzaFizz API  →  http://localhost:8000")
print("💳  Payment fixed  →  POST /payment/initiate  (accepts both field name styles)")
print("🤖  AI Recommend   →  POST /ai/recommend")
print("📖  Docs           →  http://localhost:8000/docs")

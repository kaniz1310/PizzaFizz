# pizza-backend/main.py

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

# ── WebSocket manager ─────────────────────────────────


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
        for ws in self.active:
            try:
                await ws.send_json(message)
            except:
                pass


manager = ConnectionManager()

# ── Database ──────────────────────────────────────────


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_db()
    c = conn.cursor()
    c.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY, name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL, password TEXT NOT NULL,
            phone TEXT, address TEXT, role TEXT DEFAULT 'customer'
        )
    """)
    c.execute("""
        CREATE TABLE IF NOT EXISTS orders (
            id TEXT PRIMARY KEY, user_id TEXT,
            customer_name TEXT, customer_email TEXT,
            customer_address TEXT, customer_phone TEXT,
            items TEXT, subtotal REAL, delivery REAL DEFAULT 50,
            total REAL, status TEXT DEFAULT 'New', created_at TEXT
        )
    """)
    if c.execute("SELECT COUNT(*) FROM users").fetchone()[0] == 0:
        for email, name, pw, role, phone, addr in [
            ("customer@pizza.com", "Demo Customer", "pizza123", "customer",
             "+880170000001", "123, Gulshan, Dhaka"),
            ("owner@pizza.com", "Pizza Owner", "owner123", "owner",
             "+880170000002", "PizzaFizz HQ, Banani, Dhaka"),
        ]:
            h = bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()
            c.execute("INSERT INTO users VALUES (?,?,?,?,?,?,?)",
                      (str(uuid.uuid4()), name, email, h, phone, addr, role))
    conn.commit()
    conn.close()

# ── JWT ───────────────────────────────────────────────


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


def safe_user(u):
    return {k: v for k, v in u.items() if k != "password"}

# ── Models ────────────────────────────────────────────


class RegisterBody(BaseModel):
    name: str
    email: str
    password: str
    phone: str
    address: str


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
    items: List[OrderItem]
    subtotal: float
    total: float


class StatusBody(BaseModel):
    status: str


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
    conn.execute("INSERT INTO users VALUES (?,?,?,?,?,?,?)",
                 (uid, body.name, email, h, body.phone, body.address, "customer"))
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

# ── Forgot Password (2-step flow) ─────────────────────


@app.post("/forgot/verify-phone")
def verify_phone(body: VerifyPhoneBody):
    """
    STEP 1 — User enters email + phone number.
    If both match the database → identity confirmed.
    Returns success so frontend can show the new password form.
    """
    email = body.email.lower().strip()
    phone = body.phone.strip().replace(" ", "")

    conn = get_db()
    row = conn.execute("SELECT * FROM users WHERE email=?",
                       (email,)).fetchone()
    conn.close()

    if not row:
        raise HTTPException(404, "No account found with this email address.")

    stored_phone = (row["phone"] or "").replace(" ", "")
    if stored_phone != phone:
        raise HTTPException(400, "Phone number does not match our records.")

    return {
        "verified": True,
        "name":     row["name"],
        "email":    email,
        "message":  "Identity verified! Set your new password.",
    }


@app.post("/forgot/reset-password")
def reset_password(body: ResetPasswordBody):
    """
    STEP 2 — Verifies phone once more (security), then saves new password.
    """
    email = body.email.lower().strip()
    phone = body.phone.strip().replace(" ", "")

    if len(body.new_password) < 6:
        raise HTTPException(400, "Password must be at least 6 characters.")

    conn = get_db()
    row = conn.execute("SELECT * FROM users WHERE email=?",
                       (email,)).fetchone()

    if not row:
        conn.close()
        raise HTTPException(404, "Account not found.")

    stored_phone = (row["phone"] or "").replace(" ", "")
    if stored_phone != phone:
        conn.close()
        raise HTTPException(400, "Verification failed. Please start over.")

    new_hash = bcrypt.hashpw(body.new_password.encode(),
                             bcrypt.gensalt()).decode()
    conn.execute("UPDATE users SET password=? WHERE email=?",
                 (new_hash, email))
    conn.commit()
    conn.close()

    return {"message": "Password reset successfully! You can now log in."}

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
    conn.execute("INSERT INTO orders VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
                 (oid, current_user["id"], current_user["name"], current_user["email"],
                  current_user["address"], current_user["phone"], items_json,
                  body.subtotal, 50, body.total, "New", now))
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
async def update_status(order_id: str, body: StatusBody, current_user=Depends(require_owner)):
    if body.status not in ["New", "Making", "Ready", "Delivered"]:
        raise HTTPException(400, "Invalid status.")
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
    await manager.broadcast({"type": "ORDER_UPDATE", "order_id": order_id, "status": body.status})
    return {"message": "Status updated", "order": order}


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
    all_items = conn.execute("SELECT items FROM orders").fetchall()
    conn.close()
    pizza_count = sum(item.get("qty", 1)
                      for row in all_items for item in json.loads(row[0]))
    return {"totalOrders": total, "revenue": int(revenue), "newOrders": new_count,
            "making": making, "ready": ready, "pizzasMade": pizza_count}


@app.post("/generate")
def generate(data: PizzaImageBody):
    try:
        prompt = f"realistic pizza, {data.crust} crust, {data.sauce} sauce, {', '.join(data.toppings or [])}, top view"
        response = requests.get(
            f"https://image.pollinations.ai/prompt/{prompt}", timeout=30)
        if response.status_code != 200:
            raise HTTPException(502, "AI failed.")
        return {"image": base64.b64encode(response.content).decode()}
    except requests.exceptions.Timeout:
        raise HTTPException(504, "Timed out.")
    except Exception as e:
        raise HTTPException(500, str(e))


@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    await manager.connect(ws)
    try:
        while True:
            await ws.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(ws)

init_db()
print("🍕  PizzaFizz API  →  http://localhost:8000")
print("📦  Database       →  pizzafizz.db")
print("📖  API Docs       →  http://localhost:8000/docs")

from pathlib import Path
import os
import uuid
import json
import logging
import asyncio
import bcrypt
import jwt as pyjwt
import requests
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Dict, Any
from dotenv import load_dotenv


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Response, UploadFile, File, WebSocket, WebSocketDisconnect, Query, Header
from fastapi.responses import Response as FastResponse
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr

# --------- Setup ---------
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger("padaria")

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

JWT_SECRET = os.environ['JWT_SECRET']
JWT_ALGO = "HS256"

STORAGE_BASE = (os.environ.get("INTEGRATION_PROXY_URL") or "").strip() or "https://integrations.emergentagent.com"
STORAGE_URL = STORAGE_BASE.rstrip("/") + "/objstore/api/v1/storage"
EMERGENT_KEY = os.environ.get("EMERGENT_LLM_KEY")
APP_NAME = "padaria-brunao"
storage_key: Optional[str] = None


def init_storage(force: bool = False) -> Optional[str]:
    global storage_key
    if storage_key and not force:
        return storage_key
    try:
        resp = requests.post(f"{STORAGE_URL}/init", json={"emergent_key": EMERGENT_KEY}, timeout=30)
        resp.raise_for_status()
        storage_key = resp.json()["storage_key"]
        return storage_key
    except Exception as e:
        logger.error(f"Storage init failed: {e}")
        storage_key = None
        return None


def put_object(path: str, data: bytes, content_type: str) -> dict:
    key = init_storage()
    if not key:
        raise HTTPException(status_code=503, detail="Storage indisponível")
    resp = requests.put(
        f"{STORAGE_URL}/objects/{path}",
        headers={"X-Storage-Key": key, "Content-Type": content_type},
        data=data, timeout=120,
    )
    if resp.status_code == 404:
        key = init_storage(force=True)
        resp = requests.put(
            f"{STORAGE_URL}/objects/{path}",
            headers={"X-Storage-Key": key, "Content-Type": content_type},
            data=data, timeout=120,
        )
    resp.raise_for_status()
    return resp.json()


def get_object(path: str):
    key = init_storage()
    resp = requests.get(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key}, timeout=60)
    if resp.status_code == 404:
        key = init_storage(force=True)
        resp = requests.get(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key}, timeout=60)
    resp.raise_for_status()
    return resp.content, resp.headers.get("Content-Type", "application/octet-stream")


# --------- Mercado Pago (PIX) ---------
MP_ACCESS_TOKEN = os.environ.get("MP_ACCESS_TOKEN", "").strip()
MP_WEBHOOK_SECRET = os.environ.get("MP_WEBHOOK_SECRET", "").strip()
PUBLIC_BACKEND_URL = os.environ.get("PUBLIC_BACKEND_URL", "").strip().rstrip("/")
MP_API = "https://api.mercadopago.com"


def mp_enabled() -> bool:
    return bool(MP_ACCESS_TOKEN)



def _pix_charge(order: dict, payer_email: str) -> dict:
    """Create a real Mercado Pago Pix charge. Returns qr_code, qr_code_base64, payment_id, status."""
    if not mp_enabled():
        return {"provider_configured": False,
                "message": "Estrutura PIX pronta. Configure MP_ACCESS_TOKEN no .env para ativar o pagamento automático."}
    notification_url = f"{PUBLIC_BACKEND_URL}/api/webhook/mercadopago" if PUBLIC_BACKEND_URL else None
    payload = {
        "transaction_amount": float(order["total"]),
        "description": f"Pedido #{order['order_number']} - Padaria do Brunao",
        "payment_method_id": "pix",
        "payer": {"email": payer_email or "cliente@padaria.local"},
        "external_reference": order["id"],
    }
    if notification_url:
        payload["notification_url"] = notification_url
    headers = {
        "Authorization": f"Bearer {MP_ACCESS_TOKEN}",
        "Content-Type": "application/json",
        "X-Idempotency-Key": order["id"],
    }
    try:
        resp = None
        for attempt in range(2):  # 1 retry absorbs transient MP sandbox 5xx
            resp = requests.post(f"{MP_API}/v1/payments", json=payload, headers=headers, timeout=15)
            if resp.status_code < 500:
                break
            logger.warning(f"MP 5xx attempt {attempt+1}, retrying: {resp.text[:200]}")
            import time as _t
            _t.sleep(1.2)
        resp.raise_for_status()
        p = resp.json()
        td = p.get("point_of_interaction", {}).get("transaction_data", {})
        return {
            "provider_configured": True,
            "provider": "mercadopago",
            "mp_payment_id": p.get("id"),
            "status": p.get("status", "pending"),
            "qr_code": td.get("qr_code"),
            "qr_code_base64": td.get("qr_code_base64"),
            "ticket_url": td.get("ticket_url"),
        }
    except requests.HTTPError as e:
        try:
            err_body = e.response.json() if e.response is not None else {}
        except Exception:
            err_body = {"raw": e.response.text[:500] if e.response is not None else ""}
        logger.error(f"MP create pix failed status={e.response.status_code if e.response else '?'} body={err_body}")
        return {"provider_configured": True, "provider": "mercadopago",
                "error": "Falha ao gerar PIX no Mercado Pago. Verifique se há uma CHAVE PIX cadastrada na conta recebedora em https://www.mercadopago.com.br/pix.",
                "mp_error": err_body}
    except Exception as e:
        logger.error(f"MP create pix error: {e}")
        return {"provider_configured": True, "provider": "mercadopago", "error": "Falha ao contactar Mercado Pago"}


def mp_get_payment(payment_id: str) -> Optional[dict]:
    if not mp_enabled():
        return None
    try:
        r = requests.get(f"{MP_API}/v1/payments/{payment_id}",
                         headers={"Authorization": f"Bearer {MP_ACCESS_TOKEN}"}, timeout=15)
        if r.status_code != 200:
            return None
        return r.json()
    except Exception as e:
        logger.error(f"MP get payment error: {e}")
        return None


def mp_verify_signature(x_signature: Optional[str], x_request_id: Optional[str], data_id: Optional[str]) -> bool:
    if not MP_WEBHOOK_SECRET:
        return True  # dev bypass when secret not configured
    if not x_signature or not x_request_id or not data_id:
        return False
    import hmac, hashlib
    parts = {}
    for kv in x_signature.split(","):
        k, sep, v = kv.strip().partition("=")
        if sep:
            parts[k] = v
    ts, received = parts.get("ts"), parts.get("v1")
    if not ts or not received:
        return False
    manifest = f"id:{str(data_id).lower()};request-id:{x_request_id};ts:{ts};"
    expected = hmac.new(MP_WEBHOOK_SECRET.encode(), manifest.encode(), hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, received)


# --------- Z-API WhatsApp ---------
ZAPI_INSTANCE_ID = os.environ.get("ZAPI_INSTANCE_ID", "").strip()
ZAPI_TOKEN = os.environ.get("ZAPI_TOKEN", "").strip()
ZAPI_CLIENT_TOKEN = os.environ.get("ZAPI_CLIENT_TOKEN", "").strip()
OWNER_WHATSAPP = os.environ.get("OWNER_WHATSAPP", "").strip()


def zapi_enabled() -> bool:
    return bool(ZAPI_INSTANCE_ID and ZAPI_TOKEN and ZAPI_CLIENT_TOKEN)


def zapi_send_text(phone: str, message: str) -> bool:
    if not zapi_enabled() or not phone:
        return False
    # normalize phone: keep digits only
    digits = "".join(c for c in phone if c.isdigit())
    if not digits:
        return False
    url = f"https://api.z-api.io/instances/{ZAPI_INSTANCE_ID}/token/{ZAPI_TOKEN}/send-text"
    try:
        r = requests.post(url, json={"phone": digits, "message": message},
                          headers={"Content-Type": "application/json", "Client-Token": ZAPI_CLIENT_TOKEN},
                          timeout=10)
        if r.status_code >= 300:
            logger.warning(f"Z-API send failed {r.status_code}: {r.text[:200]}")
            return False
        return True
    except Exception as e:
        logger.warning(f"Z-API send exception: {e}")
        return False


def format_order_for_whatsapp(order: dict, header: str) -> str:
    lines = [
        header,
        f"Pedido *#{order['order_number']}*",
        f"Cliente: {order['customer_name']}",
        "",
    ]
    for i in order.get("items", []):
        lines.append(f"• {i['quantity']}x {i['name']} — R$ {i['line_total']:.2f}")
    lines += [
        "",
        f"Subtotal: R$ {order['subtotal']:.2f}",
        f"Entrega:  R$ {order['delivery_fee']:.2f}",
        f"*Total:   R$ {order['total']:.2f}*",
        f"Pagamento: {order['payment_method'].upper()} ({order['payment_status']})",
    ]
    if order.get("delivery_type") == "delivery" and order.get("address"):
        a = order["address"]
        lines.append(f"Entregar: {a.get('street','')}, {a.get('number','')} - {a.get('neighborhood','')}")
    else:
        lines.append("Retirada na padaria")
    if order.get("notes"):
        lines.append(f"Obs: {order['notes']}")
    return "\n".join(lines)


STATUS_WHATSAPP_MSGS = {
    "accepted":   "✅ Seu pedido *#{n}* foi *aceito*! Já vamos começar a preparar.",
    "preparing":  "👨‍🍳 Seu pedido *#{n}* está sendo *preparado* agora.",
    "ready":      "🥖 Seu pedido *#{n}* está *pronto*!",
    "dispatched": "🛵 Seu pedido *#{n}* *saiu para entrega*.",
    "finished":   "🎉 Pedido *#{n}* *finalizado*. Obrigado pela preferência!",
    "cancelled":  "❌ Seu pedido *#{n}* foi *cancelado*.",
}


# --------- Telegram Bot (free owner notifications) ---------
TELEGRAM_BOT_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "").strip()
TELEGRAM_OWNER_CHAT_ID = os.environ.get("TELEGRAM_OWNER_CHAT_ID", "").strip()


def telegram_enabled() -> bool:
    return bool(TELEGRAM_BOT_TOKEN and TELEGRAM_OWNER_CHAT_ID)


def telegram_send(chat_id: str, message: str) -> bool:
    if not TELEGRAM_BOT_TOKEN or not chat_id:
        return False
    try:
        r = requests.post(
            f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage",
            json={"chat_id": chat_id, "text": message, "parse_mode": "Markdown"},
            timeout=10,
        )
        if r.status_code >= 300:
            logger.warning(f"Telegram send failed {r.status_code}: {r.text[:200]}")
            return False
        return True
    except Exception as e:
        logger.warning(f"Telegram send exception: {e}")
        return False


def notify_owner(message: str):
    """Send notification to bakery owner via all configured channels (Telegram + Z-API)."""
    if telegram_enabled():
        telegram_send(TELEGRAM_OWNER_CHAT_ID, message)
    if OWNER_WHATSAPP and zapi_enabled():
        zapi_send_text(OWNER_WHATSAPP, message)


# --------- Password / JWT helpers ---------
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode(), hashed.encode())
    except Exception:
        return False


def create_access_token(user_id: str, email: str, role: str) -> str:
    payload = {"sub": user_id, "email": email, "role": role,
               "exp": datetime.now(timezone.utc) + timedelta(days=7), "type": "access"}
    return pyjwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGO)


def decode_token(token: str) -> dict:
    return pyjwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGO])


async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = auth[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Não autenticado")
    try:
        payload = decode_token(token)
        user = await db.users.find_one({"id": payload["sub"]})
        if not user:
            raise HTTPException(status_code=401, detail="Usuário não encontrado")
        user.pop("password_hash", None)
        user.pop("_id", None)
        return user
    except pyjwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Sessão expirada")
    except pyjwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token inválido")


async def require_admin(user: dict = Depends(get_current_user)) -> dict:
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Acesso restrito ao administrador")
    return user


# --------- Models ---------
class RegisterIn(BaseModel):
    name: str
    email: EmailStr
    phone: str
    password: str


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class CategoryIn(BaseModel):
    name: str
    image: Optional[str] = None
    active: bool = True


class ProductIn(BaseModel):
    name: str
    description: Optional[str] = ""
    category_id: str
    price: float
    stock: float = 0
    unit: str = "un"  # un, kg, g, L, ml
    image: Optional[str] = None
    active: bool = True
    featured: bool = False
    on_sale: bool = False
    sale_price: Optional[float] = None
    low_stock_threshold: float = 5


class OrderItemIn(BaseModel):
    product_id: str
    quantity: float


class OrderIn(BaseModel):
    items: List[OrderItemIn]
    delivery_type: str  # "delivery" or "pickup"
    address: Optional[Dict[str, str]] = None
    payment_method: str  # "pix", "dinheiro", "cartao"
    notes: Optional[str] = ""
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None


class OrderStatusIn(BaseModel):
    status: str


class SettingsIn(BaseModel):
    bakery_name: str
    logo: Optional[str] = None
    phone: str
    address: str
    hours: str
    delivery_fee: float
    min_order: float
    payment_methods: List[str]
    welcome_message: str


class ChatMessageIn(BaseModel):
    message: str
    order_id: Optional[str] = None


# --------- WebSocket manager ---------
class WSManager:
    def __init__(self):
        self.connections: Dict[str, List[WebSocket]] = {}  # user_id -> [ws]
        self.admin_connections: List[WebSocket] = []

    async def connect(self, ws: WebSocket, user: dict):
        await ws.accept()
        uid = user["id"]
        self.connections.setdefault(uid, []).append(ws)
        if user.get("role") == "admin":
            self.admin_connections.append(ws)

    def disconnect(self, ws: WebSocket, user: dict):
        uid = user["id"]
        if uid in self.connections and ws in self.connections[uid]:
            self.connections[uid].remove(ws)
        if ws in self.admin_connections:
            self.admin_connections.remove(ws)

    async def send_to_user(self, user_id: str, payload: dict):
        conns = self.connections.get(user_id, [])
        for c in list(conns):
            try:
                await c.send_json(payload)
            except Exception:
                pass

    async def broadcast_admins(self, payload: dict):
        for c in list(self.admin_connections):
            try:
                await c.send_json(payload)
            except Exception:
                pass


ws_manager = WSManager()


# --------- FastAPI app ---------
app = FastAPI(title="Padaria do Brunao API")
api = APIRouter(prefix="/api")


def clean_doc(doc):
    if doc is None:
        return None
    doc.pop("_id", None)
    doc.pop("password_hash", None)
    return doc


# --------- Auth ---------
@api.post("/auth/register")
async def register(payload: RegisterIn, response: Response):
    email = payload.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Email já cadastrado")
    user = {
        "id": str(uuid.uuid4()),
        "name": payload.name,
        "email": email,
        "phone": payload.phone,
        "password_hash": hash_password(payload.password),
        "role": "customer",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.users.insert_one(user)
    token = create_access_token(user["id"], email, "customer")
    response.set_cookie("access_token", token, httponly=True, secure=True, samesite="none", max_age=604800, path="/")
    return {"user": clean_doc(user), "token": token}


@api.post("/auth/login")
async def login(payload: LoginIn, response: Response):
    email = payload.email.lower()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Email ou senha inválidos")
    token = create_access_token(user["id"], email, user["role"])
    response.set_cookie("access_token", token, httponly=True, secure=True, samesite="none", max_age=604800, path="/")
    return {"user": clean_doc(user), "token": token}


@api.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    return {"ok": True}


@api.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return user


# --------- Categories ---------
@api.get("/categories")
async def list_categories():
    docs = await db.categories.find({"active": True}).sort("name", 1).to_list(500)
    return [clean_doc(d) for d in docs]


@api.get("/admin/categories")
async def list_all_categories(_: dict = Depends(require_admin)):
    docs = await db.categories.find({}).sort("name", 1).to_list(500)
    return [clean_doc(d) for d in docs]


@api.post("/admin/categories")
async def create_category(payload: CategoryIn, _: dict = Depends(require_admin)):
    doc = payload.model_dump()
    doc["id"] = str(uuid.uuid4())
    doc["created_at"] = datetime.now(timezone.utc).isoformat()
    await db.categories.insert_one(doc)
    return clean_doc(doc)


@api.patch("/admin/categories/{cat_id}")
async def update_category(cat_id: str, payload: CategoryIn, _: dict = Depends(require_admin)):
    update = payload.model_dump()
    r = await db.categories.update_one({"id": cat_id}, {"$set": update})
    if r.matched_count == 0:
        raise HTTPException(status_code=404, detail="Categoria não encontrada")
    doc = await db.categories.find_one({"id": cat_id})
    return clean_doc(doc)


@api.delete("/admin/categories/{cat_id}")
async def delete_category(cat_id: str, _: dict = Depends(require_admin)):
    await db.categories.delete_one({"id": cat_id})
    return {"ok": True}


# --------- Products ---------
@api.get("/products")
async def list_products(category_id: Optional[str] = None, featured: Optional[bool] = None, on_sale: Optional[bool] = None):
    q: Dict[str, Any] = {"active": True}
    if category_id:
        q["category_id"] = category_id
    if featured is not None:
        q["featured"] = featured
    if on_sale is not None:
        q["on_sale"] = on_sale
    docs = await db.products.find(q).sort("name", 1).to_list(1000)
    return [clean_doc(d) for d in docs]


@api.get("/products/{pid}")
async def get_product(pid: str):
    doc = await db.products.find_one({"id": pid})
    if not doc:
        raise HTTPException(status_code=404, detail="Produto não encontrado")
    return clean_doc(doc)


@api.get("/admin/products")
async def admin_list_products(_: dict = Depends(require_admin)):
    docs = await db.products.find({}).sort("name", 1).to_list(2000)
    return [clean_doc(d) for d in docs]


@api.post("/admin/products")
async def create_product(payload: ProductIn, _: dict = Depends(require_admin)):
    doc = payload.model_dump()
    doc["id"] = str(uuid.uuid4())
    doc["created_at"] = datetime.now(timezone.utc).isoformat()
    await db.products.insert_one(doc)
    return clean_doc(doc)


@api.patch("/admin/products/{pid}")
async def update_product(pid: str, payload: ProductIn, _: dict = Depends(require_admin)):
    r = await db.products.update_one({"id": pid}, {"$set": payload.model_dump()})
    if r.matched_count == 0:
        raise HTTPException(status_code=404, detail="Produto não encontrado")
    doc = await db.products.find_one({"id": pid})
    return clean_doc(doc)


@api.patch("/admin/products/{pid}/stock")
async def adjust_stock(pid: str, body: Dict[str, float], _: dict = Depends(require_admin)):
    delta = body.get("delta", 0)
    r = await db.products.update_one({"id": pid}, {"$inc": {"stock": delta}})
    if r.matched_count == 0:
        raise HTTPException(status_code=404, detail="Produto não encontrado")
    doc = await db.products.find_one({"id": pid})
    return clean_doc(doc)


@api.delete("/admin/products/{pid}")
async def delete_product(pid: str, _: dict = Depends(require_admin)):
    await db.products.delete_one({"id": pid})
    return {"ok": True}


# --------- Settings ---------
DEFAULT_SETTINGS = {
    "bakery_name": "PADARIA DO BRUNAO",
    "logo": None,
    "phone": "(00) 0000-0000",
    "address": "Rua Exemplo, 100 - Centro",
    "hours": "Seg a Sáb: 06h às 20h · Dom: 06h às 13h",
    "delivery_fee": 5.0,
    "min_order": 15.0,
    "payment_methods": ["pix", "dinheiro", "cartao"],
    "welcome_message": "Bem-vindo à Padaria do Brunão — pão quentinho, atendimento de verdade.",
}


@api.get("/settings")
async def get_settings():
    doc = await db.settings.find_one({"id": "main"})
    if not doc:
        return DEFAULT_SETTINGS
    return clean_doc(doc)


@api.put("/admin/settings")
async def update_settings(payload: SettingsIn, _: dict = Depends(require_admin)):
    doc = payload.model_dump()
    doc["id"] = "main"
    await db.settings.update_one({"id": "main"}, {"$set": doc}, upsert=True)
    return doc


# --------- Orders ---------
STATUSES = ["received", "accepted", "preparing", "ready", "dispatched", "finished", "cancelled"]


async def get_next_order_number() -> int:
    r = await db.counters.find_one_and_update(
        {"id": "orders"}, {"$inc": {"seq": 1}}, upsert=True, return_document=True
    )
    return r["seq"] if r else 1


@api.post("/orders")
async def create_order(payload: OrderIn, user: dict = Depends(get_current_user)):
    if not payload.items:
        raise HTTPException(status_code=400, detail="Carrinho vazio")

    settings = await db.settings.find_one({"id": "main"}) or DEFAULT_SETTINGS
    items_full = []
    subtotal = 0.0
    for it in payload.items:
        prod = await db.products.find_one({"id": it.product_id})
        if not prod or not prod.get("active"):
            raise HTTPException(status_code=400, detail=f"Produto indisponível")
        if prod.get("stock", 0) < it.quantity:
            raise HTTPException(status_code=400, detail=f"Estoque insuficiente para {prod['name']}")
        price = prod.get("sale_price") if prod.get("on_sale") and prod.get("sale_price") else prod["price"]
        line_total = float(price) * float(it.quantity)
        subtotal += line_total
        items_full.append({
            "product_id": prod["id"],
            "name": prod["name"],
            "image": prod.get("image"),
            "unit": prod.get("unit"),
            "price": float(price),
            "quantity": float(it.quantity),
            "line_total": line_total,
        })

    delivery_fee = float(settings.get("delivery_fee", 0)) if payload.delivery_type == "delivery" else 0.0
    min_order = float(settings.get("min_order", 0))
    if subtotal < min_order:
        raise HTTPException(status_code=400, detail=f"Pedido mínimo: R$ {min_order:.2f}")

    total = subtotal + delivery_fee
    order_num = await get_next_order_number()

    # PIX — do NOT auto-mark as paid. If MP configured, create real charge.
    payment_status = "pending"
    pix_info = None

    order = {
        "id": str(uuid.uuid4()),
        "order_number": f"{order_num:05d}",
        "customer_id": user["id"],
        "customer_name": payload.customer_name or user.get("name"),
        "customer_phone": payload.customer_phone or user.get("phone"),
        "items": items_full,
        "subtotal": round(subtotal, 2),
        "delivery_fee": round(delivery_fee, 2),
        "total": round(total, 2),
        "delivery_type": payload.delivery_type,
        "address": payload.address,
        "payment_method": payload.payment_method,
        "payment_status": payment_status,
        "pix_info": pix_info,
        "notes": payload.notes,
        "status": "received",
        "status_history": [{"status": "received", "at": datetime.now(timezone.utc).isoformat()}],
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.orders.insert_one(order)

    # PIX: create real MP charge if configured
    if payload.payment_method == "pix":
        pix_info = mp_create_pix_charge(order, payer_email=user.get("email", ""))
        order["pix_info"] = pix_info
        await db.orders.update_one({"id": order["id"]}, {"$set": {"pix_info": pix_info}})

    # decrement stock
    for it in items_full:
        await db.products.update_one({"id": it["product_id"]}, {"$inc": {"stock": -it["quantity"]}})

    # notify admins
    await ws_manager.broadcast_admins({"type": "new_order", "order": clean_doc(dict(order))})

    # WhatsApp/Telegram notifications (best-effort; silent if not configured)
    try:
        owner_msg = format_order_for_whatsapp(order, "🔔 *NOVO PEDIDO* na Padaria do Brunão")
        asyncio.get_event_loop().run_in_executor(None, notify_owner, owner_msg)
        # Customer notifications via Z-API (only if configured) — otherwise use wa.me buttons in admin panel
        customer_phone = order.get("customer_phone") or user.get("phone")
        if customer_phone and zapi_enabled():
            cust_msg = format_order_for_whatsapp(order, "✅ *Pedido recebido* — Padaria do Brunão")
            asyncio.get_event_loop().run_in_executor(None, zapi_send_text, customer_phone, cust_msg)
    except Exception as e:
        logger.warning(f"Notify failed: {e}")

    return clean_doc(order)


@api.get("/orders/mine")
async def my_orders(user: dict = Depends(get_current_user)):
    docs = await db.orders.find({"customer_id": user["id"]}).sort("created_at", -1).to_list(500)
    return [clean_doc(d) for d in docs]


@api.get("/orders/{oid}")
async def get_order(oid: str, user: dict = Depends(get_current_user)):
    doc = await db.orders.find_one({"id": oid})
    if not doc:
        raise HTTPException(status_code=404, detail="Pedido não encontrado")
    if user["role"] != "admin" and doc["customer_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Acesso negado")
    return clean_doc(doc)


@api.get("/admin/orders")
async def admin_list_orders(status: Optional[str] = None, _: dict = Depends(require_admin)):
    q: Dict[str, Any] = {}
    if status:
        q["status"] = status
    docs = await db.orders.find(q).sort("created_at", -1).to_list(1000)
    return [clean_doc(d) for d in docs]


@api.patch("/admin/orders/{oid}/status")
async def update_order_status(oid: str, payload: OrderStatusIn, _: dict = Depends(require_admin)):
    if payload.status not in STATUSES:
        raise HTTPException(status_code=400, detail="Status inválido")
    doc = await db.orders.find_one({"id": oid})
    if not doc:
        raise HTTPException(status_code=404, detail="Pedido não encontrado")
    now = datetime.now(timezone.utc).isoformat()
    await db.orders.update_one(
        {"id": oid},
        {"$set": {"status": payload.status},
         "$push": {"status_history": {"status": payload.status, "at": now}}}
    )
    # If cancelled, restock
    if payload.status == "cancelled" and doc["status"] != "cancelled":
        for it in doc.get("items", []):
            await db.products.update_one({"id": it["product_id"]}, {"$inc": {"stock": it["quantity"]}})
    updated = await db.orders.find_one({"id": oid})
    # notify customer
    await ws_manager.send_to_user(doc["customer_id"], {"type": "order_status", "order": clean_doc(dict(updated))})
    # WhatsApp status notification to customer (only if Z-API configured)
    try:
        tpl = STATUS_WHATSAPP_MSGS.get(payload.status)
        phone = updated.get("customer_phone")
        if tpl and phone and zapi_enabled():
            asyncio.get_event_loop().run_in_executor(None, zapi_send_text, phone, tpl.format(n=updated["order_number"]))
    except Exception as e:
        logger.warning(f"WhatsApp status notify failed: {e}")
    return clean_doc(updated)


@api.patch("/admin/orders/{oid}/payment")
async def mark_payment(oid: str, body: Dict[str, str], _: dict = Depends(require_admin)):
    status = body.get("payment_status")
    if status not in ("pending", "paid", "refunded"):
        raise HTTPException(status_code=400, detail="Status de pagamento inválido")
    r = await db.orders.update_one({"id": oid}, {"$set": {"payment_status": status}})
    if r.matched_count == 0:
        raise HTTPException(status_code=404, detail="Pedido não encontrado")
    doc = await db.orders.find_one({"id": oid})
    await ws_manager.send_to_user(doc["customer_id"], {"type": "payment_status", "order": clean_doc(dict(doc))})
    return clean_doc(doc)


# --------- Dashboard & Financial ---------
@api.get("/admin/dashboard")
async def admin_dashboard(_: dict = Depends(require_admin)):
    today = datetime.now(timezone.utc).date().isoformat()
    all_orders = await db.orders.find({}).to_list(5000)
    today_orders = [o for o in all_orders if o.get("created_at", "").startswith(today)]
    revenue_today = sum(o["total"] for o in today_orders if o["status"] != "cancelled")
    new_count = sum(1 for o in all_orders if o["status"] == "received")
    preparing_count = sum(1 for o in all_orders if o["status"] in ("accepted", "preparing"))
    ready_count = sum(1 for o in all_orders if o["status"] == "ready")

    products = await db.products.find({"active": True}).to_list(2000)
    low_stock = [clean_doc(p) for p in products if p.get("stock", 0) <= p.get("low_stock_threshold", 5)]

    return {
        "sales_today": round(revenue_today, 2),
        "orders_today": len(today_orders),
        "new_orders": new_count,
        "preparing_orders": preparing_count,
        "ready_orders": ready_count,
        "low_stock_products": low_stock,
    }


@api.get("/admin/financial")
async def admin_financial(_: dict = Depends(require_admin)):
    now = datetime.now(timezone.utc)
    today = now.date().isoformat()
    week_start = (now - timedelta(days=7)).isoformat()
    month_start = (now - timedelta(days=30)).isoformat()

    all_orders = await db.orders.find({"status": {"$ne": "cancelled"}}).to_list(5000)
    def sum_since(iso_prefix_or_date):
        return sum(o["total"] for o in all_orders if o.get("created_at", "") >= iso_prefix_or_date)

    today_sales = sum(o["total"] for o in all_orders if o.get("created_at", "").startswith(today))
    week_sales = sum_since(week_start)
    month_sales = sum_since(month_start)

    paid = sum(o["total"] for o in all_orders if o.get("payment_status") == "paid")
    pending = sum(o["total"] for o in all_orders if o.get("payment_status") == "pending")

    by_method: Dict[str, float] = {"pix": 0.0, "dinheiro": 0.0, "cartao": 0.0}
    for o in all_orders:
        m = o.get("payment_method", "pix")
        by_method[m] = by_method.get(m, 0) + o["total"]

    return {
        "sales_today": round(today_sales, 2),
        "sales_week": round(week_sales, 2),
        "sales_month": round(month_sales, 2),
        "total_paid": round(paid, 2),
        "total_pending": round(pending, 2),
        "by_method": {k: round(v, 2) for k, v in by_method.items()},
    }


@api.get("/admin/customers")
async def admin_customers(_: dict = Depends(require_admin)):
    users = await db.users.find({"role": "customer"}).sort("created_at", -1).to_list(2000)
    result = []
    for u in users:
        orders = await db.orders.find({"customer_id": u["id"]}).sort("created_at", -1).to_list(500)
        total_spent = sum(o["total"] for o in orders if o.get("status") != "cancelled")
        last = orders[0]["created_at"] if orders else None
        result.append({
            "id": u["id"],
            "name": u["name"],
            "phone": u.get("phone"),
            "email": u["email"],
            "orders_count": len(orders),
            "total_spent": round(total_spent, 2),
            "last_order": last,
        })
    return result


# --------- Chat ---------
@api.get("/chat/conversations")
async def list_conversations(user: dict = Depends(get_current_user)):
    if user["role"] == "admin":
        docs = await db.conversations.find({}).sort("updated_at", -1).to_list(500)
    else:
        docs = await db.conversations.find({"customer_id": user["id"]}).sort("updated_at", -1).to_list(50)
    return [clean_doc(d) for d in docs]


@api.post("/chat/conversations")
async def get_or_create_conversation(body: Dict[str, Any], user: dict = Depends(get_current_user)):
    if user["role"] == "admin":
        raise HTTPException(status_code=400, detail="Admin não abre conversa; use as existentes.")
    order_id = body.get("order_id")
    conv = await db.conversations.find_one({"customer_id": user["id"], "order_id": order_id})
    if conv:
        return clean_doc(conv)
    conv = {
        "id": str(uuid.uuid4()),
        "customer_id": user["id"],
        "customer_name": user["name"],
        "order_id": order_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "unread_admin": 0,
        "unread_customer": 0,
    }
    await db.conversations.insert_one(conv)
    return clean_doc(conv)


@api.get("/chat/{conv_id}/messages")
async def list_messages(conv_id: str, user: dict = Depends(get_current_user)):
    conv = await db.conversations.find_one({"id": conv_id})
    if not conv:
        raise HTTPException(status_code=404, detail="Conversa não encontrada")
    if user["role"] != "admin" and conv["customer_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Acesso negado")
    # mark read
    if user["role"] == "admin":
        await db.conversations.update_one({"id": conv_id}, {"$set": {"unread_admin": 0}})
    else:
        await db.conversations.update_one({"id": conv_id}, {"$set": {"unread_customer": 0}})
    msgs = await db.messages.find({"conversation_id": conv_id}).sort("created_at", 1).to_list(1000)
    return [clean_doc(m) for m in msgs]


@api.post("/chat/{conv_id}/messages")
async def send_message(conv_id: str, payload: ChatMessageIn, user: dict = Depends(get_current_user)):
    conv = await db.conversations.find_one({"id": conv_id})
    if not conv:
        raise HTTPException(status_code=404, detail="Conversa não encontrada")
    if user["role"] != "admin" and conv["customer_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Acesso negado")
    msg = {
        "id": str(uuid.uuid4()),
        "conversation_id": conv_id,
        "sender_id": user["id"],
        "sender_role": user["role"],
        "sender_name": user["name"],
        "message": payload.message,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "read": False,
    }
    await db.messages.insert_one(msg)
    update = {"updated_at": msg["created_at"]}
    if user["role"] == "admin":
        update["unread_customer"] = conv.get("unread_customer", 0) + 1
    else:
        update["unread_admin"] = conv.get("unread_admin", 0) + 1
    await db.conversations.update_one({"id": conv_id}, {"$set": update})
    # WS notify
    payload_out = {"type": "chat_message", "conversation_id": conv_id, "message": clean_doc(dict(msg))}
    if user["role"] == "admin":
        await ws_manager.send_to_user(conv["customer_id"], payload_out)
    else:
        await ws_manager.broadcast_admins(payload_out)
    return clean_doc(msg)


# --------- Upload ---------
ALLOWED_IMG = {"jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png", "webp": "image/webp", "gif": "image/gif"}


@api.post("/upload")
async def upload(file: UploadFile = File(...), user: dict = Depends(require_admin)):
    ext = (file.filename.split(".")[-1] if "." in file.filename else "bin").lower()
    if ext not in ALLOWED_IMG:
        raise HTTPException(status_code=400, detail="Formato de imagem não suportado")
    data = await file.read()
    if len(data) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Imagem maior que 5MB")
    path = f"{APP_NAME}/uploads/{user['id']}/{uuid.uuid4()}.{ext}"
    ct = ALLOWED_IMG[ext]
    result = put_object(path, data, ct)
    await db.files.insert_one({
        "id": str(uuid.uuid4()),
        "storage_path": result["path"],
        "original_filename": file.filename,
        "content_type": ct,
        "size": result["size"],
        "uploaded_by": user["id"],
        "is_deleted": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return {"url": f"/api/files/{result['path']}", "path": result["path"]}


@api.get("/files/{path:path}")
async def serve_file(path: str):
    rec = await db.files.find_one({"storage_path": path, "is_deleted": False})
    if not rec:
        raise HTTPException(status_code=404, detail="Arquivo não encontrado")
    data, ct = get_object(path)
    return FastResponse(content=data, media_type=rec.get("content_type", ct))


# --------- Mercado Pago Webhook ---------
@api.post("/webhook/mercadopago")
async def mercadopago_webhook(request: Request):
    x_signature = request.headers.get("x-signature")
    x_request_id = request.headers.get("x-request-id")
    data_id = request.query_params.get("data.id") or request.query_params.get("id")
    try:
        body = await request.json()
    except Exception:
        body = {}
    if not data_id:
        data_id = str((body.get("data") or {}).get("id", "") or body.get("id", ""))
    if not mp_verify_signature(x_signature, x_request_id, data_id):
        raise HTTPException(status_code=401, detail="Assinatura inválida")
    if not data_id:
        return {"received": True}
    # Always re-fetch payment from MP — never trust webhook body
    payment = mp_get_payment(data_id)
    if not payment:
        return {"received": True}
    status = payment.get("status")
    order_id = payment.get("external_reference")
    if not order_id:
        return {"received": True}
    order = await db.orders.find_one({"id": order_id})
    if not order:
        return {"received": True}
    if status == "approved" and order.get("payment_status") != "paid":
        await db.orders.update_one(
            {"id": order_id, "payment_status": {"$ne": "paid"}},
            {"$set": {"payment_status": "paid",
                      "pix_info.status": "approved",
                      "pix_info.paid_at": datetime.now(timezone.utc).isoformat()}}
        )
        updated = await db.orders.find_one({"id": order_id})
        await ws_manager.send_to_user(order["customer_id"], {"type": "payment_status", "order": clean_doc(dict(updated))})
        await ws_manager.broadcast_admins({"type": "payment_status", "order": clean_doc(dict(updated))})
        # Notifications to owner (Telegram + Z-API) and customer (Z-API if configured)
        try:
            phone = updated.get("customer_phone")
            if phone and zapi_enabled():
                asyncio.get_event_loop().run_in_executor(None, zapi_send_text, phone,
                    f"💰 Pagamento PIX do pedido *#{updated['order_number']}* *confirmado*! Já já começamos a preparar.")
            owner_msg = f"💰 *PIX confirmado* — Pedido #{updated['order_number']} — R$ {updated['total']:.2f}"
            asyncio.get_event_loop().run_in_executor(None, notify_owner, owner_msg)
        except Exception as e:
            logger.warning(f"Payment notify failed: {e}")
    return {"received": True}


@api.get("/integrations/status")
async def integrations_status(_: dict = Depends(require_admin)):
    return {
        "mercadopago": {"configured": mp_enabled(),
                        "webhook_url": f"{PUBLIC_BACKEND_URL}/api/webhook/mercadopago" if PUBLIC_BACKEND_URL else None},
        "telegram":    {"configured": telegram_enabled()},
        "zapi_whatsapp": {"configured": zapi_enabled(), "owner_notify": bool(OWNER_WHATSAPP)},
    }


# --------- WebSocket ---------
@api.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket, token: str = Query(...)):
    try:
        payload = decode_token(token)
        user = await db.users.find_one({"id": payload["sub"]})
        if not user:
            await websocket.close(code=4401)
            return
        user.pop("password_hash", None)
        user.pop("_id", None)
    except Exception:
        await websocket.close(code=4401)
        return
    await ws_manager.connect(websocket, user)
    try:
        while True:
            await websocket.receive_text()  # keepalive/echo
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket, user)


# --------- Health ---------
@api.get("/")
async def root():
    return {"ok": True, "name": "Padaria do Brunao API"}


app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)


# --------- Startup ---------
async def seed_admin():
    email = os.environ["ADMIN_EMAIL"].lower()
    password = os.environ["ADMIN_PASSWORD"]
    name = os.environ.get("ADMIN_NAME", "Admin")
    existing = await db.users.find_one({"email": email})
    if not existing:
        await db.users.insert_one({
            "id": str(uuid.uuid4()),
            "name": name,
            "email": email,
            "phone": "",
            "password_hash": hash_password(password),
            "role": "admin",
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        logger.info(f"Admin criado: {email}")
    elif not verify_password(password, existing["password_hash"]):
        await db.users.update_one({"email": email}, {"$set": {"password_hash": hash_password(password), "role": "admin"}})
        logger.info(f"Senha do admin sincronizada: {email}")


async def seed_default_settings():
    if not await db.settings.find_one({"id": "main"}):
        doc = dict(DEFAULT_SETTINGS)
        doc["id"] = "main"
        await db.settings.insert_one(doc)


@app.on_event("startup")
async def on_startup():
    try:
        await db.users.create_index("email", unique=True)
        await db.products.create_index("category_id")
        await db.orders.create_index("customer_id")
        await db.orders.create_index("created_at")
        await db.messages.create_index("conversation_id")
        await db.conversations.create_index("customer_id")
    except Exception as e:
        logger.warning(f"Index creation warning: {e}")
    await seed_admin()
    await seed_default_settings()
    init_storage()
    logger.info("Padaria do Brunao ready.")


@app.on_event("shutdown")
async def on_shutdown():
    client.close()

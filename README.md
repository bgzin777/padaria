# 🥖 PADARIA DO BRUNAO — Sistema Completo de Pedidos Online

Sistema completo para uma padaria física receber pedidos online, com painel administrativo, notificações em tempo real, integração PIX (Mercado Pago) e notificações via Telegram e WhatsApp (wa.me).

**Stack**: FastAPI + MongoDB + React 19 + Tailwind + Shadcn UI + WebSocket + JWT

---

## 📁 Estrutura do projeto

```
padaria-brunao/
├── backend/                        # FastAPI + MongoDB
│   ├── server.py                   # API completa (auth, pedidos, chat, admin, PIX, upload)
│   ├── requirements.txt            # Deps Python
│   ├── Dockerfile
│   ├── .env                        # Config real (NÃO commitar)
│   └── .env.example                # Template
├── frontend/                       # React 19 + Tailwind
│   ├── src/
│   │   ├── App.js                  # Roteamento
│   │   ├── index.css               # Tema (Playfair + Manrope + paleta amber)
│   │   ├── lib/
│   │   │   ├── api.js              # Axios + helpers
│   │   │   └── whatsapp.js         # Templates + wa.me
│   │   ├── context/
│   │   │   ├── AuthContext.jsx     # JWT (cookie + bearer)
│   │   │   ├── CartContext.jsx     # Carrinho persistente (localStorage)
│   │   │   ├── SettingsContext.jsx # Configurações da padaria
│   │   │   └── RealtimeContext.jsx # WebSocket + toasts + beep
│   │   ├── components/
│   │   │   ├── ClientLayout.jsx    # Header + BottomNav mobile
│   │   │   ├── AdminLayout.jsx     # Sidebar admin
│   │   │   ├── ProductCard.jsx
│   │   │   ├── ProtectedRoute.jsx
│   │   │   ├── OrderStatusBadge.jsx
│   │   │   └── ui/                 # Shadcn (~50 componentes)
│   │   └── pages/
│   │       ├── Home.jsx, Products.jsx, Cart.jsx, Checkout.jsx
│   │       ├── Orders.jsx, Chat.jsx, Account.jsx, Auth.jsx
│   │       └── admin/
│   │           ├── AdminDashboard.jsx    # KPIs em tempo real
│   │           ├── AdminOrders.jsx       # Fluxo + impressão + wa.me
│   │           ├── AdminProducts.jsx     # CRUD + upload imagem
│   │           ├── AdminCategories.jsx
│   │           ├── AdminCustomers.jsx    # Ranking
│   │           ├── AdminChat.jsx         # Conversas em tempo real
│   │           ├── AdminFinancial.jsx    # Vendas por período/método
│   │           └── AdminSettings.jsx     # Config da padaria
│   ├── package.json                # yarn 1.22
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   ├── craco.config.js
│   ├── Dockerfile
│   ├── .env                        # REACT_APP_BACKEND_URL
│   └── .env.example
├── docker-compose.yml              # Sobe tudo (backend + frontend + mongo)
└── README.md
```

---

## 🚀 Instalação rápida (Docker Compose — recomendado)

Pré-requisitos: **Docker** + **Docker Compose** (instalável em qualquer VPS Linux, Mac ou Windows).

```bash
git clone <seu-repo> padaria-brunao
cd padaria-brunao

# Copie os templates de env
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env

# Edite backend/.env com suas credenciais reais (ver seção abaixo)
nano backend/.env

# Suba tudo
docker compose up -d --build
```

- **App**: http://localhost:3000
- **API**: http://localhost:8001
- **MongoDB**: localhost:27017 (usuário/senha em `docker-compose.yml`)

Primeiro login admin: veja `ADMIN_EMAIL` / `ADMIN_PASSWORD` do seu `backend/.env`.

---

## 🔧 Instalação manual (sem Docker)

### 1. Backend
```bash
cd backend
python3.11 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env    # edite conforme abaixo
uvicorn server:app --host 0.0.0.0 --port 8001 --reload
```

### 2. Frontend
```bash
cd frontend
yarn install
cp .env.example .env    # ajuste REACT_APP_BACKEND_URL
yarn start
```

### 3. MongoDB
- Suba um MongoDB local (`brew services start mongodb-community` no Mac, `sudo systemctl start mongod` no Linux)
- Ou use MongoDB Atlas grátis: https://www.mongodb.com/atlas — pegue a URI e cole em `MONGO_URL`

---

## 🔑 Configuração das variáveis de ambiente

### `backend/.env`

| Variável | Obrigatório | Descrição |
|---|---|---|
| `MONGO_URL` | ✅ | ex.: `mongodb://localhost:27017` ou URI do Atlas |
| `DB_NAME` | ✅ | ex.: `padaria_brunao` |
| `CORS_ORIGINS` | ✅ | `*` em dev, URL do frontend em produção |
| `JWT_SECRET` | ✅ | string aleatória longa (`openssl rand -hex 32`) |
| `ADMIN_EMAIL` | ✅ | email do dono da padaria |
| `ADMIN_PASSWORD` | ✅ | senha inicial (troque em produção) |
| `ADMIN_NAME` | ✅ | nome do dono |
| `PUBLIC_BACKEND_URL` | ⚠️ | URL pública do backend (para o webhook MP; se rodar local, use ngrok) |
| `MP_ACCESS_TOKEN` | opcional | Token do Mercado Pago (`APP_USR-...` produção ou `TEST-...` sandbox). Sem isso, PIX fica como *pending* manual. |
| `MP_WEBHOOK_SECRET` | opcional | Segredo do webhook do MP para validar assinatura HMAC |
| `TELEGRAM_BOT_TOKEN` | opcional | Bot criado no @BotFather (recomendo: grátis, ilimitado) |
| `TELEGRAM_OWNER_CHAT_ID` | opcional | Chat ID do dono (via @userinfobot) |
| `ZAPI_INSTANCE_ID` | opcional | Z-API WhatsApp (pago) |
| `ZAPI_TOKEN` | opcional | Z-API |
| `ZAPI_CLIENT_TOKEN` | opcional | Z-API |
| `OWNER_WHATSAPP` | opcional | Telefone do dono no formato 5511999999999 |
| `STORAGE_TYPE` | opcional | `local` (default fora do Emergent) grava em `backend/uploads/`. `emergent` usa Object Storage da plataforma |

### `frontend/.env`

| Variável | Obrigatório | Descrição |
|---|---|---|
| `REACT_APP_BACKEND_URL` | ✅ | URL do backend, ex.: `http://localhost:8001` ou `https://api.padariabrunao.com` |
| `WDS_SOCKET_PORT` | opcional | Porta do webpack dev server (default: 3000) |

---

## 💰 Como configurar PIX real com Mercado Pago

1. Crie uma aplicação em [https://www.mercadopago.com.br/developers/panel/app](https://www.mercadopago.com.br/developers/panel/app)
2. Em **"Credenciais de produção"** copie o **Access Token** (`APP_USR-...`) e cole em `MP_ACCESS_TOKEN`
3. Em **"Webhooks → Configurar notificações"**:
   - URL: `https://SEU_DOMINIO/api/webhook/mercadopago`
   - Eventos: **Pagamentos**
   - Copie o segredo e cole em `MP_WEBHOOK_SECRET`
4. Reinicie o backend

**Sem essas envs**: o sistema NÃO marca PIX como pago automaticamente. O dono confirma manualmente no painel (`Marcar como pago`).

---

## 🤖 Como configurar Telegram (notificações grátis pro dono)

1. No Telegram, abra `@BotFather` → `/newbot` → escolha nome/username → copie o token → cole em `TELEGRAM_BOT_TOKEN`
2. Abra `@userinfobot` → aperte START → copie o `Id` → cole em `TELEGRAM_OWNER_CHAT_ID`
3. Reinicie o backend. Cada pedido novo você recebe no Telegram.

---

## 📱 WhatsApp — botões wa.me (100% grátis, sem API)

Já funciona sem nenhuma configuração de API. No painel de pedidos:
- Botão **"Avisar no WhatsApp"** por pedido → abre WhatsApp Web/App com mensagem pronta pro cliente baseada no status atual
- Botão **"Falar no WhatsApp"** na home → abre WhatsApp com telefone da padaria (`settings.phone`)

Se quiser envio automático (não-manual), configure Z-API (pago) preenchendo `ZAPI_*` no .env.

---

## 🗄️ Estrutura do banco de dados (MongoDB)

Banco: `padaria_brunao` (configurável via `DB_NAME`).

### Coleções

#### `users`
```json
{
  "id": "uuid",
  "name": "string",
  "email": "string (unique index)",
  "phone": "string",
  "password_hash": "bcrypt hash",
  "role": "customer | admin",
  "created_at": "ISO 8601"
}
```

#### `categories`
```json
{
  "id": "uuid",
  "name": "string",
  "image": "string (path)",
  "active": true,
  "created_at": "ISO 8601"
}
```

#### `products`
```json
{
  "id": "uuid",
  "name": "string",
  "description": "string",
  "category_id": "uuid",
  "price": 0.80,
  "stock": 100,
  "unit": "un | kg | g | L | ml | fatia | pct",
  "image": "string (path, ex.: /api/files/padaria-brunao/uploads/...)",
  "active": true,
  "featured": false,
  "on_sale": false,
  "sale_price": null,
  "low_stock_threshold": 5,
  "created_at": "ISO 8601"
}
```
Índice: `category_id`.

#### `orders`
```json
{
  "id": "uuid",
  "order_number": "00001",
  "customer_id": "uuid",
  "customer_name": "string",
  "customer_phone": "string",
  "items": [
    {"product_id": "uuid", "name": "string", "image": "path", "unit": "un",
     "price": 0.80, "quantity": 20, "line_total": 16.00}
  ],
  "subtotal": 16.00,
  "delivery_fee": 5.00,
  "total": 21.00,
  "delivery_type": "delivery | pickup",
  "address": {"street": "...", "number": "...", "neighborhood": "...", "city": "...", "complement": "..."},
  "payment_method": "pix | dinheiro | cartao",
  "payment_status": "pending | paid | refunded",
  "pix_info": {
    "provider_configured": true,
    "provider": "mercadopago",
    "mp_payment_id": 1351251029,
    "status": "pending",
    "qr_code": "00020126...br.gov.bcb.pix...",
    "qr_code_base64": "iVBORw0KGgoAAAANSUhEUgAA...",
    "ticket_url": "https://www.mercadopago.com.br/..."
  },
  "notes": "string",
  "status": "received | accepted | preparing | ready | dispatched | finished | cancelled",
  "status_history": [{"status": "received", "at": "ISO 8601"}, ...],
  "created_at": "ISO 8601"
}
```
Índices: `customer_id`, `created_at`.

#### `counters` (sequencial de pedidos)
```json
{"id": "orders", "seq": 42}
```

#### `settings` (singleton)
```json
{
  "id": "main",
  "bakery_name": "PADARIA DO BRUNAO",
  "logo": null,
  "phone": "(00) 0000-0000",
  "address": "Rua Exemplo, 100",
  "hours": "Seg a Sáb: 06h às 20h",
  "delivery_fee": 5.0,
  "min_order": 15.0,
  "payment_methods": ["pix", "dinheiro", "cartao"],
  "welcome_message": "Bem-vindo à Padaria do Brunão..."
}
```

#### `conversations`
```json
{
  "id": "uuid",
  "customer_id": "uuid",
  "customer_name": "string",
  "order_id": "uuid | null",
  "created_at": "ISO 8601",
  "updated_at": "ISO 8601",
  "unread_admin": 0,
  "unread_customer": 0
}
```
Índice: `customer_id`.

#### `messages`
```json
{
  "id": "uuid",
  "conversation_id": "uuid",
  "sender_id": "uuid",
  "sender_role": "customer | admin",
  "sender_name": "string",
  "message": "string",
  "created_at": "ISO 8601",
  "read": false
}
```
Índice: `conversation_id`.

#### `files` (metadados de imagens uploadadas)
```json
{
  "id": "uuid",
  "storage_path": "padaria-brunao/uploads/<user>/<uuid>.jpg",
  "original_filename": "pao-frances.jpg",
  "content_type": "image/jpeg",
  "size": 245678,
  "uploaded_by": "uuid",
  "is_deleted": false,
  "created_at": "ISO 8601"
}
```

---

## 🔌 Endpoints principais da API

Todos prefixados com `/api`. Auth via cookie `access_token` OU header `Authorization: Bearer <jwt>`.

### Auth (público)
- `POST /api/auth/register` — cria cliente
- `POST /api/auth/login` — retorna token + user
- `POST /api/auth/logout`
- `GET  /api/auth/me` — user atual

### Catálogo (público)
- `GET /api/products` — filtros: `category_id`, `featured`, `on_sale`
- `GET /api/products/{id}`
- `GET /api/categories`
- `GET /api/settings`

### Cliente (autenticado)
- `POST /api/orders` — cria pedido (com PIX se MP configurado)
- `GET  /api/orders/mine`
- `GET  /api/orders/{id}` — só pedidos próprios (ou admin)
- `POST /api/chat/conversations`
- `GET  /api/chat/{conv_id}/messages`
- `POST /api/chat/{conv_id}/messages`

### Admin (autenticado + role=admin)
- `GET/POST/PATCH/DELETE /api/admin/products` (`/{id}`, `/{id}/stock`)
- `GET/POST/PATCH/DELETE /api/admin/categories` (`/{id}`)
- `GET  /api/admin/orders?status=...`
- `PATCH /api/admin/orders/{id}/status` — `{status: "accepted|preparing|..."}`
- `PATCH /api/admin/orders/{id}/payment` — `{payment_status: "paid"}`
- `GET  /api/admin/dashboard` — KPIs
- `GET  /api/admin/financial`
- `GET  /api/admin/customers`
- `PUT  /api/admin/settings`
- `POST /api/upload` — multipart file, retorna `{url, path}`
- `GET  /api/integrations/status`

### Webhooks / Realtime
- `POST /api/webhook/mercadopago` — recebe notificações do MP (HMAC-SHA256)
- `WS   /api/ws?token=<jwt>` — eventos: `new_order`, `order_status`, `payment_status`, `chat_message`

---

## 🎨 Fluxo do pedido

```
CLIENTE
  ↓ escolhe produtos → adiciona ao carrinho → checkout
  ↓ POST /api/orders
BACKEND
  ↓ valida estoque, decrementa, cria pedido (order_number sequencial)
  ↓ se PIX + MP configurado: chama api.mercadopago.com/v1/payments → gera QR
  ↓ WebSocket broadcast pra admins conectados (evento "new_order")
  ↓ Telegram/WhatsApp pro dono (se configurado)
ADMIN
  ↓ toast + beep + card pulsando → aceita/recusa
  ↓ botões: Aceitar → Preparar → Pronto → Enviar → Finalizar
  ↓ cada PATCH /api/admin/orders/{id}/status atualiza status_history
  ↓ WebSocket → cliente vê status atualizado em tempo real
  ↓ (opcional) botão "Avisar no WhatsApp" abre wa.me com mensagem pronta
PIX (se configurado)
  ↓ cliente paga no banco
  ↓ Mercado Pago dispara webhook → nosso /api/webhook/mercadopago
  ↓ valida assinatura HMAC → refaz GET no MP → confirma external_reference
  ↓ marca payment_status="paid" atomicamente
  ↓ WebSocket + Telegram avisam dono e cliente
```

---

## 🧪 Testes

Backend: 22 testes end-to-end passando (100%) — auth, produtos, pedidos, fluxo de status, financeiro, chat, upload, WebSocket, segurança admin.

Rodar manualmente:
```bash
curl -X POST http://localhost:8001/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"seu-admin@email.com","password":"..."}'
```

---

## 🛡️ Segurança em produção

Antes de ir pro ar:
- [ ] Trocar `ADMIN_PASSWORD` por senha forte
- [ ] `JWT_SECRET` único e forte (`openssl rand -hex 32`)
- [ ] `CORS_ORIGINS` restrito ao domínio do frontend (não `*`)
- [ ] MongoDB com autenticação habilitada + IP allowlist
- [ ] HTTPS obrigatório (Let's Encrypt, Cloudflare)
- [ ] `MP_ACCESS_TOKEN` de produção (não TEST-)
- [ ] `MP_WEBHOOK_SECRET` sempre preenchido
- [ ] Rate limit no `/api/auth/login` (ex.: nginx `limit_req` ou `slowapi`)
- [ ] Backups automáticos do Mongo (`mongodump` diário → S3)

---

## 📄 Licença

Código proprietário — Padaria do Brunão.

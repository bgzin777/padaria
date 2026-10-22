# PRD — PADARIA DO BRUNAO

## Problem statement (original)
Sistema completo de pedidos online para uma padaria física. Cliente escolhe produtos, adiciona ao carrinho, finaliza pedido com entrega/retirada e pagamento (PIX/dinheiro/cartão). Admin gerencia produtos, categorias, pedidos com fluxo de status, estoque, clientes, financeiro, chat, configurações. Notificação em tempo real, impressão, upload de imagens. PIX como integração automática real (Mercado Pago) com webhook e QR Code dinâmico.

## Architecture
- Backend: FastAPI + Motor/MongoDB + JWT + bcrypt + WebSocket + Object Storage (Emergent) + local fallback
- Frontend: React 19 + React Router + Tailwind + Shadcn UI + Sonner + WebSocket client
- Auth: JWT httpOnly cookie **and** Authorization Bearer (dual mode)
- Realtime: WebSocket `/api/ws?token=<jwt>` (novo pedido → admin; mudança de status → cliente)
- Payments: Mercado Pago PIX (/v1/payments) com webhook HMAC-SHA256
- Notifications: Telegram Bot (grátis, auto pro dono) + wa.me click-to-chat (grátis, manual pro cliente) + Z-API WhatsApp (opcional, pago)
- Deploy: Docker Compose (backend + frontend + mongo), com .env.example documentado

## User personas
- **Cliente**: navega catálogo, monta carrinho persistente, finaliza pedido PIX com QR real, acompanha status em tempo real, conversa via chat interno + wa.me pra padaria.
- **Dono (admin)**: gerencia catálogo, categorias, pedidos com fluxo (aceitar→preparar→pronto→enviar→finalizar), imprime pedido, atende clientes no chat, controla estoque, financeiro e configurações. Recebe notificações automáticas no Telegram.

## Core requirements (static)
- Produtos NÃO fixos — todos cadastrados pelo admin
- Estoque decrementa ao criar pedido, restaura ao cancelar
- 7 status de pedido com histórico timestamp
- PIX real via Mercado Pago com confirmação automática por webhook
- Nenhum pagamento marcado como "pago" sem confirmação do MP (via GET autenticado)
- Impressão em formato térmico (300px, monospace)
- Notificação sonora + visual de novo pedido
- Separação de papéis (cliente × admin)
- Credenciais nunca expostas em logs ou respostas HTTP

## Implemented
### Fase 1 (MVP)
- Autenticação JWT + seed idempotente de admin
- CRUD de produtos/categorias com upload de imagem via Object Storage
- Carrinho persistente em localStorage
- Checkout completo (entrega/retirada, endereço, pagamento, notas)
- Pedido com número sequencial (contador atômico), stock decrement/restock
- Painel admin: dashboard, pedidos com botão de avanço, imprimir, marcar pago
- Financeiro por período e por método de pagamento
- Clientes com estatísticas de compra
- Chat cliente ↔ admin com contadores de não-lidos
- Configurações da padaria (nome, endereço, taxa, mínimo, mensagem, métodos)
- WebSocket em tempo real para novos pedidos, status e chat
- Toasts + beep de áudio para admin em novo pedido
- 22/22 testes backend passaram

### Fase 2 (Integrações reais)
- Mercado Pago PIX: endpoint `/v1/payments` com X-Idempotency-Key, QR Code copia-e-cola + base64 PNG retornados na criação do pedido
- Webhook `/api/webhook/mercadopago`: valida HMAC-SHA256 (401 em assinatura ausente/inválida), faz GET autenticado antes de marcar paid, atomicidade por `payment_status: {$ne: paid}`
- 1 retry automático em 5xx do MP (sandbox tem instabilidade esporádica)
- Telegram Bot: notificação automática pro dono em cada pedido novo + pagamento confirmado
- wa.me buttons no painel admin (status-aware) + "Falar no WhatsApp" na home
- Z-API opcional pra automação cliente
- Endpoint `/api/integrations/status` pra conferência rápida
- Logs sanitizados (zero ocorrências de token em backend.*.log)
- 9/9 testes PIX passaram pós-fix

### Fase 3 (Pacote exportável)
- README.md completo com estrutura, endpoints, schema do banco, env vars
- docker-compose.yml + backend/Dockerfile + frontend/Dockerfile
- .env.example documentado pros 2 lados
- requirements.txt.portable sem deps da plataforma Emergent

## Known issues / dependencies externas
- MP sandbox retorna transient 500 ("http is unavailable for request create_ti") esporadicamente — mitigado com 1 retry automático
- Para PIX funcionar, conta MP recebedora precisa ter pelo menos 1 chave PIX cadastrada (CPF, email, celular ou aleatória)
- Token atual é TEST- (sandbox) — para receber dinheiro de verdade, trocar por APP_USR- de produção

## Prioritized backlog (P0/P1/P2)
### P0 (próximas)
- Trocar token TEST- por APP_USR- (produção) quando o dono quiser ir ao ar
- Configurar Telegram (dono manda token + chat_id)
- Filtros de período no financeiro (date range picker)

### P1
- Página de detalhe do pedido para cliente com timeline visual
- Programa de fidelidade / cupons de desconto
- Múltiplos endereços salvos por cliente
- Notificação push PWA (web)

### P2
- Relatórios exportáveis (CSV/PDF)
- Multi-loja / franquia
- App PWA instalável
- Integração com outras bandeiras (cartão online)

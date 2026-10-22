import { useEffect, useState, useCallback, useRef } from "react";
import { api, brl } from "@/lib/api";
import { useRealtime } from "@/context/RealtimeContext";
import OrderStatusBadge, { STATUS_LABELS } from "@/components/OrderStatusBadge";
import { Printer, Check, X, MessageCircle } from "lucide-react";
import { useSettings } from "@/context/SettingsContext";
import { waMeForOrder } from "@/lib/whatsapp";

const NEXT = { received: "accepted", accepted: "preparing", preparing: "ready", ready: "dispatched", dispatched: "finished" };
const NEXT_LABEL = { received: "Aceitar pedido", accepted: "Iniciar preparação", preparing: "Pedido pronto", ready: "Enviar pedido", dispatched: "Finalizar pedido" };

export default function AdminOrders() {
  const [orders, setOrders] = useState([]);
  const [filter, setFilter] = useState("");
  const [printing, setPrinting] = useState(null);
  const { subscribe } = useRealtime();
  const { settings } = useSettings();

  const load = useCallback(() => {
    api.get("/admin/orders", { params: filter ? { status: filter } : {} }).then((r) => setOrders(r.data)).catch(() => {});
  }, [filter]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => subscribe((m) => { if (m.type === "new_order" || m.type === "order_status") load(); }), [subscribe, load]);

  const advance = async (o) => {
    const next = NEXT[o.status];
    if (!next) return;
    await api.patch(`/admin/orders/${o.id}/status`, { status: next });
    load();
  };
  const cancel = async (o) => {
    if (!window.confirm("Recusar/cancelar este pedido?")) return;
    await api.patch(`/admin/orders/${o.id}/status`, { status: "cancelled" });
    load();
  };
  const markPaid = async (o) => {
    await api.patch(`/admin/orders/${o.id}/payment`, { payment_status: "paid" });
    load();
  };
  const doPrint = (o) => {
    setPrinting(o);
    setTimeout(() => { window.print(); setPrinting(null); }, 100);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="font-serif font-black text-3xl">Pedidos</h1>
        <select data-testid="orders-filter" value={filter} onChange={(e) => setFilter(e.target.value)} className="rounded-full border border-stone-200 bg-white px-4 py-2 text-sm">
          <option value="">Todos</option>
          {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      {orders.length === 0 && <div className="text-stone-500">Nenhum pedido.</div>}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {orders.map((o) => (
          <div key={o.id} data-testid={`admin-order-${o.id}`} className={`bg-white rounded-3xl border p-5 space-y-3 ${o.status === "received" ? "border-amber-400 pulse-amber" : "border-stone-200"}`}>
            <div className="flex items-start justify-between">
              <div>
                <div className="font-mono text-xs text-stone-500">NOVO PEDIDO</div>
                <div className="font-serif font-black text-2xl">#{o.order_number}</div>
                <div className="text-sm text-stone-700 font-bold mt-1">{o.customer_name}</div>
                <div className="text-xs text-stone-500">{o.customer_phone}</div>
              </div>
              <div className="text-right space-y-1">
                <OrderStatusBadge status={o.status}/>
                <div className="text-xs text-stone-500">{new Date(o.created_at).toLocaleString("pt-BR")}</div>
              </div>
            </div>
            <ul className="text-sm text-stone-700 space-y-0.5">
              {o.items.map((i, idx) => <li key={idx}>{i.quantity}× <b>{i.name}</b> · {brl(i.line_total)}</li>)}
            </ul>
            <div className="flex flex-wrap gap-2 text-[11px]">
              <span className="rounded-full bg-stone-100 px-2 py-0.5 uppercase font-bold">{o.payment_method}</span>
              <span className={`rounded-full px-2 py-0.5 uppercase font-bold ${o.payment_status === "paid" ? "bg-emerald-100 text-emerald-700" : "bg-yellow-100 text-yellow-800"}`}>{o.payment_status}</span>
              <span className="rounded-full bg-stone-100 px-2 py-0.5 uppercase font-bold">{o.delivery_type}</span>
            </div>
            {o.delivery_type === "delivery" && o.address && (
              <div className="text-xs text-stone-600">📍 {o.address.street}, {o.address.number} · {o.address.neighborhood} {o.address.city && `— ${o.address.city}`} {o.address.complement && `(${o.address.complement})`}</div>
            )}
            {o.notes && <div className="text-xs text-stone-600 italic">Obs: {o.notes}</div>}
            <div className="border-t border-stone-100 pt-2 flex justify-between font-bold"><span>Total</span><span className="text-amber-700">{brl(o.total)}</span></div>
            <div className="flex flex-wrap gap-2 no-print">
              {NEXT[o.status] && (
                <button data-testid={`order-advance-${o.id}`} onClick={() => advance(o)} className="rounded-full bg-amber-600 hover:bg-amber-700 text-white font-bold px-4 py-2 text-sm flex items-center gap-1 transition active:scale-95"><Check size={14}/> {NEXT_LABEL[o.status]}</button>
              )}
              {["received", "accepted"].includes(o.status) && (
                <button data-testid={`order-cancel-${o.id}`} onClick={() => cancel(o)} className="rounded-full bg-red-50 hover:bg-red-100 text-red-700 font-bold px-4 py-2 text-sm flex items-center gap-1 transition"><X size={14}/> Recusar</button>
              )}
              {o.payment_status !== "paid" && (
                <button data-testid={`order-mark-paid-${o.id}`} onClick={() => markPaid(o)} className="rounded-full bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold px-4 py-2 text-sm">Marcar como pago</button>
              )}
              <button data-testid={`order-print-${o.id}`} onClick={() => doPrint(o)} className="rounded-full bg-stone-100 hover:bg-stone-200 text-stone-800 font-bold px-4 py-2 text-sm flex items-center gap-1 transition"><Printer size={14}/> Imprimir</button>
              {o.customer_phone && waMeForOrder(o) && (
                <a href={waMeForOrder(o)} target="_blank" rel="noopener noreferrer" data-testid={`order-whatsapp-${o.id}`} className="rounded-full bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold px-4 py-2 text-sm flex items-center gap-1 transition"><MessageCircle size={14}/> Avisar no WhatsApp</a>
              )}
            </div>
          </div>
        ))}
      </div>

      {printing && (
        <div className="printable">
          <div className="receipt">
            <div style={{ textAlign: "center", fontWeight: 700 }}>{settings.bakery_name}</div>
            <div style={{ textAlign: "center", fontSize: 10 }}>{settings.address}</div>
            <div style={{ textAlign: "center", fontSize: 10 }}>{settings.phone}</div>
            <hr/>
            <div>PEDIDO #{printing.order_number}</div>
            <div>{new Date(printing.created_at).toLocaleString("pt-BR")}</div>
            <hr/>
            <div>Cliente: {printing.customer_name}</div>
            <div>Tel: {printing.customer_phone}</div>
            {printing.delivery_type === "delivery" && printing.address && (
              <div>End: {printing.address.street}, {printing.address.number} - {printing.address.neighborhood}</div>
            )}
            <hr/>
            {printing.items.map((i, idx) => (
              <div key={idx} className="row"><span>{i.quantity}x {i.name}</span><span>{brl(i.line_total)}</span></div>
            ))}
            <hr/>
            <div className="row"><span>Subtotal</span><span>{brl(printing.subtotal)}</span></div>
            <div className="row"><span>Entrega</span><span>{brl(printing.delivery_fee)}</span></div>
            <div className="row" style={{ fontWeight: 700 }}><span>TOTAL</span><span>{brl(printing.total)}</span></div>
            <hr/>
            <div>Pagamento: {printing.payment_method.toUpperCase()} ({printing.payment_status})</div>
            {printing.notes && <div>Obs: {printing.notes}</div>}
            <hr/>
            <div style={{ textAlign: "center" }}>Obrigado pela preferência!</div>
          </div>
        </div>
      )}
    </div>
  );
}

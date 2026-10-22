import { useEffect, useState, useCallback } from "react";
import { api, brl } from "@/lib/api";
import { useRealtime } from "@/context/RealtimeContext";
import OrderStatusBadge, { STATUS_LABELS } from "@/components/OrderStatusBadge";

export default function Orders() {
  const [orders, setOrders] = useState([]);
  const { subscribe } = useRealtime();

  const load = useCallback(() => api.get("/orders/mine").then((r) => setOrders(r.data)).catch(() => {}), []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => subscribe((msg) => { if (msg.type === "order_status" || msg.type === "payment_status") load(); }), [subscribe, load]);

  if (orders.length === 0) {
    return <div className="text-center py-16 text-stone-500">Você ainda não tem pedidos.</div>;
  }

  return (
    <div className="space-y-6">
      <h1 className="font-serif font-black text-3xl">Meus pedidos</h1>
      <div className="space-y-3">
        {orders.map((o) => (
          <div key={o.id} data-testid={`order-row-${o.id}`} className="bg-white rounded-3xl border border-stone-200 p-5 space-y-3">
            <div className="flex justify-between items-start">
              <div>
                <div className="font-mono text-xs text-stone-500">PEDIDO</div>
                <div className="font-serif font-black text-xl">#{o.order_number}</div>
                <div className="text-xs text-stone-500 mt-1">{new Date(o.created_at).toLocaleString("pt-BR")}</div>
              </div>
              <OrderStatusBadge status={o.status}/>
            </div>
            <ul className="text-sm text-stone-700 space-y-1">
              {o.items.map((i, idx) => (
                <li key={idx} className="flex justify-between"><span>{i.quantity}× {i.name}</span><span className="text-stone-500">{brl(i.line_total)}</span></li>
              ))}
            </ul>
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="rounded-full bg-stone-100 px-3 py-1 uppercase font-bold">{o.payment_method}</span>
              <span className={`rounded-full px-3 py-1 uppercase font-bold ${o.payment_status === "paid" ? "bg-emerald-100 text-emerald-700" : "bg-yellow-100 text-yellow-800"}`}>{o.payment_status === "paid" ? "Pago" : "Pendente"}</span>
              <span className="rounded-full bg-stone-100 px-3 py-1 uppercase font-bold">{o.delivery_type === "delivery" ? "Entrega" : "Retirada"}</span>
            </div>
            <div className="border-t border-stone-200 pt-2 flex justify-between font-bold"><span>Total</span><span className="text-amber-700">{brl(o.total)}</span></div>
            {o.status_history?.length > 0 && (
              <div className="pt-2 border-t border-stone-100">
                <div className="text-[10px] uppercase tracking-widest text-stone-400 mb-1">Andamento</div>
                <div className="flex flex-wrap gap-1">
                  {o.status_history.map((h, idx) => (
                    <span key={idx} className="text-[11px] rounded-full bg-stone-50 border border-stone-200 px-2 py-0.5">{STATUS_LABELS[h.status]} · {new Date(h.at).toLocaleTimeString("pt-BR", {hour: "2-digit", minute: "2-digit"})}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

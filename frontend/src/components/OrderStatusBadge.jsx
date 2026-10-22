export const STATUS_LABELS = {
  received: "Pedido recebido",
  accepted: "Pedido aceito",
  preparing: "Preparando",
  ready: "Pronto",
  dispatched: "Saiu para entrega",
  finished: "Finalizado",
  cancelled: "Cancelado",
};

const COLORS = {
  received: "bg-blue-100 text-blue-700",
  accepted: "bg-indigo-100 text-indigo-700",
  preparing: "bg-amber-100 text-amber-700",
  ready: "bg-emerald-100 text-emerald-700",
  dispatched: "bg-violet-100 text-violet-700",
  finished: "bg-stone-200 text-stone-700",
  cancelled: "bg-red-100 text-red-700",
};

export default function OrderStatusBadge({ status }) {
  return (
    <span data-testid="order-status-badge" className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider ${COLORS[status] || "bg-stone-200"}`}>
      {STATUS_LABELS[status] || status}
    </span>
  );
}

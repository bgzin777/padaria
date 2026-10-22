import { useEffect, useState, useCallback } from "react";
import { api, brl } from "@/lib/api";
import { useRealtime } from "@/context/RealtimeContext";
import { ShoppingBag, DollarSign, Clock, CheckCircle, AlertTriangle } from "lucide-react";

const KPI = ({ label, value, icon: Icon, color }) => (
  <div className="bg-white rounded-3xl border border-stone-200 p-5">
    <div className={`w-10 h-10 rounded-2xl ${color} flex items-center justify-center mb-3`}><Icon size={18}/></div>
    <div className="text-xs uppercase tracking-widest text-stone-500 font-bold">{label}</div>
    <div className="font-serif font-black text-2xl mt-1">{value}</div>
  </div>
);

export default function AdminDashboard() {
  const [data, setData] = useState(null);
  const { subscribe } = useRealtime();
  const load = useCallback(() => api.get("/admin/dashboard").then((r) => setData(r.data)).catch(() => {}), []);
  useEffect(() => { load(); const t = setInterval(load, 15000); return () => clearInterval(t); }, [load]);
  useEffect(() => subscribe((m) => { if (m.type === "new_order" || m.type === "order_status") load(); }), [subscribe, load]);

  if (!data) return <div className="text-stone-500">Carregando...</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif font-black text-3xl">Dashboard</h1>
        <p className="text-stone-500 text-sm">Visão geral da padaria em tempo real</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPI label="Vendas hoje" value={brl(data.sales_today)} icon={DollarSign} color="bg-emerald-100 text-emerald-700"/>
        <KPI label="Pedidos hoje" value={data.orders_today} icon={ShoppingBag} color="bg-blue-100 text-blue-700"/>
        <KPI label="Novos" value={data.new_orders} icon={AlertTriangle} color="bg-amber-100 text-amber-700"/>
        <KPI label="Preparando" value={data.preparing_orders} icon={Clock} color="bg-violet-100 text-violet-700"/>
      </div>

      <div className="bg-white rounded-3xl border border-stone-200 p-5">
        <div className="flex items-center gap-2 mb-3"><CheckCircle size={18} className="text-emerald-600"/><h2 className="font-serif font-bold text-lg">Prontos para envio/retirada</h2></div>
        <div className="text-3xl font-serif font-black">{data.ready_orders}</div>
      </div>

      <div className="bg-white rounded-3xl border border-stone-200 p-5">
        <h2 className="font-serif font-bold text-lg mb-3">Estoque baixo</h2>
        {data.low_stock_products.length === 0 ? <div className="text-sm text-stone-500">Nenhum produto com estoque baixo.</div> : (
          <ul className="divide-y divide-stone-100">
            {data.low_stock_products.map((p) => (
              <li key={p.id} className="py-2 flex justify-between text-sm"><span>{p.name}</span><span className="text-amber-700 font-bold">{p.stock} {p.unit}</span></li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

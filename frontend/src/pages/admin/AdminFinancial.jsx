import { useEffect, useState } from "react";
import { api, brl } from "@/lib/api";

const Card = ({ label, value, tone = "stone" }) => (
  <div className="bg-white rounded-3xl border border-stone-200 p-5">
    <div className="text-xs uppercase tracking-widest text-stone-500 font-bold">{label}</div>
    <div className={`font-serif font-black text-2xl mt-1 text-${tone}-700`}>{value}</div>
  </div>
);

export default function AdminFinancial() {
  const [data, setData] = useState(null);
  useEffect(() => { api.get("/admin/financial").then((r) => setData(r.data)).catch(() => {}); }, []);
  if (!data) return <div className="text-stone-500">Carregando...</div>;
  return (
    <div className="space-y-6">
      <h1 className="font-serif font-black text-3xl">Financeiro</h1>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Card label="Vendas do dia" value={brl(data.sales_today)} tone="amber"/>
        <Card label="Vendas da semana" value={brl(data.sales_week)} tone="amber"/>
        <Card label="Vendas do mês" value={brl(data.sales_month)} tone="amber"/>
        <Card label="Total recebido" value={brl(data.total_paid)} tone="emerald"/>
        <Card label="Pendente" value={brl(data.total_pending)} tone="yellow"/>
      </div>
      <div className="bg-white rounded-3xl border border-stone-200 p-5">
        <h2 className="font-serif font-bold text-lg mb-3">Por forma de pagamento</h2>
        <div className="grid grid-cols-3 gap-4">
          <div><div className="text-xs uppercase tracking-widest text-stone-500 font-bold">PIX</div><div className="font-bold text-lg">{brl(data.by_method.pix)}</div></div>
          <div><div className="text-xs uppercase tracking-widest text-stone-500 font-bold">Dinheiro</div><div className="font-bold text-lg">{brl(data.by_method.dinheiro)}</div></div>
          <div><div className="text-xs uppercase tracking-widest text-stone-500 font-bold">Cartão</div><div className="font-bold text-lg">{brl(data.by_method.cartao)}</div></div>
        </div>
      </div>
    </div>
  );
}

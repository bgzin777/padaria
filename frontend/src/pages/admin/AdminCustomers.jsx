import { useEffect, useState } from "react";
import { api, brl } from "@/lib/api";

export default function AdminCustomers() {
  const [rows, setRows] = useState([]);
  useEffect(() => { api.get("/admin/customers").then((r) => setRows(r.data)).catch(() => {}); }, []);
  return (
    <div className="space-y-6">
      <h1 className="font-serif font-black text-3xl">Clientes</h1>
      <div className="bg-white rounded-3xl border border-stone-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-stone-50 text-xs uppercase tracking-widest text-stone-500">
            <tr><th className="text-left px-4 py-3">Nome</th><th className="text-left px-4 py-3">Telefone</th><th className="text-right px-4 py-3">Pedidos</th><th className="text-right px-4 py-3">Total gasto</th><th className="text-left px-4 py-3">Último pedido</th></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} data-testid={`cust-${r.id}`} className="border-t border-stone-100">
                <td className="px-4 py-3"><div className="font-bold">{r.name}</div><div className="text-xs text-stone-500">{r.email}</div></td>
                <td className="px-4 py-3">{r.phone || "—"}</td>
                <td className="px-4 py-3 text-right font-bold">{r.orders_count}</td>
                <td className="px-4 py-3 text-right text-amber-700 font-bold">{brl(r.total_spent)}</td>
                <td className="px-4 py-3 text-xs text-stone-500">{r.last_order ? new Date(r.last_order).toLocaleString("pt-BR") : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <div className="p-6 text-center text-stone-500">Nenhum cliente ainda.</div>}
      </div>
    </div>
  );
}

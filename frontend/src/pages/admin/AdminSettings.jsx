import { useEffect, useState } from "react";
import { api, formatApiError } from "@/lib/api";
import { useSettings } from "@/context/SettingsContext";
import { toast } from "sonner";

export default function AdminSettings() {
  const { settings, refresh } = useSettings();
  const [form, setForm] = useState(settings);
  useEffect(() => { setForm(settings); }, [settings]);

  const save = async () => {
    try {
      await api.put("/admin/settings", { ...form, delivery_fee: Number(form.delivery_fee), min_order: Number(form.min_order) });
      await refresh();
      toast.success("Configurações salvas");
    } catch (e) { toast.error(formatApiError(e)); }
  };

  const togglePm = (m) => {
    const has = form.payment_methods.includes(m);
    setForm({ ...form, payment_methods: has ? form.payment_methods.filter((x) => x !== m) : [...form.payment_methods, m] });
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="font-serif font-black text-3xl">Configurações da padaria</h1>
      <div className="bg-white rounded-3xl border border-stone-200 p-5 space-y-3">
        <label className="block text-xs uppercase tracking-widest text-stone-500 font-bold">Nome</label>
        <input data-testid="sf-name" value={form.bakery_name} onChange={(e) => setForm({...form, bakery_name: e.target.value})} className="w-full rounded-xl border border-stone-200 px-4 py-2.5 text-sm"/>
        <label className="block text-xs uppercase tracking-widest text-stone-500 font-bold">Telefone</label>
        <input data-testid="sf-phone" value={form.phone} onChange={(e) => setForm({...form, phone: e.target.value})} className="w-full rounded-xl border border-stone-200 px-4 py-2.5 text-sm"/>
        <label className="block text-xs uppercase tracking-widest text-stone-500 font-bold">Endereço</label>
        <input data-testid="sf-address" value={form.address} onChange={(e) => setForm({...form, address: e.target.value})} className="w-full rounded-xl border border-stone-200 px-4 py-2.5 text-sm"/>
        <label className="block text-xs uppercase tracking-widest text-stone-500 font-bold">Horário de funcionamento</label>
        <input data-testid="sf-hours" value={form.hours} onChange={(e) => setForm({...form, hours: e.target.value})} className="w-full rounded-xl border border-stone-200 px-4 py-2.5 text-sm"/>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="block text-xs uppercase tracking-widest text-stone-500 font-bold">Taxa de entrega</label><input data-testid="sf-fee" type="number" step="0.01" value={form.delivery_fee} onChange={(e) => setForm({...form, delivery_fee: e.target.value})} className="w-full rounded-xl border border-stone-200 px-4 py-2.5 text-sm"/></div>
          <div><label className="block text-xs uppercase tracking-widest text-stone-500 font-bold">Pedido mínimo</label><input data-testid="sf-min" type="number" step="0.01" value={form.min_order} onChange={(e) => setForm({...form, min_order: e.target.value})} className="w-full rounded-xl border border-stone-200 px-4 py-2.5 text-sm"/></div>
        </div>
        <label className="block text-xs uppercase tracking-widest text-stone-500 font-bold">Formas de pagamento aceitas</label>
        <div className="flex gap-2 flex-wrap">
          {["pix", "dinheiro", "cartao"].map((m) => (
            <button key={m} data-testid={`sf-pm-${m}`} onClick={() => togglePm(m)} className={`rounded-full px-4 py-2 text-sm font-bold uppercase ${form.payment_methods.includes(m) ? "bg-amber-600 text-white" : "bg-stone-100 text-stone-500"}`}>{m}</button>
          ))}
        </div>
        <label className="block text-xs uppercase tracking-widest text-stone-500 font-bold">Mensagem exibida ao cliente</label>
        <textarea data-testid="sf-msg" value={form.welcome_message} onChange={(e) => setForm({...form, welcome_message: e.target.value})} rows={3} className="w-full rounded-xl border border-stone-200 px-4 py-2.5 text-sm"/>
        <button data-testid="sf-save" onClick={save} className="rounded-full bg-amber-600 hover:bg-amber-700 text-white font-bold px-6 py-3 transition active:scale-95">Salvar configurações</button>
      </div>
      <div className="bg-amber-50 border border-amber-200 rounded-3xl p-5 text-sm text-amber-900">
        <b>Integração PIX:</b> a estrutura está pronta no backend. Para ativar o pagamento automático, conecte um provedor (Mercado Pago, Asaas, Efí) — nos endpoints <code>/api/orders</code> a resposta traz <code>pix_info.provider_configured=false</code>.
      </div>
    </div>
  );
}

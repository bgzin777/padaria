import { Link, useNavigate } from "react-router-dom";
import { useCart } from "@/context/CartContext";
import { useSettings } from "@/context/SettingsContext";
import { brl, fileUrl } from "@/lib/api";
import { Plus, Minus, Trash2 } from "lucide-react";

export default function Cart() {
  const { items, setQty, remove, subtotal } = useCart();
  const { settings } = useSettings();
  const navigate = useNavigate();

  if (items.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="text-6xl mb-4">🛒</div>
        <h1 className="font-serif font-black text-2xl mb-2">Seu carrinho está vazio</h1>
        <p className="text-stone-500 mb-6">Adicione produtos frescos da padaria.</p>
        <Link to="/produtos" data-testid="cart-continue-shopping" className="inline-block rounded-full bg-amber-600 hover:bg-amber-700 text-white font-bold px-6 py-3 transition">Ver produtos</Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="font-serif font-black text-3xl">Carrinho</h1>
      <div className="space-y-3">
        {items.map((i) => (
          <div key={i.product_id} data-testid={`cart-item-${i.product_id}`} className="flex items-center gap-3 bg-white rounded-2xl border border-stone-200 p-3">
            <div className="w-16 h-16 rounded-xl bg-stone-100 overflow-hidden flex items-center justify-center shrink-0">
              {i.image ? <img src={fileUrl(i.image)} alt={i.name} className="w-full h-full object-cover"/> : <span className="text-2xl">🥖</span>}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-stone-900 truncate">{i.name}</div>
              <div className="text-xs text-stone-500">{brl(i.price)} / {i.unit}</div>
            </div>
            <div className="flex items-center gap-1 bg-stone-100 rounded-full p-1">
              <button data-testid={`cart-dec-${i.product_id}`} onClick={() => setQty(i.product_id, i.quantity - 1)} className="w-8 h-8 rounded-full bg-white flex items-center justify-center active:scale-95"><Minus size={14}/></button>
              <span className="min-w-[24px] text-center text-sm font-bold">{i.quantity}</span>
              <button data-testid={`cart-inc-${i.product_id}`} onClick={() => setQty(i.product_id, i.quantity + 1)} className="w-8 h-8 rounded-full bg-amber-600 text-white flex items-center justify-center active:scale-95"><Plus size={14}/></button>
            </div>
            <button data-testid={`cart-remove-${i.product_id}`} onClick={() => remove(i.product_id)} className="p-2 text-stone-400 hover:text-red-600 transition"><Trash2 size={16}/></button>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-3xl border border-stone-200 p-5 space-y-2">
        <div className="flex justify-between text-stone-700"><span>Subtotal</span><span data-testid="cart-subtotal">{brl(subtotal)}</span></div>
        <div className="flex justify-between text-stone-500 text-sm"><span>Taxa de entrega estimada</span><span>{brl(settings.delivery_fee)}</span></div>
        <div className="border-t border-stone-200 pt-2 flex justify-between font-bold text-lg"><span>Total estimado</span><span className="text-amber-700">{brl(subtotal + Number(settings.delivery_fee || 0))}</span></div>
        <div className="text-xs text-stone-500">Pedido mínimo: {brl(settings.min_order)}</div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <Link to="/produtos" data-testid="cart-continue" className="flex-1 text-center rounded-full bg-stone-100 hover:bg-stone-200 text-stone-800 font-bold px-6 py-3 transition">Continuar comprando</Link>
        <button data-testid="cart-checkout" onClick={() => navigate("/checkout")} disabled={subtotal < settings.min_order} className="flex-1 rounded-full bg-amber-600 hover:bg-amber-700 disabled:bg-stone-300 text-white font-bold px-6 py-3 transition active:scale-95">Finalizar pedido</button>
      </div>
    </div>
  );
}

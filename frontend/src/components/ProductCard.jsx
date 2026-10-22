import { Plus, Minus } from "lucide-react";
import { fileUrl, brl } from "@/lib/api";
import { useCart } from "@/context/CartContext";

export default function ProductCard({ product }) {
  const { items, add, setQty } = useCart();
  const inCart = items.find((i) => i.product_id === product.id);
  const price = product.on_sale && product.sale_price ? product.sale_price : product.price;
  const oldPrice = product.on_sale && product.sale_price ? product.price : null;
  const img = fileUrl(product.image);

  return (
    <div data-testid={`product-card-${product.id}`} className="bg-white rounded-3xl border border-stone-200/60 overflow-hidden shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-transform duration-300 hover:-translate-y-1">
      <div className="relative aspect-[4/3] bg-stone-100">
        {img ? (
          <img src={img} alt={product.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-stone-400 font-serif text-4xl">🥖</div>
        )}
        {product.on_sale && <span className="absolute top-2 left-2 bg-red-500 text-white text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-full">Oferta</span>}
        {product.featured && !product.on_sale && <span className="absolute top-2 left-2 bg-amber-600 text-white text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-full">Destaque</span>}
      </div>
      <div className="p-4 flex flex-col gap-2">
        <div>
          <h3 className="font-serif font-bold text-stone-900 text-base leading-tight">{product.name}</h3>
          <div className="text-xs text-stone-500">{product.unit}</div>
        </div>
        <div className="flex items-end justify-between">
          <div>
            {oldPrice && <div className="text-xs line-through text-stone-400">{brl(oldPrice)}</div>}
            <div className="font-bold text-amber-700 text-lg">{brl(price)}</div>
          </div>
          {inCart ? (
            <div className="flex items-center gap-2 bg-stone-100 rounded-full p-1">
              <button data-testid={`qty-dec-${product.id}`} onClick={() => setQty(product.id, inCart.quantity - 1)} className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-stone-700 hover:bg-stone-50 transition active:scale-95"><Minus size={14}/></button>
              <span className="min-w-[24px] text-center text-sm font-bold">{inCart.quantity}</span>
              <button data-testid={`qty-inc-${product.id}`} onClick={() => setQty(product.id, inCart.quantity + 1)} className="w-8 h-8 rounded-full bg-amber-600 text-white flex items-center justify-center hover:bg-amber-700 transition active:scale-95"><Plus size={14}/></button>
            </div>
          ) : (
            <button data-testid={`add-to-cart-${product.id}`} onClick={() => add(product, 1)} className="rounded-full bg-amber-600 hover:bg-amber-700 text-white text-sm font-bold px-4 py-2 flex items-center gap-1 transition active:scale-95">
              <Plus size={14}/> Adicionar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

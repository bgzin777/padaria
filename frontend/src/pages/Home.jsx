import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import { useSettings } from "@/context/SettingsContext";
import ProductCard from "@/components/ProductCard";
import { ArrowRight, MessageCircle } from "lucide-react";
import { waMeLink } from "@/lib/whatsapp";

export default function Home() {
  const { settings } = useSettings();
  const [featured, setFeatured] = useState([]);
  const [onSale, setOnSale] = useState([]);
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    api.get("/products", { params: { featured: true } }).then((r) => setFeatured(r.data)).catch(() => {});
    api.get("/products", { params: { on_sale: true } }).then((r) => setOnSale(r.data)).catch(() => {});
    api.get("/categories").then((r) => setCategories(r.data)).catch(() => {});
  }, []);

  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-amber-50 to-orange-100 border border-amber-200/50 p-6 sm:p-10">
        <div className="max-w-xl">
          <div className="text-xs uppercase tracking-[0.3em] font-bold text-amber-700 mb-2">Fresquinho todo dia</div>
          <h1 className="font-serif font-black text-3xl sm:text-5xl text-stone-900 leading-[1.05]">{settings.bakery_name}</h1>
          <p className="mt-3 text-stone-700 text-sm sm:text-base">{settings.welcome_message}</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link to="/produtos" data-testid="cta-choose-products" className="inline-flex items-center gap-2 rounded-full bg-amber-600 hover:bg-amber-700 text-white font-bold px-6 py-3 transition active:scale-95">
              Escolher produtos <ArrowRight size={16}/>
            </Link>
            {settings.phone && waMeLink(settings.phone, `Olá! Vim pelo app da ${settings.bakery_name}`) && (
              <a href={waMeLink(settings.phone, `Olá! Vim pelo app da ${settings.bakery_name}`)} target="_blank" rel="noopener noreferrer" data-testid="cta-whatsapp-bakery" className="inline-flex items-center gap-2 rounded-full bg-white border border-stone-200 hover:border-emerald-400 text-stone-800 font-bold px-6 py-3 transition active:scale-95">
                <MessageCircle size={16} className="text-emerald-600"/> Falar no WhatsApp
              </a>
            )}
          </div>
        </div>
        <div className="absolute -right-10 -bottom-10 w-56 h-56 rounded-full bg-amber-200/60 blur-3xl"/>
      </section>

      {categories.length > 0 && (
        <section>
          <h2 className="font-serif font-black text-2xl mb-4">Categorias</h2>
          <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 snap-x">
            {categories.map((c) => (
              <Link key={c.id} to={`/produtos?cat=${c.id}`} data-testid={`cat-${c.id}`} className="snap-start shrink-0 rounded-2xl border border-stone-200 bg-white px-5 py-3 font-semibold text-stone-800 hover:bg-amber-50 hover:border-amber-300 transition">
                {c.name}
              </Link>
            ))}
          </div>
        </section>
      )}

      {onSale.length > 0 && (
        <section>
          <div className="flex items-baseline justify-between mb-4">
            <h2 className="font-serif font-black text-2xl">Ofertas</h2>
            <Link to="/produtos" className="text-sm text-amber-700 font-semibold">ver tudo</Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {onSale.slice(0, 6).map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
        </section>
      )}

      <section>
        <div className="flex items-baseline justify-between mb-4">
          <h2 className="font-serif font-black text-2xl">Destaques</h2>
          <Link to="/produtos" className="text-sm text-amber-700 font-semibold">ver tudo</Link>
        </div>
        {featured.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-stone-300 p-8 text-center text-stone-500">
            <p>Nenhum produto cadastrado ainda.</p>
            <p className="text-sm mt-1">O administrador precisa cadastrar produtos no painel.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {featured.slice(0, 8).map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
        )}
      </section>
    </div>
  );
}

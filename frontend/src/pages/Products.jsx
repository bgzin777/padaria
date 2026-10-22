import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "@/lib/api";
import ProductCard from "@/components/ProductCard";

export default function Products() {
  const [params, setParams] = useSearchParams();
  const activeCat = params.get("cat") || "";
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [q, setQ] = useState("");

  useEffect(() => { api.get("/categories").then((r) => setCategories(r.data)).catch(() => {}); }, []);
  useEffect(() => {
    api.get("/products", { params: activeCat ? { category_id: activeCat } : {} })
      .then((r) => setProducts(r.data)).catch(() => setProducts([]));
  }, [activeCat]);

  const filtered = products.filter((p) => p.name.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="space-y-6">
      <h1 className="font-serif font-black text-3xl">Nossos produtos</h1>
      <input data-testid="products-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar produto..." className="w-full rounded-full border border-stone-200 bg-white px-5 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500"/>
      <div className="flex gap-2 overflow-x-auto -mx-4 px-4 pb-2 snap-x">
        <button data-testid="filter-cat-all" onClick={() => setParams({})} className={`snap-start shrink-0 rounded-full px-4 py-2 text-sm font-semibold border transition ${!activeCat ? "bg-amber-600 text-white border-amber-600" : "bg-white text-stone-700 border-stone-200 hover:border-amber-300"}`}>Tudo</button>
        {categories.map((c) => (
          <button key={c.id} data-testid={`filter-cat-${c.id}`} onClick={() => setParams({ cat: c.id })} className={`snap-start shrink-0 rounded-full px-4 py-2 text-sm font-semibold border transition ${activeCat === c.id ? "bg-amber-600 text-white border-amber-600" : "bg-white text-stone-700 border-stone-200 hover:border-amber-300"}`}>{c.name}</button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-stone-300 p-10 text-center text-stone-500">Nenhum produto encontrado.</div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {filtered.map((p) => <ProductCard key={p.id} product={p} />)}
        </div>
      )}
    </div>
  );
}

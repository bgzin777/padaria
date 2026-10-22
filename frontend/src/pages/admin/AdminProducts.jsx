import { useEffect, useState } from "react";
import { api, fileUrl, brl, formatApiError } from "@/lib/api";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Upload } from "lucide-react";

const empty = { name: "", description: "", category_id: "", price: 0, stock: 0, unit: "un", image: "", active: true, featured: false, on_sale: false, sale_price: null, low_stock_threshold: 5 };

export default function AdminProducts() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [editing, setEditing] = useState(null);
  const [uploading, setUploading] = useState(false);

  const load = () => {
    api.get("/admin/products").then((r) => setProducts(r.data)).catch(() => {});
    api.get("/admin/categories").then((r) => setCategories(r.data)).catch(() => {});
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    try {
      const p = { ...editing, price: Number(editing.price), stock: Number(editing.stock), sale_price: editing.sale_price ? Number(editing.sale_price) : null, low_stock_threshold: Number(editing.low_stock_threshold) };
      if (editing.id) await api.patch(`/admin/products/${editing.id}`, p);
      else await api.post("/admin/products", p);
      toast.success("Produto salvo");
      setEditing(null); load();
    } catch (e) { toast.error(formatApiError(e)); }
  };

  const del = async (p) => {
    if (!window.confirm(`Excluir ${p.name}?`)) return;
    await api.delete(`/admin/products/${p.id}`); load();
  };

  const upload = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData(); fd.append("file", file);
      const { data } = await api.post("/upload", fd, { headers: { "Content-Type": "multipart/form-data" } });
      setEditing((e) => ({ ...e, image: data.url }));
      toast.success("Imagem enviada");
    } catch (e) { toast.error(formatApiError(e)); }
    finally { setUploading(false); }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="font-serif font-black text-3xl">Produtos</h1>
        <button data-testid="new-product-btn" onClick={() => setEditing({ ...empty })} className="rounded-full bg-amber-600 hover:bg-amber-700 text-white font-bold px-5 py-2.5 text-sm flex items-center gap-1 transition"><Plus size={16}/> Novo produto</button>
      </div>

      {categories.length === 0 && <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4 text-sm text-amber-800">Cadastre pelo menos uma <b>categoria</b> antes de criar produtos.</div>}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {products.map((p) => (
          <div key={p.id} data-testid={`admin-product-${p.id}`} className="bg-white rounded-3xl border border-stone-200 p-4 flex gap-3">
            <div className="w-20 h-20 rounded-2xl bg-stone-100 overflow-hidden flex items-center justify-center shrink-0">
              {p.image ? <img src={fileUrl(p.image)} alt={p.name} className="w-full h-full object-cover"/> : <span className="text-3xl">🥖</span>}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex justify-between gap-2">
                <div className="font-bold truncate">{p.name}</div>
                <div className={`text-[10px] uppercase font-bold tracking-widest ${p.active ? "text-emerald-600" : "text-stone-400"}`}>{p.active ? "Ativo" : "Inativo"}</div>
              </div>
              <div className="text-sm text-amber-700 font-bold">{brl(p.price)} <span className="text-stone-400 text-xs font-normal">/ {p.unit}</span></div>
              <div className="text-xs text-stone-500">Estoque: {p.stock}</div>
              <div className="flex gap-2 mt-2">
                <button data-testid={`edit-product-${p.id}`} onClick={() => setEditing(p)} className="text-xs rounded-full bg-stone-100 hover:bg-stone-200 px-3 py-1 flex items-center gap-1"><Pencil size={12}/> Editar</button>
                <button data-testid={`delete-product-${p.id}`} onClick={() => del(p)} className="text-xs rounded-full bg-red-50 hover:bg-red-100 text-red-700 px-3 py-1 flex items-center gap-1"><Trash2 size={12}/> Excluir</button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {editing && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setEditing(null)}>
          <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-3xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 space-y-3">
            <h2 className="font-serif font-black text-2xl">{editing.id ? "Editar produto" : "Novo produto"}</h2>
            <input data-testid="pf-name" value={editing.name} onChange={(e) => setEditing({...editing, name: e.target.value})} placeholder="Nome" className="w-full rounded-xl border border-stone-200 px-4 py-2.5 text-sm"/>
            <textarea data-testid="pf-desc" value={editing.description} onChange={(e) => setEditing({...editing, description: e.target.value})} placeholder="Descrição" rows={2} className="w-full rounded-xl border border-stone-200 px-4 py-2.5 text-sm"/>
            <select data-testid="pf-category" value={editing.category_id} onChange={(e) => setEditing({...editing, category_id: e.target.value})} className="w-full rounded-xl border border-stone-200 px-4 py-2.5 text-sm">
              <option value="">Selecione a categoria</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <div className="grid grid-cols-3 gap-2">
              <input data-testid="pf-price" type="number" step="0.01" value={editing.price} onChange={(e) => setEditing({...editing, price: e.target.value})} placeholder="Preço" className="rounded-xl border border-stone-200 px-3 py-2.5 text-sm"/>
              <input data-testid="pf-stock" type="number" step="0.01" value={editing.stock} onChange={(e) => setEditing({...editing, stock: e.target.value})} placeholder="Estoque" className="rounded-xl border border-stone-200 px-3 py-2.5 text-sm"/>
              <select data-testid="pf-unit" value={editing.unit} onChange={(e) => setEditing({...editing, unit: e.target.value})} className="rounded-xl border border-stone-200 px-3 py-2.5 text-sm">
                {["un", "kg", "g", "L", "ml", "fatia", "pct"].map((u) => <option key={u}>{u}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-3">
              <label className="flex-1 rounded-xl border border-dashed border-stone-300 p-3 flex items-center gap-2 cursor-pointer hover:border-amber-400">
                <Upload size={16}/> <span className="text-sm">{uploading ? "Enviando..." : "Imagem do produto"}</span>
                <input data-testid="pf-image" type="file" accept="image/*" className="hidden" onChange={(e) => upload(e.target.files?.[0])}/>
              </label>
              {editing.image && <img src={fileUrl(editing.image)} className="w-16 h-16 rounded-xl object-cover" alt=""/>}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={editing.active} onChange={(e) => setEditing({...editing, active: e.target.checked})}/> Ativo</label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={editing.featured} onChange={(e) => setEditing({...editing, featured: e.target.checked})}/> Destaque</label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={editing.on_sale} onChange={(e) => setEditing({...editing, on_sale: e.target.checked})}/> Em oferta</label>
              {editing.on_sale && <input type="number" step="0.01" value={editing.sale_price || ""} onChange={(e) => setEditing({...editing, sale_price: e.target.value})} placeholder="Preço promocional" className="rounded-xl border border-stone-200 px-3 py-2 text-sm"/>}
            </div>
            <input type="number" value={editing.low_stock_threshold} onChange={(e) => setEditing({...editing, low_stock_threshold: e.target.value})} placeholder="Alerta de estoque baixo" className="w-full rounded-xl border border-stone-200 px-4 py-2.5 text-sm"/>
            <div className="flex gap-2 pt-2">
              <button onClick={() => setEditing(null)} className="flex-1 rounded-full bg-stone-100 hover:bg-stone-200 py-2.5 font-bold text-sm">Cancelar</button>
              <button data-testid="pf-save" onClick={save} className="flex-1 rounded-full bg-amber-600 hover:bg-amber-700 text-white py-2.5 font-bold text-sm">Salvar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

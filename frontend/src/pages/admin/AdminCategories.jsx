import { useEffect, useState } from "react";
import { api, formatApiError } from "@/lib/api";
import { toast } from "sonner";
import { Plus, Trash2, Pencil } from "lucide-react";

export default function AdminCategories() {
  const [cats, setCats] = useState([]);
  const [editing, setEditing] = useState(null);
  const load = () => api.get("/admin/categories").then((r) => setCats(r.data)).catch(() => {});
  useEffect(() => { load(); }, []);

  const save = async () => {
    try {
      if (editing.id) await api.patch(`/admin/categories/${editing.id}`, editing);
      else await api.post("/admin/categories", editing);
      toast.success("Categoria salva"); setEditing(null); load();
    } catch (e) { toast.error(formatApiError(e)); }
  };
  const del = async (c) => { if (!window.confirm(`Excluir ${c.name}?`)) return; await api.delete(`/admin/categories/${c.id}`); load(); };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="font-serif font-black text-3xl">Categorias</h1>
        <button data-testid="new-category-btn" onClick={() => setEditing({ name: "", image: "", active: true })} className="rounded-full bg-amber-600 hover:bg-amber-700 text-white font-bold px-5 py-2.5 text-sm flex items-center gap-1"><Plus size={16}/> Nova</button>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {cats.map((c) => (
          <div key={c.id} data-testid={`admin-cat-${c.id}`} className="bg-white rounded-3xl border border-stone-200 p-4">
            <div className="font-bold">{c.name}</div>
            <div className={`text-[10px] uppercase font-bold ${c.active ? "text-emerald-600" : "text-stone-400"}`}>{c.active ? "Ativa" : "Inativa"}</div>
            <div className="flex gap-2 mt-3">
              <button onClick={() => setEditing(c)} data-testid={`edit-cat-${c.id}`} className="text-xs rounded-full bg-stone-100 px-3 py-1 flex items-center gap-1"><Pencil size={12}/> Editar</button>
              <button onClick={() => del(c)} data-testid={`delete-cat-${c.id}`} className="text-xs rounded-full bg-red-50 text-red-700 px-3 py-1 flex items-center gap-1"><Trash2 size={12}/> Excluir</button>
            </div>
          </div>
        ))}
      </div>
      {editing && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setEditing(null)}>
          <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-3xl max-w-sm w-full p-6 space-y-3">
            <h2 className="font-serif font-black text-xl">{editing.id ? "Editar categoria" : "Nova categoria"}</h2>
            <input data-testid="cf-name" value={editing.name} onChange={(e) => setEditing({...editing, name: e.target.value})} placeholder="Nome" className="w-full rounded-xl border border-stone-200 px-4 py-2.5 text-sm"/>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={editing.active} onChange={(e) => setEditing({...editing, active: e.target.checked})}/> Ativa</label>
            <div className="flex gap-2">
              <button onClick={() => setEditing(null)} className="flex-1 rounded-full bg-stone-100 py-2.5 font-bold text-sm">Cancelar</button>
              <button data-testid="cf-save" onClick={save} className="flex-1 rounded-full bg-amber-600 text-white py-2.5 font-bold text-sm">Salvar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

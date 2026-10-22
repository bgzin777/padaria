import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { LogOut, Settings } from "lucide-react";

export default function Account() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  if (!user) {
    return (
      <div className="text-center py-16 space-y-4">
        <h1 className="font-serif font-black text-3xl">Minha conta</h1>
        <p className="text-stone-500">Entre ou crie sua conta para acompanhar seus pedidos.</p>
        <Link to="/auth" data-testid="account-login-cta" className="inline-block rounded-full bg-amber-600 hover:bg-amber-700 text-white font-bold px-6 py-3 transition">Entrar / Cadastrar</Link>
      </div>
    );
  }

  const handleLogout = async () => { await logout(); navigate("/"); };

  return (
    <div className="space-y-6 max-w-xl">
      <h1 className="font-serif font-black text-3xl">Minha conta</h1>
      <div className="bg-white rounded-3xl border border-stone-200 p-5 space-y-2">
        <div className="flex items-center gap-3">
          <div className="w-14 h-14 rounded-full bg-amber-100 text-amber-800 font-serif font-black text-xl flex items-center justify-center">{user.name?.[0]?.toUpperCase() || "?"}</div>
          <div>
            <div className="font-bold text-stone-900">{user.name}</div>
            <div className="text-sm text-stone-500">{user.email}</div>
            <div className="text-xs text-stone-400">{user.phone}</div>
          </div>
        </div>
      </div>

      {user.role === "admin" && (
        <Link to="/admin" data-testid="account-admin-link" className="flex items-center gap-2 rounded-2xl bg-amber-50 border border-amber-200 p-4 hover:bg-amber-100 transition">
          <Settings size={18} className="text-amber-700"/>
          <div>
            <div className="font-bold text-amber-800">Painel do dono</div>
            <div className="text-xs text-amber-700">Gerencie sua padaria</div>
          </div>
        </Link>
      )}

      <button data-testid="logout-btn" onClick={handleLogout} className="w-full rounded-full bg-stone-100 hover:bg-stone-200 text-stone-800 font-bold py-3 transition flex items-center justify-center gap-2"><LogOut size={16}/> Sair</button>
    </div>
  );
}

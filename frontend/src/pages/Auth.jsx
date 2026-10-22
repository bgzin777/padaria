import { useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { formatApiError } from "@/lib/api";
import { toast } from "sonner";

export default function Auth() {
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "" });
  const [submitting, setSubmitting] = useState(false);
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || "/";

  const submit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      let u;
      if (mode === "login") u = await login(form.email, form.password);
      else u = await register(form);
      toast.success(`Bem-vindo, ${u.name}!`);
      navigate(u.role === "admin" ? "/admin" : from, { replace: true });
    } catch (e) {
      toast.error(formatApiError(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-amber-50 via-stone-50 to-orange-100">
      <div className="w-full max-w-md">
        <Link to="/" className="flex items-center gap-2 mb-6 justify-center">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center text-white font-serif font-black text-xl">B</div>
          <div>
            <div className="font-serif font-black text-lg">PADARIA DO BRUNAO</div>
            <div className="text-[10px] text-stone-500 uppercase tracking-widest">Pedidos online</div>
          </div>
        </Link>

        <div className="bg-white rounded-3xl border border-stone-200 p-6 sm:p-8 shadow-[0_20px_60px_rgb(0,0,0,0.06)]">
          <div className="flex bg-stone-100 rounded-full p-1 mb-6">
            <button data-testid="auth-tab-login" onClick={() => setMode("login")} className={`flex-1 rounded-full py-2 text-sm font-bold transition ${mode === "login" ? "bg-white shadow" : "text-stone-500"}`}>Entrar</button>
            <button data-testid="auth-tab-register" onClick={() => setMode("register")} className={`flex-1 rounded-full py-2 text-sm font-bold transition ${mode === "register" ? "bg-white shadow" : "text-stone-500"}`}>Cadastrar</button>
          </div>
          <form onSubmit={submit} className="space-y-3">
            {mode === "register" && (
              <>
                <input data-testid="auth-name" required value={form.name} onChange={(e) => setForm({...form, name: e.target.value})} placeholder="Nome completo" className="w-full rounded-xl border border-stone-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500"/>
                <input data-testid="auth-phone" required value={form.phone} onChange={(e) => setForm({...form, phone: e.target.value})} placeholder="Telefone" className="w-full rounded-xl border border-stone-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500"/>
              </>
            )}
            <input data-testid="auth-email" required type="email" value={form.email} onChange={(e) => setForm({...form, email: e.target.value})} placeholder="Email" className="w-full rounded-xl border border-stone-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500"/>
            <input data-testid="auth-password" required type="password" value={form.password} onChange={(e) => setForm({...form, password: e.target.value})} placeholder="Senha" className="w-full rounded-xl border border-stone-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500"/>
            <button data-testid="auth-submit" disabled={submitting} className="w-full rounded-full bg-amber-600 hover:bg-amber-700 disabled:bg-stone-300 text-white font-bold py-3 transition active:scale-95">
              {submitting ? "Aguarde..." : mode === "login" ? "Entrar" : "Criar conta"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

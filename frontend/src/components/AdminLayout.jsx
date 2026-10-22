import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { LayoutDashboard, ClipboardList, Package, Tag, Users, MessageCircle, DollarSign, Settings, LogOut, Menu } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useState } from "react";

const links = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, end: true, testid: "admin-nav-dashboard" },
  { to: "/admin/pedidos", label: "Pedidos", icon: ClipboardList, testid: "admin-nav-orders" },
  { to: "/admin/produtos", label: "Produtos", icon: Package, testid: "admin-nav-products" },
  { to: "/admin/categorias", label: "Categorias", icon: Tag, testid: "admin-nav-categories" },
  { to: "/admin/clientes", label: "Clientes", icon: Users, testid: "admin-nav-customers" },
  { to: "/admin/chat", label: "Chat", icon: MessageCircle, testid: "admin-nav-chat" },
  { to: "/admin/financeiro", label: "Financeiro", icon: DollarSign, testid: "admin-nav-financial" },
  { to: "/admin/config", label: "Configurações", icon: Settings, testid: "admin-nav-settings" },
];

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate("/auth");
  };

  const item = ({ isActive }) =>
    `flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${
      isActive ? "bg-amber-600 text-white" : "text-stone-700 hover:bg-stone-100"
    }`;

  return (
    <div className="min-h-screen bg-stone-50 flex">
      <aside className={`fixed lg:sticky top-0 left-0 h-screen w-64 bg-white border-r border-stone-200 z-50 transform transition-transform ${open ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}>
        <div className="flex items-center gap-2 px-5 py-5 border-b border-stone-200">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center text-white font-serif font-black text-lg">B</div>
          <div>
            <div className="font-serif font-black leading-none text-stone-900">Brunao</div>
            <div className="text-[10px] text-stone-500 uppercase tracking-widest">Painel do dono</div>
          </div>
        </div>
        <nav className="p-3 space-y-1">
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.end} className={item} data-testid={l.testid} onClick={() => setOpen(false)}>
              <l.icon size={18}/> {l.label}
            </NavLink>
          ))}
        </nav>
        <div className="absolute bottom-0 left-0 w-full p-3 border-t border-stone-200">
          <div className="text-xs text-stone-500 px-2 mb-2 truncate">{user?.email}</div>
          <button data-testid="admin-logout-btn" onClick={handleLogout} className="w-full flex items-center gap-2 justify-center rounded-full bg-stone-100 hover:bg-stone-200 text-stone-800 text-sm font-semibold py-2 transition">
            <LogOut size={16}/> Sair
          </button>
        </div>
      </aside>

      <div className="flex-1 min-w-0">
        <header className="lg:hidden sticky top-0 z-40 bg-white/90 backdrop-blur border-b border-stone-200 flex items-center gap-2 px-4 py-3">
          <button onClick={() => setOpen((o) => !o)} className="p-2 rounded-lg hover:bg-stone-100" data-testid="admin-menu-btn"><Menu size={20}/></button>
          <div className="font-serif font-bold">Painel Admin</div>
        </header>
        <main className="p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>

      {open && <div onClick={() => setOpen(false)} className="lg:hidden fixed inset-0 bg-black/40 z-40"/>}
    </div>
  );
}

import { Outlet, NavLink } from "react-router-dom";
import { Home, ShoppingCart, Package, MessageCircle, User } from "lucide-react";
import { useCart } from "@/context/CartContext";
import { useSettings } from "@/context/SettingsContext";

export default function ClientLayout() {
  const { count } = useCart();
  const { settings } = useSettings();

  const navItem = ({ isActive }) =>
    `flex flex-col items-center justify-center gap-1 flex-1 h-full text-[10px] font-semibold uppercase tracking-wider transition-colors ${
      isActive ? "text-amber-700" : "text-stone-500 hover:text-stone-800"
    }`;

  return (
    <div className="min-h-screen bg-stone-50">
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-white/85 border-b border-stone-200/60">
        <div className="max-w-5xl mx-auto flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center text-white font-serif font-black text-lg">B</div>
            <div>
              <div className="font-serif font-black text-sm sm:text-base leading-none text-stone-900">{settings.bakery_name}</div>
              <div className="text-[10px] text-stone-500 uppercase tracking-widest">Pedidos online</div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 pt-4 pb-28">
        <Outlet />
      </main>

      <nav data-testid="bottom-nav" className="fixed bottom-0 left-0 w-full h-16 bg-white border-t border-stone-200 flex justify-around items-stretch z-50 pb-safe">
        <NavLink to="/" end className={navItem} data-testid="nav-home"><Home size={20}/> Início</NavLink>
        <NavLink to="/carrinho" className={navItem} data-testid="nav-cart">
          <div className="relative">
            <ShoppingCart size={20}/>
            {count > 0 && <span className="absolute -top-2 -right-3 bg-amber-600 text-white text-[10px] rounded-full px-1.5 py-0.5 font-bold">{count}</span>}
          </div>
          Carrinho
        </NavLink>
        <NavLink to="/pedidos" className={navItem} data-testid="nav-orders"><Package size={20}/> Pedidos</NavLink>
        <NavLink to="/chat" className={navItem} data-testid="nav-chat"><MessageCircle size={20}/> Chat</NavLink>
        <NavLink to="/conta" className={navItem} data-testid="nav-account"><User size={20}/> Conta</NavLink>
      </nav>
    </div>
  );
}

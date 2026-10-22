import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider } from "@/context/AuthContext";
import { CartProvider } from "@/context/CartContext";
import { SettingsProvider } from "@/context/SettingsContext";
import { RealtimeProvider } from "@/context/RealtimeContext";
import ClientLayout from "@/components/ClientLayout";
import AdminLayout from "@/components/AdminLayout";
import ProtectedRoute from "@/components/ProtectedRoute";

import Home from "@/pages/Home";
import Products from "@/pages/Products";
import Cart from "@/pages/Cart";
import Checkout from "@/pages/Checkout";
import Orders from "@/pages/Orders";
import Chat from "@/pages/Chat";
import Account from "@/pages/Account";
import Auth from "@/pages/Auth";

import AdminDashboard from "@/pages/admin/AdminDashboard";
import AdminOrders from "@/pages/admin/AdminOrders";
import AdminProducts from "@/pages/admin/AdminProducts";
import AdminCategories from "@/pages/admin/AdminCategories";
import AdminCustomers from "@/pages/admin/AdminCustomers";
import AdminChat from "@/pages/admin/AdminChat";
import AdminFinancial from "@/pages/admin/AdminFinancial";
import AdminSettings from "@/pages/admin/AdminSettings";

function App() {
  return (
    <BrowserRouter>
      <SettingsProvider>
        <AuthProvider>
          <RealtimeProvider>
            <CartProvider>
              <Toaster position="top-center" richColors closeButton />
              <Routes>
                <Route path="/auth" element={<Auth />} />

                <Route element={<ClientLayout />}>
                  <Route path="/" element={<Home />} />
                  <Route path="/produtos" element={<Products />} />
                  <Route path="/carrinho" element={<Cart />} />
                  <Route path="/checkout" element={<ProtectedRoute><Checkout /></ProtectedRoute>} />
                  <Route path="/pedidos" element={<ProtectedRoute><Orders /></ProtectedRoute>} />
                  <Route path="/chat" element={<ProtectedRoute><Chat /></ProtectedRoute>} />
                  <Route path="/conta" element={<Account />} />
                </Route>

                <Route element={<ProtectedRoute adminOnly><AdminLayout /></ProtectedRoute>}>
                  <Route path="/admin" element={<AdminDashboard />} />
                  <Route path="/admin/pedidos" element={<AdminOrders />} />
                  <Route path="/admin/produtos" element={<AdminProducts />} />
                  <Route path="/admin/categorias" element={<AdminCategories />} />
                  <Route path="/admin/clientes" element={<AdminCustomers />} />
                  <Route path="/admin/chat" element={<AdminChat />} />
                  <Route path="/admin/financeiro" element={<AdminFinancial />} />
                  <Route path="/admin/config" element={<AdminSettings />} />
                </Route>

                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </CartProvider>
          </RealtimeProvider>
        </AuthProvider>
      </SettingsProvider>
    </BrowserRouter>
  );
}

export default App;

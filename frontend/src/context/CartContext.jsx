import { createContext, useContext, useEffect, useMemo, useState } from "react";

const KEY = "brunao_cart_v1";
const CartCtx = createContext(null);
export const useCart = () => useContext(CartCtx);

export function CartProvider({ children }) {
  const [items, setItems] = useState(() => {
    try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; }
  });

  useEffect(() => { localStorage.setItem(KEY, JSON.stringify(items)); }, [items]);

  const add = (product, qty = 1) => {
    setItems((prev) => {
      const idx = prev.findIndex((i) => i.product_id === product.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = { ...copy[idx], quantity: copy[idx].quantity + qty };
        return copy;
      }
      const price = product.on_sale && product.sale_price ? product.sale_price : product.price;
      return [
        ...prev,
        {
          product_id: product.id,
          name: product.name,
          image: product.image,
          unit: product.unit,
          price,
          quantity: qty,
        },
      ];
    });
  };

  const setQty = (product_id, qty) =>
    setItems((prev) => prev.map((i) => (i.product_id === product_id ? { ...i, quantity: qty } : i)).filter((i) => i.quantity > 0));

  const remove = (product_id) => setItems((prev) => prev.filter((i) => i.product_id !== product_id));
  const clear = () => setItems([]);

  const subtotal = useMemo(() => items.reduce((s, i) => s + Number(i.price) * Number(i.quantity), 0), [items]);
  const count = useMemo(() => items.reduce((s, i) => s + Number(i.quantity), 0), [items]);

  return (
    <CartCtx.Provider value={{ items, add, setQty, remove, clear, subtotal, count }}>
      {children}
    </CartCtx.Provider>
  );
}

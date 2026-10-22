import { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { BACKEND_URL } from "@/lib/api";
import { toast } from "sonner";

const RealtimeCtx = createContext(null);
export const useRealtime = () => useContext(RealtimeCtx);

function playBeep() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    o.frequency.value = 880;
    o.connect(g);
    g.connect(ctx.destination);
    g.gain.setValueAtTime(0.2, ctx.currentTime);
    o.start();
    o.stop(ctx.currentTime + 0.35);
    setTimeout(() => ctx.close(), 500);
  } catch {}
}

export function RealtimeProvider({ children }) {
  const { user } = useAuth();
  const wsRef = useRef(null);
  const [listeners] = useState(() => new Set());
  const [connected, setConnected] = useState(false);

  const dispatch = useCallback((msg) => {
    listeners.forEach((cb) => { try { cb(msg); } catch {} });
  }, [listeners]);

  useEffect(() => {
    if (!user) return;
    const token = localStorage.getItem("brunao_token");
    if (!token) return;
    const wsUrl = BACKEND_URL.replace(/^http/, "ws") + `/api/ws?token=${token}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;
    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);
    ws.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data);
        dispatch(data);
        if (data.type === "new_order" && user.role === "admin") {
          playBeep();
          toast.success(`NOVO PEDIDO #${data.order.order_number}`, {
            description: `${data.order.customer_name} — ${Number(data.order.total).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`,
          });
        } else if (data.type === "order_status") {
          toast.info(`Pedido #${data.order.order_number}`, { description: `Status: ${data.order.status}` });
        } else if (data.type === "chat_message") {
          toast.message("Nova mensagem", { description: data.message.message });
        }
      } catch {}
    };
    return () => { try { ws.close(); } catch {} };
  }, [user, dispatch]);

  const subscribe = useCallback((cb) => {
    listeners.add(cb);
    return () => listeners.delete(cb);
  }, [listeners]);

  return <RealtimeCtx.Provider value={{ connected, subscribe }}>{children}</RealtimeCtx.Provider>;
}

import { useEffect, useState, useCallback, useRef } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useRealtime } from "@/context/RealtimeContext";
import { Send } from "lucide-react";

export default function AdminChat() {
  const { user } = useAuth();
  const { subscribe } = useRealtime();
  const [convs, setConvs] = useState([]);
  const [active, setActive] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const scrollRef = useRef(null);

  const loadConvs = useCallback(() => api.get("/chat/conversations").then((r) => setConvs(r.data)).catch(() => {}), []);
  const loadMessages = useCallback((id) => api.get(`/chat/${id}/messages`).then((r) => setMessages(r.data)).catch(() => {}), []);

  useEffect(() => { loadConvs(); }, [loadConvs]);
  useEffect(() => subscribe((m) => { if (m.type === "chat_message") { loadConvs(); if (active && m.conversation_id === active.id) loadMessages(active.id); } }), [subscribe, loadConvs, loadMessages, active]);
  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [messages]);

  const open = (c) => { setActive(c); loadMessages(c.id); };
  const send = async () => {
    if (!text.trim() || !active) return;
    await api.post(`/chat/${active.id}/messages`, { message: text.trim() });
    setText(""); loadMessages(active.id); loadConvs();
  };

  return (
    <div className="space-y-4">
      <h1 className="font-serif font-black text-3xl">Chat</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 h-[calc(100vh-220px)]">
        <div className="bg-white rounded-3xl border border-stone-200 overflow-y-auto">
          {convs.length === 0 && <div className="p-4 text-sm text-stone-500">Nenhuma conversa.</div>}
          {convs.map((c) => (
            <button key={c.id} data-testid={`conv-${c.id}`} onClick={() => open(c)} className={`w-full text-left p-4 border-b border-stone-100 hover:bg-stone-50 flex items-center justify-between ${active?.id === c.id ? "bg-amber-50" : ""}`}>
              <div>
                <div className="font-bold">{c.customer_name}</div>
                <div className="text-xs text-stone-500">{new Date(c.updated_at).toLocaleString("pt-BR")}</div>
              </div>
              {c.unread_admin > 0 && <span className="rounded-full bg-amber-600 text-white text-[10px] font-bold px-2 py-0.5">{c.unread_admin}</span>}
            </button>
          ))}
        </div>
        <div className="md:col-span-2 bg-white rounded-3xl border border-stone-200 flex flex-col">
          {!active ? (
            <div className="flex-1 flex items-center justify-center text-stone-400 text-sm">Selecione uma conversa</div>
          ) : (
            <>
              <div className="p-4 border-b border-stone-100">
                <div className="font-bold">{active.customer_name}</div>
                {active.order_id && <div className="text-xs text-stone-500">Pedido relacionado: {active.order_id.slice(0, 8)}</div>}
              </div>
              <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-2">
                {messages.map((m) => {
                  const mine = m.sender_id === user.id;
                  return (
                    <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm ${mine ? "bg-amber-600 text-white" : "bg-stone-100 text-stone-800"}`}>
                        <div className="text-[10px] uppercase tracking-widest opacity-70 mb-0.5">{mine ? "Você" : m.sender_name}</div>
                        {m.message}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="p-3 border-t border-stone-100 flex gap-2">
                <input data-testid="admin-chat-input" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder="Responder..." className="flex-1 rounded-full border border-stone-200 px-5 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500"/>
                <button data-testid="admin-chat-send" onClick={send} className="rounded-full bg-amber-600 hover:bg-amber-700 text-white w-12 h-12 flex items-center justify-center"><Send size={18}/></button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

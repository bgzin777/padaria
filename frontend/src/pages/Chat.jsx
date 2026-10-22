import { useEffect, useRef, useState, useCallback } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useRealtime } from "@/context/RealtimeContext";
import { Send } from "lucide-react";

export default function Chat() {
  const { user } = useAuth();
  const { subscribe } = useRealtime();
  const [conv, setConv] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const scrollRef = useRef(null);

  const loadMessages = useCallback((id) => api.get(`/chat/${id}/messages`).then((r) => setMessages(r.data)).catch(() => {}), []);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.post("/chat/conversations", {});
        setConv(data);
        loadMessages(data.id);
      } catch {}
    })();
  }, [loadMessages]);

  useEffect(() => subscribe((msg) => {
    if (msg.type === "chat_message" && conv && msg.conversation_id === conv.id) loadMessages(conv.id);
  }), [subscribe, conv, loadMessages]);

  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [messages]);

  const send = async () => {
    if (!text.trim() || !conv) return;
    await api.post(`/chat/${conv.id}/messages`, { message: text.trim() });
    setText("");
    loadMessages(conv.id);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-180px)] max-w-2xl mx-auto">
      <h1 className="font-serif font-black text-3xl mb-4">Chat com a padaria</h1>
      <div ref={scrollRef} className="flex-1 overflow-y-auto bg-white rounded-3xl border border-stone-200 p-4 space-y-2">
        {messages.length === 0 && <div className="text-center text-stone-400 text-sm py-10">Envie a primeira mensagem</div>}
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
      <div className="mt-3 flex gap-2">
        <input data-testid="chat-input" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder="Escreva uma mensagem..." className="flex-1 rounded-full border border-stone-200 bg-white px-5 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500"/>
        <button data-testid="chat-send" onClick={send} className="rounded-full bg-amber-600 hover:bg-amber-700 text-white w-12 h-12 flex items-center justify-center transition active:scale-95"><Send size={18}/></button>
      </div>
    </div>
  );
}

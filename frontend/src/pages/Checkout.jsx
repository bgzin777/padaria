import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCart } from "@/context/CartContext";
import { useAuth } from "@/context/AuthContext";
import { useSettings } from "@/context/SettingsContext";
import { api, brl, formatApiError } from "@/lib/api";
import { toast } from "sonner";
import { Copy, X } from "lucide-react";

export default function Checkout() {
  const { items, subtotal, clear } = useCart();
  const { user } = useAuth();
  const { settings } = useSettings();
  const navigate = useNavigate();

  const [name, setName] = useState(user?.name || "");
  const [phone, setPhone] = useState(user?.phone || "");
  const [deliveryType, setDeliveryType] = useState("delivery");
  const [address, setAddress] = useState({ street: "", number: "", neighborhood: "", city: "", complement: "" });
  const [paymentMethod, setPaymentMethod] = useState("pix");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [pixOrder, setPixOrder] = useState(null);

  const deliveryFee = deliveryType === "delivery" ? Number(settings.delivery_fee || 0) : 0;
  const total = subtotal + deliveryFee;

  if (items.length === 0 && !pixOrder) {
    return <div className="text-center py-16"><p>Carrinho vazio.</p></div>;
  }

  const submit = async () => {
    if (!name || !phone) return toast.error("Informe seu nome e telefone");
    if (deliveryType === "delivery" && (!address.street || !address.number)) return toast.error("Informe o endereço completo");
    setSubmitting(true);
    try {
      const payload = {
        items: items.map((i) => ({ product_id: i.product_id, quantity: i.quantity })),
        delivery_type: deliveryType,
        address: deliveryType === "delivery" ? address : null,
        payment_method: paymentMethod,
        notes,
        customer_name: name,
        customer_phone: phone,
      };
      const { data } = await api.post("/orders", payload);
      clear();
      if (paymentMethod === "pix" && data.pix_info?.qr_code) {
        setPixOrder(data);
      } else {
        toast.success(`Pedido #${data.order_number} criado!`);
        navigate("/pedidos");
      }
    } catch (e) {
      toast.error(formatApiError(e));
    } finally {
      setSubmitting(false);
    }
  };

  const copyPix = async () => {
    if (!pixOrder?.pix_info?.qr_code) return;
    await navigator.clipboard.writeText(pixOrder.pix_info.qr_code);
    toast.success("Código PIX copiado!");
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="font-serif font-black text-3xl">Finalizar pedido</h1>

      <section className="bg-white rounded-3xl border border-stone-200 p-5 space-y-3">
        <h2 className="font-serif font-bold text-lg">Seus dados</h2>
        <input data-testid="checkout-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome completo" className="w-full rounded-xl border border-stone-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500"/>
        <input data-testid="checkout-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Telefone com DDD (ex.: 11987654321)" className="w-full rounded-xl border border-stone-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500"/>
      </section>

      <section className="bg-white rounded-3xl border border-stone-200 p-5 space-y-3">
        <h2 className="font-serif font-bold text-lg">Recebimento</h2>
        <div className="grid grid-cols-2 gap-3">
          <button data-testid="delivery-type-delivery" onClick={() => setDeliveryType("delivery")} className={`rounded-2xl border-2 p-4 text-sm font-semibold transition ${deliveryType === "delivery" ? "border-amber-600 bg-amber-50 text-amber-700" : "border-stone-200 bg-white text-stone-700"}`}>🛵 Entrega</button>
          <button data-testid="delivery-type-pickup" onClick={() => setDeliveryType("pickup")} className={`rounded-2xl border-2 p-4 text-sm font-semibold transition ${deliveryType === "pickup" ? "border-amber-600 bg-amber-50 text-amber-700" : "border-stone-200 bg-white text-stone-700"}`}>🏪 Retirar na padaria</button>
        </div>
        {deliveryType === "delivery" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input data-testid="address-street" value={address.street} onChange={(e) => setAddress({...address, street: e.target.value})} placeholder="Rua" className="rounded-xl border border-stone-200 px-4 py-3 text-sm"/>
            <input data-testid="address-number" value={address.number} onChange={(e) => setAddress({...address, number: e.target.value})} placeholder="Número" className="rounded-xl border border-stone-200 px-4 py-3 text-sm"/>
            <input data-testid="address-neighborhood" value={address.neighborhood} onChange={(e) => setAddress({...address, neighborhood: e.target.value})} placeholder="Bairro" className="rounded-xl border border-stone-200 px-4 py-3 text-sm"/>
            <input data-testid="address-city" value={address.city} onChange={(e) => setAddress({...address, city: e.target.value})} placeholder="Cidade" className="rounded-xl border border-stone-200 px-4 py-3 text-sm"/>
            <input data-testid="address-complement" value={address.complement} onChange={(e) => setAddress({...address, complement: e.target.value})} placeholder="Complemento (opcional)" className="rounded-xl border border-stone-200 px-4 py-3 text-sm sm:col-span-2"/>
          </div>
        )}
      </section>

      <section className="bg-white rounded-3xl border border-stone-200 p-5 space-y-3">
        <h2 className="font-serif font-bold text-lg">Pagamento</h2>
        <div className="grid grid-cols-3 gap-2">
          {["pix", "dinheiro", "cartao"].map((m) => (
            <button key={m} data-testid={`payment-${m}`} onClick={() => setPaymentMethod(m)} className={`rounded-2xl border-2 p-3 text-sm font-semibold uppercase transition ${paymentMethod === m ? "border-amber-600 bg-amber-50 text-amber-700" : "border-stone-200 bg-white text-stone-700"}`}>
              {m === "pix" ? "PIX" : m === "dinheiro" ? "Dinheiro" : "Cartão"}
            </button>
          ))}
        </div>
        {paymentMethod === "pix" && (
          <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4 text-xs text-amber-800">
            Ao confirmar, geramos automaticamente o QR Code PIX. Se o provedor ainda não estiver configurado no servidor, o pedido é criado como <b>pagamento pendente</b> e o dono confirma manualmente.
          </div>
        )}
      </section>

      <section className="bg-white rounded-3xl border border-stone-200 p-5 space-y-3">
        <h2 className="font-serif font-bold text-lg">Observação</h2>
        <textarea data-testid="checkout-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Alguma observação para a padaria?" rows={2} className="w-full rounded-xl border border-stone-200 px-4 py-3 text-sm"/>
      </section>

      <section className="bg-white rounded-3xl border border-stone-200 p-5 space-y-2">
        <div className="flex justify-between text-stone-700"><span>Subtotal</span><span>{brl(subtotal)}</span></div>
        <div className="flex justify-between text-stone-500 text-sm"><span>Taxa de entrega</span><span>{brl(deliveryFee)}</span></div>
        <div className="border-t border-stone-200 pt-2 flex justify-between font-bold text-lg"><span>Total</span><span data-testid="checkout-total" className="text-amber-700">{brl(total)}</span></div>
      </section>

      <button data-testid="checkout-confirm" onClick={submit} disabled={submitting} className="w-full rounded-full bg-amber-600 hover:bg-amber-700 disabled:bg-stone-300 text-white font-bold px-6 py-4 transition active:scale-95">
        {submitting ? "Enviando..." : "Confirmar pedido"}
      </button>

      {pixOrder && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => { setPixOrder(null); navigate("/pedidos"); }}>
          <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-xs uppercase tracking-widest text-amber-700 font-bold">Pague com PIX</div>
                <div className="font-serif font-black text-2xl">#{pixOrder.order_number}</div>
              </div>
              <button data-testid="pix-close" onClick={() => { setPixOrder(null); navigate("/pedidos"); }} className="p-2 rounded-full hover:bg-stone-100"><X size={18}/></button>
            </div>
            {pixOrder.pix_info?.qr_code_base64 && (
              <img data-testid="pix-qr-image" src={`data:image/png;base64,${pixOrder.pix_info.qr_code_base64}`} alt="QR Code PIX" className="w-64 h-64 mx-auto"/>
            )}
            <button data-testid="pix-copy" onClick={copyPix} className="w-full rounded-full bg-amber-600 hover:bg-amber-700 text-white font-bold py-3 flex items-center justify-center gap-2 transition active:scale-95">
              <Copy size={16}/> Copiar código PIX
            </button>
            <div className="text-[11px] font-mono break-all bg-stone-50 rounded-xl p-3 border border-stone-200">{pixOrder.pix_info?.qr_code}</div>
            <div className="text-center text-lg font-bold text-amber-700">{brl(pixOrder.total)}</div>
            <div className="text-xs text-stone-500 text-center">Assim que o pagamento cair, seu pedido é confirmado automaticamente e você recebe uma mensagem no WhatsApp.</div>
          </div>
        </div>
      )}
    </div>
  );
}

// WhatsApp message templates per status (used for wa.me click-to-chat buttons)
export const WA_TEMPLATES = {
  received:   (o) => `Olá ${o.customer_name}! 🥖 Recebemos seu pedido *#${o.order_number}* na Padaria do Brunão. Já já começamos a preparar.`,
  accepted:   (o) => `Olá ${o.customer_name}, seu pedido *#${o.order_number}* foi *aceito* ✅. Já já sai fresquinho!`,
  preparing:  (o) => `Olá ${o.customer_name}, seu pedido *#${o.order_number}* está sendo *preparado* agora 👨‍🍳`,
  ready:      (o) => o.delivery_type === "delivery"
      ? `Olá ${o.customer_name}, seu pedido *#${o.order_number}* está *pronto*! Já vamos sair pra entrega 🛵`
      : `Olá ${o.customer_name}, seu pedido *#${o.order_number}* está *pronto para retirada*! 🥖`,
  dispatched: (o) => `Olá ${o.customer_name}, seu pedido *#${o.order_number}* *saiu para entrega* 🛵 Chega logo!`,
  finished:   (o) => `Olá ${o.customer_name}, obrigado pelo pedido *#${o.order_number}*! Volte sempre 🥖❤️`,
  cancelled:  (o) => `Olá ${o.customer_name}, infelizmente seu pedido *#${o.order_number}* precisou ser *cancelado*. Nos chame para mais informações.`,
};

const onlyDigits = (s) => (s || "").replace(/\D/g, "");

export function waMeLink(phone, text) {
  const digits = onlyDigits(phone);
  if (!digits) return null;
  const withCountry = digits.length <= 11 ? `55${digits}` : digits;
  return `https://wa.me/${withCountry}?text=${encodeURIComponent(text)}`;
}

export function waMeForOrder(order) {
  const tpl = WA_TEMPLATES[order.status] || WA_TEMPLATES.received;
  return waMeLink(order.customer_phone, tpl(order));
}

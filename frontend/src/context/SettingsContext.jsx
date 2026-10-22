import { createContext, useContext, useEffect, useState } from "react";
import { api } from "@/lib/api";

const SettingsCtx = createContext(null);
export const useSettings = () => useContext(SettingsCtx);

const DEFAULTS = {
  bakery_name: "PADARIA DO BRUNAO",
  logo: null,
  phone: "",
  address: "",
  hours: "",
  delivery_fee: 5,
  min_order: 15,
  payment_methods: ["pix", "dinheiro", "cartao"],
  welcome_message: "",
};

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(DEFAULTS);

  const refresh = async () => {
    try {
      const { data } = await api.get("/settings");
      setSettings({ ...DEFAULTS, ...data });
    } catch {}
  };

  useEffect(() => { refresh(); }, []);

  return <SettingsCtx.Provider value={{ settings, refresh, setSettings }}>{children}</SettingsCtx.Provider>;
}

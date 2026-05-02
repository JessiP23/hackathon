import { create } from "zustand";

export type InAppItem = {
  id: string;
  title: string;
  body: string;
  type: string;
  dealId?: string;
  subType?: string;
  orderId?: string;
  createdAt: number;
};

function summarize(raw: Record<string, unknown>): Omit<InAppItem, "id" | "createdAt"> {
  const type = String(raw.type || "notice");
  if (type === "new_deal") {
    const item = String(raw.itemName || "Deal");
    const vendor = String(raw.vendorName || "");
    const price = raw.dealPrice != null ? String(raw.dealPrice) : "";
    const priceBit = price ? ` · $${price}` : "";
    return {
      type,
      title: "Nearby deal",
      body: vendor ? `${item} · ${vendor}${priceBit}` : `${item}${priceBit}`,
      dealId: typeof raw.dealId === "string" ? raw.dealId : undefined,
    };
  }
  if (type === "order") {
    const sub = String(raw.subType || "");
    const fallback = sub ? `Order update: ${sub}` : "Order update";
    return {
      type,
      title: "Order",
      body: typeof raw.body === "string" && raw.body ? raw.body : fallback,
      orderId: typeof raw.orderId === "string" ? raw.orderId : undefined,
      subType: sub || undefined,
    };
  }
  if (type === "system")
    return { type, title: "App", body: String(raw.detail ?? "") };
  return { type, title: "Notice", body: JSON.stringify(raw).slice(0, 200) };
}

type State = {
  items: InAppItem[];
  pushFromEvent: (raw: Record<string, unknown>) => void;
  dismiss: (id: string) => void;
};

export const useInAppNotifications = create<State>((set) => ({
  items: [],
  pushFromEvent: (raw) =>
    set((s) => {
      if (String(raw.type) === "system") return s;
      const base = summarize(raw);
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      return { items: [{ ...base, id, createdAt: Date.now() }, ...s.items].slice(0, 6) };
    }),
  dismiss: (id) => set((s) => ({ items: s.items.filter((x) => x.id !== id) })),
}));

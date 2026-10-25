import { useEffect, useState } from "react";
import { Body, fetch, ResponseType } from "@tauri-apps/api/http";
import { Defaults } from "./defaults";

const slots = [["Character", "Skin"], ["Pickaxe", "Pickaxe"], ["Backpack", "Back Bling"]] as const;
type Cosmetic = { name: string; image?: string; empty?: boolean };

export default function EquippedLoadout({ email, password }: { email?: string; password?: string }) {
  const [items, setItems] = useState<Record<string, Cosmetic>>({});
  const [status, setStatus] = useState("Loading loadout…");
  useEffect(() => {
    let cancelled = false;
    let busy = false;
    const refresh = async () => {
      if (busy || document.hidden) return;
      if (!Defaults.ENABLE_API || !email || !password) {
        setStatus("Sign in to view your loadout.");
        return;
      }
      busy = true;
      try {
        const response = await fetch<Record<string, string>>(`${Defaults.BACKEND_URL}/api/launcher/loadout`, {
          method: "POST", body: Body.json({ email, password }), responseType: ResponseType.JSON, timeout: 15,
        });
        if (!response.ok) throw new Error("loadout");
        const entries = await Promise.all(slots.map(async ([slot]) => {
          const id = response.data[slot];
          if (!id) return [slot, { name: "", empty: true }] as const;
          if (id.toLowerCase().includes("random")) return [slot, { name: "Random" }] as const;
          try {
            const cosmetic = await fetch<{ data: { name: string; images: { smallIcon?: string; icon?: string } } }>(
              `https://fortnite-api.com/v2/cosmetics/br/${encodeURIComponent(id)}`,
              { method: "GET", responseType: ResponseType.JSON, timeout: 10 },
            );
            if (!cosmetic.ok) throw new Error("cosmetic");
            return [slot, { name: cosmetic.data.data.name, image: cosmetic.data.data.images.smallIcon || cosmetic.data.data.images.icon }] as const;
          } catch { return [slot, { name: id }] as const; }
        }));
        if (!cancelled) { setItems(Object.fromEntries(entries)); setStatus(""); }
      } catch {
        if (!cancelled) setStatus("Loadout is currently unavailable.");
      } finally { busy = false; }
    };
    void refresh();
    window.addEventListener("focus", refresh);
    return () => { cancelled = true; window.removeEventListener("focus", refresh); };
  }, [email, password]);

  const visibleSlots = slots.filter(([slot]) => items[slot] && !items[slot].empty);
  if (!status && visibleSlots.length === 0) return null;

  return (
    <div className="w-64 shrink-0 hidden md:block p-4">
      <div className="text-[9px] text-slate-400 font-black uppercase tracking-widest mb-3">Your loadout</div>
      {status ? <p className="text-xs text-slate-500">{status}</p> : (
        <div className="grid grid-cols-3 gap-2">
          {visibleSlots.map(([slot, label]) => (
            <div key={slot} className="min-w-0" title={items[slot]?.name}>
              <div className="h-16 rounded-xl bg-white/[0.03] flex items-center justify-center overflow-hidden">
                {items[slot]?.image ? <img key={items[slot].image} src={items[slot].image} alt={items[slot].name} className="w-full h-full object-contain" onError={event => { event.currentTarget.style.display = "none"; }} /> : <span className="text-slate-600">—</span>}
              </div>
              <div className="text-[9px] text-slate-300 font-bold mt-2">{label}</div>
              <div className="text-[9px] text-slate-400 truncate mt-0.5">{items[slot]?.name}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

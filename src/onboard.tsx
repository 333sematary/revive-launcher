// src/onboard.tsx
import React, { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/tauri";
import { open } from "@tauri-apps/api/dialog";
import { readBinaryFile, exists } from "@tauri-apps/api/fs";
import { join } from "@tauri-apps/api/path";
import { useNavigate } from "react-router-dom";
import { fetch, ResponseType } from "@tauri-apps/api/http";
import { Defaults } from "./defaults";
import { motion, AnimatePresence } from "framer-motion";
import { appWindow } from "@tauri-apps/api/window";
import { listen } from "@tauri-apps/api/event";
import {
  Home,
  Grid,
  Settings,
  LogOut,
  Play,
  Plus,
  Trash2,
  Trophy,
  ShoppingCart,
  Minus,
  X,
  Download,
  ShieldAlert,
  Ban,
  Coins,
  Users,
  Search,
} from "lucide-react";
import "./App.css";
import WelcomeGreeting from "./WelcomeGreeting";
import EquippedLoadout from "./EquippedLoadout";

interface UserData {
  email: string;
  password?: string;
  username?: string;
  discordId?: string;
  avatarHash?: string | null;
  vbucks?: number;
}

interface ArenaLeaderboardEntry {
  username: string;
  hype: number;
  division: number;
  discordId?: string;
  avatarHash?: string;
}

interface CosmeticInfo {
  id: string;
  name: string;
  description: string;
  image: string;
  rarity: string;
}

/* -------------------- Helpers -------------------- */
function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null as any, bytes.subarray(i, i + chunk) as any);
  }
  return btoa(binary);
}
function getFolderName(p: string) {
  const parts = p.split(/\\|\//).filter(Boolean);
  return parts[parts.length - 1] || p;
}

/* -------------------- Types -------------------- */
type TabKey = "home" | "library" | "news" | "shop" | "settings" | "leaderboard" | "admin";
// coverDataUrl is intentionally NOT stored in localStorage to avoid quota issues —
// we reload it from disk on each app start using rehydrateCover().
type BuildItem = { id: string; path: string; name: string; coverDataUrl?: string };
type NewsItem  = { id: string; title: string; date: string; desc: string; img?: string };

/* -------------------- Component -------------------- */
export default function Onboard() {
  const navigate  = useNavigate();
  const [active, setActive]           = useState<TabKey>("home");
  const [path,   setPath]             = useState<string | null>(null);
  const [isLaunching, setIsLaunching] = useState(false);
  const launchPending = useRef(false);
  const [user,   setUser]             = useState<UserData | null>(null);
  const [builds, setBuilds]           = useState<BuildItem[]>([]);
  const [error,  setError]            = useState<string | null>(null);

  const [eor, setEor] = useState(() => localStorage.getItem("revive:eor") === "true");
  const [ror, setRor] = useState(() => localStorage.getItem("revive:ror") === "true");
  useEffect(() => { localStorage.setItem("revive:eor", String(eor)); }, [eor]);
  useEffect(() => { localStorage.setItem("revive:ror", String(ror)); }, [ror]);

  const [disablePreedits, setDisablePreedits] = useState(false);
  const [bubbleBuilds,    setBubbleBuilds]    = useState(false);
  const [mobileBuilds, setMobileBuilds] = useState(() => localStorage.getItem("revive:mobileBuilds") === "true");
  useEffect(() => { localStorage.setItem("revive:mobileBuilds", String(mobileBuilds)); }, [mobileBuilds]);

  const [isDownloading,  setIsDownloading]  = useState(false);
  const [progress,       setProgress]       = useState(0);
  const [currentStatus,  setCurrentStatus]  = useState("");
  const [warningMsg,     setWarningMsg]      = useState("");
  const [isAdmin,        setIsAdmin]         = useState(false);

  // ---- download events ----
  useEffect(() => {
    const u1 = listen("download-start",    ()  => { setIsDownloading(true);  setWarningMsg(""); });
    const u2 = listen<number>("download-progress", (e) => setProgress(e.payload));
    const u3 = listen<string>("update-status",     (e) => setCurrentStatus(e.payload));
    const u4 = listen<string>("download-warning",  (e) => setWarningMsg(e.payload));
    const u5 = listen("download-complete", ()  => { setIsDownloading(false); setWarningMsg(""); });
    return () => { [u1,u2,u3,u4,u5].forEach(p => p.then(f => f())); };
  }, []);

  // ---- check admin ----
  useEffect(() => {
    const checkAdmin = async () => {
      try {
        const savedUser = localStorage.getItem("user");
        if (!savedUser) return;
        const parsed = JSON.parse(savedUser);
        if (!parsed.discordId) return;
        const r = await fetch(`${Defaults.BACKEND_URL}/api/launcher/isadmin?discordId=${parsed.discordId}`, {
          method: "GET",
          responseType: ResponseType.JSON,
        });
        if (r.ok) setIsAdmin((r.data as any).isAdmin === true);
      } catch { /* ignore */ }
    };
    checkAdmin();
  }, []);

  /* ============================================================
     FIX #4 — Build persistence
     We store builds WITHOUT coverDataUrl in localStorage (avoids
     quota exceeded). On load we reload the cover art from disk.
  ============================================================ */
  const rehydrateCover = async (b: BuildItem): Promise<BuildItem> => {
    try {
      const splashPath = await join(b.path, "FortniteGame", "Content", "Splash", "Splash.bmp");
      const hasSplash  = await exists(splashPath);
      if (hasSplash) {
        const bytes = await readBinaryFile(splashPath);
        return { ...b, coverDataUrl: "data:image/bmp;base64," + bytesToBase64(bytes) };
      }
    } catch { /* ignore */ }
    return b;
  };

  // ---- lifecycle / persistence ----
  useEffect(() => {
    const savedUser   = localStorage.getItem("user");
    let savedPath     = localStorage.getItem("buildPath");
    let savedBuilds   = localStorage.getItem("SettingsMP.builds");

    if (savedUser) {
      try {
        const parsed = JSON.parse(savedUser);
        setUser(parsed);

        // Restaurar configurações salvas vinculadas ao email
        const savedKey = `saved:${parsed.email}`;
        const savedData = localStorage.getItem(savedKey);
        if (savedData) {
          const data = JSON.parse(savedData);
          // Restaurar só se não houver dados atuais
          if (!savedPath && data.buildPath)  { savedPath = data.buildPath; localStorage.setItem("buildPath", data.buildPath); }
          if (!savedBuilds && data.builds)   { savedBuilds = data.builds;  localStorage.setItem("SettingsMP.builds", data.builds); }
          if (data.eor !== null && data.eor !== undefined) localStorage.setItem("revive:eor", data.eor);
          if (data.ror !== null && data.ror !== undefined) localStorage.setItem("revive:ror", data.ror);
        }
      } catch { /* */ }
    }

    if (savedPath) setPath(savedPath);

    if (savedBuilds) {
      try {
        const parsed = JSON.parse(savedBuilds) as BuildItem[];
        Promise.all(parsed.map(rehydrateCover)).then(hydrated => {
          setBuilds(hydrated);
          if (!savedPath && hydrated.length > 0) setPath(hydrated[0].path);
        });
      } catch { /* */ }
    }
  }, []);

  // persist builds WITHOUT coverDataUrl (avoids localStorage quota issues)
  useEffect(() => {
    const slim = builds.map(({ coverDataUrl: _, ...rest }) => rest);
    localStorage.setItem("SettingsMP.builds", JSON.stringify(slim));
  }, [builds]);

  useEffect(() => {
    if (path) localStorage.setItem("buildPath", path);
    else      localStorage.removeItem("buildPath");
  }, [path]);

  // ---- launcher polling ----
  useEffect(() => {
    let cancelled = false;
    let t: number | null = null;
    const run = async () => {
      if (launchPending.current) return;
      try {
        const r = await invoke("is_fortnite_client_running");
        if (!cancelled && r === false) setIsLaunching(false);
      } catch { if (!cancelled) setIsLaunching(false); }
    };
    if (isLaunching) { run(); t = window.setInterval(run, 3000); }
    return () => { cancelled = true; if (t) window.clearInterval(t); };
  }, [isLaunching]);

  /* -------------------- actions -------------------- */
  const handleLaunch = async () => {
    if (launchPending.current || isLaunching) return;
    setIsLaunching(true);
    const launchPath = path || builds[0]?.path;
    if (!launchPath) {
      setError("Please first select a game folder in the Library.");
      setTimeout(() => setError(null), 5000);
      setIsLaunching(false);
      return;
    }
    if (!user) {
      setError("No login details found.");
      setTimeout(() => setError(null), 5000);
      setIsLaunching(false);
      return;
    }
    try {
      launchPending.current = true;
      await invoke("firstlaunch", {
        path: launchPath, email: user.email, password: user.password,
        eor, ror, disablePreedits, mobileBuilds,
      });
    } catch (err) {
      setError("Launch error: " + String(err));
      setIsLaunching(false);
    } finally {
      launchPending.current = false;
    }
  };

  const handleLogout = () => {
    // Salva builds e settings por email antes de limpar
    const currentUser = localStorage.getItem("user");
    const builds     = localStorage.getItem("SettingsMP.builds");
    const buildPath  = localStorage.getItem("buildPath");
    const eor        = localStorage.getItem("revive:eor");
    const ror        = localStorage.getItem("revive:ror");

    // Guarda com chave vinculada ao email do usuário
    if (currentUser) {
      try {
        const parsed = JSON.parse(currentUser);
        const key = `saved:${parsed.email}`;
        localStorage.setItem(key, JSON.stringify({ builds, buildPath, eor, ror }));
      } catch { /* ignore */ }
    }

    localStorage.removeItem("user");
    localStorage.removeItem("buildPath");
    setUser(null); setPath(null); setBuilds([]);
    navigate("/login");
  };

  /* Basic 9.10 build folder validation. */
  const addBuild = async () => {
    if (builds.length >= 1) {
      setError("A build is already set. Remove it first to change.");
      setTimeout(() => setError(null), 5000);
      return;
    }

    const selected = await open({
      directory: true,
      multiple: false,
      title: "Select Fortnite 9.10 Folder",
    });
    if (!selected || typeof selected !== "string") return;

    try {
      // --- basic structure check ---
      const hasEngine = await exists(await join(selected, "Engine"));
      if (!hasEngine) {
        setError("Invalid folder: must contain an 'Engine' subfolder.");
        setTimeout(() => setError(null), 5000);
        return;
      }

      // --- 9.10 build structure check ---
      // Check for the Fortnite Win64 binaries folder or the game config file.
      const binariesPath = await join(selected, "Engine", "Binaries", "Win64");
      const hasWin64Binaries = await exists(binariesPath);
      // Secondary signal: FortniteGame/Config/DefaultGame.ini.
      const defaultGameIni = await join(selected, "FortniteGame", "Config", "DefaultGame.ini");
      const hasDefaultGame = await exists(defaultGameIni);

      // Reject folders without either expected Fortnite build path.
      if (!hasWin64Binaries && !hasDefaultGame) {
        setError("This doesn't look like a valid Fortnite build folder.");
        setTimeout(() => setError(null), 5000);
        return;
      }

      // ---- cover art ----
      const splashPath = await join(selected, "FortniteGame", "Content", "Splash", "Splash.bmp");
      const hasSplash  = await exists(splashPath);
      let coverDataUrl: string | undefined;
      if (hasSplash) {
        const bytes = await readBinaryFile(splashPath);
        coverDataUrl = "data:image/bmp;base64," + bytesToBase64(bytes);
      }

      const item: BuildItem = {
        id:   String(Date.now()) + "-" + Math.random().toString(36).slice(2, 8),
        path: selected,
        name: getFolderName(selected),
        coverDataUrl,
      };
      setBuilds([item]);
      setPath(selected);
    } catch (e) {
      setError("Could not add build: " + String(e));
      setTimeout(() => setError(null), 5000);
      return;
    }

    // auto-sync paks
    const pakUrls = Defaults.PAKS_AND_SIGS_LINKS || "";
    if (pakUrls) {
      try { await invoke("download_paks_cmd", { gameRoot: selected, urls: pakUrls }); }
      catch (err) { console.error("Auto-sync failed:", err); }
    }
  };

  const removeBuild = (id: string) => {
    setBuilds(prev => {
      const next    = prev.filter(b => b.id !== id);
      const removed = prev.find(b => b.id === id);
      if (removed?.path === path) setPath(next[0]?.path ?? null);
      return next;
    });
  };

  /* ============================================================
     News data  (#3 — dates = "Not Released")
  ============================================================ */
  const [news] = useState<NewsItem[]>([
    { id: "n1", title: "Custom Skins Coming Soon", date: "Coming Soon", desc: "We are working on bringing fully custom skins to the server. Stay tuned for more details.", img: "https://i.ibb.co/k6QjhtMH/4717e40f-4e5e-4597-b409-dd1a70da58e4.png" },
    { id: "n2", title: "Season 9.10 Is Live",      date: "Happening Now", desc: "Season 9.10 is out and ready to play. Drop in, the island is waiting for you.", img: "https://i.ibb.co/hJz356Zy/1c1511e5-4ba5-4d2a-a667-3029c3f1b722.png" },
  ]);

  /* -------------------- Animations -------------------- */
  const TabTransition: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
      className="w-full"
    >
      {children}
    </motion.div>
  );

  /* -------------------- Leaderboard -------------------- */
  const LeaderboardPanel: React.FC = () => {
    const [entries, setEntries] = useState<ArenaLeaderboardEntry[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchLeaderboard = async () => {
      if (!Defaults.ENABLE_API) { setEntries([]); setLoading(false); return; }
      try {
        const r = await fetch(`${Defaults.BACKEND_URL}/api/launcher/leaderboard`, { method: "GET", responseType: ResponseType.JSON });
        if (r.ok) setEntries(r.data as ArenaLeaderboardEntry[]);
      } catch (err) { console.error(err); }
      finally { setLoading(false); }
    };

    useEffect(() => {
      fetchLeaderboard();
      const iv = setInterval(fetchLeaderboard, 600000);
      return () => clearInterval(iv);
    }, []);

    const getRankStyle = (i: number) => {
      if (i === 0) return { icon: "🥇", color: "text-yellow-400", bg: "bg-yellow-400/10", border: "border-yellow-400/20" };
      if (i === 1) return { icon: "🥈", color: "text-slate-300",  bg: "bg-slate-300/10",  border: "border-slate-300/20"  };
      if (i === 2) return { icon: "🥉", color: "text-orange-500", bg: "bg-orange-500/10", border: "border-orange-500/20" };
      return { icon: `#${i+1}`, color: "text-slate-500", bg: "bg-transparent", border: "border-transparent" };
    };

    return (
      <div className="max-w-5xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex items-center justify-between mb-6 px-1">
          <div>
            <div className="text-2xl font-black text-white uppercase tracking-tighter italic">Arena Leaderboard</div>
            <div className="text-[10px] text-slate-400/70 font-bold tracking-[0.2em] mt-0.5 uppercase" />
          </div>
        </div>
        <div className="rounded-2xl overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-black/40 text-slate-500 text-[10px] uppercase tracking-[0.2em] ">
                <th className="px-8 py-4 font-black">Rank</th>
                <th className="px-8 py-4 font-black">Player</th>
                <th className="px-8 py-4 font-black">Division</th>
                <th className="px-8 py-4 font-black text-right">Hype</th>
              </tr>
            </thead>
            <tbody className="">
              {loading ? (
                <tr><td colSpan={4} className="px-8 py-32 text-center">
                  <div className="w-6 h-6 border-2 border-slate-700 border-t-transparent rounded-full animate-spin mx-auto" />
                </td></tr>
              ) : entries.length === 0 ? (
                <tr><td colSpan={4} className="p-4">
                  <div className="py-24 border-2 border-dashed border-white/20 rounded-2xl bg-white/[0.03] flex flex-col items-center justify-center">
                    <div className="w-14 h-14 rounded-full bg-white/10 flex items-center justify-center mb-4 text-slate-300"><Trophy size={28} /></div>
                    <p className="text-slate-300 text-sm font-medium">Leaderboard Unavailable</p>
                    <p className="text-slate-500 text-xs mt-1">Arena rankings are currently offline.</p>
                  </div>
                </td></tr>
              ) : entries.map((player, index) => {
                const rank = getRankStyle(index);
                return (
                  <tr key={index} className="hover:bg-white/[0.015] transition-colors duration-200 group">
                    <td className="px-8 py-5">
                      <div className={`inline-flex items-center justify-center w-9 h-9 rounded-xl font-black text-xs ${rank.bg} ${rank.color} border ${rank.border}`}>{rank.icon}</div>
                    </td>
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-4">
                        <div className="w-9 h-9 rounded-xl overflow-hidden bg-[#181a1e] flex items-center justify-center shadow-lg">
                          {player.discordId && player.avatarHash
                            ? <img src={`https://cdn.discordapp.com/avatars/${player.discordId}/${player.avatarHash}.png?size=64`} alt={player.username} className="w-full h-full object-cover" onError={e => { e.currentTarget.style.display="none"; }} />
                            : <span className="text-xs font-black text-slate-400">{player.username[0]}</span>}
                        </div>
                        <span className="font-bold text-slate-200 group-hover:text-slate-400 transition-colors duration-200 tracking-tight">{player.username}</span>
                      </div>
                    </td>
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-black text-slate-400 tracking-tighter italic">DIV</span>
                        <span className="text-lg font-black text-white italic tracking-tighter leading-none">{player.division}</span>
                      </div>
                    </td>
                    <td className="px-8 py-5 text-right">
                      <span className="font-black text-slate-400 text-xl tracking-tighter tabular-nums drop-shadow-[0_0_10px_rgba(148,163,184,0.3)]">{player.hype.toLocaleString()}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  /* -------------------- Shop -------------------- */
  const ShopPanel: React.FC = () => {
    const [shopData,  setShopData]  = useState<{ featured: any[]; daily: any[] }>({ featured: [], daily: [] });
    const [cosmetics, setCosmetics] = useState<Record<string, CosmeticInfo>>({});
    const [loading,   setLoading]   = useState(true);

    useEffect(() => {
      const fetchShop = async () => {
        if (!Defaults.ENABLE_API) { setLoading(false); return; }
        try {
          const res = await fetch(`${Defaults.BACKEND_URL}/api/launcher/shop`, { method: "GET", responseType: ResponseType.JSON });
          if (!res.ok) throw new Error("shop");
          const data = res.data as any;
          setShopData(data);
          const all = [...data.featured, ...data.daily];
          const map: Record<string, CosmeticInfo> = {};
          await Promise.all(all.map(async item => {
            const rawId = item.itemGrants[0].split(":")[1];
            try {
              const r = await fetch(`https://fortnite-api.com/v2/cosmetics/br/${rawId}`, { method: "GET", responseType: ResponseType.JSON });
              const d = r.data as any;
              if (r.ok && d.status === 200) {
                map[rawId] = { id: d.data.id, name: d.data.name, description: d.data.description, image: d.data.images.icon || d.data.images.smallIcon, rarity: d.data.rarity.value };
              }
            } catch { /* */ }
          }));
          setCosmetics(map);
        } catch (err) { console.error(err); }
        finally { setLoading(false); }
      };
      fetchShop();
    }, []);

    const getRarityStyle = (rarity: string) => {
      switch (rarity?.toLowerCase()) {
        case "legendary": return { border: "border-orange-500/40", text: "text-orange-400", bg: "from-orange-500/20" };
        case "epic":      return { border: "border-purple-500/40", text: "text-purple-400", bg: "from-purple-500/20" };
        case "rare":      return { border: "border-red-600/40",      text: "text-red-400",      bg: "from-red-600/20"      };
        case "uncommon":  return { border: "border-green-500/40",  text: "text-green-400",  bg: "from-green-500/20"  };
        default:          return { border: "border-white/10",      text: "text-slate-400",  bg: "from-slate-500/10"  };
      }
    };

    if (loading) return (
      <div className="flex items-center justify-center py-40 w-full">
        <div className="w-8 h-8 border-2 border-white/5 border-t-slate-700 rounded-full animate-spin" />
      </div>
    );

    const isEmpty = shopData.featured.length === 0 && shopData.daily.length === 0;

    const RenderSection = (title: string, items: any[]) => (
      <div className="mb-12">
        <div className="flex items-center gap-6 mb-6 px-1">
          <h3 className="text-2xl font-black text-white uppercase tracking-tighter italic">{title}</h3>
          <div className="h-[1px] flex-1 bg-gradient-to-r from-white/10 to-transparent" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5">
          {items.map(entry => {
            const rawId = entry.itemGrants[0].split(":")[1];
            const info  = cosmetics[rawId];
            const style = getRarityStyle(info?.rarity);
            return (
              <div key={entry.id} className={`group relative rounded-2xl overflow-hidden bg-[#121316] border transition-all duration-300 transform-gpu ${style.border}`}>
                <div className="aspect-square overflow-hidden relative bg-[#181a1e]">
                  <div className={`absolute inset-0 bg-gradient-to-t ${style.bg} to-transparent opacity-30 z-10 group-hover:opacity-50 transition-opacity duration-500`} />
                  {info?.image
                    ? <img src={info.image} onLoad={e => e.currentTarget.classList.remove("opacity-0")} className="w-full h-full object-cover relative z-0 transition-transform duration-700 ease-out group-hover:scale-110 opacity-0" />
                    : <div className="w-full h-full bg-[#181a1e]" />}
                  <div className="absolute top-3 right-3 z-30 px-2 py-1.5 rounded-lg bg-black/60 flex items-center gap-2 shadow-xl transition-transform duration-300 group-hover:scale-105">
                    <img src="https://i.imgur.com/pfmvUEu.png" className="w-3.5 h-3.5" alt="V" />
                    <span className="text-[11px] font-black text-white tracking-tighter uppercase italic">{entry.price}</span>
                  </div>
                </div>
                <div className="p-3 bg-black/20">
                  <div className={`text-[8px] font-black uppercase tracking-widest mb-0.5 ${style.text}`}>{info?.rarity || "Loading..."}</div>
                  <div className="font-bold text-white text-[11px] truncate uppercase">{info?.name || "..."}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );

    return (
      <div className="w-full h-full relative">
        {!isEmpty ? (
          <div className="px-1 pb-10">
            {shopData.featured.length > 0 && RenderSection("Featured", shopData.featured)}
            {shopData.daily.length    > 0 && RenderSection("Daily",    shopData.daily)}
          </div>
        ) : (
          <div className="w-full flex justify-center items-start pt-10">
            <div className="w-full max-w-2xl px-4">
              <div className="py-24 border-2 border-dashed border-white/20 rounded-2xl bg-white/[0.03] flex flex-col items-center justify-center">
                <div className="w-14 h-14 rounded-full bg-white/10 flex items-center justify-center mb-4 text-slate-300"><ShoppingCart size={28} /></div>
                <p className="text-slate-300 text-sm font-medium">Shop Unavailable</p>
                <p className="text-slate-500 text-xs mt-1">Connection to the item store was lost.</p>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  /* -------------------- Title Bar -------------------- */
  const CustomTitleBar = () => (
    <div data-tauri-drag-region className="h-8 w-full flex justify-between items-center fixed top-0 left-0 z-[999] select-none rounded-t-2xl">
      <div className="pl-4 flex items-center gap-2 pointer-events-none" />
      <div className="flex h-full">
        <button onClick={() => appWindow.minimize()} className="px-4 h-full hover:bg-white/10 text-slate-400 transition-colors duration-200 cursor-pointer"><Minus size={14} /></button>
        <button onClick={() => appWindow.close()}    className="px-4 h-full hover:bg-slate-700/80 text-slate-400 hover:text-white transition-colors duration-200 cursor-pointer rounded-tr-2xl"><X size={14} /></button>
      </div>
    </div>
  );

  /* -------------------- Left Nav -------------------- */
  interface LeftNavProps { active: TabKey; setActive: (v: TabKey) => void; user: UserData | null; handleLogout: () => void; }

  const LeftNav: React.FC<LeftNavProps> = ({ active, setActive, user, handleLogout }) => {
    const [backendOnline, setBackendOnline] = useState<boolean | null>(null);

    useEffect(() => {
      const check = async () => {
        try {
          const r = await fetch(`${Defaults.BACKEND_URL}/api/launcher/status`, {
            method: "GET",
            responseType: ResponseType.Text,
          });
          setBackendOnline(r.ok);
        } catch {
          setBackendOnline(false);
        }
      };
      check();
      const iv = setInterval(check, 30000);
      return () => clearInterval(iv);
    }, []);

    return (
      <div className="w-72 flex flex-col pt-8 relative z-20">
        {/* Logo */}
        <div className="px-6 pb-6 flex items-center gap-4">
          <div className="w-16 h-16 shrink-0">
            <img src={Defaults.LOGO_URL} alt="Logo" className="w-full h-full object-contain" />
          </div>
          <div>
            <div className="text-sm font-bold text-white tracking-wide">{Defaults.LAUNCHER_NAME}</div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                backendOnline === null ? "bg-slate-500 animate-pulse" :
                backendOnline          ? "bg-green-500 shadow-[0_0_5px_rgba(34,197,94,0.9)]" :
                                         "bg-slate-500 shadow-[0_0_5px_rgba(203,213,225,0.65)]"
              }`} />
              <span className={`text-[10px] font-bold tracking-widest uppercase ${
                backendOnline === null ? "text-slate-500" :
                backendOnline          ? "text-green-400" :
                                         "text-slate-400"
              }`}>
                {backendOnline === null ? "Checking..." : backendOnline ? "Online" : "Offline"}
              </span>
            </div>
          </div>
        </div>

        {/* Nav items */}
        <nav className="px-3 space-y-0.5 flex-1">
          <NavItem icon={<Home size={17}/>}         label="Home"        id="home"        active={active} setActive={setActive} />
          <NavItem icon={<Grid size={17}/>}         label="Library"     id="library"     active={active} setActive={setActive} />
          <NavItem icon={<ShoppingCart size={17}/>} label="Shop"        id="shop"        active={active} setActive={setActive} />
          <NavItem icon={<Trophy size={17}/>}       label="Leaderboard" id="leaderboard" active={active} setActive={setActive} />
          <NavItem icon={<Settings size={17}/>}     label="Settings"    id="settings"    active={active} setActive={setActive} />
          {isAdmin && (
            <NavItem icon={<ShieldAlert size={17}/>} label="Admin" id="admin" active={active} setActive={setActive} isAdminTab />
          )}
        </nav>

        {/* Bottom: profile + discord */}
        <div className="px-4 pb-4 pt-4 space-y-1">
          {/* Profile row */}
          <div className="flex items-center gap-3 px-2 py-2">
            <div className="w-9 h-9 rounded-full overflow-hidden shrink-0 shadow-[0_0_10px_rgba(148,163,184,0.2)]">
              <img
                src={user?.discordId && user?.avatarHash
                  ? `https://cdn.discordapp.com/avatars/${user.discordId}/${user.avatarHash}.png?size=64`
                  : `https://ui-avatars.com/api/?name=${user?.username || "G"}&background=991b1b&color=fff`}
                className="w-full h-full object-cover" alt="avatar"
              />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs text-white font-bold truncate">{user?.username ?? user?.email ?? "Guest"}</div>
              {user?.vbucks != null && (
                <div className="flex items-center gap-1 mt-0.5">
                  <img src="https://i.imgur.com/pfmvUEu.png" className="w-3 h-3" alt="V-Bucks" />
                  <span className="text-[10px] font-black text-slate-300/80 tabular-nums">{user.vbucks.toLocaleString()}</span>
                </div>
              )}
            </div>
            <button onClick={handleLogout} className="cursor-pointer p-1.5 text-slate-600 hover:text-slate-400 transition-colors duration-200 shrink-0">
              <LogOut size={15} />
            </button>
          </div>

          {/* Discord button */}
          <button
            onClick={() => import("@tauri-apps/api/shell").then(m => m.open(Defaults.DISCORD_LINK))}
            className="cursor-pointer w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl transition-all duration-200 group hover:bg-indigo-500/10"
          >
            <svg className="w-4 h-4 text-indigo-400/60 group-hover:text-indigo-400 transition-colors duration-200 shrink-0" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/>
            </svg>
            <span className="text-[11px] font-bold text-slate-500 group-hover:text-indigo-300 transition-colors duration-200">Join our Discord</span>
          </button>
        </div>
      </div>
    );
  };

  const NavItem = ({ icon, label, id, active, setActive, isAdminTab }: any) => {
    const isActive = active === id;
    return (
      <button onClick={() => setActive(id)} className={`cursor-pointer relative w-full flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-200 group z-10 ${isActive ? "text-white" : "text-slate-500 hover:text-slate-300"}`}>
        {isActive && (
          <motion.div
            layoutId="activeTab"
            className="absolute inset-0 rounded-xl -z-10"
            style={{ background: isAdminTab ? "linear-gradient(to right, rgba(203,213,225,0.30), rgba(148,163,184,0.12))" : "linear-gradient(to right, rgba(148,163,184,0.25), rgba(71,85,105,0.10))" }}
            initial={false}
            transition={{ type: "spring", stiffness: 320, damping: 32 }}
          />
        )}
        <span className={`transition-colors duration-200 ${isActive ? (isAdminTab ? "text-slate-400" : "text-slate-400") : "text-slate-600 group-hover:text-slate-300"}`}>{icon}</span>
        <span className="text-[13px] font-semibold tracking-wide">{label}</span>
        {isAdminTab && !isActive && (
          <span className="ml-auto text-[9px] font-black uppercase tracking-widest text-slate-600/60 bg-slate-900/20 px-1.5 py-0.5 rounded-md">ADMIN</span>
        )}
      </button>
    );
  };

  /* -------------------- Top Bar -------------------- */
  interface TopBarProps { user: UserData | null; }

  const TopBar: React.FC<TopBarProps> = ({ user }) => (
    <div className="flex items-center justify-between px-6 py-3 bg-transparent">
      {/* Left — greeting */}
      <WelcomeGreeting username={user?.username ?? "Guest"} />
      {/* Right — vbucks + version */}
      <div className="flex items-center gap-4">
        {user?.vbucks != null && (
          <div className="flex items-center gap-1.5">
            <img src="https://i.imgur.com/pfmvUEu.png" className="w-3.5 h-3.5" alt="V-Bucks" />
            <span className="text-xs font-black text-slate-300 tabular-nums tracking-tight">{user.vbucks.toLocaleString()}</span>
          </div>
        )}
        <span className="text-[10px] text-slate-600 font-bold uppercase tracking-widest">v{Defaults.LAUNCHER_VERSION}</span>
      </div>
    </div>
  );

  /* -------------------- Hero Banner -------------------- */
  const HeroBanner: React.FC = () => {
    const current     = builds.find(b => b.path === path) ?? builds[0];
    const bannerImage = current?.coverDataUrl || Defaults.PLACEHOLDER_IMAGE;

    return (
      <div className="mb-6 animate-in fade-in duration-700">
        <div className="relative rounded-2xl overflow-hidden">
          {/* Banner image */}
          <div className="relative h-64">
            <img key={bannerImage} src={bannerImage} className="w-full h-full object-cover brightness-50" />
            <div className="absolute inset-0" style={{ background: "linear-gradient(to top, #08090b 0%, rgba(10,10,12,0.5) 50%, transparent 100%)" }} />
            <div className="absolute inset-0" style={{ background: "linear-gradient(to right, rgba(15,2,2,0.7) 0%, transparent 60%)" }} />
          </div>

          <div className="absolute inset-0 p-8 flex items-end gap-6">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <div className="h-1 w-6 bg-gradient-to-r from-slate-500 to-slate-700 rounded-full" />
                <span className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em]">{current ? "Active Build" : "Featured Content"}</span>
              </div>
              <h2 className="text-3xl font-black text-white uppercase italic tracking-tighter drop-shadow-lg">
                {`${current?.name ?? "Ready to Play"} ${Defaults.LAUNCHER_NAME}`}
              </h2>
              <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest mt-1 opacity-80">
                {current ? `PATH: ${current.path}` : "No build selected — add one in Library"}
              </p>
              <div className="mt-6 flex items-center gap-3">
                <motion.button
                  onClick={handleLaunch}
                  whileTap={{ scale: 0.97 }}
                  disabled={isLaunching || !current || !user}
                  className="cursor-pointer px-8 py-3 rounded-xl bg-gradient-to-r from-slate-700 to-slate-600 hover:from-slate-600 hover:to-slate-500 text-white font-black uppercase italic tracking-tighter shadow-[0_0_20px_rgba(148,163,184,0.2)] hover:shadow-[0_0_30px_rgba(203,213,225,0.3)] transition-all duration-200 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Play size={18} fill="currentColor" />
                  {isLaunching ? "Launching..." : "PLAY"}
                </motion.button>
                <button
                  onClick={() => setActive("library")}
                  className="cursor-pointer px-6 py-3 rounded-xl bg-white/[0.06] text-slate-200 font-black uppercase italic tracking-tighter hover:bg-white/[0.10] transition-all duration-200"
                >
                  Library
                </button>
              </div>
            </div>

            <EquippedLoadout email={user?.email} password={user?.password} />
          </div>
        </div>

        {/* NEWS ROW */}
        <div className="mt-4 flex gap-4 overflow-x-auto pb-4 no-scrollbar">
          {news.map(n => (
            <motion.div
              key={n.id} whileHover={{ y: -5 }} transition={{ duration: 0.25, ease: "easeOut" }}
              className="min-w-[280px] rounded-2xl overflow-hidden group cursor-pointer relative"
            >
              <div className="relative h-24 w-full overflow-hidden">
                <img src={n.img} alt={n.title} className="w-full h-full object-cover object-center scale-[1.0]" />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
              </div>
              <div className="px-4 pb-4 pt-3 relative z-10 bg-gradient-to-b from-[#101114] to-[#08090b]">
                <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md mb-2 ${n.date === "Happening Now" ? "bg-green-900/30" : "bg-slate-900/30"}`}>
                  <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${n.date === "Happening Now" ? "bg-green-400" : "bg-slate-500"}`} />
                  <span className={`text-[9px] font-black uppercase tracking-widest ${n.date === "Happening Now" ? "text-green-400" : "text-slate-400"}`}>{n.date}</span>
                </div>
                <div className="text-sm text-white font-black uppercase italic tracking-tight group-hover:text-slate-400 transition-colors duration-200">{n.title}</div>
                <div className="text-[11px] text-slate-400 mt-1 line-clamp-2 leading-snug">{n.desc}</div>
              </div>
              <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-slate-700 to-slate-500 origin-center scale-x-0 transition-transform duration-300 ease-out group-hover:scale-x-100 z-20" />
            </motion.div>
          ))}
        </div>
      </div>
    );
  };

  /* ============================================================
     Library Panel
     FIX #4 — cover persists (rehydrated on mount)
     FIX #5 — 9.10 build structure check in addBuild()
     FIX #6 — "Download 9.10" button when no build set
  ============================================================ */
  const BUILD_DOWNLOAD_URL = "https://builds.rebootfn.org/9.10.rar";

  const LibraryPanel: React.FC = () => (
    <div className="animate-in fade-in duration-500">
      <div className="flex items-center justify-between mb-6 px-1">
        <div>
          <div className="text-2xl font-black text-white uppercase tracking-tighter italic">Library</div>
          <div className="text-[10px] text-slate-400 font-bold tracking-[0.15em] mt-1 uppercase opacity-70">Fortnite 9.10 Build</div>
        </div>
        {builds.length > 0 && (
          <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest opacity-70 italic">Remove to change path</div>
        )}
      </div>

      {builds.length === 0 ? (
        /* ---- Empty state: two actions ---- */
        <div className="flex flex-col gap-4">
          {/* Option A — already have the build */}
          <motion.div
            whileHover={{ scale: 1.01 }}
            onClick={addBuild}
            className="flex items-center gap-6 p-6 rounded-2xl bg-gradient-to-r from-slate-950/30 to-transparent hover:from-slate-900/40 cursor-pointer transition-all duration-200 group"
          >
            <div className="w-14 h-14 rounded-2xl bg-slate-900/20 flex items-center justify-center text-slate-400 shrink-0 transition-all duration-200">
              <Plus size={26} />
            </div>
            <div>
              <div className="text-white font-black uppercase italic tracking-tighter text-base group-hover:text-slate-400 transition-colors duration-200">
                I already have Fortnite 9.10
              </div>
              <div className="text-slate-500 text-xs mt-1 uppercase tracking-widest font-bold">
                Select the folder on your computer
              </div>
            </div>
          </motion.div>

          {/* Option B — download the build */}
          <motion.div
            whileHover={{ scale: 1.01 }}
            onClick={() => { import("@tauri-apps/api/shell").then(m => m.open(BUILD_DOWNLOAD_URL)); }}
            className="flex items-center gap-6 p-6 rounded-2xl bg-gradient-to-r from-white/[0.03] to-transparent hover:from-slate-950/30 cursor-pointer transition-all duration-200 group"
          >
            <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center text-slate-400 shrink-0 group-hover:text-slate-400 group-hover:bg-slate-900/10 transition-all duration-200">
              <Download size={26} />
            </div>
            <div>
              <div className="text-white font-black uppercase italic tracking-tighter text-base group-hover:text-slate-400 transition-colors duration-200">
                Download Fortnite 9.10
              </div>
              <div className="text-slate-500 text-xs mt-1 uppercase tracking-widest font-bold">
                Get the build directly — opens download page
              </div>
            </div>
          </motion.div>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-5">
          {builds.map(b => {
            const selected = b.path === path;
            return (
              <div
                key={b.id}
                className={`group relative rounded-2xl overflow-hidden bg-transparent transition-all duration-300 ease-out transform-gpu hover:-translate-y-1.5 ${
                  selected ? "shadow-[0_0_25px_rgba(148,163,184,0.2)]" : "shadow-xl shadow-black/40"
                }`}
              >
                <div className="h-44 bg-[#181a1e] relative overflow-hidden">
                  {b.coverDataUrl
                    ? <img src={b.coverDataUrl} alt={b.name} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                    : <div className="w-full h-full flex items-center justify-center text-[10px] font-black text-slate-700 uppercase tracking-tighter">No Cover</div>}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                </div>
                <div className="p-4 bg-gradient-to-b from-transparent to-black/30">
                  <div className="text-sm font-bold text-white truncate group-hover:text-slate-400 transition-colors duration-200">{b.name}</div>
                  <div className="text-[10px] text-slate-500 font-bold mt-1 truncate uppercase tracking-widest opacity-80">{getFolderName(b.path)}</div>
                  <div className="mt-4 flex items-center justify-end">
                    <button onClick={() => removeBuild(b.id)} className="cursor-pointer p-1.5 rounded-xl text-slate-600 hover:text-slate-500 hover:bg-slate-500/10 transition-all duration-200">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  /* -------------------- News Panel -------------------- */
  const NewsPanel: React.FC = () => (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-xl font-semibold">News</div>
          <div className="text-xs text-slate-400">Patch notes & announcements</div>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {news.map(n => (
          <div key={n.id} className="rounded-2xl overflow-hidden bg-transparent">
            <div className="h-44 overflow-hidden"><img src={n.img} alt={n.title} className="w-full h-full object-cover" /></div>
            <div className="p-4">
              <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-slate-900/30 mb-2">
                <div className="w-1.5 h-1.5 rounded-full bg-slate-500 animate-pulse" />
                <span className="text-[9px] text-slate-400 font-black uppercase tracking-widest">{n.date}</span>
              </div>
              <div className="text-lg text-white font-semibold mt-1">{n.title}</div>
              <div className="text-sm text-slate-300 mt-2">{n.desc}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  /* -------------------- Settings Panel -------------------- */
  const SettingsPanel: React.FC<{
    eor: boolean; setEor: (v: boolean) => void;
    ror: boolean; setRor: (v: boolean) => void;
    disablePreedits: boolean; setDisablePreedits: (v: boolean) => void;
    bubbleBuilds: boolean; setBubbleBuilds: (v: boolean) => void;
    mobileBuilds: boolean; setMobileBuilds: (v: boolean) => void;
  }> = ({ eor, setEor, ror, setRor, bubbleBuilds, setBubbleBuilds, mobileBuilds, setMobileBuilds, disablePreedits, setDisablePreedits }) => (
    <div className="max-w-5xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between mb-8 px-1">
        <div>
          <div className="text-2xl font-black text-white uppercase tracking-tighter italic">Preferences</div>
          <div className="text-[10px] text-slate-400/80 font-bold tracking-[0.2em] mt-0.5 uppercase">Game Settings</div>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
        <div className="p-10 rounded-2xl bg-transparent flex flex-col justify-between">
          {[
            { label: "Edit on Release",  desc: "Confirm on release · applies next launch", val: eor,           set: setEor           },
            { label: "Reset on Release", desc: "Confirm reset · applies next launch",       val: ror,           set: setRor           },
            { label: "Disable Pre-edits",desc: "Removes Pre-edit delay",                     val: disablePreedits,set: setDisablePreedits},
          ].map((item, i, arr) => (
            <React.Fragment key={item.label}>
              <div className="flex items-center justify-between group">
                <div>
                  <p className="text-sm font-black text-slate-200 group-hover:text-white transition-colors duration-200 uppercase italic tracking-tighter">{item.label}</p>
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">{item.desc}</p>
                </div>
                <button type="button" onClick={() => item.set(!item.val)}
                  className={`cursor-pointer relative inline-flex h-7 w-12 items-center rounded-full transition-all duration-300 ${item.val ? "bg-gradient-to-r from-slate-700 to-slate-600 shadow-[0_0_18px_rgba(148,163,184,0.25)]" : "bg-white/10"}`}
                >
                  <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-lg transition-transform duration-300 ${item.val ? "translate-x-6" : "translate-x-1"}`} />
                </button>
              </div>
              {i < arr.length - 1 && <div className="h-px bg-white/[0.05]" />}
            </React.Fragment>
          ))}
          <div className="pt-6" />
        </div>

        <div className="flex flex-col gap-6">
          <div className="p-8 rounded-2xl bg-transparent">
            <div className="flex items-center gap-4 mb-10">
              <div className="w-12 h-12 rounded-2xl bg-slate-900/20 flex items-center justify-center text-slate-400"><Grid size={24} /></div>
              <div>
                <h4 className="text-sm font-black text-white uppercase tracking-tight italic">Performance</h4>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Visual</p>
              </div>
            </div>
            <div className="space-y-8">
              {[
                { label: "Bubble Builds", desc: "IN DEVELOPMENT Bubble Style", val: bubbleBuilds, set: setBubbleBuilds },
                { label: "Mobile Builds", desc: "Low meshes · applies next launch", val: mobileBuilds, set: setMobileBuilds },
              ].map((item, i, arr) => (
                <React.Fragment key={item.label}>
                  <div className="flex items-center justify-between group">
                    <div>
                      <p className="text-sm font-black text-slate-200 group-hover:text-white transition-colors duration-200 uppercase italic tracking-tighter">{item.label}</p>
                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">{item.desc}</p>
                    </div>
                    <button type="button" onClick={() => item.set(!item.val)}
                      className={`cursor-pointer relative inline-flex h-7 w-12 items-center rounded-full transition-all duration-300 ${item.val ? "bg-gradient-to-r from-slate-700 to-slate-600 shadow-[0_0_18px_rgba(148,163,184,0.25)]" : "bg-white/10"}`}
                    >
                      <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-lg transition-transform duration-300 ${item.val ? "translate-x-6" : "translate-x-1"}`} />
                    </button>
                  </div>
                  {i < arr.length - 1 && <div className="h-px bg-white/[0.05]" />}
                </React.Fragment>
              ))}
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-transparent flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-slate-900/20 flex items-center justify-center text-slate-400">
                <Play size={18} fill="currentColor" className="ml-0.5" />
              </div>
              <div>
                <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.2em]">Launcher Build</p>
                <p className="text-sm text-white font-black uppercase italic tracking-tighter">{Defaults.LAUNCHER_VERSION}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  /* -------------------- Admin Panel -------------------- */
  const AdminPanel: React.FC = () => {
    type AdminTab = "users" | "vbucks" | "cosmetics" | "hype" | "moderation";
    const [tab, setTab]            = useState<AdminTab>("users");
    const [users, setUsers]        = useState<any[]>([]);
    const [loading, setLoading]    = useState(false);
    const [search, setSearch]      = useState("");
    const [feedback, setFeedback]  = useState<{ msg: string; ok: boolean } | null>(null);
    const [targetUser,   setTargetUser]   = useState("");
    const [amount,       setAmount]       = useState("");
    const [cosmeticName, setCosmeticName] = useState("");
    const [vbucksMode,   setVbucksMode]   = useState<"add"|"remove">("add");
    const [hypeMode,     setHypeMode]     = useState<"add"|"remove">("add");
    const [cosMode,      setCosMode]      = useState<"add"|"remove"|"addall"|"removeall">("add");
    const [modMode,      setModMode]      = useState<"ban"|"unban"|"kick"|"delete">("ban");
    const discordId = user?.discordId ?? "";

    const showFeedback = (msg: string, ok: boolean) => {
      setFeedback({ msg, ok });
      setTimeout(() => setFeedback(null), 4000);
    };

    const loadUsers = async () => {
      setLoading(true);
      try {
        const r = await fetch(`${Defaults.BACKEND_URL}/api/launcher/admin/users?discordId=${discordId}`, {
          method: "GET", responseType: ResponseType.JSON,
        });
        if (r.ok) setUsers(r.data as any[]);
      } catch { /* */ } finally { setLoading(false); }
    };
    useEffect(() => { loadUsers(); }, []);

    const adminPost = async (endpoint: string, body: object) => {
      try {
        const r = await fetch(`${Defaults.BACKEND_URL}${endpoint}`, {
          method: "POST", responseType: ResponseType.JSON,
          headers: { "Content-Type": "application/json" },
          body: { type: "Json", payload: { discordId, ...body } },
        });
        const d = r.data as any;
        showFeedback(d.message || d.error || (r.ok ? "Done." : "Error."), r.ok);
        if (r.ok) loadUsers();
      } catch { showFeedback("Connection error.", false); }
    };

    const filtered = users.filter(u =>
      u.username?.toLowerCase().includes(search.toLowerCase()) ||
      u.email?.toLowerCase().includes(search.toLowerCase())
    );

    const TabBtn = ({ id, label, icon }: { id: AdminTab; label: string; icon: React.ReactNode }) => (
      <button onClick={() => setTab(id)}
        className={`cursor-pointer flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all duration-200 ${tab === id ? "bg-slate-900/30 text-slate-400" : "text-slate-500 hover:text-slate-300"}`}>
        {icon} {label}
      </button>
    );

    const InputField = ({ label, value, onChange, placeholder, type = "text" }: any) => (
      <div>
        <label className="text-[10px] text-slate-500 font-black uppercase tracking-widest">{label}</label>
        <input type={type} value={value} onChange={(e: any) => onChange(e.target.value)} placeholder={placeholder}
          className="mt-1.5 w-full bg-white/[0.03] text-white text-sm rounded-xl px-4 py-2.5 outline-none focus:ring-1 focus:ring-slate-700/40 transition-all placeholder:text-slate-600" />
      </div>
    );

    const ModeBtn = ({ value, current, set, label, isGreen }: any) => (
      <button onClick={() => set(value)}
        className={`cursor-pointer flex-1 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
          current === value
            ? isGreen ? "bg-green-900/30 text-green-400" : "bg-slate-900/30 text-slate-400"
            : "bg-white/[0.03] text-slate-500 hover:text-slate-300"
        }`}>
        {label}
      </button>
    );

    const ExecBtn = ({ onClick, label }: any) => (
      <button onClick={onClick}
        className="cursor-pointer w-full py-3 rounded-xl bg-gradient-to-r from-slate-800 to-slate-600 hover:from-slate-700 hover:to-slate-500 text-white font-black uppercase tracking-widest text-sm transition-all">
        {label}
      </button>
    );

    return (
      <div className="max-w-5xl mx-auto animate-in fade-in duration-500">
        <div className="flex items-center gap-3 mb-5 px-1">
          <ShieldAlert size={20} className="text-slate-500" />
          <div>
            <div className="text-2xl font-black text-white uppercase tracking-tighter italic">Admin Panel</div>
            <div className="text-[10px] text-slate-400/70 font-bold tracking-[0.2em] uppercase">Server Management</div>
          </div>
        </div>

        <AnimatePresence>
          {feedback && (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
              className={`mb-4 px-4 py-2.5 rounded-xl text-sm font-medium ${feedback.ok ? "bg-green-900/30 text-green-400" : "bg-red-900/30 text-red-400"}`}>
              {feedback.msg}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex flex-wrap items-center gap-1.5 mb-6 p-1.5 rounded-2xl bg-white/[0.02]">
          <TabBtn id="users"      label="Users"      icon={<Users size={13}/>} />
          <TabBtn id="vbucks"     label="V-Bucks"    icon={<Coins size={13}/>} />
          <TabBtn id="cosmetics"  label="Cosmetics"  icon={<Grid  size={13}/>} />
          <TabBtn id="hype"       label="Hype"       icon={<Trophy size={13}/>} />
          <TabBtn id="moderation" label="Moderation" icon={<Ban   size={13}/>} />
        </div>

        {/* Users */}
        {tab === "users" && (
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="flex-1 relative">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" />
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search username or email..."
                  className="w-full bg-white/[0.03] text-white text-sm rounded-xl pl-9 pr-4 py-2.5 outline-none focus:ring-1 focus:ring-slate-700/40 transition-all placeholder:text-slate-600" />
              </div>
              <button onClick={loadUsers} className="cursor-pointer px-4 py-2.5 rounded-xl bg-slate-900/20 hover:bg-slate-900/30 text-slate-400 text-xs font-bold uppercase tracking-widest transition-all">Refresh</button>
            </div>
            {loading ? (
              <div className="flex justify-center py-16"><div className="w-6 h-6 border-2 border-slate-700 border-t-transparent rounded-full animate-spin" /></div>
            ) : (
              <div className="rounded-2xl overflow-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-black/30 text-slate-500 text-[10px] uppercase tracking-[0.18em]">
                      <th className="px-4 py-3 font-black">Username</th>
                      <th className="px-4 py-3 font-black">Email</th>
                      <th className="px-4 py-3 font-black">Status</th>
                      <th className="px-4 py-3 font-black">Quick Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.length === 0 ? (
                      <tr><td colSpan={4} className="px-4 py-10 text-center text-slate-500 text-sm">No users found.</td></tr>
                    ) : filtered.map((u, i) => (
                      <tr key={i} className="hover:bg-white/[0.015] transition-colors border-t border-white/[0.03]">
                        <td className="px-4 py-3 text-white font-bold text-sm">{u.username}</td>
                        <td className="px-4 py-3 text-slate-400 text-xs">{u.email}</td>
                        <td className="px-4 py-3">
                          <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-lg ${u.banned ? "bg-red-900/30 text-red-400" : "bg-green-900/20 text-green-400"}`}>
                            {u.banned ? "Banned" : "Active"}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1.5 flex-wrap">
                            {u.banned
                              ? <button onClick={() => adminPost("/api/launcher/admin/unban",     { username: u.username })} className="cursor-pointer text-[10px] font-black uppercase px-2 py-1 rounded-lg bg-green-900/20 text-green-400 hover:bg-green-900/30 transition-all">Unban</button>
                              : <button onClick={() => adminPost("/api/launcher/admin/ban",       { username: u.username })} className="cursor-pointer text-[10px] font-black uppercase px-2 py-1 rounded-lg bg-slate-900/20 text-slate-400 hover:bg-slate-900/30 transition-all">Ban</button>
                            }
                            <button onClick={() => adminPost("/api/launcher/admin/kick",          { username: u.username })} className="cursor-pointer text-[10px] font-black uppercase px-2 py-1 rounded-lg bg-orange-900/20 text-orange-400 hover:bg-orange-900/30 transition-all">Kick</button>
                            <button onClick={() => adminPost("/api/launcher/admin/addall",        { username: u.username })} className="cursor-pointer text-[10px] font-black uppercase px-2 py-1 rounded-lg bg-purple-900/20 text-purple-400 hover:bg-purple-900/30 transition-all">Full Locker</button>
                            <button onClick={() => adminPost("/api/launcher/admin/deleteaccount", { username: u.username })} className="cursor-pointer text-[10px] font-black uppercase px-2 py-1 rounded-lg bg-white/5 text-slate-500 hover:text-slate-400 hover:bg-slate-900/20 transition-all">Delete</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* V-Bucks */}
        {tab === "vbucks" && (
          <div className="max-w-md space-y-4">
            <InputField label="Target Username" value={targetUser} onChange={setTargetUser} placeholder="username" />
            <InputField label="Amount" value={amount} onChange={setAmount} placeholder="1000" type="number" />
            <div className="flex gap-2">
              <ModeBtn value="add"    current={vbucksMode} set={setVbucksMode} label="+ Add"    isGreen />
              <ModeBtn value="remove" current={vbucksMode} set={setVbucksMode} label="- Remove" />
            </div>
            <ExecBtn label="Apply V-Bucks" onClick={() => {
              if (!targetUser || !amount) return showFeedback("Fill in all fields.", false);
              adminPost(`/api/launcher/admin/${vbucksMode}vbucks`, { username: targetUser, amount });
            }} />
          </div>
        )}

        {/* Cosmetics */}
        {tab === "cosmetics" && (
          <div className="max-w-md space-y-4">
            <div className="flex flex-wrap gap-2">
              {(["add","remove","addall","removeall"] as const).map(m => (
                <button key={m} onClick={() => setCosMode(m)}
                  className={`cursor-pointer px-3 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${cosMode === m ? "bg-slate-900/30 text-slate-400" : "bg-white/[0.03] text-slate-500 hover:text-slate-300"}`}>
                  {m === "addall" ? "Add All" : m === "removeall" ? "Remove All" : m === "add" ? "+ Add Item" : "- Remove Item"}
                </button>
              ))}
            </div>
            <InputField label="Target Username" value={targetUser} onChange={setTargetUser} placeholder="username" />
            {(cosMode === "add" || cosMode === "remove") && (
              <InputField label="Cosmetic Name (exact)" value={cosmeticName} onChange={setCosmeticName} placeholder="Renegade Raider" />
            )}
            {(cosMode === "addall" || cosMode === "removeall") && (
              <p className="text-xs text-slate-500 italic">
                {cosMode === "addall" ? "Gives every cosmetic from allathena.json to this player." : "Resets this player locker to default."}
              </p>
            )}
            <ExecBtn label="Execute" onClick={() => {
              if (!targetUser) return showFeedback("Enter a username.", false);
              if ((cosMode === "add" || cosMode === "remove") && !cosmeticName) return showFeedback("Enter a cosmetic name.", false);
              const epMap: Record<string, string> = { add: "additem", remove: "removeitem", addall: "addall", removeall: "removeall" };
              const body: any = { username: targetUser };
              if (cosMode === "add" || cosMode === "remove") body.cosmeticName = cosmeticName;
              adminPost(`/api/launcher/admin/${epMap[cosMode]}`, body);
            }} />
          </div>
        )}

        {/* Hype */}
        {tab === "hype" && (
          <div className="max-w-md space-y-4">
            <InputField label="Target Username" value={targetUser} onChange={setTargetUser} placeholder="username" />
            <InputField label="Hype Points" value={amount} onChange={setAmount} placeholder="500" type="number" />
            <div className="flex gap-2">
              <ModeBtn value="add"    current={hypeMode} set={setHypeMode} label="+ Add"    isGreen />
              <ModeBtn value="remove" current={hypeMode} set={setHypeMode} label="- Remove" />
            </div>
            <ExecBtn label="Apply Hype" onClick={() => {
              if (!targetUser || !amount) return showFeedback("Fill in all fields.", false);
              adminPost(`/api/launcher/admin/${hypeMode === "add" ? "addhype" : "removehype"}`, { username: targetUser, amount });
            }} />
          </div>
        )}

        {/* Moderation */}
        {tab === "moderation" && (
          <div className="max-w-md space-y-4">
            <InputField label="Target Username" value={targetUser} onChange={setTargetUser} placeholder="username" />
            <div className="flex flex-wrap gap-2">
              {(["ban","unban","kick","delete"] as const).map(m => (
                <button key={m} onClick={() => setModMode(m)}
                  className={`cursor-pointer flex-1 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${modMode === m ? "bg-slate-900/30 text-slate-400" : "bg-white/[0.03] text-slate-500 hover:text-slate-300"}`}>
                  {m}
                </button>
              ))}
            </div>
            {modMode === "delete" && (
              <p className="text-xs text-slate-400/70 italic">Warning: permanently deletes the account and all associated data.</p>
            )}
            <ExecBtn label="Execute" onClick={() => {
              if (!targetUser) return showFeedback("Enter a username.", false);
              const ep = modMode === "delete" ? "deleteaccount" : modMode;
              adminPost(`/api/launcher/admin/${ep}`, { username: targetUser });
            }} />
          </div>
        )}
      </div>
    );
  };

  /* -------------------- Main Render -------------------- */
  return (
    <div
      className="w-screen h-screen flex text-slate-100 relative overflow-hidden rounded-2xl"
      style={{ backgroundImage: `url('${Defaults.BACKGROUND_URL}')`, backgroundSize: "cover", backgroundPosition: "center" }}
    >
      {/* FIX #1 — gradient overlay instead of flat color */}
      <div className="absolute inset-0 z-0" style={{ background: "radial-gradient(ellipse at 20% 50%, #202226 0%, #0a0b0d 40%, #000000 100%)" }}>
        <div className="absolute inset-0 backdrop-blur-2xl bg-black/60" />
        <div className="absolute -top-32 -left-32 w-[500px] h-[500px] bg-slate-900/20 blur-[150px] rounded-full pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-slate-950/15 blur-[130px] rounded-full translate-x-1/4 translate-y-1/4 pointer-events-none" />
      </div>

      <CustomTitleBar />

      <div className="relative z-10 flex w-full h-full pt-8">
        <LeftNav active={active} setActive={setActive} user={user} handleLogout={handleLogout} />

        <div className="flex-1 flex flex-col min-w-0">
          <TopBar user={user} />

          <AnimatePresence>
            {error && (
              <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }} className="absolute right-6 top-14 z-50">
                <div className="bg-slate-800/90 text-white px-4 py-2 rounded-xl shadow-lg text-sm font-medium">{error}</div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex-1 overflow-auto p-8 custom-scrollbar">
            <AnimatePresence mode="wait">
              {active === "home" && (
                <TabTransition key="home">
                  <HeroBanner />
                  <div className="flex flex-col lg:flex-row items-stretch gap-6 mt-4">
                    <div className="flex-[3] flex flex-col">
                      <div className="flex-1 p-6 rounded-2xl bg-transparent flex flex-col">
                        <div className="flex items-center justify-between mb-6">
                          <div>
                            <h3 className="text-xl font-black text-white uppercase italic tracking-tighter">Featured & Highlights</h3>
                            <p className="text-[10px] text-slate-400/70 font-bold uppercase tracking-[0.2em] mt-0.5">Your Optimized Collection</p>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 flex-1">
                          {builds.length === 0 ? (
                            <div className="h-24 col-span-full flex items-center justify-center rounded-xl border-2 border-dashed border-white/5 opacity-40">
                              <p className="text-xs font-black uppercase italic tracking-widest">Storage Empty</p>
                            </div>
                          ) : builds.slice(0, 4).map(b => (
                            <motion.div
                              key={b.id}
                              whileHover={{ y: -4, transition: { duration: 0.25, ease: "easeOut" } }}
                              className="group relative rounded-xl overflow-hidden bg-gradient-to-r from-[#181a1e]/40 to-[#090a0c]/40 flex h-24 transition-all duration-300 ease-out hover:from-slate-900/10 hover:to-transparent"
                            >
                              <div className="w-24 h-full overflow-hidden bg-black/40 shrink-0 relative">
                                {b.coverDataUrl
                                  ? <img src={b.coverDataUrl} alt={b.name} className="w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-105" />
                                  : <div className="w-full h-full grid place-items-center text-slate-700"><Grid size={16} /></div>}
                              </div>
                              <div className="p-3 flex-1 min-w-0 flex items-center justify-between relative z-10">
                                <div className="min-w-0 pr-2">
                                  <div className="font-black text-white uppercase italic tracking-tighter truncate text-sm group-hover:text-slate-400 transition-colors duration-200">{b.name}</div>
                                  <div className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mt-0.5 truncate">{getFolderName(b.path)}</div>
                                </div>
                                <button onClick={() => removeBuild(b.id)} className="cursor-pointer p-2.5 rounded-xl bg-white/5 text-slate-500 hover:text-slate-500 hover:bg-slate-500/20 transition-all duration-200 shrink-0" title="Remove Build">
                                  <Trash2 size={15} />
                                </button>
                              </div>
                              <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-gradient-to-b from-slate-500 to-slate-700 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
                            </motion.div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </TabTransition>
              )}
              {active === "library"     && <TabTransition key="library"><LibraryPanel /></TabTransition>}
              {active === "news"        && <TabTransition key="news"><NewsPanel /></TabTransition>}
              {active === "shop"        && <TabTransition key="shop"><ShopPanel /></TabTransition>}
              {active === "settings"    && (
                <TabTransition key="settings">
                  <SettingsPanel eor={eor} setEor={setEor} ror={ror} setRor={setRor} disablePreedits={disablePreedits} setDisablePreedits={setDisablePreedits} bubbleBuilds={bubbleBuilds} setBubbleBuilds={setBubbleBuilds} mobileBuilds={mobileBuilds} setMobileBuilds={setMobileBuilds} />
                </TabTransition>
              )}
              {active === "leaderboard" && <TabTransition key="leaderboard"><LeaderboardPanel /></TabTransition>}
              {active === "admin"       && isAdmin && <TabTransition key="admin"><AdminPanel /></TabTransition>}
            </AnimatePresence>

            {/* Download overlay */}
            <AnimatePresence>
              {isDownloading && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }} className="fixed inset-0 z-[999] flex items-center justify-center bg-black/80">
                  <motion.div
                    initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }}
                    transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                    className={`w-[400px] p-8 rounded-3xl bg-gradient-to-b from-[#1a1b1f] to-[#090a0c] shadow-2xl text-center transition-colors duration-300`}
                  >
                    {warningMsg
                      ? <div className="w-16 h-16 rounded-full bg-red-700/20 flex items-center justify-center mx-auto mb-6"><X className="w-8 h-8 text-red-400" /></div>
                      : <div className="w-16 h-16 border-4 border-slate-900/30 border-t-slate-600 rounded-full animate-spin mx-auto mb-6" />}
                    <h2 className="text-xl font-black uppercase italic tracking-tighter text-white mb-2">{warningMsg ? "Download Error" : "Syncing Build"}</h2>
                    <p className={`text-[10px] font-bold uppercase tracking-widest mb-6 ${warningMsg ? "text-red-400" : "text-slate-400"}`}>{warningMsg || currentStatus || "Verifying Files..."}</p>
                    <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden mb-2">
                      <motion.div
                        className={`h-full rounded-full shadow-[0_0_15px_rgba(148,163,184,0.3)] ${warningMsg ? "bg-slate-600" : "bg-gradient-to-r from-slate-700 to-slate-500"}`}
                        animate={{ width: `${progress}%` }}
                        transition={{ ease: "easeOut" }}
                      />
                    </div>
                    <p className="text-[10px] text-slate-500 font-bold">{progress}%</p>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}

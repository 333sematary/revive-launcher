import { useEffect, useState, type CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { fetch, ResponseType } from "@tauri-apps/api/http";
import { Defaults } from "./defaults";
import { Minus, X } from "lucide-react";
import { appWindow, LogicalSize } from "@tauri-apps/api/window";
import "./App.css";

const particles = Array.from({ length: 28 }, (_, index) => ({
  left: `${(index * 37 + 7) % 100}%`,
  size: 1.5 + (index % 3),
  duration: 12 + (index % 7) * 2,
  delay: -((index * 7) % 24),
  drift: `${((index * 19) % 90) - 45}px`,
}));

const IconEye = (props: any) => (
  <svg viewBox="0 0 24 24" width="20" height="20" {...props}>
    <path fill="currentColor" d="M12 5c-7 0-10 7-10 7s3 7 10 7 10-7 10-7-3-7-10-7zm0 11a4 4 0 1 1 0-8 4 4 0 0 1 0 8z" />
  </svg>
);

const IconEyeOff = (props: any) => (
  <svg viewBox="0 0 24 24" width="20" height="20" {...props}>
    <path fill="currentColor" d="M2 5.27 3.28 4 20 20.72 18.73 22l-3.2-3.2A11.58 11.58 0 0 1 12 19C5 19 2 12 2 12a18.85 18.85 0 0 1 4.1-5.57L2 5.27Zm8.83 3.54a4 4 0 0 1 4.36 4.36l-4.36-4.36ZM12 7c7 0 10 7 10 7a18.92 18.92 0 0 1-4.54 5.72l-1.42-1.42A11.83 11.83 0 0 0 20 12s-3-7-8-7a11.83 11.83 0 0 0-4.3.8l-1.5-1.5A13.68 13.68 0 0 1 12 7Z" />
  </svg>
);

const CustomTitleBar = () => (
  <div
    data-tauri-drag-region
    className="h-8 w-full bg-transparent flex justify-between items-center fixed top-0 left-0 z-[999] select-none rounded-t-2xl"
  >
    <div className="pl-4 flex items-center gap-2 pointer-events-none" />
    <div className="flex h-full">
      <button onClick={() => appWindow.minimize()} className="px-4 h-full hover:bg-white/10 text-slate-400 transition-colors duration-200 cursor-pointer">
        <Minus size={14} />
      </button>
      <button onClick={() => appWindow.close()} className="px-4 h-full hover:bg-slate-700/80 text-slate-400 hover:text-white transition-colors duration-200 cursor-pointer rounded-tr-2xl">
        <X size={14} />
      </button>
    </div>
  </div>
);

export default function Register() {
  const navigate = useNavigate();
  const reducedMotion = useReducedMotion();
  const [isSuccess, setIsSuccess] = useState(false);
  const [departing, setDeparting] = useState(false);
  const [form, setForm] = useState({ email: "", username: "", password: "", confirm: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPw, setShowPw] = useState(false);

  useEffect(() => {
    appWindow.setMaxSize(new LogicalSize(480, 650));
    appWindow.setMinSize(new LogicalSize(480, 650));
    appWindow.setSize(new LogicalSize(480, 650));
  }, []);

  useEffect(() => {
    if (!isSuccess) return;
    const t1 = window.setTimeout(() => setDeparting(true), 1600);
    const t2 = window.setTimeout(() => navigate("/onboard"), reducedMotion ? 1600 : 2050);
    return () => { window.clearTimeout(t1); window.clearTimeout(t2); };
  }, [isSuccess, navigate, reducedMotion]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (error) setError(null);
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!form.email || !form.username || !form.password || !form.confirm) { setError("Please fill in all fields."); return; }
    if (!/\S+@\S+\.\S+/.test(form.email))  { setError("Please enter a valid email address."); return; }
    if (form.username.length < 3)           { setError("Username must be at least 3 characters."); return; }
    if (form.username.length >= 25)         { setError("Username must be less than 25 characters."); return; }
    if (form.password.length < 4)           { setError("Password must be at least 4 characters."); return; }
    if (form.password !== form.confirm)     { setError("Passwords do not match."); return; }

    setLoading(true);
    try {
      const res = await fetch(`${Defaults.BACKEND_URL}/api/launcher/register`, {
        method: "POST", responseType: ResponseType.Text,
        headers: { "Content-Type": "application/json" },
        body: { type: "Json", payload: { email: form.email, username: form.username, password: form.password } },
      });

      if (res.ok) {
        // auto-login
        const loginRes = await fetch(
          `${Defaults.BACKEND_URL}/api/launcher/login?email=${encodeURIComponent(form.email)}&password=${encodeURIComponent(form.password)}`,
          { method: "GET", responseType: ResponseType.Text }
        );
        if (loginRes.ok) {
          const data = JSON.parse(loginRes.data as string);
          localStorage.setItem("user", JSON.stringify({ email: form.email, password: form.password, username: data.username, discordId: data.discordId, avatarHash: data.avatarHash, vbucks: data.vbucks ?? 0 }));
        } else {
          localStorage.setItem("user", JSON.stringify({ email: form.email, password: form.password, username: form.username, discordId: "", avatarHash: null, vbucks: 0 }));
        }
        setIsSuccess(true);
      } else {
        try { const d = JSON.parse(res.data as string); setError(d.error || "Registration failed."); }
        catch { setError((res.data as string) || "Registration failed."); }
      }
    } catch { setError("Unable to connect to the server."); }
    finally { setLoading(false); }
  };

  return (
    <motion.div
      animate={{ opacity: departing ? 0 : 1 }}
      transition={{ duration: reducedMotion ? 0 : 0.45, ease: "easeInOut" }}
      className="login-surface w-screen h-screen relative overflow-hidden text-gray-100 select-none rounded-2xl font-sans"
    >
      <CustomTitleBar />
      <div className="login-gradient" aria-hidden="true" />
      <div className="login-particles" aria-hidden="true">
        {particles.map((p, i) => (
          <span key={i} className="login-particle" style={{
            left: p.left, width: p.size, height: p.size,
            animationDuration: `${p.duration}s`, animationDelay: `${p.delay}s`,
            "--particle-drift": p.drift,
          } as CSSProperties} />
        ))}
      </div>

      <div className="relative h-full w-full overflow-y-auto custom-scrollbar px-6 pt-12 pb-5">
        <div className="flex min-h-full flex-col items-center justify-center">
          <AnimatePresence mode="wait">
            {!isSuccess ? (
              <motion.div
                key="register-form"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                transition={{ duration: reducedMotion ? 0 : 0.65, ease: [0.22, 1, 0.36, 1] }}
                className="relative w-full max-w-[400px] bg-transparent p-8 z-10"
              >
                <div className="text-center mb-5">
                  <img src={Defaults.LOGO_URL} alt="Logo" className="relative w-16 h-16 object-contain mx-auto mb-3" />
                  <h1 className="text-2xl font-bold text-white tracking-tight">Create Account</h1>
                  <p className="text-slate-400 text-sm mt-1">Join {Defaults.LAUNCHER_NAME}</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-3" noValidate autoComplete="off">
                  <div>
                    <label className="text-sm text-slate-300">Email</label>
                    <input type="email" name="email" autoComplete="one-time-code" spellCheck="false"
                      value={form.email} onChange={handleChange} placeholder="name@example.com"
                      className="mt-1 w-full bg-white/[0.04] border border-white/10 text-white text-sm rounded-xl px-4 py-2.5 outline-none focus:border-slate-700/60 focus:bg-slate-900/10 focus:ring-1 focus:ring-slate-700/40 transition-all duration-200 placeholder:text-slate-600" />
                  </div>

                  <div>
                    <label className="text-sm text-slate-300">Username</label>
                    <input type="text" name="username" autoComplete="off" spellCheck="false"
                      value={form.username} onChange={handleChange} placeholder="CoolPlayer99"
                      className="mt-1 w-full bg-white/[0.04] border border-white/10 text-white text-sm rounded-xl px-4 py-2.5 outline-none focus:border-slate-700/60 focus:bg-slate-900/10 focus:ring-1 focus:ring-slate-700/40 transition-all duration-200 placeholder:text-slate-600" />
                  </div>

                  <div>
                    <label className="text-sm text-slate-300">Password</label>
                    <div className="relative mt-1">
                      <input type={showPw ? "text" : "password"} name="password"
                        value={form.password} onChange={handleChange} placeholder="••••••••"
                        className="w-full bg-white/[0.04] border border-white/10 text-white text-sm rounded-xl px-4 py-2.5 outline-none focus:border-slate-700/60 focus:bg-slate-900/10 focus:ring-1 focus:ring-slate-700/40 transition-all duration-200 placeholder:text-slate-600" />
                      <button type="button" onClick={() => setShowPw(s => !s)}
                        className="cursor-pointer absolute inset-y-0 right-2 flex items-center px-2 rounded-lg hover:bg-white/5 transition-colors duration-200">
                        {showPw ? <IconEyeOff className="text-slate-400" /> : <IconEye className="text-slate-400" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="text-sm text-slate-300">Confirm Password</label>
                    <input type="password" name="confirm"
                      value={form.confirm} onChange={handleChange} placeholder="••••••••"
                      className="mt-1 w-full bg-white/[0.04] border border-white/10 text-white text-sm rounded-xl px-4 py-2.5 outline-none focus:border-slate-700/60 focus:bg-slate-900/10 focus:ring-1 focus:ring-slate-700/40 transition-all duration-200 placeholder:text-slate-600" />
                  </div>

                  <AnimatePresence mode="wait">
                    {error && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }} className="overflow-hidden">
                        <p className="p-3 rounded-xl bg-red-900/20 border border-red-700/30 text-red-300 text-xs text-center font-medium">{error}</p>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <motion.button type="submit" disabled={loading}
                    whileHover={{ scale: 1.015 }} whileTap={{ scale: 0.985 }}
                    className="login-submit cursor-pointer w-full rounded-xl px-6 py-3 font-bold text-sm uppercase tracking-wide text-white disabled:opacity-50 disabled:cursor-not-allowed">
                    {loading ? "Creating account..." : "Create Account"}
                  </motion.button>
                </form>

                <div className="mt-8 text-center">
                  <span className="text-slate-500 text-xs">Already have an account? </span>
                  <button type="button" onClick={() => navigate("/login")} className="text-slate-400 text-xs font-bold hover:underline cursor-pointer">
                    Sign In
                  </button>
                </div>
              </motion.div>
            ) : (
              <motion.div key="success-msg" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }} className="text-center z-50">
                <motion.div initial={{ scale: 0, rotate: -10 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", delay: 0.2 }} className="w-24 h-24 mx-auto mb-6 relative">
                  <div className="absolute inset-0 rounded-full bg-green-500/20 blur-xl animate-pulse" />
                  <div className="relative w-full h-full rounded-full border-2 border-green-500/60 overflow-hidden bg-[#0e0505] shadow-[0_0_40px_rgba(34,197,94,0.4)]">
                    <div className="absolute inset-0 flex items-center justify-center text-3xl font-bold text-white">
                      {form.username.charAt(0).toUpperCase()}
                    </div>
                  </div>
                </motion.div>
                <h2 className="text-4xl font-bold text-white tracking-tight">Welcome, <span className="text-green-400">{form.username}</span></h2>
                <p className="text-slate-400 mt-3 text-lg">Entering the launcher...</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}

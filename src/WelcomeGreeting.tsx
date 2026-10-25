import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

const greetings = [
  ["en", "Welcome back,"], ["pt-BR", "Bem-vindo de volta,"],
  ["es", "Bienvenido de nuevo,"], ["fr", "Bon retour,"],
  ["it", "Bentornato,"], ["de", "Willkommen zurück,"],
  ["ja", "おかえりなさい、"], ["ko", "다시 오신 것을 환영합니다,"],
  ["zh", "欢迎回来，"], ["ar", "مرحبًا بعودتك،"],
];

export default function WelcomeGreeting({ username }: { username: string }) {
  const [index, setIndex] = useState(0);
  const reducedMotion = useReducedMotion();
  useEffect(() => {
    if (reducedMotion) return;
    const timer = window.setInterval(() => setIndex(value => (value + 1) % greetings.length), 4000);
    return () => window.clearInterval(timer);
  }, [reducedMotion]);

  return (
    <div className="flex items-center gap-2" aria-label={`Welcome back, ${username}`}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.span key={index} aria-hidden="true"
            className="inline-flex items-center gap-2"
            initial={{ opacity: 0, y: 4, filter: "blur(3px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -4, filter: "blur(3px)" }}
            transition={{ duration: reducedMotion ? 0 : 0.55, ease: "easeInOut" }}>
            <span lang={greetings[index][0]} dir="auto" className="text-[11px] text-slate-500 font-bold uppercase tracking-widest whitespace-nowrap">{greetings[index][1]}</span>
            <span className="text-[11px] text-slate-400 font-black uppercase tracking-widest">{username}</span>
          </motion.span>
        </AnimatePresence>
    </div>
  );
}

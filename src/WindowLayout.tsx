import { useEffect, useState, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { appWindow, LogicalSize } from "@tauri-apps/api/window";

let pendingResize = Promise.resolve();
export default function WindowLayout({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const [readyPath, setReadyPath] = useState<string | null>(null);
  const reducedMotion = useReducedMotion();
  useEffect(() => {
    let cancelled = false;
    const compact = pathname === "/login" || pathname === "/register";
    pendingResize = pendingResize.then(async () => {
      if (cancelled) return;
      if ("__TAURI_IPC__" in window && pathname !== "/") {
        await appWindow.setMinSize(new LogicalSize(480, 650));
        await appWindow.setSize(new LogicalSize(compact ? 480 : 1250, 650));
        await appWindow.setMinSize(new LogicalSize(compact ? 480 : 1250, 650));
        await appWindow.center();
        // Let the resized surface paint before revealing the new page.
        await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      }
    }).catch(error => console.error("Could not resize launcher window", error))
      .then(() => { if (!cancelled) setReadyPath(pathname); });
    return () => { cancelled = true; };
  }, [pathname]);
  return (
    <motion.div key={pathname}
      initial={{ opacity: 0 }}
      animate={{ opacity: readyPath === pathname ? 1 : 0 }}
      transition={{ duration: reducedMotion ? 0 : 1.1, ease: [0.22, 1, 0.36, 1] }}
      style={{ width: "100%", height: "100%", pointerEvents: readyPath === pathname ? "auto" : "none" }}>
      {children}
    </motion.div>
  );
}

"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";
import { AlertTriangle, Check, Info, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type ToastTone = "success" | "error" | "info";
type Toast = { id: number; message: string; tone: ToastTone };

const TONES: Record<ToastTone, { icon: LucideIcon; className: string }> = {
  success: { icon: Check, className: "text-accent" },
  error: { icon: AlertTriangle, className: "text-danger" },
  info: { icon: Info, className: "text-muted" },
};

const ToastContext = createContext<(message: string, tone?: ToastTone) => void>(() => {});

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const id = useRef(0);

  const show = useCallback((message: string, tone: ToastTone = "success") => {
    const t = { id: ++id.current, message, tone };
    setToasts((prev) => [...prev.slice(-2), t]);
    setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== t.id)), tone === "error" ? 5000 : 3200);
  }, []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-24 z-[100] flex flex-col items-center gap-2 px-4 md:bottom-8"
      >
        {toasts.map((t) => {
          const { icon: Icon, className } = TONES[t.tone];
          return (
            <div
              key={t.id}
              className="flex max-w-md items-center gap-2.5 rounded-xl border border-line-strong bg-surface-2/95 px-4 py-3 text-sm text-fg shadow-elevated backdrop-blur animate-rise"
            >
              <Icon className={cn("size-4 shrink-0", className)} />
              {t.message}
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}

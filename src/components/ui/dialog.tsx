"use client";

import { useEffect, useId, useRef } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

const VARIANTS = {
  center: "m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl border border-line-strong",
  /** Bottom sheet on mobile, right-hand drawer from md up. */
  sheet:
    "mx-0 mt-auto mb-0 max-h-[88dvh] w-full max-w-none rounded-t-2xl border-t border-line-strong md:my-0 md:mr-0 md:ml-auto md:h-dvh md:max-h-dvh md:max-w-sm md:rounded-none md:border-t-0 md:border-l",
} as const;

/** Native <dialog> for built-in focus trapping, Esc handling and top-layer stacking. */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  variant = "center",
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  /** Pinned below the scrolling body (sheet actions, etc.). */
  footer?: React.ReactNode;
  variant?: keyof typeof VARIANTS;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      aria-labelledby={titleId}
      className={cn("overflow-hidden bg-surface p-0 text-fg shadow-elevated open:flex open:flex-col open:animate-rise", VARIANTS[variant], className)}
    >
      {open && (
        <>
          <div className="min-h-0 flex-1 overflow-y-auto p-6">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 id={titleId} className="text-lg font-semibold tracking-tight">
                  {title}
                </h2>
                {description && <p className="mt-1 text-sm text-muted">{description}</p>}
              </div>
              <button onClick={onClose} aria-label="Close" className="-m-1 rounded-lg p-1 text-muted hover:bg-surface-2 hover:text-fg">
                <X className="size-5" />
              </button>
            </div>
            {children}
          </div>
          {footer && <div className="shrink-0 border-t border-line px-6 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">{footer}</div>}
        </>
      )}
    </dialog>
  );
}

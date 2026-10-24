import Link from "next/link";
import { cn } from "@/lib/utils";

/** Temporary Vernant mark: a V monogram. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={cn("size-7", className)}>
      <rect width="32" height="32" rx="9" fill="var(--color-accent)" />
      <path
        d="M10 10.5 16 22l6-11.5"
        fill="none"
        stroke="var(--color-accent-fg)"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Logo({ href = "/", className, compact }: { href?: string; className?: string; compact?: boolean }) {
  return (
    <Link href={href} className={cn("inline-flex items-center gap-2.5 rounded-lg", className)} aria-label="Vernant home">
      <LogoMark />
      {!compact && <span className="text-[21px] leading-none font-semibold tracking-[-0.035em]">vernant</span>}
    </Link>
  );
}

export function DemoNotice({ className }: { className?: string }) {
  return (
    <p className={cn("text-[11px] uppercase tracking-[0.14em] text-subtle", className)}>
      Prototype · in-app content is fictional demo data
    </p>
  );
}

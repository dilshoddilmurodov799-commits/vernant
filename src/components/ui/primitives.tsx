import { BadgeCheck } from "lucide-react";
import { cn } from "@/lib/utils";

export function Chip({
  active,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={cn(
        "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-[13px] transition-colors [&_svg]:size-3.5",
        active
          ? "border-accent/40 bg-accent-soft text-accent"
          : "border-line bg-surface-2 text-muted hover:border-line-strong hover:text-fg",
        className,
      )}
      {...props}
    />
  );
}

const BADGE_VARIANTS = {
  neutral: "border-line bg-surface-2 text-muted",
  accent: "border-accent/25 bg-accent-soft text-accent",
  danger: "border-danger/25 bg-danger-soft text-danger",
  outline: "border-line-strong text-fg",
} as const;

export function Badge({
  children,
  variant = "neutral",
  size = "md",
  className,
}: {
  children: React.ReactNode;
  variant?: keyof typeof BADGE_VARIANTS;
  size?: "sm" | "md";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border whitespace-nowrap [&_svg]:size-3",
        size === "sm" ? "h-5 px-2 text-[11px]" : "h-7 px-3 text-xs",
        BADGE_VARIANTS[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function VerifiedBadge({ className }: { className?: string }) {
  return <BadgeCheck aria-label="Verified" className={cn("size-4 shrink-0 text-accent", className)} />;
}

export function CountBadge({ count, className }: { count: number; className?: string }) {
  if (count <= 0) return null;
  return (
    <span
      className={cn(
        "grid h-[18px] min-w-[18px] place-items-center rounded-full bg-accent px-1 text-[10px] font-semibold tabular-nums text-accent-fg",
        className,
      )}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-2xl border border-line bg-surface", className)} {...props} />;
}

export function Divider({ className }: { className?: string }) {
  return <hr className={cn("border-line", className)} />;
}

export function PageHeader({
  title,
  subtitle,
  actions,
  className,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("flex items-end justify-between gap-4 pb-5", className)}>
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  className,
  label,
}: {
  options: Array<{ value: T; label: string; count?: number }>;
  value: T;
  onChange: (v: T) => void;
  className?: string;
  label: string;
}) {
  return (
    <div role="tablist" aria-label={label} className={cn("flex gap-1 rounded-xl border border-line bg-surface p-1", className)}>
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          type="button"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg px-3 text-[13px] transition-colors",
            value === o.value ? "bg-surface-3 text-fg" : "text-muted hover:text-fg",
          )}
        >
          {o.label}
          {o.count !== undefined && o.count > 0 && <span className="text-xs text-subtle tabular-nums">{o.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function Switch({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative h-6 w-10 shrink-0 rounded-full border transition-colors disabled:opacity-40",
        checked ? "border-transparent bg-accent" : "border-line-strong bg-surface-3 hover:bg-surface-4",
      )}
    >
      <span
        className={cn(
          "absolute top-1/2 size-[18px] -translate-y-1/2 rounded-full bg-white shadow-sm transition-[left]",
          checked ? "left-[17px]" : "left-[2px]",
        )}
      />
    </button>
  );
}

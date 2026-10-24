import Link from "next/link";
import { cn } from "@/lib/utils";

const VARIANTS = {
  primary: "bg-accent text-accent-fg hover:bg-accent-hover font-medium",
  secondary: "bg-surface-3 text-fg hover:bg-surface-4 border border-line",
  outline: "border border-line-strong text-fg hover:bg-surface-2",
  ghost: "text-muted hover:text-fg hover:bg-surface-2",
  danger: "bg-danger-soft text-danger hover:bg-danger/20 border border-danger/20",
} as const;

const SIZES = {
  sm: "h-8 px-3 text-xs gap-1.5",
  md: "h-10 px-4 text-sm gap-2",
  lg: "h-12 px-6 text-[15px] gap-2",
  icon: "size-10",
  "icon-sm": "size-8",
} as const;

export type ButtonVariant = keyof typeof VARIANTS;
export type ButtonSize = keyof typeof SIZES;

export function buttonStyles({
  variant = "primary",
  size = "md",
  className,
}: { variant?: ButtonVariant; size?: ButtonSize; className?: string } = {}) {
  return cn(
    "inline-flex shrink-0 select-none items-center justify-center rounded-xl transition-[color,background-color,border-color,transform] duration-150 active:scale-[0.98]",
    "disabled:pointer-events-none disabled:opacity-40 [&_svg]:size-[1.15em] [&_svg]:shrink-0",
    VARIANTS[variant],
    SIZES[size],
    className,
  );
}

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: ButtonSize };

export function Button({ variant, size, className, type = "button", ...props }: ButtonProps) {
  return <button type={type} className={buttonStyles({ variant, size, className })} {...props} />;
}

type ButtonLinkProps = React.ComponentProps<typeof Link> & { variant?: ButtonVariant; size?: ButtonSize };

export function ButtonLink({ variant, size, className, ...props }: ButtonLinkProps) {
  return <Link className={buttonStyles({ variant, size, className })} {...props} />;
}

import { cn, initials } from "@/lib/utils";
import { Photo } from "./photo";

const SIZES = {
  xs: "size-7 text-[10px]",
  sm: "size-9 text-xs",
  md: "size-11 text-sm",
  lg: "size-16 text-base",
  xl: "size-24 text-xl md:size-32 md:text-2xl",
} as const;

const PX = { xs: 56, sm: 72, md: 88, lg: 128, xl: 256 } as const;

interface AvatarProps {
  name: string;
  seed?: string;
  size?: keyof typeof SIZES;
  online?: boolean;
  /** Story ring: "new" = accent ring, "seen" = muted ring. */
  ring?: "new" | "seen";
  className?: string;
}

export function Avatar({ name, seed, size = "md", online, ring, className }: AvatarProps) {
  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 rounded-full",
        ring && "p-[2.5px]",
        ring === "new" && "bg-[conic-gradient(from_200deg,var(--color-accent),var(--color-accent-2),var(--color-accent))]",
        ring === "seen" && "bg-line-strong",
        className,
      )}
    >
      <span className={cn("relative block rounded-full", ring && "p-[2px] bg-bg")}>
        {seed ? (
          <Photo
            seed={seed}
            alt={name}
            width={PX[size]}
            height={PX[size]}
            sizes={`${PX[size]}px`}
            className={cn("rounded-full", SIZES[size])}
          />
        ) : (
          <span className={cn("grid place-items-center rounded-full bg-surface-3 font-medium text-muted", SIZES[size])}>
            {initials(name)}
          </span>
        )}
      </span>
      {online && (
        <span
          aria-label="Online"
          className={cn(
            "absolute right-0 bottom-0 rounded-full bg-online ring-2 ring-bg",
            size === "xs" || size === "sm" ? "size-2.5" : "size-3",
            size === "xl" && "right-2 bottom-2 size-4",
          )}
        />
      )}
    </span>
  );
}

"use client";

import { Monitor, Moon, Sun, type LucideIcon } from "lucide-react";
import { useTheme } from "@/lib/theme/use-theme";
import { isThemePreference, type ThemePreference } from "@/lib/theme/config";
import { cn } from "@/lib/utils";
import { Segmented } from "./primitives";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "./dropdown-menu";

const OPTIONS: Array<{ value: ThemePreference; label: string; icon: LucideIcon }> = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];

/** Icon button + menu, for navigation chrome. */
export function ThemeToggle({ className, withLabel }: { className?: string; withLabel?: boolean }) {
  const { preference, resolved, setPreference } = useTheme();
  // Before hydration the stored theme is unknown; show a neutral icon (no layout shift).
  const Icon = preference === "system" ? Monitor : resolved === "light" ? Sun : Moon;
  const current = OPTIONS.find((o) => o.value === preference);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={current ? `Theme: ${current.label}. Change theme` : "Change theme"}
        className={cn(
          "flex h-10 items-center gap-3.5 rounded-xl px-2.5 text-muted transition-colors hover:bg-surface-2 hover:text-fg data-[state=open]:bg-surface-2 data-[state=open]:text-fg",
          className,
        )}
      >
        <Icon className="size-5 shrink-0" strokeWidth={1.8} />
        {withLabel && <span className="text-[15px]">Appearance</span>}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-40">
        <DropdownMenuLabel>Theme</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={preference ?? undefined} onValueChange={(v) => isThemePreference(v) && setPreference(v)}>
          {OPTIONS.map(({ value, label, icon: OptionIcon }) => (
            <DropdownMenuRadioItem key={value} value={value}>
              <OptionIcon />
              {label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Inline segmented control, for Settings. */
export function ThemeSegmented({ className }: { className?: string }) {
  const { preference, setPreference } = useTheme();
  return (
    <Segmented
      label="Theme"
      value={preference ?? "dark"}
      onChange={setPreference}
      className={className}
      options={OPTIONS.map(({ value, label }) => ({ value, label }))}
    />
  );
}

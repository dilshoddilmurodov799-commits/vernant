"use client";

import { MoreHorizontal, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "./dropdown-menu";

export interface MenuItem {
  label: string;
  icon: LucideIcon;
  onSelect: () => void;
  danger?: boolean;
}

/** "More" overflow menu (•••) used on posts, profiles and conversations. */
export function Menu({ items, label = "More options", className }: { items: MenuItem[]; label?: string; className?: string }) {
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger
        aria-label={label}
        className={cn(
          "grid size-9 place-items-center rounded-xl text-muted transition-colors hover:bg-surface-2 hover:text-fg data-[state=open]:bg-surface-2 data-[state=open]:text-fg",
          className,
        )}
      >
        <MoreHorizontal className="size-5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        {items.map(({ label, icon: Icon, onSelect, danger }) => (
          <DropdownMenuItem key={label} onSelect={onSelect} variant={danger ? "danger" : "default"}>
            <Icon />
            {label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

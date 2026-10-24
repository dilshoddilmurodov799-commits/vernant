"use client";

/**
 * Dropdown menu — adapted from shadcn/ui, built on Radix for full keyboard support
 * (arrow keys, typeahead, Home/End, Escape, focus return) and collision-aware positioning.
 * Styled with Vernant tokens.
 */
import { DropdownMenu as Primitive } from "radix-ui";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export const DropdownMenu = Primitive.Root;
export const DropdownMenuTrigger = Primitive.Trigger;
export const DropdownMenuGroup = Primitive.Group;
export const DropdownMenuRadioGroup = Primitive.RadioGroup;

export function DropdownMenuContent({
  className,
  sideOffset = 6,
  align = "end",
  ...props
}: React.ComponentProps<typeof Primitive.Content>) {
  return (
    <Primitive.Portal>
      <Primitive.Content
        sideOffset={sideOffset}
        align={align}
        collisionPadding={8}
        className={cn(
          "z-50 min-w-48 overflow-hidden rounded-xl border border-line-strong bg-surface-2 p-1 text-fg shadow-elevated",
          "origin-(--radix-dropdown-menu-content-transform-origin) data-[state=open]:animate-rise",
          className,
        )}
        {...props}
      />
    </Primitive.Portal>
  );
}

const itemBase =
  "relative flex cursor-default select-none items-center gap-2.5 rounded-lg px-3 py-2 text-sm outline-none transition-colors data-[disabled]:pointer-events-none data-[disabled]:opacity-40 data-[highlighted]:bg-surface-3 [&_svg]:size-4 [&_svg]:shrink-0";

export function DropdownMenuItem({
  className,
  variant = "default",
  ...props
}: React.ComponentProps<typeof Primitive.Item> & { variant?: "default" | "danger" }) {
  return (
    <Primitive.Item
      className={cn(itemBase, variant === "danger" ? "text-danger data-[highlighted]:bg-danger-soft" : "[&_svg]:text-muted", className)}
      {...props}
    />
  );
}

export function DropdownMenuRadioItem({ className, children, ...props }: React.ComponentProps<typeof Primitive.RadioItem>) {
  return (
    <Primitive.RadioItem className={cn(itemBase, "pr-9 [&_svg]:text-muted", className)} {...props}>
      {children}
      <Primitive.ItemIndicator className="absolute right-3 text-accent">
        <Check className="text-accent!" />
      </Primitive.ItemIndicator>
    </Primitive.RadioItem>
  );
}

export function DropdownMenuLabel({ className, ...props }: React.ComponentProps<typeof Primitive.Label>) {
  return <Primitive.Label className={cn("px-3 pt-2 pb-1 text-xs font-medium text-subtle", className)} {...props} />;
}

export function DropdownMenuSeparator({ className, ...props }: React.ComponentProps<typeof Primitive.Separator>) {
  return <Primitive.Separator className={cn("-mx-1 my-1 h-px bg-line", className)} {...props} />;
}

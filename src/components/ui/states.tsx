import { AlertTriangle, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./button";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center px-6 py-16 text-center animate-fade-in", className)}>
      <div className="mb-4 grid size-12 place-items-center rounded-2xl border border-line bg-surface-2 text-muted">
        <Icon className="size-5" />
      </div>
      <h3 className="text-[15px] font-medium">{title}</h3>
      {description && <p className="mt-1.5 max-w-xs text-sm text-muted">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({
  title = "Something went wrong",
  description = "We couldn't load this right now. Check your connection and try again.",
  onRetry,
  className,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div role="alert" className={cn("flex flex-col items-center px-6 py-16 text-center", className)}>
      <div className="mb-4 grid size-12 place-items-center rounded-2xl border border-danger/20 bg-danger-soft text-danger">
        <AlertTriangle className="size-5" />
      </div>
      <h3 className="text-[15px] font-medium">{title}</h3>
      <p className="mt-1.5 max-w-xs text-sm text-muted">{description}</p>
      {onRetry && (
        <Button variant="secondary" className="mt-5" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "rounded-lg bg-surface-2 bg-[length:200%_100%] bg-[linear-gradient(90deg,transparent,rgb(255_255_255/0.04),transparent)] animate-shimmer",
        className,
      )}
    />
  );
}

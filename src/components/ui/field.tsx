import { useId } from "react";
import { cn } from "@/lib/utils";

const inputBase =
  "w-full rounded-xl border border-line bg-surface-2 px-3.5 text-sm text-fg placeholder:text-subtle transition-colors outline-none hover:border-line-strong focus:border-accent/60 focus:bg-surface focus:ring-4 focus:ring-accent/15 aria-invalid:border-danger/60 aria-invalid:focus:ring-danger/15";

export function Input({ className, ...props }: React.ComponentProps<"input">) {
  return <input className={cn(inputBase, "h-11", className)} {...props} />;
}

export function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(inputBase, "min-h-24 resize-none py-3", className)} {...props} />;
}

export function Select({ className, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn(inputBase, "h-11 appearance-none", className)} {...props} />;
}

/** Label + control + hint/error, wired with ids for accessibility. */
export function Field({
  label,
  hint,
  error,
  children,
  className,
}: {
  label: string;
  hint?: string;
  error?: string;
  className?: string;
  children: (props: { id: string; "aria-invalid"?: boolean; "aria-describedby"?: string }) => React.ReactNode;
}) {
  const id = useId();
  const descId = `${id}-desc`;
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={id} className="block text-[13px] font-medium text-muted">
        {label}
      </label>
      {children({ id, "aria-invalid": error ? true : undefined, "aria-describedby": hint || error ? descId : undefined })}
      {(error || hint) && (
        <p id={descId} className={cn("text-xs", error ? "text-danger" : "text-subtle")}>
          {error ?? hint}
        </p>
      )}
    </div>
  );
}

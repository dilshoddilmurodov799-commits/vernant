"use client";

import { useId } from "react";

/** A required consent tick box with its own inline error. */
export function ConsentCheckbox({
  name,
  error,
  defaultChecked,
  children,
}: {
  name: string;
  error?: string;
  defaultChecked?: boolean;
  children: React.ReactNode;
}) {
  const errorId = `${useId()}-error`;
  return (
    <div>
      <label className="flex items-start gap-3 text-sm text-muted">
        <input
          type="checkbox"
          name={name}
          defaultChecked={defaultChecked}
          className="mt-0.5 size-4 shrink-0 accent-accent"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
        />
        <span>{children}</span>
      </label>
      {error && (
        <p id={errorId} className="mt-1.5 text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

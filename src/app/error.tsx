"use client";

import { ErrorState } from "@/components/ui/states";

export default function RootError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="grid min-h-dvh place-items-center">
      <ErrorState onRetry={reset} />
    </div>
  );
}

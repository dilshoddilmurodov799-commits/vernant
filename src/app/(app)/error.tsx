"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/ui/states";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Hook up an error reporter (e.g. Sentry) here before launch.
    console.error(error);
  }, [error]);

  return <ErrorState className="py-28" onRetry={reset} />;
}

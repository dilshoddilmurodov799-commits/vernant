"use client";

import { useEffect, useState } from "react";

/**
 * DEMO ONLY: simulates network latency the first time a screen is visited in a
 * session so loading skeletons can be reviewed. Remove once real queries exist.
 */
const loaded = new Set<string>();

export function useSimulatedLoad(key: string, ms = 550) {
  const [ready, setReady] = useState(() => loaded.has(key));

  useEffect(() => {
    if (ready) return;
    const t = setTimeout(() => {
      loaded.add(key);
      setReady(true);
    }, ms);
    return () => clearTimeout(t);
  }, [key, ms, ready]);

  return ready;
}

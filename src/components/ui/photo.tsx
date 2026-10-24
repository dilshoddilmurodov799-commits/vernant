"use client";

import Image from "next/image";
import { useState } from "react";
import { demoImageUrl } from "@/lib/demo/images";
import { cn } from "@/lib/utils";

/** Deterministic hue from a seed so fallbacks are stable per image. */
function hue(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) % 360;
  return h;
}

/** Theme-aware placeholder: lightness comes from --placeholder-l1/l2 tokens. */
export function fallbackGradient(seed: string) {
  const h = hue(seed);
  return `radial-gradient(120% 90% at 20% 10%, hsl(${h} 22% var(--placeholder-l1)), transparent 60%), linear-gradient(160deg, hsl(${(h + 30) % 360} 14% var(--placeholder-l1)), hsl(${h} 10% var(--placeholder-l2)))`;
}

interface PhotoProps {
  /** Demo image key (see lib/demo/images.ts). Real media will pass a signed storage URL instead. */
  seed: string;
  alt: string;
  width?: number;
  height?: number;
  sizes?: string;
  priority?: boolean;
  className?: string;
  imgClassName?: string;
  children?: React.ReactNode;
}

/**
 * Fills its (positioned) container. Shows a soft gradient while loading and
 * if the image fails, so layouts never collapse or show broken icons.
 */
export function Photo({
  seed,
  alt,
  width = 800,
  height = 1000,
  sizes = "(max-width: 768px) 100vw, 600px",
  priority,
  className,
  imgClassName,
  children,
}: PhotoProps) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);

  return (
    <div className={cn("relative overflow-hidden bg-surface-3", className)} style={{ backgroundImage: fallbackGradient(seed) }}>
      {!failed && (
        <Image
          src={demoImageUrl(seed, width, height)}
          alt={alt}
          fill
          sizes={sizes}
          priority={priority}
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
          className={cn("object-cover transition-opacity duration-500", loaded ? "opacity-100" : "opacity-0", imgClassName)}
        />
      )}
      {children}
    </div>
  );
}

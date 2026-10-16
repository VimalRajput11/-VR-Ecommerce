"use client";

import Image, { type ImageProps } from "next/image";
import { useState } from "react";
import { FALLBACK_IMAGE } from "@/lib/images";

/**
 * next/image with graceful recovery: if the optimised image fails (e.g. a cold image
 * optimiser right after a deploy), retry the original file once; only if that also fails,
 * show a neutral VG placeholder rather than an unrelated photo.
 */
export default function SafeImage({ src, alt, ...rest }: ImageProps) {
  const [attempt, setAttempt] = useState(0); // 0 = optimised, 1 = original file, 2 = placeholder
  const source = attempt >= 2 || !src ? FALLBACK_IMAGE : src;
  const isLocalRaw = typeof source === "string" && (source.startsWith("/uploads/") || source.endsWith(".svg"));
  return (
    <Image
      {...rest}
      src={source}
      alt={alt}
      unoptimized={attempt >= 1 || isLocalRaw || rest.unoptimized}
      onError={() => setAttempt((a) => Math.min(a + 1, 2))}
    />
  );
}

"use client";

import Image, { type ImageProps } from "next/image";
import { useState } from "react";
import { FALLBACK_IMAGE } from "@/lib/images";

/** next/image with a graceful fallback when a remote or uploaded image fails to load. */
export default function SafeImage({ src, alt, ...rest }: ImageProps) {
  const [failed, setFailed] = useState(false);
  const source = failed || !src ? FALLBACK_IMAGE : src;
  const uploaded = typeof source === "string" && source.startsWith("/uploads/");
  return <Image {...rest} src={source} alt={alt} unoptimized={uploaded || rest.unoptimized} onError={() => setFailed(true)} />;
}

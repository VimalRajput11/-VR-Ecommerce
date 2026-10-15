"use client";

import { useState } from "react";
import SafeImage from "./SafeImage";
import { Modal, cx } from "@/components/ui";

interface Img {
  id: string;
  url: string;
  alt: string;
  caption: string;
  category: string;
}

export default function GalleryGrid({ images, categories }: { images: Img[]; categories: readonly string[] }) {
  const [filter, setFilter] = useState("All");
  const [active, setActive] = useState<Img | null>(null);
  const used = categories.filter((c) => images.some((i) => i.category === c));
  const shown = filter === "All" ? images : images.filter((i) => i.category === filter);
  return (
    <>
      <div className="hide-scrollbar mb-8 flex gap-2 overflow-x-auto" role="group" aria-label="Filter gallery">
        {["All", ...used].map((c) => (
          <button
            key={c}
            type="button"
            aria-pressed={filter === c}
            onClick={() => setFilter(c)}
            className={cx("whitespace-nowrap rounded-full border px-4 py-1.5 text-sm", filter === c ? "border-charcoal bg-charcoal text-ivory" : "border-sand bg-white hover:border-charcoal")}
          >
            {c}
          </button>
        ))}
      </div>
      <div className="columns-2 gap-3 md:columns-3 lg:columns-4">
        {shown.map((img) => (
          <button key={img.id} type="button" onClick={() => setActive(img)} className="group relative mb-3 block w-full overflow-hidden rounded-lg bg-cream" aria-label={`View ${img.alt}`}>
            <SafeImage src={img.url} alt={img.alt} width={600} height={750} sizes="(max-width: 768px) 50vw, 25vw" className="h-auto w-full object-cover transition duration-500 group-hover:scale-105" />
          </button>
        ))}
      </div>
      <Modal open={!!active} onClose={() => setActive(null)} title={active?.caption || active?.category || "Gallery"} size="lg">
        {active && (
          <div>
            <SafeImage src={active.url} alt={active.alt} width={1200} height={1200} className="h-auto max-h-[70vh] w-full rounded object-contain" />
            <p className="mt-3 text-sm text-stone">{active.alt}</p>
          </div>
        )}
      </Modal>
    </>
  );
}

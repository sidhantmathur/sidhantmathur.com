"use client";

import { useEffect, useRef } from "react";

// Ambient backdrop — the wave of tiny glyphs behind the conversation column.
//
// Not an animation. A static image (public/ambient-wave.avif, generated once
// with an image model in the site's own palette and committed like any other
// asset) that moves the way a printed thing would: a slow drift measured in
// minutes and a few pixels of pointer parallax. The first canvas version drew
// live glyphs and read as cosplay; this reads as a surface.
//
// It extends idle mode (#14): under the empty state, back during idle, faded
// out while a conversation is on screen. The instrumentation policy line
// holds — ambient around the conversation, never in front of it — via the
// legibility scrim over the centre column and pointer-events-none throughout.
//
// The global prefers-reduced-motion rule in globals.css collapses the drift
// keyframes; the pointer parallax checks the same setting itself.

export function AmbientBackdrop({ visible }: { visible: boolean }) {
  const layerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const layer = layerRef.current;
    if (!layer) return;

    function onMove(e: PointerEvent) {
      if (!layer) return;
      const dx = (e.clientX / window.innerWidth - 0.5) * 14;
      const dy = (e.clientY / window.innerHeight - 0.5) * 8;
      layer.style.transform = `translate3d(${dx}px, ${dy}px, 0)`;
    }

    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, []);

  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 overflow-hidden transition-opacity duration-1000 ${
        visible ? "opacity-100" : "opacity-0"
      }`}
    >
      {/* Bled past the edges so neither the parallax nor the drift ever
          shows a seam. */}
      <div
        ref={layerRef}
        className="absolute -inset-8 transition-transform duration-700 ease-out will-change-transform"
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- next/image
            adds nothing to a fixed decorative backdrop and its wrapper would
            fight the drift transform */}
        <img
          src="/ambient-wave.avif"
          alt=""
          decoding="async"
          className="ambient-drift h-full w-full object-cover opacity-35 md:opacity-50"
        />
      </div>
      {/* Legibility scrim: the texture keeps the margins, the words keep the
          middle. On small screens the column is the whole width, so the flat
          mobile scrim is heavier and the shaped one takes over from md up. */}
      <div className="absolute inset-0 bg-bg/55 md:hidden" />
      <div
        className="absolute inset-0 hidden md:block"
        style={{
          background:
            "linear-gradient(90deg, rgba(11,10,9,0.1) 0%, rgba(11,10,9,0.72) 30%, rgba(11,10,9,0.72) 70%, rgba(11,10,9,0.1) 100%)",
        }}
      />
    </div>
  );
}

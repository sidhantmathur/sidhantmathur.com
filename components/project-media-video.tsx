"use client";

import { useEffect, useRef } from "react";

// A silent screen recording in a media frame (#19). It loops, muted and
// inline, but only while it is on screen, and never on its own for a visitor
// who prefers reduced motion: they get the poster frame and the browser's
// controls, so playing it is their choice. `preload="none"` keeps it off the
// network until it plays. The frame around it reserves the space, so nothing
// shifts when it loads.
const videoType = (src: string) => (src.endsWith(".mp4") ? "video/mp4" : "video/webm");

export function MediaVideo({
  src,
  fallback,
  poster,
  label,
}: {
  src: string;
  fallback?: string;
  poster?: string;
  label: string;
}) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let visible = false;

    const sync = (motionChanged: boolean) => {
      const reduced = motion.matches;
      video.controls = reduced;
      // Off screen it always rests. With reduced motion it never starts by
      // itself, and a switch to reduced motion stops it; a play the visitor
      // started from the controls is left alone otherwise.
      if (!visible || (reduced && motionChanged)) {
        video.pause();
        return;
      }
      if (!reduced) video.play().catch(() => {});
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
        sync(false);
      },
      { threshold: 0.25 },
    );
    observer.observe(video);
    const onMotion = () => sync(true);
    motion.addEventListener("change", onMotion);
    return () => {
      observer.disconnect();
      motion.removeEventListener("change", onMotion);
    };
  }, []);

  return (
    <video
      ref={ref}
      aria-label={label}
      className="absolute inset-0 h-full w-full object-cover object-top"
      muted
      loop
      playsInline
      preload="none"
      poster={poster}
    >
      <source src={src} type={videoType(src)} />
      {fallback && <source src={fallback} type={videoType(fallback)} />}
    </video>
  );
}

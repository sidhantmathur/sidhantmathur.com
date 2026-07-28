"use client";

import { useEffect, useRef } from "react";

// Glyph field — the ambient animation behind the conversation column.
//
// A grid of monospace characters whose brightness is driven by slow layered
// waves, in the site's own accent ramp: the look is a phosphor display seen
// from across a dark room, not a Matrix rain. It extends idle mode (#14):
// visible on the empty state, gone while a conversation is on screen, back
// when the instruments settle into idle.
//
// The instrumentation policy line this must hold: ambient AROUND the
// conversation, never in front of it. So the canvas is pointer-events-none,
// sits behind the text, and damps itself inside the centre column where the
// hero and chips live — the streaks live in the margins.
//
// ZERO API CALLS, same constraint as idle mode. Everything below is
// arithmetic on a seed shipped with the bundle.

/** Cells brighter than this get painted; the rest of the grid stays dark. */
const FLOOR = 0.14;
/** Target frame interval — 30fps is plenty for a slow wave and halves the cost. */
const FRAME_MS = 33;
/** The character set leans numeric with a few currency/punct glyphs, like a
    readout that never resolves into meaning. Meaningless by design: anything
    wordlike back there would compete with the hero. */
const GLYPHS = "0123456789$#%&+=:.";

/** Deterministic per-cell hash → [0, 1). Stable across frames so a cell keeps
    its glyph and phase; no Math.random so a replayed frame is identical. */
function hash(x: number, y: number): number {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = (h ^ (h >> 13)) | 0;
  h = Math.imul(h, 1274126177);
  return ((h ^ (h >> 16)) >>> 0) / 4294967296;
}

/** Layered directional waves — cheap value "noise" that reads as horizontal
    bands of glow drifting at different speeds, which is the reference image. */
function field(col: number, row: number, t: number): number {
  const v =
    Math.sin(col * 0.09 + t * 0.00021 * 1.7 + row * 0.35) *
      Math.sin(row * 0.51 - t * 0.00013) +
    Math.sin(col * 0.035 - t * 0.00017 + row * 1.21) *
      Math.sin(row * 0.23 + t * 0.00009 + 2.1) +
    0.6 * Math.sin(col * 0.021 + row * 0.83 - t * 0.00006);
  // v ∈ [-2.6, 2.6] → [0, 1], then sharpened so glow stays in streaks
  // instead of washing the whole grid.
  const n = (v / 2.6 + 1) / 2;
  return Math.min(1, n ** 2.8 * 1.45);
}

/** Amber ramp on the accent's hue family: embers → accent → near-white hot. */
function paint(intensity: number): string {
  if (intensity > 0.82) return "#FFD9A0";
  if (intensity > 0.68) return "#F5A623";
  if (intensity > 0.52) return "#E4522B";
  if (intensity > 0.36) return "#8A4020";
  return "#4A2A18";
}

export function GlyphField({ visible }: { visible: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const cell = 14; // px per glyph cell at CSS scale
    let raf = 0;
    let last = 0;
    let cols = 0;
    let rows = 0;

    function size() {
      if (!canvas || !ctx) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const { clientWidth: w, clientHeight: h } = canvas;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.font = "10px var(--font-geist-mono), monospace";
      ctx.textBaseline = "top";
      cols = Math.ceil(w / cell);
      rows = Math.ceil(h / cell);
    }

    function draw(t: number) {
      if (!canvas || !ctx) return;
      const w = canvas.clientWidth;
      ctx.clearRect(0, 0, w, canvas.clientHeight);
      const centre = w / 2;
      // The content column is 68ch ≈ 640px centred; inside it the field is
      // flat near-black (legibility), then it ramps up so the bright streaks
      // live in the margins.
      const outer = Math.min(460, w * 0.42);
      const inner = outer - 120;
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const seed = hash(col, row);
          let v = field(col, row, t + seed * 900);
          const x = col * cell;
          const fromCentre = Math.abs(x - centre);
          if (fromCentre < outer) {
            const ramp = Math.max(0, (fromCentre - inner) / (outer - inner));
            v *= 0.04 + 0.96 * ramp * ramp;
          }
          if (v < FLOOR) continue;
          ctx.fillStyle = paint(v);
          ctx.globalAlpha = Math.min(1, v * 1.15);
          // A cell keeps its glyph for ~seconds, then mutates — hash the slow
          // tick in so the flicker is sparse and asynchronous across cells.
          const tick = Math.floor(t / (1800 + seed * 2600));
          const glyph = GLYPHS[Math.floor(hash(col + tick, row - tick) * GLYPHS.length)]!;
          ctx.fillText(glyph, x, row * cell);
        }
      }
      ctx.globalAlpha = 1;
    }

    function loop(t: number) {
      raf = requestAnimationFrame(loop);
      if (t - last < FRAME_MS) return;
      last = t;
      draw(t);
    }

    size();
    // Hidden means faded out behind a conversation — stop burning frames. The
    // last painted frame sits under the fade, so there's no pop on re-entry.
    if (reduced || !visible) {
      // The point is the texture, not the motion: one still frame.
      draw(4000);
    } else {
      raf = requestAnimationFrame(loop);
    }

    const observer = new ResizeObserver(() => {
      size();
      if (reduced) draw(4000);
    });
    observer.observe(canvas);

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, [visible]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 h-full w-full transition-opacity duration-1000 ${
        visible ? "opacity-100" : "opacity-0"
      }`}
    />
  );
}

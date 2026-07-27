// The data-viz parameters for this site, decided once (Sprint 8).
//
// The site has ONE accent and a monochrome ink scale. Two consequences settled
// the palette before a single chart was drawn:
//
//   1. A five-hue categorical palette would break the design system, and would
//      also fail the all-pairs colour-blindness gate that scatter plots are held
//      to — five hues cannot be told apart pairwise under simulated protanopia.
//      So there is NO categorical palette here. Identity travels by direct
//      label and by the table underneath every chart; colour does two jobs
//      only: emphasis (this one is the point) and magnitude (this cell is hot).
//
//   2. Every value below was checked with the data-viz validator rather than
//      eyeballed. The marks clear the 3:1 contrast floor against `--bg`
//      (#0B0A09), and the ramp passes monotone lightness, adjacent ΔL ≥ 0.06,
//      light-end contrast ≥ 2:1, and single-hue as an ordinal ramp on a dark
//      surface.
//
// Contrast against --bg, measured:
//   MARK      #E4522B  5.22:1
//   CONTEXT   #6B655E  3.44:1
//   GRID      #332E29  1.47:1  — recessive by intent, never carries a value

/** The measured value; the emphasised model; the best bar in a panel. */
export const MARK = "var(--accent)";

/** The models that aren't the point. Still legible, deliberately quiet. */
export const CONTEXT = "var(--text-faint)";

/** Hairline, solid, one step off the surface. Never dashed — dashing reads as a threshold. */
export const GRID = "var(--line-strong)";

/** The chart surface, for the 2px gaps and rings that do the separating. */
export const SURFACE = "var(--bg)";

/**
 * Magnitude ramp — five ordinal steps on the accent hue, for the scorecard
 * heatmap and nothing else. Light-to-dark runs the other way on a dark surface:
 * more is BRIGHTER. Validated with `validate_palette.js --ordinal --mode dark`.
 */
export const RAMP = ["#782e1a", "#9a3a1f", "#bf4625", "#e4522b", "#fba57f"] as const;

/**
 * Where a value sits on the ramp. `null` — nothing measured — is not a ramp
 * step at all; it is the surface, and the cell says so in text.
 */
export function rampStep(fraction: number): string {
  const i = Math.min(RAMP.length - 1, Math.max(0, Math.round(fraction * (RAMP.length - 1))));
  return RAMP[i]!;
}

/**
 * Ink for a label sitting INSIDE a filled cell, picked by the fill's luminance
 * so it always clears contrast. The one place text is allowed on a data colour.
 */
export function inkOn(fill: string): string {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(fill.slice(i, i + 2), 16) / 255);
  const lin = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const L = 0.2126 * lin(r!) + 0.7152 * lin(g!) + 0.0722 * lin(b!);
  return L > 0.32 ? "#0B0A09" : "#EFEBE4";
}

/** Bar thickness. The spec caps marks at 24px; this site's density wants thinner. */
export const BAR_PX = 10;

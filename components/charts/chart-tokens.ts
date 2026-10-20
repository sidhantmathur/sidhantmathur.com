// The data-viz parameters for this site.
//
// The site has one accent and a monochrome ink scale, so there is no
// categorical palette: five hues would break the design system and can't be
// told apart pairwise under simulated protanopia. Identity travels by direct
// label and by the table under every chart. Colour does two jobs only:
// emphasis (this one is the point) and magnitude (this cell is hot).
//
// Every value was checked with the data-viz validator. The marks clear the 3:1
// contrast floor against `--bg` (#0B0A09), and the ramp passes monotone
// lightness, adjacent ΔL ≥ 0.06, light-end contrast ≥ 2:1, and single-hue as
// an ordinal ramp on a dark surface.
//
// Contrast against --bg, measured:
//   MARK      #E4522B  5.22:1
//   CONTEXT   #97918A  6.34:1
//   GRID      #2C2825  1.35:1  (recessive by intent, never carries a value)

/** The measured value; the emphasised model; the best bar in a panel. */
export const MARK = "var(--accent)";

/** The models that aren't the point. Still legible, deliberately quiet. */
export const CONTEXT = "var(--text-faint)";

/**
 * Hairline, solid, one step off the surface. Never dashed: dashing reads as a
 * threshold. `--line` rather than `--line-strong`, which is 3.31:1 on `--bg`
 * so control borders clear the non-text floor; a gridline at that weight
 * competes with the marks it sits behind.
 */
export const GRID = "var(--line)";

/** The chart surface, for the 2px gaps and rings that do the separating. */
export const SURFACE = "var(--bg)";

/**
 * Magnitude ramp: five ordinal steps on the accent hue, for the scorecard
 * heatmap only. On a dark surface, more is brighter.
 *
 * Every step clears 4.5:1 with the ink inkOn picks for it (8.02, 6.17, 4.75,
 * 5.22, 10.16), lightness is monotone, and the smallest adjacent ΔL is 0.064
 * against a floor of 0.06. Steps 2 and 3 were solved together in OKLCH at the
 * ramp's hue (36°) with steps 1, 4 and 5 held fixed: the contrast and lightness
 * gates pull against each other there, so changing one means re-solving both.
 */
export const RAMP = ["#782e1a", "#95381e", "#b34223", "#e4522b", "#fba57f"] as const;

/**
 * Where a value sits on the ramp. `null` — nothing measured — is not a ramp
 * step at all; it is the surface, and the cell says so in text.
 */
export function rampStep(fraction: number): string {
  const i = Math.min(RAMP.length - 1, Math.max(0, Math.round(fraction * (RAMP.length - 1))));
  return RAMP[i]!;
}

/** Relative luminance, the WCAG definition. */
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const lin = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(r!) + 0.7152 * lin(g!) + 0.0722 * lin(b!);
}

/** The WCAG contrast ratio between two opaque colours. */
function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

/**
 * Ink for a label inside a filled cell: whichever of the dark and light ink
 * contrasts more with the fill. Not a luminance threshold, which only knows
 * about one of the two colours: "dark ink above L 0.32" puts light ink on the
 * accent itself at 3.19:1, where the dark ink reaches 5.22. Whether the winner
 * clears 4.5:1 is a property of RAMP, checked there.
 */
export function inkOn(fill: string): string {
  const dark = "#0B0A09";
  const light = "#EFEBE4";
  return contrast(dark, fill) >= contrast(light, fill) ? dark : light;
}

/** Bar thickness. The spec caps marks at 24px; this site's density wants thinner. */
export const BAR_PX = 10;

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
//   CONTEXT   #97918A  6.34:1
//   GRID      #2C2825  1.35:1  — recessive by intent, never carries a value

/** The measured value; the emphasised model; the best bar in a panel. */
export const MARK = "var(--accent)";

/** The models that aren't the point. Still legible, deliberately quiet. */
export const CONTEXT = "var(--text-faint)";

/**
 * Hairline, solid, one step off the surface. Never dashed — dashing reads as a
 * threshold. Sits on `--line`, not `--line-strong`: the contrast pass lifted
 * `--line-strong` to 3.31:1 on `--bg` so control borders clear the non-text
 * floor on every surface they sit on, and a gridline at that weight competes
 * with the marks it is supposed to sit behind. The new `--line` is roughly
 * where `--line-strong` used to be.
 */
export const GRID = "var(--line)";

/** The chart surface, for the 2px gaps and rings that do the separating. */
export const SURFACE = "var(--bg)";

/**
 * Magnitude ramp — five ordinal steps on the accent hue, for the scorecard
 * heatmap and nothing else. Light-to-dark runs the other way on a dark surface:
 * more is BRIGHTER.
 *
 * The middle two steps moved in the contrast pass. The old step 3 (#bf4625) was
 * a dead zone: light ink reached 4.29:1 on it and dark ink 3.88, so NEITHER
 * cleared 4.5 and the cell value printed on it was below the floor whichever
 * way inkOn went. Darkening it to clear the floor with light ink cost lightness
 * headroom, which the old step 2 (#9a3a1f) then had to give back — the two
 * gates pull against each other and there is no single-value fix. Both steps
 * were re-solved together in OKLCH at the ramp's own hue (36°), holding steps
 * 1, 4 and 5 fixed, for the largest margin available on the tightest gate.
 *
 * Measured on the result: every step clears 4.5:1 with the ink inkOn picks for
 * it — 8.02, 6.17, 4.75, 5.22, 10.16 — lightness is monotone, and the smallest
 * adjacent ΔL is 0.064 against a floor of 0.06.
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
 * Ink for a label sitting INSIDE a filled cell. The one place text is allowed
 * on a data colour, so it is the one place the ink has to be argued for.
 *
 * This used to pick by luminance against a threshold — L > 0.32 takes the dark
 * ink — with a comment claiming that always cleared contrast. It did not, and
 * a threshold never can: contrast is a ratio between two colours and a
 * threshold only knows about one of them. On the accent itself (#E4522B, the
 * ramp's fourth step) the rule chose the light ink at 3.19:1 when the dark ink
 * was sitting right there at 5.22 — the brightest, most-used cell in the
 * heatmap printing its value below the floor.
 *
 * So: compute both and return the winner. There is no threshold to tune and
 * no fill for which this is worse than the rule it replaces, because "the
 * better of the two" is the definition of better. Whether the winner clears
 * 4.5:1 is a property of the RAMP, checked there.
 */
export function inkOn(fill: string): string {
  const dark = "#0B0A09";
  const light = "#EFEBE4";
  return contrast(dark, fill) >= contrast(light, fill) ? dark : light;
}

/** Bar thickness. The spec caps marks at 24px; this site's density wants thinner. */
export const BAR_PX = 10;

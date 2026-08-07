/**
 * The map's colour constants, as hex.
 *
 * ── Why these are duplicated from index.css ───────────────────────────────
 *
 * The design tokens live in a Tailwind v4 `@theme` block, which is CSS. A
 * canvas-drawn marker needs a real hex string at draw time, and reading it
 * back with `getComputedStyle` would make every marker depend on a stylesheet
 * having loaded — untestable in node, and a silent grey marker if it hasn't.
 *
 * So the values are restated here, and `palette.test.ts` parses index.css and
 * fails if the two ever drift. The duplication is real; the drift is not.
 *
 * If you change a colour, change it in index.css and here, in the same commit.
 */

/** The group palette. Keys match `GroupColor` in components/ui/IdChip. */
export const GROUP_COLORS = {
  blue: '#1a5fd4',
  purple: '#7b3fe4',
  teal: '#0e8a8a',
  green: '#12823c',
  pink: '#d6296e',
  amber: '#c77700',
} as const

export type GroupColorName = keyof typeof GROUP_COLORS

/**
 * The default group colour.
 *
 * A stop with no group is not "ungrouped and therefore grey" — it is in the
 * default group, which is blue, and is the same blue as the primary action.
 */
export const DEFAULT_GROUP_COLOR = GROUP_COLORS.blue

/** Everything else a marker is drawn from. */
export const MAP_COLORS = {
  surface: '#ffffff',
  surfaceVariant: '#f1f3f6',
  onSurface: '#1a1c1e',
  onSurfaceVariant: '#5c6470',
  outline: '#d3d8df',
  onPrimary: '#ffffff',
  /** Failure and destruction only. Never a warning, never emphasis. */
  danger: '#c62828',
  /** Success only. */
  success: '#12823c',
} as const

/** Route line colours. Grey for done, blue for what is left to drive. */
export const ROUTE_COLORS = {
  visited: '#9aa4b2',
  remaining: '#1a5fd4',
} as const

/**
 * `#rgb` / `#rrggbb` only — anything else is not a colour we are willing to
 * hand to a canvas. A malformed `colorHex` on a group should render the
 * default blue chip, not throw inside a draw call or paint transparent.
 */
const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i

export function normalizeHex(value: string | undefined | null): string | null {
  if (!value) return null
  const trimmed = value.trim()
  return HEX.test(trimmed) ? trimmed.toLowerCase() : null
}

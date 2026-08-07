import type { ChipSpec } from './chipSpec.ts'
import { MAP_COLORS } from './palette.ts'

/**
 * A ChipSpec, drawn to a bitmap for MapLibre's symbol layer.
 *
 * ── Why a bitmap and not DOM markers ──────────────────────────────────────
 *
 * DOM markers get no collision detection, which is the entire reason this
 * milestone exists — Spoke ships overlapping chips and clipped labels, and
 * MapLibre's symbol placement is what fixes it. Symbol layers take images.
 *
 * ── Why the badge is drawn INTO the chip ──────────────────────────────────
 *
 * The badge could be its own symbol layer, but MapLibre has no way to link
 * two layers into one collision unit: the chip could be placed and the badge
 * dropped, or worse, a badge could survive next to a chip that wasn't drawn.
 * Baking it in makes "chip and badge are one thing" true by construction.
 * The colour rule survives because `chipSpec` decides fill and badge
 * independently — this module only draws what it is told.
 */

/**
 * Geometry, in dp. The image reserves space for the badge overhang on BOTH
 * sides even though the badge is only ever on the right: a symmetric image
 * means `icon-anchor: 'bottom'` lands on the chip's horizontal centre, so the
 * tail tip sits exactly on the stop's coordinate with no per-feature offset.
 */
export const CHIP = {
  size: 30,
  radius: 9,
  /** Badge diameter; it straddles the chip's top-right corner. */
  badge: 15,
  /** Tail height below the chip, when the chip has one. */
  tail: 9,
  /** Horizontal padding either side, sized to the badge's overhang. */
  padX: 8,
  /** Space above the chip for the badge's overhang. */
  padTop: 8,
  fontSize: 14,
  /** Text inset before the label starts shrinking to fit. */
  textInset: 4,
} as const

export const CHIP_WIDTH = CHIP.padX * 2 + CHIP.size // 46
export const CHIP_HEIGHT = CHIP.padTop + CHIP.size + CHIP.tail // 47

/** Distance from the anchor (bottom-centre) up to the chip's vertical centre. */
export const CHIP_CENTER_ABOVE_ANCHOR = CHIP.tail + CHIP.size / 2 // 24

/** Distance from the anchor's x out to the far edge of the badge. */
export const CHIP_RIGHT_EXTENT = CHIP.size / 2 + CHIP.badge / 2 // 22.5

export interface ChipBitmap {
  width: number
  height: number
  data: Uint8ClampedArray
}

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

/** Shrink the font until the label fits, rather than letting it overflow. */
function fitFont(ctx: CanvasRenderingContext2D, label: string, maxWidth: number): void {
  let size = CHIP.fontSize
  do {
    ctx.font = `700 ${size}px system-ui, -apple-system, "Segoe UI", sans-serif`
    if (ctx.measureText(label).width <= maxWidth) return
    size -= 1
  } while (size > 8)
}

function drawTrash(ctx: CanvasRenderingContext2D, cx: number, cy: number): void {
  const w = 9
  const h = 10
  ctx.lineWidth = 1.6
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.beginPath()
  ctx.moveTo(cx - w / 2, cy - h / 2)
  ctx.lineTo(cx + w / 2, cy - h / 2)
  ctx.moveTo(cx - 2, cy - h / 2 - 2)
  ctx.lineTo(cx + 2, cy - h / 2 - 2)
  ctx.moveTo(cx - w / 2 + 1.5, cy - h / 2)
  ctx.lineTo(cx - w / 2 + 2.5, cy + h / 2)
  ctx.lineTo(cx + w / 2 - 2.5, cy + h / 2)
  ctx.lineTo(cx + w / 2 - 1.5, cy - h / 2)
  ctx.stroke()
}

function drawPlus(ctx: CanvasRenderingContext2D, cx: number, cy: number): void {
  ctx.lineWidth = 2.4
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(cx, cy - 6)
  ctx.lineTo(cx, cy + 6)
  ctx.moveTo(cx - 6, cy)
  ctx.lineTo(cx + 6, cy)
  ctx.stroke()
}

/** The status badge: a filled disc with a ✗ or a ✓, ringed in white. */
function drawBadge(ctx: CanvasRenderingContext2D, spec: ChipSpec, cx: number, cy: number): void {
  if (spec.badge === 'none') return
  const r = CHIP.badge / 2

  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.fillStyle = spec.badge === 'failed' ? MAP_COLORS.danger : MAP_COLORS.success
  ctx.fill()
  ctx.lineWidth = 1.5
  ctx.strokeStyle = MAP_COLORS.surface
  ctx.stroke()

  ctx.strokeStyle = MAP_COLORS.surface
  ctx.lineWidth = 1.8
  ctx.lineCap = 'round'
  ctx.beginPath()
  if (spec.badge === 'failed') {
    ctx.moveTo(cx - 3, cy - 3)
    ctx.lineTo(cx + 3, cy + 3)
    ctx.moveTo(cx + 3, cy - 3)
    ctx.lineTo(cx - 3, cy + 3)
  } else {
    ctx.moveTo(cx - 3.2, cy)
    ctx.lineTo(cx - 0.8, cy + 2.8)
    ctx.lineTo(cx + 3.4, cy - 2.6)
  }
  ctx.stroke()
}

/**
 * Render `spec` at `pixelRatio` device pixels per dp.
 *
 * Returns the raw RGBA the MapLibre `addImage` overload wants. Throws rather
 * than returning a blank if there is no 2D context — a silently invisible
 * marker is far harder to diagnose than a thrown error at startup.
 */
export function renderChip(spec: ChipSpec, pixelRatio: number): ChipBitmap {
  const width = Math.ceil(CHIP_WIDTH * pixelRatio)
  const height = Math.ceil(CHIP_HEIGHT * pixelRatio)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('[map] 2D canvas context unavailable; cannot draw stop markers')

  ctx.scale(pixelRatio, pixelRatio)
  ctx.globalAlpha = spec.dimmed ? 0.72 : 1

  const left = CHIP.padX
  const top = CHIP.padTop
  const centerX = CHIP_WIDTH / 2
  const centerY = top + CHIP.size / 2

  // The tail, drawn first so the chip's rounded corner overlaps its shoulders.
  if (spec.tail) {
    ctx.beginPath()
    ctx.moveTo(centerX - 6, top + CHIP.size - 2)
    ctx.lineTo(centerX, CHIP_HEIGHT - 0.5)
    ctx.lineTo(centerX + 6, top + CHIP.size - 2)
    ctx.closePath()
    ctx.fillStyle = spec.fill
    ctx.fill()
    ctx.lineWidth = 1.5
    ctx.strokeStyle = spec.borderColor
    ctx.stroke()
  }

  roundedRect(ctx, left, top, CHIP.size, CHIP.size, CHIP.radius)
  ctx.fillStyle = spec.fill
  ctx.fill()
  ctx.lineWidth = 1.5
  ctx.strokeStyle = spec.borderColor
  ctx.stroke()

  // A glyph replaces the number only for a staged ADD, where there is no
  // number yet. A staged REMOVE keeps its number — the driver needs to know
  // which stop is about to go — so the trash sits beside it, shrunk.
  if (spec.glyph === 'plus') {
    ctx.strokeStyle = spec.textColor
    drawPlus(ctx, centerX, centerY)
  } else {
    ctx.fillStyle = spec.textColor
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    if (spec.glyph === 'trash') {
      fitFont(ctx, spec.label, CHIP.size - CHIP.textInset * 2 - 9)
      ctx.fillText(spec.label, centerX - 4, centerY)
      ctx.strokeStyle = spec.textColor
      drawTrash(ctx, centerX + 9, centerY)
    } else {
      fitFont(ctx, spec.label, CHIP.size - CHIP.textInset * 2)
      ctx.fillText(spec.label, centerX, centerY)
    }
  }

  // Badges ignore the dim: a failure on a delivered-looking chip must not be
  // the faintest thing on the map.
  ctx.globalAlpha = 1
  drawBadge(ctx, spec, left + CHIP.size, top)

  return { width, height, data: ctx.getImageData(0, 0, width, height).data }
}

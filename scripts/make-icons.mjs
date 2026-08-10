/**
 * Generate the PWA icons, in-repo, with no image dependency.
 *
 *   node scripts/make-icons.mjs
 *
 * ── Why generated rather than committed art ───────────────────────────────
 *
 * The icons have to exist for the app to be installable at all, and an install
 * surface is what M13 needs before two of its four target contexts can even be
 * tested. Reaching for a design tool or an image library to produce three flat
 * PNGs would put a binary blob and a dependency in the way of that.
 *
 * Everything here is pixels and zlib, both of which node already has.
 *
 * ── Maskable ─────────────────────────────────────────────────────────────
 *
 * Android crops an installed icon to whatever shape the launcher uses — circle,
 * squircle, teardrop. A `maskable` icon promises that nothing important sits
 * outside the inner 80% circle, so the background is full-bleed and the glyph
 * is kept well inside that safe zone. An icon that ignores this gets its
 * corners eaten, which is how you end up with a logo missing a leg.
 */
import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons')

/** The app's primary blue, and white. Same values as index.css. */
const BG = [0x1a, 0x5f, 0xd4]
const FG = [0xff, 0xff, 0xff]

// ------------------------------------------------------------------- png

const CRC_TABLE = (() => {
  const table = new Int32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c
  }
  return table
})()

function crc32(buf) {
  let c = 0xffffffff
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([length, body, crc])
}

/** @param {Uint8Array} rgb  size*size*3 */
function encodePng(rgb, size) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 2 // colour type: truecolour
  // 10..12 are compression, filter and interlace: all zero, all default.

  // One filter byte per scanline. Filter 0 (None) keeps this readable; the
  // images are flat colour, so the compressor does the work anyway.
  const raw = Buffer.alloc(size * (size * 3 + 1))
  for (let y = 0; y < size; y++) {
    raw[y * (size * 3 + 1)] = 0
    rgb.subarray(y * size * 3, (y + 1) * size * 3).forEach((v, i) => {
      raw[y * (size * 3 + 1) + 1 + i] = v
    })
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

// ----------------------------------------------------------------- drawing

/** Distance from point to segment, for drawing a line with thickness. */
function distanceToSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1
  const dy = y2 - y1
  const lengthSq = dx * dx + dy * dy
  const t = lengthSq === 0 ? 0 : Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lengthSq))
  const nx = x1 + t * dx
  const ny = y1 + t * dy
  return Math.hypot(px - nx, py - ny)
}

/**
 * A route: three stops joined by two legs, which is the smallest drawing that
 * still reads as "a sequence of places" at 48 pixels on a home screen.
 */
function drawIcon(size, { rounded }) {
  const rgb = new Uint8Array(size * size * 3)
  const s = (n) => n * size // fractions of the icon

  // Glyph geometry, inside the maskable safe zone (the inner 80% circle).
  const stops = [
    [s(0.3), s(0.68)],
    [s(0.5), s(0.36)],
    [s(0.72), s(0.6)],
  ]
  const lineWidth = s(0.055)
  const dotRadius = s(0.085)
  const corner = s(0.22)

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const px = x + 0.5
      const py = y + 0.5

      // Background. `rounded` is for the non-maskable icon, which is shown
      // as-is and would otherwise be a hard square.
      let inside = true
      if (rounded) {
        const cx = Math.min(Math.max(px, corner), size - corner)
        const cy = Math.min(Math.max(py, corner), size - corner)
        inside = Math.hypot(px - cx, py - cy) <= corner
      }

      let colour = inside ? BG : null

      if (inside) {
        let onGlyph = false
        for (let i = 0; i < stops.length - 1 && !onGlyph; i++) {
          const [x1, y1] = stops[i]
          const [x2, y2] = stops[i + 1]
          if (distanceToSegment(px, py, x1, y1, x2, y2) <= lineWidth / 2) onGlyph = true
        }
        for (const [sx, sy] of stops) {
          if (Math.hypot(px - sx, py - sy) <= dotRadius) onGlyph = true
        }
        if (onGlyph) colour = FG
      }

      const o = (y * size + x) * 3
      if (colour) {
        rgb[o] = colour[0]
        rgb[o + 1] = colour[1]
        rgb[o + 2] = colour[2]
      } else {
        // Outside the rounded corner: white, since there is no alpha channel
        // and the only place this icon is shown is against a light surface.
        rgb[o] = 0xff
        rgb[o + 1] = 0xff
        rgb[o + 2] = 0xff
      }
    }
  }

  return rgb
}

mkdirSync(OUT, { recursive: true })

const files = [
  // Maskable: full bleed, glyph inside the safe zone.
  ['icon-192.png', 192, { rounded: false }],
  ['icon-512.png', 512, { rounded: false }],
  // iOS draws its own mask over apple-touch-icon and does not read the
  // manifest's `purpose`, so this one is square and full bleed too.
  ['apple-touch-icon.png', 180, { rounded: false }],
]

for (const [name, size, options] of files) {
  const png = encodePng(drawIcon(size, options), size)
  writeFileSync(join(OUT, name), png)
  console.log(`${name.padEnd(22)} ${size}x${size}  ${(png.length / 1024).toFixed(1)} kB`)
}

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
 * ── Maskable, and why there are now TWO families ─────────────────────────
 *
 * Android crops an installed icon to whatever shape the launcher uses — circle,
 * squircle, teardrop. A `maskable` icon promises that nothing important sits
 * outside the inner 80% circle, so the background is full-bleed and the glyph
 * is kept well inside that safe zone. An icon that ignores this gets its
 * corners eaten, which is how you end up with a logo missing a leg.
 *
 * M13 shipped ONE family, declared `"purpose": "any maskable"`. That is a
 * documented anti-pattern rather than a shortcut: the two purposes want
 * different amounts of padding, and a platform that honours `any` renders the
 * safe-zone padding as dead space — the glyph shows up conspicuously smaller
 * than every other icon on the shelf. Chrome's own maskable-icon audit says to
 * declare them separately.
 *
 * So the geometry is identical and only the SCALE differs:
 *   - maskable  — glyph inside the inner 80% circle, room for the crop.
 *   - any       — same glyph, ~25% larger, filling the square it is drawn in.
 * `GLYPH_SCALE` is the whole difference, and `circumradius()` below asserts
 * each variant actually fits the promise its purpose makes.
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
 * The glyph, in fractions of the icon: a route of three stops joined by two
 * legs, which is the smallest drawing that still reads as "a sequence of
 * places" at 48 pixels on a home screen.
 *
 * Expressed once, at scale 1.0 = the maskable size, and scaled about its own
 * centre for the other variants.
 */
const STOPS = [
  [0.3, 0.68],
  [0.5, 0.36],
  [0.72, 0.6],
]
const LINE_WIDTH = 0.055
const DOT_RADIUS = 0.085
/** Centre of the glyph's bounding box — what scaling pivots around. */
const CENTRE = [0.51, 0.52]

/** Scale a fraction-space point about CENTRE. */
const scalePoint = ([x, y], k) => [CENTRE[0] + (x - CENTRE[0]) * k, CENTRE[1] + (y - CENTRE[1]) * k]

/**
 * How far the drawn glyph reaches from the icon's centre, as a fraction of the
 * icon's width. This is the number each `purpose` makes a promise about, so it
 * is computed rather than eyeballed — see the assertions at the bottom.
 */
function circumradius(k) {
  let max = 0
  for (const stop of STOPS) {
    const [x, y] = scalePoint(stop, k)
    max = Math.max(max, Math.hypot(x - 0.5, y - 0.5) + DOT_RADIUS * k)
  }
  return max
}

function drawIcon(size, { glyphScale }) {
  const rgb = new Uint8Array(size * size * 3)
  const s = (n) => n * size

  const stops = STOPS.map((p) => scalePoint(p, glyphScale).map(s))
  const lineWidth = s(LINE_WIDTH * glyphScale)
  const dotRadius = s(DOT_RADIUS * glyphScale)

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const px = x + 0.5
      const py = y + 0.5

      // Full bleed, always. Every consumer of these files either masks the
      // icon itself (Android launchers, iOS) or shows the square as-is, and
      // there is no alpha channel here to round a corner INTO — the M13
      // version painted the corners white, which is invisible on a light
      // surface and a white notch on a dark one.
      let colour = BG

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

      const o = (y * size + x) * 3
      rgb[o] = colour[0]
      rgb[o + 1] = colour[1]
      rgb[o + 2] = colour[2]
    }
  }

  return rgb
}

/**
 * The three scales, and the promise each one has to keep.
 *
 *  MASKABLE — must fit the inner 80% circle, i.e. circumradius <= 0.40.
 *  ANY      — must fit the square it is drawn in, i.e. circumradius <= 0.50,
 *             and should be visibly bigger than the maskable one or there was
 *             no point declaring them separately.
 *  APPLE    — iOS applies its own superellipse mask and does not read the
 *             manifest's `purpose` at all. The squircle cuts the corners but
 *             little else, so this sits between the two.
 */
const MASKABLE = 1.0
const ANY = 1.25
const APPLE = 1.1

mkdirSync(OUT, { recursive: true })

const files = [
  // purpose: any — shown as-is, so it fills its square.
  ['icon-192.png', 192, ANY],
  ['icon-512.png', 512, ANY],
  // purpose: maskable — full bleed, glyph inside the safe zone.
  ['icon-maskable-192.png', 192, MASKABLE],
  ['icon-maskable-512.png', 512, MASKABLE],
  // iOS masks this itself and never reads the manifest.
  ['apple-touch-icon.png', 180, APPLE],
]

for (const [name, size, glyphScale] of files) {
  const png = encodePng(drawIcon(size, { glyphScale }), size)
  writeFileSync(join(OUT, name), png)
  console.log(`${name.padEnd(24)} ${size}x${size}  ${(png.length / 1024).toFixed(1)} kB`)
}

/**
 * Assert the geometry rather than trusting it.
 *
 * A maskable icon that overflows its safe zone does not fail loudly — it just
 * gets a corner shaved off on some launchers and not others, which is the kind
 * of defect that survives to production because nobody owns the device that
 * shows it.
 */
const checks = [
  ['maskable fits the inner 80% circle', circumradius(MASKABLE) <= 0.4],
  ['any fits its square', circumradius(ANY) <= 0.5],
  ['apple-touch fits inside the squircle', circumradius(APPLE) <= 0.45],
  ['any is visibly larger than maskable', circumradius(ANY) > circumradius(MASKABLE) * 1.15],
]

let failed = false
for (const [what, ok] of checks) {
  if (!ok) {
    console.error(`  ! ${what}`)
    failed = true
  }
}
console.log(
  `\ncircumradius  maskable ${circumradius(MASKABLE).toFixed(3)}  ` +
    `any ${circumradius(ANY).toFixed(3)}  apple ${circumradius(APPLE).toFixed(3)}`,
)
if (failed) process.exit(1)

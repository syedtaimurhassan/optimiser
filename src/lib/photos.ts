import type { AddressedStop } from '../types'

/**
 * Proof-of-delivery photos: how big, how many, and how to get there from a
 * 48-megapixel phone camera without the tab dying.
 *
 * Framework-free. The IndexedDB `photos` store has existed since M1 and has
 * never held a row; this is what finally writes to it. Blobs never enter
 * Zustand state — a stop holds `photoRefs`, and nothing else.
 */

// ------------------------------------------------------------------- budget

/**
 * Per-stop and per-route ceilings.
 *
 * Counted rather than measured in bytes, and that is a deliberate trade. A
 * byte budget means reading every blob back to enforce it, on every capture,
 * on a phone. Bounding the count AND the size of each photo bounds the total
 * just as well: 80 photos at ~250 KB is ~20 MB, which sits comfortably inside
 * the quota even on an iOS device that has not been granted persistence.
 *
 * Eight per stop is generous for "the parcel, the door, the safe place" and
 * still leaves the count meaningful.
 */
export const MAX_PHOTOS_PER_STOP = 8
export const MAX_PHOTOS_PER_ROUTE = 80

/** The longest edge a stored photo may have. */
export const PHOTO_MAX_EDGE = 1440
/** JPEG quality. High enough to read a house number, low enough to be small. */
export const PHOTO_QUALITY = 0.72

export interface PhotoBudget {
  stopUsed: number
  routeUsed: number
  /** Why the driver cannot add another, or null when they can. */
  blocked: 'stop' | 'route' | null
}

export function photoBudget(stop: AddressedStop, allStops: readonly AddressedStop[]): PhotoBudget {
  const stopUsed = stop.photoRefs?.length ?? 0
  const routeUsed = allStops.reduce((n, s) => n + (s.photoRefs?.length ?? 0), 0)
  return {
    stopUsed,
    routeUsed,
    blocked:
      stopUsed >= MAX_PHOTOS_PER_STOP ? 'stop' : routeUsed >= MAX_PHOTOS_PER_ROUTE ? 'route' : null,
  }
}

/** What to tell the driver when the budget is spent. Never just "failed". */
export function budgetMessage(blocked: 'stop' | 'route'): string {
  return blocked === 'stop'
    ? `This stop already has ${MAX_PHOTOS_PER_STOP} photos. Delete one to add another.`
    : `This route has reached ${MAX_PHOTOS_PER_ROUTE} photos. Delete some from other stops to add more.`
}

// -------------------------------------------------------------- downscaling

export interface Size {
  width: number
  height: number
}

/**
 * The size an image becomes when its longest edge is capped.
 *
 * Never upscales: a photo already smaller than the cap is stored as it is,
 * because enlarging it would cost bytes and add nothing.
 */
export function fitWithin(source: Size, maxEdge = PHOTO_MAX_EDGE): Size {
  const longest = Math.max(source.width, source.height)
  if (longest <= maxEdge || longest === 0) return { ...source }
  const scale = maxEdge / longest
  return {
    width: Math.max(1, Math.round(source.width * scale)),
    height: Math.max(1, Math.round(source.height * scale)),
  }
}

/**
 * iOS Safari refuses a canvas whose area exceeds this, and returns a blank
 * one rather than throwing — so an image that trips it is stored as a black
 * rectangle and nobody finds out until a driver needs the proof.
 *
 * 4097 × 4096 is over. A modern phone photo is 8000 × 6000, which is four
 * times over.
 */
export const MAX_CANVAS_AREA = 16_777_216

/** Would drawing at this size hit the ceiling iOS enforces? */
export function exceedsCanvasLimit(size: Size): boolean {
  return size.width * size.height > MAX_CANVAS_AREA
}

// ------------------------------------------------------------- compression

/**
 * A camera photo, made small enough to keep.
 *
 * ── Why the bitmap is decoded at the target size ──────────────────────────
 *
 * The obvious implementation decodes the full image and then draws it small.
 * On a 48 MP photo that allocates roughly 190 MB before the first pixel is
 * drawn, which on iOS is at or past the point where the tab is killed — and a
 * tab that dies mid-capture loses the delivery, not just the photo.
 *
 * `createImageBitmap` accepts resize options and does the downscale during
 * decode, so the big allocation never happens. Where those options are
 * ignored (older WebKit accepts the argument and returns full size) the canvas
 * is still only ever allocated at the target size, so the ceiling above is
 * never approached either way.
 */
export async function compressPhoto(
  file: Blob,
  maxEdge = PHOTO_MAX_EDGE,
  quality = PHOTO_QUALITY,
): Promise<Blob> {
  const probe = await createImageBitmap(file)
  const target = fitWithin({ width: probe.width, height: probe.height }, maxEdge)

  let source: ImageBitmap = probe
  if (target.width !== probe.width) {
    try {
      source = await createImageBitmap(file, {
        resizeWidth: target.width,
        resizeHeight: target.height,
        resizeQuality: 'medium',
      })
      probe.close()
    } catch {
      // Options unsupported: fall back to the full-size bitmap we already have.
      source = probe
    }
  }

  const canvas = document.createElement('canvas')
  canvas.width = target.width
  canvas.height = target.height
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    source.close()
    throw new Error('no 2d context')
  }
  ctx.drawImage(source, 0, 0, target.width, target.height)
  source.close()

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', quality),
  )
  // Releasing the backing store matters on iOS, where TOTAL canvas memory is
  // capped across the page and a few held captures are enough to reach it.
  canvas.width = 0
  canvas.height = 0
  if (!blob) throw new Error('could not encode the photo')
  return blob
}

/** A key for the photos store. Prefixed so a stray key is recognisable. */
export function newPhotoRef(): string {
  const rand =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`
  return `photo:${rand}`
}

import { useCallback, useRef, useState } from 'react'
import { getGeocodingService } from '../lib/geocoding'
import type { Suggestion } from '../lib/geocoding/types.ts'
import type { ImportedRow } from '../lib/importRows.ts'
import { parsePastedAddresses } from '../lib/pasteAddresses.ts'
import { useRoutesStore, type NewStopInput } from '../store/routesStore'

/**
 * Adding stops, from any of the ways M6 offers.
 *
 * A hook rather than store actions because two of these paths are ASYNC and
 * partial: geocoding a pasted list can succeed for four addresses and fail for
 * the fifth, and the driver has to be told which. Progress and per-row failure
 * are properties of one in-flight operation, not of the route, so they live
 * here and the store only ever receives finished stops.
 */

export interface BatchProgress {
  /** How many addresses have been attempted. */
  done: number
  total: number
  /** Addresses that could not be geocoded, verbatim, so they can be retried. */
  failures: string[]
  running: boolean
  /** True when the run stopped because the user asked it to. */
  cancelled?: boolean
}

const IDLE: BatchProgress = { done: 0, total: 0, failures: [], running: false }

export function useAddStops() {
  const addStops = useRoutesStore((s) => s.addStops)
  const [progress, setProgress] = useState<BatchProgress>(IDLE)

  /**
   * Cancellation is a ref, not state.
   *
   * The loop below is a closure that starts once; a state value read inside it
   * would be the value captured at the first render and would never become
   * true, so Cancel would do nothing at all. A ref is the same object on every
   * iteration, which is the only reason the flag is visible to a loop already
   * in flight.
   */
  const cancelRef = useRef(false)

  const cancel = useCallback(() => {
    cancelRef.current = true
  }, [])

  /** A suggestion already carries its coordinates, so this needs no lookup. */
  const addSuggestion = useCallback(
    (suggestion: Suggestion) => {
      addStops([
        { lat: suggestion.lat, lng: suggestion.lng, address: suggestion.address },
      ])
    },
    [addStops],
  )

  /**
   * Geocode a list of address strings and add whatever resolved.
   *
   * Sequential, not parallel, and that is deliberate on two counts: the
   * fallback provider is limited to about one request a second, and firing
   * fifty concurrent requests at a shared free tier is how the key gets
   * exhausted for everyone. A paste of five addresses is a couple of seconds,
   * which is what the progress state is for.
   *
   * Partial success is the expected outcome, not an error: four good addresses
   * should become four stops even when the fifth is a typo.
   */
  const addFromAddresses = useCallback(
    async (lines: string[]) => {
      const service = getGeocodingService()
      const total = lines.length
      if (total === 0) return IDLE

      cancelRef.current = false
      setProgress({ done: 0, total, failures: [], running: true })

      const created: NewStopInput[] = []
      const failures: string[] = []
      let done = 0

      for (const line of lines) {
        if (cancelRef.current) break
        try {
          const [best] = await service.autocomplete(line, { limit: 1 })
          if (best) {
            created.push({ lat: best.lat, lng: best.lng, address: best.address })
          } else {
            failures.push(line)
          }
        } catch {
          failures.push(line)
        }
        done++
        setProgress({ done, total, failures: [...failures], running: true })
      }

      // Whatever resolved before the cancel is still added. Throwing away
      // forty good stops because the driver stopped the run on the forty-first
      // would make Cancel more expensive than waiting.
      if (created.length) addStops(created)

      const final: BatchProgress = {
        done,
        total,
        failures,
        running: false,
        cancelled: cancelRef.current,
      }
      setProgress(final)
      return final
    },
    [addStops],
  )

  /**
   * Import classified rows: coordinate rows go straight in, address rows are
   * geocoded.
   *
   * Splitting them matters for spend. A file of 200 stops that already has
   * coordinates costs nothing, and only the rows that genuinely need an
   * answer are sent — which a naive "geocode every row" importer would not do.
   */
  const addFromImportedRows = useCallback(
    async (rows: ImportedRow[]) => {
      const direct = rows.filter((r) => r.point)
      const toGeocode = rows.filter((r) => !r.point && r.query)

      if (direct.length) {
        addStops(
          direct.map((r) => ({
            lat: r.point!.lat,
            lng: r.point!.lng,
            address: r.address,
          })),
        )
      }

      if (toGeocode.length === 0) {
        const final = { ...IDLE, done: 0, total: 0 }
        setProgress(final)
        return final
      }
      return addFromAddresses(toGeocode.map((r) => r.query!))
    },
    [addStops, addFromAddresses],
  )

  /**
   * Read the clipboard and add every address in it.
   *
   * Returns null when the clipboard cannot be read at all — Safari and Firefox
   * gate `readText()` behind a permission that a plain button press does not
   * always satisfy, so the caller needs to distinguish "nothing there" from
   * "not allowed to look", and offer a paste-into-a-field fallback for the
   * second.
   */
  const addFromClipboard = useCallback(async () => {
    let text: string
    try {
      text = await navigator.clipboard.readText()
    } catch {
      return null
    }
    const { addresses } = parsePastedAddresses(text)
    if (addresses.length === 0) return { ...IDLE, total: 0 }
    return addFromAddresses(addresses)
  }, [addFromAddresses])

  const resetProgress = useCallback(() => setProgress(IDLE), [])

  return {
    addSuggestion,
    addFromAddresses,
    addFromImportedRows,
    addFromClipboard,
    cancel,
    progress,
    resetProgress,
  }
}

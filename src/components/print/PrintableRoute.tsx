import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import type { Route } from '../../types'
import { printModel } from '../../lib/printRoute'
import { formatShortDate } from '../../lib/routeGrouping'

/**
 * The whole round, rendered for paper, then printed.
 *
 * ── Why a portal to the body ──────────────────────────────────────────────
 *
 * `@media print` in index.css hides `#root` and shows this. That only works if
 * this is NOT inside `#root` — and it also sidesteps the transformed, clipped
 * sheet entirely. Rendering the table inside the app and trying to un-hide it
 * through several layers of `overflow: hidden` and a `translateY` is a fight
 * with no end.
 *
 * ── Why it mounts only to print ───────────────────────────────────────────
 *
 * 300 table rows are 300 table rows whether or not anyone is printing. The
 * component mounts, prints on the next frame, and the caller unmounts it — so
 * the cost is paid once, by the person who asked for it.
 */
export interface PrintableRouteProps {
  route: Route
  /** Called after the print dialog has been dismissed (or immediately, if blocked). */
  onDone: () => void
}

export function PrintableRoute({ route, onDone }: PrintableRouteProps) {
  useEffect(() => {
    // One frame, so the browser has laid the table out before it is asked to
    // paginate it. Printing in the same tick prints an empty page.
    const id = requestAnimationFrame(() => {
      try {
        window.print()
      } finally {
        onDone()
      }
    })
    return () => cancelAnimationFrame(id)
  }, [onDone])

  const model = printModel(route)

  return createPortal(
    <div data-print-root="" className="hidden print:block">
      <h1 style={{ fontSize: '18pt', margin: '0 0 2pt' }}>{model.routeName}</h1>
      <p style={{ fontSize: '10pt', margin: '0 0 10pt' }}>
        {formatShortDate(model.dateISO)} · {model.summary}
      </p>

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10pt' }}>
        <thead>
          <tr>
            <Th style={{ width: '3em' }}>#</Th>
            <Th style={{ width: '4em' }}>ID</Th>
            <Th>Address</Th>
            {/* An empty box to tick. A printed round gets worked on. */}
            <Th style={{ width: '2.5em', textAlign: 'center' }}>✓</Th>
          </tr>
        </thead>
        <tbody>
          {model.rows.map((row) => (
            <tr key={`${row.seq}-${row.stopId}`} style={{ breakInside: 'avoid' }}>
              <Td style={{ fontVariantNumeric: 'tabular-nums' }}>{row.seq}</Td>
              <Td style={{ fontWeight: 700 }}>{row.stopId}</Td>
              <Td>
                <div style={{ fontWeight: 600 }}>{row.title}</div>
                <div>{row.subtitle}</div>
                {row.detail && <div style={{ fontStyle: 'italic' }}>{row.detail}</div>}
              </Td>
              <Td style={{ textAlign: 'center', fontSize: '13pt' }}>{row.mark}</Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>,
    document.body,
  )
}

const CELL: React.CSSProperties = {
  borderBottom: '1px solid #999',
  padding: '4pt 4pt 4pt 0',
  textAlign: 'left',
  verticalAlign: 'top',
}

const Th = ({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) => (
  <th style={{ ...CELL, ...style }}>{children}</th>
)

const Td = ({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) => (
  <td style={{ ...CELL, ...style }}>{children}</td>
)

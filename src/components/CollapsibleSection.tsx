import type { ReactNode } from 'react'

interface Props {
  title: string
  /** Optional count/label chip shown next to the title. */
  badge?: ReactNode
  defaultOpen?: boolean
  children: ReactNode
}

/**
 * A collapsible sidebar section built on the native <details>/<summary>
 * disclosure widget — accessible and keyboard-operable (Enter/Space) with no
 * extra ARIA wiring, per the disclosure pattern. Used to keep the sidebar tidy.
 */
export function CollapsibleSection({
  title,
  badge,
  defaultOpen = false,
  children,
}: Props) {
  return (
    <details
      open={defaultOpen}
      className="group rounded-md border border-slate-200 bg-white"
    >
      <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-between gap-2 rounded-md px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 [&::-webkit-details-marker]:hidden">
        <span className="flex items-center gap-2">
          {title}
          {badge != null && (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
              {badge}
            </span>
          )}
        </span>
        <svg
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
          className="h-4 w-4 shrink-0 text-slate-400 transition-transform group-open:rotate-180"
        >
          <path
            fillRule="evenodd"
            d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
            clipRule="evenodd"
          />
        </svg>
      </summary>
      <div className="space-y-3 border-t border-slate-100 p-3">{children}</div>
    </details>
  )
}

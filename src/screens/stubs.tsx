import { Link } from 'wouter'
import type { ReactNode } from 'react'

/**
 * Shared chrome for the screens that don't exist yet.
 *
 * These are deliberately plain. M1 is infrastructure: the route table has to be
 * real and navigable so later milestones can fill screens in one at a time, but
 * inventing UI here would be guessing at designs that M4 will decide.
 */
export function StubScreen({
  title,
  milestone,
  children,
}: {
  title: string
  milestone: string
  children?: ReactNode
}) {
  return (
    <div className="flex h-[100dvh] flex-col bg-slate-50">
      <header className="flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-3">
        <Link
          href="/"
          className="inline-flex min-h-[44px] items-center rounded-md px-2 text-sm font-medium text-blue-600 hover:bg-blue-50"
        >
          ← Back
        </Link>
        <h1 className="text-sm font-semibold text-slate-800">{title}</h1>
      </header>

      <div className="flex flex-1 items-center justify-center p-6">
        <div className="max-w-sm space-y-3 text-center">
          <p className="text-sm text-slate-600">
            This screen arrives in <span className="font-semibold">{milestone}</span>.
          </p>
          {children}
        </div>
      </div>
    </div>
  )
}

import { Link, useLocation } from 'wouter'

/** Unknown hash path. Reachable via a stale or mistyped deep link. */
export function NotFoundScreen() {
  const [location] = useLocation()
  return (
    <div className="flex h-[100dvh] flex-col items-center justify-center gap-4 bg-slate-50 p-6 text-center">
      <div>
        <h1 className="text-sm font-semibold text-slate-800">Page not found</h1>
        <p className="mt-1 font-mono text-xs text-slate-500">{location}</p>
      </div>
      <Link
        href="/"
        className="inline-flex min-h-[44px] items-center rounded-md bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700"
      >
        Go to my route
      </Link>
    </div>
  )
}

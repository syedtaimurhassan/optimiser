import { useSolverStore } from '../store/solverStore'

/**
 * Which solver engine is running.
 *
 * ── Why show this at all ──────────────────────────────────────────────────
 *
 * Because M9 made it possible for two people to get measurably different
 * results from the same input on the same version of the app, and a difference
 * a user cannot see is a difference nobody can debug. When a driver says "it's
 * slower on my phone", the answer is either "yes, it's on Basic" or "no, that's
 * something else" — and this is what makes that a one-second question.
 *
 * ── Why it is this small ──────────────────────────────────────────────────
 *
 * It is a fact about the machinery, not about the route. It belongs in the
 * corner of a settings screen and in a status line during a solve, and nowhere
 * a driver looks while driving. `describeSelection` already says when a device
 * could have done better, so a degraded phone reads "Basic (device supports
 * Fast)" rather than a reassuring "Basic".
 */
export function EngineBadge({ className = '' }: { className?: string }) {
  const engine = useSolverStore((s) => s.engine)

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-500 ${className}`}
      title={`Solver engine: ${engine.id}`}
    >
      <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
      {engine.label}
    </span>
  )
}

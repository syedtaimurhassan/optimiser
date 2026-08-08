import type { Route } from '../../types'
import { useApplyChanges, type CommitModel } from '../../hooks/useApplyChanges'
import { Sheet } from '../ui'
import { ArrowRightIcon, ChevronRightIcon, CloseIcon, HelpIcon, RefreshIcon } from '../ui/icons'

/**
 * Apply changes — a choice between two models.
 *
 * ── Fourteen words carrying the entire trade-off ──────────────────────────
 *
 *   →  Update route       Reorder only changed stops
 *   ⟳  Reoptimise route   Reorder all stops for optimal efficiency
 *
 * They are not embellished, and that is deliberate. Every extra clause is one
 * more thing to read at a kerb, and the two consequences are already
 * completely stated: one moves what you changed, the other moves everything.
 * A driver who has sorted their van knows immediately which of those they can
 * afford.
 *
 * ── Why it is a sheet and not a dialog ───────────────────────────────────
 *
 * The two options are not "confirm / cancel" — they are two different things
 * the driver might legitimately want, and a dialog's grammar (a question, an
 * accept, a decline) would make one of them look like the refusal. A sheet of
 * two chevron rows says what it is: a fork.
 *
 * ── Nothing is destructive, so nothing is red ────────────────────────────
 *
 * Reoptimising rearranges a round the driver has physically sorted, which is
 * expensive but not destructive — it is exactly what they asked for, and it is
 * undone by reoptimising again. Red is reserved for destruction; spending it
 * here would spend it everywhere.
 */
export interface ApplyChangesSheetProps {
  open: boolean
  route: Route
  count: number
  onClose: () => void
  /** The commit landed. The caller leaves the review screen. */
  onDone: () => void
}

const MODELS: { model: CommitModel; title: string; consequence: string; icon: typeof ArrowRightIcon }[] =
  [
    {
      model: 'update',
      title: 'Update route',
      consequence: 'Reorder only changed stops',
      icon: ArrowRightIcon,
    },
    {
      model: 'reoptimise',
      title: 'Reoptimise route',
      consequence: 'Reorder all stops for optimal efficiency',
      icon: RefreshIcon,
    },
  ]

export function ApplyChangesSheet({ open, route, count, onClose, onDone }: ApplyChangesSheetProps) {
  const { running, error, apply } = useApplyChanges(route)

  return (
    <Sheet open={open} onClose={onClose} label={`Apply ${count} changes`} zIndex={2150}>
      <div className="pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        {/* Circled ?, the title, and an X. Three zones, and the title is
            centred by giving the two ends the same width rather than by
            absolute positioning — which breaks the moment it is translated. */}
        <header className="flex items-center gap-2 px-2 py-2">
          <button
            type="button"
            disabled
            aria-label="About applying changes (coming soon)"
            data-testid="apply-help"
            className="flex h-touch w-touch shrink-0 items-center justify-center rounded-pill text-on-surface-variant disabled:opacity-40"
          >
            <HelpIcon className="h-6 w-6" />
          </button>
          <h2 className="min-w-0 flex-1 truncate text-center text-title font-semibold text-on-surface">
            Apply changes ({count})
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            data-testid="apply-close"
            className="flex h-touch w-touch shrink-0 items-center justify-center rounded-pill text-on-surface-variant active:bg-surface-variant"
          >
            <CloseIcon className="h-6 w-6" />
          </button>
        </header>

        <div className="px-3">
          {MODELS.map(({ model, title, consequence, icon: Icon }) => (
            <button
              key={model}
              type="button"
              disabled={running !== null}
              onClick={() => {
                void apply(model).then((ok) => {
                  if (ok) onDone()
                })
              }}
              data-testid={`apply-${model}`}
              className="flex min-h-touch w-full items-center gap-4 rounded-row px-3 py-3 text-left disabled:opacity-40 active:bg-surface-variant"
            >
              <Icon className="h-6 w-6 shrink-0 text-on-surface-variant" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-row font-semibold text-on-surface">
                  {running === model ? 'Working…' : title}
                </span>
                <span className="block truncate text-body text-on-surface-variant">
                  {consequence}
                </span>
              </span>
              <ChevronRightIcon className="h-5 w-5 shrink-0 text-on-surface-variant" />
            </button>
          ))}
        </div>

        {/*
          A failed reoptimise leaves the change set exactly where it was, so
          the driver can try again or fall back to Update. Saying so is the
          difference between "try again" and "did that work?".
        */}
        {error && (
          <p
            data-testid="apply-error"
            className="mx-4 mt-2 rounded-row bg-danger-container px-3 py-2 text-body text-on-danger-container"
          >
            {error} Your {count === 1 ? 'change is' : 'changes are'} still here.
          </p>
        )}
      </div>
    </Sheet>
  )
}

import type { ReactNode } from 'react'
import type { ContextualFab } from '../../lib/map/camera'
import { CrosshairIcon, FitRouteIcon, LayersIcon, PinIcon } from '../ui/icons'

/**
 * The floating action buttons, bottom-right.
 *
 * ── Why the top one never changes ─────────────────────────────────────────
 *
 * The basemap toggle is always the top button. A control whose position is
 * constant becomes muscle memory; one that shuffles has to be read every
 * time. So the stack is deliberately half fixed and half contextual, and the
 * fixed half is on top where the thumb lands least often — the contextual
 * button is the one you reach for mid-round.
 *
 * ── Why the second one does change ────────────────────────────────────────
 *
 * Because the question differs by state. On an empty route you want to know
 * where YOU are. Looking at a whole route you want it framed. With a stop
 * selected you want to get back to it after panning off. One button that
 * answers the question you actually have beats three that mostly don't.
 */

const CONTEXTUAL: Record<ContextualFab, { icon: typeof PinIcon; label: string }> = {
  'my-location': { icon: CrosshairIcon, label: 'Show my location' },
  'fit-route': { icon: FitRouteIcon, label: 'Fit route to screen' },
  'focus-stop': { icon: PinIcon, label: 'Back to selected stop' },
}

export interface FabStackProps {
  contextual: ContextualFab
  basemapLabel: string
  onToggleBasemap: () => void
  onContextual: () => void
  /** Rendered above the stack — the Calculate FAB slots in here. */
  children?: ReactNode
}

export function FabStack({
  contextual,
  basemapLabel,
  onToggleBasemap,
  onContextual,
  children,
}: FabStackProps) {
  const { icon: ContextIcon, label } = CONTEXTUAL[contextual]

  return (
    // 12dp gap, per the spec. `items-end` so a wider child (the Calculate
    // FAB is a pill, not a circle) stays flush with the circular buttons.
    <div className="pointer-events-none absolute bottom-3 right-3 z-20 flex flex-col items-end gap-3">
      <Fab onClick={onToggleBasemap} label={`Basemap: ${basemapLabel}`} testId="fab-basemap">
        <LayersIcon className="h-6 w-6" />
      </Fab>
      <Fab onClick={onContextual} label={label} testId="fab-contextual" data-fab={contextual}>
        <ContextIcon className="h-6 w-6" />
      </Fab>
      {children}
    </div>
  )
}

function Fab({
  onClick,
  label,
  testId,
  children,
  ...rest
}: {
  onClick: () => void
  label: string
  testId: string
  children: ReactNode
} & Record<string, unknown>) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      data-testid={testId}
      {...rest}
      className="pointer-events-auto flex h-touch w-touch items-center justify-center rounded-pill border border-outline bg-surface text-on-surface shadow-md active:bg-surface-variant"
    >
      {children}
    </button>
  )
}

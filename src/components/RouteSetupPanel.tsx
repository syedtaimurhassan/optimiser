import { useRouteStore } from '../store/routeStore'
import { CollapsibleSection } from './CollapsibleSection'
import { CoordinateForm } from './CoordinateForm'
import { TargetKInput } from './TargetKInput'
import { ObjectiveToggle } from './ObjectiveToggle'
import { RouteModeToggle } from './RouteModeToggle'

/** Collapsible "Route options" section: fixed/open mode, start/end, K, and the
 *  Time/Distance objective — the configuration, tucked away to reduce clutter. */
export function RouteSetupPanel() {
  const routeMode = useRouteStore((s) => s.routeMode)

  return (
    <CollapsibleSection title="Route options">
      <RouteModeToggle />

      {routeMode === 'fixed' ? (
        <>
          <p className="text-xs text-slate-400">
            Type coordinates, pick a stop from the list, or use 📍 Map to click
            the point directly.
          </p>
          <CoordinateForm field="start" label="Start" accentClass="bg-emerald-600" />
          <CoordinateForm field="end" label="End" accentClass="bg-rose-600" />
        </>
      ) : (
        <p className="rounded-md border border-slate-200 bg-slate-50 p-2 text-xs text-slate-500">
          Open route — the optimizer chooses the best start and end among your
          stops. Just add stops and hit Calculate.
        </p>
      )}

      <TargetKInput />
      <ObjectiveToggle />
    </CollapsibleSection>
  )
}

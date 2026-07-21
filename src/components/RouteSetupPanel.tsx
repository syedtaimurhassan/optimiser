import { CollapsibleSection } from './CollapsibleSection'
import { CoordinateForm } from './CoordinateForm'
import { TargetKInput } from './TargetKInput'
import { ObjectiveToggle } from './ObjectiveToggle'

/** Collapsible "Route options" section: start/end, K, and the Time/Distance
 *  objective — the configuration, tucked away to reduce clutter. */
export function RouteSetupPanel() {
  return (
    <CollapsibleSection title="Route options">
      <p className="text-xs text-slate-400">
        Start &amp; end are optional — leave blank for an open route, type
        coordinates, or pick a stop from the list.
      </p>
      <CoordinateForm field="start" label="Start" accentClass="bg-emerald-600" />
      <CoordinateForm field="end" label="End" accentClass="bg-rose-600" />
      <TargetKInput />
      <ObjectiveToggle />
    </CollapsibleSection>
  )
}

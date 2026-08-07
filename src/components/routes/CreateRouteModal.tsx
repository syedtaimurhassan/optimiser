import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'wouter'
import { useRoutesStore, todayISO } from '../../store/routesStore'
import { useUiStore } from '../../store/uiStore'
import { addDaysISO, formatDayLabel, weekdayName } from '../../lib/routeGrouping'
import { FullWidthButton, ListRow, Sheet } from '../ui'
import { CalendarIcon, ChevronRightIcon, CloseIcon } from '../ui/icons'

/**
 * Create a route — and, in edit mode, "Set name and date".
 *
 * One modal for both because they edit exactly the same two fields. A separate
 * edit screen would be this form with a different title and a second copy of
 * the date logic to keep in step with it.
 *
 * Dismissed with an "X", not a back arrow: it is a modal over the drawer, and
 * closing it returns you to the drawer you opened it from rather than
 * unwinding somewhere in history.
 */
export function CreateRouteModal() {
  const [, navigate] = useLocation()

  const target = useUiStore((s) => s.routeEditor)
  const closeRouteEditor = useUiStore((s) => s.closeRouteEditor)
  const setDrawerOpen = useUiStore((s) => s.setDrawerOpen)

  const createRoute = useRoutesStore((s) => s.createRoute)
  const updateRouteMeta = useRoutesStore((s) => s.updateRouteMeta)

  // The sheet stays mounted through its 220ms exit animation, so what it shows
  // has to outlive the state that opened it. Without this the title flips to
  // "Create route" and the quick-start section pops in while the modal is
  // still sliding away.
  const [visible, setVisible] = useState(target)
  useEffect(() => {
    if (target) setVisible(target)
  }, [target])

  const editing = useRoutesStore((s) =>
    visible?.mode === 'edit' ? (s.routes[visible.routeId] ?? null) : null,
  )

  const [today, setToday] = useState(todayISO)
  const [name, setName] = useState('')
  const [dateISO, setDateISO] = useState(today)
  const [carryOverPastStops, setCarryOverPastStops] = useState(false)

  const dateInputRef = useRef<HTMLInputElement>(null)

  // Re-read the day and reset the form every time the modal opens. This is a
  // long-lived PWA that people leave open overnight, so "today" captured at
  // mount is not necessarily today by the time the modal is used.
  //
  // The route is read imperatively rather than from the derived `editing`,
  // which is a render-time value and would still hold the previous target on
  // the render that opens the modal.
  useEffect(() => {
    if (!target) return
    const now = todayISO()
    const route = target.mode === 'edit' ? useRoutesStore.getState().routes[target.routeId] : null
    setToday(now)
    setName(route?.name ?? '')
    setDateISO(route?.dateISO ?? now)
    setCarryOverPastStops(false)
  }, [target])

  const tomorrow = addDaysISO(today, 1)
  const isCustomDate = dateISO !== today && dateISO !== tomorrow

  /**
   * Open the platform's own date picker.
   *
   * `showPicker()` is Chrome 99+, Firefox 101+, Safari and iOS Safari 16.0+,
   * and needs transient activation — which a click gives us. Older browsers
   * fall back to focusing the input, which shows the same native picker on
   * mobile; the input is rendered but visually hidden rather than
   * `display: none`, because a picker cannot be shown for an unrendered
   * element.
   */
  function openDatePicker() {
    const input = dateInputRef.current
    if (!input) return
    if (typeof input.showPicker === 'function') {
      try {
        input.showPicker()
        return
      } catch {
        // Not allowed here (no activation, or a cross-origin frame) — fall through.
      }
    }
    input.focus()
    input.click()
  }

  function confirm() {
    if (editing) {
      updateRouteMeta(editing.id, { name, dateISO })
      closeRouteEditor()
      return
    }
    // An empty name is not an error: the store names an unnamed route after
    // its weekday, which is the placeholder shown in the field.
    const id = createRoute({ name: name.trim() || undefined, dateISO })
    closeRouteEditor()
    setDrawerOpen(false)
    navigate(`/route/${id}`)
  }

  return (
    <Sheet
      open={target !== null}
      onClose={closeRouteEditor}
      side="full"
      label={editing ? 'Set name and date' : 'Create route'}
      zIndex={2100}
    >
      <header className="flex shrink-0 items-center gap-2 px-2 pt-[max(0.5rem,env(safe-area-inset-top))]">
        <button
          type="button"
          onClick={closeRouteEditor}
          aria-label="Close"
          className="flex h-touch w-touch items-center justify-center rounded-pill text-on-surface"
        >
          <CloseIcon className="h-6 w-6" />
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6">
        <h1 className="pb-5 pt-1 text-display font-bold text-on-surface">
          {editing ? 'Set name and date' : 'Create route'}
        </h1>

        <label className="block">
          <span className="text-label font-semibold text-on-surface-variant">
            Route name (optional)
          </span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            // The weekday of the SELECTED date, not of today: picking Tomorrow
            // shows "Thursday", which is the name that route will get.
            placeholder={weekdayName(dateISO)}
            className="mt-1 min-h-touch w-full rounded-row border border-outline bg-surface px-3 text-row text-on-surface placeholder:text-on-surface-variant"
          />
        </label>

        <h2 className="pb-2 pt-6 text-label font-semibold text-on-surface-variant">Select date</h2>

        <div role="radiogroup" aria-label="Select date" className="space-y-2">
          <DateOption
            relative="Today"
            absolute={formatDayLabel(today)}
            checked={dateISO === today}
            onSelect={() => setDateISO(today)}
          />
          <DateOption
            relative="Tomorrow"
            absolute={formatDayLabel(tomorrow)}
            checked={dateISO === tomorrow}
            onSelect={() => setDateISO(tomorrow)}
          />
          <ListRow
            outlined
            role="radio"
            checked={isCustomDate}
            onClick={openDatePicker}
            leading={<CalendarIcon className="h-5 w-5 text-on-surface-variant" />}
            title={
              <span className="flex items-baseline gap-2">
                <span>Pick a date</span>
                {/* An explicit space: the visual gap comes from `gap-2`, which
                    leaves no whitespace in textContent, so the accessible name
                    would otherwise be read as one run — "Pick a dateSat 08 Aug".
                    Whitespace-only text nodes between flex children are not
                    rendered, so this costs nothing visually. */}
                {isCustomDate && ' '}
                {isCustomDate && (
                  <span className="text-body font-normal text-on-surface-variant">
                    {formatDayLabel(dateISO)}
                  </span>
                )}
              </span>
            }
            selected={isCustomDate}
            trailing={<ChevronRightIcon className="h-5 w-5 text-on-surface-variant" />}
            className={isCustomDate ? 'border-primary' : ''}
          />
          {/* Rendered, but out of the way: showPicker() cannot open a picker
              for an element that isn't being rendered. */}
          <input
            ref={dateInputRef}
            type="date"
            aria-label="Pick a date"
            value={dateISO}
            onChange={(e) => {
              if (e.target.value) setDateISO(e.target.value)
            }}
            className="pointer-events-none absolute h-0 w-0 opacity-0"
            tabIndex={-1}
          />
        </div>

        {!editing && (
          <>
            <h2 className="pb-2 pt-6 text-label font-semibold text-on-surface-variant">
              Quick start options
            </h2>
            <ListRow
              outlined
              title="Pick past stops to carry over"
              onClick={() => setCarryOverPastStops((v) => !v)}
              trailing={
                <input
                  type="checkbox"
                  checked={carryOverPastStops}
                  onChange={(e) => setCarryOverPastStops(e.target.checked)}
                  aria-label="Pick past stops to carry over"
                  className="h-5 w-5 accent-primary"
                />
              }
            />
            {/*
              TODO(M6): actually carry the stops over. The checkbox is wired to
              state and deliberately does nothing yet — copying stops between
              routes needs M6's stop model, and a checkbox that silently did
              half the job would be worse than one that plainly does none of it.
            */}
          </>
        )}
      </div>

      <div className="shrink-0 border-t border-outline p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <FullWidthButton onClick={confirm}>Confirm</FullWidthButton>
      </div>
    </Sheet>
  )
}

/**
 * One date option: the relative word AND the absolute date, together.
 *
 * Both, because either alone fails someone: "Today" is unambiguous but tells
 * you nothing about what to write on a manifest, and "Wed 05 Aug" makes you
 * work out whether that is today.
 */
function DateOption({
  relative,
  absolute,
  checked,
  onSelect,
}: {
  relative: string
  absolute: string
  checked: boolean
  onSelect: () => void
}) {
  return (
    <ListRow
      outlined
      role="radio"
      checked={checked}
      onClick={onSelect}
      leading={<CalendarIcon className="h-5 w-5 text-on-surface-variant" />}
      title={
        <span className="flex items-baseline gap-2">
          <span>{relative}</span>{' '}
          <span className="text-body font-normal text-on-surface-variant">{absolute}</span>
        </span>
      }
      trailing={
        <span
          aria-hidden="true"
          className={`flex h-5 w-5 items-center justify-center rounded-pill border-2 ${
            checked ? 'border-primary' : 'border-outline'
          }`}
        >
          {checked && <span className="h-2.5 w-2.5 rounded-pill bg-primary" />}
        </span>
      }
      // The fill comes from `selected`, not from a background class here:
      // ListRow already emits one, and which of two competing utilities wins
      // is decided by Tailwind's stylesheet order, not by the order they are
      // written in.
      selected={checked}
      className={checked ? 'border-primary' : ''}
    />
  )
}

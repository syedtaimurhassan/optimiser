import { useEffect, useRef, useState } from 'react'
import { SERVICE_TIME_OPTIONS, clockToSeconds, secondsToClock } from '../../lib/stopSettings'
import { FullWidthButton, Sheet } from '../ui'

/**
 * The drill-downs behind the edit form's rows.
 *
 * Three sheets, one per shape of answer: free text, a duration from a short
 * list, and a time window. They share a stacking level above the edit form
 * itself, and none of them is a dialog — each is a question with a value, and
 * dismissing one keeps whatever was there before.
 *
 * ── Why a picklist for a duration and a field for a window ────────────────
 *
 * "How long at this stop" has four sensible answers and a driver picks one
 * with a thumb. "When can I arrive" is genuinely arbitrary — a two-hour window
 * starting at 09:15 is a normal thing for a customer to have asked for — so it
 * gets real inputs. Matching the control to the shape of the data is the whole
 * of the settings list's design.
 */

/** Above the edit form (2200), below nothing else. */
const PICKER_Z = 2300

export interface TextPickerProps {
  open: boolean
  title: string
  label: string
  placeholder?: string
  value: string
  multiline?: boolean
  onSave: (value: string) => void
  onClose: () => void
}

export function TextPicker({
  open,
  title,
  label,
  placeholder,
  value,
  multiline = false,
  onSave,
  onClose,
}: TextPickerProps) {
  const [draft, setDraft] = useState(value)
  const inputRef = useRef<HTMLTextAreaElement | HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setDraft(value)
      // The keyboard should already be up: this sheet exists only to type into.
      const id = setTimeout(() => inputRef.current?.focus(), 120)
      return () => clearTimeout(id)
    }
  }, [open, value])

  const field =
    'w-full rounded-row border border-outline bg-surface px-3 py-2.5 text-body text-on-surface outline-none placeholder:text-on-surface-variant focus:border-primary'

  return (
    <Sheet open={open} onClose={onClose} label={title} zIndex={PICKER_Z}>
      <div className="flex flex-col gap-3 p-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        <h2 className="text-title font-semibold text-on-surface">{title}</h2>
        {multiline ? (
          <textarea
            ref={inputRef as React.RefObject<HTMLTextAreaElement>}
            rows={3}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={placeholder}
            aria-label={label}
            data-testid="text-picker-input"
            className={`${field} resize-none`}
          />
        ) : (
          <input
            ref={inputRef as React.RefObject<HTMLInputElement>}
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={placeholder}
            aria-label={label}
            data-testid="text-picker-input"
            className={field}
          />
        )}
        <FullWidthButton testId="text-picker-save" onClick={() => onSave(draft.trim())}>
          Done
        </FullWidthButton>
      </div>
    </Sheet>
  )
}

export function DurationPicker({
  open,
  value,
  onSave,
  onClose,
}: {
  open: boolean
  value: number | undefined
  onSave: (seconds: number | undefined) => void
  onClose: () => void
}) {
  return (
    <Sheet open={open} onClose={onClose} label="Estimated time at stop" zIndex={PICKER_Z}>
      <div className="flex flex-col gap-1 p-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        <h2 className="mb-2 text-title font-semibold text-on-surface">Estimated time at stop</h2>
        <div role="radiogroup" aria-label="Estimated time at stop" className="flex flex-col">
          {SERVICE_TIME_OPTIONS.map((option) => {
            const selected = option.seconds === value
            return (
              <button
                key={option.label}
                type="button"
                role="radio"
                aria-checked={selected}
                data-testid={`duration-${option.seconds ?? 'default'}`}
                onClick={() => onSave(option.seconds)}
                className={`flex min-h-touch items-center rounded-row px-3 text-left text-row ${
                  selected
                    ? 'bg-primary-container font-semibold text-on-primary-container'
                    : 'text-on-surface active:bg-surface-variant'
                }`}
              >
                {option.label}
              </button>
            )
          })}
        </div>
      </div>
    </Sheet>
  )
}

export function TimeWindowPicker({
  open,
  openSec,
  closeSec,
  onSave,
  onClose,
}: {
  open: boolean
  openSec: number | undefined
  closeSec: number | undefined
  onSave: (openSec: number | undefined, closeSec: number | undefined) => void
  onClose: () => void
}) {
  const [from, setFrom] = useState(secondsToClock(openSec))
  const [to, setTo] = useState(secondsToClock(closeSec))

  useEffect(() => {
    if (open) {
      setFrom(secondsToClock(openSec))
      setTo(secondsToClock(closeSec))
    }
  }, [open, openSec, closeSec])

  const field =
    'w-full rounded-row border border-outline bg-surface px-3 py-2.5 text-row tabular-nums text-on-surface outline-none focus:border-primary'

  return (
    <Sheet open={open} onClose={onClose} label="Arrival time" zIndex={PICKER_Z}>
      <div className="flex flex-col gap-3 p-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        <h2 className="text-title font-semibold text-on-surface">Arrival time</h2>

        <div className="flex items-end gap-3">
          <label className="flex-1 text-label text-on-surface-variant">
            From
            <input
              type="time"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              data-testid="tw-from"
              className={`mt-1 ${field}`}
            />
          </label>
          <label className="flex-1 text-label text-on-surface-variant">
            To
            <input
              type="time"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              data-testid="tw-to"
              className={`mt-1 ${field}`}
            />
          </label>
        </div>

        <div className="flex items-center gap-2">
          {/*
            "Anytime" is the way OUT of a window, and it has to be as easy to
            reach as setting one. A window a driver cannot clear is a window
            that quietly constrains every future optimisation.
          */}
          <button
            type="button"
            onClick={() => onSave(undefined, undefined)}
            data-testid="tw-anytime"
            className="min-h-touch shrink-0 rounded-pill px-4 text-row font-semibold text-on-surface-variant active:bg-surface-variant"
          >
            Anytime
          </button>
          <FullWidthButton
            testId="tw-save"
            className="flex-1"
            onClick={() => onSave(clockToSeconds(from), clockToSeconds(to))}
          >
            Done
          </FullWidthButton>
        </div>
      </div>
    </Sheet>
  )
}

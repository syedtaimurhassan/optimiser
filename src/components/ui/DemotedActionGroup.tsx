import type { ReactNode } from 'react'

export interface DemotedAction {
  label: string
  icon?: ReactNode
  onSelect: () => void
  disabled?: boolean
  /** A trailing note — "Soon" on an announced but unavailable action. */
  hint?: string
  testId?: string
}

export interface DemotedActionGroupProps {
  /** The ordinary actions, in order. Ignored when `sections` is given. */
  actions?: DemotedAction[]
  /**
   * The same actions, grouped.
   *
   * Rendered as separate blocks with a gap between them rather than as one
   * block with heavier dividers, because the gap is the only separator that
   * survives being glanced at. Sections carry no headings: a menu that needs
   * its groups labelled has groups nobody can infer, which is a sign the
   * grouping is wrong rather than a sign it needs captions.
   */
  sections?: DemotedAction[][]
  /**
   * The destructive one. Required, and always rendered last, in red.
   *
   * Making it a separate required prop rather than "the last element of
   * `actions`, which you should remember to colour" is the whole point: the
   * invariant lives in the type, so a group cannot be built with the delete in
   * the middle, or with two red rows, or with a red row that isn't
   * destructive.
   */
  destructive: DemotedAction
  className?: string
}

/**
 * The grey block of secondary actions.
 *
 * Everything here is demoted — surface-variant, not white — because these are
 * the actions you reach for occasionally, presented below whatever the primary
 * action is. The last row is red and it destroys something. Nothing else in
 * this block is ever red.
 */
export function DemotedActionGroup({
  actions,
  sections,
  destructive,
  className = '',
}: DemotedActionGroupProps) {
  // Unsectioned, the destructive row is the last row of the ONE block — which
  // is what a three-item group on a stop card should look like. Sectioned, it
  // becomes a block of its own; see below.
  if (!sections) {
    const rows = actions ?? []
    return (
      <div className={`overflow-hidden rounded-row bg-surface-variant ${className}`}>
        {rows.map((action, i) => (
          <ActionButton key={action.label} action={action} divided={i > 0} />
        ))}
        <ActionButton action={destructive} divided={rows.length > 0} destructive />
      </div>
    )
  }

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      {sections
        .filter((block) => block.length > 0)
        .map((block) => (
          <div key={block[0].label} className="overflow-hidden rounded-row bg-surface-variant">
            {block.map((action, i) => (
              <ActionButton key={action.label} action={action} divided={i > 0} />
            ))}
          </div>
        ))}

      {/*
        Sectioned, the destructive row gets a block to itself.

        Spoke's route menu is nine flat items with the only destructive one
        rendered in the same black as the other eight — breaking the convention
        Spoke follows everywhere else in its own app. Separating it is not a
        style preference; it is the difference between "Remove stops…" reading
        as one of nine and reading as the one that cannot be undone.
      */}
      <div className="overflow-hidden rounded-row bg-surface-variant">
        <ActionButton action={destructive} divided={false} destructive />
      </div>
    </div>
  )
}

function ActionButton({
  action,
  divided,
  destructive = false,
}: {
  action: DemotedAction
  divided: boolean
  destructive?: boolean
}) {
  return (
    <button
      type="button"
      onClick={action.onSelect}
      disabled={action.disabled}
      data-testid={action.testId}
      className={`flex w-full min-h-touch items-center gap-3 px-4 py-3.5 text-left text-row font-medium disabled:opacity-40 ${
        divided ? 'border-t border-outline/60' : ''
      } ${destructive ? 'text-danger' : 'text-on-surface'}`}
    >
      {action.icon != null && <span className="flex h-5 w-5 items-center justify-center">{action.icon}</span>}
      <span className="min-w-0 flex-1 truncate">{action.label}</span>
      {action.hint && (
        <span className="shrink-0 text-label font-normal text-on-surface-variant">{action.hint}</span>
      )}
    </button>
  )
}

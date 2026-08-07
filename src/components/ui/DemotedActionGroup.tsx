import type { ReactNode } from 'react'

export interface DemotedAction {
  label: string
  icon?: ReactNode
  onSelect: () => void
  disabled?: boolean
}

export interface DemotedActionGroupProps {
  /** The ordinary actions, in order. */
  actions: DemotedAction[]
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
export function DemotedActionGroup({ actions, destructive, className = '' }: DemotedActionGroupProps) {
  return (
    <div className={`overflow-hidden rounded-row bg-surface-variant ${className}`}>
      {actions.map((action, i) => (
        <ActionButton key={action.label} action={action} divided={i > 0} />
      ))}
      <ActionButton action={destructive} divided={actions.length > 0} destructive />
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
      className={`flex w-full min-h-touch items-center gap-3 px-4 py-3.5 text-left text-row font-medium disabled:opacity-40 ${
        divided ? 'border-t border-outline/60' : ''
      } ${destructive ? 'text-danger' : 'text-on-surface'}`}
    >
      {action.icon != null && <span className="flex h-5 w-5 items-center justify-center">{action.icon}</span>}
      {action.label}
    </button>
  )
}

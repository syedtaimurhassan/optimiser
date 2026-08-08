import type { AddressedStop, StopGroup } from '../../types'
import { stopDetailModel, type DemotedActionId } from '../../lib/stopDetail'
import { describeFailure } from '../../lib/failureReasons'
import { ActionRow3Up, DemotedActionGroup, IdChip, ListRow, StatusPill } from '../ui'
import { GroupDot } from '../ui/GroupDot'
import {
  ChevronRightIcon,
  CloseIcon,
  DuplicateIcon,
  NavigateIcon,
  NoteIcon,
  ParcelCheckIcon,
  ParcelCrossIcon,
  PencilIcon,
  PinIcon,
  TrashIcon,
} from '../ui/icons'
import { CompletionCard } from './CompletionCard'

/**
 * One page of the carousel: everything about one stop.
 *
 * The shape of this card is decided by `lib/stopDetail.ts`, not here. This
 * component knows how a row looks; that module knows which actions are
 * prominent, and it is the one with the tests. See its header for the rule.
 */
export interface StopDetailCardProps {
  stop: AddressedStop
  position: number
  total: number
  groups: StopGroup[]
  /** Predicted arrival, epoch ms, or null when the route has no arrivals. */
  etaMs: number | null
  onClose: () => void
  onNavigate: () => void
  onSetStatus: (status: 'delivered' | 'failed') => void
  onUndo: () => void
  /** Open the reason sheet again — only ever offered on a failure. */
  onAddReason: () => void
  onEdit: () => void
  onDuplicate: () => void
  onRemove: () => void
}

export function StopDetailCard({
  stop,
  position,
  total,
  groups,
  etaMs,
  onClose,
  onNavigate,
  onSetStatus,
  onUndo,
  onAddReason,
  onEdit,
  onDuplicate,
  onRemove,
}: StopDetailCardProps) {
  const model = stopDetailModel({ stop, position, total, groups, etaMs })

  const demotedActions: Record<DemotedActionId, { label: string; icon: React.ReactNode; onSelect: () => void }> = {
    edit: { label: 'Edit stop', icon: <PencilIcon className="h-5 w-5" />, onSelect: onEdit },
    navigate: { label: 'Navigate', icon: <NavigateIcon className="h-5 w-5" />, onSelect: onNavigate },
    duplicate: {
      label: 'Duplicate stop',
      icon: <DuplicateIcon className="h-5 w-5" />,
      onSelect: onDuplicate,
    },
  }

  return (
    <div
      className="px-4 pb-6 pt-1"
      data-testid="stop-detail"
      data-stop-id={stop.id}
      data-status={stop.status}
    >
      <div className="flex items-start gap-3">
        {/*
          28sp, and allowed two lines. A round has addresses like "Rundgården
          34, st. th. Jette Kelbjørn" — truncating the title to one line loses
          the recipient, which is the part that says which door.
        */}
        <h2 className="min-w-0 flex-1 text-display font-bold leading-tight text-on-surface">
          {model.title}
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close stop"
          data-testid="close-stop"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-pill bg-surface-variant text-on-surface-variant active:bg-outline"
        >
          <CloseIcon className="h-5 w-5" />
        </button>
      </div>

      {/* Position, then the ETA — in that order, because "where am I in the
          round" is the question a driver asks before "when do I get there". */}
      <div className="mt-2 flex flex-wrap items-center gap-2" data-testid="status-line">
        {model.statusLine.pill && <StatusPill status={model.statusLine.pill.status} />}
        <span className="flex items-center gap-1.5 text-body text-on-surface-variant">
          <GroupDot color={model.statusLine.color} />
          <span className="tabular-nums" data-testid="stop-counter">
            {model.statusLine.counter}
            {model.statusLine.eta && `, ${model.statusLine.eta}`}
          </span>
        </span>
      </div>

      <div className="mt-4">
        {model.primary.kind === 'actions' ? (
          <ActionRow3Up
            size="tall"
            actions={[
              {
                label: 'Navigate',
                icon: <NavigateIcon className="h-6 w-6" />,
                variant: 'filled',
                onSelect: onNavigate,
                testId: 'action-navigate',
              },
              {
                label: 'Failed',
                icon: <ParcelCrossIcon className="h-6 w-6" />,
                variant: 'outlined',
                onSelect: () => onSetStatus('failed'),
                testId: 'action-failed',
              },
              {
                label: 'Delivered',
                icon: <ParcelCheckIcon className="h-6 w-6" />,
                variant: 'outlined',
                onSelect: () => onSetStatus('delivered'),
                testId: 'action-delivered',
              },
            ]}
          />
        ) : (
          <CompletionCard
            status={model.primary.status}
            label={model.primary.label}
            at={model.primary.at}
            reason={describeFailure(stop)}
            onAddReason={model.primary.status === 'failed' ? onAddReason : undefined}
            onUndo={onUndo}
          />
        )}
      </div>

      {/* Everything below recedes once the stop is finished with. */}
      <div className={`mt-2 ${model.done ? 'opacity-60' : ''}`}>
        <ListRow
          leading={<NoteIcon className="h-5 w-5 text-on-surface-variant" />}
          title={
            model.notes ?? (
              <span className="font-normal text-on-surface-variant">Add notes</span>
            )
          }
          trailing={<ChevronRightIcon className="h-5 w-5 text-on-surface-variant" />}
          onClick={onEdit}
          className="rounded-row"
        />
        <ListRow
          leading={<PinIcon className="h-5 w-5 text-on-surface-variant" />}
          title={model.area}
          trailing={<ChevronRightIcon className="h-5 w-5 text-on-surface-variant" />}
          onClick={onEdit}
          className="rounded-row"
        />
        <ListRow
          leading={<IdChip stopId={stop.stopId} color={model.statusLine.color} variant="pastel" />}
          title={model.idLine}
          trailing={<ChevronRightIcon className="h-5 w-5 text-on-surface-variant" />}
          onClick={onEdit}
          className="rounded-row"
        />
      </div>

      <DemotedActionGroup
        className="mt-2"
        actions={model.demoted.map((id) => demotedActions[id])}
        destructive={{
          label: 'Remove stop',
          icon: <TrashIcon className="h-5 w-5" />,
          onSelect: onRemove,
        }}
      />
    </div>
  )
}

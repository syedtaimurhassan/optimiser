/**
 * The design-system primitives.
 *
 * M3 builds these; M4–M8 assemble screens from them. If a later milestone
 * needs a new visual treatment, it belongs here first and in the screen
 * second — the point of this folder is that "what a row looks like" is
 * answered in exactly one place.
 */
export { Sheet, GrabHandle, type SheetProps } from './Sheet'
export { ListRow, type ListRowProps } from './ListRow'
export { Chip, type ChipProps, type ChipTone } from './Chip'
export { StatusPill } from './StatusPill'
export { StatusBadge } from './StatusBadge'
export { IdChip, type IdChipProps, type GroupColor } from './IdChip'
export { SegmentedControl, type SegmentedControlProps, type SegmentedOption } from './SegmentedControl'
export { Stepper, type StepperProps } from './Stepper'
export {
  DemotedActionGroup,
  type DemotedAction,
  type DemotedActionGroupProps,
} from './DemotedActionGroup'
export { FullWidthButton, type ButtonVariant, type FullWidthButtonProps } from './FullWidthButton'
export { ActionRow3Up, type QuickAction } from './ActionRow3Up'
export { ConfirmDialog, type ConfirmDialogProps } from './ConfirmDialog'
export { useScrollLock } from './useScrollLock'

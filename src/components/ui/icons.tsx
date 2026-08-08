import type { SVGProps } from 'react'

/**
 * The icon set, inline.
 *
 * Deliberately hand-rolled rather than a dependency: the whole app needs a
 * couple of dozen glyphs, and an icon package would ship hundreds. They all inherit
 * `currentColor` and a 1.75 stroke so an icon picks up the colour of whatever
 * row or button contains it — which is what keeps the semantic colour rule
 * (red = failure, green = success) working without every caller restating it.
 *
 * `public/icons.svg` is unrelated template leftovers and is not used here.
 */

type IconProps = SVGProps<SVGSVGElement>

function Icon({ children, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  )
}

export const HelpIcon = (props: IconProps) => (
  <Icon {...props}>
    <circle cx="12" cy="12" r="9" />
    <path d="M9.6 9.2a2.5 2.5 0 1 1 3.3 2.4c-.6.2-.9.8-.9 1.4v.4" />
    <path d="M12 17h.01" />
  </Icon>
)

export const SettingsIcon = (props: IconProps) => (
  <Icon {...props}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 14.5a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5v.2a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H2a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H8a1.6 1.6 0 0 0 1-1.5V2a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V8a1.6 1.6 0 0 0 1.5 1h.2a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z" />
  </Icon>
)

export const MenuIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M4 7h16M4 12h16M4 17h16" />
  </Icon>
)

export const PlusIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M12 5v14M5 12h14" />
  </Icon>
)

export const CloseIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M6 6l12 12M18 6L6 18" />
  </Icon>
)

export const MoreIcon = (props: IconProps) => (
  <Icon {...props}>
    <circle cx="12" cy="5" r="1.4" fill="currentColor" stroke="none" />
    <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
    <circle cx="12" cy="19" r="1.4" fill="currentColor" stroke="none" />
  </Icon>
)

export const CalendarIcon = (props: IconProps) => (
  <Icon {...props}>
    <rect x="3.5" y="5" width="17" height="16" rx="2.5" />
    <path d="M3.5 10h17M8 3v4M16 3v4" />
  </Icon>
)

export const ChevronRightIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M9 5l7 7-7 7" />
  </Icon>
)

export const CheckIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M5 12.5l4.5 4.5L19 7" />
  </Icon>
)

export const PencilIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17v3z" />
  </Icon>
)

export const DuplicateIcon = (props: IconProps) => (
  <Icon {...props}>
    <rect x="9" y="9" width="11" height="11" rx="2" />
    <path d="M15 5.5A2.5 2.5 0 0 0 12.5 3H6a3 3 0 0 0-3 3v6.5A2.5 2.5 0 0 0 5.5 15" />
  </Icon>
)

export const TrashIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M4 7h16M10 4h4M6 7l1 13h10l1-13M10 11v6M14 11v6" />
  </Icon>
)

export const ChevronLeftIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M15 5l-7 7 7 7" />
  </Icon>
)

// ─────────────────────────────────────────────────────────── map chrome

/** Basemap switch. Always the top FAB, so it is worth being unmistakable. */
export const LayersIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M12 3.5 3 8l9 4.5L21 8z" />
    <path d="M3 12.5 12 17l9-4.5" />
    <path d="M3 17 12 21.5 21 17" />
  </Icon>
)

/** "Where am I" — the contextual FAB on a route with nothing planned yet. */
export const CrosshairIcon = (props: IconProps) => (
  <Icon {...props}>
    <circle cx="12" cy="12" r="6.5" />
    <circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" />
    <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
  </Icon>
)

/** A folded map — "frame the whole route". */
export const FitRouteIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M9 4.5 3.5 6.8v12.7L9 17.2l6 2.3 5.5-2.3V4.5L15 6.8z" />
    <path d="M9 4.5v12.7M15 6.8v12.7" />
  </Icon>
)

/** A map pin — "take me back to the stop I selected". */
export const PinIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M12 21.5c4.2-4.6 6.3-8 6.3-10.5a6.3 6.3 0 1 0-12.6 0c0 2.5 2.1 5.9 6.3 10.5z" />
    <circle cx="12" cy="10.8" r="2.4" />
  </Icon>
)

/** Finish time. A plain flag, distinct from the map's checkered end marker. */
export const FlagIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M6 21V4" />
    <path d="M6 4.5h11.5l-2.2 4 2.2 4H6z" />
  </Icon>
)

// ──────────────────────────────────────────────── the sheet and its list

export const SearchIcon = (props: IconProps) => (
  <Icon {...props}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="M15.8 15.8 20.5 20.5" />
  </Icon>
)

export const ChevronDownIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M5 9l7 7 7-7" />
  </Icon>
)

/** "Share live route" — a node linked to two others. */
export const ShareIcon = (props: IconProps) => (
  <Icon {...props}>
    <circle cx="18" cy="5.5" r="2.5" />
    <circle cx="6" cy="12" r="2.5" />
    <circle cx="18" cy="18.5" r="2.5" />
    <path d="M8.2 10.8 15.8 6.7M8.2 13.2l7.6 4.1" />
  </Icon>
)

/** "Load vehicle" — a van, seen from the side. */
export const TruckIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M2.5 6.5h10v9h-10zM12.5 9.5h4l3 3v3h-7z" />
    <circle cx="6.5" cy="17.5" r="1.8" />
    <circle cx="16.5" cy="17.5" r="1.8" />
  </Icon>
)

/** The break row. A cup, because a break is a break. */
export const CoffeeIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M4 8h13v6a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z" />
    <path d="M17 9.5h1.5a2.5 2.5 0 0 1 0 5H17" />
    <path d="M7.5 2.5v2M11 2.5v2" />
  </Icon>
)

/** The start row's trailing control: use home as the start location. */
export const HouseIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M3.5 10.5 12 3.5l8.5 7" />
    <path d="M5.5 9.8V20h13V9.8" />
    <path d="M10 20v-5.5h4V20" />
  </Icon>
)

/** A stop's free-text note — a sheet with writing on it. */
export const NoteIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M5.5 3.5h9L18.5 7.5v13h-13z" />
    <path d="M14 3.5v4.5h4.5M8.5 12h7M8.5 15.5h7" />
  </Icon>
)

/** The "First" tag: a stop pinned to an end of the route. */
export const PinnedOrderIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M4 8.5h16M4 15.5h16" />
  </Icon>
)

/** The "Pickup" tag: this stop loads the van rather than emptying it. */
export const PickupIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M12 19.5V5M12 5l-5 5M12 5l5 5" />
  </Icon>
)

// ───────────────────────────────────────────────────────── M6: search & add

/**
 * A pin with a plus — "add this as a stop".
 *
 * Distinct from `PinIcon` by the plus in the head rather than the usual dot,
 * so the add-a-new-stop rows in search cannot be mistaken for the existing
 * stops directly above them. That distinction is the only thing separating the
 * two sections at a glance once the driver is scrolling.
 */
export const PinPlusIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M12 21.5c4.2-4.6 6.3-8 6.3-10.5a6.3 6.3 0 1 0-12.6 0c0 2.5 2.1 5.9 6.3 10.5z" />
    <path d="M12 8.4v4.8" />
    <path d="M9.6 10.8h4.8" />
  </Icon>
)

/** The empty-state glyph: the same pin-plus, drawn dashed. */
export const PinPlusDashedIcon = (props: IconProps) => (
  <Icon {...props}>
    <path
      d="M12 21.5c4.2-4.6 6.3-8 6.3-10.5a6.3 6.3 0 1 0-12.6 0c0 2.5 2.1 5.9 6.3 10.5z"
      strokeDasharray="3 3"
    />
    <path d="M12 8.4v4.8" />
    <path d="M9.6 10.8h4.8" />
  </Icon>
)

/** Barcode scan. M13 — the tile is present and announced as unavailable. */
export const ScanIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M4 8V6a2 2 0 0 1 2-2h2" />
    <path d="M16 4h2a2 2 0 0 1 2 2v2" />
    <path d="M20 16v2a2 2 0 0 1-2 2h-2" />
    <path d="M8 20H6a2 2 0 0 1-2-2v-2" />
    <path d="M4 12h16" />
  </Icon>
)

/** Voice entry. M13, as above. */
export const MicIcon = (props: IconProps) => (
  <Icon {...props}>
    <rect x="9" y="3" width="6" height="11" rx="3" />
    <path d="M5 11a7 7 0 0 0 14 0" />
    <path d="M12 18v3" />
  </Icon>
)

/** Paste addresses from the clipboard. */
export const ClipboardIcon = (props: IconProps) => (
  <Icon {...props}>
    <rect x="5" y="4" width="14" height="17" rx="2" />
    <path d="M9 4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1H9z" />
    <path d="M9 11h6" />
    <path d="M9 15h4" />
  </Icon>
)

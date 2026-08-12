import { useDeviceStore } from '../../store/deviceStore'
import { useRoutesStore } from '../../store/routesStore'
import { useInstallPrompt } from '../../pwa/useInstallPrompt'
import { installRoute, shouldOfferInstall } from '../../lib/pwa/install'
import { InstallCard } from './InstallCard'

/**
 * The install invitation, and the decision about whether to show it at all.
 *
 * Split from `InstallCard` so the policy — which is tested in
 * lib/pwa/install.ts — is in one place and the card stays a dumb renderer that
 * Settings can mount unconditionally.
 *
 * ── Where it appears, and why not somewhere louder ────────────────────────
 *
 * The routes drawer, below the list. A driver opens the drawer deliberately,
 * to manage rounds rather than to work one, so an invitation there interrupts
 * nothing. The working sheet and the map were both rejected: those are in use
 * with a parcel in hand, and anything that appears over them is competing with
 * the job.
 *
 * It also only appears once there is a round with stops in it — see
 * `shouldOfferInstall`. Before that, installing protects nothing and the card
 * would be asking for a commitment before the app has done anything.
 */
export function InstallInvitation() {
  const platform = useDeviceStore((s) => s.capabilities.platform)
  const standalone = useDeviceStore((s) => s.capabilities.standalone)
  const dismissedAt = useRoutesStore((s) => s.installDismissedAt)
  const dismissInstall = useRoutesStore((s) => s.dismissInstall)
  const hasDataWorthKeeping = useRoutesStore((s) =>
    Object.values(s.routes).some((r) => r.stops.length > 0),
  )
  const { canPrompt } = useInstallPrompt()

  const offer = shouldOfferInstall({
    route: installRoute({ platform, standalone, hasPrompt: canPrompt }),
    dismissedAt,
    hasDataWorthKeeping,
  })

  if (!offer) return null

  return (
    <div className="px-3 pb-2 pt-4">
      <InstallCard context="invitation" onDismiss={dismissInstall} />
    </div>
  )
}

import { useState } from 'react'
import { useDeviceStore } from '../../store/deviceStore'
import { useInstallPrompt } from '../../pwa/useInstallPrompt'
import { IOS_INSTALL_STEPS, installPitch, installRoute } from '../../lib/pwa/install'
import { FullWidthButton } from '../ui'

/**
 * The invitation to install, and the iOS instructions that stand in for one.
 *
 * Two contexts, one component, because they say the same thing and the only
 * differences are whether it can be dismissed and what an already-installed
 * app should see:
 *
 *   invitation — beside a loaded round, dismissible, hidden once dismissed.
 *   settings   — always reachable, never dismissible, and honest about the
 *                state when there is nothing to do.
 *
 * The caller decides WHETHER to render the invitation (see
 * `shouldOfferInstall`); this decides what it says.
 */
export function InstallCard({
  context,
  onDismiss,
}: {
  context: 'invitation' | 'settings'
  onDismiss?: () => void
}) {
  const platform = useDeviceStore((s) => s.capabilities.platform)
  const standalone = useDeviceStore((s) => s.capabilities.standalone)
  const { canPrompt, promptToInstall } = useInstallPrompt()
  const [busy, setBusy] = useState(false)

  const route = installRoute({ platform, standalone, hasPrompt: canPrompt })

  // Settings tells the truth when there is nothing to offer. The invitation
  // simply does not appear — a card saying "already installed" is noise on a
  // screen the driver came to for their round.
  if (route === 'none') {
    if (context !== 'settings') return null
    return (
      <div className="rounded-row border border-outline px-3 py-3" data-testid="install-card">
        <p className="text-label font-semibold text-on-surface">
          {standalone ? 'Installed' : 'Install'}
        </p>
        <p className="mt-1 text-meta text-on-surface-variant">
          {standalone
            ? 'Running as an installed app. Your routes are stored on this device.'
            : 'This browser has not offered an install. Opening the app in Chrome or Safari on a phone will.'}
        </p>
      </div>
    )
  }

  const { title, body } = installPitch(platform)

  return (
    <div
      className="rounded-row border border-outline bg-surface px-3 py-3"
      data-testid="install-card"
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-label font-semibold text-on-surface">{title}</p>
          <p className="mt-1 text-meta text-on-surface-variant">{body}</p>
        </div>
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Not now"
            data-testid="install-dismiss"
            className="min-h-touch w-8 shrink-0 text-row text-on-surface-variant"
          >
            ×
          </button>
        )}
      </div>

      {route === 'prompt' ? (
        <div className="mt-3">
          <FullWidthButton
            testId="install-button"
            disabled={busy}
            onClick={() => {
              setBusy(true)
              // The outcome needs no handling: accepting fires `appinstalled`
              // and declining drops the single-use event, and both are already
              // reflected by `canPrompt` going false.
              void promptToInstall().finally(() => setBusy(false))
            }}
          >
            Install
          </FullWidthButton>
        </div>
      ) : (
        /*
          iOS has no install API — nothing to call, nothing to await. A button
          here would be a lie, so these are the actual menu steps. They are
          numbered because the second one is below the fold of Safari's share
          sheet and is the step everybody misses.
        */
        <ol
          className="mt-3 space-y-1.5 text-meta text-on-surface-variant"
          data-testid="ios-install-steps"
        >
          {IOS_INSTALL_STEPS.map((step, i) => (
            <li key={step} className="flex gap-2">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-surface-variant text-meta font-semibold text-on-surface">
                {i + 1}
              </span>
              <span className="pt-0.5">{step}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}

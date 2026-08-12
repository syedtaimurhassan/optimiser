import { StubScreen } from './stubs'
import { DiagnosticsPanel } from '../components/DiagnosticsPanel'
import { NavAppSheet } from '../components/nav/NavAppSheet'
import { InstallCard } from '../components/pwa/InstallCard'
import { StorageSection } from '../components/settings/StorageSection'
import { useRoutesStore } from '../store/routesStore'
import { NAV_APP_LABEL } from '../lib/googleMaps'
import { useState } from 'react'

/**
 * Settings — units, navigation app preference, objective defaults. Arrives in M4.
 *
 * The diagnostics panel lives here in dev builds so it is reachable on a real
 * phone (#/settings) without needing a console attached.
 *
 * M13 adds the two switches that have nowhere else to live: which app a
 * Navigate tap opens, and whether text recognition is on. The second is off by
 * default and the row says why — see lib/ocr/engine.ts for the arithmetic.
 *
 * M14 adds storage and installation. Both are here rather than in the
 * diagnostics panel because they are the two things a driver can actually DO
 * something about — ask for their data to be protected, drop 40 MB of optional
 * downloads, or install the app so the browser is willing to protect it in the
 * first place. The install card is deliberately reachable from here forever,
 * so a dismissal on the routes list is a "not now" rather than a decision the
 * driver can never revisit.
 */
export function SettingsScreen() {
  const navApp = useRoutesStore((s) => s.navApp)
  const ocrEnabled = useRoutesStore((s) => s.ocrEnabled)
  const setOcrEnabled = useRoutesStore((s) => s.setOcrEnabled)
  const [navPickerOpen, setNavPickerOpen] = useState(false)

  return (
    <StubScreen title="Settings" milestone="M4">
      <div className="w-full space-y-2 text-left">
        <button
          type="button"
          onClick={() => setNavPickerOpen(true)}
          data-testid="settings-nav-app"
          className="flex min-h-touch w-full items-center justify-between rounded-row border border-outline px-3 text-left"
        >
          <span className="text-label font-semibold text-on-surface">Navigation app</span>
          <span className="text-label text-on-surface-variant">
            {navApp ? NAV_APP_LABEL[navApp] : 'Not set'}
          </span>
        </button>

        <label className="flex min-h-touch w-full items-center justify-between gap-3 rounded-row border border-outline px-3">
          <span className="min-w-0">
            <span className="block text-label font-semibold text-on-surface">
              Scan text from photos
            </span>
            <span className="block text-meta text-on-surface-variant">
              Experimental. Without a GPU this takes several seconds per image.
            </span>
          </span>
          <input
            type="checkbox"
            checked={ocrEnabled}
            onChange={(e) => setOcrEnabled(e.target.checked)}
            data-testid="settings-ocr"
            className="h-5 w-5 shrink-0"
          />
        </label>
      </div>

      <div className="mt-4 w-full space-y-4 text-left">
        <StorageSection />

        <section className="space-y-2">
          <h2 className="px-1 text-label font-semibold text-on-surface-variant">App</h2>
          <InstallCard context="settings" />
        </section>
      </div>

      <NavAppSheet open={navPickerOpen} onClose={() => setNavPickerOpen(false)} />

      {import.meta.env.DEV && <DiagnosticsPanel />}
    </StubScreen>
  )
}

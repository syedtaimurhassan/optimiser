import { StubScreen } from './stubs'
import { DiagnosticsPanel } from '../components/DiagnosticsPanel'

/**
 * Settings — units, navigation app preference, objective defaults. Arrives in M4.
 *
 * The diagnostics panel lives here in dev builds so it is reachable on a real
 * phone (#/settings) without needing a console attached.
 */
export function SettingsScreen() {
  return (
    <StubScreen title="Settings" milestone="M4">
      {import.meta.env.DEV && <DiagnosticsPanel />}
    </StubScreen>
  )
}

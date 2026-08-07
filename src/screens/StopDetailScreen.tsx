import { useParams } from 'wouter'
import { StubScreen } from './stubs'

/**
 * Stop detail — address, notes, photos, proof of delivery. Arrives in M6.
 *
 * Deep-linkable by design: the route is /route/:routeId/stop/:stopId, so a stop
 * can be shared or reopened directly. Wired up now so M6 inherits working
 * navigation rather than having to introduce it.
 */
export function StopDetailScreen() {
  const params = useParams<{ routeId: string; stopId: string }>()
  return (
    <StubScreen title="Stop detail" milestone="M6">
      <p className="font-mono text-xs text-slate-400">
        route: {params.routeId}
        <br />
        stop: {params.stopId}
      </p>
    </StubScreen>
  )
}

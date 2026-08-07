/**
 * Until M2 introduces the multi-route data model there is exactly one implicit
 * session. It needs a stable, URL-safe id so the route table can be real and
 * deep links can be exercised now rather than being retrofitted later.
 *
 * M2 replaces this with real route ids from IndexedDB.
 */
export const CURRENT_ROUTE_ID = 'current'

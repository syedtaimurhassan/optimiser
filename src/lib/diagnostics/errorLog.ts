/**
 * In-memory ring of recently captured errors.
 *
 * Framework-free on purpose: error boundaries are React, but the record of what
 * failed is not, and a logging sink added later shouldn't have to import a
 * component to read it.
 *
 * Deliberately NOT persisted. A crash loop that writes to IndexedDB on every
 * iteration is a worse problem than the crash.
 */

export interface CapturedError {
  /** Which boundary caught it, e.g. 'root' or 'map'. */
  boundary: string
  message: string
  stack?: string
  componentStack?: string
  at: string
  url: string
  userAgent: string
}

const MAX_RETAINED = 10
const recent: CapturedError[] = []

export function recordError(error: CapturedError): void {
  recent.unshift(error)
  if (recent.length > MAX_RETAINED) recent.length = MAX_RETAINED
}

export function getRecentErrors(): readonly CapturedError[] {
  return recent
}

/** Build a capture record from a raw error plus its React component stack. */
export function captureError(
  boundary: string,
  error: unknown,
  componentStack?: string,
): CapturedError {
  const err = error instanceof Error ? error : undefined
  return {
    boundary,
    message: err?.message ?? String(error),
    stack: err?.stack,
    componentStack,
    at: new Date().toISOString(),
    url: typeof location !== 'undefined' ? location.href : '',
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
  }
}

/** Plain-text diagnostics blob for the clipboard. */
export function formatErrorReport(error: CapturedError): string {
  return [
    'Route Optimiser error report',
    `boundary:  ${error.boundary}`,
    `when:      ${error.at}`,
    `url:       ${error.url}`,
    `ua:        ${error.userAgent}`,
    '',
    `message:   ${error.message}`,
    '',
    'stack:',
    error.stack ?? '(none)',
    '',
    'component stack:',
    error.componentStack ?? '(none)',
  ].join('\n')
}

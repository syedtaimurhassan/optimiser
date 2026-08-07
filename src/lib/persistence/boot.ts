import { migrateLegacyIfNeeded, recordMigrationOutcome, type MigrationOutcome } from './migrate'

/**
 * Boot ordering, and why it matters.
 *
 * The migration copies the legacy state blob into IndexedDB. Zustand's `persist`
 * reads that same blob on rehydration. If rehydration wins the race, it reads
 * nothing, the user sees an empty app, and the first write then overwrites the
 * migrated blob with empty state — losing the session for real.
 *
 * So: migration completes FIRST, then rehydration is allowed to start. This
 * module owns that ordering as a single promise every consumer awaits.
 */

let bootPromise: Promise<MigrationOutcome> | null = null
let outcome: MigrationOutcome | null = null

/** Idempotent. Every caller awaits the same run. */
export function bootPersistence(): Promise<MigrationOutcome> {
  if (!bootPromise) {
    bootPromise = (async () => {
      const result = await migrateLegacyIfNeeded()
      outcome = result
      void recordMigrationOutcome(result)
      return result
    })().catch((e) => {
      // migrateLegacyIfNeeded already swallows its own failures; this is the
      // belt-and-braces path for anything truly unexpected. Boot must not fail.
      const failure: MigrationOutcome = {
        status: 'failed',
        error: e instanceof Error ? e.message : String(e),
        backupKept: true,
      }
      outcome = failure
      return failure
    })
  }
  return bootPromise
}

/** The outcome, once known — for the diagnostics panel. */
export function getMigrationOutcome(): MigrationOutcome | null {
  return outcome
}

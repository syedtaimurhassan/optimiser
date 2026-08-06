/**
 * The objective, defined ONCE for every engine.
 *
 * This file is the referee. Engines are free to disagree about how they search;
 * they are not free to disagree about what a solution is worth. Any future
 * engine (TypeScript, Rust/WASM, a hosted solver) is scored by this function and
 * this function only — an engine's own self-reported cost is never trusted.
 *
 * Mirrors `objectiveOf` in src/lib/solver.ts:
 *   traversal cost along the visited sequence
 *   + SKIP_PENALTY for every candidate left unvisited.
 */

/** Must stay in sync with SKIP_PENALTY in src/lib/solver.ts. */
export const SKIP_PENALTY = 10_000_000

/** Must stay in sync with UNREACHABLE_COST in src/lib/routingService.ts. */
export const UNREACHABLE_COST = 9_999_999

export function objectiveOf(visited, matrix, n, skipPenalty = SKIP_PENALTY) {
  if (!visited || visited.length === 0) return Infinity
  let sum = 0
  for (let i = 0; i < visited.length - 1; i++) {
    sum += matrix[visited[i]][visited[i + 1]]
  }
  return sum + skipPenalty * (n - visited.length)
}

/**
 * Structural validation, run before a result is allowed to be scored. A fast
 * wrong answer is not a win, so every engine's output is checked for: in-range
 * indices, no repeats, the fixed endpoints in their required positions, and the
 * K cap respected.
 */
export function validate(visited, { n, startNode, endNode, k }) {
  const problems = []
  if (!Array.isArray(visited)) return ['result is not an array']
  if (visited.length === 0) problems.push('empty route')

  const seen = new Set()
  for (const idx of visited) {
    if (!Number.isInteger(idx) || idx < 0 || idx >= n) problems.push(`node index out of range: ${idx}`)
    if (seen.has(idx)) problems.push(`node visited twice: ${idx}`)
    seen.add(idx)
  }

  if (startNode !== null && visited[0] !== startNode) {
    problems.push(`fixed start ${startNode} is not first (got ${visited[0]})`)
  }
  if (endNode !== null && visited[visited.length - 1] !== endNode) {
    problems.push(`fixed end ${endNode} is not last (got ${visited[visited.length - 1]})`)
  }

  const fixedCount = (startNode !== null ? 1 : 0) + (endNode !== null ? 1 : 0)
  const candidatesVisited = visited.length - fixedCount
  if (candidatesVisited > k) {
    problems.push(`K cap exceeded: visited ${candidatesVisited} candidates, cap is ${k}`)
  }

  return problems
}

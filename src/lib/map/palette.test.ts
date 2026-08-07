import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { GROUP_COLORS, MAP_COLORS, normalizeHex } from './palette.ts'

/**
 * The map draws on a canvas, so it needs hex strings rather than Tailwind
 * classes — which means the design tokens exist twice, once in index.css and
 * once in palette.ts. This test is the thing that makes that safe: change one
 * without the other and it fails by name.
 */

const CSS = readFileSync(fileURLToPath(new URL('../../index.css', import.meta.url)), 'utf8')

/** Pull `--color-foo: #abcdef;` out of the @theme block. */
function token(name: string): string | null {
  const match = CSS.match(new RegExp(`--${name}\\s*:\\s*([^;]+);`))
  return match ? normalizeHex(match[1]) : null
}

describe('palette.ts matches the index.css design tokens', () => {
  for (const [name, hex] of Object.entries(GROUP_COLORS)) {
    test(`--color-group-${name}`, () => {
      assert.equal(token(`color-group-${name}`), hex)
    })
  }

  const MAPPED: Record<string, string> = {
    surface: MAP_COLORS.surface,
    'surface-variant': MAP_COLORS.surfaceVariant,
    'on-surface': MAP_COLORS.onSurface,
    'on-surface-variant': MAP_COLORS.onSurfaceVariant,
    outline: MAP_COLORS.outline,
    'on-primary': MAP_COLORS.onPrimary,
    danger: MAP_COLORS.danger,
    success: MAP_COLORS.success,
  }

  for (const [cssName, hex] of Object.entries(MAPPED)) {
    test(`--color-${cssName}`, () => {
      assert.equal(token(`color-${cssName}`), hex)
    })
  }

  test('the tokens it reads actually exist (guards against a silent rename)', () => {
    assert.notEqual(token('color-group-blue'), null)
    assert.notEqual(token('color-danger'), null)
  })
})

describe('normalizeHex', () => {
  test('accepts both hex forms and lowercases', () => {
    assert.equal(normalizeHex('#ABCDEF'), '#abcdef')
    assert.equal(normalizeHex('  #abc  '), '#abc')
  })

  test('rejects anything a canvas would silently mishandle', () => {
    for (const bad of ['', 'red', 'rgb(0,0,0)', '#12', '#abcd', 'abcdef', null, undefined]) {
      assert.equal(normalizeHex(bad), null, `should reject ${JSON.stringify(bad)}`)
    }
  })
})

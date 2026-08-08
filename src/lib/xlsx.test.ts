import assert from 'node:assert/strict'
import { test, describe } from 'node:test'

import { columnIndex, decodeXmlText, parseSharedStrings, parseSheet } from './xlsx.ts'

describe('decodeXmlText', () => {
  test('decodes the named entities', () => {
    assert.equal(decodeXmlText('R&amp;D &lt;x&gt; &quot;q&quot;'), 'R&D <x> "q"')
  })

  test('decodes numeric and hex references — how Excel writes non-ASCII', () => {
    assert.equal(decodeXmlText('L&#248;vfr&#248;vej'), 'Løvfrøvej')
    assert.equal(decodeXmlText('Bagsv&#xE6;rd'), 'Bagsværd')
  })

  test('leaves an unknown entity alone rather than mangling it', () => {
    assert.equal(decodeXmlText('a &nope; b'), 'a &nope; b')
  })
})

describe('columnIndex', () => {
  test('single and multi-letter columns', () => {
    assert.equal(columnIndex('A1'), 0)
    assert.equal(columnIndex('Z9'), 25)
    assert.equal(columnIndex('AA1'), 26)
    assert.equal(columnIndex('BC12'), 54)
  })
})

describe('parseSharedStrings', () => {
  test('reads one string per <si>', () => {
    const xml = '<sst><si><t>address</t></si><si><t>Løvfrøvej 6</t></si></sst>'
    assert.deepEqual(parseSharedStrings(xml), ['address', 'Løvfrøvej 6'])
  })

  test('concatenates rich-text runs, so bolding half a value does not truncate it', () => {
    const xml = '<sst><si><r><t>Løvfrøvej </t></r><r><t>6</t></r></si></sst>'
    assert.deepEqual(parseSharedStrings(xml), ['Løvfrøvej 6'])
  })
})

describe('parseSheet', () => {
  const shared = ['address', 'city', 'Løvfrøvej 6', 'Bagsværd', 'Nybrovej 12']

  test('uses the first row as headers and reads shared strings', () => {
    const xml = `<worksheet><sheetData>
      <row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c></row>
      <row r="2"><c r="A2" t="s"><v>2</v></c><c r="B2" t="s"><v>3</v></c></row>
    </sheetData></worksheet>`
    assert.deepEqual(parseSheet(xml, shared), [{ address: 'Løvfrøvej 6', city: 'Bagsværd' }])
  })

  test('a missing cell does NOT shift the columns right of it', () => {
    // B2 is absent entirely — the spreadsheet omits blanks. Counting <c>
    // elements would put "Bagsværd" into the address column.
    const xml = `<worksheet><sheetData>
      <row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c></row>
      <row r="2"><c r="B2" t="s"><v>3</v></c></row>
    </sheetData></worksheet>`
    assert.deepEqual(parseSheet(xml, shared), [{ city: 'Bagsværd' }])
  })

  test('reads inline strings as well as shared ones', () => {
    const xml = `<worksheet><sheetData>
      <row r="1"><c r="A1" t="inlineStr"><is><t>address</t></is></c></row>
      <row r="2"><c r="A2" t="inlineStr"><is><t>Nybrovej 12</t></is></c></row>
    </sheetData></worksheet>`
    assert.deepEqual(parseSheet(xml, shared), [{ address: 'Nybrovej 12' }])
  })

  test('reads numeric cells, which is how coordinates arrive', () => {
    const xml = `<worksheet><sheetData>
      <row r="1"><c r="A1" t="inlineStr"><is><t>lat</t></is></c><c r="B1" t="inlineStr"><is><t>lng</t></is></c></row>
      <row r="2"><c r="A2"><v>55.747</v></c><c r="B2"><v>12.453</v></c></row>
    </sheetData></worksheet>`
    assert.deepEqual(parseSheet(xml, shared), [{ lat: '55.747', lng: '12.453' }])
  })

  test('reads a formula cell\'s cached value', () => {
    const xml = `<worksheet><sheetData>
      <row r="1"><c r="A1" t="inlineStr"><is><t>address</t></is></c></row>
      <row r="2"><c r="A2"><f>CONCAT(B2,C2)</f><v>Løvfrøvej 6</v></c></row>
    </sheetData></worksheet>`
    assert.deepEqual(parseSheet(xml, shared), [{ address: 'Løvfrøvej 6' }])
  })

  test('drops entirely empty rows', () => {
    const xml = `<worksheet><sheetData>
      <row r="1"><c r="A1" t="s"><v>0</v></c></row>
      <row r="2"></row>
      <row r="3"><c r="A3" t="s"><v>4</v></c></row>
    </sheetData></worksheet>`
    assert.deepEqual(parseSheet(xml, shared), [{ address: 'Nybrovej 12' }])
  })

  test('an empty sheet is empty, not an error', () => {
    assert.deepEqual(parseSheet('<worksheet><sheetData></sheetData></worksheet>', []), [])
  })

  test('an unnamed header column still gets a usable key', () => {
    const xml = `<worksheet><sheetData>
      <row r="1"><c r="A1" t="inlineStr"><is><t></t></is></c></row>
      <row r="2"><c r="A2" t="inlineStr"><is><t>x</t></is></c></row>
    </sheetData></worksheet>`
    assert.deepEqual(parseSheet(xml, []), [{ column1: 'x' }])
  })
})

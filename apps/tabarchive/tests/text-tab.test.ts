import { describe, expect, it } from 'vitest'
import { parseTextTab, wrapTabSystem } from '../src/lib/text-tab'

describe('mobile text tab wrapping', () => {
  const rows = ['e', 'B', 'G', 'D', 'A', 'E'].map(
    (string, index) =>
      `${string}|-----${index + 10}h12-----/14-----|------0------2-------|`,
  )
  it('keeps every original column in the same position across six strings', () => {
    const systems = wrapTabSystem(rows, 19)
    expect(systems.length).toBeGreaterThan(1)
    for (let row = 0; row < 6; row++)
      expect(systems.map((system) => system[row].slice(2)).join('')).toBe(
        rows[row].slice(2),
      )
    for (const system of systems.slice(0, -1))
      expect(new Set(system.map((row) => row.length)).size).toBe(1)
  })
  it('never cuts through multi-digit frets or technique markers', () => {
    for (const columns of [10, 13, 19, 24, 35]) {
      for (const system of wrapTabSystem(rows, columns).slice(0, -1))
        for (const row of system) expect(row.at(-1)).toMatch(/[-|\s:]/)
    }
  })
  it('recognizes systems without treating prose or incomplete tabs as six-string notation', () => {
    const result = parseTextTab(
      '[Original exercise]\n' + rows.join('\n') + '\nA practice note',
    )
    expect(result.map((block) => block.type)).toEqual(['text', 'tab', 'text'])
    expect(parseTextTab(rows.slice(0, 5).join('\n'))[0].type).toBe('text')
  })
})

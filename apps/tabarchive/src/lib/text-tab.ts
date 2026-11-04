export type TextBlock =
  { type: 'text'; text: string } | { type: 'tab'; rows: string[] }
const stringRow = /^(\s*[eEbBgGdDaA]\|)(.*)$/

export function parseTextTab(text: string): TextBlock[] {
  const lines = text.replace(/\r\n?/g, '\n').split('\n')
  const blocks: TextBlock[] = []
  let prose: string[] = []
  for (let index = 0; index < lines.length;) {
    const candidate = lines.slice(index, index + 6)
    const matches = candidate.map((line) => line.match(stringRow))
    if (
      matches.length === 6 &&
      matches.every(Boolean) &&
      matches.map((match) => match![1].trim()[0].toLowerCase()).join('') ===
        'ebgdae'
    ) {
      if (prose.length) {
        blocks.push({ type: 'text', text: prose.join('\n') })
        prose = []
      }
      blocks.push({ type: 'tab', rows: candidate })
      index += 6
    } else {
      prose.push(lines[index])
      index++
    }
  }
  if (prose.length) blocks.push({ type: 'text', text: prose.join('\n') })
  return blocks
}

// Reflow only at empty columns common to all strings. Never split a fret number
// or playing technique, and never infer rhythm from ASCII spacing.
export function wrapTabSystem(rows: string[], columns: number): string[][] {
  const parts = rows.map((row) => row.match(stringRow))
  if (!parts.every(Boolean)) return [rows]
  const prefixLength = Math.max(...parts.map((match) => match![1].length))
  const capacity = Math.max(8, Math.floor(columns) - prefixLength)
  const width = Math.max(...parts.map((match) => match![2].length))
  if (width <= capacity) return [rows]
  const empty = (character: string | undefined) =>
    character === undefined || /[-\s|:]/.test(character)
  const safe = (cut: number) =>
    parts.every((match) => empty(match![2][cut - 1]) && empty(match![2][cut]))
  const systems: string[][] = []
  for (let offset = 0; offset < width;) {
    let end = Math.min(width, offset + capacity)
    if (end < width) {
      while (end > offset + 4 && !safe(end)) end--
      if (!safe(end)) {
        end = offset + capacity
        while (end < width && !safe(end)) end++
      }
      // Prefer a shared measure boundary when one fits in the latter half.
      for (let bar = end; bar >= offset + capacity / 2; bar--) {
        if (parts.every((match) => match![2][bar - 1] === '|') && safe(bar)) {
          end = bar
          break
        }
      }
    }
    systems.push(parts.map((match) => match![1] + match![2].slice(offset, end)))
    offset = end
  }
  return systems
}

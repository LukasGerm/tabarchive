import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { exporter } from '@coderline/alphatab'
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import {
  createTab,
  getFile,
  getScoreDocument,
  saveScoreDocument,
} from '../src/server/storage'
import {
  editNote,
  noteAt,
  parseScore,
  positionOf,
  noteTechnique,
} from '../src/lib/score-model'

let directory: string
beforeEach(async () => {
  directory = await mkdtemp(path.join(os.tmpdir(), 'tabarchive-score-'))
  vi.stubEnv('ARCHIVE_DATA_DIR', directory)
})
afterEach(async () => {
  vi.unstubAllEnvs()
  await rm(directory, { recursive: true, force: true })
})

async function upload(
  content: string | Uint8Array,
  name: string,
  tuning = 'E A D G B E',
) {
  const form = new FormData()
  form.set('title', 'Original editable study')
  form.set('permission', 'confirmed')
  form.set('tuning', tuning)
  form.set(
    'file',
    new File(
      [typeof content === 'string' ? content : new Uint8Array(content)],
      name,
    ),
  )
  return createTab(form)
}

const original =
  '\\title "Original study"\n.\n:4 (0.6 2.5) 3.4 4.3 0.2 | :8 0.1 2.1 3.1 5.1 3.1 2.1 0.1 r'

describe('canonical editable scores', () => {
  it('imports Guitar Pro and MusicXML as alphaTex with notes and timing intact', async () => {
    const gp = new exporter.Gp7Exporter().export(parseScore(original))
    const tab = await upload(gp, 'original.gp')
    const document = await getScoreDocument(tab.id)
    expect(document.status).toBe('ready')
    const score = parseScore(document.alphaTex!)
    const beats = score.tracks[0].staves[0].bars[0].voices[0].beats
    expect(beats[0].notes.map((note) => note.fret)).toEqual([0, 2])
    expect(beats[0].duration).toBe(4)
    expect(score.tracks[0].staves[0].bars[1].voices[0].beats[0].duration).toBe(
      8,
    )
    expect(new Uint8Array((await getFile(tab.id)).bytes)).toEqual(gp)
    const xml = `<?xml version="1.0"?><score-partwise version="4.0"><part-list><score-part id="P1"><part-name>Guitar</part-name><score-instrument id="I1"><instrument-name>Guitar</instrument-name></score-instrument><midi-instrument id="I1"><midi-channel>1</midi-channel><midi-program>25</midi-program></midi-instrument></score-part></part-list><part id="P1"><measure number="1"><attributes><divisions>1</divisions><time><beats>4</beats><beat-type>4</beat-type></time><clef><sign>TAB</sign><line>5</line></clef><staff-details><staff-lines>6</staff-lines></staff-details></attributes><note><pitch><step>E</step><octave>4</octave></pitch><duration>4</duration><type>whole</type><notations><technical><string>1</string><fret>0</fret></technical></notations></note></measure></part></score-partwise>`
    const xmlTab = await upload(xml, 'original.musicxml')
    const xmlDoc = await getScoreDocument(xmlTab.id)
    expect(xmlDoc.status).toBe('ready')
    expect(
      parseScore(xmlDoc.alphaTex!).tracks[0].staves[0].bars[0].voices[0]
        .beats[0].duration,
    ).toBe(1)
  })

  it('transcribes ASCII frets and simultaneous notes but explicitly flags uncertain rhythm and techniques', async () => {
    const ascii = [
      'e|--12h14---0--|',
      'B|----------1--|',
      'G|-------------|',
      'D|-------------|',
      'A|-------------|',
      'E|--0----------|',
    ].join('\n')
    const tab = await upload(ascii, 'original.txt')
    const doc = await getScoreDocument(tab.id)
    expect(doc.status).toBe('draft')
    expect(doc.warnings.join(' ')).toMatch(/placeholder/)
    expect(doc.warnings.join(' ')).not.toMatch(/could not be transcribed/)
    const beats = parseScore(doc.alphaTex!).tracks[0].staves[0].bars[0]
      .voices[0].beats
    expect(
      beats.map((beat) => beat.notes.map((note) => [note.fret, note.string])),
    ).toEqual([
      [
        [12, 6],
        [0, 1],
      ],
      [[14, 6]],
      [
        [0, 6],
        [1, 5],
      ],
    ])
    expect((await getFile(tab.id)).bytes.toString()).toBe(ascii)
    expect(noteTechnique(beats[0].notes[0])).toBe('hammer-on')
    expect(beats[0].notes[0].hammerPullDestination).toBe(beats[1].notes[0])
  })

  it('preserves h/p chains, uppercase and spaced links, and links over barlines without guessing other symbols', async () => {
    const row = '--12h14p12--3-H-5-P-0--2h|4--5/7--3p5--'
    const ascii = ['e', 'B', 'G', 'D', 'A', 'E']
      .map((s, i) => `${s}|${i === 0 ? row : row.replace(/[^|]/g, '-')}|`)
      .join('\n')
    const tab = await upload(ascii, 'techniques.txt')
    const doc = await getScoreDocument(tab.id)
    const notes = parseScore(doc.alphaTex!).tracks[0].staves[0].bars.flatMap(
      (bar) => bar.voices[0].beats.flatMap((beat) => beat.notes),
    )
    expect(notes.map((note) => note.fret)).toEqual([
      12, 14, 12, 3, 5, 0, 2, 4, 5, 7, 3, 5,
    ])
    expect(notes.map(noteTechnique)).toEqual([
      'hammer-on',
      'pull-off',
      'none',
      'hammer-on',
      'pull-off',
      'none',
      'hammer-on',
      'none',
      'none',
      'none',
      'none',
      'none',
    ])
    expect(doc.warnings.join(' ')).toContain('could not be transcribed')
  })

  it('adds and removes techniques from the starting note and validates the destination', () => {
    const source = '. :8 (3.2 0.6) 0.1 | 5.2 2.2 0.3'
    const position = positionOf(
      parseScore(source).tracks[0].staves[0].bars[0].voices[0].beats[0]
        .notes[0],
    )
    const changes = { fret: 3, duration: 8, dots: 0 }
    const withHammer = editNote(source, position, {
      ...changes,
      technique: 'hammer-on',
    })
    expect(noteTechnique(noteAt(parseScore(withHammer), position)!)).toBe(
      'hammer-on',
    )
    expect(
      noteAt(parseScore(withHammer), position)!.beat.notes[1]
        .isHammerPullOrigin,
    ).toBe(false)
    expect(
      noteTechnique(
        noteAt(
          parseScore(
            editNote(withHammer, position, { ...changes, technique: 'none' }),
          ),
          position,
        )!,
      ),
    ).toBe('none')
    expect(() =>
      editNote(source, position, { ...changes, technique: 'pull-off' }),
    ).toThrow('lower next fret')
    expect(
      noteTechnique(
        noteAt(
          parseScore(
            editNote(source, position, {
              ...changes,
              fret: 7,
              technique: 'pull-off',
            }),
          ),
          position,
        )!,
      ),
    ).toBe('pull-off')
    expect(() =>
      editNote(
        '. :8 3.2 0.1',
        { ...position, note: 0 },
        { ...changes, technique: 'hammer-on' },
      ),
    ).toThrow('following fretted note')
    expect(() =>
      editNote('. :8 3.2 3.2', position, {
        ...changes,
        technique: 'hammer-on',
      }),
    ).toThrow('higher next fret')
  })

  it('upgrades untouched text drafts once, preserves their previous revision, and never overwrites edited drafts', async () => {
    const text = [
      'e|--3h5p3--|',
      ...['B', 'G', 'D', 'A', 'E'].map((s) => `${s}|---------|`),
    ].join('\n')
    const tab = await upload(text, 'legacy.txt')
    const initial = await getScoreDocument(tab.id)
    const legacy = {
      ...initial,
      textConversionVersion: undefined,
      alphaTex: initial.alphaTex!.replace(/\{\s*h\s*\}/g, ''),
    }
    await writeFile(
      path.join(directory, tab.id, 'score.json'),
      JSON.stringify(legacy),
    )
    const [upgraded, concurrent] = await Promise.all([
      getScoreDocument(tab.id),
      getScoreDocument(tab.id),
    ])
    expect(upgraded).toEqual(concurrent)
    expect(upgraded).toMatchObject({ revision: 2, textConversionVersion: 2 })
    expect(upgraded.alphaTex).toBe(initial.alphaTex)
    expect(
      JSON.parse(
        await readFile(
          path.join(directory, tab.id, 'revisions/1.json'),
          'utf8',
        ),
      ),
    ).toEqual(JSON.parse(JSON.stringify(legacy)))
    expect((await getFile(tab.id)).bytes.toString()).toBe(text)
    const edited = { ...legacy, revision: 2, alphaTex: '. :8 7.1 9.1' }
    await writeFile(
      path.join(directory, tab.id, 'score.json'),
      JSON.stringify(edited),
    )
    expect(await getScoreDocument(tab.id)).toEqual(
      JSON.parse(JSON.stringify(edited)),
    )
  })

  it('leaves PDFs, unsupported tuning, malformed scores, and incomplete tabs awaiting transcription', async () => {
    for (const [content, filename, tuning] of [
      ['%PDF-1.7', 'original.pdf', undefined],
      ['e|--0--|', 'partial.txt', undefined],
      ['. invalid !!!', 'broken.alphatex', undefined],
      [
        ['e', 'B', 'G', 'D', 'A', 'E'].map((s) => `${s}|--0--|`).join('\n'),
        'drop-d.txt',
        'D A D G B E',
      ],
    ] as const) {
      const tab = await upload(content, filename, tuning)
      expect(await getScoreDocument(tab.id)).toMatchObject({
        alphaTex: null,
        status: 'needs-transcription',
      })
      expect((await getFile(tab.id)).bytes.toString()).toBe(content)
    }
  })

  it('edits the selected note and chord duration without changing other tracks', () => {
    const multi =
      '\\track "Guitar" . :4 (0.6 2.5) 3.4 | 4.3 0.2 \\track "Bass" \\tuning E2 A1 D1 G0 . :4 3.1 2.2 | 0.3 0.4'
    const score = parseScore(multi)
    const note = score.tracks[0].staves[0].bars[0].voices[0].beats[0].notes[0]
    const position = positionOf(note)
    const edited = parseScore(
      editNote(multi, position, { fret: 7, duration: 8, dots: 1 }),
    )
    expect(noteAt(edited, position)?.fret).toBe(7)
    expect(noteAt(edited, position)?.beat.duration).toBe(8)
    expect(noteAt(edited, position)?.beat.dots).toBe(1)
    expect(noteAt(edited, position)?.beat.notes[1].fret).toBe(2)
    expect(
      edited.tracks[1].staves[0].bars.map((b) =>
        b.voices[0].beats.map((beat) => [beat.duration, beat.notes[0].fret]),
      ),
    ).toEqual([
      [
        [4, 3],
        [4, 2],
      ],
      [
        [4, 0],
        [4, 0],
      ],
    ])
  })

  it('rejects invalid or stale edits, keeps previous revisions, and leaves the original unchanged', async () => {
    const tab = await upload(original, 'original.alphatex')
    const initial = await getScoreDocument(tab.id)
    await expect(
      saveScoreDocument(tab.id, {
        revision: 1,
        alphaTex: '. nonsense !!!',
        reviewed: true,
      }),
    ).rejects.toMatchObject({ status: 422 })
    expect(await getScoreDocument(tab.id)).toEqual(initial)
    const outcomes = await Promise.allSettled([
      saveScoreDocument(tab.id, {
        revision: 1,
        alphaTex: '. :4 7.6',
        reviewed: false,
      }),
      saveScoreDocument(tab.id, {
        revision: 1,
        alphaTex: '. :4 9.6',
        reviewed: true,
      }),
    ])
    expect(outcomes.filter((o) => o.status === 'fulfilled')).toHaveLength(1)
    expect(outcomes.find((o) => o.status === 'rejected')).toMatchObject({
      reason: { status: 409 },
    })
    expect(await getScoreDocument(tab.id)).toMatchObject({
      revision: 2,
      status: 'draft',
    })
    expect(
      JSON.parse(
        await readFile(
          path.join(directory, tab.id, 'revisions/1.json'),
          'utf8',
        ),
      ),
    ).toEqual(initial)
    expect((await getFile(tab.id)).bytes.toString()).toBe(original)
  })

  it('migrates existing archives lazily and safely under simultaneous readers', async () => {
    const tab = await upload(original, 'original.alphatex')
    await rm(path.join(directory, tab.id, 'score.json'))
    const documents = await Promise.all([
      getScoreDocument(tab.id),
      getScoreDocument(tab.id),
    ])
    expect(documents[0]).toEqual(documents[1])
    expect(documents[0]).toMatchObject({
      revision: 1,
      status: 'ready',
      alphaTex: original,
    })
  })
})

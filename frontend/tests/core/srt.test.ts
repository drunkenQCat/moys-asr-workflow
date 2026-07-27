// @vitest-environment node
import { describe, it, expect } from 'vitest'
import {
  formatTimestamp,
  parseTimestamp,
  segmentsToSrt,
  parseSrt,
  buildGapRemovedSrt,
} from '../../src/core/srt.js'
import type { Segment, GapRemoveGap } from '../../src/types/project.js'

describe('formatTimestamp', () => {
  it('formats zero', () => {
    expect(formatTimestamp(0)).toBe('00:00:00,000')
  })

  it('formats milliseconds only', () => {
    expect(formatTimestamp(500)).toBe('00:00:00,500')
  })

  it('formats seconds', () => {
    expect(formatTimestamp(12345)).toBe('00:00:12,345')
  })

  it('formats minutes', () => {
    expect(formatTimestamp(125000)).toBe('00:02:05,000')
  })

  it('formats hours', () => {
    expect(formatTimestamp(3661000)).toBe('01:01:01,000')
  })
})

describe('parseTimestamp', () => {
  it('parses standard SRT timecode', () => {
    expect(parseTimestamp('01:02:03,456')).toBe(3723456)
  })

  it('parses with dot separator', () => {
    expect(parseTimestamp('00:00:01.500')).toBe(1500)
  })

  it('returns null for invalid format', () => {
    expect(parseTimestamp('invalid')).toBeNull()
  })
})

describe('parseTimestamp <-> formatTimestamp roundtrip', () => {
  it('roundtrips correctly', () => {
    const original = 3723456
    const formatted = formatTimestamp(original)
    const parsed = parseTimestamp(formatted)
    expect(parsed).toBe(original)
  })
})

describe('segmentsToSrt', () => {
  const segments: Segment[] = [
    { start: 1000, end: 3000, text: 'Hello', items: [], sticker: null, sticker_ref: null, color: null, color_ref: null },
    { start: 3500, end: 6000, text: 'World', items: [], sticker: null, sticker_ref: null, color: null, color_ref: null },
  ]

  it('produces valid SRT output', () => {
    const result = segmentsToSrt(segments, { offsetToZero: false })
    expect(result).toContain('1')
    expect(result).toContain('00:00:01,000 --> 00:00:03,000')
    expect(result).toContain('Hello')
    expect(result).toContain('2')
    expect(result).toContain('World')
  })

  it('offsets to zero when enabled', () => {
    const result = segmentsToSrt(segments, { offsetToZero: true })
    expect(result).toContain('00:00:00,000 --> 00:00:02,000')
  })

  it('skips disabled segments', () => {
    const segs = [
      ...segments,
      { start: 7000, end: 9000, text: 'Skipped', disabled: true, items: [], sticker: null, sticker_ref: null, color: null, color_ref: null },
    ]
    const result = segmentsToSrt(segs, { offsetToZero: false })
    expect(result).not.toContain('Skipped')
    // Only 2 segments in output (1 and 2), no third
    const lines = result.trim().split('\n')
    const seqNumbers = lines.filter((l) => /^\d+$/.test(l.trim()))
    expect(seqNumbers).toEqual(['1', '2'])
  })
})

describe('parseSrt', () => {
  it('parses valid SRT content', () => {
    const srt = `1
00:00:01,000 --> 00:00:03,000
Hello

2
00:00:03,500 --> 00:00:06,000
World`
    const segments = parseSrt(srt)
    expect(segments.length).toBe(2)
    expect(segments[0].start).toBe(1000)
    expect(segments[0].end).toBe(3000)
    expect(segments[0].text).toBe('Hello')
    expect(segments[1].text).toBe('World')
  })

  it('returns empty array for empty input', () => {
    expect(parseSrt('')).toEqual([])
  })
})

describe('buildGapRemovedSrt', () => {
  const segments: Segment[] = [
    { start: 1000, end: 2000, text: 'First', items: [], sticker: null, sticker_ref: null, color: null, color_ref: null },
    { start: 5000, end: 6000, text: 'Second', items: [], sticker: null, sticker_ref: null, color: null, color_ref: null },
  ]
  const gaps: GapRemoveGap[] = [
    { start: 2000, end: 5000, removed: true },
  ]

  it('builds gap-removed SRT', () => {
    const result = buildGapRemovedSrt(segments, gaps, { offsetToZero: false })
    expect(result).toContain('First')
    expect(result).toContain('Second')
    // After removing gap, second starts at 2000 (gap removed between 2000-5000)
    // Original: 1000-2000, 5000-6000
    // Removed: 2000-5000 (3000ms removed)
    // Mapped: 1000-2000, 2000-3000
    expect(result).toContain('00:00:02,000 --> 00:00:03,000')
  })

  it('returns empty string when no gaps', () => {
    expect(buildGapRemovedSrt(segments, [])).toBe('')
  })
})
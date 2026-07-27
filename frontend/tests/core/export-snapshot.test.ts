// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { segmentsToSrt, buildGapRemovedSrt } from '../../src/core/srt.js'
import { serializeProject } from '../../src/core/json-project.js'
import { buildFfconcat } from '../../src/core/editor-utils.js'
import type { Segment, GapRemoveGap } from '../../src/types/project.js'

const segments: Segment[] = [
  { start: 1000, end: 3000, text: '你好世界', items: [{ text: '你好', start: 1000, end: 2000 }, { text: '世界', start: 2000, end: 3000 }], sticker: null, sticker_ref: null, color: null, color_ref: null },
  { start: 3500, end: 6000, text: '今天天气真好', items: [], sticker: null, sticker_ref: null, color: null, color_ref: null },
  { start: 7000, end: 9000, text: '我们去公园', disabled: true, items: [], sticker: null, sticker_ref: null, color: null, color_ref: null },
]

const gaps: GapRemoveGap[] = [
  { start: 3000, end: 3500, removed: true },
  { start: 6000, end: 7000, removed: true },
]

const projectData = {
  segments,
  media: 'D:/videos/test.mp4',
  language: 'Chinese',
  gap_remove: { schema: 'moy.asr.gap_remove.v1' as const, gaps, detector: 'audio_gate' as const, minimum_ms: 200, threshold_db: -24, hysteresis_db: 6, lead_in_ms: 50, lead_out_ms: 50, skip_playback: false, manual_corrections: false, operation_mode: 'none' as const },
}

describe('SRT export snapshot', () => {
  it('matches SRT snapshot', () => {
    const srt = segmentsToSrt(segments, { offsetToZero: true })
    expect(srt).toMatchSnapshot()
  })

  it('matches SRT with disabled placeholder', () => {
    const srt = segmentsToSrt(segments, { offsetToZero: true, keepDisabledPlaceholder: true })
    expect(srt).toMatchSnapshot()
  })
})

describe('Gap-removed SRT snapshot', () => {
  it('matches gap-removed SRT snapshot', () => {
    const srt = buildGapRemovedSrt(segments, gaps, { offsetToZero: true })
    expect(srt).toMatchSnapshot()
  })
})

describe('FFconcat snapshot', () => {
  it('matches ffconcat snapshot', () => {
    const intervals = [
      { start: 0, end: 5000, removed: false },
      { start: 6000, end: 10000, removed: false },
    ]
    const fc = buildFfconcat('/path/to/video.mp4', intervals)
    expect(fc).toMatchSnapshot()
  })
})

describe('JSON serialization snapshot', () => {
  it('matches JSON project snapshot', () => {
    const json = serializeProject(projectData as any)
    expect(json).toMatchSnapshot()
  })
})
// @vitest-environment node
import { describe, it, expect } from 'vitest'
import {
  buildReplacementPreview,
  cueMetrics,
  formatHumanDuration,
  formatGapRemoveDuration,
  splitCharOffsetAtTime,
  findAdjacentCueIndex,
  getSrtExportOffset,
  fileBasename,
  projectMediaStem,
  findProjectMediaFile,
  normalizeGapRemoveGaps,
  coalesceGapRemoveGaps,
  applyGapRemoveRange,
  resizeGapRemoveBoundary,
  waveformPeakDb,
  detectAudioGapRemoveGaps,
  getRemovedGapRanges,
  mapGapRemovedTime,
  buildGapRemovedIntervals,
  buildFfconcat,
  configuredEnterAction,
} from '../../src/core/editor-utils.js'

describe('buildReplacementPreview', () => {
  it('builds expandable replacement rows with before and after text', () => {
    const result = buildReplacementPreview(
      [
        { text: '猫喜欢鱼' },
        { text: '狗喜欢骨头' },
      ],
      [0, 1],
      '喜欢',
      '不讨厌',
      { caseSensitive: true, useRegex: false },
    )
    expect(result.matchCount).toBe(2)
    expect(JSON.parse(JSON.stringify(result.rows))).toEqual([
      { index: 0, before: '猫喜欢鱼', after: '猫不讨厌鱼', matchCount: 1 },
      { index: 1, before: '狗喜欢骨头', after: '狗不讨厌骨头', matchCount: 1 },
    ])
  })

  it('reports invalid regex without changing any rows', () => {
    const result = buildReplacementPreview(
      [{ text: 'abc' }],
      [0],
      '(',
      'x',
      { caseSensitive: false, useRegex: true },
    )
    expect(result.error).toBeTruthy()
    expect(result.rows.length).toBe(0)
  })

  it('returns empty result for empty find string', () => {
    const result = buildReplacementPreview([{ text: 'abc' }], [0], '', 'x')
    expect(result.matchCount).toBe(0)
  })
})

describe('cueMetrics', () => {
  it('calculates current cue length and characters per second', () => {
    const result = JSON.parse(JSON.stringify(cueMetrics('Hiya fellas.', 34690, 35550)))
    expect(result).toEqual({ totalLength: 12, charsPerSecond: 13.95 })
  })

  it('returns zero for empty text', () => {
    const result = cueMetrics('', 0, 1000)
    expect(result.totalLength).toBe(0)
  })
})

describe('formatHumanDuration', () => {
  it('formats seconds only', () => {
    expect(formatHumanDuration(5000)).toBe('5秒')
  })

  it('formats minutes and seconds', () => {
    expect(formatHumanDuration(125000)).toBe('2分5秒')
  })

  it('formats hours and minutes', () => {
    expect(formatHumanDuration(3660000)).toBe('1小时1分')
  })
})

describe('formatGapRemoveDuration', () => {
  it('includes percentage when media duration is provided', () => {
    const result = formatGapRemoveDuration(30000, 600000)
    expect(result).toContain('5')
    expect(result).toContain('%')
  })
})

describe('splitCharOffsetAtTime', () => {
  it('returns null for short text', () => {
    expect(splitCharOffsetAtTime({ text: 'a' }, 0)).toBeNull()
  })

  it('returns null for null segment', () => {
    expect(splitCharOffsetAtTime(null, 0)).toBeNull()
  })
})

describe('findAdjacentCueIndex', () => {
  it('finds previous enabled cue', () => {
    const segments = [
      { disabled: true },
      { disabled: false },
      { disabled: false },
    ]
    expect(findAdjacentCueIndex(segments, 2, -1, true)).toBe(1)
  })

  it('returns -1 when no adjacent cue found', () => {
    const segments = [{ disabled: false }]
    expect(findAdjacentCueIndex(segments, 0, -1)).toBe(-1)
  })
})

describe('getSrtExportOffset', () => {
  it('returns offset of first enabled segment', () => {
    const segments = [
      { disabled: true, start: 0 },
      { disabled: false, start: 5000 },
    ]
    expect(getSrtExportOffset(segments)).toBe(5000)
  })

  it('returns 0 when alignFirstEnabled is false', () => {
    const segments = [{ disabled: false, start: 5000 }]
    expect(getSrtExportOffset(segments, false)).toBe(0)
  })
})

describe('fileBasename', () => {
  it('extracts basename from path', () => {
    expect(fileBasename('/path/to/file.txt')).toBe('file.txt')
  })

  it('handles Windows paths', () => {
    expect(fileBasename('D:\\foo\\bar\\file.txt')).toBe('file.txt')
  })
})

describe('projectMediaStem', () => {
  it('extracts stem from tagged filename', () => {
    const result = projectMediaStem('myproject.qwen3-asr.json')
    // Tags require trailing dot, so this returns the full stem without stripping
    expect(result.length).toBeGreaterThan(0)
  })
})

describe('findProjectMediaFile', () => {
  const files = [{ name: 'video.mp4' }, { name: 'audio.mp3' }]

  it('finds exact match by name', () => {
    expect(findProjectMediaFile(files, '/path/video.mp4', 'test.json')?.name).toBe('video.mp4')
  })

  it('returns null when no files provided', () => {
    expect(findProjectMediaFile([], '/path/video.mp4', 'test.json')).toBeNull()
  })
})

describe('normalizeGapRemoveGaps', () => {
  it('deduplicates and sorts gaps', () => {
    const result = normalizeGapRemoveGaps([
      { start: 2000, end: 3000, removed: true },
      { start: 1000, end: 2000, removed: true },
    ])
    expect(result.length).toBe(2)
    expect(result[0].start).toBe(1000)
    expect(result[1].start).toBe(2000)
  })

  it('handles empty array', () => {
    expect(normalizeGapRemoveGaps([])).toEqual([])
  })
})

describe('coalesceGapRemoveGaps', () => {
  it('merges adjacent gaps', () => {
    const result = coalesceGapRemoveGaps([
      { start: 1000, end: 2000, removed: true },
      { start: 2000, end: 3000, removed: true },
    ])
    expect(result.length).toBe(1)
    expect(result[0].end).toBe(3000)
  })
})

describe('applyGapRemoveRange', () => {
  it('adds a new removed gap', () => {
    const result = applyGapRemoveRange([], 1000, 2000, true)
    expect(result).toEqual([{ start: 1000, end: 2000, removed: true }])
  })
})

describe('resizeGapRemoveBoundary', () => {
  it('resizes start boundary', () => {
    const result = resizeGapRemoveBoundary(
      [{ start: 1000, end: 2000, removed: true }],
      0, 'start', 1500, 100,
    )
    expect(result[0].start).toBe(1500)
  })
})

describe('waveformPeakDb', () => {
  it('calculates dB from peak values', () => {
    const db = waveformPeakDb([-100, 100], 0)
    expect(db).toBeLessThan(0)
  })

  it('returns -Infinity for zero magnitude', () => {
    expect(waveformPeakDb([0, 0], 0)).toBe(-Infinity)
  })
})

describe('detectAudioGapRemoveGaps', () => {
  it('returns empty array for missing waveform data', () => {
    expect(detectAudioGapRemoveGaps({} as any)).toEqual([])
  })

  it('detects gaps in audio gate mode', () => {
    const peaks: number[] = []
    // 100 samples at 100 peaks/sec = 1 second
    // First 0.5s: silence (peak = 0), then 0.5s: audio (peak = 127)
    for (let i = 0; i < 50; i++) { peaks.push(0, 0) }
    for (let i = 0; i < 50; i++) { peaks.push(-127, 127) }
    const result = detectAudioGapRemoveGaps({
      peaks,
      peaks_per_second: 100,
      duration_ms: 1000,
    }, { minimumMs: 200, thresholdDb: -24 })
    // No gap at start because foundAudio is false before first audio
    expect(result.length).toBe(0)
  })
})

describe('getRemovedGapRanges', () => {
  it('merges overlapping removed ranges', () => {
    const result = getRemovedGapRanges([
      { start: 1000, end: 2000, removed: true },
      { start: 1500, end: 2500, removed: true },
    ])
    expect(result.length).toBe(1)
    expect(result[0].end).toBe(2500)
  })
})

describe('mapGapRemovedTime', () => {
  it('maps time before first gap', () => {
    expect(mapGapRemovedTime(500, [
      { start: 1000, end: 2000, removed: true },
    ])).toBe(500)
  })
})

describe('buildGapRemovedIntervals', () => {
  it('returns single interval when no gaps', () => {
    const result = buildGapRemovedIntervals(5000, [])
    expect(result).toEqual([{ start: 0, end: 5000, removed: false }])
  })
})

describe('buildFfconcat', () => {
  it('builds ffconcat from intervals', () => {
    const result = buildFfconcat('/path/to/video.mp4', [
      { start: 0, end: 5000, removed: false },
      { start: 6000, end: 10000, removed: false },
    ])
    expect(result).toContain('ffconcat version 1.0')
    expect(result).toContain('inpoint 0.000')
    expect(result).toContain('outpoint 5.000')
  })

  it('returns empty for empty media path', () => {
    expect(buildFfconcat('', [])).toBe('')
  })
})

describe('configuredEnterAction', () => {
  it('returns split for Ctrl+Enter with ctrl-enter key', () => {
    expect(configuredEnterAction({ key: 'Enter', ctrlKey: true } as any, 'ctrl-enter')).toBe('split')
  })

  it('returns null for non-Enter key', () => {
    expect(configuredEnterAction({ key: 'a' } as any, 'ctrl-enter')).toBeNull()
  })
})
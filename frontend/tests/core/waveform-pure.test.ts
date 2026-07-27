// @vitest-environment node
import { describe, it, expect } from 'vitest'
import {
  decodePayload,
  remapItems,
  sourceForFile,
  applySharedBoundary,
  normalizeNewCueRange,
  clampWaveformScale,
  waveformScaleAfterStep,
  waveformAmplitude,
  sampleInterpolatedPeak,
  normalizeLayoutData,
  swapFreeLayoutOrder,
  normalizeLayoutTree,
  collectLayoutModules,
  swapLayoutTreeModules,
  insertLayoutModuleAtEdge,
  insertLayoutModuleAtRootEdge,
  layoutDropIntent,
  layoutRootDropIntent,
  layoutDropPreviewRect,
  roundMs,
  colorForSegment,
  normalizeFreeOrder,
  isCompleteLayoutTree,
  moduleLayoutNode,
  splitLayoutNode,
  legacyOrderToLayoutTree,
  sameSource,
  normalizeLayoutRows,
  formatCompact,
} from '../../src/core/waveform/pure.js'

describe('decodePayload', () => {
  it('decodes compact signed min/max peaks', () => {
    const bytes = new Uint8Array([0x81, 0x7f, 0xf6, 0x0a])
    const decoded = decodePayload({
      schema: 'moy.asr.waveform.v1',
      encoding: 'i8-minmax-base64',
      peaks_per_second: 100,
      peak_count: 2,
      duration_ms: 20,
      data: btoa(String.fromCharCode(...bytes)),
    })
    expect(decoded).not.toBeNull()
    expect(Array.from(decoded!)).toEqual([-127, 127, -10, 10])
  })

  it('returns null for invalid payload', () => {
    expect(decodePayload({} as any)).toBeNull()
  })
})

describe('remapItems', () => {
  it('remaps word timestamps when a cue edge changes', () => {
    const items = [
      { text: 'A', start: 100, end: 300 },
      { text: 'B', start: 300, end: 500 },
    ]
    const remapped = remapItems(items, 100, 500, 200, 1000)
    expect(JSON.parse(JSON.stringify(remapped))).toEqual([
      { text: 'A', start: 200, end: 600 },
      { text: 'B', start: 600, end: 1000 },
    ])
  })
})

describe('sourceForFile', () => {
  it('uses browser-compatible media signatures', () => {
    expect(JSON.parse(JSON.stringify(sourceForFile({ name: 'x.wav', size: 42, lastModified: 1234 } as any))))
      .toEqual({ name: 'x.wav', size: 42, modified_ms: 1234 })
  })
})

describe('applySharedBoundary', () => {
  it('moves one shared boundary while preserving both cue durations', () => {
    const segments = [
      { start: 0, end: 1000, items: [] },
      { start: 1000, end: 2200, items: [] },
    ]
    const changed = applySharedBoundary(segments, 0, 1300, 100)
    expect(JSON.parse(JSON.stringify(changed))).toEqual([
      { start: 0, end: 1300, items: [] },
      { start: 1300, end: 2200, items: [] },
    ])
  })
})

describe('normalizeNewCueRange', () => {
  it('clamps a new cue to the available gap and minimum duration', () => {
    expect(JSON.parse(JSON.stringify(normalizeNewCueRange(4500, 6200, 10000, 4000, 7000, 100))))
      .toEqual({ start: 4500, end: 6200 })
    expect(normalizeNewCueRange(3900, 4050, 10000, 4000, 4100, 100)).toBeNull()
  })
})

describe('clampWaveformScale', () => {
  it('keeps waveform amplitude scale in a usable range', () => {
    expect(clampWaveformScale(0.1)).toBe(0.25)
    expect(clampWaveformScale(1.25)).toBe(1.25)
    expect(clampWaveformScale(7)).toBe(6)
  })
})

describe('waveformScaleAfterStep', () => {
  it('steps by 0.5 for values >= 1', () => {
    expect(waveformScaleAfterStep(1, 1)).toBe(1.5)
    expect(waveformScaleAfterStep(1.5, -1)).toBe(1)
    expect(waveformScaleAfterStep(5.8, 1)).toBe(6)
  })

  it('steps by 0.25 for values < 1', () => {
    expect(waveformScaleAfterStep(1, -1)).toBe(0.5)
    expect(waveformScaleAfterStep(0.75, -1)).toBe(0.5)
    expect(waveformScaleAfterStep(0.5, -1)).toBe(0.25)
    expect(waveformScaleAfterStep(0.25, -1)).toBe(0.25)
    expect(waveformScaleAfterStep(0.25, 1)).toBe(0.5)
  })
})

describe('waveformAmplitude', () => {
  it('increases with scale', () => {
    expect(waveformAmplitude(100, 2)).toBeGreaterThan(waveformAmplitude(100, 1.1))
    expect(waveformAmplitude(100, 6)).toBeGreaterThan(waveformAmplitude(100, 3))
  })
})

describe('sampleInterpolatedPeak', () => {
  it('interpolates neighboring waveform peaks', () => {
    const peaks = new Int8Array([-100, 80, -40, 20])
    expect(Array.from(sampleInterpolatedPeak(peaks, 0.5, 2))).toEqual([-70, 50])
    expect(Array.from(sampleInterpolatedPeak(peaks, 99, 2))).toEqual([-40, 20])
  })
})

describe('normalizeLayoutData', () => {
  it('normalizes independent layout data and preserves the right-column preset', () => {
    const normalized = JSON.parse(JSON.stringify(normalizeLayoutData({
      schema: 'moy.asr.editor.layout.v1',
      preset: 'free',
      splitPercent: 64,
      columnPercent: 68,
      rows: [45, 25, 30],
      freeOrder: ['player', 'panel', 'cues', 'wave'],
    })))
    expect(normalized.schema).toBe('moy.asr.editor.layout.v1')
    expect(normalized.preset).toBe('free')
    expect(normalized.splitPercent).toBe(64)
    expect(normalized.columnPercent).toBe(68)
    expect(normalized.rows).toEqual([45, 25, 30])
    expect(normalized.freeOrder).toEqual(['player', 'panel', 'cues', 'wave'])
    expect(normalized.tree.type).toBe('split')
  })

  it('migrates only the previous wave-right default to the more compact default', () => {
    const migrated = normalizeLayoutData({ preset: 'wave-right', rows: [42, 27, 31] })
    const preserved = normalizeLayoutData({ preset: 'wave-right', rows: [43, 27, 30] })
    expect(JSON.parse(JSON.stringify(migrated.rows))).toEqual([42, 18, 40])
    expect(JSON.parse(JSON.stringify(preserved.rows))).toEqual([43, 27, 30])
  })

  it('allows the current cue row to shrink below the old eighteen-percent limit', () => {
    const compact = normalizeLayoutData({ preset: 'wave-right', rows: [52, 6, 42] })
    expect(JSON.parse(JSON.stringify(compact.rows))).toEqual([52, 6, 42])
  })
})

describe('swapFreeLayoutOrder', () => {
  it('swaps free docking slots without mutating the source order', () => {
    const order = ['player', 'panel', 'cues', 'wave']
    expect(swapFreeLayoutOrder(order, 'wave', 'panel')).toEqual(['player', 'wave', 'cues', 'panel'])
    expect(order).toEqual(['player', 'panel', 'cues', 'wave'])
  })
})

describe('layout operations', () => {
  it('inserts a module at an edge', () => {
    const base = normalizeLayoutData({ preset: 'free' })
    const insertedRight = insertLayoutModuleAtEdge(base.tree, 'wave', 'player', 'right')
    expect(collectLayoutModules(insertedRight)).toEqual(['player', 'wave', 'panel', 'cues'])
    const insertedBottom = insertLayoutModuleAtEdge(base.tree, 'panel', 'wave', 'bottom')
    expect(collectLayoutModules(insertedBottom)).toEqual(['player', 'cues', 'wave', 'panel'])
  })

  it('docks a module at root edge', () => {
    const base = normalizeLayoutData({ preset: 'free' })
    const dockedLeft = insertLayoutModuleAtRootEdge(base.tree, 'wave', 'left')
    expect(dockedLeft!.type).toBe('split')
    expect((dockedLeft as any).direction).toBe('row')
    expect(collectLayoutModules((dockedLeft as any).children[0])).toEqual(['wave'])
    expect(collectLayoutModules((dockedLeft as any).children[1])).toEqual(['player', 'panel', 'cues'])
  })
})

describe('layoutDropIntent', () => {
  it('uses center drops for swaps and edge drops for insertion', () => {
    const rect = { left: 10, top: 20, width: 200, height: 100 }
    const intent = (x: number, y: number) => JSON.parse(JSON.stringify(layoutDropIntent(rect, x, y)))
    expect(intent(110, 70)).toEqual({ mode: 'swap' })
    expect(intent(20, 70)).toEqual({ mode: 'insert', direction: 'left' })
    expect(intent(110, 115)).toEqual({ mode: 'insert', direction: 'bottom' })
  })
})

describe('layoutRootDropIntent', () => {
  it('reserves outermost workspace strip for whole-window docking', () => {
    const rect = { left: 10, top: 20, width: 1000, height: 600 }
    const intent = (x: number, y: number) => {
      const result = layoutRootDropIntent(rect, x, y)
      return result && JSON.parse(JSON.stringify(result))
    }
    expect(intent(30, 320)).toEqual({ mode: 'root-insert', direction: 'left' })
    expect(intent(990, 320)).toEqual({ mode: 'root-insert', direction: 'right' })
    expect(intent(510, 40)).toEqual({ mode: 'root-insert', direction: 'top' })
    expect(intent(510, 600)).toEqual({ mode: 'root-insert', direction: 'bottom' })
    expect(intent(70, 320)).toBeNull()
  })
})

describe('layoutDropPreviewRect', () => {
  it('matches insertion previews to the narrow drop hit areas', () => {
    const moduleRect = { left: 100, top: 50, width: 400, height: 200 }
    expect(JSON.parse(JSON.stringify(layoutDropPreviewRect(
      moduleRect,
      { mode: 'insert', direction: 'right' },
    )))).toEqual({ left: 404, top: 50, width: 96, height: 200 })

    const workspaceRect = { left: 10, top: 20, width: 1000, height: 600 }
    expect(JSON.parse(JSON.stringify(layoutDropPreviewRect(
      workspaceRect,
      { mode: 'root-insert', direction: 'left' },
    )))).toEqual({ left: 10, top: 20, width: 48, height: 600 })
  })
})

describe('swapLayoutTreeModules', () => {
  it('swaps two modules in the layout tree', () => {
    const base = normalizeLayoutData({ preset: 'free' })
    const swapped = swapLayoutTreeModules(base.tree, 'player', 'wave')
    expect(collectLayoutModules(swapped)).toEqual(['wave', 'panel', 'cues', 'player'])
  })
})

describe('roundMs', () => {
  it('rounds to nearest 10ms', () => {
    expect(roundMs(123)).toBe(120)
    expect(roundMs(127)).toBe(130)
    expect(roundMs(0)).toBe(0)
  })
})

describe('colorForSegment', () => {
  it('returns color from palette', () => {
    expect(colorForSegment({ start: 0, end: 1000, color: { name: 'red' } })).toBe('#e74c3c')
  })

  it('returns default color for no color', () => {
    expect(colorForSegment({ start: 0, end: 1000 })).toBe('#66727d')
  })
})

describe('normalizeFreeOrder', () => {
  it('returns default order for invalid input', () => {
    expect(normalizeFreeOrder([] as any)).toEqual(['player', 'panel', 'cues', 'wave'])
  })

  it('preserves valid order', () => {
    expect(normalizeFreeOrder(['wave', 'panel', 'cues', 'player'])).toEqual(['wave', 'panel', 'cues', 'player'])
  })
})

describe('sameSource', () => {
  it('compares two sources', () => {
    const a = { name: 'x.wav', size: 42, modified_ms: 1234 }
    expect(sameSource(a, { ...a })).toBe(true)
    expect(sameSource(a, { name: 'x.wav', size: 42, modified_ms: 1235 })).toBe(false)
    expect(sameSource(null, a)).toBe(false)
  })
})

describe('normalizeLayoutRows', () => {
  it('normalizes rows to valid range', () => {
    const rows = normalizeLayoutRows([99, 99, 99])
    expect(rows[0]).toBeLessThanOrEqual(76)
    expect(rows[1]).toBeGreaterThanOrEqual(6)
    expect(rows[2]).toBeGreaterThanOrEqual(12)
  })
})

describe('formatCompact', () => {
  it('formats compact time string', () => {
    // formatCompact omits hours when 0
    expect(formatCompact(1000)).toBe('00:01.000')
    expect(formatCompact(3661000)).toBe('01:01:01.000')
  })
})
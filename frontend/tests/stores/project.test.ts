// @vitest-environment node
import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useProjectStore } from '../../src/stores/project.js'

const sampleProject = {
  segments: [
    {
      start: 0, end: 2000, text: '第一段',
      items: [{ text: '第', start: 0, end: 800 }, { text: '一段', start: 800, end: 2000 }],
      sticker: null, sticker_ref: null, color: null, color_ref: null,
    },
    {
      start: 2500, end: 5000, text: '第二段',
      items: [], sticker: null, sticker_ref: null, color: null, color_ref: null,
    },
  ],
}

describe('project store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('starts empty', () => {
    const store = useProjectStore()
    expect(store.segments).toEqual([])
    expect(store.hasUnsavedChanges).toBe(false)
  })

  it('loads project from JSON', () => {
    const store = useProjectStore()
    const result = store.loadProject(JSON.stringify(sampleProject))
    expect(result).toBe(true)
    expect(store.segments.length).toBe(2)
    expect(store.segments[0].text).toBe('第一段')
  })

  it('returns false for invalid JSON', () => {
    const store = useProjectStore()
    expect(store.loadProject('invalid')).toBe(false)
  })

  it('updates a segment', () => {
    const store = useProjectStore()
    store.loadProject(JSON.stringify(sampleProject))
    store.updateSegment(0, { text: '修改后' })
    expect(store.segments[0].text).toBe('修改后')
    expect(store.hasUnsavedChanges).toBe(true)
  })

  it('inserts a segment', () => {
    const store = useProjectStore()
    store.loadProject(JSON.stringify(sampleProject))
    const newSeg = {
      start: 2000, end: 2500, text: '中段',
      items: [], sticker: null, sticker_ref: null, color: null, color_ref: null,
    }
    store.insertSegment(1, newSeg)
    expect(store.segments.length).toBe(3)
    expect(store.segments[1].text).toBe('中段')
  })

  it('deletes segments', () => {
    const store = useProjectStore()
    store.loadProject(JSON.stringify(sampleProject))
    store.deleteSegments([0])
    expect(store.segments.length).toBe(1)
    expect(store.segments[0].text).toBe('第二段')
  })

  it('merges segments', () => {
    const store = useProjectStore()
    store.loadProject(JSON.stringify(sampleProject))
    store.mergeSegments([0, 1])
    expect(store.segments.length).toBe(1)
    expect(store.segments[0].text).toBe('第一段第二段')
    expect(store.segments[0].end).toBe(5000)
  })

  it('splits a segment', () => {
    const store = useProjectStore()
    store.loadProject(JSON.stringify(sampleProject))
    store.splitSegment(0, 1)
    expect(store.segments.length).toBe(3)
    expect(store.segments[0].text).toBe('第')
    expect(store.segments[1].text).toBe('一段')
  })

  it('clears project', () => {
    const store = useProjectStore()
    store.loadProject(JSON.stringify(sampleProject))
    store.clearProject()
    expect(store.segments).toEqual([])
    expect(store.hasUnsavedChanges).toBe(false)
  })
})
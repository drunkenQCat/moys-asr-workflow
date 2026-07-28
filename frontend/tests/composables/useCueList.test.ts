// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { useCueList } from '../../src/composables/useCueList.js'

describe('useCueList', () => {
  const segments = [
    { start: 0, end: 1000, text: '第一条' },
    { start: 1500, end: 3000, text: '第二条' },
    { start: 3500, end: 5000, text: '搜索关键词' },
  ] as any

  it('returns all segments when query is empty', () => {
    const { filteredSegments } = useCueList({
      segments: () => segments,
      searchQuery: () => '',
    })
    expect(filteredSegments.value.length).toBe(3)
    expect(filteredSegments.value.map((i) => i.index)).toEqual([0, 1, 2])
  })

  it('filters segments by text', () => {
    const { filteredSegments } = useCueList({
      segments: () => segments,
      searchQuery: () => '关键词',
    })
    expect(filteredSegments.value.length).toBe(1)
    expect(filteredSegments.value[0].index).toBe(2)
  })

  it('filters segments by start time', () => {
    const { filteredSegments } = useCueList({
      segments: () => segments,
      searchQuery: () => '1500',
    })
    expect(filteredSegments.value.length).toBe(1)
    expect(filteredSegments.value[0].index).toBe(1)
  })

  it('is case-insensitive', () => {
    const { filteredSegments } = useCueList({
      segments: () => segments,
      searchQuery: () => 'GUANJIANCI',
    })
    expect(filteredSegments.value.length).toBe(0)
  })
})

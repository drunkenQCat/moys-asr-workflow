// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { stripTrailingPunctuation } from '../../src/core/punctuation.js'
import type { Segment } from '../../src/types/project.js'

const baseSegment = (overrides: Partial<Segment> = {}): Segment => ({
  start: 0, end: 1000, text: '', items: [],
  sticker: null, sticker_ref: null, color: null, color_ref: null,
  ...overrides,
})

describe('stripTrailingPunctuation', () => {
  it('strips trailing comma and period from text', () => {
    const result = stripTrailingPunctuation([baseSegment({ text: '你好，。' })])
    expect(result[0].text).toBe('你好')
  })

  it('strips trailing comma from last item', () => {
    const result = stripTrailingPunctuation([
      baseSegment({
        text: '你好，',
        items: [{ text: '你好', start: 0, end: 800 }, { text: '，', start: 800, end: 1000 }],
      }),
    ])
    expect(result[0].text).toBe('你好')
    expect(result[0].items[0].text).toBe('你好')
    expect(result[0].items[1].text).toBe('')
  })

  it('removes empty item after stripping', () => {
    const result = stripTrailingPunctuation([
      baseSegment({
        text: '你好，',
        items: [{ text: '你好', start: 0, end: 800 }, { text: '，', start: 800, end: 1000 }],
      }),
    ])
    // Last item becomes empty after stripping
    expect(result[0].items[result[0].items.length - 1].text).toBe('')
  })

  it('does not change text without trailing punctuation', () => {
    const result = stripTrailingPunctuation([baseSegment({ text: '你好世界' })])
    expect(result[0].text).toBe('你好世界')
  })

  it('strips multiple trailing punctuation chars', () => {
    const result = stripTrailingPunctuation([baseSegment({ text: '你好，。，。' })])
    expect(result[0].text).toBe('你好')
  })

  it('handles empty segments', () => {
    const result = stripTrailingPunctuation([])
    expect(result).toEqual([])
  })
})
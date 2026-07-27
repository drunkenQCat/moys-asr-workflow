// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { splitWordsToSegments } from '../../src/core/segment-split.js'
import type { SegmentItem } from '../../src/types/project.js'

describe('splitWordsToSegments', () => {
  it('returns empty array for empty input', () => {
    expect(splitWordsToSegments([], 10)).toEqual([])
  })

  it('creates a single segment for short content', () => {
    const items: SegmentItem[] = [
      { text: '你好', start: 0, end: 1000 },
      { text: '世界', start: 1000, end: 2000 },
    ]
    const result = splitWordsToSegments(items, 10)
    expect(result.length).toBe(1)
    expect(result[0].text).toBe('你好世界')
  })

  it('splits long content by silence', () => {
    const items: SegmentItem[] = [
      { text: '你好世界', start: 0, end: 1000 },
      { text: '今天天气', start: 3000, end: 4000 },
    ]
    const result = splitWordsToSegments(items, 10, 2, 1000)
    expect(result.length).toBe(2)
    expect(result[0].text).toBe('你好世界')
    expect(result[1].text).toBe('今天天气')
  })

  it('merges short segments with previous', () => {
    const items: SegmentItem[] = [
      { text: '第一段', start: 0, end: 1000 },
      { text: '短', start: 1000, end: 1500 },
    ]
    const result = splitWordsToSegments(items, 10, 5)
    expect(result.length).toBe(1)
    expect(result[0].text).toBe('第一段短')
  })

  it('splits by jieba for long content without punctuation', () => {
    const items: SegmentItem[] = []
    let time = 0
    const chars = '今天天气真好我们去公园玩吧大家都非常开心'
    for (const ch of chars) {
      items.push({ text: ch, start: time, end: time + 100 })
      time += 100
    }
    const result = splitWordsToSegments(items, 10, 2)
    expect(result.length).toBeGreaterThanOrEqual(2)
    for (const seg of result) {
      expect(seg.text.length).toBeLessThanOrEqual(15)
    }
  })

  it('splits by strong punctuation', () => {
    const items: SegmentItem[] = [
      { text: '第一句', start: 0, end: 1000 },
      { text: '。', start: 1000, end: 1100 },
      { text: '第二句', start: 1100, end: 2000 },
    ]
    const result = splitWordsToSegments(items, 20, 2)
    expect(result.length).toBe(2)
    expect(result[0].text).toBe('第一句。')
    expect(result[1].text).toBe('第二句')
  })

  it('merges short last group with previous', () => {
    const items: SegmentItem[] = [
      { text: '第一句', start: 0, end: 1000 },
      { text: '。', start: 1000, end: 1100 },
      { text: '短', start: 1100, end: 1200 },
    ]
    const result = splitWordsToSegments(items, 20, 5)
    expect(result.length).toBe(1)
    expect(result[0].text).toBe('第一句。短')
  })
})
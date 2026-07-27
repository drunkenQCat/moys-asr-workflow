// 字幕断句 — 基于 jieba-wasm，框架无关
// 切分策略与 Python generate_subtitle_qwen_api.py 的 split_words_to_segments 一致：
//   0. 按静音间隔（>= gapSplitMs）预切
//   1. 每个静音组内按强标点（。！？；\n）继续切句
//   2. 合并过短片段（< minLen 字符）
//   3. 对超长片段，按弱标点（，、：,;）拆分
//   4. 没有弱标点时，用 jieba 分词找最佳断点

import { cut } from 'jieba-wasm'
import type { SegmentItem, Segment } from '../types/project.js'

const STRONG_PUNCT = new Set(['。', '！', '？', '；', '\n'])
const WEAK_PUNCT = new Set(['，', '、', '：', ',', ';'])

/**
 * 按相邻 item 之间的静音间隔切分
 */
function splitBySilence(items: SegmentItem[], minGapMs: number): SegmentItem[][] {
  if (!items.length || minGapMs <= 0) return items.length ? [items] : []
  const groups: SegmentItem[][] = [[items[0]]]
  for (let i = 1; i < items.length; i++) {
    const gap = items[i].start - items[i - 1].end
    if (gap >= minGapMs) {
      groups.push([])
    }
    groups[groups.length - 1].push(items[i])
  }
  return groups
}

/**
 * 按强标点切句：在含强标点的 item 后切分
 */
function splitByStrongPunct(items: SegmentItem[]): SegmentItem[][] {
  const groups: SegmentItem[][] = []
  let buf: SegmentItem[] = []
  for (const it of items) {
    buf.push(it)
    if (Array.from(it.text).some((c) => STRONG_PUNCT.has(c))) {
      groups.push(buf)
      buf = []
    }
  }
  if (buf.length > 0) {
    groups.push(buf)
  }
  return groups
}

/**
 * 合并短片段（与 Python 端一致的两阶段合并）：
 *   1. 如果当前组 < minLen，合并到上一组
 *   2. 如果最后一段 < minLen 且总组数 >= 2，合并到倒数第二组
 */
function mergeShortGroups(groups: SegmentItem[][], minLen: number): SegmentItem[][] {
  const merged: SegmentItem[][] = []
  for (const grp of groups) {
    const segText = grp.map((it) => it.text).join('')
    if (merged.length > 0 && segText.length < minLen) {
      merged[merged.length - 1].push(...grp)
    } else {
      merged.push([...grp])
    }
  }
  if (merged.length >= 2) {
    const lastText = merged[merged.length - 1].map((it) => it.text).join('')
    if (lastText.length < minLen) {
      const last = merged.pop()!
      merged[merged.length - 1].push(...last)
    }
  }
  return merged
}

/**
 * 递归拆分超长组（与 Python _split_long_group 一致）
 */
function splitLongGroup(
  items: SegmentItem[],
  maxLen: number,
  weakPunct: Set<string>,
): SegmentItem[][] {
  const textTotal = items.map((it) => it.text).join('')
  if (textTotal.length <= maxLen) return [items]

  // 优先按弱标点拆
  let cumLen = 0
  let punctIdx: number | null = null
  for (let i = 0; i < items.length; i++) {
    cumLen += items[i].text.length
    if (cumLen > maxLen) break
    if (Array.from(items[i].text).some((c) => weakPunct.has(c))) {
      punctIdx = i + 1
    }
  }

  if (punctIdx !== null && punctIdx < items.length) {
    return [
      ...splitLongGroup(items.slice(0, punctIdx), maxLen, weakPunct),
      ...splitLongGroup(items.slice(punctIdx), maxLen, weakPunct),
    ]
  }

  // 用 jieba wasm 分词找断点
  const words = Array.from(cut(textTotal))
  const boundaries: number[] = []
  let pos = 0
  for (const w of words) {
    pos += w.length
    boundaries.push(pos)
  }

  let bestCharPos: number | null = null
  for (const b of boundaries) {
    if (b > 0 && b <= maxLen) {
      if (bestCharPos === null ||
          Math.abs(b - maxLen) < Math.abs(bestCharPos - maxLen)) {
        bestCharPos = b
      }
    }
  }

  if (bestCharPos !== null && bestCharPos < textTotal.length) {
    cumLen = 0
    let splitIdx: number | null = null
    for (let i = 0; i < items.length; i++) {
      cumLen += items[i].text.length
      if (cumLen >= bestCharPos) {
        splitIdx = i + 1
        break
      }
    }
    if (splitIdx !== null && splitIdx > 0 && splitIdx < items.length) {
      return [
        ...splitLongGroup(items.slice(0, splitIdx), maxLen, weakPunct),
        ...splitLongGroup(items.slice(splitIdx), maxLen, weakPunct),
      ]
    }
  }

  // 兜底：按 maxLen 字符硬切
  cumLen = 0
  for (let i = 0; i < items.length; i++) {
    cumLen += items[i].text.length
    if (cumLen >= maxLen) {
      return [
        items.slice(0, i + 1),
        ...splitLongGroup(items.slice(i + 1), maxLen, weakPunct),
      ]
    }
  }
  return [items]
}

/**
 * 将 items 分组成字幕段（与 Python 端 5 步流程一致）
 */
export function splitWordsToSegments(
  items: SegmentItem[],
  maxLen: number,
  minLen = 5,
  gapSplitMs = 0,
): Segment[] {
  if (!items.length) return []

  // Step 0: 按静音预切分
  const silenceGroups = gapSplitMs > 0
    ? splitBySilence(items, gapSplitMs)
    : [items]

  const finalGroups: SegmentItem[][] = []
  for (const sg of silenceGroups) {
    if (sg.length <= 1) {
      finalGroups.push(sg)
      continue
    }

    // Step 1: 每个静音组内按强标点继续切句
    const rawGroups = splitByStrongPunct(sg)

    // Step 2: 合并过短片段
    const merged = mergeShortGroups(rawGroups, minLen)

    // Step 3+4: 对超长片段按弱标点/jieba 拆分
    for (const grp of merged) {
      const subGroups = splitLongGroup(grp, maxLen, WEAK_PUNCT)
      finalGroups.push(...subGroups)
    }
  }

  // 转换为 segments
  const segments: Segment[] = []
  for (const g of finalGroups) {
    if (g.length === 0) continue
    toSeg(g, segments, minLen)
  }
  return segments
}

function toSeg(group: SegmentItem[], result: Segment[], minLen: number) {
  const text = group.map((it) => it.text).join('')
  if (text.length < minLen && result.length > 0) {
    // 合并到上一条
    const last = result[result.length - 1]
    last.text += text
    last.end = group[group.length - 1].end
    last.items.push(...group)
    return
  }
  result.push({
    start: group[0].start,
    end: group[group.length - 1].end,
    text,
    items: group,
    sticker: null,
    sticker_ref: null,
    color: null,
    color_ref: null,
  })
}
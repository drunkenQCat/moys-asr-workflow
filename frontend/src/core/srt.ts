// SRT 解析/导出 — 纯函数，框架无关

import type { Segment, GapRemoveGap } from '../types/project.js'
import { mapGapRemovedTime, getRemovedGapRanges } from './editor-utils.js'

/**
 * 将毫秒格式化为 SRT 时间码：HH:MM:SS,mmm
 */
export function formatTimestamp(ms: number): string {
  ms = Math.max(0, Math.round(ms))
  const h = Math.floor(ms / 3600000)
  ms -= h * 3600000
  const m = Math.floor(ms / 60000)
  ms -= m * 60000
  const s = Math.floor(ms / 1000)
  ms -= s * 1000
  const pad = (n: number, w: number) => String(n).padStart(w, '0')
  return `${pad(h, 2)}:${pad(m, 2)}:${pad(s, 2)},${pad(ms, 3)}`
}

/**
 * 将 SRT 时间码解析为毫秒
 */
export function parseTimestamp(srtTime: string): number | null {
  const match = srtTime.trim().match(/^(\d{1,2}):(\d{2}):(\d{2})[,\.](\d{1,3})$/)
  if (!match) return null
  const [, h, m, s, ms] = match
  return Number(h) * 3600000 + Number(m) * 60000 + Number(s) * 1000 + Number(ms)
}

/**
 * 将字幕段数组转为 SRT 字符串
 */
export interface SrtExportOptions {
  /** 是否将第一条字幕校准到 0 时间 */
  offsetToZero?: boolean
  /** 是否保留禁用项占位（序号保留，内容空） */
  keepDisabledPlaceholder?: boolean
}

export function segmentsToSrt(
  segments: Segment[],
  options: SrtExportOptions = {},
): string {
  const { offsetToZero = true, keepDisabledPlaceholder = false } = options
  const firstEnabled = offsetToZero
    ? segments.find((seg) => seg && !seg.disabled)
    : null
  const timeOffset = firstEnabled ? Math.max(0, Math.round(firstEnabled.start)) : 0

  const parts: string[] = []
  let n = 0
  segments.forEach((seg) => {
    if (seg.disabled) {
      if (!keepDisabledPlaceholder) return
      n++
      parts.push(String(n))
      parts.push(`${formatTimestamp(seg.start - timeOffset)} --> ${formatTimestamp(seg.end - timeOffset)}`)
      parts.push('')
      parts.push('')
      return
    }
    n++
    parts.push(String(n))
    parts.push(`${formatTimestamp(seg.start - timeOffset)} --> ${formatTimestamp(seg.end - timeOffset)}`)
    parts.push(seg.text)
    parts.push('')
  })
  return parts.join('\n')
}

/**
 * 将 SRT 字符串解析为字幕段数组（不含时间戳精度）
 */
export function parseSrt(srtString: string): Segment[] {
  const blocks = srtString.trim().split(/\n\s*\n/)
  const segments: Segment[] = []
  for (const block of blocks) {
    const lines = block.trim().split('\n')
    if (lines.length < 3) continue
    // First line: index (optional)
    // Second line: timecode
    const timeIdx = /^\d+$/.test(lines[0].trim()) ? 1 : 0
    if (timeIdx >= lines.length - 1) continue
    const timeMatch = lines[timeIdx].match(
      /(\d{1,2}:\d{2}:\d{2}[,\.]\d{1,3})\s*-->\s*(\d{1,2}:\d{2}:\d{2}[,\.]\d{1,3})/,
    )
    if (!timeMatch) continue
    const start = parseTimestamp(timeMatch[1])
    const end = parseTimestamp(timeMatch[2])
    if (start === null || end === null) continue
    const text = lines.slice(timeIdx + 1).join('\n').trim()
    if (!text) continue
    segments.push({
      start,
      end,
      text,
      items: [],
      sticker: null,
      sticker_ref: null,
      color: null,
      color_ref: null,
    })
  }
  return segments
}

/**
 * 导出去空隙 SRT
 */
export function buildGapRemovedSrt(
  segments: Segment[],
  gaps: GapRemoveGap[],
  options: SrtExportOptions = {},
): string {
  const removed = getRemovedGapRanges(gaps)
  if (!removed.length) return ''

  const { offsetToZero = true } = options
  const firstEnabled = offsetToZero
    ? segments.find((seg) => seg && !seg.disabled)
    : null
  const timeOffset = firstEnabled ? Math.max(0, Math.round(firstEnabled.start)) : 0

  const parts: string[] = []
  let number = 0
  segments.forEach((segment) => {
    if (segment.disabled) return
    number++
    const start = mapGapRemovedTime(segment.start, removed)
    const end = mapGapRemovedTime(segment.end, removed)
    parts.push(String(number))
    parts.push(
      `${formatTimestamp(start - timeOffset)} --> ${formatTimestamp(Math.max(start + 1, end) - timeOffset)}`,
    )
    parts.push(segment.text)
    parts.push('')
  })
  return parts.join('\n')
}
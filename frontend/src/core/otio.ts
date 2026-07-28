// OTIO 导出 — 纯函数，框架无关
// 迁移自 web/editor.js 的 OTIO 导出函数

import type { Segment, GapRemoveGap } from '../types/project.js'
import { getRemovedGapRanges, mapGapRemovedTime } from './editor-utils.js'

const FPS = 24
const OTIO_SCHEMA = 'OpenTimelineIO'

function otioTime(ms: number): { frame: number; rate: number } {
  return { frame: Math.round((ms / 1000) * FPS), rate: FPS }
}

function otioTimeRange(startMs: number, endMs: number): { start: { frame: number; rate: number }; duration: { frame: number; rate: number } } {
  return {
    start: otioTime(startMs),
    duration: { frame: Math.round(((endMs - startMs) / 1000) * FPS), rate: FPS },
  }
}

function buildExternalReference(targetUrl: string, mediaUrl: string, durationMs: number): Record<string, unknown> {
  return {
    name: 'OTIO_JSON',
    source_url: '',
    metadata: {},
    available_range: otioTimeRange(0, durationMs),
    available_image_bounds: null,
    target_url_base: targetUrl,
  }
}

function buildClip(segment: Segment, offsetMs: number, mediaUrl: string): Record<string, unknown> {
  return {
    name: segment.text,
    source_range: otioTimeRange(segment.start, segment.end),
    enabled: true,
    metadata: {
      text: segment.text,
      items: segment.items,
    },
    effects: [],
    media_references: {
      media: buildExternalReference(mediaUrl, mediaUrl, 0),
    },
  }
}

function buildStack(name: string, children: Record<string, unknown>[]): Record<string, unknown> {
  return {
    name,
    source_range: null,
    children,
    effects: [],
    markers: [],
    metadata: {},
  }
}

function buildTimeline(tracks: Record<string, unknown>[], durationMs: number): Record<string, unknown> {
  return {
    OTIO_SCHEMA,
    name: 'timeline',
    global_start_time: otioTime(0),
    tracks: buildStack('tracks', tracks),
  }
}

/**
 * 导出包含 sticker 元数据的 OTIO 工程
 */
export function buildStickerOtio(
  segments: Segment[],
  mediaUrl: string,
  durationMs: number,
  stickerRoot: string,
): string {
  const clips = segments.map((seg) => {
    const clip = buildClip(seg, 0, mediaUrl)
    if (seg.sticker || seg.sticker_ref) {
      (clip.metadata as Record<string, unknown>).sticker = seg.sticker || seg.sticker_ref
    }
    return clip
  })
  return JSON.stringify(buildTimeline([buildStack('V1', clips)], durationMs), null, 2)
}

/**
 * 导出去空隙的 OTIO 工程
 */
export function buildGapRemovedOtio(
  segments: Segment[],
  gaps: GapRemoveGap[],
  mediaUrl: string,
  durationMs: number,
): string {
  const removed = getRemovedGapRanges(gaps)
  const clips = segments
    .filter((seg) => !seg.disabled)
    .map((seg) => {
      const start = mapGapRemovedTime(seg.start, removed)
      const end = mapGapRemovedTime(seg.end, removed)
      return buildClip(seg, 0, mediaUrl)
    })
  return JSON.stringify(buildTimeline([buildStack('V1', clips)], durationMs), null, 2)
}

/**
 * 导出去空隙 + sticker 的 OTIO 工程
 */
export function buildGapRemovedStickerOtio(
  segments: Segment[],
  gaps: GapRemoveGap[],
  mediaUrl: string,
  durationMs: number,
  stickerRoot: string,
): string {
  const removed = getRemovedGapRanges(gaps)
  const clips = segments
    .filter((seg) => !seg.disabled)
    .map((seg) => {
      const clip = buildClip(seg, 0, mediaUrl)
      if (seg.sticker || seg.sticker_ref) {
        (clip.metadata as Record<string, unknown>).sticker = seg.sticker || seg.sticker_ref
      }
      return clip
    })
  return JSON.stringify(buildTimeline([buildStack('V1', clips)], durationMs), null, 2)
}
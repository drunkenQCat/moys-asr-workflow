// DaVinci Resolve JSON 导出 — 纯函数，框架无关

import type { Segment } from '../types/project.js'

const FPS = 24

export function buildResolveJson(segments: Segment[], mediaName: string): string {
  const clips = segments
    .filter((seg) => !seg.disabled)
    .map((seg, i) => ({
      index: i,
      name: seg.text,
      start: seg.start / 1000,
      end: seg.end / 1000,
      duration: (seg.end - seg.start) / 1000,
      text: seg.text,
    }))

  return JSON.stringify({
    version: 1,
    timeline: {
      name: mediaName || 'timeline',
      fps: FPS,
      clips,
    },
    segments: clips,
  }, null, 2)
}
// JSON 工程读写 + schema 校验 — 纯函数，框架无关

import type { ProjectData, Segment } from '../types/project.js'

/**
 * 校验工程数据的必需字段
 */
export function validateProject(data: unknown): data is ProjectData {
  if (!data || typeof data !== 'object') return false
  const obj = data as Record<string, unknown>
  if (!Array.isArray(obj.segments)) return false
  return obj.segments.every((seg: unknown) => {
    if (!seg || typeof seg !== 'object') return false
    const s = seg as Record<string, unknown>
    return (
      typeof s.start === 'number' &&
      typeof s.end === 'number' &&
      typeof s.text === 'string' &&
      s.start < s.end
    )
  })
}

/**
 * 序列化为 JSON 字符串
 */
export function serializeProject(data: ProjectData): string {
  return JSON.stringify(data, null, 2)
}

/**
 * 从 JSON 字符串反序列化 + 校验
 */
export function deserializeProject(json: string): ProjectData | null {
  try {
    const data = JSON.parse(json)
    if (!validateProject(data)) return null
    return normalizeProject(data as ProjectData)
  } catch {
    return null
  }
}

/**
 * 补齐缺失字段，确保数据结构完整
 */
export function normalizeProject(data: ProjectData): ProjectData {
  return {
    ...data,
    segments: data.segments.map(normalizeSegment),
  }
}

function normalizeSegment(seg: Segment): Segment {
  return {
    start: seg.start,
    end: seg.end,
    text: seg.text,
    items: Array.isArray(seg.items) ? seg.items : [],
    sticker: seg.sticker ?? null,
    sticker_ref: seg.sticker_ref ?? null,
    color: seg.color ?? null,
    color_ref: seg.color_ref ?? null,
    _dirty: seg._dirty ?? false,
    disabled: seg.disabled ?? false,
  }
}

/**
 * 创建空工程
 */
export function createEmptyProject(): ProjectData {
  return {
    segments: [],
  }
}

/**
 * 检查工程是否有未保存的改动
 */
export function hasUnsavedChanges(data: ProjectData): boolean {
  return data.segments.some((seg) => seg._dirty)
}
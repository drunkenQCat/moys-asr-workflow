import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { ProjectData, Segment, GapRemoveData, LayoutData, StickerHead, StickerRef } from '../types/project.js'
import { deserializeProject, createEmptyProject } from '../core/json-project.js'
import { useUndo } from '../composables/useUndo.js'

/**
 * 根据字符偏移计算分割时间点。
 * 优先使用 items 字级时间戳的边界，降级为线性插值。
 */
function computeSplitTime(seg: Segment, charOffset: number, textLength: number): number {
  const items = seg.items || []
  if (items.length >= 2) {
    let cumLen = 0
    for (let i = 0; i < items.length - 1; i++) {
      cumLen += Array.from(items[i].text).length
      if (cumLen >= charOffset) {
        // 取 items[i] 结束时间和 items[i+1] 开始时间的中间值
        const leftEnd = items[i].end
        const rightStart = items[i + 1].start
        if (Number.isFinite(leftEnd) && Number.isFinite(rightStart)) {
          return Math.round((leftEnd + rightStart) / 2)
        }
        return Number.isFinite(rightStart) ? Math.round(rightStart) : Math.round(leftEnd)
      }
    }
  }
  // 降级：线性插值
  return Math.round(seg.start + ((seg.end - seg.start) * charOffset / textLength))
}

export const useProjectStore = defineStore('project', () => {
  // ===== 工程数据 =====
  const segments = ref<Segment[]>([])
  const gapRemove = ref<GapRemoveData | null>(null)
  const layout = ref<LayoutData | null>(null)
  const stickers = ref<(StickerHead | StickerRef)[]>([])

  // ===== 工程元信息 =====
  const projectName = ref('')
  const mediaName = ref('')
  const mediaUrl = ref('')
  const mediaDurationMs = ref(0)
  const mediaFile = ref<File | null>(null)

  // ===== 状态标记 =====
  const hasUnsavedChanges = ref(false)
  const gapRemoveDirty = ref(false)
  const generatedAt = ref('')

  // ===== localStorage 持久化 =====
  const STORAGE_PREFIX = 'moy.asr.project.'

  function storageKey(file: File): string {
    return `${STORAGE_PREFIX}${file.name}.${file.size}.${file.lastModified}`
  }

  function saveToStorage(): void {
    const file = mediaFile.value
    if (!file) return
    const data = {
      segments: segments.value,
      projectName: projectName.value,
      language: '', // 已 encoded in segments, 留作扩展
    }
    try {
      localStorage.setItem(storageKey(file), JSON.stringify(data))
    } catch {
      // storage full — silently ignore
    }
  }

  function restoreFromStorage(file: File): boolean {
    try {
      const raw = localStorage.getItem(storageKey(file))
      if (!raw) return false
      const data = JSON.parse(raw)
      if (!data.segments || !Array.isArray(data.segments) || data.segments.length === 0) return false
      segments.value = data.segments
      projectName.value = data.projectName || file.name.replace(/\.[^.]+$/, '')
      return true
    } catch {
      return false
    }
  }

  // ===== Undo =====
  const undo = useUndo()

  function performUndo() {
    const entry = undo.popUndo()
    if (!entry) return
    if (entry.segs) segments.value = entry.segs
    if (entry.gapRemove !== undefined) gapRemove.value = entry.gapRemove
    if (entry.gapRemoveDirty !== undefined) gapRemoveDirty.value = entry.gapRemoveDirty
  }

  // ===== Actions =====

  function loadProject(json: string): boolean {
    const data = deserializeProject(json)
    if (!data) return false
    segments.value = data.segments
    gapRemove.value = data.gap_remove ?? null
    layout.value = data.layout ?? null
    hasUnsavedChanges.value = false
    gapRemoveDirty.value = false
    return true
  }

  function loadMedia(file: File) {
    if (mediaUrl.value) URL.revokeObjectURL(mediaUrl.value)
    mediaFile.value = file
    mediaName.value = file.name
    mediaUrl.value = URL.createObjectURL(file)
  }

  function updateSegment(index: number, patch: Partial<Segment>) {
    if (index < 0 || index >= segments.value.length) return
    undo.pushUndo('编辑字幕', segments.value, gapRemove.value, gapRemoveDirty.value)
    segments.value[index] = { ...segments.value[index], ...patch }
    markDirty()
  }

  function insertSegment(index: number, segment: Segment) {
    undo.pushUndo('插入字幕', segments.value, gapRemove.value, gapRemoveDirty.value)
    segments.value.splice(index, 0, segment)
    markDirty()
  }

  function deleteSegments(indexes: number[], silent = false) {
    if (!silent) {
      undo.pushUndo('删除字幕', segments.value, gapRemove.value, gapRemoveDirty.value)
    }
    const sorted = [...indexes].sort((a, b) => b - a)
    for (const idx of sorted) {
      if (idx >= 0 && idx < segments.value.length) {
        segments.value.splice(idx, 1)
      }
    }
    markDirty()
  }

  function mergeSegments(indexes: number[]) {
    const sorted = [...indexes].sort((a, b) => a - b)
    if (sorted.length < 2) return
    const first = sorted[0]
    const last = sorted[sorted.length - 1]
    if (first < 0 || last >= segments.value.length) return

    undo.pushUndo('合并字幕', segments.value, gapRemove.value, gapRemoveDirty.value)

    const mergedText = sorted
      .map((i) => segments.value[i].text)
      .join('')
    const mergedItems = sorted
      .flatMap((i) => segments.value[i].items || [])

    const merged: Segment = {
      ...segments.value[first],
      text: mergedText,
      items: mergedItems,
      end: segments.value[last].end,
    }

    // Remove merged segments from last to first (silent — already pushed undo above)
    deleteSegments(sorted.slice(1), true)
    segments.value[first] = merged
    markDirty()
  }

  function splitSegment(index: number, charOffset: number) {
    if (index < 0 || index >= segments.value.length) return
    const seg = segments.value[index]
    const text = seg.text
    if (charOffset <= 0 || charOffset >= text.length) return

    undo.pushUndo('拆分字幕', segments.value, gapRemove.value, gapRemoveDirty.value)

    const leftText = text.slice(0, charOffset)
    const rightText = text.slice(charOffset)

    // Split items at character offset
    const leftItems = []
    const rightItems = []
    let offset = 0
    for (const item of seg.items || []) {
      const itemLen = Array.from(item.text).length
      if (offset + itemLen <= charOffset) {
        leftItems.push(item)
      } else if (offset >= charOffset) {
        rightItems.push(item)
      } else {
        // Split item across boundary
        const leftItemLen = charOffset - offset
        const rightItemLen = itemLen - leftItemLen
        const itemChars = Array.from(item.text)
        leftItems.push({
          ...item,
          text: itemChars.slice(0, leftItemLen).join(''),
        })
        rightItems.push({
          ...item,
          text: itemChars.slice(leftItemLen).join(''),
        })
      }
      offset += itemLen
    }

    const splitTime = computeSplitTime(seg, charOffset, text.length)
    const left: Segment = {
      ...seg,
      text: leftText,
      items: leftItems,
      end: splitTime,
    }
    const right: Segment = {
      ...seg,
      text: rightText,
      items: rightItems,
      start: splitTime,
    }

    segments.value[index] = left
    segments.value.splice(index + 1, 0, right)
    markDirty()
  }

  function setGapRemove(data: GapRemoveData | null) {
    undo.pushUndo('设置空隙移除', segments.value, gapRemove.value, gapRemoveDirty.value)
    gapRemove.value = data
    gapRemoveDirty.value = true
    markDirty()
  }

  function markDirty() {
    hasUnsavedChanges.value = true
  }

  function clearProject() {
    segments.value = []
    gapRemove.value = null
    layout.value = null
    stickers.value = []
    projectName.value = ''
    mediaName.value = ''
    mediaUrl.value = ''
    mediaDurationMs.value = 0
    mediaFile.value = null
    hasUnsavedChanges.value = false
    gapRemoveDirty.value = false
    generatedAt.value = ''
    undo.clearUndo()
  }

  function getExportData(): ProjectData {
    return {
      segments: segments.value,
      media: mediaName.value ? `media/${mediaName.value}` : undefined,
      gap_remove: gapRemove.value ?? undefined,
      layout: layout.value ?? undefined,
    }
  }

  return {
    // State
    segments, gapRemove, layout, stickers,
    projectName, mediaName, mediaUrl, mediaDurationMs, mediaFile,
    hasUnsavedChanges, gapRemoveDirty, generatedAt,
    // Actions
    loadProject, loadMedia, saveToStorage, restoreFromStorage,
    updateSegment, insertSegment, deleteSegments, mergeSegments, splitSegment,
    setGapRemove, markDirty, clearProject, getExportData,
    // Undo
    performUndo, undo,
  }
})
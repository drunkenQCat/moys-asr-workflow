// 纯函数 — 从 web/waveform.js IIFE 提取，与 window.AsrWaveform.testing 对齐
// 框架无关，无 DOM 依赖

// ===== 常量 =====

export const SCHEMA = 'moy.asr.waveform.v1'
export const ENCODING = 'i8-minmax-base64'
export const LAYOUT_SCHEMA = 'moy.asr.editor.layout.v1'
export const LAYOUT_PRESETS = ['classic', 'wave-right', 'wave-bottom', 'free'] as const
export const MODULE_IDS = ['player', 'panel', 'cues', 'wave'] as const
export const DEFAULT_FREE_ORDER = ['player', 'panel', 'cues', 'wave']
export const LAYOUT_DIRECTIONS = ['left', 'right', 'top', 'bottom'] as const
export const MODULE_EDGE_DROP_RATIO = 0.24
export const ROOT_EDGE_DROP_RATIO = 0.055
export const ROOT_EDGE_DROP_MIN_PX = 24
export const ROOT_EDGE_DROP_MAX_PX = 48
export const MIN_CUE_MS = 100
export const MIN_WAVEFORM_SCALE = 0.25
export const MAX_WAVEFORM_SCALE = 6
export const ROUND_MS = 10
export const DEFAULT_LAYOUT_ROWS = [42, 18, 40]
export const PREVIOUS_DEFAULT_LAYOUT_ROWS = [42, 27, 31]
export const PALETTE: Record<string, string> = {
  red: '#e74c3c',
  yellow: '#f1c40f',
  blue: '#168cff',
  green: '#2ecc71',
  purple: '#9b59b6',
}

// ===== 基础工具函数 =====

export function clamp(value: number, low: number, high: number): number {
  return Math.max(low, Math.min(high, value))
}

export function roundMs(value: number): number {
  return Math.round(value / ROUND_MS) * ROUND_MS
}

// ===== 波形数据处理 =====

export interface WaveformPayload {
  schema: string
  encoding: string
  peaks_per_second: number
  peak_count: number
  duration_ms: number
  data: string
  source?: { name: string; size: number; modified_ms: number }
}

export function decodePayload(payload: WaveformPayload): Int8Array | null {
  if (!payload || payload.schema !== SCHEMA || payload.encoding !== ENCODING) return null
  if (!Number.isInteger(payload.peak_count) || payload.peak_count <= 0) return null
  if (!Number.isFinite(payload.peaks_per_second) || payload.peaks_per_second <= 0) return null
  if (typeof payload.data !== 'string') return null
  try {
    const binary = atob(payload.data)
    if (binary.length !== payload.peak_count * 2) return null
    const unsigned = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) unsigned[i] = binary.charCodeAt(i)
    return new Int8Array(unsigned.buffer)
  } catch {
    return null
  }
}

export function sourceForFile(file: { name: string; size: number; lastModified: number }): {
  name: string; size: number; modified_ms: number
} {
  return {
    name: file.name,
    size: file.size,
    modified_ms: file.lastModified,
  }
}

// ===== 字幕块操作 =====

export interface SegmentLike {
  start: number
  end: number
  text?: string
  items?: { text: string; start: number; end: number }[]
  color?: { name?: string; value?: string } | null
  color_ref?: { name?: string } | null
}

export function remapItems(
  items: { text: string; start: number; end: number }[],
  oldStart: number,
  oldEnd: number,
  newStart: number,
  newEnd: number,
): { text: string; start: number; end: number }[] {
  if (!Array.isArray(items) || !items.length) return items
  const oldDuration = Math.max(1, oldEnd - oldStart)
  const newDuration = Math.max(1, newEnd - newStart)
  return items.map((item) => ({
    ...item,
    start: roundMs(newStart + ((item.start - oldStart) / oldDuration) * newDuration),
    end: roundMs(newStart + ((item.end - oldStart) / oldDuration) * newDuration),
  }))
}

export function applySharedBoundary(
  segments: SegmentLike[],
  leftIndex: number,
  boundary: number,
  minDuration = MIN_CUE_MS,
): SegmentLike[] {
  const left = segments[leftIndex]
  const right = segments[leftIndex + 1]
  if (!left || !right) return segments
  const lower = left.start + minDuration
  const upper = right.end - minDuration
  const nextBoundary = clamp(roundMs(boundary), lower, upper)
  const oldLeftEnd = left.end
  const oldRightStart = right.start
  left.end = nextBoundary
  right.start = nextBoundary
  left.items = remapItems(left.items || [], left.start, oldLeftEnd, left.start, nextBoundary)
  right.items = remapItems(right.items || [], oldRightStart, right.end, nextBoundary, right.end)
  return segments
}

export function normalizeNewCueRange(
  start: number,
  end: number,
  duration: number,
  previousEnd = 0,
  nextStart = duration,
  minDuration = MIN_CUE_MS,
): { start: number; end: number } | null {
  const lower = clamp(roundMs(previousEnd), 0, Math.max(0, duration))
  const upper = clamp(roundMs(nextStart), lower, Math.max(lower, duration))
  const nextStartMs = clamp(roundMs(start), lower, upper)
  const nextEndMs = clamp(roundMs(end), lower, upper)
  if (nextEndMs - nextStartMs < minDuration) return null
  return { start: nextStartMs, end: nextEndMs }
}

export function colorForSegment(segment: SegmentLike): string {
  if (segment.color?.name && PALETTE[segment.color.name]) return PALETTE[segment.color.name]
  if (segment.color_ref?.name && PALETTE[segment.color_ref.name]) return PALETTE[segment.color_ref.name]
  if (segment.color?.value) return segment.color.value
  return '#66727d'
}

// ===== 波形缩放 =====

export function clampWaveformScale(value: number): number {
  const numeric = Number(value)
  return clamp(Number.isFinite(numeric) ? numeric : 1, MIN_WAVEFORM_SCALE, MAX_WAVEFORM_SCALE)
}

export function waveformScaleAfterStep(value: number, direction: number): number {
  const current = clampWaveformScale(value)
  const step = current < 1 ? 0.25 : 0.5
  return Number(clampWaveformScale(current + Number(direction) * step).toFixed(2))
}

export function waveformAmplitude(height: number, scale: number): number {
  return Math.max(0, Number(height) * 0.36 * clampWaveformScale(scale))
}

export function sampleInterpolatedPeak(
  peaks: Int8Array | number[],
  position: number,
  peakCount: number,
  target: [number, number] = [0, 0],
): [number, number] {
  if (!peaks || peakCount <= 0) {
    target[0] = 0
    target[1] = 0
    return target
  }
  const clampedPosition = clamp(Number(position) || 0, 0, peakCount - 1)
  const left = Math.floor(clampedPosition)
  const right = Math.min(peakCount - 1, left + 1)
  const mix = clampedPosition - left
  target[0] = peaks[left * 2] + (peaks[right * 2] - peaks[left * 2]) * mix
  target[1] = peaks[left * 2 + 1] + (peaks[right * 2 + 1] - peaks[left * 2 + 1]) * mix
  return target
}

// ===== 布局系统 =====

export interface LayoutModule {
  type: 'module'
  id: string
}

export interface LayoutSplit {
  type: 'split'
  direction: 'row' | 'column'
  ratio: number
  children: [LayoutNode, LayoutNode]
}

export type LayoutNode = LayoutModule | LayoutSplit

export function moduleLayoutNode(id: string): LayoutModule {
  return { type: 'module', id }
}

export function splitLayoutNode(
  direction: string,
  ratio: number,
  first: LayoutNode,
  second: LayoutNode,
): LayoutSplit {
  return {
    type: 'split',
    direction: direction === 'column' ? 'column' : 'row',
    ratio: clamp(Number(ratio) || 50, 20, 80),
    children: [first, second],
  }
}

export function normalizeFreeOrder(value: string[] | undefined): string[] {
  return Array.isArray(value) && value.length === MODULE_IDS.length
    && value.every((id) => (MODULE_IDS as readonly string[]).includes(id))
    && new Set(value).size === MODULE_IDS.length
    ? [...value] : [...DEFAULT_FREE_ORDER]
}

export function normalizeLayoutRows(value: number[] | undefined): number[] {
  const rows = Array.isArray(value) && value.length === 3
    ? value.map(Number) : [...DEFAULT_LAYOUT_ROWS]
  const top = clamp(Number.isFinite(rows[0]) ? rows[0] : 42, 12, 76)
  const maxMiddle = Math.max(6, 88 - top)
  const middle = clamp(Number.isFinite(rows[1]) ? rows[1] : DEFAULT_LAYOUT_ROWS[1], 6, maxMiddle)
  const bottom = Math.max(12, 100 - top - middle)
  return [top, middle, bottom]
}

export function isPreviousDefaultLayoutRows(rows: number[]): boolean {
  return rows.length === PREVIOUS_DEFAULT_LAYOUT_ROWS.length
    && rows.every((value, index) => value === PREVIOUS_DEFAULT_LAYOUT_ROWS[index])
}

export function cloneLayoutTree(node: LayoutNode | null): LayoutNode | null {
  if (!node || typeof node !== 'object') return null
  if (node.type === 'module') return moduleLayoutNode(node.id)
  return splitLayoutNode(
    node.direction,
    node.ratio,
    cloneLayoutTree((node as LayoutSplit).children[0])!,
    cloneLayoutTree((node as LayoutSplit).children[1])!,
  )
}

export function collectLayoutModules(node: LayoutNode | null, result: string[] = []): string[] {
  if (!node) return result
  if (node.type === 'module') {
    result.push(node.id)
    return result
  }
  collectLayoutModules((node as LayoutSplit).children[0], result)
  collectLayoutModules((node as LayoutSplit).children[1], result)
  return result
}

export function normalizeLayoutTree(value: unknown): LayoutNode | null {
  const node = value as LayoutNode | null
  if (!node || typeof node !== 'object') return null
  if (node.type === 'module' && (MODULE_IDS as readonly string[]).includes(node.id)) return moduleLayoutNode(node.id)
  const split = node as LayoutSplit
  if (split.type !== 'split' || !Array.isArray(split.children) || split.children.length !== 2) return null
  const first = normalizeLayoutTree(split.children[0])
  const second = normalizeLayoutTree(split.children[1])
  if (!first || !second) return null
  return splitLayoutNode(split.direction, split.ratio, first, second)
}

export function isCompleteLayoutTree(tree: LayoutNode | null): boolean {
  const modules = collectLayoutModules(tree)
  return modules.length === MODULE_IDS.length
    && modules.every((id) => (MODULE_IDS as readonly string[]).includes(id))
    && new Set(modules).size === MODULE_IDS.length
}

export function replaceLayoutModule(
  tree: LayoutNode | null,
  moduleId: string,
  replacement: LayoutNode,
): LayoutNode | null {
  if (!tree) return null
  if (tree.type === 'module') return tree.id === moduleId ? replacement : tree
  const split = tree as LayoutSplit
  return splitLayoutNode(
    split.direction,
    split.ratio,
    replaceLayoutModule(split.children[0], moduleId, replacement)!,
    replaceLayoutModule(split.children[1], moduleId, replacement)!,
  )
}

export function removeLayoutModule(tree: LayoutNode | null, moduleId: string): LayoutNode | null {
  if (!tree) return null
  if (tree.type === 'module') return tree.id === moduleId ? null : tree
  const split = tree as LayoutSplit
  const first = removeLayoutModule(split.children[0], moduleId)
  const second = removeLayoutModule(split.children[1], moduleId)
  if (!first) return second
  if (!second) return first
  return splitLayoutNode(split.direction, split.ratio, first, second)
}

export function swapLayoutTreeModules(
  tree: LayoutNode | null,
  sourceId: string,
  targetId: string,
): LayoutNode | null {
  if (!isCompleteLayoutTree(tree) || sourceId === targetId) return cloneLayoutTree(tree)
  const marked = replaceLayoutModule(tree, sourceId, moduleLayoutNode('__swap__'))
  const targetSwapped = replaceLayoutModule(marked, targetId, moduleLayoutNode(sourceId))
  return replaceLayoutModule(targetSwapped, '__swap__', moduleLayoutNode(targetId))
}

export function insertLayoutModuleAtEdge(
  tree: LayoutNode | null,
  sourceId: string,
  targetId: string,
  direction: string,
): LayoutNode | null {
  if (!isCompleteLayoutTree(tree) || sourceId === targetId || !(LAYOUT_DIRECTIONS as readonly string[]).includes(direction)) {
    return cloneLayoutTree(tree)
  }
  const withoutSource = removeLayoutModule(cloneLayoutTree(tree), sourceId)
  if (!withoutSource) return cloneLayoutTree(tree)
  const source = moduleLayoutNode(sourceId)
  const target = moduleLayoutNode(targetId)
  const splitDirection = direction === 'left' || direction === 'right' ? 'row' : 'column'
  const replacement = direction === 'left' || direction === 'top'
    ? splitLayoutNode(splitDirection, 50, source, target)
    : splitLayoutNode(splitDirection, 50, target, source)
  return replaceLayoutModule(withoutSource, targetId, replacement)
}

export function insertLayoutModuleAtRootEdge(
  tree: LayoutNode | null,
  sourceId: string,
  direction: string,
): LayoutNode | null {
  if (!isCompleteLayoutTree(tree) || !(LAYOUT_DIRECTIONS as readonly string[]).includes(direction)) {
    return cloneLayoutTree(tree)
  }
  const withoutSource = removeLayoutModule(cloneLayoutTree(tree), sourceId)
  if (!withoutSource) return cloneLayoutTree(tree)
  const source = moduleLayoutNode(sourceId)
  const splitDirection = direction === 'left' || direction === 'right' ? 'row' : 'column'
  return direction === 'left' || direction === 'top'
    ? splitLayoutNode(splitDirection, 50, source, withoutSource)
    : splitLayoutNode(splitDirection, 50, withoutSource, source)
}

export function legacyOrderToLayoutTree(
  order: string[],
  columnPercent = 58,
  rows = DEFAULT_LAYOUT_ROWS,
): LayoutNode {
  const ids = normalizeFreeOrder(order)
  const [top, middle, bottom] = normalizeLayoutRows(rows)
  const left = splitLayoutNode(
    'column',
    top,
    moduleLayoutNode(ids[0]),
    splitLayoutNode('column', middle / Math.max(1, middle + bottom), moduleLayoutNode(ids[1]), moduleLayoutNode(ids[2])),
  )
  return splitLayoutNode('row', columnPercent, left, moduleLayoutNode(ids[3]))
}

export function layoutRootEdgeSize(rect: { width: number; height: number }, direction: string): number {
  const length = direction === 'left' || direction === 'right' ? rect.width : rect.height
  return clamp(length * ROOT_EDGE_DROP_RATIO, ROOT_EDGE_DROP_MIN_PX, ROOT_EDGE_DROP_MAX_PX)
}

export function layoutDropIntent(
  rect: { left: number; top: number; width: number; height: number },
  clientX: number,
  clientY: number,
): { mode: 'swap' } | { mode: 'insert'; direction: string } {
  if (!rect || rect.width <= 0 || rect.height <= 0) return { mode: 'swap' }
  const x = clamp((clientX - rect.left) / rect.width, 0, 1)
  const y = clamp((clientY - rect.top) / rect.height, 0, 1)
  const distances = { left: x, right: 1 - x, top: y, bottom: 1 - y }
  const entries = Object.entries(distances) as [string, number][]
  entries.sort((a, b) => a[1] - b[1])
  const nearest = entries[0]
  return nearest[1] <= MODULE_EDGE_DROP_RATIO
    ? { mode: 'insert', direction: nearest[0] }
    : { mode: 'swap' }
}

export function layoutRootDropIntent(
  rect: { left: number; top: number; width: number; height: number },
  clientX: number,
  clientY: number,
): { mode: 'root-insert'; direction: string } | null {
  if (!rect || rect.width <= 0 || rect.height <= 0) return null
  const x = clamp(clientX - rect.left, 0, rect.width)
  const y = clamp(clientY - rect.top, 0, rect.height)
  const candidates: { direction: string; distance: number; size: number }[] = [
    { direction: 'left', distance: x, size: layoutRootEdgeSize(rect, 'left') },
    { direction: 'right', distance: rect.width - x, size: layoutRootEdgeSize(rect, 'right') },
    { direction: 'top', distance: y, size: layoutRootEdgeSize(rect, 'top') },
    { direction: 'bottom', distance: rect.height - y, size: layoutRootEdgeSize(rect, 'bottom') },
  ].filter((candidate) => candidate.distance <= candidate.size)
  if (!candidates.length) return null
  candidates.sort((a, b) => (a.distance / a.size) - (b.distance / b.size))
  return { mode: 'root-insert', direction: candidates[0].direction }
}

export function layoutDropPreviewRect(
  rect: { left: number; top: number; width: number; height: number },
  intent: { mode: string; direction?: string } | null,
): { left: number; top: number; width: number; height: number } {
  const edge = intent?.mode === 'insert' || intent?.mode === 'root-insert'
    ? intent.direction : null
  const edgeSize = intent?.mode === 'root-insert'
    ? layoutRootEdgeSize(rect, edge!)
    : edge === 'left' || edge === 'right'
      ? rect.width * MODULE_EDGE_DROP_RATIO
      : edge === 'top' || edge === 'bottom'
        ? rect.height * MODULE_EDGE_DROP_RATIO
        : 0
  const width = edge === 'left' || edge === 'right' ? edgeSize : rect.width
  const height = edge === 'top' || edge === 'bottom' ? edgeSize : rect.height
  return {
    left: edge === 'right' ? rect.left + rect.width - width : rect.left,
    top: edge === 'bottom' ? rect.top + rect.height - height : rect.top,
    width,
    height,
  }
}

export function swapFreeLayoutOrder(order: string[], sourceId: string, targetId: string): string[] {
  const next = normalizeFreeOrder(order)
  const sourceIndex = next.indexOf(sourceId)
  const targetIndex = next.indexOf(targetId)
  if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) return next
  ;[next[sourceIndex], next[targetIndex]] = [next[targetIndex], next[sourceIndex]]
  return next
}

export function normalizeLayoutData(value: Record<string, unknown>): {
  schema: string
  preset: string
  splitPercent: number
  columnPercent: number
  rows: number[]
  freeOrder: string[]
  tree: LayoutNode | null
} {
  const source = value && typeof value === 'object' ? value : {}
  const preset = (LAYOUT_PRESETS as readonly string[]).includes(source.preset as string)
    ? (source.preset as string) : DEFAULT_FREE_ORDER[0] === 'player' ? 'wave-right' : 'free'
  const normalizedRows = normalizeLayoutRows(Array.isArray(source.rows) ? source.rows : undefined)
  const rows = preset === 'wave-right' && isPreviousDefaultLayoutRows(normalizedRows)
    ? [...DEFAULT_LAYOUT_ROWS] : normalizedRows
  const columnPercent = clamp(Number(source.columnPercent) || 58, 30, 75)
  const splitPercent = clamp(Number(source.splitPercent) || 60, 35, 75)
  const orderValue = source.freeOrder || source.dockOrder
  const legacyOrder = normalizeFreeOrder(Array.isArray(orderValue) ? orderValue : undefined)
  const candidateTree = normalizeLayoutTree(source.tree || source.layoutTree)
  const tree = isCompleteLayoutTree(candidateTree)
    ? candidateTree
    : legacyOrderToLayoutTree(legacyOrder, columnPercent, rows)
  return {
    schema: LAYOUT_SCHEMA,
    preset: preset as 'classic' | 'wave-right' | 'wave-bottom' | 'free',
    splitPercent,
    columnPercent,
    rows,
    freeOrder: collectLayoutModules(tree),
    tree,
  }
}

export function sameSource(
  a: { name: string; size: number; modified_ms: number } | null | undefined,
  b: { name: string; size: number; modified_ms: number } | null | undefined,
): boolean {
  return !!a && !!b && a.name === b.name && a.size === b.size && a.modified_ms === b.modified_ms
}

export function directionLabel(direction: string): string {
  return { left: '左侧', right: '右侧', top: '上方', bottom: '下方' }[direction] || ''
}

export function bytesToBase64(bytes: Uint8Array): string {
  const chunkSize = 0x8000
  const parts: string[] = []
  for (let i = 0; i < bytes.length; i += chunkSize) {
    parts.push(String.fromCharCode(...bytes.subarray(i, i + chunkSize)))
  }
  return btoa(parts.join(''))
}

export function formatCompact(ms: number): string {
  const safe = Math.max(0, Math.round(ms))
  const hours = Math.floor(safe / 3600000)
  const minutes = Math.floor((safe % 3600000) / 60000)
  const seconds = Math.floor((safe % 60000) / 1000)
  const millis = safe % 1000
  const hh = hours ? `${String(hours).padStart(2, '0')}:` : ''
  return `${hh}${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(millis).padStart(3, '0')}`
}
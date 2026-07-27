// JSON 工程 schema 类型 — 与 JSON_SCHEMA.md 同步

/** 字级时间戳项 */
export interface SegmentItem {
  text: string
  start: number
  end: number
}

/** 表情包 head（首条持完整信息） */
export interface StickerHead {
  name: string
  filename: string
  rel: string
  start: number
  end: number
}

/** 表情包 ref（后续条引用 head） */
export interface StickerRef {
  name: string
  headIdx: number
}

/** 颜色标记 head */
export interface ColorHead {
  name: 'red' | 'yellow' | 'blue' | 'green' | 'purple'
  value: string
  start: number
  end: number
}

/** 颜色标记 ref */
export interface ColorRef {
  name: 'red' | 'yellow' | 'blue' | 'green' | 'purple'
  headIdx: number
}

/** 单条字幕段 */
export interface Segment {
  /** 段起始时间（毫秒） */
  start: number
  /** 段结束时间（毫秒），要求 end > start */
  end: number
  /** 字幕显示文本 */
  text: string
  /** 字级时间戳，可空数组 `[]` */
  items: SegmentItem[]
  /** 表情包 head */
  sticker: StickerHead | null
  /** 引用上方 head 的表情包 */
  sticker_ref: StickerRef | null
  /** 颜色标记 head */
  color: ColorHead | null
  /** 引用上方 head 的颜色 */
  color_ref: ColorRef | null
  /** 是否被人工改过（生成时不要写 true） */
  _dirty?: boolean
  /** 是否禁用（编辑器内部维护） */
  disabled?: boolean
}

// ===== Waveform 波形缓存 =====

export interface WaveformSource {
  name: string
  size: number
  modified_ms: number
}

export interface WaveformPayload {
  schema: 'moy.asr.waveform.v1'
  encoding: 'i8-minmax-base64'
  peaks_per_second: number
  peak_count: number
  duration_ms: number
  data: string
  source?: WaveformSource
}

// ===== Layout 布局 =====

export interface LayoutModule {
  type: 'module'
  id: 'player' | 'panel' | 'cues' | 'wave'
}

export interface LayoutSplit {
  type: 'split'
  direction: 'row' | 'column'
  ratio: number
  children: LayoutNode[]
}

export type LayoutNode = LayoutModule | LayoutSplit

export interface LayoutData {
  schema: 'moy.asr.editor.layout.v1'
  preset: 'classic' | 'wave-right' | 'wave-bottom' | 'free'
  splitPercent: number
  columnPercent: number
  rows: number[]
  freeOrder: string[]
  tree: LayoutNode | null
}

// ===== Gap Remove 空隙移除 =====

export interface GapRemoveGap {
  start: number
  end: number
  removed: boolean
}

export interface GapRemoveData {
  schema: 'moy.asr.gap_remove.v1'
  detector: 'audio_gate' | 'legacy_subtitle_gap'
  minimum_ms: number
  threshold_db: number
  hysteresis_db: number
  lead_in_ms: number
  lead_out_ms: number
  skip_playback: boolean
  manual_corrections: boolean
  operation_mode: 'none' | 'boundary_drag' | 'middle_drag'
  gaps: GapRemoveGap[]
}

// ===== 顶层工程结构 =====

export interface ProjectData {
  /** 字幕段数组（必填） */
  segments: Segment[]
  /** 媒体文件路径 */
  media?: string
  /** 语言代码 */
  language?: string
  /** ASR 模型名 */
  model?: string
  /** 表情包根目录 */
  sticker_root?: string
  /** 波形缓存（可丢弃） */
  waveform?: WaveformPayload
  /** 空隙移除决定 */
  gap_remove?: GapRemoveData
  /** 布局数据 */
  layout?: LayoutData
}
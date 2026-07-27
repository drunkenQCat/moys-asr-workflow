// 编辑器设置类型

export type SplitKey = 'ctrl-enter' | 'enter'

export interface EditorSettings {
  splitKey: SplitKey
  overlayEnabled: boolean
  exportStartAtZero: boolean
  cueListShowIndex: boolean
  cueListShowTime: boolean
  cueListShowSticker: boolean
  cueListShowCharcount: boolean
  cueEditorShowNavigation: boolean
  cueEditorShowSticker: boolean
  hideDisabled: boolean
  charcountThreshold: number
}

// ===== ASR 配置 =====

export interface AsrConfig {
  apiKey: string
  language: string
  model: string
}

// ===== 最近工程 =====

export interface RecentProject {
  name: string
  lastOpenedAt: number
  jsonContent?: string
}
// 波形数据类型

export interface WaveformSettings {
  mode: 'hidden' | 'basic' | 'multi'
  layout: 'classic' | 'wave-right' | 'wave-bottom' | 'free'
  visibleSeconds: number
  secondsPerRow: number
  side: 'left' | 'right'
  splitPercent: number
  layoutColumnPercent: number
  layoutRows: number[]
  freeOrder: string[]
  layoutTree: unknown | null
  layoutEditing: boolean
  waveformScale: number
  disabledDisplay: 'dim' | 'hidden'
}

export interface WaveformCallbacks {
  onSeek?: (timeMs: number) => void
  onSegmentChange?: (index: number, start: number, end: number) => void
  onSelectionChange?: (indexes: number[]) => void
  onTimeUpdate?: (timeMs: number) => void
}
// 波形设置管理 — 迁移自 web/waveform.js 的 readSettings/saveSettings

import { normalizeLayoutData, legacyOrderToLayoutTree } from './pure.js'

const SETTINGS_KEY = 'moy.asr.waveform.settings.v1'
const DEFAULT_LAYOUT_ROWS = [42, 18, 40]
const PREVIOUS_DEFAULT_LAYOUT_ROWS = [42, 27, 31]
const DEFAULT_FREE_ORDER = ['player', 'panel', 'cues', 'wave']
const ZOOM_PRESETS = [5, 10, 20, 30, 60]
const ROW_PRESETS = [5, 10, 20, 30]

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
  layoutTree: any
  layoutEditing: boolean
  waveformScale: number
  disabledDisplay: 'dim' | 'hidden'
}

const DEFAULT_SETTINGS: WaveformSettings = {
  mode: 'basic',
  layout: 'wave-right',
  visibleSeconds: 20,
  secondsPerRow: 10,
  side: 'left',
  splitPercent: 60,
  layoutColumnPercent: 58,
  layoutRows: [...DEFAULT_LAYOUT_ROWS],
  freeOrder: [...DEFAULT_FREE_ORDER],
  layoutTree: null,
  layoutEditing: false,
  waveformScale: 1,
  disabledDisplay: 'dim',
}

export function readSettings(): WaveformSettings {
  try {
    const parsed = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}')
    const legacyLayout = parsed.layout || (
      parsed.mode === 'grid-right' ? 'wave-right' :
        parsed.mode === 'grid-bottom' ? 'wave-bottom' :
          parsed.mode === 'dock' ? 'free' : DEFAULT_SETTINGS.layout
    )
    const legacyMode = ['hidden', 'basic', 'multi'].includes(parsed.mode)
      ? parsed.mode
      : ['grid-right', 'grid-bottom', 'dock'].includes(parsed.mode)
        ? 'multi'
        : DEFAULT_SETTINGS.mode
    const layoutData = normalizeLayoutData({
      preset: legacyLayout,
      splitPercent: parsed.splitPercent,
      columnPercent: parsed.layoutColumnPercent,
      rows: parsed.layoutRows || [parsed.layoutRowPercent, PREVIOUS_DEFAULT_LAYOUT_ROWS[1], PREVIOUS_DEFAULT_LAYOUT_ROWS[2]],
      freeOrder: parsed.freeOrder || parsed.dockOrder,
      tree: parsed.layoutTree || parsed.tree,
    })
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      mode: legacyMode as WaveformSettings['mode'],
      layout: layoutData.preset as WaveformSettings['layout'],
      visibleSeconds: ZOOM_PRESETS.includes(Number(parsed.visibleSeconds))
        ? Number(parsed.visibleSeconds) : DEFAULT_SETTINGS.visibleSeconds,
      secondsPerRow: ROW_PRESETS.includes(Number(parsed.secondsPerRow))
        ? Number(parsed.secondsPerRow) : DEFAULT_SETTINGS.secondsPerRow,
      side: parsed.side === 'right' ? 'right' : 'left',
      splitPercent: layoutData.splitPercent,
      layoutColumnPercent: layoutData.columnPercent,
      layoutRows: layoutData.rows,
      freeOrder: layoutData.freeOrder,
      layoutTree: layoutData.tree,
      layoutEditing: false,
      waveformScale: clampWaveformScale(Number(parsed.waveformScale) || DEFAULT_SETTINGS.waveformScale),
      disabledDisplay: parsed.disabledDisplay === 'hidden' ? 'hidden' : 'dim',
    }
  } catch {
    return {
      ...DEFAULT_SETTINGS,
      layoutTree: legacyOrderToLayoutTree(DEFAULT_FREE_ORDER, DEFAULT_SETTINGS.layoutColumnPercent, DEFAULT_SETTINGS.layoutRows),
    }
  }
}

export function saveSettings(settings: WaveformSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
  } catch {
    // file:// privacy modes may reject localStorage
  }
}

function clamp(value: number, low: number, high: number): number {
  return Math.max(low, Math.min(high, value))
}

function clampWaveformScale(value: number): number {
  const MIN_WAVEFORM_SCALE = 0.25
  const MAX_WAVEFORM_SCALE = 6
  const numeric = Number(value)
  return clamp(Number.isFinite(numeric) ? numeric : 1, MIN_WAVEFORM_SCALE, MAX_WAVEFORM_SCALE)
}
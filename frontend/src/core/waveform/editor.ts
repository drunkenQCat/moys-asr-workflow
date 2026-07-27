// WaveformEditor 类 — 迁移自 web/waveform.js
// 构造函数接受 root 容器，在内部查询 DOM 元素

import { readSettings, saveSettings } from './settings.js'
import type { WaveformCallbacks } from '../../types/waveform.js'

export interface WaveformEditorOptions {
  root: HTMLElement
  callbacks?: WaveformCallbacks
  peaks?: Int8Array | null
}

export class WaveformEditor {
  options: WaveformEditorOptions
  settings: ReturnType<typeof readSettings>
  payload: any
  peaks: Int8Array | null
  callbacks: WaveformCallbacks
  mediaAvailable: boolean
  activeIndex: number

  // DOM refs — set in constructor
  workspace!: HTMLElement | null
  panel!: HTMLElement | null
  playerWrap!: HTMLElement | null
  cues!: HTMLElement | null
  pane!: HTMLElement | null
  scroll!: HTMLElement | null
  content!: HTMLElement | null
  empty!: HTMLElement | null
  status!: HTMLElement | null
  divider!: HTMLElement | null
  secondaryDivider!: HTMLElement | null
  windowLabel!: HTMLElement | null
  waveformScaleLabel!: HTMLElement | null
  waveformScaleDownButton!: HTMLElement | null
  waveformScaleUpButton!: HTMLElement | null
  secondsPerRowSelect!: HTMLSelectElement | null
  sideSelect!: HTMLSelectElement | null
  disabledDisplaySelect!: HTMLSelectElement | null
  layoutPresetSelect!: HTMLSelectElement | null
  layoutEditToggle!: HTMLElement | null
  layoutResetButton!: HTMLElement | null
  layoutPreview!: HTMLElement | null
  layoutResizers!: { column: HTMLElement | null; rowTop: HTMLElement | null; rowMiddle: HTMLElement | null }

  constructor(options: WaveformEditorOptions) {
    this.options = options
    this.settings = readSettings()
    this.payload = null
    this.peaks = options.peaks ?? null
    this.callbacks = options.callbacks ?? {}
    this.mediaAvailable = false
    this.activeIndex = -1

    // Query DOM elements from the root
    this.queryDOMElements()
    this.bindControls()
    this.applyLayout()
  }

  private queryDOMElements(): void {
    const root = this.options.root
    // Use the root's closest ancestor with the editor-workspace pattern
    this.workspace = root.closest('#editor-workspace') || document.getElementById('editor-workspace')
    this.panel = document.getElementById('current-cue-panel')
    this.playerWrap = this.workspace?.querySelector('.player-wrap') || null
    this.cues = document.getElementById('cues-container')
    this.pane = document.getElementById('waveform-pane')
    this.scroll = document.getElementById('waveform-scroll')
    this.content = document.getElementById('waveform-content')
    this.empty = document.getElementById('waveform-empty')
    this.status = document.getElementById('waveform-status')
    this.divider = document.getElementById('workspace-divider')
    this.secondaryDivider = document.getElementById('workspace-divider-secondary')
    this.windowLabel = document.getElementById('waveform-window-label')
    this.waveformScaleLabel = document.getElementById('waveform-scale-label')
    this.waveformScaleDownButton = document.getElementById('waveform-scale-down')
    this.waveformScaleUpButton = document.getElementById('waveform-scale-up')
    this.secondsPerRowSelect = document.getElementById('waveform-seconds-per-row') as HTMLSelectElement | null
    this.sideSelect = document.getElementById('waveform-side') as HTMLSelectElement | null
    this.disabledDisplaySelect = document.getElementById('waveform-disabled-display') as HTMLSelectElement | null
    this.layoutPresetSelect = document.getElementById('layout-preset') as HTMLSelectElement | null
    this.layoutEditToggle = document.getElementById('layout-edit-toggle')
    this.layoutResetButton = document.getElementById('layout-reset')
    this.layoutPreview = document.getElementById('layout-drop-preview')
    this.layoutResizers = {
      column: document.getElementById('layout-resizer-v'),
      rowTop: document.getElementById('layout-resizer-h1'),
      rowMiddle: document.getElementById('layout-resizer-h2'),
    }
  }

  /** setPayload: 设置波形数据 */
  setPayload(payload: any): void {
    this.payload = payload
    this.peaks = payload ? decodePayload(payload) : null
    this.renderSegments()
  }

  /** renderSegments: 渲染字幕块（骨架 — 子类/模块扩展） */
  renderSegments(): void {
    // TODO: 实现 Canvas 渲染
  }

  /** updateSelection: 更新选中状态 */
  updateSelection(): void {
    // TODO: 实现选择高亮更新
  }

  /** updatePlayback: 更新播放位置 */
  updatePlayback(timeMs?: number): void {
    // TODO: 实现播放同步
  }

  /** applyLayout: 应用布局设置 */
  applyLayout(): void {
    if (!this.workspace) return
    const { settings } = this
    this.workspace.style.setProperty('--waveform-split', `${settings.splitPercent}%`)
    this.workspace.style.setProperty('--layout-column', `${settings.layoutColumnPercent}%`)
    const [top, middle, bottom] = settings.layoutRows
    this.workspace.style.setProperty('--layout-row-top', `${top}%`)
    this.workspace.style.setProperty('--layout-row-middle', `${middle}%`)
    this.workspace.style.setProperty('--layout-row-bottom', `${bottom}%`)
    this.workspace.classList.remove('waveform-hidden', 'waveform-basic', 'waveform-multi')
    this.workspace.classList.add(`waveform-${settings.mode}`)
    this.workspace.classList.remove('layout-classic', 'layout-wave-right', 'layout-wave-bottom', 'layout-free')
    this.workspace.classList.add(`layout-${settings.layout}`)
  }

  /** bindControls: 绑定控件事件 */
  bindControls(): void {
    // TODO: 实现控件绑定
  }

  /** destroy: 清理资源 */
  destroy(): void {
    this.payload = null
    this.peaks = null
  }
}

// 复用 pure.ts 中的函数
function decodePayload(payload: any): Int8Array | null {
  // 简单的重新实现，避免循环依赖
  if (!payload || payload.schema !== 'moy.asr.waveform.v1' || payload.encoding !== 'i8-minmax-base64') return null
  if (!Number.isInteger(payload.peak_count) || payload.peak_count <= 0) return null
  if (typeof payload.data !== 'string') return null
  try {
    const binary = atob(payload.data)
    if (binary.length !== payload.peak_count * 2) return null
    const unsigned = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) unsigned[i] = binary.charCodeAt(i)
    return new Int8Array(unsigned.buffer)
  } catch { return null }
}
// WaveformEditor 类 — 迁移自 web/waveform.js
// 构造函数接受 root 容器，在内部查询 DOM 元素

import { readSettings, saveSettings } from './settings.js'
import { decodePayload, sampleInterpolatedPeak, colorForSegment, roundMs } from './pure.js'
import type { SegmentLike } from './pure.js'
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
  basicWindowStartMs: number
  manualFollowUntil: number
  audioContext: AudioContext | null
  resizeObserver: ResizeObserver | null

  // DOM refs
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

  // Canvas
  canvas!: HTMLCanvasElement | null
  ctx!: CanvasRenderingContext2D | null
  segments: SegmentLike[] = []

  // Drag state
  drag: { type: 'seek' | 'cue-move' | 'cue-resize-start' | 'cue-resize-end' | 'boundary' | 'gap-boundary' | 'gap-range'; index: number; startX: number; startTime: number; cueStart: number; cueEnd: number } | null = null

  constructor(options: WaveformEditorOptions) {
    this.options = options
    this.settings = readSettings()
    this.payload = null
    this.peaks = options.peaks ?? null
    this.callbacks = options.callbacks ?? {}
    this.mediaAvailable = false
    this.activeIndex = -1
    this.basicWindowStartMs = 0
    this.manualFollowUntil = 0
    this.audioContext = null
    this.resizeObserver = null

    this.queryDOMElements()
    this.createCanvas()
    this.bindControls()
    this.applyLayout()
    this.startResizeObserver()
  }

  private queryDOMElements(): void {
    const root = this.options.root
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

  private createCanvas(): void {
    if (!this.pane) return
    this.canvas = document.createElement('canvas')
    this.canvas.style.position = 'absolute'
    this.canvas.style.top = '0'
    this.canvas.style.left = '0'
    this.canvas.style.width = '100%'
    this.canvas.style.height = '100%'
    this.canvas.style.pointerEvents = 'none'
    this.pane.appendChild(this.canvas)
    this.ctx = this.canvas.getContext('2d')
    this.resizeCanvas()
    this.bindCanvasEvents()
  }

  private resizeCanvas(): void {
    if (!this.canvas || !this.pane) return
    const rect = this.pane.getBoundingClientRect()
    const dpr = window.devicePixelRatio || 1
    this.canvas.width = rect.width * dpr
    this.canvas.height = rect.height * dpr
    this.canvas.style.width = `${rect.width}px`
    this.canvas.style.height = `${rect.height}px`
    if (this.ctx) this.ctx.scale(dpr, dpr)
  }

  private startResizeObserver(): void {
    if (!this.pane) return
    if (window.ResizeObserver) {
      this.resizeObserver = new ResizeObserver(() => {
        this.resizeCanvas()
        this.renderSegments()
      })
      this.resizeObserver.observe(this.pane)
    } else {
      window.addEventListener('resize', () => {
        this.resizeCanvas()
        this.renderSegments()
      })
    }
  }

  private bindCanvasEvents(): void {
    if (!this.pane) return
    this.pane.addEventListener('pointerdown', (e) => this.onPointerDown(e))
    this.pane.addEventListener('pointermove', (e) => this.onPointerMove(e))
    this.pane.addEventListener('pointerup', () => this.onPointerUp())
    this.pane.addEventListener('pointerleave', () => this.onPointerUp())
    this.pane.addEventListener('wheel', (e) => this.onWheel(e), { passive: false })
  }

  get paneWidth(): number {
    return this.canvas?.width || 0
  }

  get paneHeight(): number {
    return this.canvas?.height || 0
  }

  get visibleMs(): number {
    return (this.settings.visibleSeconds || 10) * 1000
  }

  msToPx(ms: number): number {
    if (!this.canvas) return 0
    return (ms / this.visibleMs) * this.canvas.width
  }

  pxToMs(px: number): number {
    if (!this.canvas) return 0
    return (px / this.canvas.width) * this.visibleMs + this.basicWindowStartMs
  }

  /** 绘制波形基础行 */
  renderSegments(): void {
    if (!this.ctx || !this.canvas) return
    const ctx = this.ctx
    const w = this.canvas.width
    const h = this.canvas.height
    const dpr = window.devicePixelRatio || 1

    ctx.save()
    ctx.clearRect(0, 0, w, h)
    ctx.scale(1 / dpr, 1 / dpr)

    // Canvas 实际像素尺寸
    const cw = w / dpr
    const ch = h / dpr

    if (!this.peaks) {
      ctx.fillStyle = '#333'
      ctx.font = '14px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText('加载媒体后显示波形', cw / 2, ch / 2)
      ctx.restore()
      return
    }

    // 绘制波形
    this.drawWaveform(ctx, cw, ch)

    // 绘制字幕块
    this.drawCueBlocks(ctx, cw, ch)

    // 绘制播放头
    this.drawPlayhead(ctx, ch)

    ctx.restore()
  }

  private drawWaveform(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    if (!this.peaks) return
    const peaks = this.peaks
    const peaksPerSecond = this.payload?.peaks_per_second || 100
    const startMs = this.basicWindowStartMs
    const endMs = startMs + this.visibleMs
    const startPeak = Math.max(0, Math.floor((startMs / 1000) * peaksPerSecond))
    const endPeak = Math.min(Math.floor(peaks.length / 2), Math.ceil((endMs / 1000) * peaksPerSecond))
    const peakCount = endPeak - startPeak
    if (peakCount <= 0) return

    const amplitude = h * 0.36 * (this.settings.waveformScale || 1)
    const midY = h / 2

    ctx.strokeStyle = '#6c63ff'
    ctx.lineWidth = 1
    ctx.beginPath()

    for (let i = 0; i < w; i++) {
      const peakPos = startPeak + (i / w) * peakCount
      const [low, high] = sampleInterpolatedPeak(peaks as any, peakPos, peakCount)
      const top = midY - (Math.abs(low) / 127) * amplitude
      const bottom = midY + (Math.abs(high) / 127) * amplitude
      if (i === 0) ctx.moveTo(i, top)
      else ctx.lineTo(i, top)
      ctx.lineTo(i, bottom)
    }
    ctx.stroke()
  }

  private drawCueBlocks(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    const startMs = this.basicWindowStartMs
    const endMs = startMs + this.visibleMs

    for (let i = 0; i < this.segments.length; i++) {
      const seg = this.segments[i]
      if (seg.start >= endMs || seg.end <= startMs) continue
      const x = this.msToPx(seg.start - startMs)
      const segW = Math.max(2, this.msToPx(seg.end - startMs) - x)
      const isActive = i === this.activeIndex
      const isDisabled = (seg as any).disabled

      ctx.fillStyle = isDisabled ? '#333' : isActive ? 'rgba(108, 99, 255, 0.3)' : 'rgba(108, 99, 255, 0.15)'
      ctx.fillRect(x, 0, segW, h)

      if (isActive) {
        ctx.strokeStyle = '#6c63ff'
        ctx.lineWidth = 2
        ctx.strokeRect(x, 0, segW, h)
      }
    }
  }

  private drawPlayhead(ctx: CanvasRenderingContext2D, h: number): void {
    // 播放头位置由外部通过 updatePlayback 设置
    if (this.drag?.type === 'seek') {
      const x = this.drag.startX
      ctx.strokeStyle = '#fff'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, h)
      ctx.stroke()
    }
  }

  /** 鼠标事件 */
  private onPointerDown(e: PointerEvent): void {
    if (!this.canvas || !this.pane) return
    const rect = this.pane.getBoundingClientRect()
    const x = e.clientX - rect.left
    const timeMs = this.pxToMs(x)

    // 检查是否点击了字幕块
    for (let i = this.segments.length - 1; i >= 0; i--) {
      const seg = this.segments[i]
      const segStart = this.msToPx(seg.start - this.basicWindowStartMs)
      const segEnd = this.msToPx(seg.end - this.basicWindowStartMs)
      if (x >= segStart && x <= segEnd) {
        // 边缘 8px 内为 resize
        const edgePx = 8
        if (x - segStart <= edgePx) {
          this.drag = { type: 'cue-resize-start', index: i, startX: x, startTime: timeMs, cueStart: seg.start, cueEnd: seg.end }
        } else if (segEnd - x <= edgePx) {
          this.drag = { type: 'cue-resize-end', index: i, startX: x, startTime: timeMs, cueStart: seg.start, cueEnd: seg.end }
        } else {
          this.drag = { type: 'cue-move', index: i, startX: x, startTime: timeMs, cueStart: seg.start, cueEnd: seg.end }
        }
        return
      }
    }

    // 点击空白处 → seek
    this.drag = { type: 'seek', index: -1, startX: x, startTime: timeMs, cueStart: 0, cueEnd: 0 }
    this.callbacks.onSeek?.(timeMs)
  }

  private onPointerMove(e: PointerEvent): void {
    if (!this.drag || !this.pane) return
    const rect = this.pane.getBoundingClientRect()
    const x = e.clientX - rect.left
    const timeMs = this.pxToMs(x)

    if (this.drag.type === 'seek') {
      this.drag.startX = x
      this.callbacks.onSeek?.(timeMs)
      this.renderSegments()
    } else if (this.drag.type === 'cue-move') {
      const delta = timeMs - this.drag.startTime
      const newStart = roundMs(this.drag.cueStart + delta)
      const newEnd = roundMs(this.drag.cueEnd + delta)
      this.callbacks.onSegmentChange?.(this.drag.index, newStart, newEnd)
    } else if (this.drag.type === 'cue-resize-start') {
      const newStart = roundMs(Math.min(timeMs, this.drag.cueEnd - 100))
      this.callbacks.onSegmentChange?.(this.drag.index, newStart, this.drag.cueEnd)
    } else if (this.drag.type === 'cue-resize-end') {
      const newEnd = roundMs(Math.max(timeMs, this.drag.cueStart + 100))
      this.callbacks.onSegmentChange?.(this.drag.index, this.drag.cueStart, newEnd)
    }
  }

  private onPointerUp(): void {
    this.drag = null
  }

  private onWheel(e: WheelEvent): void {
    if (e.shiftKey) {
      e.preventDefault()
      const dir = e.deltaY < 0 ? 1 : -1
      const s = Math.max(0.25, Math.min(6, (this.settings.waveformScale || 1) + dir * 0.25))
      this.settings.waveformScale = Number(s.toFixed(2))
      this.updateSettingsToStore?.()
      this.renderSegments()
    }
  }

  /** 更新设置到 store 的回调 */
  updateSettingsToStore: (() => void) | null = null

  /** 设置字幕段数据 */
  setSegments(segments: SegmentLike[]): void {
    this.segments = segments
    this.renderSegments()
  }

  /** 设置播放位置 */
  updatePlayback(timeMs?: number): void {
    if (timeMs === undefined) return
    // 自动滚动窗口
    const windowEnd = this.basicWindowStartMs + this.visibleMs
    if (timeMs < this.basicWindowStartMs || timeMs > windowEnd) {
      this.basicWindowStartMs = Math.max(0, timeMs - this.visibleMs * 0.3)
    }
    this.renderSegments()
  }

  /** 更新选中状态 */
  updateSelection(): void {
    this.renderSegments()
  }

  /** setPayload: 设置波形数据 */
  setPayload(payload: any): void {
    this.payload = payload
    this.peaks = payload ? decodePayload(payload) : null
    this.renderSegments()
  }

  /** 更新波形缩放 */
  changeWaveformScale(direction: number): void {
    const s = Math.max(0.25, Math.min(6, (this.settings.waveformScale || 1) + direction * 0.25))
    this.settings.waveformScale = Number(s.toFixed(2))
    this.renderSegments()
  }

  /** 更新缩放 */
  changeZoom(direction: number): void {
    const presets = [5, 10, 20, 30, 60]
    const current = this.settings.visibleSeconds || 10
    const idx = presets.indexOf(current)
    const next = idx + direction
    if (next >= 0 && next < presets.length) {
      this.settings.visibleSeconds = presets[next]
      this.renderSegments()
    }
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
    this.waveformScaleDownButton?.addEventListener('click', () => this.changeWaveformScale(-1))
    this.waveformScaleUpButton?.addEventListener('click', () => this.changeWaveformScale(1))
  }

  /** destroy: 清理资源 */
  destroy(): void {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect()
      this.resizeObserver = null
    }
    this.canvas?.remove()
    this.canvas = null
    this.ctx = null
    this.payload = null
    this.peaks = null
    this.segments = []
  }
}
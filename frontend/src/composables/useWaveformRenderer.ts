import { ref, computed, watch } from 'vue'
import { decodePayload, sampleInterpolatedPeak, roundMs } from '../core/waveform/pure.js'
import type { Segment } from '../types/project.js'
import type { WaveformSettings, WaveformCallbacks } from '../types/waveform.js'

export interface UseWaveformRendererOptions {
  containerRef: { value: HTMLElement | null }
  settings: () => WaveformSettings
  payload: () => { data: string; peaks_per_second: number; duration_ms: number } | null
  segments: () => Segment[]
  currentTimeMs: () => number
  activeIndex: () => number
  callbacks?: WaveformCallbacks
  autoInit?: boolean
}

export function useWaveformRenderer(options: UseWaveformRendererOptions) {
  const isReady = ref(false)
  let canvas: HTMLCanvasElement | null = null
  let ctx: CanvasRenderingContext2D | null = null
  let resizeObserver: ResizeObserver | null = null
  let drag: {
    type: 'seek' | 'cue-move' | 'cue-resize-start' | 'cue-resize-end'
    index: number
    startX: number
    startTime: number
    cueStart: number
    cueEnd: number
  } | null = null

  const peaks = computed<Int8Array | null>(() => {
    const p = options.payload()
    if (!p) return null
    return decodePayload(p as any)
  })

  const durationMs = computed(() => options.payload()?.duration_ms ?? 0)

  const visibleMs = computed(() => {
    const s = options.settings()
    return (s.visibleSeconds || 10) * 1000
  })

  const secondsPerRow = computed(() => {
    const s = options.settings()
    return s.secondsPerRow || 10
  })

  const waveformScale = computed(() => {
    const s = options.settings()
    return s.waveformScale || 1
  })

  function msToPx(ms: number, rowWidth: number): number {
    return (ms / Math.max(1, visibleMs.value)) * Math.max(1, rowWidth)
  }

  function pxToMs(px: number, rowWidth: number, rowStartMs: number): number {
    return (px / Math.max(1, rowWidth)) * Math.max(1, visibleMs.value) + rowStartMs
  }

  function createCanvas() {
    const root = options.containerRef.value
    if (!root) return
    canvas = document.createElement('canvas')
    canvas.style.position = 'absolute'
    canvas.style.top = '0'
    canvas.style.left = '0'
    canvas.style.width = '100%'
    canvas.style.height = '100%'
    canvas.style.pointerEvents = 'auto'
    root.appendChild(canvas)
    ctx = canvas.getContext('2d')
    resizeCanvas()
  }

  function resizeCanvas() {
    if (!canvas || !options.containerRef.value) return
    const rect = options.containerRef.value.getBoundingClientRect()
    const dpr = window.devicePixelRatio || 1
    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr
    canvas.style.width = `${rect.width}px`
    canvas.style.height = `${rect.height}px`
    if (ctx) ctx.scale(dpr, dpr)
  }

  function startResizeObserver() {
    if (!canvas || !options.containerRef.value) return
    if (window.ResizeObserver) {
      resizeObserver = new ResizeObserver(() => {
        resizeCanvas()
        render()
      })
      resizeObserver.observe(options.containerRef.value)
    } else {
      window.addEventListener('resize', () => {
        resizeCanvas()
        render()
      })
    }
  }

  function bindEvents() {
    if (!canvas) return
    canvas.addEventListener('pointerdown', onPointerDown)
    canvas.addEventListener('mousedown', onPointerDown)
    canvas.addEventListener('pointermove', onPointerMove)
    canvas.addEventListener('mousemove', onPointerMove)
    canvas.addEventListener('pointerup', onPointerUp)
    canvas.addEventListener('mouseup', onPointerUp)
    canvas.addEventListener('pointerleave', onPointerUp)
    canvas.addEventListener('mouseleave', onPointerUp)
    canvas.addEventListener('wheel', onWheel as EventListener, { passive: false })
  }

  function unbindEvents() {
    if (!canvas) return
    canvas.removeEventListener('pointerdown', onPointerDown)
    canvas.removeEventListener('mousedown', onPointerDown)
    canvas.removeEventListener('pointermove', onPointerMove)
    canvas.removeEventListener('mousemove', onPointerMove)
    canvas.removeEventListener('pointerup', onPointerUp)
    canvas.removeEventListener('mouseup', onPointerUp)
    canvas.removeEventListener('pointerleave', onPointerUp)
    canvas.removeEventListener('mouseleave', onPointerUp)
    canvas.removeEventListener('wheel', onWheel as EventListener)
  }

  function getRowGeometry() {
    if (!canvas) return null
    const dpr = window.devicePixelRatio || 1
    const width = Math.max(1, canvas.width / dpr)
    const height = Math.max(1, canvas.height / dpr)
    const rowHeight = Math.max(1, (secondsPerRow.value / Math.max(1, visibleMs.value / 1000)) * height)
    const totalRows = Math.max(1, Math.ceil(durationMs.value / Math.max(1, secondsPerRow.value * 1000)))
    return { width, height, rowHeight, totalRows }
  }

  function rowAtY(y: number): { rowIndex: number; rowStartMs: number } | null {
    const geom = getRowGeometry()
    if (!geom) return null
    const rowIndex = Math.floor(y / geom.rowHeight)
    if (rowIndex < 0 || rowIndex >= geom.totalRows) return null
    return { rowIndex, rowStartMs: rowIndex * secondsPerRow.value * 1000 }
  }

  function timeAtPoint(x: number, y: number): number | null {
    const row = rowAtY(y)
    if (!row) return null
    const geom = getRowGeometry()
    if (!geom) return null
    return pxToMs(x, geom.width, row.rowStartMs)
  }

  function onPointerDown(e: MouseEvent) {
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const clientX = (e as any).clientX ?? 0
    const clientY = (e as any).clientY ?? 0
    const x = clientX - rect.left
    const y = clientY - rect.top
    const timeMs = timeAtPoint(x, y)
    if (timeMs === null) return

    const segments = options.segments()
    for (let i = segments.length - 1; i >= 0; i--) {
      const seg = segments[i]
      if (timeMs < seg.start || timeMs > seg.end) continue
      const row = rowAtY(y)
      if (!row) continue
      const geom = getRowGeometry()
      if (!geom) continue
      const segStartX = msToPx(seg.start - row.rowStartMs, geom.width)
      const segEndX = msToPx(seg.end - row.rowStartMs, geom.width)
      if (x < segStartX || x > segEndX) continue
      const edgePx = 8
      if (x - segStartX <= edgePx) {
        drag = { type: 'cue-resize-start', index: i, startX: x, startTime: timeMs, cueStart: seg.start, cueEnd: seg.end }
      } else if (segEndX - x <= edgePx) {
        drag = { type: 'cue-resize-end', index: i, startX: x, startTime: timeMs, cueStart: seg.start, cueEnd: seg.end }
      } else {
        drag = { type: 'cue-move', index: i, startX: x, startTime: timeMs, cueStart: seg.start, cueEnd: seg.end }
      }
      return
    }

    drag = { type: 'seek', index: -1, startX: x, startTime: timeMs, cueStart: 0, cueEnd: 0 }
    options.callbacks?.onSeek?.(timeMs)
  }

  function onPointerMove(e: MouseEvent) {
    if (!drag || !canvas) return
    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const timeMs = timeAtPoint(x, y)
    if (timeMs === null) return

    if (drag.type === 'seek') {
      drag.startX = x
      options.callbacks?.onSeek?.(timeMs)
      render()
    } else if (drag.type === 'cue-move') {
      const delta = timeMs - drag.startTime
      const newStart = roundMs(drag.cueStart + delta)
      const newEnd = roundMs(drag.cueEnd + delta)
      options.callbacks?.onSegmentChange?.(drag.index, newStart, newEnd)
    } else if (drag.type === 'cue-resize-start') {
      const newStart = roundMs(Math.min(timeMs, drag.cueEnd - 100))
      options.callbacks?.onSegmentChange?.(drag.index, newStart, drag.cueEnd)
    } else if (drag.type === 'cue-resize-end') {
      const newEnd = roundMs(Math.max(timeMs, drag.cueStart + 100))
      options.callbacks?.onSegmentChange?.(drag.index, drag.cueStart, newEnd)
    }
  }

  function onPointerUp() {
    drag = null
  }

  function onWheel(e: WheelEvent) {
    if (e.shiftKey) {
      e.preventDefault()
      const dir = e.deltaY < 0 ? 1 : -1
      const s = Math.max(0.25, Math.min(6, waveformScale.value + dir * 0.25))
      options.callbacks?.onSettingsChange?.({ waveformScale: Number(s.toFixed(2)) })
    }
  }

  function drawWaveformRow(
    ctx: CanvasRenderingContext2D,
    width: number,
    rowHeight: number,
    rowStartMs: number,
  ) {
    if (!peaks.value) return
    const p = options.payload()!
    const peaksPerSecond = p.peaks_per_second
    const startMs = rowStartMs
    const endMs = startMs + visibleMs.value
    const startPeak = Math.max(0, Math.floor((startMs / 1000) * peaksPerSecond))
    const endPeak = Math.min(Math.floor(peaks.value.length / 2), Math.ceil((endMs / 1000) * peaksPerSecond))
    const peakCount = endPeak - startPeak
    if (peakCount <= 0) return

    const amplitude = rowHeight * 0.36 * waveformScale.value
    const midY = rowHeight / 2

    ctx.beginPath()
    for (let i = 0; i < width; i++) {
      const peakPos = startPeak + (i / width) * peakCount
      const [low] = sampleInterpolatedPeak(peaks.value as any, peakPos, peakCount)
      const top = midY - (Math.abs(low) / 127) * amplitude
      if (i === 0) ctx.moveTo(i, top)
      else ctx.lineTo(i, top)
    }
    for (let i = width - 1; i >= 0; i--) {
      const peakPos = startPeak + (i / width) * peakCount
      const [, high] = sampleInterpolatedPeak(peaks.value as any, peakPos, peakCount)
      const bottom = midY + (Math.abs(high) / 127) * amplitude
      ctx.lineTo(i, bottom)
    }
    ctx.closePath()
    ctx.fillStyle = 'rgba(108, 99, 255, 0.5)'
    ctx.fill()
  }

  function drawCueBlocksRow(
    ctx: CanvasRenderingContext2D,
    width: number,
    rowHeight: number,
    rowStartMs: number,
  ) {
    const segments = options.segments()
    const activeIndex = options.activeIndex()
    const endMs = rowStartMs + visibleMs.value
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i]
      if (seg.start >= endMs || seg.end <= rowStartMs) continue
      const x = msToPx(Math.max(0, seg.start - rowStartMs), width)
      const segW = Math.max(2, msToPx(seg.end - rowStartMs, width) - x)
      const isActive = i === activeIndex
      const isDisabled = seg.disabled

      ctx.fillStyle = isDisabled
        ? 'rgba(100, 100, 100, 0.3)'
        : isActive
          ? 'rgba(108, 99, 255, 0.35)'
          : 'rgba(108, 99, 255, 0.15)'
      ctx.fillRect(x, 0, segW, rowHeight)

      if (isActive) {
        ctx.strokeStyle = '#6c63ff'
        ctx.lineWidth = 2
        ctx.strokeRect(x, 0, segW, rowHeight)
      }

      if (seg.text) {
        ctx.fillStyle = isDisabled ? '#888' : '#e0e0e0'
        ctx.font = '11px sans-serif'
        const text = seg.text.length > 40 ? seg.text.slice(0, 40) + '…' : seg.text
        const textX = Math.max(x + 4, 4)
        const maxWidth = Math.max(0, segW - 8)
        ctx.fillText(text, textX, rowHeight / 2 + 4, maxWidth)
      }
    }
  }

  function drawPlayheadRow(
    ctx: CanvasRenderingContext2D,
    width: number,
    rowHeight: number,
    rowStartMs: number,
  ) {
    const currentTime = options.currentTimeMs()
    if (currentTime < rowStartMs || currentTime > rowStartMs + visibleMs.value) return
    const x = msToPx(currentTime - rowStartMs, width)
    ctx.strokeStyle = '#fff'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x, rowHeight)
    ctx.stroke()
  }

  function render() {
    if (!ctx || !canvas) return
    const geom = getRowGeometry()
    if (!geom) return
    const { width, height, rowHeight, totalRows } = geom
    const dpr = window.devicePixelRatio || 1

    ctx.save()
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.scale(1 / dpr, 1 / dpr)

    if (!peaks.value) {
      ctx.fillStyle = '#333'
      ctx.font = '14px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText('加载媒体后显示波形', width / 2, height / 2)
      ctx.restore()
      return
    }

    for (let row = 0; row < totalRows; row++) {
      const rowStartMs = row * secondsPerRow.value * 1000
      const y = row * rowHeight
      ctx.save()
      ctx.translate(0, y)
      ctx.beginPath()
      ctx.rect(0, 0, width, rowHeight)
      ctx.clip()

      ctx.fillStyle = row % 2 === 0 ? 'rgba(255,255,255,0.01)' : 'rgba(255,255,255,0.03)'
      ctx.fillRect(0, 0, width, rowHeight)

      const timeLabel = formatCompact(rowStartMs)
      ctx.fillStyle = '#666'
      ctx.font = '10px sans-serif'
      ctx.textAlign = 'left'
      ctx.fillText(timeLabel, 4, 12)

      drawWaveformRow(ctx, width, rowHeight, rowStartMs)
      drawCueBlocksRow(ctx, width, rowHeight, rowStartMs)
      drawPlayheadRow(ctx, width, rowHeight, rowStartMs)

      ctx.strokeStyle = '#333'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(0, rowHeight)
      ctx.lineTo(width, rowHeight)
      ctx.stroke()

      ctx.restore()
    }

    ctx.restore()
  }

  function init() {
    if (!options.containerRef.value) return
    if (!canvas) {
      createCanvas()
      bindEvents()
    }
    startResizeObserver()
    isReady.value = true
    render()
  }

  function destroy() {
    unbindEvents()
    if (resizeObserver) {
      resizeObserver.disconnect()
      resizeObserver = null
    }
    if (canvas) {
      canvas.remove()
      canvas = null
    }
    ctx = null
    isReady.value = false
  }

  function updateSelection() {
    render()
  }

  function updatePlayback() {
    render()
  }

  watch(
    [() => options.payload(), () => options.segments(), () => options.settings(), () => options.activeIndex(), () => options.currentTimeMs()],
    () => render(),
    { deep: true },
  )

  if (options.autoInit !== false) {
    init()
  }

  return {
    isReady,
    init,
    render,
    updateSelection,
    updatePlayback,
    destroy,
    bindEvents,
  }
}

function formatCompact(ms: number): string {
  const safe = Math.max(0, Math.round(ms))
  const hours = Math.floor(safe / 3600000)
  const minutes = Math.floor((safe % 3600000) / 60000)
  const seconds = Math.floor((safe % 60000) / 1000)
  const millis = safe % 1000
  const hh = hours ? `${String(hours).padStart(2, '0')}:` : ''
  return `${hh}${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(millis).padStart(3, '0')}`
}

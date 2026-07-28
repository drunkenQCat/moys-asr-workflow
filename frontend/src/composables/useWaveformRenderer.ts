import { ref, computed, watch } from 'vue'
import { decodePayload, roundMs } from '../core/waveform/pure.js'
import {
  getRowGeometry,
  rowAtY,
  timeAtPoint,
  msToPx,
  renderWaveform,
} from '../core/waveform/render.js'
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

  function getCanvasPoint(e: MouseEvent): { x: number; y: number } | null {
    if (!canvas) return null
    const rect = canvas.getBoundingClientRect()
    const clientX = (e as any).clientX ?? 0
    const clientY = (e as any).clientY ?? 0
    return { x: clientX - rect.left, y: clientY - rect.top }
  }

  function resolveCueDrag(x: number, y: number, timeMs: number): typeof drag {
    if (!canvas) return null
    const segments = options.segments()
    for (let i = segments.length - 1; i >= 0; i--) {
      const seg = segments[i]
      if (timeMs < seg.start || timeMs > seg.end) continue
      const row = rowAtY(y, canvas, visibleMs.value / 1000, secondsPerRow.value, durationMs.value)
      if (!row) continue
      const geom = getRowGeometry(canvas, visibleMs.value / 1000, secondsPerRow.value, durationMs.value)
      if (!geom) continue
      const segStartX = msToPx(seg.start - row.rowStartMs, geom.width, visibleMs.value)
      const segEndX = msToPx(seg.end - row.rowStartMs, geom.width, visibleMs.value)
      if (x < segStartX || x > segEndX) continue
      const edgePx = 8
      if (x - segStartX <= edgePx) {
        return { type: 'cue-resize-start', index: i, startX: x, startTime: timeMs, cueStart: seg.start, cueEnd: seg.end }
      } else if (segEndX - x <= edgePx) {
        return { type: 'cue-resize-end', index: i, startX: x, startTime: timeMs, cueStart: seg.start, cueEnd: seg.end }
      } else {
        return { type: 'cue-move', index: i, startX: x, startTime: timeMs, cueStart: seg.start, cueEnd: seg.end }
      }
    }
    return null
  }

  function onPointerDown(e: MouseEvent) {
    if (!canvas) return
    const point = getCanvasPoint(e)
    if (!point) return
    const timeMs = timeAtPoint(point.x, point.y, canvas, visibleMs.value / 1000, secondsPerRow.value, durationMs.value)
    if (timeMs === null) return

    const cueDrag = resolveCueDrag(point.x, point.y, timeMs)
    if (cueDrag) {
      drag = cueDrag
      return
    }

    drag = { type: 'seek', index: -1, startX: point.x, startTime: timeMs, cueStart: 0, cueEnd: 0 }
    options.callbacks?.onSeek?.(timeMs)
  }

  function onPointerMove(e: MouseEvent) {
    if (!drag || !canvas) return
    const point = getCanvasPoint(e)
    if (!point) return
    const timeMs = timeAtPoint(point.x, point.y, canvas, visibleMs.value / 1000, secondsPerRow.value, durationMs.value)
    if (timeMs === null) return

    if (drag.type === 'seek') {
      drag.startX = point.x
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

  function render() {
    if (!ctx || !canvas) return
    renderWaveform({
      ctx,
      canvas,
      peaks: peaks.value,
      payload: options.payload(),
      segments: options.segments(),
      activeIndex: options.activeIndex(),
      currentTimeMs: options.currentTimeMs(),
      settings: {
        visibleSeconds: visibleMs.value / 1000,
        secondsPerRow: secondsPerRow.value,
        waveformScale: waveformScale.value,
      },
    })
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

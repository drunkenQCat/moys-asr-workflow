import { sampleInterpolatedPeak } from './pure.js'
import type { Segment } from '../../types/project.js'

export interface RowGeometry {
  width: number
  height: number
  rowHeight: number
  totalRows: number
}

export interface RowPosition {
  rowIndex: number
  rowStartMs: number
}

export interface RenderContext {
  ctx: CanvasRenderingContext2D
  canvas: HTMLCanvasElement
  peaks: Int8Array | null
  payload: { data: string; peaks_per_second: number; duration_ms: number } | null
  segments: Segment[]
  activeIndex: number
  currentTimeMs: number
  settings: {
    visibleSeconds: number
    secondsPerRow: number
    waveformScale: number
  }
}

export function getRowGeometry(
  canvas: HTMLCanvasElement,
  visibleSeconds: number,
  secondsPerRow: number,
  durationMs: number,
): RowGeometry | null {
  const dpr = window.devicePixelRatio || 1
  const width = Math.max(1, canvas.width / dpr)
  const height = Math.max(1, canvas.height / dpr)
  const visibleMs = Math.max(1, visibleSeconds * 1000)
  const rowHeight = Math.max(1, (secondsPerRow / (visibleMs / 1000)) * height)
  const totalRows = Math.max(1, Math.ceil(durationMs / Math.max(1, secondsPerRow * 1000)))
  return { width, height, rowHeight, totalRows }
}

export function msToPx(ms: number, rowWidth: number, visibleMs: number): number {
  return (ms / Math.max(1, visibleMs)) * Math.max(1, rowWidth)
}

export function pxToMs(px: number, rowWidth: number, visibleMs: number, rowStartMs: number): number {
  return (px / Math.max(1, rowWidth)) * Math.max(1, visibleMs) + rowStartMs
}

export function rowAtY(
  y: number,
  canvas: HTMLCanvasElement,
  visibleSeconds: number,
  secondsPerRow: number,
  durationMs: number,
): RowPosition | null {
  const geom = getRowGeometry(canvas, visibleSeconds, secondsPerRow, durationMs)
  if (!geom) return null
  const rowIndex = Math.floor(y / geom.rowHeight)
  if (rowIndex < 0 || rowIndex >= geom.totalRows) return null
  return { rowIndex, rowStartMs: rowIndex * secondsPerRow * 1000 }
}

export function timeAtPoint(
  x: number,
  y: number,
  canvas: HTMLCanvasElement,
  visibleSeconds: number,
  secondsPerRow: number,
  durationMs: number,
): number | null {
  const row = rowAtY(y, canvas, visibleSeconds, secondsPerRow, durationMs)
  if (!row) return null
  const geom = getRowGeometry(canvas, visibleSeconds, secondsPerRow, durationMs)
  if (!geom) return null
  return pxToMs(x, geom.width, visibleSeconds * 1000, row.rowStartMs)
}

export function drawWaveformRow(
  ctx: CanvasRenderingContext2D,
  width: number,
  rowHeight: number,
  rowStartMs: number,
  peaks: Int8Array | null,
  payload: { data: string; peaks_per_second: number; duration_ms: number } | null,
  visibleSeconds: number,
  waveformScale: number,
): void {
  if (!peaks || !payload) return
  const peaksPerSecond = payload.peaks_per_second
  const visibleMs = visibleSeconds * 1000
  const startMs = rowStartMs
  const endMs = startMs + visibleMs
  const startPeak = Math.max(0, Math.floor((startMs / 1000) * peaksPerSecond))
  const endPeak = Math.min(Math.floor(peaks.length / 2), Math.ceil((endMs / 1000) * peaksPerSecond))
  const peakCount = endPeak - startPeak
  if (peakCount <= 0) return

  const amplitude = rowHeight * 0.36 * waveformScale
  const midY = rowHeight / 2

  ctx.beginPath()
  for (let i = 0; i < width; i++) {
    const peakPos = startPeak + (i / width) * peakCount
    const [low] = sampleInterpolatedPeak(peaks as any, peakPos, peakCount)
    const top = midY - (Math.abs(low) / 127) * amplitude
    if (i === 0) ctx.moveTo(i, top)
    else ctx.lineTo(i, top)
  }
  for (let i = width - 1; i >= 0; i--) {
    const peakPos = startPeak + (i / width) * peakCount
    const [, high] = sampleInterpolatedPeak(peaks as any, peakPos, peakCount)
    const bottom = midY + (Math.abs(high) / 127) * amplitude
    ctx.lineTo(i, bottom)
  }
  ctx.closePath()
  ctx.fillStyle = 'rgba(108, 99, 255, 0.5)'
  ctx.fill()
}

export function drawCueBlocksRow(
  ctx: CanvasRenderingContext2D,
  width: number,
  rowHeight: number,
  rowStartMs: number,
  segments: Segment[],
  activeIndex: number,
  visibleSeconds: number,
): void {
  const visibleMs = visibleSeconds * 1000
  const endMs = rowStartMs + visibleMs
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i]
    if (seg.start >= endMs || seg.end <= rowStartMs) continue
    const x = msToPx(Math.max(0, seg.start - rowStartMs), width, visibleMs)
    const segW = Math.max(2, msToPx(seg.end - rowStartMs, width, visibleMs) - x)
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

export function drawPlayheadRow(
  ctx: CanvasRenderingContext2D,
  width: number,
  rowHeight: number,
  rowStartMs: number,
  currentTimeMs: number,
  visibleSeconds: number,
): void {
  const visibleMs = visibleSeconds * 1000
  if (currentTimeMs < rowStartMs || currentTimeMs > rowStartMs + visibleMs) return
  const x = msToPx(currentTimeMs - rowStartMs, width, visibleMs)
  ctx.strokeStyle = '#fff'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(x, 0)
  ctx.lineTo(x, rowHeight)
  ctx.stroke()
}

export function renderWaveform(rc: RenderContext): void {
  const { ctx, canvas, peaks, segments, activeIndex, currentTimeMs, settings, payload } = rc
  const { visibleSeconds, secondsPerRow } = settings
  const durationMs = payload?.duration_ms ?? 0
  const geom = getRowGeometry(canvas, visibleSeconds, secondsPerRow, durationMs)
  if (!geom) return
  const { width, height, rowHeight, totalRows } = geom
  const dpr = window.devicePixelRatio || 1

  ctx.save()
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.scale(1 / dpr, 1 / dpr)

  if (!peaks) {
    ctx.fillStyle = '#333'
    ctx.font = '14px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('加载媒体后显示波形', width / 2, height / 2)
    ctx.restore()
    return
  }

  for (let row = 0; row < totalRows; row++) {
    const rowStartMs = row * secondsPerRow * 1000
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

    drawWaveformRow(ctx, width, rowHeight, rowStartMs, peaks, payload, visibleSeconds, settings.waveformScale)
    drawCueBlocksRow(ctx, width, rowHeight, rowStartMs, segments, activeIndex, visibleSeconds)
    drawPlayheadRow(ctx, width, rowHeight, rowStartMs, currentTimeMs, visibleSeconds)

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

export function formatCompact(ms: number): string {
  const safe = Math.max(0, Math.round(ms))
  const hours = Math.floor(safe / 3600000)
  const minutes = Math.floor((safe % 3600000) / 60000)
  const seconds = Math.floor((safe % 60000) / 1000)
  const millis = safe % 1000
  const hh = hours ? `${String(hours).padStart(2, '0')}:` : ''
  return `${hh}${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(millis).padStart(3, '0')}`
}

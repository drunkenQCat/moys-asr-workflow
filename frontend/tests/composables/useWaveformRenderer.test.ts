// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useWaveformRenderer } from '../../src/composables/useWaveformRenderer.js'
import { setupAllMocks } from '../fixtures/waveform-dom.js'

describe('useWaveformRenderer', () => {
  beforeEach(() => {
    setupAllMocks()
  })

  function makePayload() {
    return {
      schema: 'moy.asr.waveform.v1' as const,
      encoding: 'i8-minmax-base64' as const,
      peaks_per_second: 100,
      peak_count: 2,
      duration_ms: 20000,
      data: btoa(String.fromCharCode(0x81, 0x7f, 0xf6, 0x0a)),
    }
  }

  function mountRenderer(overrides = {}) {
    const container = document.getElementById('waveform-pane')!
    const settings = { mode: 'multi' as const, layout: 'wave-right' as const, visibleSeconds: 10, secondsPerRow: 10, waveformScale: 1, side: 'left' as const, splitPercent: 60, layoutColumnPercent: 58, layoutRows: [42, 18, 40], freeOrder: ['player', 'panel', 'cues', 'wave'], layoutTree: null, layoutEditing: false, disabledDisplay: 'dim' as const }
    return useWaveformRenderer({
      containerRef: { value: container },
      settings: () => settings,
      payload: () => makePayload(),
      segments: () => [],
      currentTimeMs: () => 0,
      activeIndex: () => -1,
      callbacks: {},
      autoInit: false,
      ...overrides,
    })
  }

  it('initializes and reports ready after init()', () => {
    const { isReady, init } = mountRenderer()
    init()
    expect(isReady.value).toBe(true)
  })

  it('calls onSeek callback from onPointerDown', () => {
    const onSeek = vi.fn()
    ;(window as any).__mawWaveformDebug = true
    const container = document.createElement('div')
    container.id = 'waveform-pane'
    container.style.width = '100px'
    container.style.height = '100px'
    document.body.appendChild(container)
    const settings = { mode: 'multi' as const, layout: 'wave-right' as const, visibleSeconds: 10, secondsPerRow: 10, waveformScale: 1, side: 'left' as const, splitPercent: 60, layoutColumnPercent: 58, layoutRows: [42, 18, 40], freeOrder: ['player', 'panel', 'cues', 'wave'], layoutTree: null, layoutEditing: false, disabledDisplay: 'dim' as const }
    const renderer = useWaveformRenderer({
      containerRef: { value: container },
      settings: () => settings,
      payload: () => makePayload(),
      segments: () => [],
      currentTimeMs: () => 0,
      activeIndex: () => -1,
      callbacks: { onSeek },
      autoInit: false,
    })
    renderer.init()
    const canvas = container.querySelector('canvas') as HTMLCanvasElement
    expect(canvas).not.toBeNull()
    // 给 canvas 设置固定宽高，让 getRowGeometry 得到合理值
    canvas.width = 100
    canvas.height = 100
    const rect = { left: 0, top: 0, width: 100, height: 100 }
    canvas.getBoundingClientRect = vi.fn(() => rect as DOMRect)
    renderer.bindEvents()
    const event = new MouseEvent('mousedown', { clientX: 50, clientY: 50, bubbles: true })
    canvas.dispatchEvent(event)
    expect(onSeek).toHaveBeenCalled()
  })

  it('renders without error with payload', () => {
    const { render } = mountRenderer()
    expect(() => render()).not.toThrow()
  })
})

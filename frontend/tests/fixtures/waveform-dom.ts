// DOM fixture for WaveformEditor tests — mirrors the DOM structure waveform.js expects
// The fixture is a plain HTML string injected into jsdom's document.body

import { vi } from 'vitest'

export function createWaveformDOM(): string {
  return `
<div id="editor-workspace">
  <div class="player-wrap"></div>
</div>
<div id="current-cue-panel"></div>
<div id="cues-container"></div>
<div id="waveform-pane" tabindex="0">
  <div id="waveform-scroll">
    <div id="waveform-content"></div>
  </div>
  <div id="waveform-empty">加载媒体后显示波形</div>
  <div id="waveform-status"></div>
</div>
<div id="workspace-divider"></div>
<div id="workspace-divider-secondary"></div>

<!-- Controls -->
<div id="waveform-window-label"></div>
<div id="waveform-scale-label"></div>
<button id="waveform-scale-down">-</button>
<button id="waveform-scale-up">+</button>
<select id="waveform-seconds-per-row"><option>10</option></select>
<select id="waveform-side"><option value="left">left</option></select>
<select id="waveform-disabled-display"><option value="dim">dim</option></select>

<!-- Layout -->
<select id="layout-preset"><option value="wave-right">wave-right</option></select>
<button id="layout-edit-toggle">edit</button>
<button id="layout-reset">reset</button>
<div id="layout-drop-preview"></div>
<div id="layout-resizer-v"></div>
<div id="layout-resizer-h1"></div>
<div id="layout-resizer-h2"></div>

<!-- Zoom -->
<button id="waveform-zoom-in">+</button>
<button id="waveform-zoom-out">-</button>
<div id="waveform-window-setting"></div>
<div id="waveform-seconds-per-row-setting"></div>
`
}

export function setupWaveformDOM(): void {
  document.body.innerHTML = createWaveformDOM()
}

export function setupCanvasMock(): void {
  // Mock Canvas getContext
  HTMLCanvasElement.prototype.getContext = vi.fn(function (this: HTMLCanvasElement) {
    return {
      fillRect: vi.fn(),
      clearRect: vi.fn(),
      fillText: vi.fn(),
      measureText: vi.fn(() => ({ width: 10 })),
      beginPath: vi.fn(),
      closePath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      fill: vi.fn(),
      arc: vi.fn(),
      rect: vi.fn(),
      strokeRect: vi.fn(),
      clip: vi.fn(),
      setLineDash: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      scale: vi.fn(),
      translate: vi.fn(),
      rotate: vi.fn(),
      canvas: this,
      getImageData: vi.fn(() => ({ data: new Uint8ClampedArray(4) })),
      putImageData: vi.fn(),
      createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
    } as any
  })
}

export function setupResizeObserverMock(): void {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as any
}

export function setupPointerEventPolyfill(): void {
  if (typeof globalThis.PointerEvent === 'undefined') {
    globalThis.PointerEvent = class PointerEvent extends MouseEvent {
      constructor(type: string, init?: MouseEventInit) {
        super(type, init)
      }
    } as any
  }
}

export function setupLocalStorageMock(): void {
  const store: Record<string, string> = {}
  globalThis.localStorage = {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, val: string) => { store[key] = val },
    removeItem: (key: string) => { delete store[key] },
    clear: () => { for (const k in store) delete store[k] },
    get length() { return Object.keys(store).length },
    key: () => null,
  } as any
}

export function setupAllMocks(): void {
  setupWaveformDOM()
  setupCanvasMock()
  setupResizeObserverMock()
  setupPointerEventPolyfill()
  setupLocalStorageMock()
}
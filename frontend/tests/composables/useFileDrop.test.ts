// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useProjectStore } from '../../src/stores/project.js'
import { useUiStore } from '../../src/stores/ui.js'
import { useFileDrop } from '../../src/composables/useFileDrop.js'

beforeEach(() => {
  vi.stubGlobal('URL', {
    createObjectURL: vi.fn(() => 'blob:test'),
    revokeObjectURL: vi.fn(),
  })
})

function setup() {
  const pinia = createPinia()
  setActivePinia(pinia)
  const project = useProjectStore()
  const ui = useUiStore()
  const drop = useFileDrop()
  drop.init()
  return { project, ui, drop }
}

function dispatchDrop(files: File[]) {
  const dropEvent = new Event('drop')
  Object.defineProperty(dropEvent, 'dataTransfer', {
    value: { files },
  })
  window.dispatchEvent(dropEvent)
}

describe('useFileDrop', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('loads JSON file on drop', async () => {
    const { project } = setup()
    const jsonContent = JSON.stringify({
      segments: [{ start: 0, end: 1000, text: '测试', items: [], sticker: null, sticker_ref: null, color: null, color_ref: null }],
    })
    const file = new File([jsonContent], 'test.json', { type: 'application/json' })
    dispatchDrop([file])
    await new Promise(r => setTimeout(r, 50))
    expect(project.segments.length).toBe(1)
    expect(project.segments[0].text).toBe('测试')
  })

  it('loads media file on drop', async () => {
    const { project } = setup()
    const file = new File(['fake'], 'video.mp4', { type: 'video/mp4' })
    dispatchDrop([file])
    await new Promise(r => setTimeout(r, 50))
    expect(project.mediaName).toBe('video.mp4')
  })

  it('resets drag counter on drop', async () => {
    const { ui } = setup()
    ui.incrementDrag()
    ui.incrementDrag()
    expect(ui.dragCounter).toBe(2)
    const file = new File(['fake'], 'video.mp4', { type: 'video/mp4' })
    dispatchDrop([file])
    await new Promise(r => setTimeout(r, 10))
    expect(ui.dragCounter).toBe(0)
    expect(ui.dragOverlayVisible).toBe(false)
  })
})

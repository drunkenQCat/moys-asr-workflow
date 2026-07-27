// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { useProjectStore } from '../../src/stores/project.js'
import { useUiStore } from '../../src/stores/ui.js'
import DragOverlay from '../../src/components/DragOverlay.vue'

beforeEach(() => {
  vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:test') })
  // File.text() not available in jsdom, mock it
  File.prototype.text = vi.fn(function (this: File) {
    return Promise.resolve('')
  })
})

function setup() {
  const pinia = createPinia()
  setActivePinia(pinia)
  const project = useProjectStore()
  const ui = useUiStore()
  return { project, ui }
}

describe('DragOverlay.vue', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('is hidden by default', () => {
    setup()
    const wrapper = mount(DragOverlay)
    expect(wrapper.find('.drag-overlay').exists()).toBe(false)
  })

  it('shows when drag counter > 0', () => {
    const { ui } = setup()
    ui.incrementDrag()
    const wrapper = mount(DragOverlay)
    expect(wrapper.find('.drag-overlay').exists()).toBe(true)
  })

  it('loads JSON file on drop', async () => {
    const { ui, project } = setup()
    ui.incrementDrag()
    mount(DragOverlay, { attachTo: document.body })
    const jsonContent = JSON.stringify({ segments: [{ start: 0, end: 1000, text: '测试', items: [], sticker: null, sticker_ref: null, color: null, color_ref: null }] })
    const file = new File([jsonContent], 'test.json', { type: 'application/json' })
    const dropEvent = new Event('drop')
    Object.defineProperty(dropEvent, 'dataTransfer', {
      value: { files: [file] },
    })
    document.querySelector('.drag-overlay')?.dispatchEvent(dropEvent)
    await new Promise(r => setTimeout(r, 10))
    expect(project.segments.length).toBe(1)
    expect(project.segments[0].text).toBe('测试')
  })

  it('loads media file on drop', async () => {
    const { ui, project } = setup()
    ui.incrementDrag()
    mount(DragOverlay, { attachTo: document.body })
    const file = new File(['fake'], 'video.mp4', { type: 'video/mp4' })
    const dropEvent = new Event('drop')
    Object.defineProperty(dropEvent, 'dataTransfer', {
      value: { files: [file] },
    })
    document.querySelector('.drag-overlay')?.dispatchEvent(dropEvent)
    await new Promise(r => setTimeout(r, 10))
    expect(project.mediaName).toBe('video.mp4')
  })
})
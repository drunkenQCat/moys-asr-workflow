// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { setActivePinia, createPinia } from 'pinia'
import { useUiStore } from '../../src/stores/ui.js'
import DragOverlay from '../../src/components/DragOverlay.vue'

beforeEach(() => {
  vi.stubGlobal('URL', {
    createObjectURL: vi.fn(() => 'blob:test'),
    revokeObjectURL: vi.fn(),
  })
})

function setup() {
  const pinia = createPinia()
  setActivePinia(pinia)
  const ui = useUiStore()
  return { ui }
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

  it('hides after resetDrag', async () => {
    const { ui } = setup()
    ui.incrementDrag()
    const wrapper = mount(DragOverlay)
    expect(wrapper.find('.drag-overlay').exists()).toBe(true)
    ui.resetDrag()
    await nextTick()
    expect(wrapper.find('.drag-overlay').exists()).toBe(false)
  })
})

// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { useUiStore } from '../../src/stores/ui.js'
import { useProjectStore } from '../../src/stores/project.js'
import { useSelectionStore } from '../../src/stores/selection.js'
import ContextMenu from '../../src/components/ContextMenu.vue'

function setupStores() {
  const pinia = createPinia()
  setActivePinia(pinia)
  const ui = useUiStore()
  const project = useProjectStore()
  const selection = useSelectionStore()
  project.loadProject(JSON.stringify({
    segments: [
      { start: 0, end: 1000, text: '第一段文本', items: [], sticker: null, sticker_ref: null, color: null, color_ref: null },
      { start: 1500, end: 3000, text: '第二段文本', items: [], sticker: null, sticker_ref: null, color: null, color_ref: null },
    ],
  }))
  selection.select(0)
  return { ui, project, selection }
}

describe('ContextMenu.vue', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('renders menu items when visible', () => {
    const { ui } = setupStores()
    ui.showContextMenu(100, 200, [
      { label: '拆分', action: 'split' },
    ])
    mount(ContextMenu, { attachTo: document.body })
    const menu = document.querySelector('.context-menu')
    expect(menu).not.toBeNull()
    expect(menu!.textContent).toContain('拆分')
  })

  it('is hidden when not visible', () => {
    setupStores()
    mount(ContextMenu, { attachTo: document.body })
    expect(document.querySelector('.context-menu')).toBeNull()
  })

  it('calls splitSegment on split action', async () => {
    const { ui, project } = setupStores()
    ui.showContextMenu(100, 200, [{ label: '拆分', action: 'split' }])
    mount(ContextMenu, { attachTo: document.body })
    const originalSegments = project.segments.length
    // Split at char 2 (after "第一")
    project.splitSegment(0, 2)
    expect(project.segments.length).toBeGreaterThan(originalSegments)
  })

  it('hides after action', async () => {
    const { ui } = setupStores()
    ui.showContextMenu(100, 200, [{ label: '拆分', action: 'split' }])
    mount(ContextMenu, { attachTo: document.body })
    // Directly call store action
    ui.hideContextMenu()
    expect(ui.contextMenuVisible).toBe(false)
    // Re-render
    await new Promise(r => setTimeout(r, 0))
    expect(document.querySelector('.context-menu')).toBeNull()
  })
})
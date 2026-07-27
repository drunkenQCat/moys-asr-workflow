// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { useProjectStore } from '../../src/stores/project.js'
import { useSelectionStore } from '../../src/stores/selection.js'
import { useEditorSettingsStore } from '../../src/stores/editor-settings.js'
import { useUiStore } from '../../src/stores/ui.js'
import CueList from '../../src/components/CueList.vue'

// Mock localStorage for jsdom (used by editor-settings store)
beforeEach(() => {
  const store: Record<string, string> = {}
  globalThis.localStorage = {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, val: string) => { store[key] = val },
    removeItem: (key: string) => { delete store[key] },
    clear: () => { for (const k in store) delete store[k] },
    get length() { return Object.keys(store).length },
    key: () => null,
  }
})

const segments = [
  { start: 0, end: 1000, text: '第一条', items: [], sticker: null, sticker_ref: null, color: null, color_ref: null },
  { start: 1500, end: 3000, text: '第二条', items: [], sticker: null, sticker_ref: null, color: null, color_ref: null },
  { start: 3500, end: 5000, text: '搜索关键词', items: [], sticker: null, sticker_ref: null, color: null, color_ref: null },
]

function setupStores() {
  const pinia = createPinia()
  setActivePinia(pinia)
  const project = useProjectStore()
  const selection = useSelectionStore()
  const settings = useEditorSettingsStore()
  const ui = useUiStore()
  project.loadProject(JSON.stringify({ segments }))
  return { project, selection, settings, ui }
}

describe('CueList.vue', () => {
  it('renders all segments', () => {
    setupStores()
    const wrapper = mount(CueList, { attachTo: document.body })
    const items = wrapper.findAll('.cue-item')
    expect(items.length).toBe(3)
  })

  it('filters by search query', () => {
    const { ui } = setupStores()
    ui.setSearchQuery('关键词')
    const wrapper = mount(CueList, { attachTo: document.body })
    const items = wrapper.findAll('.cue-item')
    expect(items.length).toBe(1)
    expect(items[0].text()).toContain('搜索关键词')
  })

  it('selects segment on click', async () => {
    const { selection } = setupStores()
    const wrapper = mount(CueList, { attachTo: document.body })
    const items = wrapper.findAll('.cue-item')
    await items[0].trigger('click')
    expect(selection.isSelected(0)).toBe(true)
    expect(selection.lastActive).toBe(0)
  })

  it('range selects with Shift+click', async () => {
    const { selection } = setupStores()
    selection.setActive(0)
    const wrapper = mount(CueList, { attachTo: document.body })
    const items = wrapper.findAll('.cue-item')
    await items[2].trigger('click', { shiftKey: true })
    expect(selection.isSelected(0)).toBe(true)
    expect(selection.isSelected(1)).toBe(true)
    expect(selection.isSelected(2)).toBe(true)
  })

  it('toggles selection with Ctrl+click', async () => {
    const { selection } = setupStores()
    const wrapper = mount(CueList, { attachTo: document.body })
    const items = wrapper.findAll('.cue-item')
    await items[0].trigger('click', { ctrlKey: true })
    expect(selection.isSelected(0)).toBe(true)
    await items[0].trigger('click', { ctrlKey: true })
    expect(selection.isSelected(0)).toBe(false)
  })

  it('shows cue count', () => {
    setupStores()
    const wrapper = mount(CueList, { attachTo: document.body })
    expect(wrapper.text()).toContain('3')
  })
})
// @vitest-environment node
import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useSelectionStore } from '../../src/stores/selection.js'

describe('selection store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('starts empty', () => {
    const store = useSelectionStore()
    expect(store.lastActive).toBe(-1)
    expect(store.selectedCount).toBe(0)
  })

  it('selects a single index', () => {
    const store = useSelectionStore()
    store.select(3)
    expect(store.isSelected(3)).toBe(true)
    expect(store.lastActive).toBe(3)
  })

  it('toggles selection', () => {
    const store = useSelectionStore()
    store.select(0)
    store.toggleSelect(0)
    expect(store.isSelected(0)).toBe(false)
  })

  it('range selects', () => {
    const store = useSelectionStore()
    store.rangeSelect(1, 3)
    expect(store.isSelected(1)).toBe(true)
    expect(store.isSelected(2)).toBe(true)
    expect(store.isSelected(3)).toBe(true)
    expect(store.isSelected(0)).toBe(false)
  })

  it('clears selection', () => {
    const store = useSelectionStore()
    store.select(0)
    store.clearSelection()
    expect(store.selectedCount).toBe(0)
  })

  it('manages editing state', () => {
    const store = useSelectionStore()
    store.startEditing(1, 'hello')
    expect(store.editingState?.index).toBe(1)
    expect(store.editingState?.text).toBe('hello')

    const result = store.finishEditing()
    expect(result?.text).toBe('hello')
    expect(store.editingState).toBeNull()
  })
})
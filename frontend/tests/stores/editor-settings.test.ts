// @vitest-environment node
import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useEditorSettingsStore } from '../../src/stores/editor-settings.js'

// Mock localStorage for node environment
const storage = new Map<string, string>()
beforeEach(() => {
  storage.clear()
  globalThis.localStorage = {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, val: string) => storage.set(key, val),
    removeItem: (key: string) => storage.delete(key),
    clear: () => storage.clear(),
    length: 0,
    key: () => null,
  }
})

describe('editor-settings store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('has default values', () => {
    const store = useEditorSettingsStore()
    expect(store.settings.splitKey).toBe('ctrl-enter')
    expect(store.settings.overlayEnabled).toBe(true)
    expect(store.settings.charcountThreshold).toBe(15)
  })

  it('updates a setting', () => {
    const store = useEditorSettingsStore()
    store.updateSetting('splitKey', 'enter')
    expect(store.settings.splitKey).toBe('enter')
  })

  it('resets to defaults', () => {
    const store = useEditorSettingsStore()
    store.updateSetting('charcountThreshold', 99)
    store.resetToDefaults()
    expect(store.settings.charcountThreshold).toBe(15)
  })
})
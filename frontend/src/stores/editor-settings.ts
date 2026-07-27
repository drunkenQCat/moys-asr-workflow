import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import type { EditorSettings } from '../types/settings.js'

const STORAGE_KEY = 'moy.asr.editor.settings.v1'

const DEFAULTS: EditorSettings = {
  splitKey: 'ctrl-enter',
  overlayEnabled: true,
  exportStartAtZero: true,
  cueListShowIndex: true,
  cueListShowTime: true,
  cueListShowSticker: true,
  cueListShowCharcount: true,
  cueEditorShowNavigation: true,
  cueEditorShowSticker: true,
  hideDisabled: false,
  charcountThreshold: 15,
}

function loadFromStorage(): EditorSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULTS }
    const parsed = JSON.parse(raw)
    return { ...DEFAULTS, ...parsed }
  } catch {
    return { ...DEFAULTS }
  }
}

function saveToStorage(settings: EditorSettings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  } catch {
    // storage full or unavailable — silently ignore
  }
}

export const useEditorSettingsStore = defineStore('editor-settings', () => {
  const settings = ref<EditorSettings>(loadFromStorage())

  // Auto-persist on every change
  watch(settings, (val) => {
    saveToStorage(val)
  }, { deep: true })

  function updateSetting<K extends keyof EditorSettings>(
    key: K,
    value: EditorSettings[K],
  ) {
    settings.value[key] = value
  }

  function resetToDefaults() {
    settings.value = { ...DEFAULTS }
  }

  return {
    settings,
    updateSetting,
    resetToDefaults,
  }
})
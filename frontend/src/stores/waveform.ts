import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { WaveformPayload } from '../types/project.js'
import type { WaveformSettings } from '../types/waveform.js'

const DEFAULT_SETTINGS: WaveformSettings = {
  mode: 'basic',
  layout: 'classic',
  visibleSeconds: 10,
  secondsPerRow: 3,
  side: 'right',
  splitPercent: 50,
  layoutColumnPercent: 60,
  layoutRows: [1],
  freeOrder: ['player', 'panel', 'wave', 'cues'],
  layoutTree: null,
  layoutEditing: false,
  waveformScale: 1.0,
  disabledDisplay: 'dim',
}

export const useWaveformStore = defineStore('waveform', () => {
  const payload = ref<WaveformPayload | null>(null)
  const settings = ref<WaveformSettings>({ ...DEFAULT_SETTINGS })
  const durationMs = ref(0)
  const editorInstance = ref<any>(null)

  function setPayload(p: WaveformPayload | null) {
    payload.value = p
    if (p) durationMs.value = p.duration_ms
  }

  function updateSettings(patch: Partial<WaveformSettings>) {
    settings.value = { ...settings.value, ...patch }
  }

  function setEditorInstance(instance: any) {
    editorInstance.value = instance
  }

  function resetSettings() {
    settings.value = { ...DEFAULT_SETTINGS }
  }

  function clear() {
    payload.value = null
    durationMs.value = 0
    editorInstance.value = null
  }

  return {
    payload, settings, durationMs, editorInstance,
    setPayload, updateSettings, setEditorInstance, resetSettings, clear,
  }
})
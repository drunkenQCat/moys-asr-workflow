import { computed } from 'vue'
import { useWaveformStore } from '../stores/waveform.js'

export function useWaveformSettingsActions() {
  const waveform = useWaveformStore()
  const s = waveform.settings

  const canZoomIn = computed(() => (s.visibleSeconds || 10) > 1)
  const canZoomOut = computed(() => (s.visibleSeconds || 10) < 120)

  function setMode(mode: 'hidden' | 'basic' | 'multi') {
    waveform.updateSettings({ mode })
  }

  function setLayout(layout: 'classic' | 'wave-right' | 'wave-bottom' | 'free') {
    waveform.updateSettings({ layout })
  }

  function setSide(side: 'left' | 'right') {
    waveform.updateSettings({ side })
  }

  function setDisabledDisplay(display: 'dim' | 'hidden') {
    waveform.updateSettings({ disabledDisplay: display })
  }

  function zoomIn() {
    const v = Math.max(1, (s.visibleSeconds || 10) - 5)
    waveform.updateSettings({ visibleSeconds: v })
  }

  function zoomOut() {
    const v = Math.min(120, (s.visibleSeconds || 10) + 5)
    waveform.updateSettings({ visibleSeconds: v })
  }

  function scaleUp() {
    waveform.updateSettings({ waveformScale: Math.min(6, (s.waveformScale || 1) + 0.25) })
  }

  function scaleDown() {
    waveform.updateSettings({ waveformScale: Math.max(0.25, (s.waveformScale || 1) - 0.25) })
  }

  return {
    canZoomIn,
    canZoomOut,
    setMode,
    setLayout,
    setSide,
    setDisabledDisplay,
    zoomIn,
    zoomOut,
    scaleUp,
    scaleDown,
  }
}

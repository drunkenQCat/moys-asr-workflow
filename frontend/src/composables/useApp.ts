import { ref, onMounted, watch } from 'vue'
import { useKeyboard } from './useKeyboard.js'
import { useFileDrop } from './useFileDrop.js'
import { useProjectStore } from '../stores/project.js'
import { useSelectionStore } from '../stores/selection.js'
import { useWaveformStore } from '../stores/waveform.js'
import type MediaPlayer from '../components/MediaPlayer.vue'

export function useApp() {
  const project = useProjectStore()
  const selection = useSelectionStore()
  const waveform = useWaveformStore()

  const setupWizardRef = ref<InstanceType<typeof import('../components/SetupWizard.vue').default> | null>(null)
  const mediaPlayerRef = ref<InstanceType<typeof MediaPlayer> | null>(null)
  const showSettings = ref(false)
  const showGapRemove = ref(false)
  const showSticker = ref(false)

  watch(() => waveform.editorInstance?.currentTime, (timeMs) => {
    if (timeMs !== undefined && mediaPlayerRef.value) {
      mediaPlayerRef.value.seekTo(timeMs)
    }
  })

  function onPlayerTimeUpdate(timeMs: number) {
    const idx = project.segments.findIndex((seg) =>
      !seg.disabled && timeMs >= seg.start && timeMs < seg.end,
    )
    if (idx >= 0 && idx !== selection.lastActive) {
      selection.setActive(idx)
    }
  }

  onMounted(() => {
    if (mediaPlayerRef.value) {
      const kb = useKeyboard({
        togglePlayback: () => mediaPlayerRef.value!.togglePlayback(),
        setRate: (rate: number) => mediaPlayerRef.value!.setRate(rate),
      })
      kb.init()
    }
    const fileDrop = useFileDrop()
    fileDrop.init()
  })

  return {
    setupWizardRef,
    mediaPlayerRef,
    showSettings,
    showGapRemove,
    showSticker,
    onPlayerTimeUpdate,
  }
}

import { ref, onMounted, onUnmounted } from 'vue'
import { WaveformEditor } from '../core/waveform/editor.js'
import type { WaveformPayload } from '../types/project.js'
import type { WaveformCallbacks } from '../types/waveform.js'

/**
 * Waveform 编辑器封装 — 将 WaveformEditor 类桥接到 Vue
 */
export function useWaveformEditor(containerRef: { value: HTMLElement | null }) {
  let waveformInstance: WaveformEditor | null = null
  const isReady = ref(false)

  let callbacks: WaveformCallbacks = {}

  onMounted(() => {
    // 挂载后自动初始化
    if (containerRef.value) {
      waveformInstance = new WaveformEditor({
        root: containerRef.value,
        callbacks,
      })
      isReady.value = true
    }
  })

  onUnmounted(() => {
    destroy()
  })

  function init(cbs: WaveformCallbacks = {}) {
    callbacks = cbs
    if (!containerRef.value) return
    waveformInstance = new WaveformEditor({
      root: containerRef.value,
      callbacks,
    })
    isReady.value = true
  }

  function setPayload(payload: WaveformPayload) {
    waveformInstance?.setPayload(payload)
  }

  function renderSegments() {
    waveformInstance?.renderSegments()
  }

  function updateSelection() {
    waveformInstance?.updateSelection()
  }

  function destroy() {
    waveformInstance?.destroy()
    waveformInstance = null
    isReady.value = false
  }

  return {
    isReady,
    init,
    setPayload,
    renderSegments,
    updateSelection,
    destroy,
  }
}
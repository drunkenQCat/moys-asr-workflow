import { ref } from 'vue'
import { useWaveformStore } from '../stores/waveform.js'

export type ResizerType = 'column' | 'row-top' | 'row-middle'

export function useLayoutResizers() {
  const waveform = useWaveformStore()
  const dragging = ref<ResizerType | null>(null)
  const startPos = ref(0)
  const startValue = ref(0)

  function beginDrag(type: ResizerType, e: MouseEvent) {
    dragging.value = type
    startPos.value = type === 'row-top' || type === 'row-middle' ? e.clientY : e.clientX
    startValue.value = type === 'column'
      ? waveform.settings.splitPercent
      : type === 'row-top'
        ? waveform.settings.layoutRows[0]
        : waveform.settings.layoutRows[1]
    document.addEventListener('mousemove', onDrag)
    document.addEventListener('mouseup', endDrag)
    e.preventDefault()
  }

  function onDrag(e: MouseEvent) {
    if (!dragging.value) return
    const delta = (dragging.value === 'row-top' || dragging.value === 'row-middle' ? e.clientY : e.clientX) - startPos.value
    const parent = (e.target as HTMLElement).closest('.editor-workspace') as HTMLElement
    if (!parent) return
    const size = dragging.value === 'column' ? parent.offsetWidth : parent.offsetHeight
    const pct = Math.max(10, Math.min(90, startValue.value + (delta / size) * 100))
    if (dragging.value === 'column') {
      waveform.updateSettings({ splitPercent: Math.round(pct) })
    } else if (dragging.value === 'row-top') {
      const rows = [...waveform.settings.layoutRows]
      rows[0] = Math.round(pct)
      rows[1] = Math.max(6, 100 - rows[0] - rows[2])
      waveform.updateSettings({ layoutRows: rows })
    } else if (dragging.value === 'row-middle') {
      const rows = [...waveform.settings.layoutRows]
      rows[1] = Math.round(pct)
      rows[2] = Math.max(12, 100 - rows[0] - rows[1])
      waveform.updateSettings({ layoutRows: rows })
    }
  }

  function endDrag() {
    dragging.value = null
    document.removeEventListener('mousemove', onDrag)
    document.removeEventListener('mouseup', endDrag)
  }

  return {
    dragging,
    beginDrag,
  }
}

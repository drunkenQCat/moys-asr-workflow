import { computed } from 'vue'
import { useProjectStore } from '../stores/project.js'
import { useSelectionStore } from '../stores/selection.js'
import { cueMetrics } from '../core/editor-utils.js'

export function useCurrentCue() {
  const project = useProjectStore()
  const selection = useSelectionStore()

  const currentCue = computed(() => {
    const idx = selection.lastActive
    if (idx < 0 || idx >= project.segments.length) return null
    return {
      ...project.segments[idx],
      index: idx,
      total: project.segments.length,
    }
  })

  const metrics = computed(() => {
    if (!currentCue.value) return null
    return cueMetrics(currentCue.value.text, currentCue.value.start, currentCue.value.end)
  })

  function goPrev() {
    if (selection.lastActive > 0) selection.setActive(selection.lastActive - 1)
  }

  function goNext() {
    if (selection.lastActive < project.segments.length - 1) selection.setActive(selection.lastActive + 1)
  }

  function updateStart(startSeconds: number) {
    if (!currentCue.value) return
    project.updateSegment(selection.lastActive, { start: Math.round(startSeconds * 1000) })
  }

  function updateDuration(durationSeconds: number) {
    if (!currentCue.value) return
    project.updateSegment(selection.lastActive, { end: currentCue.value.start + durationSeconds * 1000 })
  }

  function updateText(text: string) {
    project.updateSegment(selection.lastActive, { text })
  }

  return {
    currentCue,
    metrics,
    goPrev,
    goNext,
    updateStart,
    updateDuration,
    updateText,
  }
}

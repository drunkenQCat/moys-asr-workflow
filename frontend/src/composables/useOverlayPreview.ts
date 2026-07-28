import { computed } from 'vue'
import { useProjectStore } from '../stores/project.js'
import { useEditorSettingsStore } from '../stores/editor-settings.js'
import { useSelectionStore } from '../stores/selection.js'

export function useOverlayPreview() {
  const project = useProjectStore()
  const settings = useEditorSettingsStore()
  const selection = useSelectionStore()

  const enabled = computed(() => settings.settings.overlayEnabled)

  const activeCue = computed(() => {
    const idx = selection.lastActive
    if (idx < 0 || idx >= project.segments.length) return null
    const seg = project.segments[idx]
    if (seg.disabled) return null
    return seg.text
  })

  return {
    enabled,
    activeCue,
  }
}

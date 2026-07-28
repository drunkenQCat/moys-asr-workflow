import { ref, computed } from 'vue'
import { useProjectStore } from '../stores/project.js'
import { useUiStore, ModalName } from '../stores/ui.js'
import { buildReplacementPreview } from '../core/editor-utils.js'

export function useReplace() {
  const project = useProjectStore()
  const ui = useUiStore()

  const findText = ref('')
  const replaceText = ref('')
  const caseSensitive = ref(false)
  const useRegex = ref(false)

  const preview = computed(() => {
    if (!findText.value) return null
    return buildReplacementPreview(
      project.segments,
      null,
      findText.value,
      replaceText.value,
      { caseSensitive: caseSensitive.value, useRegex: useRegex.value },
    )
  })

  function executeReplace() {
    if (!preview.value || preview.value.error) return
    for (const row of preview.value.rows) {
      project.updateSegment(row.index, { text: row.after })
    }
    ui.closeModal(ModalName.Replace)
    ui.flash(`已替换 ${preview.value.matchCount} 处`)
  }

  return {
    findText,
    replaceText,
    caseSensitive,
    useRegex,
    preview,
    executeReplace,
  }
}

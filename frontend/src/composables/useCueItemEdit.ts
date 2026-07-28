import { ref, nextTick } from 'vue'
import { configuredEnterAction } from '../core/editor-utils.js'
import { useEditorSettingsStore } from '../stores/editor-settings.js'
import type { SplitKey } from '../types/settings.js'

export interface UseCueItemEditOptions {
  initialText: () => string
  onStart: () => void
  onSave: (text: string) => void
  onCancel: () => void
  onSplit: (charOffset: number) => void
}

export function useCueItemEdit(options: UseCueItemEditOptions) {
  const settings = useEditorSettingsStore()
  const editText = ref('')
  const editTextarea = ref<HTMLTextAreaElement | null>(null)

  function startEdit() {
    editText.value = options.initialText()
    options.onStart()
    nextTick(() => {
      editTextarea.value?.focus()
      editTextarea.value?.select()
    })
  }

  function saveEdit() {
    options.onSave(editText.value)
  }

  function cancelEdit() {
    options.onCancel()
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      cancelEdit()
      return
    }
    const action = configuredEnterAction(e, settings.settings.splitKey as SplitKey)
    if (action === 'save') {
      e.preventDefault()
      saveEdit()
    } else if (action === 'split') {
      e.preventDefault()
      const textarea = e.target as HTMLTextAreaElement
      const cursorPos = textarea.selectionStart
      options.onSplit(cursorPos)
    }
  }

  return {
    editText,
    editTextarea,
    startEdit,
    saveEdit,
    cancelEdit,
    onKeydown,
  }
}

import { useSelectionStore } from '../stores/selection.js'
import { useUiStore } from '../stores/ui.js'

export interface FocusState {
  isEditing: boolean
  isModalOpen: boolean
  isInputFocused: boolean
}

export function useKeyboardFocusState() {
  const selection = useSelectionStore()
  const ui = useUiStore()

  function getState(): FocusState {
    const el = document.activeElement
    return {
      isEditing: selection.editingState !== null,
      isModalOpen: ui.openModals.size > 0,
      isInputFocused: el instanceof HTMLTextAreaElement
        || el instanceof HTMLInputElement
        || el instanceof HTMLSelectElement,
    }
  }

  return {
    getState,
  }
}

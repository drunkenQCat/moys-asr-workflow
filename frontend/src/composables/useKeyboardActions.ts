import { useProjectStore } from '../stores/project.js'
import { useSelectionStore } from '../stores/selection.js'
import { useUiStore } from '../stores/ui.js'

export interface MediaControls {
  togglePlayback: () => void
  setRate: (rate: number) => void
}

export function useKeyboardActions(mediaControls: MediaControls) {
  const project = useProjectStore()
  const selection = useSelectionStore()
  const ui = useUiStore()

  function handleWhileEditingOrInput(e: KeyboardEvent): boolean {
    if (e.key === 'Escape' && selection.editingState) {
      selection.finishEditing()
      e.preventDefault()
      return true
    }
    return false
  }

  function handleWhileModalOpen(e: KeyboardEvent): boolean {
    if (e.key === 'Escape') {
      ui.openModals.forEach((name) => ui.closeModal(name))
      e.preventDefault()
      return true
    }
    return false
  }

  function handleShortcut(e: KeyboardEvent): boolean {
    switch (e.key) {
      case ' ':
        e.preventDefault()
        mediaControls.togglePlayback()
        return true
      case 'j':
      case 'J':
        e.preventDefault()
        mediaControls.setRate(0.5)
        return true
      case 'k':
      case 'K':
        e.preventDefault()
        mediaControls.setRate(1)
        return true
      case 'l':
      case 'L':
        e.preventDefault()
        mediaControls.setRate(2)
        return true
      case 'z':
      case 'Z':
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault()
          project.performUndo()
          return true
        }
        return false
      default:
        return false
    }
  }

  return {
    handleWhileEditingOrInput,
    handleWhileModalOpen,
    handleShortcut,
  }
}

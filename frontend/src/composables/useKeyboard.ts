// 全局键盘快捷键 — 与 editor.js 原有的快捷键行为一致

import { useKeyboardFocusState } from './useKeyboardFocusState.js'
import { useKeyboardActions } from './useKeyboardActions.js'

export interface MediaControls {
  togglePlayback: () => void
  setRate: (rate: number) => void
}

export function useKeyboard(mediaControls: MediaControls) {
  const { getState } = useKeyboardFocusState()
  const { handleWhileEditingOrInput, handleWhileModalOpen, handleShortcut } = useKeyboardActions(mediaControls)

  function handleKeydown(e: KeyboardEvent) {
    const state = getState()

    if (state.isEditing || state.isInputFocused) {
      if (handleWhileEditingOrInput(e)) return
      return
    }

    if (state.isModalOpen) {
      if (handleWhileModalOpen(e)) return
      return
    }

    handleShortcut(e)
  }

  function init() {
    window.addEventListener('keydown', handleKeydown)
  }

  function destroy() {
    window.removeEventListener('keydown', handleKeydown)
  }

  return { init, destroy }
}

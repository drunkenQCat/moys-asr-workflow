// 全局键盘快捷键 — 与 editor.js 原有的快捷键行为一致

import { useProjectStore } from '../stores/project.js'
import { useSelectionStore } from '../stores/selection.js'
import { useUiStore } from '../stores/ui.js'

export interface MediaControls {
  togglePlayback: () => void
  setRate: (rate: number) => void
}

export function useKeyboard(mediaControls: MediaControls) {
  const project = useProjectStore()
  const selection = useSelectionStore()
  const ui = useUiStore()

  function isEditing(): boolean {
    return selection.editingState !== null
  }

  function isModalOpen(): boolean {
    return ui.openModals.size > 0
  }

  function isInputFocused(): boolean {
    const el = document.activeElement
    return el instanceof HTMLTextAreaElement
      || el instanceof HTMLInputElement
      || el instanceof HTMLSelectElement
  }

  function handleKeydown(e: KeyboardEvent) {
    // 编辑中或输入框聚焦时不拦截（除 Esc 取消编辑外）
    if (isEditing() || isInputFocused()) {
      if (e.key === 'Escape') {
        if (selection.editingState) {
          selection.finishEditing()
          e.preventDefault()
        }
      }
      return
    }

    // 模态框打开时只处理 Esc
    if (isModalOpen()) {
      if (e.key === 'Escape') {
        ui.openModals.forEach(name => ui.closeModal(name))
        e.preventDefault()
      }
      return
    }

    switch (e.key) {
      case ' ':
        e.preventDefault()
        mediaControls.togglePlayback()
        break
      case 'j':
      case 'J':
        e.preventDefault()
        mediaControls.setRate(0.5)
        break
      case 'k':
      case 'K':
        e.preventDefault()
        mediaControls.setRate(1)
        break
      case 'l':
      case 'L':
        e.preventDefault()
        mediaControls.setRate(2)
        break
      case 'z':
      case 'Z':
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault()
          project.performUndo()
        }
        break
    }
  }

  function init() {
    window.addEventListener('keydown', handleKeydown)
  }

  function destroy() {
    window.removeEventListener('keydown', handleKeydown)
  }

  return { init, destroy }
}
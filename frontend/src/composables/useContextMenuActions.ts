import { useProjectStore } from '../stores/project.js'
import { useSelectionStore } from '../stores/selection.js'
import { useUiStore } from '../stores/ui.js'

const COLOR_MAP: Record<string, string> = {
  'color-red': '#e74c3c',
  'color-yellow': '#f1c40f',
  'color-blue': '#168cff',
  'color-green': '#2ecc71',
  'color-purple': '#9b59b6',
}

export function useContextMenuActions() {
  const project = useProjectStore()
  const selection = useSelectionStore()
  const ui = useUiStore()

  function handleAction(action: string) {
    switch (action) {
      case 'split': {
        const idx = selection.lastActive
        if (idx >= 0) {
          const seg = project.segments[idx]
          const offset = Math.floor(seg.text.length / 2)
          project.splitSegment(idx, offset)
        }
        break
      }
      case 'sticker': {
        // Emit event to open sticker modal — handled by parent
        break
      }
      case 'merge': {
        const indexes = [...selection.selectedIdxs].sort((a, b) => a - b)
        if (indexes.length >= 2) {
          project.mergeSegments(indexes)
        }
        break
      }
      case 'color-clear': {
        const indexes = [...selection.selectedIdxs]
        indexes.forEach((i) => {
          project.updateSegment(i, { color: null, color_ref: null })
        })
        break
      }
      case 'toggle-disabled': {
        const indexes = [...selection.selectedIdxs]
        indexes.forEach((i) => {
          project.updateSegment(i, { disabled: !project.segments[i].disabled })
        })
        break
      }
      default: {
        const color = COLOR_MAP[action]
        if (color) {
          const indexes = [...selection.selectedIdxs]
          indexes.forEach((i) => {
            project.updateSegment(i, {
              color: {
                name: action.replace('color-', '') as any,
                value: color,
                start: project.segments[i].start,
                end: project.segments[i].end,
              },
              color_ref: null,
            })
          })
        }
      }
    }
    ui.hideContextMenu()
  }

  return {
    handleAction,
  }
}

import { ref } from 'vue'
import type { Segment, GapRemoveData, LayoutData } from '../types/project.js'

export interface UndoEntry {
  label: string
  segs?: Segment[]
  layout?: LayoutData
  gapRemove?: GapRemoveData | null
  gapRemoveDirty?: boolean
}

export function useUndo() {
  const stack = ref<UndoEntry[]>([])
  const LIMIT = 100

  function pushUndo(
    label: string,
    segments: Segment[],
    gapRemove: GapRemoveData | null = null,
    gapRemoveDirty = false,
    layout: LayoutData | null = null,
  ) {
    stack.value.push({
      label,
      segs: JSON.parse(JSON.stringify(segments)),
      gapRemove: gapRemove ? JSON.parse(JSON.stringify(gapRemove)) : null,
      gapRemoveDirty,
      layout: layout ? JSON.parse(JSON.stringify(layout)) : undefined,
    })
    if (stack.value.length > LIMIT) {
      stack.value.shift()
    }
  }

  function popUndo(): UndoEntry | null {
    return stack.value.pop() ?? null
  }

  function peekUndo(): UndoEntry | null {
    return stack.value[stack.value.length - 1] ?? null
  }

  function clearUndo() {
    stack.value = []
  }

  return {
    stack,
    pushUndo,
    popUndo,
    peekUndo,
    clearUndo,
  }
}
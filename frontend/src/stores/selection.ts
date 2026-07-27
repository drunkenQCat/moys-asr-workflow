import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export interface EditingState {
  index: number
  text: string
  textareaEl: HTMLTextAreaElement | null
}

export const useSelectionStore = defineStore('selection', () => {
  const selectedIdxs = ref<Set<number>>(new Set())
  const lastActive = ref(-1)
  const editingState = ref<EditingState | null>(null)
  const currentCuePanelIdx = ref(-1)

  const isSelected = computed(() => (index: number) => selectedIdxs.value.has(index))
  const selectedCount = computed(() => selectedIdxs.value.size)

  function select(index: number, keepExisting = false) {
    if (!keepExisting) selectedIdxs.value = new Set([index])
    else selectedIdxs.value.add(index)
    lastActive.value = index
  }

  function toggleSelect(index: number) {
    if (selectedIdxs.value.has(index)) {
      selectedIdxs.value.delete(index)
    } else {
      selectedIdxs.value.add(index)
    }
  }

  function rangeSelect(from: number, to: number) {
    const start = Math.min(from, to)
    const end = Math.max(from, to)
    const set = new Set<number>()
    for (let i = start; i <= end; i++) set.add(i)
    selectedIdxs.value = set
    lastActive.value = to
  }

  function clearSelection() {
    selectedIdxs.value = new Set()
  }

  function setActive(index: number) {
    lastActive.value = index
  }

  function startEditing(index: number, text: string, textareaEl: HTMLTextAreaElement | null = null) {
    editingState.value = { index, text, textareaEl }
  }

  function finishEditing(): EditingState | null {
    const state = editingState.value
    editingState.value = null
    return state
  }

  function setCuePanelIndex(index: number) {
    currentCuePanelIdx.value = index
  }

  function clearAll() {
    selectedIdxs.value = new Set()
    lastActive.value = -1
    editingState.value = null
    currentCuePanelIdx.value = -1
  }

  return {
    selectedIdxs, lastActive, editingState, currentCuePanelIdx,
    isSelected, selectedCount,
    select, toggleSelect, rangeSelect, clearSelection, setActive,
    startEditing, finishEditing, setCuePanelIndex, clearAll,
  }
})
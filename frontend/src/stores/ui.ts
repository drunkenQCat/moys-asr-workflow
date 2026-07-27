import { defineStore } from 'pinia'
import { ref, type Ref } from 'vue'

export interface ContextMenuItem {
  label: string
  action: string
  disabled?: boolean
  divider?: boolean
}

export enum ModalName {
  Replace = 'replace',
  Sticker = 'sticker',
  StickerPreview = 'stickerPreview',
  StickerRoot = 'stickerRoot',
  ProjectMedia = 'projectMedia',
  SetupWizard = 'setupWizard',
}

export const useUiStore = defineStore('ui', () => {
  // ===== 模态框 =====
  const openModals = ref<Set<ModalName>>(new Set())

  function openModal(name: ModalName) { openModals.value.add(name) }
  function closeModal(name: ModalName) { openModals.value.delete(name) }
  function toggleModal(name: ModalName) {
    if (openModals.value.has(name)) openModals.value.delete(name)
    else openModals.value.add(name)
  }
  function isModalOpen(name: ModalName) { return openModals.value.has(name) }

  // ===== 右键菜单 =====
  const contextMenuVisible = ref(false)
  const contextMenuX = ref(0)
  const contextMenuY = ref(0)
  const contextMenuItems = ref<ContextMenuItem[]>([])

  function showContextMenu(x: number, y: number, items: ContextMenuItem[]) {
    contextMenuX.value = x
    contextMenuY.value = y
    contextMenuItems.value = items
    contextMenuVisible.value = true
  }

  function hideContextMenu() {
    contextMenuVisible.value = false
    contextMenuItems.value = []
  }

  // ===== 拖拽遮罩 =====
  const dragOverlayVisible = ref(false)
  const dragCounter = ref(0)

  function incrementDrag() {
    dragCounter.value++
    dragOverlayVisible.value = true
  }

  function decrementDrag() {
    dragCounter.value = Math.max(0, dragCounter.value - 1)
    if (dragCounter.value === 0) dragOverlayVisible.value = false
  }

  // ===== 提示消息 =====
  const flashMessage = ref('')
  let flashTimeout: ReturnType<typeof setTimeout> | null = null

  function flash(msg: string, durationMs = 3000) {
    if (flashTimeout) clearTimeout(flashTimeout)
    flashMessage.value = msg
    flashTimeout = setTimeout(() => {
      flashMessage.value = ''
      flashTimeout = null
    }, durationMs)
  }

  // ===== 搜索 =====
  const searchQuery = ref('')
  const filterOverOnly = ref(false)

  function setSearchQuery(query: string) { searchQuery.value = query }
  function setFilterOverOnly(value: boolean) { filterOverOnly.value = value }

  // ===== 播放器焦点 =====
  const playerFocused = ref(false)
  const interceptedPlayerSpace = ref(false)

  function setPlayerFocused(value: boolean) { playerFocused.value = value }
  function setInterceptedPlayerSpace(value: boolean) { interceptedPlayerSpace.value = value }

  return {
    openModals, openModal, closeModal, toggleModal, isModalOpen,
    contextMenuVisible, contextMenuX, contextMenuY, contextMenuItems,
    showContextMenu, hideContextMenu,
    dragOverlayVisible, dragCounter, incrementDrag, decrementDrag,
    flashMessage, flash,
    searchQuery, filterOverOnly, setSearchQuery, setFilterOverOnly,
    playerFocused, interceptedPlayerSpace, setPlayerFocused, setInterceptedPlayerSpace,
  }
})
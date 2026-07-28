<script setup lang="ts">
import { ref, watch } from 'vue'
import { useUiStore } from '../stores/ui.js'
import { useProjectStore } from '../stores/project.js'
import { useSelectionStore } from '../stores/selection.js'

const ui = useUiStore()
const project = useProjectStore()
const selection = useSelectionStore()

const menuRef = ref<HTMLElement | null>(null)

function handleAction(action: string) {
  const COLOR_MAP: Record<string, string> = {
    'color-red': '#e74c3c',
    'color-yellow': '#f1c40f',
    'color-blue': '#168cff',
    'color-green': '#2ecc71',
    'color-purple': '#9b59b6',
  }
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
      // Handle color assignments
      const color = COLOR_MAP[action]
      if (color) {
        const indexes = [...selection.selectedIdxs]
        indexes.forEach((i) => {
          project.updateSegment(i, { color: { name: action.replace('color-', '') as any, value: color, start: project.segments[i].start, end: project.segments[i].end }, color_ref: null })
        })
      }
    }
  }
  ui.hideContextMenu()
}

// Close on click outside
watch(() => ui.contextMenuVisible, (visible) => {
  if (visible) {
    document.addEventListener('click', handleDocClick)
  } else {
    document.removeEventListener('click', handleDocClick)
  }
})

function handleDocClick(e: Event) {
  if (menuRef.value && !menuRef.value.contains(e.target as Node)) {
    ui.hideContextMenu()
  }
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="ui.contextMenuVisible"
      ref="menuRef"
      class="context-menu"
      :style="{ left: `${ui.contextMenuX}px`, top: `${ui.contextMenuY}px` }"
    >
      <button
        v-for="item in ui.contextMenuItems"
        :key="item.action"
        class="menu-item"
        :class="{ disabled: item.disabled }"
        @click.stop="handleAction(item.action)"
      >
        {{ item.label }}
      </button>
    </div>
  </Teleport>
</template>

<style scoped>
.context-menu {
  position: fixed;
  z-index: 10000;
  background: #2a2a3e;
  border: 1px solid #444;
  border-radius: 6px;
  padding: 4px;
  min-width: 140px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
}
.menu-item {
  display: block;
  width: 100%;
  padding: 6px 12px;
  background: none;
  border: none;
  color: #e0e0e0;
  font-size: 13px;
  text-align: left;
  cursor: pointer;
  border-radius: 4px;
}
.menu-item:hover { background: #3a3a5e; }
.menu-item.disabled { opacity: 0.4; cursor: default; }
</style>
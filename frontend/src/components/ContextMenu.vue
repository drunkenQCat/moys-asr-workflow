<script setup lang="ts">
import { ref, watch } from 'vue'
import { useUiStore } from '../stores/ui.js'
import { useContextMenuActions } from '../composables/useContextMenuActions.js'

const ui = useUiStore()
const { handleAction } = useContextMenuActions()

const menuRef = ref<HTMLElement | null>(null)

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

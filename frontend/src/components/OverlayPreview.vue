<script setup lang="ts">
import { computed } from 'vue'
import { useProjectStore } from '../stores/project.js'
import { useEditorSettingsStore } from '../stores/editor-settings.js'
import { useSelectionStore } from '../stores/selection.js'

const project = useProjectStore()
const settings = useEditorSettingsStore()
const selection = useSelectionStore()

const activeCue = computed(() => {
  const idx = selection.lastActive
  if (idx < 0 || idx >= project.segments.length) return null
  const seg = project.segments[idx]
  if (seg.disabled) return null
  return seg.text
})
</script>

<template>
  <div v-if="settings.settings.overlayEnabled && activeCue" class="overlay">
    <div class="overlay-text">{{ activeCue }}</div>
  </div>
</template>

<style scoped>
.overlay {
  position: absolute;
  bottom: 60px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 10;
  pointer-events: none;
  text-align: center;
  max-width: 90%;
}
.overlay-text {
  display: inline-block;
  background: rgba(0, 0, 0, 0.7);
  color: #fff;
  padding: 8px 16px;
  border-radius: 6px;
  font-size: 20px;
  line-height: 1.4;
  text-shadow: 1px 1px 2px rgba(0,0,0,0.5);
}
</style>
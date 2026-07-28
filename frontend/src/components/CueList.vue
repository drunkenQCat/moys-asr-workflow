<script setup lang="ts">
import { useProjectStore } from '../stores/project.js'
import { useSelectionStore } from '../stores/selection.js'
import { useEditorSettingsStore } from '../stores/editor-settings.js'
import { useUiStore } from '../stores/ui.js'
import { useCueList } from '../composables/useCueList.js'
import CueItem from './CueItem.vue'

const project = useProjectStore()
const selection = useSelectionStore()
const settings = useEditorSettingsStore()
const ui = useUiStore()

const { filteredSegments } = useCueList({
  segments: () => project.segments,
  searchQuery: () => ui.searchQuery,
})

function onCueClick(index: number, event: MouseEvent) {
  if (event.altKey) {
    project.updateSegment(index, { disabled: !project.segments[index].disabled })
    return
  }
  if (event.shiftKey) {
    const from = selection.lastActive >= 0 ? selection.lastActive : 0
    selection.rangeSelect(from, index)
  } else if (event.ctrlKey || event.metaKey) {
    selection.toggleSelect(index)
  } else {
    selection.select(index)
  }
}

function onCueDblclick(index: number) {
  selection.startEditing(index, project.segments[index].text)
}

function onCueContextmenu(index: number, event: MouseEvent) {
  if (!selection.selectedIdxs.has(index)) {
    selection.select(index)
  }
  const isSingle = selection.selectedIdxs.size === 1
  const colorItems = [
    { label: '🔴 红色', action: 'color-red' },
    { label: '🟡 黄色', action: 'color-yellow' },
    { label: '🔵 蓝色', action: 'color-blue' },
    { label: '🟢 绿色', action: 'color-green' },
    { label: '🟣 紫色', action: 'color-purple' },
    { label: '清除颜色', action: 'color-clear', divider: true },
  ]
  ui.showContextMenu(event.clientX, event.clientY, [
    { label: '拆分', action: 'split' },
    { label: '分配表情包', action: 'sticker' },
    ...(isSingle ? [] : [{ label: '合并字幕', action: 'merge' }]),
    ...colorItems,
    { label: '禁用', action: 'toggle-disabled' },
  ])
}

function onEditSave(index: number, text: string) {
  project.updateSegment(index, { text })
  selection.finishEditing()
}
</script>

<template>
  <div class="cue-list">
    <div class="cue-list-header">
      <span class="cue-count">{{ filteredSegments.length }} / {{ project.segments.length }}</span>
    </div>
    <div class="cue-list-items">
      <CueItem
        v-for="{ segment, index } in filteredSegments"
        :key="index"
        :segment="segment"
        :index="index"
        :is-active="selection.lastActive === index"
        :is-selected="selection.isSelected(index)"
        :is-editing="selection.editingState?.index === index"
        :show-index="settings.settings.cueListShowIndex"
        :show-time="settings.settings.cueListShowTime"
        :show-sticker="settings.settings.cueListShowSticker"
        :show-charcount="settings.settings.cueListShowCharcount"
        :charcount-threshold="settings.settings.charcountThreshold"
        :search-query="ui.searchQuery"
        @click="onCueClick"
        @dblclick="onCueDblclick"
        @contextmenu="onCueContextmenu"
        @edit-save="onEditSave"
        @edit-cancel="selection.finishEditing()"
      />
    </div>
  </div>
</template>

<style scoped>
.cue-list {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}
.cue-list-header {
  padding: 6px 8px;
  background: #222;
  border-bottom: 1px solid #333;
  font-size: 12px;
  color: #888;
}
.cue-list-items {
  flex: 1;
  overflow-y: auto;
}
</style>

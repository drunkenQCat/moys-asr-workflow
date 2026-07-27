<script setup lang="ts">
import { computed, ref, nextTick } from 'vue'
import type { Segment } from '../types/project.js'
import { cueMetrics } from '../core/editor-utils.js'

const props = defineProps<{
  segment: Segment
  index: number
  isActive: boolean
  isSelected: boolean
  isEditing: boolean
  showIndex: boolean
  showTime: boolean
  showSticker: boolean
  showCharcount: boolean
  charcountThreshold: number
  searchQuery: string
}>()

const emit = defineEmits<{
  click: [index: number, event: MouseEvent]
  dblclick: [index: number, event: MouseEvent]
  contextmenu: [index: number, event: MouseEvent]
  'edit-save': [index: number, text: string]
  'edit-cancel': [index: number]
  'edit-split': [index: number, charOffset: number]
}>()

const editText = ref('')
const editTextarea = ref<HTMLTextAreaElement | null>(null)

const metrics = computed(() => cueMetrics(props.segment.text, props.segment.start, props.segment.end))
const isOverThreshold = computed(() => metrics.value.totalLength > props.charcountThreshold)

const timeStr = computed(() => {
  const fmt = (ms: number) => {
    const s = Math.floor(ms / 1000)
    const m = Math.floor(s / 60)
    const h = Math.floor(m / 60)
    return `${String(h).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}.${String(ms % 1000).padStart(3, '0')}`
  }
  return `${fmt(props.segment.start)} → ${fmt(props.segment.end)}`
})

function startEdit() {
  editText.value = props.segment.text
  emit('dblclick', props.index, new MouseEvent('dblclick'))
  nextTick(() => {
    editTextarea.value?.focus()
    editTextarea.value?.select()
  })
}

function saveEdit() {
  emit('edit-save', props.index, editText.value)
}

function cancelEdit() {
  emit('edit-cancel', props.index)
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    cancelEdit()
  }
}

function onClick(e: MouseEvent) {
  emit('click', props.index, e)
}

function onContextmenu(e: MouseEvent) {
  emit('contextmenu', props.index, e)
}
</script>

<template>
  <div
    class="cue-item"
    :class="{
      active: isActive,
      selected: isSelected,
      disabled: segment.disabled,
      editing: isEditing,
    }"
    @click="onClick"
    @dblclick="startEdit"
    @contextmenu.prevent="onContextmenu"
  >
    <span v-if="showIndex" class="cue-index">{{ index + 1 }}</span>
    <span v-if="showTime" class="cue-time">{{ timeStr }}</span>
    <span v-if="showSticker && segment.sticker" class="cue-sticker">
      {{ segment.sticker.name }}
    </span>
    <div class="cue-text">
      <template v-if="!isEditing">
        <span
          v-if="searchQuery"
          v-html="escapeHtml(segment.text).replace(new RegExp(escapeHtml(searchQuery).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), (m) => `<mark>${m}</mark>`)"
        />
        <template v-else>{{ segment.text }}</template>
      </template>
      <textarea
        v-else
        ref="editTextarea"
        v-model="editText"
        class="cue-edit-textarea"
        @keydown="onKeydown"
        @blur="saveEdit"
      />
    </div>
    <span v-if="showCharcount" class="cue-charcount" :class="{ over: isOverThreshold }">
      {{ metrics.totalLength }}
    </span>
  </div>
</template>

<style scoped>
.cue-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 8px;
  border-bottom: 1px solid #333;
  cursor: pointer;
  user-select: none;
  min-height: 28px;
}
.cue-item:hover { background: #2a2a3e; }
.cue-item.active { background: #3a3a5e; }
.cue-item.selected { background: #4a4a6e; }
.cue-item.disabled { opacity: 0.4; }
.cue-item.editing { background: #2a2a4e; }

.cue-index {
  color: #888;
  font-size: 11px;
  min-width: 24px;
  text-align: right;
}
.cue-time {
  color: #6c63ff;
  font-size: 11px;
  font-family: monospace;
  min-width: 180px;
}
.cue-sticker {
  color: #ffa500;
  font-size: 11px;
}
.cue-text {
  flex: 1;
  font-size: 13px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.cue-edit-textarea {
  width: 100%;
  min-height: 60px;
  background: #1a1a2e;
  border: 1px solid #6c63ff;
  border-radius: 4px;
  color: #e0e0e0;
  font-size: 13px;
  padding: 4px;
  resize: vertical;
}
.cue-charcount {
  color: #888;
  font-size: 11px;
  min-width: 20px;
  text-align: right;
}
.cue-charcount.over { color: #ff6b6b; font-weight: bold; }
</style>
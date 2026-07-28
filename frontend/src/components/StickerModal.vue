<script setup lang="ts">
import { useProjectStore } from '../stores/project.js'
import { useSelectionStore } from '../stores/selection.js'
import { useStickerDirectory } from '../composables/useStickerDirectory.js'
import type { StickerHead } from '../types/project.js'

const show = defineModel<boolean>('show', { default: false })

const project = useProjectStore()
const selection = useSelectionStore()
const { stickers, stickerRoot, selectDirectory } = useStickerDirectory()

function assignSticker(name: string) {
  const idx = selection.lastActive
  if (idx < 0) return
  const seg = project.segments[idx]
  const head: StickerHead = {
    name,
    filename: name,
    rel: '',
    start: seg.start,
    end: seg.end,
  }
  project.updateSegment(idx, { sticker: head, sticker_ref: null })
  show.value = false
}
</script>

<template>
  <Teleport to="body">
    <div v-if="show" class="modal-overlay" @click.self="show = false">
      <div class="modal-content">
        <div class="modal-header">
          <h3>表情包</h3>
          <button @click="show = false" class="close-btn">✕</button>
        </div>
        <div class="toolbar">
          <button @click="selectDirectory" class="btn-select">选择表情包目录</button>
          <span v-if="stickers.length" class="count">{{ stickers.length }} 个</span>
        </div>
        <div class="grid" v-if="stickers.length">
          <div
            v-for="sticker in stickers"
            :key="sticker.name"
            class="sticker-item"
            @click="assignSticker(sticker.name)"
          >
            <img :src="sticker.url" :alt="sticker.name" class="sticker-img" />
            <span class="sticker-name">{{ sticker.name }}</span>
          </div>
        </div>
        <div v-else class="empty-hint">选择一个表情包目录</div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.modal-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.6);
  display: flex; align-items: center; justify-content: center; z-index: 9000;
}
.modal-content {
  background: #2a2a3e; border-radius: 10px; padding: 20px;
  width: 600px; max-width: 90vw; max-height: 80vh; overflow-y: auto; color: #e0e0e0;
}
.modal-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.modal-header h3 { margin: 0; font-size: 16px; }
.close-btn { background: none; border: none; color: #888; cursor: pointer; font-size: 18px; }
.toolbar { margin-bottom: 12px; }
.btn-select { padding: 6px 14px; background: #6c63ff; border: none; border-radius: 4px; color: #fff; cursor: pointer; font-size: 13px; }
.count { margin-left: 8px; font-size: 12px; color: #888; }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)); gap: 8px; }
.sticker-item {
  display: flex; flex-direction: column; align-items: center; padding: 6px;
  border: 1px solid #444; border-radius: 6px; cursor: pointer; background: #1a1a2e;
}
.sticker-item:hover { border-color: #6c63ff; background: #222; }
.sticker-img { width: 64px; height: 64px; object-fit: contain; }
.sticker-name { font-size: 11px; color: #888; margin-top: 4px; text-align: center; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
.empty-hint { color: #666; text-align: center; padding: 40px; font-size: 14px; }
</style>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import ToolbarActions from './components/ToolbarActions.vue'
import ToolbarSubtitle from './components/ToolbarSubtitle.vue'
import MediaPlayer from './components/MediaPlayer.vue'
import CurrentCuePanel from './components/CurrentCuePanel.vue'
import CueList from './components/CueList.vue'
import WaveformPane from './components/WaveformPane.vue'
import ContextMenu from './components/ContextMenu.vue'
import ReplaceModal from './components/ReplaceModal.vue'
import DragOverlay from './components/DragOverlay.vue'
import SetupWizard from './components/SetupWizard.vue'
import EditorSettingsPanel from './components/EditorSettingsPanel.vue'
import GapRemovePanel from './components/GapRemovePanel.vue'
import StickerModal from './components/StickerModal.vue'
import ToolbarWaveform from './components/ToolbarWaveform.vue'
import LayoutResizers from './components/LayoutResizers.vue'
import { useKeyboard } from './composables/useKeyboard.js'
import { useFileDrop } from './composables/useFileDrop.js'
import { useProjectStore } from './stores/project.js'
import { useSelectionStore } from './stores/selection.js'

const project = useProjectStore()
const selection = useSelectionStore()
const setupWizardRef = ref<InstanceType<typeof SetupWizard> | null>(null)
const mediaPlayerRef = ref<InstanceType<typeof MediaPlayer> | null>(null)
const showSettings = ref(false)
const showGapRemove = ref(false)
const showSticker = ref(false)

// 播放同步：根据当前时间找到活跃字幕
function onPlayerTimeUpdate(timeMs: number) {
  const idx = project.segments.findIndex((seg) =>
    !seg.disabled && timeMs >= seg.start && timeMs < seg.end
  )
  if (idx >= 0 && idx !== selection.lastActive) {
    selection.setActive(idx)
  }
}

onMounted(() => {
  if (mediaPlayerRef.value) {
    const kb = useKeyboard({
      togglePlayback: () => mediaPlayerRef.value!.togglePlayback(),
      setRate: (rate: number) => mediaPlayerRef.value!.setRate(rate),
    })
    kb.init()
  }
  const fileDrop = useFileDrop()
  fileDrop.init()
})
</script>

<template>
  <div id="maw-app">
    <SetupWizard ref="setupWizardRef" />
    <ToolbarActions
      @open-settings="setupWizardRef?.open()"
      @open-editor-settings="showSettings = true"
      @open-gap-remove="showGapRemove = true"
    />
    <ToolbarSubtitle />
    <ToolbarWaveform />
    <div class="editor-workspace" style="position: relative;">
      <div class="workspace-left">
        <MediaPlayer ref="mediaPlayerRef" @timeupdate="onPlayerTimeUpdate" />
        <CurrentCuePanel />
      </div>
      <div class="workspace-center">
        <WaveformPane />
        <CueList />
      </div>
      <LayoutResizers />
    </div>
    <EditorSettingsPanel v-model:show="showSettings" />
    <GapRemovePanel v-model:show="showGapRemove" />
    <StickerModal v-model:show="showSticker" />
    <ContextMenu />
    <ReplaceModal />
    <DragOverlay />
  </div>
</template>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}
html, body, #app {
  width: 100%;
  height: 100%;
  overflow: hidden;
}
body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background: #1a1a2e;
  color: #e0e0e0;
  font-size: 14px;
}
#maw-app {
  display: flex;
  flex-direction: column;
  height: 100%;
}
.editor-workspace {
  display: flex;
  flex: 1;
  overflow: hidden;
}
.workspace-left {
  width: 320px;
  min-width: 200px;
  display: flex;
  flex-direction: column;
  border-right: 1px solid #333;
}
.workspace-center {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
</style>
<script setup lang="ts">
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
import { useApp } from './composables/useApp.js'

const {
  setupWizardRef,
  mediaPlayerRef,
  showSettings,
  showGapRemove,
  showSticker,
  onPlayerTimeUpdate,
} = useApp()
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
    <div id="editor-workspace" class="editor-workspace" style="position: relative;">
      <div class="workspace-left">
        <MediaPlayer ref="mediaPlayerRef" @timeupdate="onPlayerTimeUpdate" />
        <CurrentCuePanel />
        <CueList />
      </div>
      <div class="workspace-center">
        <WaveformPane />
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
  overflow: hidden;
}
.workspace-left > :nth-child(1) { flex: 2; min-height: 0; }
.workspace-left > :nth-child(2) { flex: 1; min-height: 0; }
.workspace-left > :nth-child(3) { flex: 2; min-height: 0; }
.workspace-center {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
</style>

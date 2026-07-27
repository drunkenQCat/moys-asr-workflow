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
</script>

<template>
  <div id="maw-app">
    <SetupWizard />
    <ToolbarActions />
    <ToolbarSubtitle />
    <div class="editor-workspace">
      <div class="workspace-left">
        <MediaPlayer />
        <CurrentCuePanel />
      </div>
      <div class="workspace-center">
        <WaveformPane />
        <CueList />
      </div>
    </div>
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
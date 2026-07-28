<script setup lang="ts">
import { ref } from 'vue'
import { useEditorSettingsStore } from '../stores/editor-settings.js'

const settings = useEditorSettingsStore()
const show = defineModel<boolean>('show', { default: false })
</script>

<template>
  <Teleport to="body">
    <div v-if="show" class="settings-overlay" @click.self="show = false">
      <div class="settings-panel">
        <div class="panel-header">
          <h3>编辑器设置</h3>
          <button @click="show = false" class="close-btn">✕</button>
        </div>

        <div class="section">
          <h4>字幕列表显示</h4>
          <label class="toggle"><input type="checkbox" :checked="settings.settings.cueListShowIndex" @change="settings.updateSetting('cueListShowIndex', ($event.target as HTMLInputElement).checked)" /> 序号</label>
          <label class="toggle"><input type="checkbox" :checked="settings.settings.cueListShowTime" @change="settings.updateSetting('cueListShowTime', ($event.target as HTMLInputElement).checked)" /> 时间</label>
          <label class="toggle"><input type="checkbox" :checked="settings.settings.cueListShowSticker" @change="settings.updateSetting('cueListShowSticker', ($event.target as HTMLInputElement).checked)" /> 表情包</label>
          <label class="toggle"><input type="checkbox" :checked="settings.settings.cueListShowCharcount" @change="settings.updateSetting('cueListShowCharcount', ($event.target as HTMLInputElement).checked)" /> 字数</label>
        </div>

        <div class="section">
          <h4>字幕编辑器</h4>
          <label class="toggle"><input type="checkbox" :checked="settings.settings.cueEditorShowNavigation" @change="settings.updateSetting('cueEditorShowNavigation', ($event.target as HTMLInputElement).checked)" /> 导航按钮</label>
          <label class="toggle"><input type="checkbox" :checked="settings.settings.cueEditorShowSticker" @change="settings.updateSetting('cueEditorShowSticker', ($event.target as HTMLInputElement).checked)" /> 表情包</label>
        </div>

        <div class="section">
          <h4>编辑</h4>
          <label class="field-label">拆分键</label>
          <select :value="settings.settings.splitKey" @change="settings.updateSetting('splitKey', ($event.target as HTMLSelectElement).value as 'ctrl-enter' | 'enter')" class="select">
            <option value="ctrl-enter">Ctrl+Enter</option>
            <option value="enter">Enter</option>
          </select>
          <label class="toggle"><input type="checkbox" :checked="settings.settings.hideDisabled" @change="settings.updateSetting('hideDisabled', ($event.target as HTMLInputElement).checked)" /> 隐藏禁用字幕</label>
        </div>

        <div class="section">
          <h4>播放</h4>
          <label class="toggle"><input type="checkbox" :checked="settings.settings.overlayEnabled" @change="settings.updateSetting('overlayEnabled', ($event.target as HTMLInputElement).checked)" /> 字幕叠加预览</label>
        </div>

        <div class="section">
          <h4>导出</h4>
          <label class="toggle"><input type="checkbox" :checked="settings.settings.exportStartAtZero" @change="settings.updateSetting('exportStartAtZero', ($event.target as HTMLInputElement).checked)" /> 时间从零开始</label>
          <label class="field-label">字数阈值</label>
          <input type="number" :value="settings.settings.charcountThreshold" @change="settings.updateSetting('charcountThreshold', Number(($event.target as HTMLInputElement).value))" class="number-input" min="5" max="50" />
        </div>

        <div class="actions">
          <button @click="settings.resetToDefaults()" class="btn-reset">重置默认</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.settings-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9000;
}
.settings-panel {
  background: #2a2a3e;
  border-radius: 10px;
  padding: 24px;
  width: 400px;
  max-width: 90vw;
  max-height: 80vh;
  overflow-y: auto;
  color: #e0e0e0;
}
.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}
.panel-header h3 { margin: 0; font-size: 16px; }
.close-btn {
  background: none; border: none; color: #888; cursor: pointer; font-size: 18px;
}
.section {
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid #333;
}
.section:last-child { border-bottom: none; }
.section h4 {
  margin: 0 0 8px;
  font-size: 13px;
  color: #6c63ff;
}
.toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  margin-bottom: 6px;
  cursor: pointer;
}
.toggle input { margin: 0; }
.field-label {
  display: block;
  font-size: 12px;
  color: #888;
  margin: 8px 0 4px;
}
.select, .number-input {
  width: 100%;
  padding: 6px 8px;
  background: #1a1a2e;
  border: 1px solid #444;
  border-radius: 4px;
  color: #e0e0e0;
  font-size: 13px;
}
.actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}
.btn-reset {
  padding: 6px 16px;
  background: transparent;
  border: 1px solid #444;
  border-radius: 4px;
  color: #e0e0e0;
  cursor: pointer;
  font-size: 12px;
}
</style>
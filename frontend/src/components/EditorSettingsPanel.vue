<script setup lang="ts">
import { useEditorSettingsPanel } from '../composables/useEditorSettingsPanel.js'

const show = defineModel<boolean>('show', { default: false })

const { settings, sections, updateCheckbox, updateSelect, updateNumber, reset } = useEditorSettingsPanel()
</script>

<template>
  <Teleport to="body">
    <div v-if="show" class="settings-overlay" @click.self="show = false">
      <div class="settings-panel">
        <div class="panel-header">
          <h3>编辑器设置</h3>
          <button @click="show = false" class="close-btn">✕</button>
        </div>

        <div class="section" v-for="section in sections" :key="section.title">
          <h4>{{ section.title }}</h4>
          <template v-for="item in section.items" :key="item.key">
            <label v-if="item.type === 'checkbox'" class="toggle">
              <input
                type="checkbox"
                :checked="settings[item.key]"
                @change="updateCheckbox(item.key, ($event.target as HTMLInputElement).checked)"
              />
              {{ item.label }}
            </label>
            <template v-else-if="item.type === 'select'">
              <label class="field-label">{{ item.label }}</label>
              <select
                :value="settings[item.key]"
                @change="updateSelect(item.key, ($event.target as HTMLSelectElement).value)"
                class="select"
              >
                <option v-for="opt in item.options" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
              </select>
            </template>
            <template v-else-if="item.type === 'number'">
              <label class="field-label">{{ item.label }}</label>
              <input
                type="number"
                :value="settings[item.key]"
                @change="updateNumber(item.key, Number(($event.target as HTMLInputElement).value))"
                class="number-input"
                :min="item.min"
                :max="item.max"
              />
            </template>
          </template>
        </div>

        <div class="actions">
          <button @click="reset" class="btn-reset">重置默认</button>
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

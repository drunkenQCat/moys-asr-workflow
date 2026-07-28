<script setup lang="ts">
import { useSubtitleToolbar } from '../composables/useSubtitleToolbar.js'

const { searchQuery, filterOverOnly, count } = useSubtitleToolbar()
</script>

<template>
  <div class="toolbar-subtitle">
    <input
      v-model="searchQuery"
      type="text"
      class="search-input"
      placeholder="搜索字幕..."
    />
    <label class="filter-label">
      <input type="checkbox" v-model="filterOverOnly" />
      仅超长
    </label>
    <span class="count">{{ count }} 条</span>
  </div>
</template>

<style scoped>
.toolbar-subtitle {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 8px;
  background: #1e1e32;
  border-bottom: 1px solid #333;
  font-size: 12px;
}
.search-input {
  flex: 1;
  padding: 4px 8px;
  background: #1a1a2e;
  border: 1px solid #444;
  border-radius: 4px;
  color: #e0e0e0;
  font-size: 12px;
}
.search-input:focus { border-color: #6c63ff; outline: none; }
.filter-label {
  display: flex;
  align-items: center;
  gap: 4px;
  color: #888;
  cursor: pointer;
}
.count {
  color: #888;
  min-width: 40px;
  text-align: right;
}
</style>

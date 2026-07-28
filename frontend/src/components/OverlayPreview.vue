<script setup lang="ts">
import { useOverlayPreview } from '../composables/useOverlayPreview.js'

const { enabled, activeCue } = useOverlayPreview()
</script>

<template>
  <div v-if="enabled && activeCue" class="overlay">
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

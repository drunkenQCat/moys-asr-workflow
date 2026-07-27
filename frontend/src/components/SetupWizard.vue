<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { loadAsrConfig, saveAsrConfig, hasApiKey } from '../core/asr-config.js'

const emit = defineEmits<{
  done: []
}>()

const apiKey = ref('')
const language = ref('zh')
const model = ref('qwen3-asr-flash-filetrans')
const testing = ref(false)
const testResult = ref('')
const show = ref(false)

onMounted(() => {
  if (!hasApiKey()) {
    show.value = true
  }
})

async function testConnection() {
  testing.value = true
  testResult.value = ''
  try {
    const resp = await fetch('https://dashscope.aliyuncs.com/api/v1/uploads', {
      headers: { Authorization: `Bearer ${apiKey.value}` },
    })
    if (resp.ok) {
      testResult.value = '✅ 连接成功'
    } else if (resp.status === 401) {
      testResult.value = '❌ API Key 无效'
    } else {
      testResult.value = `❌ HTTP ${resp.status}: ${resp.statusText}`
    }
  } catch (err: unknown) {
    testResult.value = `❌ 网络错误: ${err instanceof Error ? err.message : String(err)}`
  } finally {
    testing.value = false
  }
}

function save() {
  saveAsrConfig({
    apiKey: apiKey.value,
    language: language.value,
    model: model.value,
  })
  show.value = false
  emit('done')
}

function skip() {
  apiKey.value = ''
  saveAsrConfig({
    apiKey: '',
    language: language.value,
    model: model.value,
  })
  show.value = false
  emit('done')
}
</script>

<template>
  <Teleport to="body">
    <div v-if="show" class="setup-overlay">
      <div class="setup-modal">
        <h2>首次设置</h2>
        <p class="setup-desc">配置 DashScope API Key 以使用 ASR 转写功能</p>

        <div class="field">
          <label>API Key <span class="required">*</span></label>
          <input
            v-model="apiKey"
            type="password"
            placeholder="sk-..."
            class="input"
          />
          <p class="hint">
            在
            <a href="https://bailian.console.aliyun.com/" target="_blank">阿里云百炼控制台</a>
            获取
          </p>
        </div>

        <div class="field">
          <label>识别语言</label>
          <select v-model="language" class="input">
            <option value="zh">中文</option>
            <option value="en">英文</option>
            <option value="ja">日文</option>
            <option value="ko">韩文</option>
          </select>
        </div>

        <div class="field">
          <label>ASR 模型</label>
          <input v-model="model" type="text" class="input" />
        </div>

        <div class="actions">
          <button
            class="btn btn-test"
            :disabled="!apiKey || testing"
            @click="testConnection"
          >
            {{ testing ? '测试中...' : '测试连接' }}
          </button>
          <span v-if="testResult" class="test-result">{{ testResult }}</span>
        </div>

        <div class="actions-bottom">
          <button class="btn btn-skip" @click="skip">跳过</button>
          <button class="btn btn-primary" :disabled="!apiKey" @click="save">
            保存
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.setup-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}
.setup-modal {
  background: #2a2a3e;
  border-radius: 12px;
  padding: 32px;
  width: 460px;
  max-width: 90vw;
  color: #e0e0e0;
}
.setup-modal h2 {
  margin: 0 0 8px;
  font-size: 20px;
}
.setup-desc {
  color: #888;
  margin: 0 0 24px;
  font-size: 14px;
}
.field {
  margin-bottom: 16px;
}
.field label {
  display: block;
  margin-bottom: 6px;
  font-size: 13px;
  font-weight: 600;
}
.required { color: #ff6b6b; }
.input {
  width: 100%;
  padding: 8px 12px;
  background: #1a1a2e;
  border: 1px solid #444;
  border-radius: 6px;
  color: #e0e0e0;
  font-size: 14px;
}
.input:focus {
  border-color: #6c63ff;
  outline: none;
}
select.input {
  appearance: auto;
}
.hint {
  margin: 4px 0 0;
  font-size: 12px;
  color: #888;
}
.hint a {
  color: #6c63ff;
}
.actions {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 24px;
}
.test-result {
  font-size: 13px;
}
.actions-bottom {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}
.btn {
  padding: 8px 20px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
}
.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.btn-primary {
  background: #6c63ff;
  color: #fff;
}
.btn-skip {
  background: transparent;
  color: #888;
  border: 1px solid #444;
}
.btn-test {
  background: #3a3a5e;
  color: #e0e0e0;
}
</style>
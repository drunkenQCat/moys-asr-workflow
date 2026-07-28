import { ref } from 'vue'
import { computeBaseUrl } from '../core/asr.js'

export function useAsrConnectionTest() {
  const testing = ref(false)
  const testResult = ref('')

  async function testConnection(apiKey: string, workspaceId: string) {
    testing.value = true
    testResult.value = ''
    try {
      const baseUrl = computeBaseUrl(workspaceId)
      const resp = await fetch(`${baseUrl}/api/v1/services/audio/asr/transcription`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'X-DashScope-Async': 'enable',
        },
        body: JSON.stringify({
          model: 'qwen3-asr-flash-filetrans',
          input: { file_url: 'oss://placeholder/test.wav' },
          parameters: { channel_id: [0] },
        }),
      })
      if (resp.ok || resp.status === 400) {
        testResult.value = '✅ 连接成功'
      } else if (resp.status === 401) {
        testResult.value = '❌ API Key 无效'
      } else if (resp.status === 403) {
        testResult.value = '❌ 鉴权失败，请检查工作空间 ID 和 API Key'
      } else {
        testResult.value = `❌ HTTP ${resp.status}: ${resp.statusText}`
      }
    } catch (err: unknown) {
      testResult.value = `❌ 网络错误: ${err instanceof Error ? err.message : String(err)}`
    } finally {
      testing.value = false
    }
  }

  return {
    testing,
    testResult,
    testConnection,
  }
}

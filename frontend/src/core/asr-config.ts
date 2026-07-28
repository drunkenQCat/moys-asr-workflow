// ASR 配置管理 — localStorage 持久化

import type { AsrConfig } from './asr.js'

const CONFIG_KEY = 'moy.asr.config'

const DEFAULT_CONFIG: AsrConfig = {
  apiKey: '',
  language: 'zh',
  model: 'qwen3-asr-flash-filetrans',
  workspaceId: '',
}

export function loadAsrConfig(): AsrConfig {
  try {
    const raw = localStorage.getItem(CONFIG_KEY)
    if (!raw) return { ...DEFAULT_CONFIG }
    return { ...DEFAULT_CONFIG, ...JSON.parse(raw) }
  } catch {
    return { ...DEFAULT_CONFIG }
  }
}

export function saveAsrConfig(config: AsrConfig): void {
  try {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(config))
  } catch {
    // storage full — silently ignore
  }
}

export function hasApiKey(): boolean {
  const config = loadAsrConfig()
  return !!config.apiKey
}

export function clearAsrConfig(): void {
  try {
    localStorage.removeItem(CONFIG_KEY)
  } catch {
    // ignore
  }
}
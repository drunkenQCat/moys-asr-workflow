import { useEditorSettingsStore } from '../stores/editor-settings.js'
import type { EditorSettings } from '../types/settings.js'

export interface SettingsSection {
  title: string
  items: SettingsItem[]
}

export type BooleanSettingsKey = {
  [K in keyof EditorSettings]: EditorSettings[K] extends boolean ? K : never
}[keyof EditorSettings]

export type NumberSettingsKey = {
  [K in keyof EditorSettings]: EditorSettings[K] extends number ? K : never
}[keyof EditorSettings]

export type SettingsItem =
  | { type: 'checkbox'; key: BooleanSettingsKey; label: string }
  | { type: 'select'; key: keyof EditorSettings; label: string; options: { value: string; label: string }[] }
  | { type: 'number'; key: NumberSettingsKey; label: string; min: number; max: number }

export function useEditorSettingsPanel() {
  const settings = useEditorSettingsStore()

  const sections: SettingsSection[] = [
    {
      title: '字幕列表显示',
      items: [
        { type: 'checkbox', key: 'cueListShowIndex' as const, label: '序号' },
        { type: 'checkbox', key: 'cueListShowTime' as const, label: '时间' },
        { type: 'checkbox', key: 'cueListShowSticker' as const, label: '表情包' },
        { type: 'checkbox', key: 'cueListShowCharcount' as const, label: '字数' },
      ],
    },
    {
      title: '字幕编辑器',
      items: [
        { type: 'checkbox', key: 'cueEditorShowNavigation' as const, label: '导航按钮' },
        { type: 'checkbox', key: 'cueEditorShowSticker' as const, label: '表情包' },
      ],
    },
    {
      title: '编辑',
      items: [
        {
          type: 'select',
          key: 'splitKey' as const,
          label: '拆分键',
          options: [
            { value: 'ctrl-enter', label: 'Ctrl+Enter' },
            { value: 'enter', label: 'Enter' },
          ],
        },
        { type: 'checkbox', key: 'hideDisabled' as const, label: '隐藏禁用字幕' },
      ],
    },
    {
      title: '播放',
      items: [
        { type: 'checkbox', key: 'overlayEnabled' as const, label: '字幕叠加预览' },
      ],
    },
    {
      title: '导出',
      items: [
        { type: 'checkbox', key: 'exportStartAtZero' as const, label: '时间从零开始' },
        { type: 'number', key: 'charcountThreshold' as const, label: '字数阈值', min: 5, max: 50 },
      ],
    },
  ]

  function updateCheckbox(key: keyof EditorSettings, checked: boolean) {
    settings.updateSetting(key, checked as any)
  }

  function updateSelect(key: keyof EditorSettings, value: string) {
    settings.updateSetting(key, value as any)
  }

  function updateNumber(key: keyof EditorSettings, value: number) {
    settings.updateSetting(key, value as any)
  }

  function reset() {
    settings.resetToDefaults()
  }

  return {
    settings: settings.settings,
    sections,
    updateCheckbox,
    updateSelect,
    updateNumber,
    reset,
  }
}

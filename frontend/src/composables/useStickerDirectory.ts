import { ref } from 'vue'

export interface StickerInfo {
  name: string
  url: string
}

export function useStickerDirectory() {
  const stickers = ref<StickerInfo[]>([])
  const stickerRoot = ref('')

  function selectDirectory() {
    const input = document.createElement('input')
    input.type = 'file'
    input.webkitdirectory = true
    input.onchange = () => {
      const files = Array.from(input.files || [])
      const imageFiles = files.filter((f) => f.type.startsWith('image/'))
      stickers.value = imageFiles.map((f) => ({
        name: f.name.replace(/\.[^.]+$/, ''),
        url: URL.createObjectURL(f),
      }))
      if (imageFiles.length > 0) {
        stickerRoot.value = imageFiles[0].webkitRelativePath.split('/')[0]
      }
    }
    input.click()
  }

  return {
    stickers,
    stickerRoot,
    selectDirectory,
  }
}

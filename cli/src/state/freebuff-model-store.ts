import { create } from 'zustand'

interface FreebuffModelStore {
  selectedModel: string
  setSelectedModel: (model: string) => void
}

export const useFreebuffModelStore = create<FreebuffModelStore>((set) => ({
  selectedModel: '',
  setSelectedModel: (model) => set({ selectedModel: model }),
}))

export function getSelectedFreebuffModel(): string {
  return useFreebuffModelStore.getState().selectedModel
}

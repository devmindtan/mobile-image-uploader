import { create } from 'zustand'

export type UploadStatus = 'pending' | 'uploading' | 'done' | 'error'

export interface FileItem {
  id: string
  uri: string
  name: string
  size: number
  mimeType: string
  status: UploadStatus
  progress: number
  s3Key?: string
  errorMessage?: string
}

export interface UploadConfig {
  uploadBaseUrl: string
}

interface UploadStore {
  files: FileItem[]
  config: UploadConfig
  isUploading: boolean
  speed: number        // MB/s
  totalUploaded: number // bytes
  addFiles: (items: FileItem[]) => void
  removeFile: (id: string) => void
  clearAll: () => void
  updateFile: (id: string, patch: Partial<FileItem>) => void
  setConfig: (config: Partial<UploadConfig>) => void
  setIsUploading: (val: boolean) => void
  setSpeed: (val: number) => void
  setTotalUploaded: (val: number) => void
}

export const DEFAULT_CONFIG: UploadConfig = {
  uploadBaseUrl: process.env.EXPO_PUBLIC_UPLOAD_BASE_URL ?? 'http://localhost:9000/sandbox',
}

export const useUploadStore = create<UploadStore>((set) => ({
  files: [],
  config: DEFAULT_CONFIG,
  isUploading: false,
  speed: 0,
  totalUploaded: 0,

  addFiles: (items) =>
    set((s) => ({ files: [...s.files, ...items] })),

  removeFile: (id) =>
    set((s) => ({ files: s.files.filter((f) => f.id !== id) })),

  clearAll: () => set({ files: [], totalUploaded: 0, speed: 0 }),

  updateFile: (id, patch) =>
    set((s) => ({
      files: s.files.map((f) => (f.id === id ? { ...f, ...patch } : f)),
    })),

  setConfig: (patch) =>
    set((s) => ({ config: { ...s.config, ...patch } })),

  setIsUploading: (val) => set({ isUploading: val }),
  setSpeed: (val) => set({ speed: val }),
  setTotalUploaded: (val) => set({ totalUploaded: val }),
}))
import * as FileSystem from 'expo-file-system/legacy'
import { FileItem, UploadConfig, useUploadStore } from './uploadStore'

export type ConnectionResult = {
  ok: boolean
  message?: string
}

export type BucketImageItem = {
  key: string
  size: number
  lastModified: string
  url: string
}

export type BucketImagePage = {
  items: BucketImageItem[]
  nextContinuationToken?: string
}

function normalizeEndpoint(endpoint: string): string {
  return endpoint.trim().replace(/\/+$/, '')
}

function makeObjectKey(fileName: string): string {
  const clean = fileName.trim().replace(/\s+/g, '_')
  return `${Date.now()}_${clean}`
}

function getErrorMessage(err: unknown): string {
  if (!err || typeof err !== 'object') return 'Không rõ nguyên nhân'
  const withMessage = err as { message?: string; name?: string }
  if (withMessage.message && withMessage.message.trim()) return withMessage.message
  if (withMessage.name && withMessage.name.trim()) return withMessage.name
  return 'Không rõ nguyên nhân'
}

function toObjectUrl(baseUrl: string, key: string): string {
  // Keep path separators in object keys while encoding other characters.
  const encodedKey = key
    .split('/')
    .map((part) => encodeURIComponent(part))
    .join('/')
  return `${normalizeEndpoint(baseUrl)}/${encodedKey}`
}

function decodeXml(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
}

function isImageKey(key: string): boolean {
  return /\.(jpg|jpeg|png|gif|webp|bmp|heic|heif|avif)$/i.test(key)
}

export async function testConnection(config: UploadConfig): Promise<ConnectionResult> {
  try {
    const endpoint = normalizeEndpoint(config.uploadBaseUrl)
    const res = await fetch(endpoint, { method: 'GET' })
    if (res.status >= 500) {
      return {
        ok: false,
        message: `HTTP ${res.status}`,
      }
    }
    return { ok: true }
  } catch (err) {
    return {
      ok: false,
      message: getErrorMessage(err),
    }
  }
}

export async function uploadFile(
  file: FileItem,
  onProgress: (loaded: number, total: number) => void,
): Promise<string> {
  const config = useUploadStore.getState().config
  const baseUrl = normalizeEndpoint(config.uploadBaseUrl)
  const key = makeObjectKey(file.name)
  const url = `${baseUrl}/${encodeURIComponent(key)}`

  const task = FileSystem.createUploadTask(
    url,
    file.uri,
    {
      httpMethod: 'PUT',
      uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
      headers: { 'Content-Type': file.mimeType },
      sessionType: FileSystem.FileSystemSessionType.BACKGROUND,
    },
    (progress: { totalBytesSent: number; totalBytesExpectedToSend: number }) => {
      onProgress(progress.totalBytesSent, progress.totalBytesExpectedToSend)
    },
  )

  await task.uploadAsync()
  onProgress(file.size, file.size)
  return key
}

export async function listBucketImagesPage(
  limit = 5,
  continuationToken?: string,
): Promise<BucketImagePage> {
  const { uploadBaseUrl } = useUploadStore.getState().config
  const baseUrl = normalizeEndpoint(uploadBaseUrl)
  const params = new URLSearchParams({
    'list-type': '2',
    'max-keys': String(limit),
  })
  if (continuationToken) {
    params.set('continuation-token', continuationToken)
  }
  const listUrl = `${baseUrl}?${params.toString()}`

  const res = await fetch(listUrl)
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Không tải được danh sách ảnh (HTTP ${res.status}): ${body}`)
  }

  const xml = await res.text()
  const contentBlocks = xml.match(/<Contents>[\s\S]*?<\/Contents>/g) ?? []

  const items: BucketImageItem[] = []
  for (const block of contentBlocks) {
    const keyMatch = block.match(/<Key>([\s\S]*?)<\/Key>/)
    if (!keyMatch?.[1]) continue

    const key = decodeXml(keyMatch[1].trim())
    if (!isImageKey(key)) continue

    const sizeMatch = block.match(/<Size>(\d+)<\/Size>/)
    const modifiedMatch = block.match(/<LastModified>([\s\S]*?)<\/LastModified>/)

    items.push({
      key,
      size: sizeMatch?.[1] ? Number(sizeMatch[1]) : 0,
      lastModified: modifiedMatch?.[1]?.trim() ?? '',
      url: toObjectUrl(baseUrl, key),
    })
  }

  const nextTokenMatch = xml.match(/<NextContinuationToken>([\s\S]*?)<\/NextContinuationToken>/)
  const nextContinuationToken = nextTokenMatch?.[1]?.trim() ? decodeXml(nextTokenMatch[1].trim()) : undefined

  return {
    items: items.sort((a, b) => b.lastModified.localeCompare(a.lastModified)),
    nextContinuationToken,
  }
}

export async function deleteBucketImage(key: string): Promise<void> {
  const { uploadBaseUrl } = useUploadStore.getState().config
  const objectUrl = toObjectUrl(uploadBaseUrl, key)

  const res = await fetch(objectUrl, { method: 'DELETE' })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Xóa ảnh thất bại (HTTP ${res.status}): ${body}`)
  }
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

export function generateId(): string {
  return Math.random().toString(36).slice(2, 10)
}
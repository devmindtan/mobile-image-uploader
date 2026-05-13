import * as ImagePicker from 'expo-image-picker'
import { router } from 'expo-router'
import React, { useCallback } from 'react'
import {
    Alert,
    FlatList,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { formatBytes, generateId } from '../utils/minio'
import { FileItem, useUploadStore } from '../utils/uploadStore'

export default function HomeScreen() {
  const { files, config, addFiles, removeFile, clearAll } = useUploadStore()

  const pendingCount = files.filter((f) => f.status === 'pending').length
  const doneCount = files.filter((f) => f.status === 'done').length

  const pickImages = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert('Cần quyền truy cập', 'Vui lòng cho phép truy cập thư viện ảnh.')
      return
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      allowsMultipleSelection: true,
      quality: 1,
    })
    if (!result.canceled) {
      const newFiles: FileItem[] = result.assets.map((asset) => ({
        id: generateId(),
        uri: asset.uri,
        name: asset.fileName ?? `photo_${Date.now()}.jpg`,
        size: asset.fileSize ?? 0,
        mimeType: asset.mimeType ?? 'image/jpeg',
        status: 'pending',
        progress: 0,
      }))
      addFiles(newFiles)
    }
  }, [addFiles])

  const handleUploadAll = () => {
    if (!config.uploadBaseUrl?.trim()) {
      Alert.alert(
        'Chưa cấu hình',
        'Vui lòng vào Cài đặt để nhập Upload Base URL.',
        [
          { text: 'Huỷ', style: 'cancel' },
          { text: 'Cài đặt', onPress: () => router.push('/settings') },
        ],
      )
      return
    }
    if (pendingCount === 0) {
      Alert.alert('Không có file', 'Thêm ảnh vào hàng chờ trước.')
      return
    }
    router.push('/progress')
  }

  const handleLongPress = (file: FileItem) => {
    if (file.status === 'uploading') return
    Alert.alert('Xoá file', `Xoá "${file.name}" khỏi hàng chờ?`, [
      { text: 'Huỷ', style: 'cancel' },
      { text: 'Xoá', style: 'destructive', onPress: () => removeFile(file.id) },
    ])
  }

  const statusIcon = (f: FileItem) => {
    if (f.status === 'done') return '✓'
    if (f.status === 'error') return '✕'
    if (f.status === 'uploading') return `${Math.round(f.progress * 100)}%`
    return '···'
  }

  const statusColor = (f: FileItem) => {
    if (f.status === 'done') return '#3EE08A'
    if (f.status === 'error') return '#FF5A5A'
    if (f.status === 'uploading') return '#F5A623'
    return '#333'
  }

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="light-content" backgroundColor="#0E0E0E" />

      {/* Header */}
      <View style={s.header}>
        <View style={s.headerInfo}>
          <Text style={s.headerTitle}>MinIO Upload</Text>
          <Text style={s.headerSub} numberOfLines={1} ellipsizeMode="middle">
            {config.uploadBaseUrl}
          </Text>
        </View>
        <View style={s.headerRight}>
          {config.uploadBaseUrl?.trim() ? (
            <View style={s.connectedBadge}>
              <Text style={s.connectedText}>● CONNECTED</Text>
            </View>
          ) : (
            <View style={s.warningBadge}>
              <Text style={s.warningText}>! SETUP</Text>
            </View>
          )}
        </View>
      </View>

      {/* Drop zone */}
      <TouchableOpacity style={s.dropZone} onPress={pickImages} activeOpacity={0.7}>
        <Text style={s.dropIcon}>⊕</Text>
        <Text style={s.dropLabel}>Chọn ảnh để upload</Text>
        <Text style={s.dropSub}>JPG · PNG · WEBP · GIF · MAX 50MB</Text>
      </TouchableOpacity>

      {/* Queue header */}
      <View style={s.sectionRow}>
        <Text style={s.sectionLabel}>HÀNG CHỜ</Text>
        <Text style={s.sectionCount}>
          {doneCount}/{files.length} hoàn thành
        </Text>
        {files.length > 0 && (
          <TouchableOpacity onPress={clearAll} style={s.clearBtn}>
            <Text style={s.clearText}>XOÁ TẤT CẢ</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* File list */}
      {files.length === 0 ? (
        <View style={s.emptyState}>
          <Text style={s.emptyIcon}>◫</Text>
          <Text style={s.emptyText}>Chưa có file nào</Text>
          <Text style={s.emptySub}>Nhấn vào vùng trên để chọn ảnh</Text>
        </View>
      ) : (
        <FlatList
          data={files}
          keyExtractor={(item) => item.id}
          contentContainerStyle={s.listContent}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[s.fileItem, item.status === 'uploading' && s.fileItemActive]}
              onLongPress={() => handleLongPress(item)}
              activeOpacity={0.8}
            >
              <View style={s.fileThumb}>
                <Text style={s.fileThumbIcon}>🖼</Text>
              </View>
              <View style={s.fileInfo}>
                <Text style={s.fileName} numberOfLines={1}>{item.name}</Text>
                <Text style={s.fileMeta}>
                  {formatBytes(item.size)} · {item.mimeType.split('/')[1].toUpperCase()}
                </Text>
                {item.status === 'uploading' && (
                  <View style={s.progressBar}>
                    <View style={[s.progressFill, { width: `${item.progress * 100}%` }]} />
                  </View>
                )}
                {item.status === 'error' && (
                  <Text style={s.errorText}>{item.errorMessage ?? 'Lỗi upload'}</Text>
                )}
              </View>
              <Text style={[s.statusText, { color: statusColor(item) }]}>
                {statusIcon(item)}
              </Text>
            </TouchableOpacity>
          )}
        />
      )}

      {/* Bottom bar */}
      <View style={s.bottomBar}>
        <TouchableOpacity style={s.galleryBtn} onPress={() => router.push('/gallery')}>
          <Text style={s.galleryIcon}>▦</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.uploadBtn} onPress={handleUploadAll} activeOpacity={0.85}>
          <Text style={s.uploadBtnText}>↑  Upload tất cả  ({pendingCount})</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.settingsBtn} onPress={() => router.push('/settings')}>
          <Text style={s.settingsIcon}>⚙</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0E0E0E' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 12,
    gap: 12,
  },
  headerInfo: { flex: 1 },
  headerTitle: { fontFamily: 'monospace', fontSize: 14, color: '#AAAAAA', letterSpacing: 1 },
  headerSub: { fontFamily: 'monospace', fontSize: 11, color: '#3A3A3A', marginTop: 2 },
  headerRight: { flexShrink: 0 },
  connectedBadge: {
    backgroundColor: 'rgba(62,224,138,0.1)',
    borderWidth: 0.5,
    borderColor: 'rgba(62,224,138,0.3)',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  connectedText: { fontFamily: 'monospace', fontSize: 9, color: '#3EE08A', letterSpacing: 1 },
  warningBadge: {
    backgroundColor: 'rgba(245,166,35,0.1)',
    borderWidth: 0.5,
    borderColor: 'rgba(245,166,35,0.3)',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  warningText: { fontFamily: 'monospace', fontSize: 9, color: '#F5A623', letterSpacing: 1 },
  dropZone: {
    marginHorizontal: 20,
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: '#2D2D2D',
    borderStyle: 'dashed',
    borderRadius: 12,
    paddingVertical: 28,
    alignItems: 'center',
    gap: 6,
  },
  dropIcon: { fontSize: 32, color: '#3A3A3A' },
  dropLabel: { fontSize: 14, color: '#666', marginTop: 4 },
  dropSub: { fontFamily: 'monospace', fontSize: 10, color: '#333', letterSpacing: 1 },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 8,
    gap: 8,
  },
  sectionLabel: { fontFamily: 'monospace', fontSize: 10, color: '#3E3E3E', letterSpacing: 1.5, flex: 1 },
  sectionCount: { fontFamily: 'monospace', fontSize: 10, color: '#555' },
  clearBtn: { paddingHorizontal: 8, paddingVertical: 3 },
  clearText: { fontFamily: 'monospace', fontSize: 9, color: '#F5A623', letterSpacing: 1 },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  emptyIcon: { fontSize: 40, color: '#222' },
  emptyText: { fontSize: 14, color: '#444' },
  emptySub: { fontSize: 12, color: '#2A2A2A' },
  listContent: { paddingHorizontal: 20, paddingBottom: 8, gap: 6 },
  fileItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#161616',
    borderWidth: 0.5,
    borderColor: '#222',
    borderRadius: 8,
    padding: 10,
    gap: 10,
  },
  fileItemActive: { borderColor: '#2D2000' },
  fileThumb: {
    width: 36,
    height: 36,
    backgroundColor: '#1E1E1E',
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fileThumbIcon: { fontSize: 18 },
  fileInfo: { flex: 1 },
  fileName: { fontSize: 11, color: '#CCCCCC' },
  fileMeta: { fontFamily: 'monospace', fontSize: 10, color: '#444', marginTop: 2 },
  progressBar: {
    height: 2,
    backgroundColor: '#1E1E1E',
    borderRadius: 1,
    marginTop: 5,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: '#F5A623', borderRadius: 1 },
  errorText: { fontSize: 10, color: '#FF5A5A', marginTop: 3 },
  statusText: { fontFamily: 'monospace', fontSize: 12, minWidth: 32, textAlign: 'right' },
  bottomBar: {
    flexDirection: 'row',
    padding: 16,
    gap: 10,
    borderTopWidth: 0.5,
    borderTopColor: '#1A1A1A',
  },
  galleryBtn: {
    width: 48,
    height: 48,
    backgroundColor: '#181818',
    borderWidth: 0.5,
    borderColor: '#2A2A2A',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  galleryIcon: { fontSize: 18, color: '#888' },
  uploadBtn: {
    flex: 1,
    backgroundColor: '#F5A623',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  uploadBtnText: { fontFamily: 'monospace', fontSize: 13, fontWeight: '600', color: '#0E0E0E', letterSpacing: 0.5 },
  settingsBtn: {
    width: 48,
    height: 48,
    backgroundColor: '#181818',
    borderWidth: 0.5,
    borderColor: '#2A2A2A',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsIcon: { fontSize: 20, color: '#555' },
})
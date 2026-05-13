import { router } from 'expo-router'
import React, { useCallback, useEffect, useState } from 'react'
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Image,
    RefreshControl,
    SafeAreaView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native'
import { deleteBucketImage, formatBytes, listBucketImagesPage, type BucketImageItem } from '../utils/minio'

  const PAGE_SIZE = 5

export default function GalleryScreen() {
  const [items, setItems] = useState<BucketImageItem[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
    const [pageIndex, setPageIndex] = useState(0)
    const [pageTokens, setPageTokens] = useState<string[]>([''])
    const [nextToken, setNextToken] = useState<string | undefined>()
    const [changingPage, setChangingPage] = useState(false)

    const loadPage = useCallback(async (targetIndex: number) => {
      const token = pageTokens[targetIndex] || ''
    try {
        const result = await listBucketImagesPage(PAGE_SIZE, token || undefined)
        setItems(result.items)
        setPageIndex(targetIndex)
        setNextToken(result.nextContinuationToken)

        if (result.nextContinuationToken) {
          setPageTokens((prev: string[]) => {
            if (prev[targetIndex + 1]) return prev
            const next = [...prev]
            next[targetIndex + 1] = result.nextContinuationToken as string
            return next
          })
        }
    } catch (err: any) {
      Alert.alert('Không tải được thư viện', err?.message ?? 'Vui lòng thử lại.')
    } finally {
      setLoading(false)
      setRefreshing(false)
        setChangingPage(false)
    }
    }, [pageTokens])

  useEffect(() => {
      loadPage(0)
    }, [loadPage])

  const onRefresh = () => {
    setRefreshing(true)
      setPageTokens([''])
      setNextToken(undefined)
      loadPage(0)
  }

    const goPrev = () => {
      if (pageIndex === 0 || changingPage) return
      setChangingPage(true)
      loadPage(pageIndex - 1)
    }

    const goNext = () => {
      if (!nextToken || changingPage) return
      setChangingPage(true)
      loadPage(pageIndex + 1)
    }

  const handleDelete = (item: BucketImageItem) => {
    Alert.alert('Xóa ảnh', `Bạn có chắc muốn xóa "${item.key}"?`, [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Xóa',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteBucketImage(item.key)
            const nextLength = items.length - 1
            if (nextLength <= 0 && pageIndex > 0) {
              setChangingPage(true)
              loadPage(pageIndex - 1)
            } else {
              setChangingPage(true)
              loadPage(pageIndex)
            }
          } catch (err: any) {
            Alert.alert('Xóa thất bại', err?.message ?? 'Không thể xóa ảnh.')
          }
        },
      },
    ])
  }

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="light-content" backgroundColor="#0E0E0E" />

      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <Text style={s.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>THƯ VIỆN ẢNH</Text>
        <Text style={s.headerCount}>T{pageIndex + 1}</Text>
      </View>

      {loading ? (
        <View style={s.loadingWrap}>
          <ActivityIndicator size="small" color="#F5A623" />
          <Text style={s.loadingText}>Đang tải ảnh...</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item: BucketImageItem) => item.key}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#F5A623" />}
          contentContainerStyle={items.length === 0 ? s.emptyList : s.listContent}
          ListEmptyComponent={
            <View style={s.emptyState}>
              <Text style={s.emptyIcon}>◫</Text>
              <Text style={s.emptyText}>Bucket chưa có ảnh</Text>
              <Text style={s.emptySub}>Hãy upload ảnh từ màn hình chính.</Text>
            </View>
          }
          renderItem={({ item }: { item: BucketImageItem }) => (
            <View style={s.card}>
              <Image source={{ uri: item.url }} style={s.preview} resizeMode="cover" />
              <View style={s.metaWrap}>
                <Text style={s.name} numberOfLines={1}>{item.key}</Text>
                <Text style={s.meta}>{formatBytes(item.size)}</Text>
                <Text style={s.meta} numberOfLines={1}>{item.lastModified || 'N/A'}</Text>
              </View>
              <TouchableOpacity style={s.deleteBtn} onPress={() => handleDelete(item)}>
                <Text style={s.deleteText}>XÓA</Text>
              </TouchableOpacity>
            </View>
          )}
          ListFooterComponent={
            <View style={s.paginationWrap}>
              <TouchableOpacity style={[s.pageBtn, pageIndex === 0 && s.pageBtnDisabled]} onPress={goPrev} disabled={pageIndex === 0 || changingPage}>
                <Text style={s.pageBtnText}>Trang trước</Text>
              </TouchableOpacity>
              <Text style={s.pageInfo}>Trang {pageIndex + 1}</Text>
              <TouchableOpacity style={[s.pageBtn, !nextToken && s.pageBtnDisabled]} onPress={goNext} disabled={!nextToken || changingPage}>
                <Text style={s.pageBtnText}>Trang sau</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0E0E0E' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    gap: 12,
  },
  backBtn: {
    width: 32,
    height: 32,
    borderWidth: 0.5,
    borderColor: '#2A2A2A',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backIcon: { fontSize: 16, color: '#666' },
  headerTitle: {
    fontFamily: 'monospace',
    fontSize: 13,
    color: '#AAAAAA',
    letterSpacing: 1,
    flex: 1,
    textAlign: 'center',
    marginRight: 32,
  },
  headerCount: { fontFamily: 'monospace', fontSize: 11, color: '#F5A623', minWidth: 32, textAlign: 'right' },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  loadingText: { color: '#888', fontSize: 12 },
  listContent: { paddingHorizontal: 20, paddingBottom: 24, gap: 8 },
  emptyList: { flexGrow: 1, justifyContent: 'center' },
  emptyState: { alignItems: 'center', gap: 8 },
  emptyIcon: { fontSize: 40, color: '#222' },
  emptyText: { fontSize: 14, color: '#444' },
  emptySub: { fontSize: 12, color: '#2A2A2A' },
  card: {
    backgroundColor: '#161616',
    borderWidth: 0.5,
    borderColor: '#222',
    borderRadius: 10,
    overflow: 'hidden',
  },
  preview: { width: '100%', height: 180, backgroundColor: '#111' },
  metaWrap: { paddingHorizontal: 12, paddingTop: 10, paddingBottom: 8, gap: 2 },
  name: { color: '#D0D0D0', fontSize: 12 },
  meta: { color: '#6A6A6A', fontFamily: 'monospace', fontSize: 10 },
  deleteBtn: {
    marginHorizontal: 12,
    marginBottom: 12,
    marginTop: 4,
    borderWidth: 0.5,
    borderColor: '#3B1B1B',
    borderRadius: 8,
    alignItems: 'center',
    paddingVertical: 10,
    backgroundColor: '#231414',
  },
  deleteText: { color: '#FF8B8B', fontFamily: 'monospace', fontSize: 11, letterSpacing: 1 },
  paginationWrap: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  pageBtn: {
    flex: 1,
    borderWidth: 0.5,
    borderColor: '#2A2A2A',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: '#181818',
  },
  pageBtnDisabled: { opacity: 0.45 },
  pageBtnText: { color: '#B8B8B8', fontSize: 11, fontFamily: 'monospace' },
  pageInfo: { color: '#888', fontSize: 11, fontFamily: 'monospace' },
})

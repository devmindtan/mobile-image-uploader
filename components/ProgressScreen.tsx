import { useNavigation } from '@react-navigation/native'
import React, { useEffect, useRef } from 'react'
import {
    Alert,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import Svg, { Circle } from 'react-native-svg'
import { formatBytes, uploadFile } from '../utils/minio'
import { useUploadStore } from '../utils/uploadStore'

export default function ProgressScreen() {
  const nav = useNavigation()
  const {
    files,
    updateFile, setIsUploading, setSpeed, setTotalUploaded,
    isUploading, speed, totalUploaded,
  } = useUploadStore()

  const abortRef = useRef(false)
  const startTimeRef = useRef<number>(Date.now())
  const totalUploadedRef = useRef<number>(0)
  const speedTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const doneFiles = files.filter((f: { status: string }) => f.status === 'done')
  const totalBytes = files.reduce((sum: number, f: { size: number }) => sum + f.size, 0)
  const totalPct = totalBytes > 0 ? Math.round((totalUploaded / totalBytes) * 100) : 0
  const eta = speed > 0 ? Math.round((totalBytes - totalUploaded) / (speed * 1024 * 1024)) : null
  const radius = 56
  const stroke = 8
  const circumference = 2 * Math.PI * radius
  const clampedPct = Math.max(0, Math.min(100, totalPct))
  const dashOffset = circumference - (circumference * clampedPct) / 100

  useEffect(() => {
    const startUpload = async () => {
      const initialPendingFiles = useUploadStore
        .getState()
        .files
        .filter((f: { status: string }) => f.status === 'pending')

      abortRef.current = false
      setIsUploading(true)
      startTimeRef.current = Date.now()
      totalUploadedRef.current = 0
      setTotalUploaded(0)

      // Track speed from the latest uploaded bytes to avoid stale closures.
      speedTimerRef.current = setInterval(() => {
        const elapsed = (Date.now() - startTimeRef.current) / 1000
        if (elapsed > 0) {
          const mbps = (totalUploadedRef.current / elapsed) / (1024 * 1024)
          setSpeed(parseFloat(mbps.toFixed(1)))
        }
      }, 1000)

      for (const file of initialPendingFiles) {
        if (abortRef.current) break

        updateFile(file.id, { status: 'uploading', progress: 0 })

        try {
          let previousLoaded = 0
          const key = await uploadFile(file, (loaded, total) => {
            const pct = total > 0 ? loaded / total : 0
            updateFile(file.id, { progress: pct })

            const delta = Math.max(0, loaded - previousLoaded)
            previousLoaded = loaded
            totalUploadedRef.current += delta
            setTotalUploaded(totalUploadedRef.current)
          })
          updateFile(file.id, { status: 'done', progress: 1, s3Key: key })
        } catch (err: any) {
          updateFile(file.id, {
            status: 'error',
            errorMessage: err?.message ?? 'Upload thất bại',
          })
        }
      }

      if (speedTimerRef.current) clearInterval(speedTimerRef.current)
      setIsUploading(false)
      setSpeed(0)

      if (!abortRef.current) {
        const currentFiles = useUploadStore.getState().files
        const errors = currentFiles.filter((f: { status: string }) => f.status === 'error').length
        const done = currentFiles.filter((f: { status: string }) => f.status === 'done').length
        if (errors > 0) {
          Alert.alert('Hoàn thành', `${done} file thành công, ${errors} lỗi.`)
        } else {
          Alert.alert('✓ Xong!', `Đã upload ${done} file.`)
        }
      }
    }

    startUpload()
    return () => {
      abortRef.current = true
      if (speedTimerRef.current) clearInterval(speedTimerRef.current)
    }
  }, [setIsUploading, setSpeed, setTotalUploaded, updateFile])

  const handleCancel = () => {
    Alert.alert('Huỷ upload?', 'Các file đang upload sẽ bị dừng lại.', [
      { text: 'Tiếp tục', style: 'cancel' },
      {
        text: 'Huỷ upload',
        style: 'destructive',
        onPress: () => {
          abortRef.current = true
          nav.goBack()
        },
      },
    ])
  }

  const dotColor = (status: string) => {
    if (status === 'done') return '#3EE08A'
    if (status === 'uploading') return '#F5A623'
    if (status === 'error') return '#FF5A5A'
    return '#2A2A2A'
  }

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="light-content" backgroundColor="#0E0E0E" />

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => nav.goBack()}>
          <Text style={s.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle} numberOfLines={1}>ĐANG UPLOAD</Text>
        <Text style={s.headerCount} numberOfLines={1}>{doneFiles.length} / {files.length}</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
        {/* Circle progress */}
        <View style={s.circleWrap}>
          <View style={s.svgContainer}>
            <Svg width={140} height={140}>
              <Circle
                cx={70}
                cy={70}
                r={radius}
                stroke="#1E1E1E"
                strokeWidth={stroke}
                fill="transparent"
              />
              <Circle
                cx={70}
                cy={70}
                r={radius}
                stroke="#F5A623"
                strokeWidth={stroke}
                fill="transparent"
                strokeLinecap="round"
                strokeDasharray={`${circumference} ${circumference}`}
                strokeDashoffset={dashOffset}
                transform="rotate(-90 70 70)"
              />
            </Svg>
            <View style={s.circleCenter}>
              <Text style={s.circlePct}>{totalPct}%</Text>
              <Text style={s.circleSub}>HOÀN THÀNH</Text>
            </View>
          </View>
        </View>

        {/* Stats */}
        <View style={s.statsGrid}>
          <View style={s.statCard}>
            <Text style={s.statLabel}>TỐC ĐỘ</Text>
            <Text style={s.statValue}>{speed.toFixed(1)}<Text style={s.statUnit}> MB/s</Text></Text>
          </View>
          <View style={s.statCard}>
            <Text style={s.statLabel}>CÒN LẠI</Text>
            <Text style={s.statValue}>
              {eta != null ? `~${eta}` : '--'}<Text style={s.statUnit}>{eta != null ? ' giây' : ''}</Text>
            </Text>
          </View>
          <View style={s.statCard}>
            <Text style={s.statLabel}>ĐÃ GỬI</Text>
            <Text style={s.statValue}>{formatBytes(totalUploaded)}</Text>
          </View>
          <View style={s.statCard}>
            <Text style={s.statLabel}>TỔNG CỘNG</Text>
            <Text style={s.statValue}>{formatBytes(totalBytes)}</Text>
          </View>
        </View>

        {/* File queue */}
        <View style={s.sectionRow}>
          <Text style={s.sectionLabel}>DANH SÁCH FILE</Text>
        </View>

        <View style={s.queueList}>
          {files.map((file: any) => (
            <View
              key={file.id}
              style={[
                s.queueItem,
                file.status === 'uploading' && s.queueItemActive,
              ]}
            >
              <View style={[s.dot, { backgroundColor: dotColor(file.status) }]} />
              <View style={s.queueInfo}>
                <View style={s.queueRow}>
                  <Text
                    style={[s.queueName, file.status === 'uploading' && { color: '#F5A623' }]}
                    numberOfLines={1}
                  >
                    {file.name}
                  </Text>
                  <Text style={s.queueSize}>{formatBytes(file.size)}</Text>
                </View>
                {file.status === 'uploading' && (
                  <View style={s.miniBar}>
                    <View style={[s.miniFill, { width: `${file.progress * 100}%` }]} />
                  </View>
                )}
                {file.status === 'error' && (
                  <Text style={s.queueError}>{file.errorMessage}</Text>
                )}
                {file.status === 'done' && file.s3Key && (
                  <Text style={s.queueKey} numberOfLines={1}>{file.s3Key}</Text>
                )}
              </View>
            </View>
          ))}
        </View>

        {/* Cancel */}
        {isUploading && (
          <TouchableOpacity style={s.cancelBtn} onPress={handleCancel}>
            <Text style={s.cancelText}>✕  Huỷ upload</Text>
          </TouchableOpacity>
        )}

        {!isUploading && (
          <TouchableOpacity style={s.doneBtn} onPress={() => nav.goBack()}>
            <Text style={s.doneBtnText}>← Về trang chủ</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0E0E0E' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  headerTitle: { fontFamily: 'monospace', fontSize: 13, color: '#AAAAAA', letterSpacing: 1, flex: 1, textAlign: 'center' },
  headerCount: { fontFamily: 'monospace', fontSize: 11, color: '#F5A623', minWidth: 44, textAlign: 'right' },
  circleWrap: { alignItems: 'center', marginVertical: 24 },
  svgContainer: { width: 140, height: 140, alignItems: 'center', justifyContent: 'center' },
  circleCenter: { position: 'absolute', alignItems: 'center' },
  circlePct: { fontFamily: 'monospace', fontSize: 30, fontWeight: '700', color: '#F5A623' },
  circleSub: { fontFamily: 'monospace', fontSize: 9, color: '#444', letterSpacing: 1 },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 20,
    gap: 8,
    marginBottom: 20,
  },
  statCard: {
    width: '48%',
    backgroundColor: '#161616',
    borderWidth: 0.5,
    borderColor: '#222',
    borderRadius: 8,
    padding: 12,
  },
  statLabel: { fontFamily: 'monospace', fontSize: 9, color: '#3E3E3E', letterSpacing: 1.5, marginBottom: 4 },
  statValue: { fontFamily: 'monospace', fontSize: 18, color: '#CCCCCC', fontWeight: '500' },
  statUnit: { fontSize: 11, color: '#555' },
  sectionRow: { paddingHorizontal: 20, marginBottom: 8 },
  sectionLabel: { fontFamily: 'monospace', fontSize: 10, color: '#3E3E3E', letterSpacing: 1.5 },
  queueList: { paddingHorizontal: 20, gap: 5 },
  queueItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#141414',
    borderWidth: 0.5,
    borderColor: '#1E1E1E',
    borderRadius: 6,
    padding: 10,
    gap: 10,
  },
  queueItemActive: { borderColor: '#2D2000' },
  dot: { width: 7, height: 7, borderRadius: 3.5, marginTop: 4, flexShrink: 0 },
  queueInfo: { flex: 1 },
  queueRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  queueName: { fontSize: 11, color: '#888', flex: 1 },
  queueSize: { fontFamily: 'monospace', fontSize: 10, color: '#3A3A3A', marginLeft: 8 },
  miniBar: { height: 2, backgroundColor: '#1A1A1A', borderRadius: 1, marginTop: 5, overflow: 'hidden' },
  miniFill: { height: '100%', backgroundColor: '#F5A623', borderRadius: 1 },
  queueError: { fontSize: 10, color: '#FF5A5A', marginTop: 3 },
  queueKey: { fontFamily: 'monospace', fontSize: 9, color: '#2A5A3A', marginTop: 3 },
  cancelBtn: {
    marginHorizontal: 20,
    marginTop: 20,
    borderWidth: 0.5,
    borderColor: '#2A2A2A',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  cancelText: { fontFamily: 'monospace', fontSize: 12, color: '#444', letterSpacing: 0.5 },
  doneBtn: {
    marginHorizontal: 20,
    marginTop: 20,
    backgroundColor: '#F5A623',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  doneBtnText: { fontFamily: 'monospace', fontSize: 13, fontWeight: '600', color: '#0E0E0E' },
})
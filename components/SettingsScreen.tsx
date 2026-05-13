import { router } from 'expo-router'
import React, { useState } from 'react'
import {
    Alert,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { testConnection } from '../utils/minio'
import { useUploadStore } from '../utils/uploadStore'

export default function SettingsScreen() {
  const { config, setConfig } = useUploadStore()

  const [draft, setDraft] = useState({
    uploadBaseUrl: config.uploadBaseUrl,
  })
  const [testing, setTesting] = useState(false)

  const updateField = (key: keyof typeof draft, value: string) => {
    setDraft((prev) => ({ ...prev, [key]: value }))
  }

  const handleSave = () => {
    setConfig({ uploadBaseUrl: draft.uploadBaseUrl.trim() })
    Alert.alert('Đã lưu', 'Đã cập nhật Upload Base URL.')
    router.back()
  }

  const handleTest = async () => {
    setTesting(true)
    try {
      const result = await testConnection(draft)
      if (result.ok) {
        Alert.alert('Kết nối thành công', 'Đã kết nối được tới Upload Base URL.')
      } else {
        Alert.alert(
          'Kết nối thất bại',
          `Vui lòng kiểm tra Upload Base URL.\n\nChi tiết: ${result.message ?? 'Không rõ lỗi'}`,
        )
      }
    } catch {
      Alert.alert('Kết nối thất bại', 'Không thể kết nối tới Upload Base URL.')
    } finally {
      setTesting(false)
    }
  }

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="light-content" backgroundColor="#0E0E0E" />

      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <Text style={s.backText}>{'<'}</Text>
        </TouchableOpacity>
        <Text style={s.title}>CÀI ĐẶT UPLOAD</Text>
        <View style={s.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <Field
          label="Upload Base URL"
          value={draft.uploadBaseUrl}
          onChangeText={(v) => updateField('uploadBaseUrl', v)}
        />
        <Text style={s.hintText}>Ví dụ: https://api-minio.devmindtan.uk/sandbox</Text>
        <Text style={s.hintText}>Upload sẽ PUT trực tiếp lên URL: baseUrl/objectKey</Text>
      </ScrollView>

      <View style={s.bottomBar}>
        <TouchableOpacity style={s.testBtn} onPress={handleTest} disabled={testing}>
          <Text style={s.testText}>{testing ? 'Dang kiem tra...' : 'Kiem tra ket noi'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.saveBtn} onPress={handleSave}>
          <Text style={s.saveText}>Luu</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  )
}

type FieldProps = {
  label: string
  value: string
  onChangeText: (text: string) => void
  secureTextEntry?: boolean
}

function Field({ label, value, onChangeText, secureTextEntry = false }: FieldProps) {
  return (
    <View style={s.fieldWrap}>
      <Text style={s.fieldLabel}>{label}</Text>
      <TextInput
        style={s.input}
        value={value}
        onChangeText={onChangeText}
        autoCapitalize="none"
        autoCorrect={false}
        secureTextEntry={secureTextEntry}
        placeholderTextColor="#505050"
      />
    </View>
  )
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0E0E0E' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
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
  backText: { color: '#AAA', fontSize: 16 },
  title: { fontFamily: 'monospace', fontSize: 13, color: '#AAAAAA', letterSpacing: 1 },
  headerSpacer: { width: 32 },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 24,
    gap: 10,
  },
  fieldWrap: { gap: 6 },
  fieldLabel: { fontFamily: 'monospace', fontSize: 10, color: '#666', letterSpacing: 1 },
  input: {
    backgroundColor: '#161616',
    borderWidth: 0.5,
    borderColor: '#2A2A2A',
    borderRadius: 8,
    color: '#DDD',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
  },
  hintText: { color: '#6F6F6F', fontSize: 10, lineHeight: 16 },
  bottomBar: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderTopWidth: 0.5,
    borderTopColor: '#1A1A1A',
  },
  testBtn: {
    flex: 1,
    backgroundColor: '#1A1A1A',
    borderWidth: 0.5,
    borderColor: '#2A2A2A',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  testText: { color: '#A0A0A0', fontFamily: 'monospace', fontSize: 11 },
  saveBtn: {
    flex: 1,
    backgroundColor: '#F5A623',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  saveText: { color: '#0E0E0E', fontFamily: 'monospace', fontSize: 12, fontWeight: '700' },
})

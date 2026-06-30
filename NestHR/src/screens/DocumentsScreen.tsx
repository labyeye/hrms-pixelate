import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  RefreshControl,
  Modal,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Image,
  Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import {
  FolderOpen,
  Upload,
  Trash2,
  X,
  FileText,
  ChevronLeft,
  Plus,
  ChevronDown,
  Image as ImageIcon,
  Share2,
} from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { launchImageLibrary } from 'react-native-image-picker';
import { documentAPI, employeeAPI } from '../api/api';
import { useAuth } from '../contexts/AuthContext';
import { C } from '../theme';
import { DatePickerField } from '../components/common/DatePickerField';

const DOC_TYPES = [
  { value: 'pan', label: 'PAN Card' },
  { value: 'aadhaar', label: 'Aadhaar Card' },
  { value: 'resume', label: 'Resume' },
  { value: 'offer_letter', label: 'Offer Letter' },
  { value: 'appointment_letter', label: 'Appointment Letter' },
  { value: 'salary_slip', label: 'Salary Slip' },
  { value: 'relieving_letter', label: 'Relieving Letter' },
  { value: 'certificate', label: 'Certificate' },
  { value: 'other', label: 'Other Document' },
];

function formatBytes(bytes: number) {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function DocumentsScreen() {
  const navigation = useNavigation<any>();
  const { user } = useAuth();
  const isEmployee = user?.role === 'employee';

  const [docs, setDocs] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [pickedFile, setPickedFile] = useState<any>(null);
  const [uploadForm, setUploadForm] = useState({ name: '', docType: 'other', employeeId: '', expiryDate: '' });
  const [showDocTypePicker, setShowDocTypePicker] = useState(false);
  const [showEmpPicker, setShowEmpPicker] = useState(false);
  const [filterEmp, setFilterEmp] = useState('');
  const [previewDoc, setPreviewDoc] = useState<any>(null);

  const load = useCallback(async () => {
    try {
      const params: Record<string, string> = {};
      if (filterEmp) params.employee = filterEmp;
      const [docRes, empRes] = await Promise.all([
        documentAPI.getAll(params),
        !isEmployee ? employeeAPI.getAll() : Promise.resolve({ data: [] }),
      ]);
      setDocs(docRes.data || []);
      setEmployees(empRes.data || []);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
    }
  }, [isEmployee, filterEmp]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const handleDelete = (id: string, name: string) => {
    Alert.alert('Delete Document', `Delete "${name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await documentAPI.delete(id);
            setDocs(prev => prev.filter(d => d._id !== id));
          } catch (e: any) {
            Alert.alert('Error', e.message);
          }
        },
      },
    ]);
  };

  const pickImage = async () => {
    const result = await launchImageLibrary({
      mediaType: 'photo',
      quality: 0.8,
      includeBase64: false,
    });
    if (result.assets && result.assets[0]) {
      const asset = result.assets[0];
      setPickedFile(asset);
      if (!uploadForm.name && asset.fileName) {
        setUploadForm(p => ({ ...p, name: asset.fileName!.replace(/\.[^.]+$/, '') }));
      }
    }
  };

  const handleUpload = async () => {
    if (!pickedFile) {
      Alert.alert('Validation', 'Please pick an image first');
      return;
    }
    if (!uploadForm.name.trim()) {
      Alert.alert('Validation', 'Document name is required');
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', {
        uri: pickedFile.uri,
        type: pickedFile.type || 'image/jpeg',
        name: pickedFile.fileName || 'document.jpg',
      } as any);
      formData.append('name', uploadForm.name.trim());
      formData.append('docType', uploadForm.docType);
      if (!isEmployee && uploadForm.employeeId) {
        formData.append('employee', uploadForm.employeeId);
      }
      if (uploadForm.expiryDate) {
        formData.append('expiryDate', uploadForm.expiryDate);
      }

      await documentAPI.upload(formData);
      setShowUpload(false);
      setPickedFile(null);
      setUploadForm({ name: '', docType: 'other', employeeId: '', expiryDate: '' });
      load();
    } catch (e: any) {
      Alert.alert('Upload Failed', e.message);
    } finally {
      setUploading(false);
    }
  };

  const renderItem = ({ item }: { item: any }) => (
    <TouchableOpacity style={styles.card} onPress={() => setPreviewDoc(item)} activeOpacity={0.85}>
      <View style={styles.cardLeft}>
        <View style={styles.iconBox}>
          <FileText size={18} color={C.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.docName} numberOfLines={1}>{item.name}</Text>
          <Text style={styles.docMeta}>
            {DOC_TYPES.find(t => t.value === item.docType)?.label ?? item.docType}
            {item.sizeBytes ? ` · ${formatBytes(item.sizeBytes)}` : ''}
          </Text>
          {!isEmployee && item.employee && (
            <Text style={styles.docEmp}>
              {item.employee.firstName} {item.employee.lastName}
            </Text>
          )}
          <Text style={styles.docDate}>
            {new Date(item.createdAt).toLocaleDateString('en-IN')}
          </Text>
          {item.expiryDate && (
            <Text style={[styles.docDate, { color: new Date(item.expiryDate) < new Date() ? C.danger : C.textMuted }]}>
              Expires: {new Date(item.expiryDate).toLocaleDateString('en-IN')}
            </Text>
          )}
        </View>
      </View>
      <View style={styles.cardActions}>
        <TouchableOpacity
          style={[styles.actionBtn, { borderColor: C.primary }]}
          onPress={() => {
            const url = item.url || item.fileUrl || item.filePath;
            if (url) {
              Share.share({ url, title: item.name, message: item.name });
            } else {
              Alert.alert('Share', 'No shareable link available for this document.');
            }
          }}
        >
          <Share2 size={14} color={C.primary} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionBtn, styles.deleteBtn]}
          onPress={() => handleDelete(item._id, item.name)}
        >
          <Trash2 size={14} color={C.danger} />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ChevronLeft size={22} color={C.black} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Document Vault</Text>
        <View style={{ flex: 1 }} />
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => { setPickedFile(null); setUploadForm({ name: '', docType: 'other', employeeId: '', expiryDate: '' }); setShowUpload(true); }}
        >
          <Plus size={14} color={C.white} />
          <Text style={styles.addBtnText}>Upload</Text>
        </TouchableOpacity>
      </View>

      {/* Employee filter for HR */}
      {!isEmployee && employees.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterBar}
          contentContainerStyle={{ padding: 10, gap: 8 }}
        >
          <TouchableOpacity
            style={[styles.chip, !filterEmp && styles.chipActive]}
            onPress={() => setFilterEmp('')}
          >
            <Text style={[styles.chipText, !filterEmp && styles.chipTextActive]}>All</Text>
          </TouchableOpacity>
          {employees.slice(0, 15).map(e => (
            <TouchableOpacity
              key={e._id}
              style={[styles.chip, filterEmp === e._id && styles.chipActive]}
              onPress={() => setFilterEmp(prev => prev === e._id ? '' : e._id)}
            >
              <Text style={[styles.chipText, filterEmp === e._id && styles.chipTextActive]}>
                {e.firstName} {e.lastName}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={C.primary} />
        </View>
      ) : docs.length === 0 ? (
        <View style={styles.center}>
          <FolderOpen size={48} color="#D1D5DB" />
          <Text style={styles.emptyTitle}>No documents</Text>
          <Text style={styles.emptySubtitle}>
            {isEmployee ? 'No documents have been uploaded for you yet' : 'Upload a document to get started'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={docs}
          keyExtractor={d => d._id}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 16 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[C.primary]} tintColor={C.primary} />}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Upload Modal */}
      <Modal visible={showUpload} animationType="slide" presentationStyle="formSheet">
        <SafeAreaView style={styles.safe} edges={['top']}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Upload Document</Text>
            <TouchableOpacity onPress={() => setShowUpload(false)}><X size={22} color={C.black} /></TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }} keyboardShouldPersistTaps="handled">

            {/* File picker */}
            <TouchableOpacity style={styles.filePicker} onPress={pickImage}>
              {pickedFile ? (
                <>
                  <ImageIcon size={24} color={C.primary} />
                  <Text style={styles.filePickerName} numberOfLines={1}>{pickedFile.fileName || 'Image selected'}</Text>
                  <Text style={styles.filePickerSize}>{formatBytes(pickedFile.fileSize || 0)}</Text>
                </>
              ) : (
                <>
                  <Upload size={24} color="#9CA3AF" />
                  <Text style={styles.filePickerPlaceholder}>Tap to pick an image</Text>
                  <Text style={styles.filePickerHint}>JPG, PNG supported</Text>
                </>
              )}
            </TouchableOpacity>

            <View>
              <Text style={styles.fieldLabel}>Document Name *</Text>
              <TextInput
                style={styles.fieldInput}
                value={uploadForm.name}
                onChangeText={v => setUploadForm(p => ({ ...p, name: v }))}
                placeholder="e.g. Aadhaar Card"
                placeholderTextColor="#9CA3AF"
              />
            </View>

            <View>
              <Text style={styles.fieldLabel}>Document Type</Text>
              <TouchableOpacity style={styles.selectBtn} onPress={() => setShowDocTypePicker(true)}>
                <Text style={styles.selectBtnText}>
                  {DOC_TYPES.find(t => t.value === uploadForm.docType)?.label || 'Other'}
                </Text>
                <ChevronDown size={16} color={C.black} />
              </TouchableOpacity>
            </View>

            <DatePickerField
              label="Expiry Date (optional)"
              value={uploadForm.expiryDate}
              onChange={v => setUploadForm(p => ({ ...p, expiryDate: v }))}
            />

            {!isEmployee && employees.length > 0 && (
              <View>
                <Text style={styles.fieldLabel}>Employee (optional)</Text>
                <TouchableOpacity style={styles.selectBtn} onPress={() => setShowEmpPicker(true)}>
                  <Text style={styles.selectBtnText}>
                    {uploadForm.employeeId
                      ? (() => {
                          const e = employees.find(x => x._id === uploadForm.employeeId);
                          return e ? `${e.firstName} ${e.lastName}` : 'Select employee';
                        })()
                      : 'Select employee'}
                  </Text>
                  <ChevronDown size={16} color={C.black} />
                </TouchableOpacity>
              </View>
            )}

            <TouchableOpacity style={styles.submitBtn} onPress={handleUpload} disabled={uploading}>
              {uploading ? (
                <ActivityIndicator color={C.white} />
              ) : (
                <>
                  <Upload size={16} color={C.white} />
                  <Text style={styles.submitBtnText}>Upload Document</Text>
                </>
              )}
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Doc Type Picker */}
      <Modal visible={showDocTypePicker} animationType="slide" transparent>
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Document Type</Text>
              <TouchableOpacity onPress={() => setShowDocTypePicker(false)}><X size={20} color={C.black} /></TouchableOpacity>
            </View>
            {DOC_TYPES.map(t => (
              <TouchableOpacity
                key={t.value}
                style={[styles.sheetOption, uploadForm.docType === t.value && styles.sheetOptionActive]}
                onPress={() => { setUploadForm(p => ({ ...p, docType: t.value })); setShowDocTypePicker(false); }}
              >
                <Text style={[styles.sheetOptionText, uploadForm.docType === t.value && { color: C.primary }]}>{t.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>

      {/* Employee Picker */}
      <Modal visible={showEmpPicker} animationType="slide" transparent>
        <View style={styles.overlay}>
          <View style={[styles.sheet, { maxHeight: '70%' }]}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Select Employee</Text>
              <TouchableOpacity onPress={() => setShowEmpPicker(false)}><X size={20} color={C.black} /></TouchableOpacity>
            </View>
            <ScrollView>
              <TouchableOpacity
                style={[styles.sheetOption, !uploadForm.employeeId && styles.sheetOptionActive]}
                onPress={() => { setUploadForm(p => ({ ...p, employeeId: '' })); setShowEmpPicker(false); }}
              >
                <Text style={[styles.sheetOptionText, !uploadForm.employeeId && { color: C.primary }]}>No specific employee</Text>
              </TouchableOpacity>
              {employees.map(e => (
                <TouchableOpacity
                  key={e._id}
                  style={[styles.sheetOption, uploadForm.employeeId === e._id && styles.sheetOptionActive]}
                  onPress={() => { setUploadForm(p => ({ ...p, employeeId: e._id })); setShowEmpPicker(false); }}
                >
                  <Text style={[styles.sheetOptionText, uploadForm.employeeId === e._id && { color: C.primary }]}>
                    {e.firstName} {e.lastName}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Image Preview Modal */}
      <Modal visible={!!previewDoc} animationType="fade" statusBarTranslucent>
        <View style={{ flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' }}>
          <TouchableOpacity
            style={{ position: 'absolute', top: 50, right: 20, zIndex: 10, padding: 10 }}
            onPress={() => setPreviewDoc(null)}
          >
            <X size={28} color="#fff" />
          </TouchableOpacity>
          {previewDoc && (
            <>
              <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700', position: 'absolute', top: 52, left: 20, right: 60 }} numberOfLines={1}>
                {previewDoc.name}
              </Text>
              {(previewDoc.url || previewDoc.fileUrl || previewDoc.filePath) ? (
                <Image
                  source={{ uri: previewDoc.url || previewDoc.fileUrl || previewDoc.filePath }}
                  style={{ width: '90%', height: '70%' }}
                  resizeMode="contain"
                />
              ) : (
                <View style={{ alignItems: 'center', gap: 12 }}>
                  <FileText size={60} color="#fff" />
                  <Text style={{ color: '#aaa', fontSize: 13 }}>Preview not available for this file type</Text>
                </View>
              )}
            </>
          )}
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F8F9FA' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: C.white,
    borderBottomWidth: 2,
    borderBottomColor: C.black,
    gap: 8,
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 20, fontWeight: '700', color: C.black },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: C.primary,
    borderWidth: 2,
    borderColor: C.black,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  addBtnText: { color: C.white, fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
  filterBar: { backgroundColor: C.white, borderBottomWidth: 1, borderBottomColor: '#E5E7EB', maxHeight: 52 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderWidth: 2, borderColor: '#D1D5DB', backgroundColor: C.white },
  chipActive: { borderColor: C.primary, backgroundColor: '#EFF6FF' },
  chipText: { fontSize: 12, fontWeight: '700', color: '#6B7280', textTransform: 'uppercase' },
  chipTextActive: { color: C.primary },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: '#6B7280', marginTop: 12 },
  emptySubtitle: { fontSize: 13, color: '#9CA3AF', fontWeight: '500', textAlign: 'center', marginTop: 6 },
  card: {
    backgroundColor: C.white,
    borderWidth: 2,
    borderColor: C.black,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  cardLeft: { flex: 1, flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  iconBox: {
    width: 36,
    height: 36,
    backgroundColor: '#EFF6FF',
    borderWidth: 2,
    borderColor: C.black,
    alignItems: 'center',
    justifyContent: 'center',
  },
  docName: { fontWeight: '700', fontSize: 13, color: C.black },
  docMeta: { fontSize: 11, color: '#6B7280', marginTop: 2 },
  docEmp: { fontSize: 11, color: C.primary, fontWeight: '600', marginTop: 1 },
  docDate: { fontSize: 10, color: '#9CA3AF', marginTop: 1 },
  cardActions: { flexDirection: 'row', gap: 6 },
  actionBtn: { width: 32, height: 32, borderWidth: 2, borderColor: C.black, alignItems: 'center', justifyContent: 'center' },
  deleteBtn: { borderColor: C.danger },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: C.white,
    borderBottomWidth: 2,
    borderBottomColor: C.black,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: C.black },
  filePicker: {
    borderWidth: 2,
    borderColor: C.black,
    borderStyle: 'dashed',
    padding: 24,
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F9FAFB',
  },
  filePickerName: { fontSize: 14, fontWeight: '700', color: C.primary, textAlign: 'center' },
  filePickerSize: { fontSize: 12, color: '#6B7280' },
  filePickerPlaceholder: { fontSize: 14, fontWeight: '600', color: '#9CA3AF' },
  filePickerHint: { fontSize: 12, color: '#D1D5DB' },
  fieldLabel: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', color: C.black, marginBottom: 6, letterSpacing: 0.5 },
  fieldInput: {
    borderWidth: 2,
    borderColor: C.black,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 14,
    fontWeight: '500',
    color: C.black,
    backgroundColor: C.white,
  },
  selectBtn: {
    borderWidth: 2,
    borderColor: C.black,
    paddingHorizontal: 12,
    paddingVertical: 11,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: C.white,
  },
  selectBtnText: { fontSize: 14, fontWeight: '500', color: C.black },
  submitBtn: {
    backgroundColor: C.primary,
    borderWidth: 2,
    borderColor: C.black,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,
  },
  submitBtnText: { color: C.white, fontWeight: '700', fontSize: 14, textTransform: 'uppercase' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: C.white, borderTopWidth: 2, borderTopColor: C.black },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 2, borderBottomColor: C.black },
  sheetTitle: { fontSize: 16, fontWeight: '700', color: C.black },
  sheetOption: { paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  sheetOptionActive: { backgroundColor: '#EFF6FF' },
  sheetOptionText: { fontSize: 15, fontWeight: '600', color: C.black },
});

import React, { useState, useCallback, useMemo } from 'react';
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
  Pressable,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import {
  FolderOpen,
  Upload,
  X,
  FileText,
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  Plus,
  Image as ImageIcon,
  EllipsisVertical,
  CheckCircle2,
  XCircle,
  Search,
  Pencil,
  Trash2,
  Eye,
  Download,
} from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { launchImageLibrary } from 'react-native-image-picker';
import DocumentPicker, { types } from 'react-native-document-picker';
import { documentAPI, employeeAPI } from '../api/api';
import { useAuth } from '../contexts/AuthContext';
import { C, useResponsive, tabletContainerStyle } from '../theme';
import { CENTER } from '../components/common/centerModal';
import { useDocOtp } from '../hooks/useDocOtp';
import ExportButton from '../components/common/ExportButton';
import { DatePickerField } from '../components/common/DatePickerField';

// Same list (and same stored values) as the web Document Vault and the backend enum.
const DOC_TYPES = [
  { value: 'aadhar', label: 'Aadhar', color: '#024BAB' },
  { value: 'pan', label: 'PAN', color: '#0891B2' },
  { value: 'driving_license', label: 'Driving License', color: '#059669' },
  { value: 'id_proof', label: 'ID Proof', color: '#A855F7' },
  { value: 'certificate', label: 'Certificate', color: '#EAB308' },
  { value: 'contract', label: 'Contract', color: '#EF4444' },
  { value: 'resume', label: 'Resume', color: '#2563EB' },
  { value: 'offer_letter', label: 'Offer Letter', color: '#FA731C' },
  { value: 'other', label: 'Other', color: '#111827' },
];
const TYPE_LABEL: Record<string, string> = {
  ...Object.fromEntries(DOC_TYPES.map(t => [t.value, t.label])),
  salary_certificate: 'Salary Certificate',
  experience_letter: 'Experience Letter',
  address_proof_letter: 'Address Proof Letter',
};

function formatBytes(bytes: number) {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
const dt = (d?: string) => (d ? new Date(d).toLocaleDateString('en-IN') : '');

export default function DocumentsScreen() {
  const navigation = useNavigation<any>();
  const { user } = useAuth();
  const { isTablet, maxContentWidth } = useResponsive();
  const isEmployee = user?.role === 'employee';

  const [docs, setDocs] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<string[]>([]);
  const [menu, setMenu] = useState<
    { kind: 'emp'; emp: any } | { kind: 'doc'; doc: any } | null
  >(null);

  const [showUpload, setShowUpload] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [pickedFile, setPickedFile] = useState<any>(null);
  const EMPTY_UPLOAD = {
    name: '',
    docType: 'other',
    employeeId: '',
    expiryDate: '',
  };
  const [uploadForm, setUploadForm] = useState(EMPTY_UPLOAD);
  const [showDocTypePicker, setShowDocTypePicker] = useState(false);
  const [showEmpPicker, setShowEmpPicker] = useState(false);

  const [editDoc, setEditDoc] = useState<any>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [editTypePicker, setEditTypePicker] = useState(false);

  const { withOtp, otpModal } = useDocOtp();

  // OTP first (sent to the logged-in user's phone on WhatsApp), then the phone saves the file.
  const downloadDoc = async (doc: any) => {
    try {
      const url = await withOtp(t => documentAPI.downloadUrl(doc._id, t));
      await Linking.openURL(url);
    } catch (e: any) {
      if (!/cancelled/i.test(e?.message || '')) Alert.alert('Error', e.message);
    }
  };

  const load = useCallback(async () => {
    try {
      const [docRes, empRes] = await Promise.all([
        documentAPI.getAll(),
        !isEmployee
          ? employeeAPI.getAll({ status: 'active' })
          : Promise.resolve({ data: [] }),
      ]);
      setDocs(docRes.data || []);
      setEmployees(empRes.data || []);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
    }
  }, [isEmployee]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  // ── Grouping ──
  const docsByEmp = useMemo(() => {
    const m: Record<string, any[]> = {};
    docs.forEach(d => {
      const id = d.employee?._id;
      if (id) (m[id] ||= []).push(d);
    });
    return m;
  }, [docs]);

  // Employees see themselves only; admins/HR see every active employee.
  const people = useMemo(() => {
    if (isEmployee) {
      const e = docs[0]?.employee;
      return [
        {
          _id: e?._id || 'me',
          firstName: e?.firstName || user?.name || 'Me',
          lastName: e?.lastName || '',
          employeeId: e?.employeeId || '',
          avatar: (user as any)?.avatar,
        },
      ];
    }
    const q = search.trim().toLowerCase();
    return employees.filter(
      e =>
        !q ||
        `${e.firstName} ${e.lastName}`.toLowerCase().includes(q) ||
        String(e.employeeId || '')
          .toLowerCase()
          .includes(q),
    );
  }, [isEmployee, docs, employees, search, user]);

  const withDocs = employees.filter(
    e => (docsByEmp[e._id] || []).length,
  ).length;
  const perType = DOC_TYPES.map(t => ({
    ...t,
    count: new Set(
      docs.filter(d => d.docType === t.value).map(d => d.employee?._id),
    ).size,
  }));

  const toggle = (id: string) =>
    setExpanded(p => (p.includes(id) ? p.filter(x => x !== id) : [...p, id]));

  // ── Actions ──
  const startUpload = (employeeId = '', docType = 'other') => {
    setPickedFile(null);
    setUploadForm({
      ...EMPTY_UPLOAD,
      employeeId,
      docType,
      name:
        TYPE_LABEL[docType] && docType !== 'other' ? TYPE_LABEL[docType] : '',
    });
    setShowUpload(true);
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
        setUploadForm(p => ({
          ...p,
          name: asset.fileName!.replace(/\.[^.]+$/, ''),
        }));
      }
    }
  };

  const pickPdf = async () => {
    try {
      const f = await DocumentPicker.pickSingle({
        type: [types.pdf],
        copyTo: 'cachesDirectory',
        mode: 'import',
      });
      if ((f.size || 0) > 5 * 1024 * 1024) {
        Alert.alert('Too large', 'Documents must be 5 MB or smaller.');
        return;
      }
      setPickedFile({
        uri: f.fileCopyUri || f.uri,
        type: 'application/pdf',
        fileName: f.name || `document_${Date.now()}.pdf`,
        fileSize: f.size || 0,
      });
      if (!uploadForm.name && f.name) {
        setUploadForm(p => ({ ...p, name: f.name!.replace(/\.[^.]+$/, '') }));
      }
    } catch (e: any) {
      if (!DocumentPicker.isCancel(e)) Alert.alert('Error', e.message);
    }
  };

  const handleUpload = async () => {
    if (!pickedFile) {
      Alert.alert('Validation', 'Please pick an image or a PDF first');
      return;
    }
    if (!uploadForm.name.trim()) {
      Alert.alert('Validation', 'Document name is required');
      return;
    }
    if (!isEmployee && !uploadForm.employeeId) {
      Alert.alert('Validation', 'Please select an employee');
      return;
    }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', {
        uri: pickedFile.uri,
        type: pickedFile.type || 'image/jpeg',
        name:
          pickedFile.fileName ||
          (pickedFile.type === 'application/pdf'
            ? 'document.pdf'
            : 'document.jpg'),
      } as any);
      formData.append('name', uploadForm.name.trim());
      formData.append('docType', uploadForm.docType);
      if (!isEmployee && uploadForm.employeeId) {
        formData.append('employeeId', uploadForm.employeeId);
      }
      if (uploadForm.expiryDate) {
        formData.append('expiryDate', uploadForm.expiryDate);
      }
      await documentAPI.upload(formData);
      setShowUpload(false);
      setPickedFile(null);
      setUploadForm(EMPTY_UPLOAD);
      load();
    } catch (e: any) {
      Alert.alert('Upload Failed', e.message);
    } finally {
      setUploading(false);
    }
  };

  const saveEdit = async () => {
    if (!editDoc?.name?.trim()) {
      Alert.alert('Validation', 'Document name is required');
      return;
    }
    setEditSaving(true);
    try {
      await documentAPI.update(editDoc._id, {
        name: editDoc.name.trim(),
        docType: editDoc.docType,
        expiryDate: editDoc.expiryDate || '',
      });
      setEditDoc(null);
      load();
    } catch (e: any) {
      Alert.alert('Update failed', e.message);
    } finally {
      setEditSaving(false);
    }
  };

  const deleteOne = (doc: any) => {
    Alert.alert(
      'Delete document',
      `Delete "${doc.name}"? It moves to Trash and can be restored.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await documentAPI.delete(doc._id);
              setDocs(prev => prev.filter(d => d._id !== doc._id));
            } catch (e: any) {
              Alert.alert('Error', e.message);
            }
          },
        },
      ],
    );
  };

  const deleteAll = (emp: any) => {
    const list = docsByEmp[emp._id] || [];
    if (!list.length) {
      Alert.alert('Nothing to delete', 'This employee has no documents.');
      return;
    }
    Alert.alert(
      'Delete all documents',
      `Delete all ${list.length} document${list.length > 1 ? 's' : ''} of ${
        emp.firstName
      } ${emp.lastName}? They move to Trash.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete all',
          style: 'destructive',
          onPress: async () => {
            const results = await Promise.allSettled(
              list.map(d => documentAPI.delete(d._id)),
            );
            const failed = results.filter(r => r.status === 'rejected').length;
            if (failed)
              Alert.alert('Some failed', `${failed} document(s) not deleted.`);
            load();
          },
        },
      ],
    );
  };

  // ── Rows ──
  const renderDocRow = (d: any) => {
    const expired = d.expiryDate && new Date(d.expiryDate) < new Date();
    return (
      <View key={d._id} style={styles.docRow}>
        <CheckCircle2 size={16} color={C.success} />
        <TouchableOpacity
          style={{ flex: 1, minWidth: 0 }}
          onPress={() => downloadDoc(d)}
          activeOpacity={0.7}
        >
          <Text style={styles.docName} numberOfLines={2}>
            {d.name}
          </Text>
          <Text style={styles.docMeta}>
            {TYPE_LABEL[d.docType] ?? d.docType}
            {d.sizeBytes ? ` · ${formatBytes(d.sizeBytes)}` : ''}
            {d.createdAt ? ` · ${dt(d.createdAt)}` : ''}
          </Text>
          {!!d.expiryDate && (
            <Text
              style={[
                styles.docMeta,
                { color: expired ? C.danger : C.textMuted },
              ]}
            >
              {expired ? 'Expired' : 'Expires'} {dt(d.expiryDate)}
            </Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          hitSlop={8}
          onPress={() => downloadDoc(d)}
          style={styles.dlBtn}
          accessibilityLabel={`Download ${d.name}`}
        >
          <Download size={16} color={C.primary} />
        </TouchableOpacity>
        {!isEmployee && (
          <TouchableOpacity
            hitSlop={8}
            onPress={() => setMenu({ kind: 'doc', doc: d })}
            style={styles.iconBtn}
            accessibilityLabel="Document actions"
          >
            <EllipsisVertical size={18} color={C.black} />
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const renderDetails = (emp: any) => {
    const list = docsByEmp[emp._id] || [];
    const knownTypes = DOC_TYPES.map(t => t.value);
    const extra = list.filter(d => !knownTypes.includes(d.docType));
    return (
      <View style={styles.details}>
        {DOC_TYPES.map(t => {
          const mine = list.filter(d => d.docType === t.value);
          return (
            <View key={t.value} style={styles.typeBlock}>
              <View style={styles.typeHead}>
                <View style={[styles.typeDot, { backgroundColor: t.color }]} />
                <Text style={styles.typeLabel}>{t.label}</Text>
                <View style={{ flex: 1 }} />
                {mine.length === 0 ? (
                  <TouchableOpacity
                    onPress={() =>
                      startUpload(isEmployee ? '' : emp._id, t.value)
                    }
                    style={styles.addMini}
                  >
                    <Plus size={12} color={C.primary} />
                    <Text style={styles.addMiniText}>Add</Text>
                  </TouchableOpacity>
                ) : (
                  <Text style={styles.okText}>{mine.length} added</Text>
                )}
              </View>
              {mine.length === 0 ? (
                <View style={styles.missingRow}>
                  <XCircle size={16} color={C.danger} />
                  <Text style={styles.missingText}>Missing</Text>
                </View>
              ) : (
                mine.map(renderDocRow)
              )}
            </View>
          );
        })}
        {extra.length > 0 && (
          <View style={styles.typeBlock}>
            <View style={styles.typeHead}>
              <View style={[styles.typeDot, { backgroundColor: '#6B7280' }]} />
              <Text style={styles.typeLabel}>Other letters</Text>
            </View>
            {extra.map(renderDocRow)}
          </View>
        )}
      </View>
    );
  };

  const renderPerson = ({ item: e }: { item: any }) => {
    const list = docsByEmp[e._id] || [];
    const open = isEmployee || expanded.includes(e._id);
    return (
      <View style={styles.card}>
        <View style={styles.personRow}>
          {e.avatar ? (
            <Image source={{ uri: e.avatar }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarFb]}>
              <Text style={styles.avatarText}>
                {(e.firstName?.[0] || '') + (e.lastName?.[0] || '')}
              </Text>
            </View>
          )}
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.personName}>
              {e.firstName} {e.lastName}
            </Text>
            {!!e.employeeId && (
              <Text style={styles.personCode}>{e.employeeId}</Text>
            )}
            <Text style={styles.personCount}>
              {list.length} doc{list.length === 1 ? '' : 's'} added
            </Text>
          </View>
          {!isEmployee && (
            <TouchableOpacity
              hitSlop={8}
              onPress={() => setMenu({ kind: 'emp', emp: e })}
              style={styles.iconBtn}
              accessibilityLabel="Employee actions"
            >
              <EllipsisVertical size={20} color={C.black} />
            </TouchableOpacity>
          )}
        </View>
        {!isEmployee && (
          <TouchableOpacity
            style={styles.viewBtn}
            onPress={() => toggle(e._id)}
            activeOpacity={0.8}
          >
            <Eye size={14} color={C.primary} />
            <Text style={styles.viewBtnText}>
              {open ? 'Hide details' : 'View details'}
            </Text>
            {open ? (
              <ChevronUp size={14} color={C.primary} />
            ) : (
              <ChevronDown size={14} color={C.primary} />
            )}
          </TouchableOpacity>
        )}
        {open && renderDetails(e)}
      </View>
    );
  };

  const tile = (
    key: string,
    label: string,
    value: number,
    color: string,
    Icon: any,
  ) => (
    <View key={key} style={[styles.tile, isTablet && styles.tileWide]}>
      <View style={[styles.tileIcon, { backgroundColor: color }]}>
        <Icon size={16} color={C.white} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.tileVal}>{value}</Text>
        <Text style={styles.tileLabel} numberOfLines={2}>
          {label}
        </Text>
      </View>
    </View>
  );

  const header = (
    <View>
      {!isEmployee && (
        <>
          <View style={styles.tiles}>
            {tile('up', 'Docs uploaded', withDocs, C.success, CheckCircle2)}
            {tile(
              'miss',
              'Missing docs',
              Math.max(employees.length - withDocs, 0),
              C.danger,
              XCircle,
            )}
            {perType.map(t =>
              tile(t.value, t.label, t.count, t.color, FileText),
            )}
          </View>
          <View style={styles.searchBox}>
            <Search size={16} color="#6B7280" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search by name or employee code"
              placeholderTextColor="#9CA3AF"
              value={search}
              onChangeText={setSearch}
            />
            {!!search && (
              <TouchableOpacity onPress={() => setSearch('')} hitSlop={8}>
                <X size={16} color="#6B7280" />
              </TouchableOpacity>
            )}
          </View>
        </>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View
        style={[
          styles.header,
          isTablet && {
            maxWidth: maxContentWidth,
            width: '100%',
            alignSelf: 'center',
          },
        ]}
      >
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          hitSlop={8}
        >
          <ChevronLeft size={22} color={C.black} />
        </TouchableOpacity>
        <FolderOpen size={20} color={C.primary} />
        <Text style={styles.headerTitle}>Document Vault</Text>
        <View style={{ flex: 1 }} />
        {!isEmployee && (
          <ExportButton
            name="document_register"
            rows={docs}
            cols={[
              { header: 'Emp Code', value: (d: any) => d.employee?.employeeId },
              {
                header: 'Employee',
                value: (d: any) =>
                  `${d.employee?.firstName || ''} ${
                    d.employee?.lastName || ''
                  }`.trim(),
              },
              { header: 'Document', value: (d: any) => d.name },
              { header: 'Type', value: (d: any) => d.docType },
              {
                header: 'Expiry',
                value: (d: any) =>
                  d.expiryDate ? String(d.expiryDate).slice(0, 10) : '',
              },
              {
                header: 'Uploaded',
                value: (d: any) => String(d.createdAt || '').slice(0, 10),
              },
            ]}
          />
        )}
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => startUpload()}
          hitSlop={8}
          accessibilityLabel="Upload document"
        >
          <Plus size={24} color={C.primary} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={C.primary} />
        </View>
      ) : (
        <View style={[{ flex: 1 }, tabletContainerStyle(isTablet)]}>
          <FlatList
            data={people}
            keyExtractor={e => e._id}
            renderItem={renderPerson}
            ListHeaderComponent={header}
            ListEmptyComponent={
              <View style={styles.center}>
                <FolderOpen size={48} color="#D1D5DB" />
                <Text style={styles.emptyTitle}>No employees found</Text>
              </View>
            }
            contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={[C.primary]}
                tintColor={C.primary}
              />
            }
            showsVerticalScrollIndicator={false}
          />
        </View>
      )}

      {/* ⋮ action sheet (employee or document) */}
      <Modal
        visible={!!menu}
        transparent
        animationType="fade"
        onRequestClose={() => setMenu(null)}
      >
        <Pressable style={styles.overlay} onPress={() => setMenu(null)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle} numberOfLines={1}>
                {menu?.kind === 'emp'
                  ? `${menu.emp.firstName} ${menu.emp.lastName}`
                  : menu?.kind === 'doc'
                  ? menu.doc.name
                  : ''}
              </Text>
              <TouchableOpacity onPress={() => setMenu(null)}>
                <X size={20} color={C.black} />
              </TouchableOpacity>
            </View>
            {menu?.kind === 'emp' && (
              <>
                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={() => {
                    const e = menu.emp;
                    setMenu(null);
                    startUpload(e._id);
                  }}
                >
                  <Plus size={18} color={C.primary} />
                  <Text style={styles.menuText}>Add document</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={() => {
                    const e = menu.emp;
                    setMenu(null);
                    if (!expanded.includes(e._id)) toggle(e._id);
                  }}
                >
                  <Pencil size={18} color={C.black} />
                  <Text style={styles.menuText}>Edit documents</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.menuItem, { borderBottomWidth: 0 }]}
                  onPress={() => {
                    const e = menu.emp;
                    setMenu(null);
                    deleteAll(e);
                  }}
                >
                  <Trash2 size={18} color={C.danger} />
                  <Text style={[styles.menuText, { color: C.danger }]}>
                    Delete all documents
                  </Text>
                </TouchableOpacity>
              </>
            )}
            {menu?.kind === 'doc' && (
              <>
                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={() => {
                    const d = menu.doc;
                    setMenu(null);
                    downloadDoc(d);
                  }}
                >
                  <Download size={18} color={C.primary} />
                  <Text style={styles.menuText}>Download</Text>
                </TouchableOpacity>
                {!isEmployee && (
                  <>
                    <TouchableOpacity
                      style={styles.menuItem}
                      onPress={() => {
                        const d = menu.doc;
                        setMenu(null);
                        setEditDoc({
                          _id: d._id,
                          name: d.name,
                          docType: d.docType,
                          expiryDate: d.expiryDate
                            ? String(d.expiryDate).slice(0, 10)
                            : '',
                        });
                      }}
                    >
                      <Pencil size={18} color={C.black} />
                      <Text style={styles.menuText}>Edit</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.menuItem, { borderBottomWidth: 0 }]}
                      onPress={() => {
                        const d = menu.doc;
                        setMenu(null);
                        deleteOne(d);
                      }}
                    >
                      <Trash2 size={18} color={C.danger} />
                      <Text style={[styles.menuText, { color: C.danger }]}>
                        Delete this document
                      </Text>
                    </TouchableOpacity>
                  </>
                )}
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      {/* Edit document */}
      <Modal
        visible={!!editDoc}
        transparent
        animationType="fade"
        onRequestClose={() => setEditDoc(null)}
      >
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Edit document</Text>
              <TouchableOpacity onPress={() => setEditDoc(null)}>
                <X size={20} color={C.black} />
              </TouchableOpacity>
            </View>
            {editDoc && (
              <View style={{ padding: 16, gap: 14 }}>
                <View>
                  <Text style={styles.fieldLabel}>Document name *</Text>
                  <TextInput
                    style={styles.fieldInput}
                    value={editDoc.name}
                    onChangeText={v =>
                      setEditDoc((p: any) => ({ ...p, name: v }))
                    }
                  />
                </View>
                <View>
                  <Text style={styles.fieldLabel}>Document type</Text>
                  <TouchableOpacity
                    style={styles.selectBtn}
                    onPress={() => setEditTypePicker(true)}
                  >
                    <Text style={styles.selectBtnText}>
                      {TYPE_LABEL[editDoc.docType] || editDoc.docType}
                    </Text>
                    <ChevronDown size={16} color={C.black} />
                  </TouchableOpacity>
                </View>
                <DatePickerField
                  label="Expiry date (optional)"
                  value={editDoc.expiryDate}
                  onChange={v =>
                    setEditDoc((p: any) => ({ ...p, expiryDate: v }))
                  }
                />
                <TouchableOpacity
                  style={styles.submitBtn}
                  onPress={saveEdit}
                  disabled={editSaving}
                >
                  {editSaving ? (
                    <ActivityIndicator color={C.white} />
                  ) : (
                    <Text style={styles.submitBtnText}>Save changes</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>
      <Modal visible={editTypePicker} animationType="fade" transparent>
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Document type</Text>
              <TouchableOpacity onPress={() => setEditTypePicker(false)}>
                <X size={20} color={C.black} />
              </TouchableOpacity>
            </View>
            {DOC_TYPES.map(t => (
              <TouchableOpacity
                key={t.value}
                style={[
                  styles.sheetOption,
                  editDoc?.docType === t.value && styles.sheetOptionActive,
                ]}
                onPress={() => {
                  setEditDoc((p: any) => ({ ...p, docType: t.value }));
                  setEditTypePicker(false);
                }}
              >
                <Text style={styles.sheetOptionText}>{t.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>

      {/* Upload Modal */}
      <Modal visible={showUpload} transparent animationType="fade">
        <View style={CENTER.overlay}>
          <View style={CENTER.card}>
            <SafeAreaView style={styles.safe} edges={[]}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Upload Document</Text>
                <TouchableOpacity onPress={() => setShowUpload(false)}>
                  <X size={24} color={C.black} />
                </TouchableOpacity>
              </View>
              <ScrollView
                contentContainerStyle={{ padding: 20, gap: 16 }}
                keyboardShouldPersistTaps="handled"
              >
                <View style={styles.filePicker}>
                  {pickedFile ? (
                    <>
                      {pickedFile.type === 'application/pdf' ? (
                        <FileText size={24} color={C.primary} />
                      ) : (
                        <ImageIcon size={24} color={C.primary} />
                      )}
                      <Text style={styles.filePickerName} numberOfLines={1}>
                        {pickedFile.fileName || 'File selected'}
                      </Text>
                      <Text style={styles.filePickerSize}>
                        {formatBytes(pickedFile.fileSize || 0)}
                      </Text>
                    </>
                  ) : (
                    <>
                      <Upload size={24} color="#6B7280" />
                      <Text style={styles.filePickerPlaceholder}>
                        Pick an image or a PDF
                      </Text>
                      <Text style={styles.filePickerHint}>
                        JPG, PNG or PDF · up to 5 MB
                      </Text>
                    </>
                  )}
                  <View style={styles.pickRow}>
                    <TouchableOpacity
                      style={styles.pickBtn}
                      onPress={pickImage}
                    >
                      <ImageIcon size={16} color={C.primary} />
                      <Text style={styles.pickBtnText}>Image</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.pickBtn} onPress={pickPdf}>
                      <FileText size={16} color={C.primary} />
                      <Text style={styles.pickBtnText}>PDF</Text>
                    </TouchableOpacity>
                  </View>
                </View>

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
                  <TouchableOpacity
                    style={styles.selectBtn}
                    onPress={() => setShowDocTypePicker(true)}
                  >
                    <Text style={styles.selectBtnText}>
                      {DOC_TYPES.find(t => t.value === uploadForm.docType)
                        ?.label || 'Other'}
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
                    <Text style={styles.fieldLabel}>Employee *</Text>
                    <TouchableOpacity
                      style={styles.selectBtn}
                      onPress={() => setShowEmpPicker(true)}
                    >
                      <Text style={styles.selectBtnText}>
                        {uploadForm.employeeId
                          ? (() => {
                              const e = employees.find(
                                x => x._id === uploadForm.employeeId,
                              );
                              return e
                                ? `${e.firstName} ${e.lastName}`
                                : 'Select employee';
                            })()
                          : 'Select employee'}
                      </Text>
                      <ChevronDown size={16} color={C.black} />
                    </TouchableOpacity>
                  </View>
                )}

                <TouchableOpacity
                  style={styles.submitBtn}
                  onPress={handleUpload}
                  disabled={uploading}
                >
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
          </View>
        </View>
      </Modal>

      {otpModal}

      {/* Doc Type Picker */}
      <Modal visible={showDocTypePicker} animationType="fade" transparent>
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Document Type</Text>
              <TouchableOpacity onPress={() => setShowDocTypePicker(false)}>
                <X size={20} color={C.black} />
              </TouchableOpacity>
            </View>
            {DOC_TYPES.map(t => (
              <TouchableOpacity
                key={t.value}
                style={[
                  styles.sheetOption,
                  uploadForm.docType === t.value && styles.sheetOptionActive,
                ]}
                onPress={() => {
                  setUploadForm(p => ({ ...p, docType: t.value }));
                  setShowDocTypePicker(false);
                }}
              >
                <Text
                  style={[
                    styles.sheetOptionText,
                    uploadForm.docType === t.value && { color: C.primary },
                  ]}
                >
                  {t.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>

      {/* Employee Picker */}
      <Modal visible={showEmpPicker} animationType="fade" transparent>
        <View style={styles.overlay}>
          <View style={[styles.sheet, { maxHeight: '70%' }]}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Select Employee</Text>
              <TouchableOpacity onPress={() => setShowEmpPicker(false)}>
                <X size={20} color={C.black} />
              </TouchableOpacity>
            </View>
            <ScrollView>
              <TouchableOpacity
                style={[
                  styles.sheetOption,
                  !uploadForm.employeeId && styles.sheetOptionActive,
                ]}
                onPress={() => {
                  setUploadForm(p => ({ ...p, employeeId: '' }));
                  setShowEmpPicker(false);
                }}
              >
                <Text
                  style={[
                    styles.sheetOptionText,
                    !uploadForm.employeeId && { color: C.primary },
                  ]}
                >
                  Select employee
                </Text>
              </TouchableOpacity>
              {employees.map(e => (
                <TouchableOpacity
                  key={e._id}
                  style={[
                    styles.sheetOption,
                    uploadForm.employeeId === e._id && styles.sheetOptionActive,
                  ]}
                  onPress={() => {
                    setUploadForm(p => ({ ...p, employeeId: e._id }));
                    setShowEmpPicker(false);
                  }}
                >
                  <Text
                    style={[
                      styles.sheetOptionText,
                      uploadForm.employeeId === e._id && { color: C.primary },
                    ]}
                  >
                    {e.firstName} {e.lastName}
                    {e.employeeId ? `  ·  ${e.employeeId}` : ''}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 12 },
  tile: {
    width: '48%',
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: C.white,
    padding: 10,
    borderWidth: 2,
    borderRadius: 8,
    borderRightWidth: 4,
    borderBottomWidth: 4,
    borderColor: C.black,
    borderRightColor: '#0A0A0A',
    borderBottomColor: '#0A0A0A',
  },
  tileWide: { width: '23%' },
  tileIcon: {
    width: 32,
    height: 32,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: C.black,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileVal: { fontSize: 18, color: C.black },
  tileLabel: { fontSize: 10, color: C.textMuted, textTransform: 'uppercase' },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: C.white,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
    borderWidth: 2,
    borderRadius: 8,
    borderColor: C.black,
  },
  searchInput: { flex: 1, fontSize: 14, color: C.black, padding: 0 },
  personRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 2,
    borderColor: C.black,
  },
  avatarFb: {
    backgroundColor: C.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: C.white, fontSize: 15 },
  personName: { fontSize: 15, color: C.black },
  personCode: { fontSize: 12, color: '#94A3B8', marginTop: 1 },
  personCount: { fontSize: 11, color: C.textMuted, marginTop: 2 },
  iconBtn: { padding: 6 },
  dlBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderRadius: 8,
    borderColor: C.primary,
  },
  viewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 12,
    paddingVertical: 8,
    borderTopWidth: 1.5,
    borderTopColor: 'rgba(0,0,0,0.12)',
  },
  viewBtnText: { fontSize: 13, color: C.primary },
  details: { marginTop: 4, gap: 10 },
  typeBlock: {
    borderWidth: 1.5,
    borderColor: 'rgba(0,0,0,0.15)',
    borderRadius: 8,
    padding: 10,
    gap: 6,
  },
  typeHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  typeDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: C.black,
  },
  typeLabel: { fontSize: 13, color: C.black },
  okText: { fontSize: 11, color: C.success },
  addMini: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1.5,
    borderColor: C.primary,
    borderRadius: 6,
  },
  addMiniText: { fontSize: 11, color: C.primary },
  missingRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  missingText: { fontSize: 12, color: C.danger },
  docRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 2,
    borderBottomColor: C.black,
  },
  pickRow: { flexDirection: 'row', gap: 10, marginTop: 6 },
  pickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 18,
    paddingVertical: 8,
    backgroundColor: C.white,
    borderWidth: 2,
    borderRadius: 8,
    borderColor: C.black,
  },
  pickBtnText: { fontSize: 13, color: C.primary },
  menuText: { fontSize: 15, color: C.black },
  safe: { flex: 1, backgroundColor: C.bg },
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
  backBtn: { padding: 4, marginRight: 2 },
  headerTitle: { fontSize: 20, fontWeight: '400', color: C.black },
  addBtn: { padding: 4 },
  filterBar: {
    backgroundColor: C.white,
    borderBottomWidth: 2,
    borderBottomColor: C.black,
    maxHeight: 52,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 2,
    borderRightWidth: 4,
    borderBottomWidth: 4,
    borderRightColor: '#0A0A0A',
    borderBottomColor: '#0A0A0A',
    borderRadius: 8,
    borderColor: C.black,
    backgroundColor: C.white,
  },
  chipActive: { borderColor: C.primary, backgroundColor: '#EFF6FF' },
  chipText: {
    fontSize: 12,
    fontWeight: '400',
    color: '#6B7280',
    textTransform: 'capitalize',
  },
  chipTextActive: { color: C.primary },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '400',
    color: '#6B7280',
    marginTop: 12,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '400',
    textAlign: 'center',
    marginTop: 6,
  },
  card: {
    backgroundColor: C.white,
    borderWidth: 2,
    borderRadius: 8,
    borderRightWidth: 4,
    borderBottomWidth: 4,
    borderRightColor: '#0A0A0A',
    borderBottomColor: '#0A0A0A',
    borderColor: C.black,
    padding: 14,
  },
  cardTablet: { flex: 1 },
  colWrapper: { gap: 10 },
  cardLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  iconBox: {
    width: 36,
    height: 36,
    backgroundColor: '#EFF6FF',
    borderWidth: 2,
    borderRightWidth: 4,
    borderBottomWidth: 4,
    borderRightColor: '#0A0A0A',
    borderBottomColor: '#0A0A0A',
    borderRadius: 8,
    borderColor: C.black,
    alignItems: 'center',
    justifyContent: 'center',
  },
  docName: { fontWeight: '400', fontSize: 13, color: C.black },
  docMeta: { fontSize: 11, color: '#6B7280', marginTop: 2 },
  docEmp: { fontSize: 11, color: C.primary, fontWeight: '400', marginTop: 1 },
  docDate: { fontSize: 11, color: '#6B7280', marginTop: 1 },
  cardActions: { flexDirection: 'row', gap: 6 },
  actionBtn: {
    width: 32,
    height: 32,
    borderWidth: 2,
    borderRightWidth: 4,
    borderBottomWidth: 4,
    borderRightColor: '#0A0A0A',
    borderBottomColor: '#0A0A0A',
    borderRadius: 8,
    borderColor: C.black,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
  modalTitle: { fontSize: 18, fontWeight: '400', color: C.black },
  filePicker: {
    borderWidth: 2,
    borderRadius: 8,
    borderRightWidth: 4,
    borderBottomWidth: 4,
    borderRightColor: '#0A0A0A',
    borderBottomColor: '#0A0A0A',
    borderColor: C.black,
    borderStyle: 'dashed',
    padding: 24,
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F8F9FA',
  },
  filePickerName: {
    fontSize: 14,
    fontWeight: '400',
    color: C.primary,
    textAlign: 'center',
  },
  filePickerSize: { fontSize: 12, color: '#6B7280' },
  filePickerPlaceholder: { fontSize: 14, fontWeight: '400', color: '#6B7280' },
  filePickerHint: { fontSize: 12, color: '#D1D5DB' },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '400',
    color: C.black,
    marginBottom: 6,
  },
  fieldInput: {
    borderWidth: 2,
    borderRadius: 8,
    borderRightWidth: 4,
    borderBottomWidth: 4,
    borderRightColor: '#0A0A0A',
    borderBottomColor: '#0A0A0A',
    borderColor: C.black,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 14,
    fontWeight: '400',
    color: C.black,
    backgroundColor: C.white,
  },
  selectBtn: {
    borderWidth: 2,
    borderRadius: 8,
    borderRightWidth: 4,
    borderBottomWidth: 4,
    borderRightColor: '#0A0A0A',
    borderBottomColor: '#0A0A0A',
    borderColor: C.black,
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: C.white,
  },
  selectBtnText: { fontSize: 14, fontWeight: '400', color: C.black },
  submitBtn: {
    backgroundColor: C.primary,
    borderWidth: 2,
    borderRadius: 8,
    borderRightWidth: 4,
    borderBottomWidth: 4,
    borderRightColor: '#0A0A0A',
    borderBottomColor: '#0A0A0A',
    borderColor: C.black,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,
  },
  submitBtnText: {
    color: C.white,
    fontWeight: '400',
    fontSize: 14,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 24,
  },
  sheet: {
    backgroundColor: C.white,
    borderWidth: 2,
    borderRadius: 8,
    borderColor: C.black,
    overflow: 'hidden',
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 2,
    borderBottomColor: C.black,
  },
  sheetTitle: { fontSize: 16, fontWeight: '400', color: C.black },
  sheetOption: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 2,
    borderBottomColor: C.black,
  },
  sheetOptionActive: { backgroundColor: '#EFF6FF' },
  sheetOptionText: { fontSize: 15, fontWeight: '400', color: C.black },
});

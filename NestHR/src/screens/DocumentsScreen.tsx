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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import {
  FolderOpen,
  Upload,
  Download,
  Trash2,
  X,
  FileText,
  Shield,
  Scroll,
  Briefcase,
  File,
  ChevronLeft,
} from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { documentAPI, employeeAPI } from '../api/api';
import { useAuth } from '../contexts/AuthContext';
import { C, S } from '../theme';

const DOC_TYPES = [
  { value: 'id_proof', label: 'ID Proof' },
  { value: 'certificate', label: 'Certificate' },
  { value: 'contract', label: 'Contract' },
  { value: 'resume', label: 'Resume' },
  { value: 'offer_letter', label: 'Offer Letter' },
  { value: 'other', label: 'Other' },
];

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function DocumentsScreen() {
  const navigation = useNavigation<any>();
  const { user } = useAuth();
  const isEmployee = user?.role === 'employee';
  const [docs, setDocs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await documentAPI.getAll();
      setDocs(res.data || []);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
    }
  }, []);

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

  const handleDownload = async (doc: any) => {
    Alert.alert(
      'Download Document',
      `"${doc.name}" (${formatBytes(doc.sizeBytes)})\n\nDocument downloads are available via the web app. Open NestHR on your browser to download files.`,
      [{ text: 'OK' }],
    );
  };

  const renderItem = ({ item }: { item: any }) => (
    <View style={styles.card}>
      <View style={styles.cardLeft}>
        <View style={styles.iconBox}>
          <FileText size={18} color={C.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.docName} numberOfLines={1}>{item.name}</Text>
          <Text style={styles.docMeta}>
            {DOC_TYPES.find(t => t.value === item.docType)?.label ?? item.docType}
            {' · '}
            {formatBytes(item.sizeBytes)}
          </Text>
          {!isEmployee && item.employee && (
            <Text style={styles.docEmp}>
              {item.employee.firstName} {item.employee.lastName}
            </Text>
          )}
          <Text style={styles.docDate}>
            {new Date(item.createdAt).toLocaleDateString('en-IN')}
          </Text>
        </View>
      </View>
      <View style={styles.cardActions}>
        <TouchableOpacity style={styles.actionBtn} onPress={() => handleDownload(item)}>
          <Download size={14} color={C.primary} />
        </TouchableOpacity>
        {!isEmployee && (
          <TouchableOpacity
            style={[styles.actionBtn, styles.deleteBtn]}
            onPress={() => handleDelete(item._id, item.name)}
          >
            <Trash2 size={14} color={C.danger} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={S.screen}>
      <View style={S.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={S.backBtn}>
          <ChevronLeft size={22} color="#000" />
        </TouchableOpacity>
        <Text style={S.headerTitle}>Document Vault</Text>
        <View style={{ width: 36 }} />
      </View>

      {loading ? (
        <View style={S.center}>
          <Text style={S.loadingText}>Loading documents...</Text>
        </View>
      ) : docs.length === 0 ? (
        <View style={S.center}>
          <FolderOpen size={48} color="#D1D5DB" />
          <Text style={S.emptyTitle}>No documents</Text>
          <Text style={S.emptySubtitle}>
            {isEmployee
              ? 'No documents have been uploaded for you yet'
              : 'Upload documents via the web app'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={docs}
          keyExtractor={d => d._id}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 16 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[C.primary]} />}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        />
      )}

      {!isEmployee && (
        <View style={styles.uploadNote}>
          <Upload size={14} color="#6B7280" />
          <Text style={styles.uploadNoteText}>
            Upload documents from the web app (hrms.pixelatenest.com)
          </Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#000',
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  cardLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  iconBox: {
    width: 36,
    height: 36,
    backgroundColor: '#EFF6FF',
    borderWidth: 2,
    borderColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  docName: {
    fontWeight: '700',
    fontSize: 13,
    color: '#000',
  },
  docMeta: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 2,
  },
  docEmp: {
    fontSize: 11,
    color: C.primary,
    fontWeight: '600',
    marginTop: 1,
  },
  docDate: {
    fontSize: 10,
    color: '#9CA3AF',
    marginTop: 1,
  },
  cardActions: {
    flexDirection: 'row',
    gap: 6,
  },
  actionBtn: {
    width: 32,
    height: 32,
    borderWidth: 2,
    borderColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteBtn: {
    borderColor: C.danger,
  },
  uploadNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 12,
    backgroundColor: '#F9FAFB',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  uploadNoteText: {
    fontSize: 11,
    color: '#6B7280',
    flex: 1,
  },
});

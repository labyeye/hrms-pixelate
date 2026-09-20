import React, { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ChevronLeft, RotateCcw, Trash2 } from 'lucide-react-native';
import { trashAPI } from '../api/api';
import ScreenLayout from '../components/common/ScreenLayout';
import { C, FONT } from '../theme';

const TYPE_LABEL: Record<string, string> = {
  Leave: 'Leave Request',
  Task: 'Task',
  Announcement: 'Announcement',
  EmployeeDocument: 'Document',
};

const labelOf = (item: any) => {
  const d = item.data || {};
  return d.title || d.subject || d.name || d.leaveType || '(untitled)';
};

const fmt = (d?: string) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '';

export default function TrashScreen() {
  const navigation = useNavigation<any>();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const r: any = await trashAPI.getAll();
      setItems(r.data || []);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to load trash');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const restore = (item: any) =>
    Alert.alert('Restore item?', `"${labelOf(item)}" will be restored to ${TYPE_LABEL[item.modelName] || item.modelName}.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Restore',
        onPress: async () => {
          try {
            await trashAPI.restore(item._id);
            await load();
          } catch (e: any) {
            Alert.alert('Error', e?.message || 'Failed to restore');
          }
        },
      },
    ]);

  const purge = (item: any) =>
    Alert.alert('Permanently delete?', `"${labelOf(item)}" will be deleted forever. This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete forever',
        style: 'destructive',
        onPress: async () => {
          try {
            await trashAPI.purge(item._id);
            await load();
          } catch (e: any) {
            Alert.alert('Error', e?.message || 'Failed to delete');
          }
        },
      },
    ]);

  return (
    <ScreenLayout title="Trash" loading={loading}>
      <View style={s.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10} style={s.back}>
          <ChevronLeft size={18} color={C.black} />
          <Text style={s.backText}>Back</Text>
        </TouchableOpacity>
      </View>
      <Text style={s.hint}>Deleted tasks, announcements, documents and leave requests land here. Restore them or delete them forever.</Text>
      <FlatList
        data={items}
        keyExtractor={i => i._id}
        contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 10 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={<Text style={s.empty}>Trash is empty</Text>}
        renderItem={({ item }) => (
          <View style={s.card}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <View style={s.tag}>
                <Text style={s.tagText}>{TYPE_LABEL[item.modelName] || item.modelName}</Text>
              </View>
              <Text style={s.title} numberOfLines={2}>
                {labelOf(item)}
              </Text>
              <Text style={s.meta}>
                Deleted {fmt(item.createdAt)}
                {item.deletedByName ? ` by ${item.deletedByName}` : ''}
              </Text>
            </View>
            <TouchableOpacity style={[s.btn, { borderColor: C.primary }]} onPress={() => restore(item)} hitSlop={6}>
              <RotateCcw size={16} color={C.primary} />
            </TouchableOpacity>
            <TouchableOpacity style={[s.btn, { borderColor: C.danger }]} onPress={() => purge(item)} hitSlop={6}>
              <Trash2 size={16} color={C.danger} />
            </TouchableOpacity>
          </View>
        )}
      />
    </ScreenLayout>
  );
}

const s = StyleSheet.create({
  topBar: { paddingHorizontal: 16, paddingTop: 10 },
  back: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start' },
  backText: { fontFamily: FONT.bold, fontSize: 12, color: C.black, textTransform: 'uppercase' },
  hint: { fontFamily: FONT.medium, fontSize: 12, color: '#374151', paddingHorizontal: 16, paddingTop: 8 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 2, borderColor: C.black, padding: 12, backgroundColor: '#fff' },
  tag: { alignSelf: 'flex-start', borderWidth: 2, borderColor: '#6B7280', paddingHorizontal: 8, paddingVertical: 1, marginBottom: 6 },
  tagText: { fontFamily: FONT.bold, fontSize: 10, color: '#374151', textTransform: 'uppercase' },
  title: { fontFamily: FONT.bold, fontSize: 15, color: C.black },
  meta: { fontFamily: FONT.medium, fontSize: 12, color: '#374151', marginTop: 4 },
  btn: { width: 36, height: 36, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  empty: { textAlign: 'center', fontFamily: FONT.bold, color: '#6B7280', marginTop: 40 },
});

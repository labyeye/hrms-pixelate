import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { ChevronLeft, AlertOctagon, Clock } from 'lucide-react-native';
import { lateApprovalAPI } from '../api/api';
import { C } from '../theme';

const RESOLUTIONS: { key: string; label: string; color: string }[] = [
  { key: 'present', label: 'Present', color: C.success },
  { key: 'late', label: 'Late', color: C.warning },
  { key: 'absent', label: 'Absent', color: C.danger },
  { key: 'half_day', label: 'Half Day', color: C.secondary },
];

export default function LateApprovalsScreen() {
  const navigation = useNavigation<any>();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await lateApprovalAPI.getAll();
      setItems(res?.data || []);
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

  const resolve = async (id: string, resolvedStatus: string) => {
    setResolvingId(id);
    try {
      await lateApprovalAPI.resolve(id, resolvedStatus);
      setItems(prev => prev.filter(i => i._id !== id));
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setResolvingId(null);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 4, marginRight: 4 }}>
          <ChevronLeft size={22} color={C.black} />
        </TouchableOpacity>
        <AlertOctagon size={20} color={C.primary} />
        <Text style={styles.headerTitle}>Late Approvals</Text>
      </View>

      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={C.primary} />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={item => item._id}
          contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 32 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} />
          }
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.empty}>
              <AlertOctagon size={40} color="#D1D5DB" />
              <Text style={styles.emptyText}>No pending approvals</Text>
            </View>
          }
          renderItem={({ item }) => {
            const emp = item.employee as any;
            return (
              <View style={styles.card}>
                <Text style={styles.empName}>
                  {emp ? `${emp.firstName} ${emp.lastName}` : 'Unknown employee'}
                </Text>
                <Text style={styles.empSub}>
                  {emp?.employeeId || ''} · {new Date(item.date).toLocaleDateString('en-IN')}
                </Text>
                <View style={styles.metaRow}>
                  <Clock size={12} color={C.warning} />
                  <Text style={styles.metaText}>
                    {item.minutesLate} min late
                    {item.checkInTime
                      ? ` · checked in ${new Date(item.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                      : ''}
                  </Text>
                </View>
                {!!item.reason && <Text style={styles.reason}>"{item.reason}"</Text>}

                <View style={styles.actionRow}>
                  {RESOLUTIONS.map(r => (
                    <TouchableOpacity
                      key={r.key}
                      style={[styles.actionBtn, { backgroundColor: r.color }]}
                      onPress={() => resolve(item._id, r.key)}
                      disabled={resolvingId === item._id}
                    >
                      {resolvingId === item._id ? (
                        <ActivityIndicator size="small" color={C.white} />
                      ) : (
                        <Text style={styles.actionBtnText}>{r.label}</Text>
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F8F9FA' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: C.white,
    borderBottomWidth: 2,
    borderBottomColor: C.black,
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: C.black },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyText: { fontSize: 14, fontWeight: '700', color: C.textMuted },
  card: {
    backgroundColor: C.white,
    borderWidth: 2,
    borderColor: C.black,
    padding: 14,
  },
  empName: { fontSize: 15, fontWeight: '800', color: C.black },
  empSub: { fontSize: 11, color: '#9CA3AF', fontWeight: '600', marginTop: 2 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  metaText: { fontSize: 12, fontWeight: '600', color: C.warning },
  reason: {
    fontSize: 12,
    color: C.textMuted,
    fontStyle: 'italic',
    marginTop: 6,
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  actionBtn: {
    flexGrow: 1,
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderWidth: 2,
    borderColor: C.black,
    minWidth: '45%',
  },
  actionBtnText: {
    color: C.white,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
});

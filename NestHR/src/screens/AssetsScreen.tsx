import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import {
  Cpu,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ChevronLeft,
  RefreshCw,
} from 'lucide-react-native';
import { assetAPI } from '../api/api';
import { C } from '../theme';

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  assigned: { label: 'Assigned', color: C.primary, bg: '#EFF6FF', icon: CheckCircle2 },
  returned: { label: 'Returned', color: C.textMuted, bg: '#F3F4F6', icon: XCircle },
  return_requested: { label: 'Return Pending', color: C.warning, bg: '#FFF7ED', icon: Clock },
};

export default function AssetsScreen() {
  const navigation = useNavigation<any>();
  const [assets, setAssets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await assetAPI.getAll();
      setAssets(res.data || res || []);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to load assets');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const handleReturn = (id: string, name: string) => {
    Alert.alert('Return Asset', `Request return for "${name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Request Return',
        onPress: async () => {
          try {
            await assetAPI.return(id);
            Alert.alert('Success', 'Asset return request raised successfully');
            load();
          } catch (e: any) {
            Alert.alert('Error', e.message || 'Failed to request return');
          }
        },
      },
    ]);
  };

  const renderAsset = ({ item }: { item: any }) => {
    const statusMeta = STATUS_CONFIG[item.status] || {
      label: item.status,
      color: C.textMuted,
      bg: '#F3F4F6',
      icon: AlertCircle,
    };
    const StatusIcon = statusMeta.icon;

    return (
      <View style={styles.card}>
        <View style={styles.cardTop}>
          <Text style={styles.assetName}>{item.name}</Text>
          <View style={[styles.statusBadge, { backgroundColor: statusMeta.bg, borderColor: statusMeta.color }]}>
            <StatusIcon size={10} color={statusMeta.color} />
            <Text style={[styles.statusText, { color: statusMeta.color }]}>{statusMeta.label}</Text>
          </View>
        </View>

        <View style={styles.infoRow}>
          <View style={styles.infoCol}>
            <Text style={styles.infoLabel}>Asset Code</Text>
            <Text style={styles.infoVal}>{item.assetCode || '—'}</Text>
          </View>
          <View style={styles.infoCol}>
            <Text style={styles.infoLabel}>Serial Number</Text>
            <Text style={styles.infoVal}>{item.serialNumber || '—'}</Text>
          </View>
        </View>

        <View style={styles.cardBottom}>
          <View>
            <Text style={styles.infoLabel}>Date Assigned</Text>
            <Text style={styles.date}>
              {item.assignedDate ? new Date(item.assignedDate).toLocaleDateString('en-IN') : '—'}
            </Text>
          </View>

          {item.status === 'assigned' && (
            <TouchableOpacity style={styles.returnBtn} onPress={() => handleReturn(item._id, item.name)}>
              <RefreshCw size={11} color="#fff" />
              <Text style={styles.returnBtnText}>Return</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ChevronLeft size={22} color={C.black} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Assets</Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={C.primary} />
        </View>
      ) : assets.length === 0 ? (
        <View style={styles.center}>
          <Cpu size={48} color="#D1D5DB" />
          <Text style={styles.emptyTitle}>No assets assigned</Text>
          <Text style={styles.emptySubtitle}>You currently do not have any company hardware assigned.</Text>
        </View>
      ) : (
        <FlatList
          data={assets}
          keyExtractor={item => item._id}
          renderItem={renderAsset}
          contentContainerStyle={{ padding: 16 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[C.primary]} tintColor={C.primary} />}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          showsVerticalScrollIndicator={false}
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
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: C.white,
    borderBottomWidth: 2,
    borderBottomColor: C.black,
    gap: 8,
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 20, fontWeight: '700', color: C.black },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: '#6B7280', marginTop: 12 },
  emptySubtitle: { fontSize: 13, color: '#9CA3AF', fontWeight: '500', textAlign: 'center', marginTop: 6 },
  card: {
    backgroundColor: C.white,
    borderWidth: 2,
    borderColor: C.black,
    padding: 14,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 12 },
  assetName: { fontSize: 15, fontWeight: '700', color: C.black, flex: 1 },
  statusBadge: { borderWidth: 2, paddingHorizontal: 8, paddingVertical: 2, flexDirection: 'row', alignItems: 'center', gap: 4 },
  statusText: { fontSize: 9, fontWeight: '800', textTransform: 'uppercase' },
  infoRow: { flexDirection: 'row', gap: 16, marginBottom: 12 },
  infoCol: { flex: 1 },
  infoLabel: { fontSize: 9, fontWeight: '700', textTransform: 'uppercase', color: C.textMuted, marginBottom: 2 },
  infoVal: { fontSize: 12, fontWeight: '600', color: C.black },
  cardBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', borderTopWidth: 1, borderTopColor: '#F3F4F6', paddingTop: 10, marginTop: 4 },
  date: { fontSize: 12, fontWeight: '600', color: C.black },
  returnBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: C.secondary,
    borderWidth: 2,
    borderColor: C.black,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  returnBtnText: { color: C.white, fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
});

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import {
  Shield,
  ChevronLeft,
  ChevronRight,
  Search,
  User,
  ChevronDown,
  ChevronUp,
} from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { auditAPI } from '../api/api';
import { C } from '../theme';

interface AuditLog {
  _id: string;
  user?: { name: string; email: string };
  userName?: string;
  userEmail?: string;
  action: string;
  entity?: string;
  details?: Record<string, any>;
  ip?: string;
  createdAt: string;
}

const ACTION_COLORS: Record<string, { bg: string; text: string }> = {
  employee_created: { bg: '#dcfce7', text: '#166534' },
  employee_updated: { bg: '#dbeafe', text: '#1e40af' },
  employee_terminated: { bg: '#fee2e2', text: '#991b1b' },
  leave_approved: { bg: '#dcfce7', text: '#166534' },
  leave_rejected: { bg: '#fee2e2', text: '#991b1b' },
  leave_cancelled: { bg: '#f3f4f6', text: '#374151' },
  exit_initiated: { bg: '#ffedd5', text: '#9a3412' },
  exit_updated: { bg: '#fef9c3', text: '#854d0e' },
};

function actionLabel(action: string) {
  return action.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function fmtDate(d: string) {
  const date = new Date(d);
  return (
    date.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }) +
    ' ' +
    date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
  );
}

const PAGE_SIZE = 15;

export default function AuditLogScreen() {
  const navigation = useNavigation<any>();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(
    async (pg = 1, reset = false) => {
      if (reset) setLoading(true);
      try {
        const params: Record<string, string> = {
          page: String(pg),
          limit: String(PAGE_SIZE),
        };
        if (search) params.action = search;
        const res = await auditAPI.getLogs(params);
        if (reset || pg === 1) {
          setLogs(res.data || []);
        } else {
          setLogs(prev => [...prev, ...(res.data || [])]);
        }
        setTotal(res.total || 0);
        setPage(pg);
      } catch {}
      setLoading(false);
      setRefreshing(false);
    },
    [search],
  );

  useFocusEffect(
    useCallback(() => {
      load(1, true);
    }, [load]),
  );

  const onRefresh = () => {
    setRefreshing(true);
    load(1, true);
  };

  const loadMore = () => {
    if (logs.length < total) load(page + 1);
  };

  const renderItem = ({ item }: { item: AuditLog }) => {
    const colors = ACTION_COLORS[item.action] || {
      bg: '#f3f4f6',
      text: '#374151',
    };
    const isExpanded = expanded === item._id;
    const hasDetails = item.details && Object.keys(item.details).length > 0;
    const displayName = item.user?.name || item.userName || 'System';
    const displayEmail = item.user?.email || item.userEmail || '';

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() =>
          hasDetails ? setExpanded(isExpanded ? null : item._id) : undefined
        }
        activeOpacity={hasDetails ? 0.7 : 1}
      >
        <View style={styles.cardTop}>
          <View style={[styles.badge, { backgroundColor: colors.bg }]}>
            <Text style={[styles.badgeText, { color: colors.text }]}>
              {actionLabel(item.action)}
            </Text>
          </View>
          {hasDetails && (
            <View style={styles.expandIcon}>
              {isExpanded ? (
                <ChevronUp size={14} color={C.textMuted} />
              ) : (
                <ChevronDown size={14} color={C.textMuted} />
              )}
            </View>
          )}
        </View>

        <View style={styles.cardMeta}>
          <View style={styles.metaRow}>
            <User size={12} color={C.textMuted} />
            <Text style={styles.metaText} numberOfLines={1}>
              {displayName}
            </Text>
            {displayEmail ? (
              <Text style={styles.metaEmail} numberOfLines={1}>
                {' '}
                · {displayEmail}
              </Text>
            ) : null}
          </View>
          <View style={styles.metaRow}>
            {item.entity ? (
              <Text style={styles.entityTag}>{item.entity}</Text>
            ) : null}
            <Text style={styles.dateText}>{fmtDate(item.createdAt)}</Text>
          </View>
        </View>

        {isExpanded && hasDetails && (
          <View style={styles.detailBox}>
            {Object.entries(item.details!).map(([k, v]) => (
              <View key={k} style={styles.detailRow}>
                <Text style={styles.detailKey}>{k.replace(/_/g, ' ')}</Text>
                <Text style={styles.detailVal}>{String(v)}</Text>
              </View>
            ))}
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
        >
          <ChevronLeft size={22} color={C.black} />
        </TouchableOpacity>
        <View style={styles.headerTitle}>
          <Shield size={18} color={C.primary} />
          <Text style={styles.headerText}>Audit Log</Text>
        </View>
        <View style={{ width: 36 }} />
      </View>

      {/* Search */}
      <View style={styles.searchWrap}>
        <Search size={16} color={C.textMuted} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Filter by action..."
          placeholderTextColor={C.textMuted}
          value={search}
          onChangeText={t => {
            setSearch(t);
          }}
          onSubmitEditing={() => load(1, true)}
          returnKeyType="search"
        />
      </View>

      {/* Count */}
      {!loading && (
        <Text style={styles.countText}>
          {total} record{total !== 1 ? 's' : ''}
        </Text>
      )}

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={C.primary} />
        </View>
      ) : logs.length === 0 ? (
        <View style={styles.center}>
          <Shield size={48} color="#D1D5DB" />
          <Text style={styles.emptyText}>No audit logs yet</Text>
          <Text style={styles.emptySubtext}>
            Actions like approving leaves or editing employees will appear here
          </Text>
        </View>
      ) : (
        <FlatList
          data={logs}
          keyExtractor={i => i._id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[C.primary]}
            />
          }
          onEndReached={loadMore}
          onEndReachedThreshold={0.3}
          ListFooterComponent={
            logs.length < total ? (
              <View style={styles.loadMore}>
                <ActivityIndicator size="small" color={C.primary} />
              </View>
            ) : null
          }
          ItemSeparatorComponent={() => <View style={styles.sep} />}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F0F6FF' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 2,
    borderBottomColor: '#000',
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerText: {
    fontSize: 17,
    fontWeight: '900',
    color: '#000',
    letterSpacing: -0.3,
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 12,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#000',
    paddingHorizontal: 10,
  },
  searchIcon: { marginRight: 6 },
  searchInput: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 14,
    color: '#000',
    fontWeight: '500',
  },
  countText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6B7280',
    paddingHorizontal: 16,
    marginBottom: 4,
  },
  list: { padding: 12, paddingTop: 4 },
  sep: { height: 8 },
  card: {
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#000',
    padding: 12,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 2,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  expandIcon: { padding: 2 },
  cardMeta: { gap: 4 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 12, fontWeight: '700', color: '#111', flex: 1 },
  metaEmail: { fontSize: 11, color: '#6B7280', flexShrink: 1 },
  entityTag: {
    fontSize: 10,
    fontWeight: '800',
    color: '#024BAB',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 2,
    marginRight: 6,
  },
  dateText: { fontSize: 11, color: '#9CA3AF', fontWeight: '500' },
  detailBox: {
    marginTop: 10,
    backgroundColor: '#F0F6FF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    padding: 8,
    gap: 4,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailKey: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6B7280',
    textTransform: 'capitalize',
    flex: 1,
  },
  detailVal: {
    fontSize: 11,
    fontWeight: '800',
    color: '#000',
    flex: 1,
    textAlign: 'right',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 24,
  },
  emptyText: { fontSize: 16, fontWeight: '800', color: '#374151' },
  emptySubtext: {
    fontSize: 13,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 20,
  },
  loadMore: { padding: 16, alignItems: 'center' },
});

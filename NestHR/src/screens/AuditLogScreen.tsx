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
  LogIn,
  LogOut,
  Monitor,
  Smartphone,
  Clock,
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

interface ActivityEvent {
  id: string;
  kind: 'check_in' | 'check_out' | 'login' | 'logout';
  at: string;
  name: string;
  sub?: string;
  via?: string;
  status?: string;
  device?: string;
  platform?: string;
  ip?: string;
  distance?: number;
  workHours?: number;
}

const KIND = {
  check_in: {
    label: 'Checked in',
    bg: '#dcfce7',
    text: '#166534',
    Icon: LogIn,
  },
  check_out: {
    label: 'Checked out',
    bg: '#ffedd5',
    text: '#9a3412',
    Icon: LogOut,
  },
  login: { label: 'Signed in', bg: '#dbeafe', text: '#1e40af', Icon: Monitor },
  logout: { label: 'Signed out', bg: '#f3f4f6', text: '#374151', Icon: LogOut },
};

const TYPES = [
  { key: 'all', label: 'All' },
  { key: 'attendance', label: 'Check in/out' },
  { key: 'login', label: 'Logins' },
];

const cap = (v?: string) =>
  v ? v.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : '';
const istDay = (offset = 0) =>
  new Date(Date.now() + 5.5 * 3600000 - offset * 86400000)
    .toISOString()
    .slice(0, 10);
const fmtTime = (d: string) =>
  new Date(d).toLocaleTimeString('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
const fmtDay = (d: string) =>
  new Date(d).toLocaleDateString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
  });

const RANGES = [
  { key: 'today', label: 'Today', days: 0 },
  { key: '7', label: '7 days', days: 6 },
  { key: '30', label: '30 days', days: 29 },
];

function ActivityList() {
  const [type, setType] = useState('all');
  const [range, setRange] = useState('today');
  const [rows, setRows] = useState<ActivityEvent[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [summary, setSummary] = useState({
    checkIns: 0,
    checkOuts: 0,
    logins: 0,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(
    async (pg = 1) => {
      if (pg === 1 && !refreshing) setLoading(true);
      setError('');
      try {
        const days = RANGES.find(x => x.key === range)?.days || 0;
        const res = await auditAPI.getActivity({
          type,
          startDate: istDay(days),
          endDate: istDay(0),
          page: String(pg),
          limit: String(PAGE_SIZE),
        });
        setRows(prev =>
          pg === 1 ? res.data || [] : [...prev, ...(res.data || [])],
        );
        setTotal(res.total || 0);
        if (res.summary) setSummary(res.summary);
        setPage(pg);
      } catch (e: any) {
        setError(e?.message || 'Failed to load activity');
      }
      setLoading(false);
      setRefreshing(false);
    },
    [type, range, refreshing],
  );

  useFocusEffect(
    useCallback(() => {
      load(1);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [type, range]),
  );

  const renderItem = ({ item }: { item: ActivityEvent }) => {
    const k = KIND[item.kind];
    const isLogin = item.kind === 'login' || item.kind === 'logout';
    const detail = isLogin
      ? item.ip
        ? `IP ${item.ip}`
        : ''
      : [
          cap(item.status),
          item.kind === 'check_out' && item.workHours
            ? `${item.workHours}h worked`
            : '',
          item.distance != null
            ? `${Math.round(item.distance)}m from office`
            : '',
        ]
          .filter(Boolean)
          .join(' · ');
    return (
      <View style={styles.card}>
        <View style={styles.cardTop}>
          <View style={[styles.badge, { backgroundColor: k.bg }]}>
            <k.Icon size={11} color={k.text} />
            <Text style={[styles.badgeText, { color: k.text }]}>{k.label}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.timeText}>{fmtTime(item.at)}</Text>
            <Text style={styles.dateText}>{fmtDay(item.at)}</Text>
          </View>
        </View>
        <Text style={styles.metaText}>{item.name}</Text>
        {!!item.sub && <Text style={styles.metaEmail}>{item.sub}</Text>}
        <View style={[styles.metaRow, { marginTop: 6 }]}>
          {isLogin ? (
            item.platform === 'web' ? (
              <Monitor size={12} color={C.textMuted} />
            ) : (
              <Smartphone size={12} color={C.textMuted} />
            )
          ) : (
            <Clock size={12} color={C.textMuted} />
          )}
          <Text style={styles.metaEmail}>
            {isLogin ? item.device || 'Unknown device' : cap(item.via) || '—'}
            {detail ? `  ·  ${detail}` : ''}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.pillRow}>
        {TYPES.map(t => (
          <TouchableOpacity
            key={t.key}
            style={[styles.pill, type === t.key && styles.pillActive]}
            onPress={() => setType(t.key)}
          >
            <Text
              style={[styles.pillText, type === t.key && styles.pillTextActive]}
            >
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={styles.pillRow}>
        {RANGES.map(t => (
          <TouchableOpacity
            key={t.key}
            style={[styles.pill, range === t.key && styles.pillActive]}
            onPress={() => setRange(t.key)}
          >
            <Text
              style={[
                styles.pillText,
                range === t.key && styles.pillTextActive,
              ]}
            >
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      {!loading && (
        <Text style={styles.countText}>
          {summary.checkIns} check-ins · {summary.checkOuts} check-outs ·{' '}
          {summary.logins} logins
        </Text>
      )}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={C.primary} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.emptyText}>{error}</Text>
        </View>
      ) : rows.length === 0 ? (
        <View style={styles.center}>
          <Clock size={48} color="#D1D5DB" />
          <Text style={styles.emptyText}>No activity for this period</Text>
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={i => i.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                load(1);
              }}
              colors={[C.primary]}
            />
          }
          onEndReached={() => rows.length < total && load(page + 1)}
          onEndReachedThreshold={0.3}
          ItemSeparatorComponent={() => <View style={styles.sep} />}
        />
      )}
    </View>
  );
}

export default function AuditLogScreen() {
  const navigation = useNavigation<any>();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [tab, setTab] = useState<'activity' | 'changes'>('activity');

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

      <View style={styles.tabs}>
        {(
          [
            ['activity', 'Attendance & Logins'],
            ['changes', 'Change History'],
          ] as const
        ).map(([key, label]) => (
          <TouchableOpacity
            key={key}
            style={[styles.tab, tab === key && styles.tabActive]}
            onPress={() => setTab(key)}
          >
            <Text style={[styles.tabText, tab === key && styles.tabTextActive]}>
              {label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === 'activity' ? (
        <ActivityList />
      ) : (
        <>
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
                Actions like approving leaves or editing employees will appear
                here
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
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  tabs: {
    flexDirection: 'row',
    margin: 12,
    marginBottom: 0,
    borderWidth: 2,
    borderRadius: 8,
    borderColor: '#000',
    overflow: 'hidden',
    backgroundColor: '#fff',
  },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center' },
  tabActive: { backgroundColor: '#024BAB' },
  tabText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748b',
    textTransform: 'uppercase',
  },
  tabTextActive: { color: '#fff' },
  pillRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 10,
  },
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 2,
    borderColor: '#000',
    borderRadius: 999,
    backgroundColor: '#fff',
  },
  pillActive: { backgroundColor: '#FFDE00' },
  pillText: { fontSize: 11, fontWeight: '800', color: '#000' },
  pillTextActive: { color: '#000' },
  timeText: { fontSize: 13, fontWeight: '800', color: '#000' },
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
    fontWeight: '700',
    color: '#000',
    letterSpacing: -0.3,
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 12,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderRadius: 8,
    borderRightWidth: 5,
    borderBottomWidth: 5,
    borderRightColor: '#0A0A0A',
    borderBottomColor: '#0A0A0A',
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
    borderRadius: 8,
    borderRightWidth: 5,
    borderBottomWidth: 5,
    borderRightColor: '#0A0A0A',
    borderBottomColor: '#0A0A0A',
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
    borderWidth: 2,
    borderRadius: 999,
    borderColor: '#0A0A0A',
    borderRightWidth: 4,
    borderBottomWidth: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
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
    fontSize: 12,
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
    borderWidth: 2,
    borderRadius: 8,
    borderRightWidth: 5,
    borderBottomWidth: 5,
    borderRightColor: '#0A0A0A',
    borderBottomColor: '#0A0A0A',
    borderColor: C.black,
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

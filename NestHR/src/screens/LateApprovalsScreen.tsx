import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ScrollView,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import {
  ChevronLeft,
  ChevronRight,
  AlertOctagon,
  Clock,
  Hourglass,
  BadgeCheck,
  CheckCircle2,
  Timer,
  XCircle,
} from 'lucide-react-native';
import { lateApprovalAPI } from '../api/api';
import { C } from '../theme';
import ExportButton from '../components/common/ExportButton';
import StatTile, { tileGrid } from '../components/common/StatTile';

const RESOLUTIONS: { key: string; label: string; color: string }[] = [
  { key: 'present', label: 'Present', color: C.success },
  { key: 'late', label: 'Late', color: C.warning },
  { key: 'half_day', label: 'Half Day', color: C.secondary },
  { key: 'absent', label: 'Absent', color: C.danger },
];
const LABEL: Record<string, string> = { present: 'Present', late: 'Late', half_day: 'Half Day', absent: 'Absent' };
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAY_ABBR = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Use LOCAL date so IST midnight stored as UTC doesn't shift the day
const localDate = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export default function LateApprovalsScreen() {
  const navigation = useNavigation<any>();
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const stripRef = useRef<ScrollView>(null);

  const load = useCallback(async () => {
    try {
      const res = await lateApprovalAPI.getAll({ month: String(month), year: String(year) });
      setItems(res?.data || []);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
    }
  }, [month, year]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );
  useEffect(() => setSelectedDate(null), [month, year]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const resolve = async (id: string, resolvedStatus: string) => {
    setResolvingId(id);
    try {
      await lateApprovalAPI.resolve(id, resolvedStatus);
      await load();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setResolvingId(null);
    }
  };

  const shiftMonth = (d: number) => {
    const dt = new Date(year, month - 1 + d, 1);
    setYear(dt.getFullYear());
    setMonth(dt.getMonth() + 1);
  };

  const prefix = `${year}-${String(month).padStart(2, '0')}`;
  const inMonth = items.filter(i => localDate(i.date).startsWith(prefix));
  const shown = selectedDate ? inMonth.filter(i => localDate(i.date) === selectedDate) : inMonth;
  const count = (f: (i: any) => boolean) => shown.filter(f).length;
  const dim = new Date(year, month, 0).getDate();
  const todayIso = localDate(now.toISOString());

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 4, marginRight: 4 }}>
          <ChevronLeft size={22} color={C.black} />
        </TouchableOpacity>
        <AlertOctagon size={20} color={C.primary} />
        <Text style={[styles.headerTitle, { flex: 1 }]}>Late Approvals</Text>
        <ExportButton
          name={`late_approvals_${prefix}`}
          label=""
          rows={shown}
          cols={[
            { header: 'Emp Code', value: (i: any) => i.employee?.employeeId },
            { header: 'Employee', value: (i: any) => `${i.employee?.firstName || ''} ${i.employee?.lastName || ''}`.trim() },
            { header: 'Designation', value: (i: any) => i.employee?.designation },
            { header: 'Salary', value: (i: any) => i.employee?.salary ?? '' },
            { header: 'Late Date', value: (i: any) => localDate(i.date) },
            { header: 'Minutes Late', value: (i: any) => i.minutesLate },
            { header: 'Reason', value: (i: any) => i.reason },
            { header: 'Status', value: (i: any) => (i.status === 'pending' ? 'Pending' : `Marked - ${LABEL[i.resolvedStatus] || ''}`) },
          ]}
        />
      </View>

      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={C.primary} />
        </View>
      ) : (
        <FlatList
          data={shown}
          keyExtractor={item => item._id}
          contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 32 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} />}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <View style={{ gap: 12, marginBottom: 4 }}>
              <View style={styles.monthRow}>
                <TouchableOpacity onPress={() => shiftMonth(-1)} style={styles.navBtn}>
                  <ChevronLeft size={16} color={C.black} />
                </TouchableOpacity>
                <Text style={styles.monthText}>
                  {MONTHS[month - 1]} {year}
                </Text>
                <TouchableOpacity onPress={() => shiftMonth(1)} style={styles.navBtn}>
                  <ChevronRight size={16} color={C.black} />
                </TouchableOpacity>
              </View>

              <ScrollView ref={stripRef} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                {Array.from({ length: dim }, (_, i) => i + 1).map(day => {
                  const date = new Date(year, month - 1, day);
                  const iso = `${prefix}-${String(day).padStart(2, '0')}`;
                  const sel = iso === selectedDate;
                  const dayItems = inMonth.filter(i => localDate(i.date) === iso);
                  const pending = dayItems.filter(i => i.status === 'pending').length;
                  const marked = dayItems.length - pending;
                  return (
                    <TouchableOpacity
                      key={iso}
                      onPress={() => setSelectedDate(sel ? null : iso)}
                      style={[styles.dayCell, sel && styles.dayCellSel, iso === todayIso && !sel && { backgroundColor: '#EFF6FF' }]}
                    >
                      <Text style={[styles.dayAbbr, sel && { color: C.white }]}>{DAY_ABBR[date.getDay()]}</Text>
                      <Text style={[styles.dayNum, sel && { color: C.white }]}>{day}</Text>
                      {pending > 0 ? (
                        <Text style={[styles.dayBadge, { color: sel ? '#FED7AA' : C.secondary }]}>{pending}P</Text>
                      ) : marked > 0 ? (
                        <Text style={[styles.dayBadge, { color: sel ? '#BBF7D0' : C.success }]}>{marked}M</Text>
                      ) : (
                        <Text style={[styles.dayBadge, { color: sel ? '#ffffff88' : '#D1D5DB' }]}>—</Text>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              <View style={tileGrid}>
                <StatTile label="Pending" value={count(i => i.status === 'pending')} icon={Hourglass} color={C.secondary} width="31.5%" />
                <StatTile label="Marked" value={count(i => i.status !== 'pending')} icon={BadgeCheck} color={C.primary} width="31.5%" />
                <StatTile label="Present" value={count(i => i.resolvedStatus === 'present')} icon={CheckCircle2} color={C.success} width="31.5%" />
                <StatTile label="Late" value={count(i => i.resolvedStatus === 'late')} icon={Clock} color="#EAB308" width="31.5%" />
                <StatTile label="Half Day" value={count(i => i.resolvedStatus === 'half_day')} icon={Timer} color="#A855F7" width="31.5%" />
                <StatTile label="Absent" value={count(i => i.resolvedStatus === 'absent')} icon={XCircle} color={C.danger} width="31.5%" />
              </View>
            </View>
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <AlertOctagon size={40} color="#D1D5DB" />
              <Text style={styles.emptyText}>No late approvals {selectedDate ? 'on this date' : 'this month'}</Text>
            </View>
          }
          renderItem={({ item }) => {
            const emp = item.employee as any;
            const pending = item.status === 'pending';
            return (
              <View style={styles.card}>
                <View style={styles.topRow}>
                  <Text style={styles.codeChip}>{emp?.employeeId || '—'}</Text>
                  <View
                    style={[
                      styles.statusTag,
                      pending
                        ? { borderColor: C.secondary, backgroundColor: C.secondary + '18' }
                        : { borderColor: C.success, backgroundColor: C.success + '18' },
                    ]}
                  >
                    <Text style={[styles.statusTagText, { color: pending ? C.secondary : C.success }]}>
                      {pending ? 'PENDING' : `MARKED · ${(LABEL[item.resolvedStatus] || '').toUpperCase()}`}
                    </Text>
                  </View>
                </View>
                <View style={styles.nameRow}>
                  {emp?.avatar ? (
                    <Image source={{ uri: emp.avatar }} style={styles.photo} />
                  ) : (
                    <View style={[styles.photo, styles.photoFallback]}>
                      <Text style={styles.photoText}>{emp?.firstName?.[0]}</Text>
                    </View>
                  )}
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={styles.empName}>{emp ? `${emp.firstName} ${emp.lastName}` : 'Unknown employee'}</Text>
                    <Text style={styles.empSub}>
                      {emp?.designation || '—'}
                      {emp?.salary ? ` · ₹${Number(emp.salary).toLocaleString('en-IN')}` : ''}
                    </Text>
                  </View>
                </View>
                <View style={styles.metaRow}>
                  <Text style={styles.metaChip}>{new Date(item.date).toLocaleDateString('en-IN')}</Text>
                  <Text style={[styles.metaChip, { backgroundColor: '#FEF3C7' }]}>{item.minutesLate} min late</Text>
                  {!!item.checkInTime && (
                    <Text style={styles.metaChip}>
                      In {new Date(item.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  )}
                </View>
                {!!item.reason && <Text style={styles.reason}>"{item.reason}"</Text>}

                <View style={styles.actionRow}>
                  {RESOLUTIONS.map(r => (
                    <TouchableOpacity
                      key={r.key}
                      style={[styles.actionBtn, { backgroundColor: r.color }, item.resolvedStatus === r.key && { opacity: 0.4 }]}
                      onPress={() => resolve(item._id, r.key)}
                      disabled={resolvingId === item._id || item.resolvedStatus === r.key}
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
  headerTitle: { fontSize: 20, fontWeight: '700', color: C.black },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { alignItems: 'center', paddingTop: 40, gap: 12 },
  emptyText: { fontSize: 14, fontWeight: '700', color: C.textMuted },
  monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  navBtn: { borderWidth: 2, borderColor: C.black, padding: 5, backgroundColor: C.white },
  monthText: { fontSize: 15, fontWeight: '800', color: C.black },
  dayCell: {
    width: 56,
    alignItems: 'center',
    paddingVertical: 8,
    borderWidth: 2,
    borderColor: C.black,
    backgroundColor: C.white,
  },
  dayCellSel: { backgroundColor: C.primary },
  dayAbbr: { fontSize: 10, fontWeight: '700', color: C.textMuted, textTransform: 'uppercase' },
  dayNum: { fontSize: 18, fontWeight: '800', color: C.black },
  dayBadge: { fontSize: 10, fontWeight: '800', marginTop: 2 },
  card: {
    backgroundColor: C.white,
    borderWidth: 2,
    borderRadius: 8,
    borderRightWidth: 5,
    borderBottomWidth: 5,
    borderRightColor: '#0A0A0A',
    borderBottomColor: '#0A0A0A',
    borderColor: C.black,
    padding: 14,
  },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  codeChip: {
    fontSize: 11,
    fontWeight: '800',
    color: C.primary,
    backgroundColor: C.primary + '18',
    borderWidth: 1.5,
    borderColor: C.primary,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  statusTag: { borderWidth: 2, paddingHorizontal: 6, paddingVertical: 2 },
  statusTagText: { fontSize: 10, fontWeight: '800' },
  nameRow: { flexDirection: 'row', alignItems: 'center' },
  photo: { width: 38, height: 38, borderRadius: 19, borderWidth: 2, borderColor: C.black },
  photoFallback: { backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center' },
  photoText: { color: C.white, fontWeight: '800' },
  empName: { fontSize: 15, fontWeight: '700', color: C.black },
  empSub: { fontSize: 12, color: C.textMuted, marginTop: 1 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  metaChip: {
    fontSize: 11,
    fontWeight: '700',
    color: C.black,
    backgroundColor: '#DBEAFE',
    borderWidth: 1.5,
    borderColor: C.black,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  reason: { fontSize: 12, color: C.textMuted, fontStyle: 'italic', marginTop: 8 },
  actionRow: { flexDirection: 'row', gap: 6, marginTop: 12 },
  actionBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    borderWidth: 2,
    borderColor: C.black,
  },
  actionBtnText: { color: C.white, fontSize: 11, fontWeight: '800', textTransform: 'uppercase' },
});

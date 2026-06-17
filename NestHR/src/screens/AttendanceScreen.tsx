import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Modal,
  ScrollView,
  Platform,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Clock,
  Search,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Calendar,
  LogIn,
  LogOut,
  X,
  Pencil,
} from 'lucide-react-native';
import { attendanceAPI, employeeAPI } from '../api/api';
import { useAuth } from '../contexts/AuthContext';
import { AttendanceRecord } from '../types/hrms';
import { C } from '../theme';

const STATUS_CONFIG: Record<string, { color: string; bg: string; icon: any }> =
  {
    present: { color: C.success, bg: '#F0FDF4', icon: CheckCircle2 },
    absent: { color: C.danger, bg: '#FEF2F2', icon: XCircle },
    late: { color: C.warning, bg: '#FFF7ED', icon: AlertCircle },
    half_day: { color: C.secondary, bg: '#FFF7ED', icon: AlertCircle },
    on_leave: { color: C.primary, bg: '#EFF6FF', icon: Calendar },
  };

function toDateStr(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function timeToISO(dateStr: string, timeStr: string): string | undefined {
  if (!timeStr) return undefined;
  return `${dateStr}T${timeStr}:00`;
}

function isoToTime(iso: string | undefined): string {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

export default function AttendanceScreen() {
  const { user } = useAuth();
  const isEmployee = user?.role === 'employee';
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState(toDateStr(new Date()));
  const [statusFilter, setStatusFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedEmpId, setSelectedEmpId] = useState('');
  const [editRecord, setEditRecord] = useState<AttendanceRecord | null>(null);
  const [form, setForm] = useState({
    status: 'present',
    checkIn: '',
    checkOut: '',
    notes: '',
  });

  const load = useCallback(
    async (showLoader = true) => {
      if (showLoader) {
        setLoading(true);
        setRecords([]);
      }
      try {
        const res = await attendanceAPI.getAll({ date: dateFilter });
        const all: AttendanceRecord[] = res.data || [];
        const forDate = all.filter(r => {
          const d = r.date ? r.date.split('T')[0] : '';
          return d === dateFilter;
        });
        setRecords(forDate);
      } catch (e: any) {
        Alert.alert('Error', e.message);
      } finally {
        setLoading(false);
      }
    },
    [dateFilter],
  );

  const loadEmps = useCallback(async () => {
    try {
      const res = await employeeAPI.getAll();
      setEmployees(res.data || []);
    } catch {}
  }, []);

  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => {
    loadEmps();
  }, [loadEmps]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load(false);
    setRefreshing(false);
  };

  const openNew = () => {
    setEditRecord(null);
    setSelectedEmpId('');
    setForm({ status: 'present', checkIn: '', checkOut: '', notes: '' });
    setShowModal(true);
  };

  const openEdit = (record: AttendanceRecord) => {
    setEditRecord(record);
    const emp = record.employee as any;
    setSelectedEmpId(emp?._id || '');
    setForm({
      status: record.status,
      checkIn: isoToTime(record.checkIn),
      checkOut: isoToTime(record.checkOut),
      notes: record.notes || '',
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditRecord(null);
  };

  const filtered = records.filter(r => {
    const emp = r.employee as any;
    const name = emp
      ? `${emp.firstName || ''} ${emp.lastName || ''}`.toLowerCase()
      : '';
    if (search && !name.includes(search.toLowerCase())) return false;
    if (statusFilter && r.status !== statusFilter) return false;
    return true;
  });

  const handleSave = async () => {
    setSaving(true);
    try {
      if (editRecord) {
        await attendanceAPI.update(editRecord._id, {
          status: form.status,
          checkIn: timeToISO(dateFilter, form.checkIn),
          checkOut: timeToISO(dateFilter, form.checkOut),
          notes: form.notes || undefined,
        });
      } else {
        if (!selectedEmpId) {
          Alert.alert('Validation', 'Please select an employee');
          setSaving(false);
          return;
        }
        await attendanceAPI.mark({
          employee: selectedEmpId,
          date: dateFilter,
          status: form.status,
          checkIn: timeToISO(dateFilter, form.checkIn),
          checkOut: timeToISO(dateFilter, form.checkOut),
          notes: form.notes || undefined,
        });
      }
      closeModal();
      await load();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setSaving(false);
    }
  };

  const shiftDate = (n: number) => {
    const d = new Date(dateFilter + 'T00:00:00');
    d.setDate(d.getDate() + n);
    setDateFilter(toDateStr(d));
  };

  const summary: Record<string, number> = {};
  Object.keys(STATUS_CONFIG).forEach(s => {
    summary[s] = 0;
  });
  records.forEach(r => {
    if (r.status in summary) summary[r.status]++;
  });

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Clock size={20} color={C.primary} />
          <Text style={styles.headerTitle}>Attendance</Text>
        </View>
        {!isEmployee && (
          <TouchableOpacity style={styles.addBtn} onPress={openNew}>
            <CheckCircle2 size={14} color={C.white} />
            <Text style={styles.addBtnText}>Mark</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.dateRow}>
        <TouchableOpacity
          onPress={() => shiftDate(-1)}
          style={styles.dateBtnArrow}
        >
          <Text style={styles.dateBtnArrowText}>‹</Text>
        </TouchableOpacity>
        <View style={styles.dateCurrent}>
          <Calendar size={13} color={C.primary} />
          <Text style={styles.dateCurrentText}>
            {new Date(dateFilter + 'T00:00:00').toLocaleDateString('en-IN', {
              weekday: 'short',
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            })}
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => shiftDate(1)}
          style={styles.dateBtnArrow}
        >
          <Text style={styles.dateBtnArrowText}>›</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.summaryBar}
        contentContainerStyle={styles.summaryContent}
      >
        {Object.entries(summary).map(([status, count]) => {
          const active = statusFilter === status;
          const cfg = STATUS_CONFIG[status];
          return (
            <TouchableOpacity
              key={status}
              style={[
                styles.summaryPill,
                {
                  backgroundColor: active ? cfg.color : cfg.bg,
                  borderColor: cfg.color,
                },
              ]}
              onPress={() => setStatusFilter(p => (p === status ? '' : status))}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.summaryCount,
                  { color: active ? C.white : cfg.color },
                ]}
              >
                {count}
              </Text>
              <Text
                style={[
                  styles.summaryStatus,
                  { color: active ? C.white : cfg.color },
                ]}
              >
                {status.replace('_', ' ')}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {!isEmployee && (
        <View style={styles.searchWrap}>
          <Search size={15} color={C.textMuted} />
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Search by employee…"
            placeholderTextColor={C.textLight}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <X size={14} color={C.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      )}

      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={C.primary} />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item._id}
          contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 32 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={C.primary}
            />
          }
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Clock size={40} color="#D1D5DB" />
              <Text style={styles.emptyText}>No records for this date</Text>
            </View>
          }
          renderItem={({ item }) => {
            const emp = item.employee as any;
            const cfg = STATUS_CONFIG[item.status] || {
              color: C.textMuted,
              bg: '#F3F4F6',
              icon: AlertCircle,
            };
            const Icon = cfg.icon;
            const ciTime = item.checkIn
              ? new Date(item.checkIn).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : null;
            const coTime = item.checkOut
              ? new Date(item.checkOut).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : null;
            const workHours = (item as any).workingHours;
            const overtime = (item as any).overtime;
            const initials = emp
              ? `${emp.firstName?.[0] || ''}${
                  emp.lastName?.[0] || ''
                }`.toUpperCase()
              : '?';
            return (
              <View
                style={[
                  styles.card,
                  { borderLeftColor: cfg.color, borderLeftWidth: 4 },
                ]}
              >
                <View style={styles.cardRow}>
                  <View style={styles.photoWrap}>
                    {emp?.avatar ? (
                      <Image
                        source={{ uri: emp.avatar }}
                        style={[styles.empPhoto, { borderColor: cfg.color }]}
                      />
                    ) : (
                      <View
                        style={[
                          styles.empPhoto,
                          styles.empPhotoFallback,
                          { backgroundColor: cfg.bg, borderColor: cfg.color },
                        ]}
                      >
                        <Text
                          style={[
                            styles.empPhotoInitials,
                            { color: cfg.color },
                          ]}
                        >
                          {initials}
                        </Text>
                      </View>
                    )}
                    <View
                      style={[
                        styles.statusBadgeOverlay,
                        { backgroundColor: cfg.bg, borderColor: cfg.color },
                      ]}
                    >
                      <Icon size={10} color={cfg.color} />
                    </View>
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.empName}>
                      {emp ? `${emp.firstName} ${emp.lastName}` : 'Unknown'}
                    </Text>
                    <Text style={styles.empSub}>
                      {emp?.employeeId || ''}
                      {emp?.designation ? ` · ${emp.designation}` : ''}
                    </Text>
                  </View>
                  <View style={styles.cardActions}>
                    <View
                      style={[
                        styles.statusTag,
                        { backgroundColor: cfg.bg, borderColor: cfg.color },
                      ]}
                    >
                      <Text
                        style={[styles.statusTagText, { color: cfg.color }]}
                      >
                        {item.status.replace('_', ' ').toUpperCase()}
                      </Text>
                    </View>
                    {!isEmployee && (
                      <TouchableOpacity
                        style={styles.editBtn}
                        onPress={() => openEdit(item)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Pencil size={14} color={C.primary} />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
                {(ciTime || coTime || workHours || overtime > 0) && (
                  <View style={styles.timeRow}>
                    {ciTime && (
                      <View style={styles.timePill}>
                        <LogIn size={11} color={C.success} />
                        <Text style={styles.timeText}>{ciTime}</Text>
                      </View>
                    )}
                    {coTime && (
                      <View style={styles.timePill}>
                        <LogOut size={11} color={C.danger} />
                        <Text style={styles.timeText}>{coTime}</Text>
                      </View>
                    )}
                    {workHours && (
                      <View style={styles.timePill}>
                        <Clock size={11} color={C.primary} />
                        <Text style={styles.timeText}>{workHours}h</Text>
                      </View>
                    )}
                    {overtime > 0 && (
                      <View
                        style={[styles.timePill, { borderColor: C.warning }]}
                      >
                        <Clock size={11} color={C.warning} />
                        <Text style={[styles.timeText, { color: C.warning }]}>
                          OT: {overtime}h
                        </Text>
                      </View>
                    )}
                    {(item as any).verifyMode &&
                      (item as any).verifyMode !== 'manual' && (
                        <View style={styles.verifyPill}>
                          <Text style={styles.verifyPillText}>
                            {(item as any).verifyMode.toUpperCase()}
                          </Text>
                        </View>
                      )}
                  </View>
                )}
                {item.notes && (
                  <Text style={styles.noteText}>{item.notes}</Text>
                )}
              </View>
            );
          }}
        />
      )}

      {!isEmployee && <Modal
        visible={showModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <SafeAreaView style={styles.safe} edges={['top']}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {editRecord ? 'Edit Attendance' : 'Mark Attendance'}
            </Text>
            <TouchableOpacity onPress={closeModal}>
              <X size={22} color={C.black} />
            </TouchableOpacity>
          </View>
          <ScrollView
            contentContainerStyle={{ padding: 20, gap: 16 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {editRecord ? (
              <View style={styles.editInfoBox}>
                <Text style={styles.editInfoLabel}>Employee</Text>
                <Text style={styles.editInfoValue}>
                  {(editRecord.employee as any)?.firstName}{' '}
                  {(editRecord.employee as any)?.lastName}
                </Text>
              </View>
            ) : (
              <View>
                <Text style={styles.fieldLabel}>Employee *</Text>
                <ScrollView style={{ maxHeight: 180 }} nestedScrollEnabled>
                  {employees.map(e => (
                    <TouchableOpacity
                      key={e._id}
                      style={[
                        styles.empOption,
                        selectedEmpId === e._id && styles.empOptionActive,
                      ]}
                      onPress={() => setSelectedEmpId(e._id)}
                    >
                      <Text
                        style={[
                          styles.empOptionName,
                          selectedEmpId === e._id && { color: C.white },
                        ]}
                      >
                        {e.firstName} {e.lastName}
                      </Text>
                      <Text
                        style={[
                          styles.empOptionId,
                          selectedEmpId === e._id && { color: '#93C5FD' },
                        ]}
                      >
                        {e.employeeId}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            <View>
              <Text style={styles.fieldLabel}>Status *</Text>
              <View
                style={{
                  flexDirection: 'row',
                  flexWrap: 'wrap',
                  gap: 8,
                  marginTop: 6,
                }}
              >
                {Object.keys(STATUS_CONFIG).map(s => (
                  <TouchableOpacity
                    key={s}
                    style={[
                      styles.selChip,
                      form.status === s && styles.selChipActive,
                    ]}
                    onPress={() => setForm(p => ({ ...p, status: s }))}
                  >
                    <Text
                      style={[
                        styles.selChipText,
                        form.status === s && { color: C.white },
                      ]}
                    >
                      {s.replace('_', ' ').toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>Check In</Text>
                <TextInput
                  style={styles.fieldInput}
                  value={form.checkIn}
                  onChangeText={v => setForm(p => ({ ...p, checkIn: v }))}
                  placeholder="09:00"
                  placeholderTextColor={C.textLight}
                  keyboardType="numeric"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>Check Out</Text>
                <TextInput
                  style={styles.fieldInput}
                  value={form.checkOut}
                  onChangeText={v => setForm(p => ({ ...p, checkOut: v }))}
                  placeholder="18:00"
                  placeholderTextColor={C.textLight}
                  keyboardType="numeric"
                />
              </View>
            </View>

            <View>
              <Text style={styles.fieldLabel}>Notes</Text>
              <TextInput
                style={[styles.fieldInput, { minHeight: 80 }]}
                value={form.notes}
                onChangeText={v => setForm(p => ({ ...p, notes: v }))}
                placeholder="Optional…"
                placeholderTextColor={C.textLight}
                multiline
              />
            </View>

            <TouchableOpacity
              style={styles.submitBtn}
              onPress={handleSave}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color={C.white} />
              ) : (
                <Text style={styles.submitBtnText}>
                  {editRecord ? 'Update Attendance' : 'Save Attendance'}
                </Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: C.white,
    borderBottomWidth: 2,
    borderBottomColor: C.black,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
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
  addBtnText: {
    color: C.white,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: C.white,
    borderBottomWidth: 2,
    borderBottomColor: C.black,
    paddingVertical: 10,
  },
  dateBtnArrow: { width: 44, alignItems: 'center' },
  dateBtnArrowText: { fontSize: 24, fontWeight: '700', color: C.black },
  dateCurrent: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dateCurrentText: { fontSize: 13, fontWeight: '700', color: C.black },
  summaryBar: {
    flexShrink: 0,
    backgroundColor: C.white,
    borderBottomWidth: 2,
    borderBottomColor: C.black,
  },
  summaryContent: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    gap: 8,
  },
  summaryPill: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 76,
  },
  summaryCount: {
    fontSize: 20,
    fontWeight: '800',
    lineHeight: Platform.OS === 'android' ? 28 : 24,
    includeFontPadding: false,
  } as any,
  summaryStatus: {
    fontSize: 8,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: C.white,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  searchInput: { flex: 1, fontSize: 14, fontWeight: '500', color: C.black },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyText: { fontSize: 14, fontWeight: '700', color: C.textMuted },
  card: {
    backgroundColor: C.white,
    borderWidth: 2,
    borderColor: C.black,
    padding: 14,
  },
  cardRow: { flexDirection: 'row', alignItems: 'center' },
  cardActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusIcon: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoWrap: { position: 'relative', width: 44, height: 44 },
  empPhoto: { width: 44, height: 44, borderRadius: 22, borderWidth: 2 },
  empPhotoFallback: { alignItems: 'center', justifyContent: 'center' },
  empPhotoInitials: { fontSize: 15, fontWeight: '700' },
  statusBadgeOverlay: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  verifyPill: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    paddingHorizontal: 6,
    paddingVertical: 6,
  },
  verifyPillText: {
    fontSize: 8,
    fontWeight: '700',
    color: C.textMuted,
    textTransform: 'uppercase',
  },
  empName: { fontSize: 15, fontWeight: '700', color: C.black },
  empSub: { fontSize: 11, color: C.textMuted, fontWeight: '500' },
  statusTag: { borderWidth: 2, paddingHorizontal: 8, paddingVertical: 3 },
  statusTagText: { fontSize: 9, fontWeight: '700' },
  editBtn: {
    borderWidth: 2,
    borderColor: C.primary,
    padding: 6,
    backgroundColor: '#EFF6FF',
  },
  timeRow: { flexDirection: 'row', gap: 8, marginTop: 10, flexWrap: 'wrap' },
  timePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  timeText: { fontSize: 12, fontWeight: '700', color: C.black },
  noteText: {
    fontSize: 12,
    color: C.textMuted,
    fontStyle: 'italic',
    marginTop: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: C.white,
    borderBottomWidth: 2,
    borderBottomColor: C.black,
  },
  modalTitle: { fontSize: 20, fontWeight: '700', color: C.black },
  editInfoBox: {
    borderWidth: 2,
    borderColor: C.primary,
    backgroundColor: '#EFF6FF',
    padding: 12,
  },
  editInfoLabel: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    color: C.primary,
    marginBottom: 4,
  },
  editInfoValue: { fontSize: 15, fontWeight: '700', color: C.black },
  fieldLabel: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    color: C.black,
    marginBottom: 5,
    letterSpacing: 0.5,
  },
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
  empOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 4,
    backgroundColor: C.white,
  },
  empOptionActive: { backgroundColor: C.primary, borderColor: C.primary },
  empOptionName: { fontSize: 13, fontWeight: '700', color: C.black },
  empOptionId: { fontSize: 11, color: C.textMuted },
  selChip: {
    borderWidth: 2,
    borderColor: C.black,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  selChipActive: { backgroundColor: C.primary },
  selChipText: { fontSize: 11, fontWeight: '700', color: C.black },
  submitBtn: {
    backgroundColor: C.primary,
    borderWidth: 2,
    borderColor: C.black,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  submitBtnText: {
    color: C.white,
    fontWeight: '700',
    fontSize: 14,
    textTransform: 'uppercase',
  },
});

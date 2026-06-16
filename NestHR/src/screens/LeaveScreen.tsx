import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Modal,
  ScrollView,
  TextInput,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Calendar,
  Plus,
  X,
  Check,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  User,
  ChevronDown,
} from 'lucide-react-native';
import { leaveAPI } from '../api/api';
import { LeaveRequest } from '../types/hrms';
import { C } from '../theme';

const STATUS_CONFIG: Record<string, { color: string; bg: string; icon: any }> =
  {
    pending: { color: C.warning, bg: '#FFF7ED', icon: Clock },
    approved: { color: C.success, bg: '#F0FDF4', icon: CheckCircle2 },
    rejected: { color: C.danger, bg: '#FEF2F2', icon: XCircle },
  };

const LEAVE_TYPES = [
  'annual',
  'sick',
  'casual',
  'maternity',
  'paternity',
  'unpaid',
  'other',
];

export default function LeaveScreen() {
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    leaveType: 'annual',
    startDate: '',
    endDate: '',
    reason: '',
  });

  const load = useCallback(async () => {
    try {
      const res = await leaveAPI.getAll();
      setLeaves(res.data || []);
    } catch (e: any) {
      Alert.alert('Error', e.message);
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

  const filtered = statusFilter
    ? leaves.filter(l => l.status === statusFilter)
    : leaves;

  const handleApply = async () => {
    if (!form.startDate || !form.endDate || !form.reason.trim()) {
      Alert.alert('Validation', 'Start date, end date and reason are required');
      return;
    }
    setSaving(true);
    try {
      await leaveAPI.create(form);
      setShowForm(false);
      setForm({ leaveType: 'annual', startDate: '', endDate: '', reason: '' });
      await load();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleAction = (
    leave: LeaveRequest,
    action: 'approved' | 'rejected',
  ) => {
    Alert.alert(
      `${action === 'approved' ? 'Approve' : 'Reject'} Leave`,
      `Are you sure?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: action === 'approved' ? 'Approve' : 'Reject',
          style: action === 'rejected' ? 'destructive' : 'default',
          onPress: async () => {
            try {
              await leaveAPI.updateStatus(leave._id, { status: action });
              await load();
            } catch (e: any) {
              Alert.alert('Error', e.message);
            }
          },
        },
      ],
    );
  };

  const counts = { pending: 0, approved: 0, rejected: 0 };
  leaves.forEach(l => {
    if (l.status in counts) (counts as any)[l.status]++;
  });

  const formatDate = (d: string) =>
    d
      ? new Date(d).toLocaleDateString('en-IN', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        })
      : '—';

  const daysBetween = (s: string, e: string) => {
    const ms = new Date(e).getTime() - new Date(s).getTime();
    return Math.round(ms / 86400000) + 1;
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Calendar size={20} color={C.primary} />
          <Text style={styles.headerTitle}>Leave Requests</Text>
        </View>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => setShowForm(true)}
        >
          <Plus size={14} color={C.white} />
          <Text style={styles.addBtnText}>Apply</Text>
        </TouchableOpacity>
      </View>

      {/* Summary row */}
      <View style={styles.summaryRow}>
        {[
          { key: 'pending', label: 'Pending', color: C.warning },
          { key: 'approved', label: 'Approved', color: C.success },
          { key: 'rejected', label: 'Rejected', color: C.danger },
        ].map(s => (
          <TouchableOpacity
            key={s.key}
            style={[
              styles.summaryCard,
              {
                borderColor: C.black,
                backgroundColor: statusFilter === s.key ? s.color : C.white,
              },
            ]}
            onPress={() => setStatusFilter(p => (p === s.key ? '' : s.key))}
          >
            <Text
              style={[
                styles.summaryVal,
                { color: statusFilter === s.key ? C.white : s.color },
              ]}
            >
              {(counts as any)[s.key]}
            </Text>
            <Text
              style={[
                styles.summaryLabel,
                { color: statusFilter === s.key ? C.white : C.textMuted },
              ]}
            >
              {s.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Filter chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterBar}
        contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}
      >
        {[
          { key: '', label: 'All' },
          ...LEAVE_TYPES.map(t => ({ key: t, label: t })),
        ].map(f => (
          <View key={f.key} style={styles.chip}>
            <Text style={styles.chipText}>{f.label.toUpperCase()}</Text>
          </View>
        ))}
      </ScrollView>

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
              <Calendar size={40} color="#D1D5DB" />
              <Text style={styles.emptyText}>No leave requests</Text>
            </View>
          }
          renderItem={({ item }) => {
            const cfg = STATUS_CONFIG[item.status] || {
              color: C.textMuted,
              bg: '#F3F4F6',
              icon: AlertCircle,
            };
            const Icon = cfg.icon;
            const emp = item.employee as any;
            const days =
              item.startDate && item.endDate
                ? daysBetween(item.startDate, item.endDate)
                : null;
            return (
              <View
                style={[
                  styles.card,
                  { borderLeftColor: cfg.color, borderLeftWidth: 4 },
                ]}
              >
                <View style={styles.cardTop}>
                  <View
                    style={[
                      styles.typeTag,
                      {
                        backgroundColor: C.primary + '15',
                        borderColor: C.primary,
                      },
                    ]}
                  >
                    <Text style={[styles.typeTagText, { color: C.primary }]}>
                      {item.leaveType?.replace('_', ' ').toUpperCase()}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.statusTag,
                      { backgroundColor: cfg.color, borderColor: C.black },
                    ]}
                  >
                    <Icon size={10} color={C.white} />
                    <Text style={[styles.statusTagText, { color: C.white }]}>
                      {item.status.toUpperCase()}
                    </Text>
                  </View>
                </View>

                {emp && (
                  <View style={styles.empRow}>
                    {emp.avatar ? (
                      <Image
                        source={{ uri: emp.avatar }}
                        style={styles.empPhoto}
                      />
                    ) : (
                      <View style={styles.empInitials}>
                        <Text style={styles.empInitialsText}>
                          {(emp.firstName?.[0] || '') + (emp.lastName?.[0] || '')}
                        </Text>
                      </View>
                    )}
                    <Text style={styles.empText}>
                      {emp.firstName} {emp.lastName}
                    </Text>
                    {emp.employeeId && (
                      <Text style={styles.empId}>{emp.employeeId}</Text>
                    )}
                  </View>
                )}

                <View style={styles.dateRow}>
                  <View style={styles.dateItem}>
                    <Text style={styles.dateLabel}>FROM</Text>
                    <Text style={styles.dateVal}>
                      {formatDate(item.startDate)}
                    </Text>
                  </View>
                  <View style={styles.dateSep}>
                    <Text style={styles.dateSepText}>→</Text>
                  </View>
                  <View style={styles.dateItem}>
                    <Text style={styles.dateLabel}>TO</Text>
                    <Text style={styles.dateVal}>
                      {formatDate(item.endDate)}
                    </Text>
                  </View>
                  {days && (
                    <View style={styles.daysTag}>
                      <Text style={styles.daysText}>{days}d</Text>
                    </View>
                  )}
                </View>

                {item.reason && (
                  <Text style={styles.reason} numberOfLines={2}>
                    {item.reason}
                  </Text>
                )}

                {item.status === 'pending' && (
                  <View style={styles.actionRow}>
                    <TouchableOpacity
                      style={styles.approveBtn}
                      onPress={() => handleAction(item, 'approved')}
                    >
                      <Check size={13} color={C.white} />
                      <Text style={styles.actionBtnText}>Approve</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.rejectBtn}
                      onPress={() => handleAction(item, 'rejected')}
                    >
                      <X size={13} color={C.white} />
                      <Text style={styles.actionBtnText}>Reject</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            );
          }}
        />
      )}

      {/* Apply Leave Modal */}
      <Modal
        visible={showForm}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <SafeAreaView style={styles.safe} edges={['top']}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Apply for Leave</Text>
            <TouchableOpacity onPress={() => setShowForm(false)}>
              <X size={22} color={C.black} />
            </TouchableOpacity>
          </View>
          <ScrollView
            contentContainerStyle={{ padding: 20, gap: 16 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View>
              <Text style={styles.fieldLabel}>Leave Type</Text>
              <View
                style={{
                  flexDirection: 'row',
                  flexWrap: 'wrap',
                  gap: 8,
                  marginTop: 6,
                }}
              >
                {LEAVE_TYPES.map(t => (
                  <TouchableOpacity
                    key={t}
                    style={[
                      styles.selChip,
                      form.leaveType === t && styles.selChipActive,
                    ]}
                    onPress={() => setForm(p => ({ ...p, leaveType: t }))}
                  >
                    <Text
                      style={[
                        styles.selChipText,
                        form.leaveType === t && { color: C.white },
                      ]}
                    >
                      {t.toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>Start Date *</Text>
                <TextInput
                  style={styles.fieldInput}
                  value={form.startDate}
                  onChangeText={v => setForm(p => ({ ...p, startDate: v }))}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={C.textLight}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>End Date *</Text>
                <TextInput
                  style={styles.fieldInput}
                  value={form.endDate}
                  onChangeText={v => setForm(p => ({ ...p, endDate: v }))}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={C.textLight}
                />
              </View>
            </View>
            <View>
              <Text style={styles.fieldLabel}>Reason *</Text>
              <TextInput
                style={[styles.fieldInput, { minHeight: 100 }]}
                value={form.reason}
                onChangeText={v => setForm(p => ({ ...p, reason: v }))}
                placeholder="Explain your reason…"
                placeholderTextColor={C.textLight}
                multiline
              />
            </View>
            <TouchableOpacity
              style={styles.submitBtn}
              onPress={handleApply}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color={C.white} />
              ) : (
                <Text style={styles.submitBtnText}>Submit Application</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>
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
  summaryRow: {
    flexDirection: 'row',
    backgroundColor: C.white,
    borderBottomWidth: 2,
    borderBottomColor: C.black,
    padding: 12,
    gap: 10,
  },
  summaryCard: {
    flex: 1,
    borderWidth: 2,
    paddingVertical: 10,
    alignItems: 'center',
  },
  summaryVal: { fontSize: 22, fontWeight: '700' },
  summaryLabel: {
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginTop: 2,
  },
  filterBar: {
    maxHeight: 48,
    backgroundColor: C.white,
    borderBottomWidth: 2,
    borderBottomColor: C.black,
    paddingVertical: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderWidth: 2,
    borderColor: C.black,
  },
  chipText: { fontSize: 10, fontWeight: '700', color: C.black },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyText: { fontSize: 14, fontWeight: '700', color: C.textMuted },
  card: {
    backgroundColor: C.white,
    borderWidth: 2,
    borderColor: C.black,
    padding: 14,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  typeTag: { borderWidth: 2, paddingHorizontal: 8, paddingVertical: 3 },
  typeTagText: { fontSize: 10, fontWeight: '700' },
  statusTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 2,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  statusTagText: { fontSize: 9, fontWeight: '700' },
  empRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  empPhoto: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: C.black,
  },
  empInitials: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: C.black,
    backgroundColor: C.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empInitialsText: { fontSize: 9, fontWeight: '700', color: C.white },
  empText: { fontSize: 13, fontWeight: '700', color: C.black },
  empId: { fontSize: 11, color: C.textMuted, fontFamily: 'monospace' },
  dateRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  dateItem: { flex: 1 },
  dateLabel: {
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
    color: C.textMuted,
  },
  dateVal: { fontSize: 13, fontWeight: '700', color: C.black, marginTop: 2 },
  dateSep: { width: 30, alignItems: 'center' },
  dateSepText: { fontSize: 16, color: C.textMuted },
  daysTag: {
    backgroundColor: C.primary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 2,
    borderColor: C.black,
  },
  daysText: { color: C.white, fontSize: 12, fontWeight: '700' },
  reason: {
    fontSize: 12,
    color: C.textMuted,
    fontStyle: 'italic',
    marginTop: 6,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  approveBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: C.success,
    borderWidth: 2,
    borderColor: C.black,
    paddingVertical: 8,
  },
  rejectBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: C.danger,
    borderWidth: 2,
    borderColor: C.black,
    paddingVertical: 8,
  },
  actionBtnText: {
    color: C.white,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
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

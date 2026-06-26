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
  Modal,
  ScrollView,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { DatePickerField } from '../components/common/DatePickerField';
import {
  LogOut,
  Plus,
  X,
  Pencil,
  Trash2,
  ChevronLeft,
  User,
  Calendar,
  CheckCircle2,
  Clock,
  Package,
  FileText,
  ChevronDown,
} from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { exitAPI, employeeAPI } from '../api/api';
import { useAuth } from '../contexts/AuthContext';
import { C } from '../theme';

const REASONS = [
  { value: 'personal', label: 'Personal' },
  { value: 'better_opportunity', label: 'Better Opportunity' },
  { value: 'relocation', label: 'Relocation' },
  { value: 'health', label: 'Health' },
  { value: 'retirement', label: 'Retirement' },
  { value: 'termination', label: 'Termination' },
  { value: 'contract_end', label: 'Contract End' },
  { value: 'other', label: 'Other' },
];

const STATUSES = [
  { value: 'pending', label: 'Pending', color: C.warning, bg: '#FFF7ED' },
  { value: 'notice_period', label: 'Notice Period', color: C.primary, bg: '#EFF6FF' },
  { value: 'cleared', label: 'Cleared', color: '#7C3AED', bg: '#F5F3FF' },
  { value: 'completed', label: 'Completed', color: C.success, bg: '#F0FDF4' },
];

const FNF_STATUSES = [
  { value: 'pending', label: 'Pending' },
  { value: 'calculated', label: 'Calculated' },
  { value: 'paid', label: 'Paid' },
];

const EMPTY_FORM = {
  employee: '',
  resignationDate: '',
  noticePeriodDays: '30',
  reason: 'personal',
  reasonDetails: '',
};

function statusCfg(status: string) {
  return STATUSES.find(s => s.value === status) || STATUSES[0];
}

function fmt(d?: string) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export default function ExitManagementScreen() {
  const navigation = useNavigation<any>();
  const { user } = useAuth();
  const isHR = user?.role !== 'employee';

  const [records, setRecords] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [selected, setSelected] = useState<any>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [form, setForm] = useState<any>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [showReasonPicker, setShowReasonPicker] = useState(false);
  const [showStatusPicker, setShowStatusPicker] = useState(false);
  const [editStatusVal, setEditStatusVal] = useState('');
  const [editFnfAmount, setEditFnfAmount] = useState('');
  const [editFnfStatus, setEditFnfStatus] = useState('pending');
  const [editInterviewDone, setEditInterviewDone] = useState(false);
  const [editAssetsReturned, setEditAssetsReturned] = useState(false);
  const [editExpLetter, setEditExpLetter] = useState(false);
  const [editNotes, setEditNotes] = useState('');
  const [editLastDay, setEditLastDay] = useState('');
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const load = useCallback(async () => {
    try {
      const params: Record<string, string> = {};
      if (statusFilter) params.status = statusFilter;
      const [exitRes, empRes] = await Promise.all([
        exitAPI.getAll(params),
        isHR ? employeeAPI.getAll() : Promise.resolve({ data: [] }),
      ]);
      setRecords(exitRes.data || []);
      setEmployees(empRes.data || []);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, isHR]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const handleCreate = async () => {
    if (!form.employee || !form.resignationDate) {
      Alert.alert('Validation', 'Employee and resignation date are required');
      return;
    }
    setSaving(true);
    try {
      await exitAPI.create({
        ...form,
        noticePeriodDays: Number(form.noticePeriodDays) || 30,
      });
      setShowCreate(false);
      setForm(EMPTY_FORM);
      load();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateStatus = async () => {
    if (!selected) return;
    setUpdatingStatus(true);
    try {
      await exitAPI.update(selected._id, {
        status: editStatusVal,
        lastWorkingDay: editLastDay || undefined,
        fnfAmount: Number(editFnfAmount) || 0,
        fnfStatus: editFnfStatus,
        exitInterviewDone: editInterviewDone,
        exitInterviewNotes: editNotes,
        assetsReturned: editAssetsReturned,
        experienceLetterIssued: editExpLetter,
      });
      setSelected(null);
      load();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleDelete = (id: string) => {
    Alert.alert('Delete Exit Record', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await exitAPI.delete(id);
            setRecords(prev => prev.filter(r => r._id !== id));
          } catch (e: any) {
            Alert.alert('Error', e.message);
          }
        },
      },
    ]);
  };

  const openDetail = (rec: any) => {
    setSelected(rec);
    setEditStatusVal(rec.status);
    setEditFnfAmount(String(rec.fnfAmount || ''));
    setEditFnfStatus(rec.fnfStatus || 'pending');
    setEditInterviewDone(rec.exitInterviewDone || false);
    setEditAssetsReturned(rec.assetsReturned || false);
    setEditExpLetter(rec.experienceLetterIssued || false);
    setEditNotes(rec.exitInterviewNotes || '');
    setEditLastDay(rec.lastWorkingDay ? rec.lastWorkingDay.split('T')[0] : '');
  };

  const renderRecord = ({ item }: { item: any }) => {
    const cfg = statusCfg(item.status);
    const emp = item.employee;
    return (
      <TouchableOpacity style={s.card} onPress={() => openDetail(item)} activeOpacity={0.8}>
        <View style={s.cardHeader}>
          <View style={s.empIcon}>
            <User size={16} color={C.primary} />
          </View>
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={s.empName}>
              {emp ? `${emp.firstName} ${emp.lastName}` : '—'}
            </Text>
            <Text style={s.empSub}>
              {emp?.designation || ''} {emp?.department?.name ? `· ${emp.department.name}` : ''}
            </Text>
          </View>
          <View style={[s.badge, { backgroundColor: cfg.bg, borderColor: cfg.color }]}>
            <Text style={[s.badgeText, { color: cfg.color }]}>
              {cfg.label.toUpperCase()}
            </Text>
          </View>
        </View>

        <View style={s.cardBody}>
          <View style={s.infoRow}>
            <Calendar size={12} color="#6B7280" />
            <Text style={s.infoText}>Resignation: {fmt(item.resignationDate)}</Text>
          </View>
          {item.lastWorkingDay && (
            <View style={s.infoRow}>
              <Clock size={12} color="#6B7280" />
              <Text style={s.infoText}>Last Day: {fmt(item.lastWorkingDay)}</Text>
            </View>
          )}
          <View style={s.infoRow}>
            <FileText size={12} color="#6B7280" />
            <Text style={s.infoText}>
              Reason: {REASONS.find(r => r.value === item.reason)?.label || item.reason}
            </Text>
          </View>
        </View>

        <View style={s.cardFooter}>
          <View style={s.checksRow}>
            <CheckItem label="Interview" done={item.exitInterviewDone} />
            <CheckItem label="Assets" done={item.assetsReturned} />
            <CheckItem label="Exp Letter" done={item.experienceLetterIssued} />
          </View>
          {isHR && (
            <TouchableOpacity
              style={s.deleteBtn}
              onPress={() => handleDelete(item._id)}
            >
              <Trash2 size={14} color={C.danger} />
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 4, marginRight: 4 }}>
          <ChevronLeft size={22} color={C.black} />
        </TouchableOpacity>
        <LogOut size={20} color={C.primary} />
        <Text style={s.title}>Exit Management</Text>
        <View style={{ flex: 1 }} />
        {isHR && (
          <TouchableOpacity style={s.addBtn} onPress={() => { setForm(EMPTY_FORM); setShowCreate(true); }}>
            <Plus size={14} color={C.white} />
            <Text style={s.addBtnText}>New</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Status Filter */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filterBar} contentContainerStyle={{ padding: 12, gap: 8 }}>
        {[{ value: '', label: 'All' }, ...STATUSES].map(st => (
          <TouchableOpacity
            key={st.value}
            style={[s.filterChip, statusFilter === st.value && s.filterChipActive]}
            onPress={() => setStatusFilter(st.value)}
          >
            <Text style={[s.filterChipText, statusFilter === st.value && s.filterChipTextActive]}>
              {st.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? (
        <View style={s.loader}><ActivityIndicator size="large" color={C.primary} /></View>
      ) : (
        <FlatList
          data={records}
          keyExtractor={i => i._id}
          renderItem={renderRecord}
          contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} />}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={s.empty}>
              <LogOut size={40} color="#D1D5DB" />
              <Text style={s.emptyText}>No exit records found</Text>
            </View>
          }
        />
      )}

      {/* Create Modal */}
      <Modal visible={showCreate} animationType="slide" presentationStyle="formSheet">
        <SafeAreaView style={s.safe} edges={['top']}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>Initiate Exit</Text>
            <TouchableOpacity onPress={() => setShowCreate(false)}>
              <X size={22} color={C.black} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }} keyboardShouldPersistTaps="handled">
            <View>
              <Text style={s.label}>Employee *</Text>
              <View style={s.picker}>
                {employees.length === 0 ? (
                  <Text style={s.pickerPlaceholder}>No employees loaded</Text>
                ) : (
                  <ScrollView style={{ maxHeight: 160 }}>
                    {employees.map(e => (
                      <TouchableOpacity
                        key={e._id}
                        style={[s.pickerOption, form.employee === e._id && s.pickerOptionActive]}
                        onPress={() => setForm((p: any) => ({ ...p, employee: e._id }))}
                      >
                        <Text style={[s.pickerOptionText, form.employee === e._id && { color: C.primary }]}>
                          {e.firstName} {e.lastName} ({e.employeeId || e._id.slice(-4)})
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                )}
              </View>
            </View>

            <DatePickerField
              label="Resignation Date *"
              value={form.resignationDate}
              onChange={v => setForm((p: any) => ({ ...p, resignationDate: v }))}
            />

            <View>
              <Text style={s.label}>Notice Period (days)</Text>
              <TextInput
                style={s.input}
                value={form.noticePeriodDays}
                onChangeText={v => setForm((p: any) => ({ ...p, noticePeriodDays: v }))}
                keyboardType="numeric"
                placeholder="30"
                placeholderTextColor="#9CA3AF"
              />
            </View>

            <View>
              <Text style={s.label}>Reason *</Text>
              <TouchableOpacity style={s.selectBtn} onPress={() => setShowReasonPicker(true)}>
                <Text style={s.selectBtnText}>
                  {REASONS.find(r => r.value === form.reason)?.label || 'Select reason'}
                </Text>
                <ChevronDown size={16} color={C.black} />
              </TouchableOpacity>
            </View>

            <View>
              <Text style={s.label}>Reason Details</Text>
              <TextInput
                style={[s.input, { minHeight: 70, textAlignVertical: 'top' }]}
                value={form.reasonDetails}
                onChangeText={v => setForm((p: any) => ({ ...p, reasonDetails: v }))}
                multiline
                placeholder="Additional details..."
                placeholderTextColor="#9CA3AF"
              />
            </View>

            <TouchableOpacity style={s.submitBtn} onPress={handleCreate} disabled={saving}>
              {saving ? <ActivityIndicator color={C.white} /> : <Text style={s.submitBtnText}>Initiate Exit Process</Text>}
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Reason Picker Modal */}
      <Modal visible={showReasonPicker} animationType="slide" transparent>
        <View style={s.pickerOverlay}>
          <View style={s.pickerSheet}>
            <View style={s.pickerSheetHeader}>
              <Text style={s.pickerSheetTitle}>Select Reason</Text>
              <TouchableOpacity onPress={() => setShowReasonPicker(false)}><X size={20} color={C.black} /></TouchableOpacity>
            </View>
            {REASONS.map(r => (
              <TouchableOpacity
                key={r.value}
                style={[s.sheetOption, form.reason === r.value && s.sheetOptionActive]}
                onPress={() => { setForm((p: any) => ({ ...p, reason: r.value })); setShowReasonPicker(false); }}
              >
                <Text style={[s.sheetOptionText, form.reason === r.value && { color: C.primary }]}>{r.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>

      {/* Detail / Update Modal */}
      <Modal visible={!!selected} animationType="slide" presentationStyle="formSheet">
        {selected && (
          <SafeAreaView style={s.safe} edges={['top']}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>
                {selected.employee ? `${selected.employee.firstName} ${selected.employee.lastName}` : 'Exit Record'}
              </Text>
              <TouchableOpacity onPress={() => setSelected(null)}><X size={22} color={C.black} /></TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }} keyboardShouldPersistTaps="handled">

              {/* Status update */}
              {isHR && (
                <>
                  <View>
                    <Text style={s.label}>Status</Text>
                    <TouchableOpacity style={s.selectBtn} onPress={() => setShowStatusPicker(true)}>
                      <Text style={s.selectBtnText}>
                        {STATUSES.find(s2 => s2.value === editStatusVal)?.label || editStatusVal}
                      </Text>
                      <ChevronDown size={16} color={C.black} />
                    </TouchableOpacity>
                  </View>

                  <DatePickerField
                    label="Last Working Day"
                    value={editLastDay}
                    onChange={setEditLastDay}
                  />

                  <View>
                    <Text style={s.label}>FnF Amount (₹)</Text>
                    <TextInput
                      style={s.input}
                      value={editFnfAmount}
                      onChangeText={setEditFnfAmount}
                      keyboardType="numeric"
                      placeholder="0"
                      placeholderTextColor="#9CA3AF"
                    />
                  </View>

                  <View>
                    <Text style={s.label}>FnF Status</Text>
                    <View style={s.toggleRow}>
                      {FNF_STATUSES.map(fs => (
                        <TouchableOpacity
                          key={fs.value}
                          style={[s.toggleBtn, editFnfStatus === fs.value && s.toggleBtnActive]}
                          onPress={() => setEditFnfStatus(fs.value)}
                        >
                          <Text style={[s.toggleBtnText, editFnfStatus === fs.value && { color: C.white }]}>
                            {fs.label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  <View style={s.checkRow}>
                    <TouchableOpacity onPress={() => setEditInterviewDone(p => !p)} style={s.checkbox}>
                      {editInterviewDone && <CheckCircle2 size={18} color={C.success} />}
                      {!editInterviewDone && <View style={s.checkboxEmpty} />}
                    </TouchableOpacity>
                    <Text style={s.checkLabel}>Exit Interview Done</Text>
                  </View>

                  <View style={s.checkRow}>
                    <TouchableOpacity onPress={() => setEditAssetsReturned(p => !p)} style={s.checkbox}>
                      {editAssetsReturned && <CheckCircle2 size={18} color={C.success} />}
                      {!editAssetsReturned && <View style={s.checkboxEmpty} />}
                    </TouchableOpacity>
                    <Text style={s.checkLabel}>Assets Returned</Text>
                  </View>

                  <View style={s.checkRow}>
                    <TouchableOpacity onPress={() => setEditExpLetter(p => !p)} style={s.checkbox}>
                      {editExpLetter && <CheckCircle2 size={18} color={C.success} />}
                      {!editExpLetter && <View style={s.checkboxEmpty} />}
                    </TouchableOpacity>
                    <Text style={s.checkLabel}>Experience Letter Issued</Text>
                  </View>

                  <View>
                    <Text style={s.label}>Exit Interview Notes</Text>
                    <TextInput
                      style={[s.input, { minHeight: 70, textAlignVertical: 'top' }]}
                      value={editNotes}
                      onChangeText={setEditNotes}
                      multiline
                      placeholder="Notes from exit interview..."
                      placeholderTextColor="#9CA3AF"
                    />
                  </View>

                  <TouchableOpacity style={s.submitBtn} onPress={handleUpdateStatus} disabled={updatingStatus}>
                    {updatingStatus ? <ActivityIndicator color={C.white} /> : <Text style={s.submitBtnText}>Update Exit Record</Text>}
                  </TouchableOpacity>
                </>
              )}

              {/* Read-only info for non-HR */}
              {!isHR && (
                <>
                  <InfoRow label="Resignation Date" value={fmt(selected.resignationDate)} />
                  <InfoRow label="Last Working Day" value={fmt(selected.lastWorkingDay)} />
                  <InfoRow label="Notice Period" value={`${selected.noticePeriodDays} days`} />
                  <InfoRow label="Reason" value={REASONS.find(r => r.value === selected.reason)?.label || selected.reason} />
                  <InfoRow label="Status" value={statusCfg(selected.status).label} />
                  <InfoRow label="FnF Amount" value={`₹${(selected.fnfAmount || 0).toLocaleString('en-IN')}`} />
                  <InfoRow label="FnF Status" value={selected.fnfStatus || '—'} />
                </>
              )}
            </ScrollView>
          </SafeAreaView>
        )}
      </Modal>

      {/* Status Picker Modal */}
      <Modal visible={showStatusPicker} animationType="slide" transparent>
        <View style={s.pickerOverlay}>
          <View style={s.pickerSheet}>
            <View style={s.pickerSheetHeader}>
              <Text style={s.pickerSheetTitle}>Update Status</Text>
              <TouchableOpacity onPress={() => setShowStatusPicker(false)}><X size={20} color={C.black} /></TouchableOpacity>
            </View>
            {STATUSES.map(st => (
              <TouchableOpacity
                key={st.value}
                style={[s.sheetOption, editStatusVal === st.value && s.sheetOptionActive]}
                onPress={() => { setEditStatusVal(st.value); setShowStatusPicker(false); }}
              >
                <Text style={[s.sheetOptionText, editStatusVal === st.value && { color: C.primary }]}>{st.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function CheckItem({ label, done }: { label: string; done: boolean }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <CheckCircle2 size={12} color={done ? C.success : '#D1D5DB'} />
      <Text style={{ fontSize: 10, color: done ? C.success : '#9CA3AF', fontWeight: '600' }}>{label}</Text>
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ marginBottom: 8 }}>
      <Text style={{ fontSize: 11, fontWeight: '700', textTransform: 'uppercase', color: '#6B7280', letterSpacing: 0.5 }}>{label}</Text>
      <Text style={{ fontSize: 14, fontWeight: '600', color: C.black, marginTop: 2 }}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
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
  title: { fontSize: 20, fontWeight: '700', color: C.black },
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
  addBtnText: { color: C.white, fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
  filterBar: { backgroundColor: C.white, borderBottomWidth: 1, borderBottomColor: '#E5E7EB', maxHeight: 56 },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    backgroundColor: C.white,
  },
  filterChipActive: { borderColor: C.primary, backgroundColor: '#EFF6FF' },
  filterChipText: { fontSize: 12, fontWeight: '700', color: '#6B7280', textTransform: 'uppercase' },
  filterChipTextActive: { color: C.primary },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { alignItems: 'center', paddingTop: 60, gap: 8 },
  emptyText: { fontSize: 14, fontWeight: '700', color: '#9CA3AF' },
  card: {
    backgroundColor: C.white,
    borderWidth: 2,
    borderColor: C.black,
    padding: 14,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 },
  empIcon: {
    width: 36,
    height: 36,
    backgroundColor: '#EFF6FF',
    borderWidth: 2,
    borderColor: C.black,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empName: { fontSize: 14, fontWeight: '700', color: C.black },
  empSub: { fontSize: 11, color: '#6B7280', fontWeight: '500', marginTop: 2 },
  badge: { borderWidth: 2, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  cardBody: { gap: 4, marginBottom: 10 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  infoText: { fontSize: 12, color: '#6B7280', fontWeight: '500' },
  cardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#F3F4F6', paddingTop: 10 },
  checksRow: { flexDirection: 'row', gap: 12 },
  deleteBtn: { width: 32, height: 32, borderWidth: 2, borderColor: C.danger, alignItems: 'center', justifyContent: 'center' },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: C.white,
    borderBottomWidth: 2,
    borderBottomColor: C.black,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: C.black },
  label: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', color: C.black, marginBottom: 6, letterSpacing: 0.5 },
  input: {
    borderWidth: 2,
    borderColor: C.black,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 14,
    fontWeight: '500',
    color: C.black,
    backgroundColor: C.white,
  },
  picker: { borderWidth: 2, borderColor: C.black, backgroundColor: C.white },
  pickerPlaceholder: { padding: 12, color: '#9CA3AF', fontSize: 14 },
  pickerOption: { paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  pickerOptionActive: { backgroundColor: '#EFF6FF' },
  pickerOptionText: { fontSize: 14, fontWeight: '500', color: C.black },
  selectBtn: {
    borderWidth: 2,
    borderColor: C.black,
    paddingHorizontal: 12,
    paddingVertical: 11,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: C.white,
  },
  selectBtnText: { fontSize: 14, fontWeight: '500', color: C.black },
  submitBtn: {
    backgroundColor: C.primary,
    borderWidth: 2,
    borderColor: C.black,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  submitBtnText: { color: C.white, fontWeight: '700', fontSize: 14, textTransform: 'uppercase' },
  pickerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  pickerSheet: { backgroundColor: C.white, borderTopWidth: 2, borderTopColor: C.black },
  pickerSheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 2, borderBottomColor: C.black },
  pickerSheetTitle: { fontSize: 16, fontWeight: '700', color: C.black },
  sheetOption: { paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  sheetOptionActive: { backgroundColor: '#EFF6FF' },
  sheetOptionText: { fontSize: 15, fontWeight: '600', color: C.black },
  toggleRow: { flexDirection: 'row', gap: 8 },
  toggleBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: C.black,
    backgroundColor: C.white,
  },
  toggleBtnActive: { backgroundColor: C.primary },
  toggleBtnText: { fontSize: 12, fontWeight: '700', color: C.black, textTransform: 'uppercase' },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  checkbox: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  checkboxEmpty: { width: 18, height: 18, borderWidth: 2, borderColor: '#D1D5DB' },
  checkLabel: { fontSize: 14, fontWeight: '600', color: C.black },
});

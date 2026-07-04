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
  CreditCard,
  Plus,
  X,
  Check,
  Clock,
  CheckCircle2,
  XCircle,
  ChevronLeft,
} from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { loanAPI, employeeAPI } from '../api/api';
import { useAuth } from '../contexts/AuthContext';
import { C } from '../theme';

const STATUS_CONFIG: Record<string, { color: string; bg: string; icon: any }> =
  {
    pending: { color: C.warning, bg: '#FFF7ED', icon: Clock },
    active: { color: C.primary, bg: '#EFF6FF', icon: CreditCard },
    rejected: { color: C.danger, bg: '#FEF2F2', icon: XCircle },
    cleared: { color: C.textMuted, bg: '#F3F4F6', icon: CheckCircle2 },
    paused: { color: C.warning, bg: '#FFF7ED', icon: Clock },
  };

const LOAN_TYPES = ['loan', 'advance'];

const EMPTY_FORM = {
  type: 'loan',
  amount: '',
  tenureMonths: '',
  reason: '',
};

export default function LoansScreen() {
  const navigation = useNavigation<any>();
  const { user } = useAuth();
  const isEmployee = user?.role === 'employee';
  const [loans, setLoans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [employees, setEmployees] = useState<any[]>([]);
  const [selectedEmpId, setSelectedEmpId] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await loanAPI.getAll();
      setLoans(res.data || []);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadEmployees = useCallback(async () => {
    try {
      const res = await employeeAPI.getAll();
      setEmployees(res.data || []);
    } catch {}
  }, []);

  useEffect(() => {
    load();
    if (!isEmployee) loadEmployees();
  }, [load, loadEmployees, isEmployee]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const filtered = statusFilter
    ? loans.filter(l => l.status === statusFilter)
    : loans;

  const handleGiveLoan = async () => {
    if (!isEmployee && !selectedEmpId) {
      Alert.alert('Validation', 'Please select an employee');
      return;
    }
    if (!form.amount || !form.reason.trim()) {
      Alert.alert('Validation', 'Amount and reason are required');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        type: form.type,
        amount: parseFloat(form.amount),
        tenureMonths: form.tenureMonths ? parseInt(form.tenureMonths) : 0,
        reason: form.reason.trim(),
      };
      if (isEmployee) {
        await loanAPI.request(payload);
      } else {
        await loanAPI.create({
          ...payload,
          employee: selectedEmpId,
          remainingBalance: payload.amount,
        });
      }
      setShowForm(false);
      setForm(EMPTY_FORM);
      setSelectedEmpId('');
      await load();
      if (isEmployee) {
        Alert.alert('Submitted', 'Your request has been sent for approval.');
      }
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleAction = (loan: any, action: 'approved' | 'rejected') => {
    Alert.alert(
      `${action === 'approved' ? 'Approve' : 'Reject'} Request`,
      'Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: action === 'approved' ? 'Approve' : 'Reject',
          style: action === 'rejected' ? 'destructive' : 'default',
          onPress: async () => {
            try {
              await loanAPI.updateStatus(loan._id, { status: action });
              await load();
            } catch (e: any) {
              Alert.alert('Error', e.message);
            }
          },
        },
      ],
    );
  };

  const totalActive = loans
    .filter(l => l.status === 'active')
    .reduce((s, l) => s + (l.amount || 0), 0);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={{ padding: 4, marginRight: 4 }}
          >
            <ChevronLeft size={22} color={C.black} />
          </TouchableOpacity>
          <CreditCard size={20} color={C.primary} />
          <Text style={styles.headerTitle}>
            {isEmployee ? 'My Loans' : 'Loans'}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => {
            setForm(EMPTY_FORM);
            setSelectedEmpId('');
            setShowForm(true);
          }}
        >
          <Plus size={14} color={C.white} />
          <Text style={styles.addBtnText}>
            {isEmployee ? 'Request' : 'Give Loan'}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.summaryRow}>
        {[
          { label: 'Total', val: loans.length, color: C.black },
          {
            label: 'Active',
            val: loans.filter(l => l.status === 'active').length,
            color: C.primary,
          },
          {
            label: 'Pending',
            val: loans.filter(l => l.status === 'pending').length,
            color: C.warning,
          },
        ].map(s => (
          <View key={s.label} style={styles.summaryCard}>
            <Text style={[styles.summaryVal, { color: s.color }]}>{s.val}</Text>
            <Text style={styles.summaryLabel}>{s.label}</Text>
          </View>
        ))}
      </View>

      {totalActive > 0 && (
        <View style={styles.activeBanner}>
          <CreditCard size={14} color={C.primary} />
          <Text style={styles.activeBannerText}>
            Active portfolio: ₹{(totalActive / 1000).toFixed(1)}K
          </Text>
        </View>
      )}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterBar}
        contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}
      >
        {[
          { key: '', label: 'All' },
          ...Object.keys(STATUS_CONFIG).map(k => ({ key: k, label: k })),
        ].map(f => (
          <TouchableOpacity
            key={f.key}
            style={[styles.chip, statusFilter === f.key && styles.chipActive]}
            onPress={() => setStatusFilter(f.key)}
          >
            <Text
              style={[
                styles.chipText,
                statusFilter === f.key && { color: C.white },
              ]}
            >
              {f.label.toUpperCase()}
            </Text>
          </TouchableOpacity>
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
              <CreditCard size={40} color="#D1D5DB" />
              <Text style={styles.emptyText}>No loan records</Text>
            </View>
          }
          renderItem={({ item }) => {
            const cfg = STATUS_CONFIG[item.status] || {
              color: C.textMuted,
              bg: '#F3F4F6',
              icon: Clock,
            };
            const emp = item.employee as any;
            const monthlyEmi = item.monthlyEmi || null;
            return (
              <View style={styles.card}>
                <View style={styles.cardTop}>
                  {emp?.avatar ? (
                    <Image
                      source={{ uri: emp.avatar }}
                      style={styles.empPhoto}
                    />
                  ) : (
                    <View style={styles.empInitials}>
                      <Text style={styles.empInitialsText}>
                        {emp
                          ? `${(emp.firstName || '')[0] || ''}${(emp.lastName || '')[0] || ''}`
                          : '?'}
                      </Text>
                    </View>
                  )}
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.loanType}>
                      {item.type === 'advance' ? 'SALARY ADVANCE' : 'LOAN'}
                    </Text>
                    {emp && !isEmployee && (
                      <Text style={styles.empName}>
                        {emp.firstName} {emp.lastName}
                      </Text>
                    )}
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.amount}>
                      ₹{(item.amount || 0).toLocaleString()}
                    </Text>
                    <View
                      style={[
                        styles.statusTag,
                        { backgroundColor: cfg.color, borderColor: C.black },
                      ]}
                    >
                      <Text style={[styles.statusTagText, { color: C.white }]}>
                        {item.status?.toUpperCase()}
                      </Text>
                    </View>
                  </View>
                </View>
                <View style={styles.detailRow}>
                  {item.tenureMonths ? (
                    <Text style={styles.detail}>
                      Tenure: {item.tenureMonths}mo
                    </Text>
                  ) : null}
                  {monthlyEmi ? (
                    <Text style={styles.detail}>EMI: ₹{monthlyEmi}</Text>
                  ) : null}
                  {item.remainingBalance != null && item.status === 'active' && (
                    <Text style={styles.detail}>
                      Balance: ₹{item.remainingBalance.toLocaleString()}
                    </Text>
                  )}
                </View>
                {item.reason && (
                  <Text style={styles.purpose} numberOfLines={1}>
                    {item.reason}
                  </Text>
                )}
                {item.status === 'rejected' && item.rejectionReason && (
                  <Text style={[styles.purpose, { color: C.danger }]} numberOfLines={2}>
                    Reason: {item.rejectionReason}
                  </Text>
                )}
                {!isEmployee && item.status === 'pending' && (
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

      <Modal
        visible={showForm}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <SafeAreaView style={styles.safe} edges={['top']}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {isEmployee ? 'Request Loan / Advance' : 'Give Loan to Staff'}
            </Text>
            <TouchableOpacity onPress={() => setShowForm(false)}>
              <X size={22} color={C.black} />
            </TouchableOpacity>
          </View>
          <ScrollView
            contentContainerStyle={{ padding: 20, gap: 16 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {!isEmployee && (
            <View>
              <Text style={styles.fieldLabel}>Employee *</Text>
              <View style={styles.empPicker}>
                {employees.map(e => {
                  const isSelected = selectedEmpId === e._id;
                  return (
                    <TouchableOpacity
                      key={e._id}
                      style={[
                        styles.empPickerRow,
                        isSelected && styles.empPickerRowActive,
                      ]}
                      onPress={() => setSelectedEmpId(e._id)}
                    >
                      {e.avatar ? (
                        <Image
                          source={{ uri: e.avatar }}
                          style={styles.empPickerPhoto}
                        />
                      ) : (
                        <View style={styles.empPickerInitials}>
                          <Text style={styles.empPickerInitialsText}>
                            {`${(e.firstName || '')[0] || ''}${(e.lastName || '')[0] || ''}`}
                          </Text>
                        </View>
                      )}
                      <View style={{ flex: 1 }}>
                        <Text
                          style={[
                            styles.empPickerName,
                            isSelected && { color: C.white },
                          ]}
                        >
                          {e.firstName} {e.lastName}
                        </Text>
                        {e.employeeId && (
                          <Text
                            style={[
                              styles.empPickerSub,
                              isSelected && { color: C.white + 'CC' },
                            ]}
                          >
                            {e.employeeId}
                          </Text>
                        )}
                      </View>
                      {isSelected && <Check size={14} color={C.white} />}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
            )}
            <View>
              <Text style={styles.fieldLabel}>Type</Text>
              <View
                style={{
                  flexDirection: 'row',
                  flexWrap: 'wrap',
                  gap: 8,
                  marginTop: 6,
                }}
              >
                {LOAN_TYPES.map(t => (
                  <TouchableOpacity
                    key={t}
                    style={[
                      styles.selChip,
                      form.type === t && styles.selChipActive,
                    ]}
                    onPress={() => setForm(p => ({ ...p, type: t }))}
                  >
                    <Text
                      style={[
                        styles.selChipText,
                        form.type === t && { color: C.white },
                      ]}
                    >
                      {t === 'advance' ? 'SALARY ADVANCE' : 'LOAN'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            <View>
              <Text style={styles.fieldLabel}>Amount (₹) *</Text>
              <TextInput
                style={styles.fieldInput}
                value={form.amount}
                onChangeText={v => setForm(p => ({ ...p, amount: v }))}
                placeholder="100000"
                placeholderTextColor={C.textLight}
                keyboardType="numeric"
              />
            </View>
            <View>
              <Text style={styles.fieldLabel}>
                How many months to repay? (Tenure)
              </Text>
              <TextInput
                style={styles.fieldInput}
                value={form.tenureMonths}
                onChangeText={v => setForm(p => ({ ...p, tenureMonths: v }))}
                placeholder="e.g. 6"
                placeholderTextColor={C.textLight}
                keyboardType="numeric"
              />
            </View>
            <View>
              <Text style={styles.fieldLabel}>Reason *</Text>
              <TextInput
                style={[styles.fieldInput, { minHeight: 80 }]}
                value={form.reason}
                onChangeText={v => setForm(p => ({ ...p, reason: v }))}
                placeholder="Reason for loan / advance…"
                placeholderTextColor={C.textLight}
                multiline
              />
            </View>
            <TouchableOpacity
              style={styles.submitBtn}
              onPress={handleGiveLoan}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color={C.white} />
              ) : (
                <Text style={styles.submitBtnText}>
                  {isEmployee ? 'Submit Request' : 'Give Loan'}
                </Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F8F9FA' },
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
    borderColor: C.black,
    padding: 10,
    alignItems: 'center',
  },
  summaryVal: { fontSize: 22, fontWeight: '700', color: C.black },
  summaryLabel: {
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
    color: C.textMuted,
    marginTop: 2,
  },
  activeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#EFF6FF',
    borderBottomWidth: 2,
    borderBottomColor: C.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  activeBannerText: { fontSize: 13, fontWeight: '700', color: C.primary },
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
    backgroundColor: C.white,
  },
  chipActive: { backgroundColor: C.primary },
  chipText: { fontSize: 12, fontWeight: '700', color: C.black },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyText: { fontSize: 14, fontWeight: '700', color: C.textMuted },
  card: {
    backgroundColor: C.white,
    borderWidth: 2,
    borderColor: C.black,
    padding: 14,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center' },
  empPhoto: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: C.black,
  },
  empInitials: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: C.black,
    backgroundColor: C.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empInitialsText: { fontSize: 14, fontWeight: '700', color: C.white },
  loanType: { fontSize: 13, fontWeight: '700', color: C.black },
  empName: {
    fontSize: 11,
    color: C.textMuted,
    fontWeight: '500',
    marginTop: 2,
  },
  amount: { fontSize: 18, fontWeight: '700', color: C.black },
  statusTag: {
    borderWidth: 2,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginTop: 4,
  },
  statusTagText: { fontSize: 9, fontWeight: '700' },
  detailRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  detail: { fontSize: 12, fontWeight: '700', color: C.textMuted },
  purpose: {
    fontSize: 12,
    color: C.textMuted,
    fontStyle: 'italic',
    marginTop: 6,
  },
  actionRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
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
    fontSize: 12,
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
  empPicker: {
    borderWidth: 2,
    borderColor: C.black,
    backgroundColor: C.white,
  },
  empPickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  empPickerRowActive: { backgroundColor: C.primary },
  empPickerPhoto: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: C.black,
  },
  empPickerInitials: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: C.black,
    backgroundColor: C.primary + '44',
    alignItems: 'center',
    justifyContent: 'center',
  },
  empPickerInitialsText: { fontSize: 11, fontWeight: '700', color: C.black },
  empPickerName: { fontSize: 13, fontWeight: '600', color: C.black },
  empPickerSub: { fontSize: 12, color: C.textMuted, marginTop: 1 },
});

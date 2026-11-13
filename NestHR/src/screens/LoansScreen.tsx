import { sentence } from '../utils/text';
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
  Search,
  SlidersHorizontal,
  Ellipsis,
  Upload,
  Download,
  FileText,
  IndianRupee,
} from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { loanAPI, employeeAPI } from '../api/api';
import { useAuth } from '../contexts/AuthContext';
import SlideInCard from '../components/motion/SlideInCard';
import { C, useResponsive } from '../theme';
import { CENTER } from '../components/common/centerModal';
import { chooseExport } from '../utils/exporters';
import { pickSheet, shareTemplate } from '../utils/importSheet';
import HeaderIconBtn from '../components/common/HeaderIconBtn';
import SearchModal from '../components/common/SearchModal';
import FilterSortModal from '../components/common/FilterSortModal';
import DashStatCard, { dashStatRow } from '../components/common/DashStatCard';

const STATUS_CONFIG: Record<string, { color: string; bg: string; icon: any }> =
  {
    pending: { color: C.warning, bg: '#FFF7ED', icon: Clock },
    active: { color: C.primary, bg: '#EFF6FF', icon: CreditCard },
    rejected: { color: C.danger, bg: '#FEF2F2', icon: XCircle },
    cleared: { color: C.success, bg: '#F0FDF4', icon: CheckCircle2 },
    paused: { color: C.warning, bg: '#FFF7ED', icon: Clock },
  };

const LOAN_TYPES = ['loan', 'advance'];

const EMPTY_FORM = {
  type: 'loan',
  amount: '',
  tenureMonths: '',
  reason: '',
};

const IMPORT_HEADERS = [
  'Emp ID',
  'Type (loan/advance)',
  'Amount',
  'Monthly EMI',
  'Disbursed On (YYYY-MM-DD)',
  'Reason',
];

const IMPORT_EXAMPLE = [
  'EMP0001',
  'loan',
  50000,
  5000,
  new Date().toISOString().slice(0, 10),
  'Medical',
];

export default function LoansScreen() {
  const navigation = useNavigation<any>();
  const { user } = useAuth();
  const { isTablet, maxContentWidth } = useResponsive();
  const isEmployee = user?.role === 'employee';
  const [loans, setLoans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [importing, setImporting] = useState(false);
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

  const loanName = (l: any) =>
    `${l.employee?.firstName || ''} ${l.employee?.lastName || ''}`.trim();
  const filtered = loans
    .filter(l => !statusFilter || l.status === statusFilter)
    .filter(
      l => !search || loanName(l).toLowerCase().includes(search.toLowerCase()),
    )
    .sort((a, b) =>
      sortKey === 'name'
        ? loanName(a).localeCompare(loanName(b))
        : sortKey === 'amount'
        ? (b.amount || 0) - (a.amount || 0)
        : 0,
    );

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
        tenureMonths: form.tenureMonths ? parseInt(form.tenureMonths, 10) : 0,
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

  const runImport = async () => {
    setMenuOpen(false);
    setImporting(true);
    try {
      const rows = await pickSheet();
      if (!rows) return;
      if (!rows.length) return Alert.alert('Import', 'File is empty');
      let ok = 0;
      const bad: string[] = [];
      for (const r of rows) {
        const code = String(r['Emp ID'] || '')
          .trim()
          .toLowerCase();
        const emp = employees.find(
          (e: any) => e.employeeId?.toLowerCase() === code,
        );
        const amount = parseFloat(String(r.Amount).replace(/,/g, ''));
        if (!emp || !(amount > 0)) {
          bad.push(String(r['Emp ID'] || '(blank)'));
          continue;
        }
        const type =
          String(r['Type (loan/advance)'] || 'loan').toLowerCase() === 'advance'
            ? 'advance'
            : 'loan';
        try {
          await loanAPI.create({
            employee: emp._id,
            type,
            amount,
            remainingBalance: amount,
            monthlyEmi:
              parseFloat(String(r['Monthly EMI']).replace(/,/g, '')) || 0,
            disbursedOn:
              String(r['Disbursed On (YYYY-MM-DD)'] || '').slice(0, 10) ||
              new Date().toISOString().slice(0, 10),
            reason: String(r.Reason || ''),
            status: 'active',
          });
          ok++;
        } catch {
          bad.push(String(r['Emp ID']));
        }
      }
      load();
      Alert.alert(
        'Import',
        `${ok} of ${rows.length} imported${
          bad.length ? `. Skipped: ${bad.slice(0, 5).join(', ')}` : ''
        }`,
      );
    } catch (e: any) {
      Alert.alert('Import failed', e?.message || 'Could not import file');
    } finally {
      setImporting(false);
    }
  };

  const exportCols = [
    {
      header: 'Emp Code',
      value: (l: any) => l.employee?.employeeId,
    },
    {
      header: 'Employee',
      value: (l: any) =>
        `${l.employee?.firstName || ''} ${l.employee?.lastName || ''}`.trim(),
    },
    { header: 'Type', value: (l: any) => l.type },
    { header: 'Amount', value: (l: any) => l.amount },
    { header: 'Monthly EMI', value: (l: any) => l.monthlyEmi },
    {
      header: 'Remaining',
      value: (l: any) => l.remainingBalance,
    },
    {
      header: 'Disbursed On',
      value: (l: any) =>
        l.disbursedOn ? String(l.disbursedOn).slice(0, 10) : '',
    },
    { header: 'Status', value: (l: any) => l.status },
    { header: 'Reason', value: (l: any) => l.reason },
  ];

  const totalActive = loans
    .filter(l => l.status === 'active')
    .reduce((s, l) => s + (l.amount || 0), 0);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Concise Header matching EmployeesScreen */}
      <View
        style={[
          styles.header,
          isTablet && {
            maxWidth: maxContentWidth,
            width: '100%',
            alignSelf: 'center',
          },
        ]}
      >
        <View style={styles.headerLeft}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={{ padding: 4, marginRight: 2 }}
            hitSlop={8}
          >
            <ChevronLeft size={22} color={C.black} />
          </TouchableOpacity>
          <CreditCard size={20} color={C.primary} />
          <Text style={styles.headerTitle}>
            {isEmployee ? 'My Loans' : 'Loans'}
          </Text>
        </View>

        <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
          {!isEmployee && (
            <HeaderIconBtn
              label="Search"
              icon={<Search size={22} color={C.black} />}
              dot={!!search}
              onPress={() => setSearchOpen(true)}
            />
          )}
          <HeaderIconBtn
            label="Filter and sort"
            icon={<SlidersHorizontal size={22} color={C.black} />}
            dot={!!statusFilter || !!sortKey}
            onPress={() => setFilterOpen(true)}
          />
          {!isEmployee && (
            <HeaderIconBtn
              label="More actions"
              icon={<Ellipsis size={22} color={C.black} />}
              onPress={() => setMenuOpen(true)}
            />
          )}
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => {
              setForm(EMPTY_FORM);
              setSelectedEmpId('');
              setShowForm(true);
            }}
            accessibilityLabel={isEmployee ? 'Request' : 'Give Loan'}
            hitSlop={8}
          >
            <Plus size={24} color={C.primary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Overflow Menu Modal matching EmployeesScreen */}
      {!isEmployee && (
        <Modal
          visible={menuOpen}
          transparent
          animationType="fade"
          onRequestClose={() => setMenuOpen(false)}
        >
          <TouchableOpacity
            style={styles.menuOverlay}
            activeOpacity={1}
            onPress={() => setMenuOpen(false)}
          >
            <View style={styles.menuSheet}>
              {[
                {
                  icon: Upload,
                  label: 'Import from Excel / CSV',
                  onPress: runImport,
                },
                {
                  icon: FileText,
                  label: 'Download sample file',
                  onPress: () => {
                    setMenuOpen(false);
                    shareTemplate(
                      'loans',
                      IMPORT_HEADERS,
                      IMPORT_EXAMPLE.map(String),
                    );
                  },
                },
                {
                  icon: Download,
                  label: 'Export loans',
                  onPress: () => {
                    setMenuOpen(false);
                    chooseExport('loans_advances', exportCols, filtered);
                  },
                },
              ].map(item => (
                <TouchableOpacity
                  key={item.label}
                  style={styles.menuItem}
                  onPress={item.onPress}
                  disabled={importing}
                >
                  <item.icon size={18} color={C.black} />
                  <Text style={styles.menuText}>{item.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </TouchableOpacity>
        </Modal>
      )}

      {totalActive > 0 && (
        <View style={styles.activeBanner}>
          <CreditCard size={14} color={C.primary} />
          <Text style={styles.activeBannerText}>
            Active portfolio: ₹{(totalActive / 1000).toFixed(1)}K
          </Text>
        </View>
      )}

      <SearchModal
        visible={searchOpen}
        onClose={() => setSearchOpen(false)}
        value={search}
        onChange={setSearch}
        placeholder="Search by employee…"
        items={loans.map(l => ({
          key: l._id,
          title: loanName(l) || String(l.type),
          subtitle: `${l.type} · ₹${l.amount}`,
        }))}
      />
      <FilterSortModal
        visible={filterOpen}
        onClose={() => setFilterOpen(false)}
        filterTitle="Status"
        filterOptions={[
          { key: '', label: 'All' },
          ...Object.keys(STATUS_CONFIG).map(k => ({ key: k, label: k })),
        ]}
        filterValue={statusFilter}
        onFilter={setStatusFilter}
        sortOptions={[
          { key: '', label: 'Default' },
          { key: 'name', label: 'Employee A–Z' },
          { key: 'amount', label: 'Highest amount' },
        ]}
        sortValue={sortKey}
        onSort={setSortKey}
        onReset={() => {
          setStatusFilter('');
          setSortKey('');
        }}
      />

      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={C.primary} />
        </View>
      ) : (
        <FlatList
          key={isTablet ? 'tablet-grid-2' : 'mobile-list'}
          data={filtered}
          keyExtractor={item => item._id}
          numColumns={isTablet ? 2 : 1}
          columnWrapperStyle={isTablet ? styles.colWrapper : undefined}
          contentContainerStyle={[
            { padding: 16, gap: 12, paddingBottom: 32 },
            isTablet && {
              maxWidth: maxContentWidth,
              width: '100%',
              alignSelf: 'center',
            },
          ]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={C.primary}
            />
          }
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <View style={dashStatRow}>
              <DashStatCard
                index={0}
                label="Total"
                value={loans.length}
                icon={CreditCard}
                color={C.black}
              />
              <DashStatCard
                index={1}
                label="Active"
                value={loans.filter(l => l.status === 'active').length}
                icon={CheckCircle2}
                color={C.primary}
              />
              <DashStatCard
                index={2}
                label="Pending"
                value={loans.filter(l => l.status === 'pending').length}
                icon={Clock}
                color={C.warning}
              />
              <DashStatCard
                index={3}
                label="Cleared"
                value={loans.filter(l => l.status === 'cleared').length}
                icon={IndianRupee}
                color={C.success}
              />
            </View>
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <CreditCard size={40} color="#D1D5DB" />
              <Text style={styles.emptyText}>No loan records</Text>
            </View>
          }
          renderItem={({ item, index }) => {
            const cfg = STATUS_CONFIG[item.status] || {
              color: C.textMuted,
              bg: '#F3F4F6',
              icon: Clock,
            };
            const emp = item.employee as any;
            const monthlyEmi = item.monthlyEmi || null;
            return (
              <SlideInCard
                index={index}
                style={isTablet ? styles.cardTablet : undefined}
              >
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
                            ? `${(emp.firstName || '')[0] || ''}${
                                (emp.lastName || '')[0] || ''
                              }`
                            : '?'}
                        </Text>
                      </View>
                    )}
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={styles.loanType}>
                        {item.type === 'advance' ? 'Salary advance' : 'Loan'}
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
                        <Text
                          style={[styles.statusTagText, { color: C.white }]}
                        >
                          {sentence(item.status)}
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
                    {item.remainingBalance != null &&
                      item.status === 'active' && (
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
                    <Text
                      style={[styles.purpose, { color: C.danger }]}
                      numberOfLines={2}
                    >
                      Reason: {item.rejectionReason}
                    </Text>
                  )}
                  {!isEmployee && item.status === 'pending' && (
                    <View style={styles.actionRow}>
                      <TouchableOpacity
                        style={styles.approveBtn}
                        onPress={() => handleAction(item, 'approved')}
                      >
                        <Check size={14} color={C.white} />
                        <Text style={styles.actionBtnText}>Approve</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.rejectBtn}
                        onPress={() => handleAction(item, 'rejected')}
                      >
                        <X size={14} color={C.white} />
                        <Text style={styles.actionBtnText}>Reject</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              </SlideInCard>
            );
          }}
        />
      )}

      <Modal visible={showForm} transparent animationType="fade">
        <View style={CENTER.overlay}>
          <View style={CENTER.card}>
            <SafeAreaView style={styles.safe} edges={[]}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  {isEmployee ? 'Request Loan / Advance' : 'Give Loan to Staff'}
                </Text>
                <TouchableOpacity onPress={() => setShowForm(false)}>
                  <X size={24} color={C.black} />
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
                                  {`${(e.firstName || '')[0] || ''}${
                                    (e.lastName || '')[0] || ''
                                  }`}
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
                          {t === 'advance' ? 'Salary advance' : 'Loan'}
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
                    onChangeText={v =>
                      setForm(p => ({ ...p, tenureMonths: v }))
                    }
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
          </View>
        </View>
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
  headerTitle: { fontSize: 20, fontWeight: '400', color: C.black },
  addBtn: { padding: 4 },
  menuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.25)',
    alignItems: 'flex-end',
    paddingTop: 96,
    paddingHorizontal: 12,
  },
  menuSheet: {
    minWidth: 230,
    borderWidth: 2,
    borderRadius: 8,
    borderRightWidth: 4,
    borderBottomWidth: 4,
    borderColor: C.black,
    backgroundColor: C.white,
    paddingVertical: 4,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  menuText: { fontSize: 14, color: C.black },
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
  activeBannerText: { fontSize: 13, fontWeight: '400', color: C.primary },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyText: { fontSize: 14, fontWeight: '400', color: C.textMuted },
  colWrapper: { gap: 12 },
  cardTablet: { flex: 1 },
  card: {
    backgroundColor: C.white,
    borderWidth: 2,
    borderRadius: 8,
    borderRightWidth: 4,
    borderBottomWidth: 4,
    borderRightColor: '#0A0A0A',
    borderBottomColor: '#0A0A0A',
    borderColor: C.black,
    padding: 16,
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
  empInitialsText: { fontSize: 14, fontWeight: '400', color: C.white },
  loanType: { fontSize: 13, fontWeight: '400', color: C.black },
  empName: {
    fontSize: 11,
    color: C.textMuted,
    fontWeight: '400',
    marginTop: 2,
  },
  amount: { fontSize: 18, fontWeight: '400', color: C.black },
  statusTag: {
    borderWidth: 2,
    borderRadius: 999,
    borderColor: '#0A0A0A',
    borderRightWidth: 4,
    borderBottomWidth: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginTop: 4,
  },
  statusTagText: {
    textTransform: 'capitalize',
    fontSize: 11,
    fontWeight: '400',
  },
  detailRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  detail: {
    fontSize: 11,
    fontWeight: '400',
    color: C.black,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: C.white,
    overflow: 'hidden',
    borderWidth: 2,
    borderRightWidth: 4,
    borderBottomWidth: 4,
    borderColor: C.black,
    borderRadius: 8,
  },
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
    borderRadius: 8,
    borderRightWidth: 4,
    borderBottomWidth: 4,
    borderRightColor: '#0A0A0A',
    borderBottomColor: '#0A0A0A',
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
    borderRadius: 8,
    borderRightWidth: 4,
    borderBottomWidth: 4,
    borderRightColor: '#0A0A0A',
    borderBottomColor: '#0A0A0A',
    borderColor: C.black,
    paddingVertical: 8,
  },
  actionBtnText: {
    color: C.white,
    fontSize: 12,
    fontWeight: '400',
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
  modalTitle: { fontSize: 20, fontWeight: '400', color: C.black },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '400',
    color: C.black,
    marginBottom: 4,
  },
  fieldInput: {
    borderWidth: 2,
    borderRadius: 8,
    borderRightWidth: 4,
    borderBottomWidth: 4,
    borderRightColor: '#0A0A0A',
    borderBottomColor: '#0A0A0A',
    borderColor: C.black,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 14,
    fontWeight: '400',
    color: C.black,
    backgroundColor: C.white,
  },
  selChip: {
    borderWidth: 2,
    borderRightWidth: 4,
    borderBottomWidth: 4,
    borderRightColor: '#0A0A0A',
    borderBottomColor: '#0A0A0A',
    borderRadius: 8,
    borderColor: C.black,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  selChipActive: { backgroundColor: C.primary },
  selChipText: { fontSize: 11, fontWeight: '400', color: C.black },
  submitBtn: {
    backgroundColor: C.primary,
    borderWidth: 2,
    borderRadius: 8,
    borderRightWidth: 4,
    borderBottomWidth: 4,
    borderRightColor: '#0A0A0A',
    borderBottomColor: '#0A0A0A',
    borderColor: C.black,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  submitBtnText: {
    color: C.white,
    fontWeight: '400',
    fontSize: 14,
  },
  empPicker: {
    borderWidth: 2,
    borderRadius: 8,
    borderRightWidth: 4,
    borderBottomWidth: 4,
    borderRightColor: '#0A0A0A',
    borderBottomColor: '#0A0A0A',
    borderColor: C.black,
    backgroundColor: C.white,
  },
  empPickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderBottomWidth: 2,
    borderBottomColor: C.black,
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
  empPickerInitialsText: { fontSize: 11, fontWeight: '400', color: C.black },
  empPickerName: { fontSize: 13, fontWeight: '400', color: C.black },
  empPickerSub: { fontSize: 12, color: C.textMuted, marginTop: 1 },
});

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
  ScrollView,
  Modal,
  Share,
  Image,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  IndianRupee,
  Search,
  ChevronRight,
  X,
  Zap,
  BadgeCheck,
  ChevronLeft,
  Share2,
  Eye,
  CheckCircle2,
  FileText,
  SlidersHorizontal,
  Ellipsis,
  Download,
  Plus,
  Wallet,
  Clock,
} from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { payrollAPI, payrollPreviewAPI } from '../api/api';
import RNPrint from 'react-native-print';
import { buildPayslipHTML } from '../utils/buildPayslipHTML';
import { useAuth } from '../contexts/AuthContext';
import { Payroll } from '../types/hrms';
import { C, useResponsive } from '../theme';
import SlideInCard from '../components/motion/SlideInCard';
import { CENTER } from '../components/common/centerModal';
import { chooseExport } from '../utils/exporters';
import HeaderIconBtn from '../components/common/HeaderIconBtn';
import SearchModal from '../components/common/SearchModal';
import FilterSortModal from '../components/common/FilterSortModal';
import PickerField from '../components/common/PickerField';
import DashStatCard, { dashStatRow } from '../components/common/DashStatCard';

const GEN_MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
].map((label, i) => ({ value: String(i + 1), label }));

const genYearOptions = Array.from({ length: 7 }, (_, i) => {
  const y = new Date().getFullYear() + 1 - i;
  return { value: String(y), label: String(y) };
});

const STATUS_CONFIG: Record<string, { color: string; bg: string }> = {
  draft: { color: '#6B7280', bg: '#F3F4F6' },
  pending: { color: C.warning, bg: '#FFF7ED' },
  processed: { color: C.primary, bg: '#EFF6FF' },
  paid: { color: C.success, bg: '#F0FDF4' },
  cancelled: { color: C.danger, bg: '#FEF2F2' },
};

export default function PayrollScreen() {
  const navigation = useNavigation<any>();
  const { user } = useAuth();
  const isEmployee = user?.role === 'employee';
  const { isTablet, maxContentWidth } = useResponsive();
  const [payrolls, setPayrolls] = useState<Payroll[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [selected, setSelected] = useState<Payroll | null>(null);
  const [showGenModal, setShowGenModal] = useState(false);
  const [showTaxModal, setShowTaxModal] = useState(false);
  const [declarations, setDeclarations] = useState({
    sec80C: '150000',
    sec80D: '25000',
    hra: '120000',
  });
  const [genMonth, setGenMonth] = useState(String(new Date().getMonth() + 1));
  const [genYear, setGenYear] = useState(String(new Date().getFullYear()));
  const [generating, setGenerating] = useState(false);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [previewStep, setPreviewStep] = useState<'form' | 'preview'>('form');
  const [loadingPreview, setLoadingPreview] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = isEmployee
        ? await payrollAPI.getMy()
        : await payrollAPI.getAll();
      setPayrolls(res.data || []);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
    }
  }, [isEmployee]);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const filtered = payrolls.filter(p => {
    if (statusFilter && p.status !== statusFilter) return false;
    if (search) {
      const emp = p.employee as any;
      const name = `${emp?.firstName || ''} ${
        emp?.lastName || ''
      }`.toLowerCase();
      if (!name.includes(search.toLowerCase())) return false;
    }
    return true;
  });
  if (sortKey) {
    const nm = (p: any) =>
      `${p.employee?.firstName || ''} ${
        p.employee?.lastName || ''
      }`.toLowerCase();
    filtered.sort((a: any, b: any) =>
      sortKey === 'name'
        ? nm(a).localeCompare(nm(b))
        : (b.netSalary || 0) - (a.netSalary || 0),
    );
  }

  const totalNet = payrolls.reduce((sum, p) => sum + (p.netSalary || 0), 0);
  const totalGross = payrolls.reduce((sum, p) => sum + (p.grossSalary || 0), 0);
  const paidCount = payrolls.filter(p => p.status === 'paid').length;

  const handleProcess = async (payroll: Payroll) => {
    Alert.alert('Process Payroll', 'Process payroll for this employee?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Process',
        onPress: async () => {
          try {
            await payrollAPI.process({ payrollId: payroll._id });
            await load();
          } catch (e: any) {
            Alert.alert('Error', e.message);
          }
        },
      },
    ]);
  };

  const handleMarkPaid = async (payroll: Payroll) => {
    Alert.alert('Mark as Paid', 'Mark this payroll as paid?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Mark Paid',
        onPress: async () => {
          try {
            await payrollAPI.markPaid(payroll._id);
            await load();
          } catch (e: any) {
            Alert.alert('Error', e.message);
          }
        },
      },
    ]);
  };

  const handleGenerate = async (force = false) => {
    if (force) {
      Alert.alert(
        'Reprocess Payroll',
        'This will DELETE existing payroll records for this month (except paid) and recalculate. Continue?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Yes, Reprocess',
            style: 'destructive',
            onPress: () => doGenerate(true),
          },
        ],
      );
      return;
    }
    doGenerate(false);
  };

  const handleSharePayslip = async (payroll: any) => {
    const emp = payroll.employee as any;
    const months = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];
    const period =
      payroll.month && payroll.year
        ? `${months[(payroll.month || 1) - 1]} ${payroll.year}`
        : '—';
    const name = isEmployee
      ? user?.name || 'Employee'
      : emp
      ? `${emp.firstName} ${emp.lastName}`
      : 'Employee';
    const text = [
      `━━━━━━━━━━━━━━━━━━━━`,
      `SALARY SLIP — ${period}`,
      `━━━━━━━━━━━━━━━━━━━━`,
      `Employee : ${name}`,
      `Designation: ${emp?.designation || '—'}`,
      ``,
      `EARNINGS`,
      `Basic Salary   : ₹${(payroll.basicSalary || 0).toLocaleString()}`,
      `Earned Basic   : ₹${(payroll.earnedBasic || 0).toLocaleString()}`,
      `Allowances     : ₹${(payroll.otherAllowances || 0).toLocaleString()}`,
      `Overtime       : ₹${(payroll.otPay || 0).toLocaleString()}`,
      `Gross Salary   : ₹${(payroll.grossSalary || 0).toLocaleString()}`,
      ``,
      `DEDUCTIONS`,
      `Absent (${payroll.absentDays || 0}d): -₹${(
        payroll.absentDeduction || 0
      ).toLocaleString()}`,
      `Late           : -₹${(
        payroll.lateDeductionAmount || 0
      ).toLocaleString()}`,
      `Half Day       : -₹${(payroll.halfDayDeduction || 0).toLocaleString()}`,
      `Penalty        : -₹${(payroll.penaltyAmount || 0).toLocaleString()}`,
      `Loan EMI       : -₹${(payroll.loanDeduction || 0).toLocaleString()}`,
      `Total Deductions: -₹${(payroll.totalDeductions || 0).toLocaleString()}`,
      ``,
      `━━━━━━━━━━━━━━━━━━━━`,
      `NET PAY : ₹${(payroll.netSalary || 0).toLocaleString()}`,
      `━━━━━━━━━━━━━━━━━━━━`,
      `Days: ${payroll.presentDays || 0}/${payroll.workingDays || 0} present`,
      `Status: ${sentence(payroll.status)}`,
    ].join('\n');
    await Share.share({ message: text, title: `Payslip — ${period}` });
  };

  const handlePrintPayslip = async (payroll: any) => {
    try {
      const html = buildPayslipHTML(payroll);
      await RNPrint.print({ html });
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not generate PDF');
    }
  };

  const handleTallyExport = async () => {
    if (payrolls.length === 0) {
      Alert.alert('No Data', 'No payroll records to export.');
      return;
    }
    const months = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];
    const header =
      'Employee Name,Employee ID,Designation,Department,Basic Salary,Earned Basic,Allowances,Overtime,Gross Salary,Absent Deduction,Late Deduction,Half Day Deduction,Penalty,Loan EMI,Total Deductions,Net Salary,Working Days,Days Present,Leave Days,Absent Days,Hours Worked,Status';
    const rows = payrolls.map(p => {
      const emp = p.employee as any;
      const name = `${emp?.firstName || ''} ${emp?.lastName || ''}`.trim();
      return [
        name,
        emp?.employeeId || '',
        emp?.designation || '',
        (emp?.department as any)?.name || '',
        p.basicSalary || 0,
        (p as any).earnedBasic ?? p.basicSalary ?? 0,
        (p as any).otherAllowances || 0,
        (p as any).otPay || 0,
        p.grossSalary || 0,
        (p as any).absentDeduction || 0,
        (p as any).lateDeductionAmount || 0,
        (p as any).halfDayDeduction || 0,
        (p as any).penaltyAmount || 0,
        (p as any).loanDeduction || 0,
        p.totalDeductions || 0,
        p.netSalary || 0,
        (p as any).workingDays || 0,
        (p as any).presentDays || 0,
        (p as any).leaveDays || 0,
        (p as any).absentDays || 0,
        Number((p as any).totalWorkHours ?? 0).toFixed(2),
        p.status || '',
      ]
        .map(v => `"${String(v).replace(/"/g, '""')}"`)
        .join(',');
    });
    const csv = [header, ...rows].join('\n');
    const period =
      payrolls[0] && (payrolls[0] as any).month
        ? `${months[((payrolls[0] as any).month || 1) - 1]}_${
            (payrolls[0] as any).year
          }`
        : 'Export';
    await Share.share({
      message: csv,
      title: `Payroll_${period}_Tally.csv`,
    });
  };

  const handlePreviewPayroll = async () => {
    setLoadingPreview(true);
    try {
      const res = await payrollPreviewAPI.preview({
        month: parseInt(genMonth, 10),
        year: parseInt(genYear, 10),
      });
      setPreviewData(res.data || []);
      setPreviewStep('preview');
    } catch (e: any) {
      Alert.alert('Preview Error', e.message);
    } finally {
      setLoadingPreview(false);
    }
  };

  const doGenerate = async (force: boolean) => {
    setGenerating(true);
    try {
      await payrollAPI.process({
        month: parseInt(genMonth, 10),
        year: parseInt(genYear, 10),
        force,
      });
      setShowGenModal(false);
      await load();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setGenerating(false);
    }
  };

  const exportCols = [
    { header: 'Emp Code', value: (p: any) => p.employee?.employeeId },
    {
      header: 'Employee',
      value: (p: any) =>
        `${p.employee?.firstName || ''} ${p.employee?.lastName || ''}`.trim(),
    },
    { header: 'Designation', value: (p: any) => p.employee?.designation },
    {
      header: 'Cost / Hour',
      value: (p: any) => (p.hourlyRate ? Number(p.hourlyRate).toFixed(2) : ''),
    },
    { header: 'Basic', value: (p: any) => p.basicSalary },
    { header: 'OT', value: (p: any) => p.otPay || 0 },
    { header: 'Absent Ded.', value: (p: any) => p.absentDeduction || 0 },
    { header: 'Late Ded.', value: (p: any) => p.lateDeductionAmount || 0 },
    { header: 'Half Day Ded.', value: (p: any) => p.halfDayDeduction || 0 },
    {
      header: 'Early Out Ded.',
      value: (p: any) => p.earlyCheckoutDeduction || 0,
    },
    { header: 'Penalty', value: (p: any) => p.penaltyAmount || 0 },
    { header: 'Bonus/Allow', value: (p: any) => p.otherAllowances || 0 },
    { header: 'Loan/Advance', value: (p: any) => p.loanDeduction || 0 },
    { header: 'Gross', value: (p: any) => p.grossSalary },
    { header: 'Net Salary', value: (p: any) => p.netSalary },
    { header: 'Status', value: (p: any) => p.status },
  ];

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
          <IndianRupee size={20} color={C.primary} />
          <Text style={styles.headerTitle}>
            {isEmployee ? 'My Payslips' : 'Payroll'}
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
            <>
              <HeaderIconBtn
                label="More actions"
                icon={<Ellipsis size={22} color={C.black} />}
                onPress={() => setMenuOpen(true)}
              />
              <TouchableOpacity
                style={styles.addBtn}
                onPress={() => setShowGenModal(true)}
                accessibilityLabel="Generate Payroll"
                hitSlop={8}
              >
                <Plus size={24} color={C.primary} />
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>

      {/* Overflow Menu Modal */}
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
                  icon: Zap,
                  label: 'Generate / Preview Payroll',
                  onPress: () => {
                    setMenuOpen(false);
                    setShowGenModal(true);
                  },
                },
                {
                  icon: FileText,
                  label: 'Export for Tally (CSV)',
                  onPress: () => {
                    setMenuOpen(false);
                    handleTallyExport();
                  },
                },
                {
                  icon: Download,
                  label: 'Export payroll report',
                  onPress: () => {
                    setMenuOpen(false);
                    chooseExport('payroll', exportCols, filtered);
                  },
                },
              ].map(item => (
                <TouchableOpacity
                  key={item.label}
                  style={styles.menuItem}
                  onPress={item.onPress}
                >
                  <item.icon size={18} color={C.black} />
                  <Text style={styles.menuText}>{item.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </TouchableOpacity>
        </Modal>
      )}

      {isEmployee && (
        <View style={styles.taxCard}>
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <Text style={styles.taxTitle}>📄 Tax & Form 16 Vault</Text>
            <Text style={{ fontSize: 11, color: C.primary }}>New Regime</Text>
          </View>
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              marginTop: 10,
            }}
          >
            <View>
              <Text style={{ fontSize: 10, color: C.textMuted }}>
                Projected Tax
              </Text>
              <Text style={{ fontSize: 13, color: C.black }}>₹14,500</Text>
            </View>
            <View>
              <Text style={{ fontSize: 10, color: C.textMuted }}>
                TDS Deducted
              </Text>
              <Text style={{ fontSize: 13, color: C.black }}>₹4,500</Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity
                style={styles.taxBtn}
                onPress={() =>
                  Alert.alert('Form 16', 'Form 16 PDF downloaded successfully.')
                }
              >
                <FileText size={13} color="#fff" />
                <Text style={styles.taxBtnText}>Form 16</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.taxBtn, { backgroundColor: C.secondary }]}
                onPress={() => setShowTaxModal(true)}
              >
                <IndianRupee size={13} color="#fff" />
                <Text style={styles.taxBtnText}>80C/HRA</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      <SearchModal
        visible={searchOpen}
        onClose={() => setSearchOpen(false)}
        value={search}
        onChange={setSearch}
        placeholder="Search by employee name…"
        items={payrolls.map((p: any) => ({
          key: p._id,
          title: `${p.employee?.firstName || ''} ${
            p.employee?.lastName || ''
          }`.trim(),
          subtitle: p.employee?.employeeId,
        }))}
      />
      <FilterSortModal
        visible={filterOpen}
        onClose={() => setFilterOpen(false)}
        filterTitle="Status"
        filterOptions={[
          { key: '', label: 'All' },
          { key: 'draft', label: 'Draft' },
          { key: 'pending', label: 'Pending' },
          { key: 'processed', label: 'Processed' },
          { key: 'paid', label: 'Paid' },
          { key: 'cancelled', label: 'Cancelled' },
        ]}
        filterValue={statusFilter}
        onFilter={setStatusFilter}
        sortOptions={[
          { key: '', label: 'Default' },
          { key: 'name', label: 'Employee A–Z' },
          { key: 'net', label: 'Highest net pay' },
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
            { padding: 16, gap: 10, paddingBottom: 32 },
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
                label="Gross"
                value={`₹${(totalGross / 1000).toFixed(0)}K`}
                icon={Wallet}
                color={C.primary}
              />
              <DashStatCard
                index={1}
                label="Net Pay"
                value={`₹${(totalNet / 1000).toFixed(0)}K`}
                icon={IndianRupee}
                color={C.success}
              />
              <DashStatCard
                index={2}
                label="Paid"
                value={paidCount}
                icon={CheckCircle2}
                color="#A855F7"
              />
              <DashStatCard
                index={3}
                label="Records"
                value={payrolls.length}
                icon={Clock}
                color={C.warning}
              />
            </View>
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <IndianRupee size={40} color="#D1D5DB" />
              <Text style={styles.emptyText}>No payroll records</Text>
            </View>
          }
          renderItem={({ item, index }) => {
            const cfg = STATUS_CONFIG[item.status] || {
              color: C.textMuted,
              bg: '#F3F4F6',
            };
            const emp = item.employee as any;
            const period =
              item.month && item.year ? `${item.month}/${item.year}` : '—';
            const p: any = item;
            const chips = [
              { l: 'OT', v: p.otPay, sign: '+', c: '#F59E0B' },
              {
                l: `Absent${p.absentDays ? ` ${p.absentDays}d` : ''}`,
                v: p.absentDeduction,
                sign: '-',
                c: C.danger,
              },
              { l: 'Late', v: p.lateDeductionAmount, sign: '-', c: C.danger },
              { l: 'Half Day', v: p.halfDayDeduction, sign: '-', c: C.danger },
              {
                l: 'Early Out',
                v: p.earlyCheckoutDeduction,
                sign: '-',
                c: C.danger,
              },
              { l: 'Penalty', v: p.penaltyAmount, sign: '-', c: C.danger },
              { l: 'Bonus', v: p.otherAllowances, sign: '+', c: C.success },
              { l: 'Loan', v: p.loanDeduction, sign: '-', c: C.secondary },
            ].filter(x => (x.v || 0) > 0);

            return (
              <SlideInCard
                index={index}
                style={isTablet ? styles.cardTablet : undefined}
              >
                <TouchableOpacity
                  style={styles.card}
                  onPress={() => setSelected(item)}
                  activeOpacity={0.85}
                >
                  {/* Compact Header Row: Avatar + Inline Code/Name + Status */}
                  <View style={styles.cardTop}>
                    {emp?.avatar ? (
                      <Image
                        source={{ uri: emp.avatar }}
                        style={styles.empPhoto}
                      />
                    ) : (
                      <View style={styles.empAvatar}>
                        <Text style={styles.empAvatarText}>
                          {emp?.firstName?.[0] || 'E'}
                        </Text>
                      </View>
                    )}

                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <View style={styles.nameRow}>
                        {!isEmployee && !!emp?.employeeId && (
                          <Text style={styles.codeChip}>{emp.employeeId}</Text>
                        )}
                        <Text style={styles.empName} numberOfLines={1}>
                          {isEmployee
                            ? user?.name || 'My Payslip'
                            : emp
                            ? `${emp.firstName} ${emp.lastName}`
                            : 'Employee'}
                        </Text>
                      </View>
                      <Text style={styles.empSub} numberOfLines={1}>
                        {isEmployee
                          ? period
                          : `${emp?.designation || 'Staff'} · ${period}${
                              p.hourlyRate
                                ? ` · ₹${Number(p.hourlyRate).toFixed(0)}/hr`
                                : ''
                            }`}
                      </Text>
                    </View>

                    <View style={styles.statusGroup}>
                      <View
                        style={[
                          styles.statusBadge,
                          { backgroundColor: cfg.color, borderColor: C.black },
                        ]}
                      >
                        <Text
                          style={[styles.statusBadgeText, { color: C.white }]}
                        >
                          {sentence(item.status)}
                        </Text>
                      </View>
                      <ChevronRight size={15} color={C.textMuted} />
                    </View>
                  </View>

                  {/* Compact Adjustment Chips (only when present) */}
                  {chips.length > 0 && (
                    <View style={styles.chipWrap}>
                      {chips.map(x => (
                        <View
                          key={x.l}
                          style={[styles.adjChip, { borderColor: x.c }]}
                        >
                          <Text style={[styles.adjText, { color: x.c }]}>
                            {x.l} {x.sign}₹{Number(x.v).toLocaleString()}
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}

                  {/* Clean Structured 3-Column Salary Strip */}
                  <View style={styles.salaryStrip}>
                    <View style={styles.salaryCol}>
                      <Text style={styles.salaryLabel}>GROSS</Text>
                      <Text style={styles.salaryVal} numberOfLines={1}>
                        ₹{(item.grossSalary || 0).toLocaleString()}
                      </Text>
                    </View>
                    <View style={styles.salaryDivider} />
                    <View style={styles.salaryCol}>
                      <Text style={styles.salaryLabel}>DEDUCTIONS</Text>
                      <Text
                        style={[styles.salaryVal, { color: C.danger }]}
                        numberOfLines={1}
                      >
                        -₹{(item.totalDeductions || 0).toLocaleString()}
                      </Text>
                    </View>
                    <View style={styles.salaryDivider} />
                    <View style={styles.salaryCol}>
                      <Text style={styles.salaryLabel}>NET PAY</Text>
                      <Text
                        style={[styles.salaryVal, { color: C.success }]}
                        numberOfLines={1}
                      >
                        ₹{(item.netSalary || 0).toLocaleString()}
                      </Text>
                    </View>
                  </View>

                  {/* Compact Action Bar */}
                  {!isEmployee &&
                    (item.status === 'draft' ||
                      item.status === 'processed') && (
                      <TouchableOpacity
                        style={
                          item.status === 'draft'
                            ? styles.processBtn
                            : styles.paidBtn
                        }
                        onPress={() =>
                          item.status === 'draft'
                            ? handleProcess(item)
                            : handleMarkPaid(item)
                        }
                      >
                        {item.status === 'draft' ? (
                          <Zap size={13} color={C.white} />
                        ) : (
                          <BadgeCheck size={13} color={C.white} />
                        )}
                        <Text style={styles.processBtnText}>
                          {item.status === 'draft'
                            ? 'Process Payroll'
                            : 'Mark as Paid'}
                        </Text>
                      </TouchableOpacity>
                    )}
                </TouchableOpacity>
              </SlideInCard>
            );
          }}
        />
      )}

      {/* Generate Modal */}
      {!isEmployee && (
        <Modal visible={showGenModal} transparent animationType="fade">
          <View style={CENTER.overlay}>
            <View style={CENTER.card}>
              <SafeAreaView style={styles.safe} edges={[]}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>
                    {previewStep === 'preview'
                      ? 'Payroll Preview'
                      : 'Generate Payroll'}
                  </Text>
                  <TouchableOpacity
                    onPress={() => {
                      setShowGenModal(false);
                      setPreviewStep('form');
                      setPreviewData([]);
                    }}
                  >
                    <X size={24} color={C.black} />
                  </TouchableOpacity>
                </View>
                <ScrollView
                  contentContainerStyle={{ padding: 20, gap: 16 }}
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={false}
                >
                  {previewStep === 'form' ? (
                    <>
                      <View style={styles.genNote}>
                        <Text style={styles.genNoteText}>
                          Preview payroll calculations before processing, or
                          generate directly.
                        </Text>
                      </View>
                      <View>
                        <Text style={styles.fieldLabel}>Month</Text>
                        <PickerField
                          title="Select month"
                          value={genMonth}
                          onChange={setGenMonth}
                          options={GEN_MONTHS}
                        />
                      </View>
                      <View>
                        <Text style={styles.fieldLabel}>Year</Text>
                        <PickerField
                          title="Select year"
                          value={genYear}
                          onChange={setGenYear}
                          options={genYearOptions}
                        />
                      </View>
                      <TouchableOpacity
                        style={[
                          styles.genSubmitBtn,
                          { backgroundColor: C.primary },
                        ]}
                        onPress={handlePreviewPayroll}
                        disabled={loadingPreview}
                      >
                        {loadingPreview ? (
                          <ActivityIndicator color={C.white} />
                        ) : (
                          <>
                            <Eye size={14} color={C.white} />
                            <Text style={styles.genSubmitBtnText}>
                              Preview First
                            </Text>
                          </>
                        )}
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.genSubmitBtn}
                        onPress={() => handleGenerate(false)}
                        disabled={generating}
                      >
                        {generating ? (
                          <ActivityIndicator color={C.white} />
                        ) : (
                          <>
                            <Zap size={14} color={C.white} />
                            <Text style={styles.genSubmitBtnText}>
                              Generate Directly
                            </Text>
                          </>
                        )}
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[
                          styles.genSubmitBtn,
                          { backgroundColor: C.danger, marginTop: 0 },
                        ]}
                        onPress={() => handleGenerate(true)}
                        disabled={generating}
                      >
                        <Zap size={14} color={C.white} />
                        <Text style={styles.genSubmitBtnText}>
                          Force Reprocess
                        </Text>
                      </TouchableOpacity>
                      <Text
                        style={{
                          fontSize: 11,
                          color: C.textMuted,
                          textAlign: 'center',
                        }}
                      >
                        Force Reprocess deletes and recalculates existing
                        payroll (not paid ones)
                      </Text>
                    </>
                  ) : (
                    <>
                      <Text
                        style={{
                          fontSize: 13,
                          fontWeight: '400',
                          color: C.textMuted,
                        }}
                      >
                        {previewData.length} employee
                        {previewData.length !== 1 ? 's' : ''} · {genMonth}/
                        {genYear}
                      </Text>
                      {previewData.map(p => (
                        <View key={p.employee._id} style={styles.previewRow}>
                          <View style={{ flex: 1, marginRight: 12 }}>
                            <View
                              style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                gap: 6,
                                flexWrap: 'wrap',
                              }}
                            >
                              <Text
                                style={{
                                  fontSize: 13,
                                  fontWeight: '400',
                                  color: C.black,
                                }}
                              >
                                {p.employee.firstName} {p.employee.lastName}
                              </Text>
                              {p.alreadyProcessed ? (
                                <View
                                  style={{
                                    backgroundColor: '#FEF3C7',
                                    borderWidth: 1.5,
                                    borderColor: '#D97706',
                                    paddingHorizontal: 6,
                                    paddingVertical: 1,
                                  }}
                                >
                                  <Text
                                    style={{
                                      fontSize: 11,
                                      fontWeight: '400',
                                      color: '#92400E',
                                    }}
                                  >
                                    ⚠ EXISTS
                                  </Text>
                                </View>
                              ) : (
                                <View
                                  style={{
                                    backgroundColor: '#F0FDF4',
                                    borderWidth: 1.5,
                                    borderColor: C.success,
                                    paddingHorizontal: 6,
                                    paddingVertical: 1,
                                  }}
                                >
                                  <Text
                                    style={{
                                      fontSize: 11,
                                      fontWeight: '400',
                                      color: C.success,
                                    }}
                                  >
                                    ✓ NEW
                                  </Text>
                                </View>
                              )}
                            </View>
                            <Text
                              style={{
                                fontSize: 11,
                                color: C.textMuted,
                                marginTop: 2,
                              }}
                            >
                              {p.employee.employeeId
                                ? `${p.employee.employeeId} · `
                                : ''}
                              {p.presentDays}/{p.workingDays}d ·{' '}
                              {p.absentDays || 0} absent
                            </Text>
                          </View>
                          <View style={{ alignItems: 'flex-end' }}>
                            <Text
                              style={{
                                fontSize: 11,
                                color: C.textMuted,
                                textDecorationLine: 'line-through',
                              }}
                            >
                              ₹{(p.grossSalary || 0).toLocaleString()}
                            </Text>
                            <Text
                              style={{
                                fontSize: 14,
                                fontWeight: '400',
                                color: C.success,
                              }}
                            >
                              ₹{(p.netSalary || 0).toLocaleString()}
                            </Text>
                            {(p.totalDeductions || 0) > 0 && (
                              <Text
                                style={{
                                  fontSize: 11,
                                  color: C.danger,
                                  fontWeight: '400',
                                }}
                              >
                                -₹{(p.totalDeductions || 0).toLocaleString()}
                              </Text>
                            )}
                          </View>
                        </View>
                      ))}
                      <TouchableOpacity
                        style={[
                          styles.genSubmitBtn,
                          { backgroundColor: '#000' },
                        ]}
                        onPress={() => {
                          setPreviewStep('form');
                          setPreviewData([]);
                        }}
                      >
                        <Text style={styles.genSubmitBtnText}>← Back</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.genSubmitBtn}
                        onPress={() => handleGenerate(false)}
                        disabled={generating}
                      >
                        {generating ? (
                          <ActivityIndicator color={C.white} />
                        ) : (
                          <>
                            <Zap size={14} color={C.white} />
                            <Text style={styles.genSubmitBtnText}>
                              Confirm & Generate
                            </Text>
                          </>
                        )}
                      </TouchableOpacity>
                    </>
                  )}
                </ScrollView>
              </SafeAreaView>
            </View>
          </View>
        </Modal>
      )}

      {/* Detail Modal */}
      <Modal visible={!!selected} transparent animationType="fade">
        <View style={CENTER.overlay}>
          <View style={CENTER.card}>
            {selected && (
              <SafeAreaView style={styles.safe} edges={[]}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Payroll Detail</Text>
                  <TouchableOpacity onPress={() => setSelected(null)}>
                    <X size={24} color={C.black} />
                  </TouchableOpacity>
                </View>
                <ScrollView
                  contentContainerStyle={{ padding: 20, gap: 16 }}
                  showsVerticalScrollIndicator={false}
                >
                  {(() => {
                    const s = selected as any;
                    const rows: Array<{
                      label: string;
                      val: number;
                      prefix: string;
                      color?: string;
                      bold?: boolean;
                      large?: boolean;
                      section?: boolean;
                    }> = [
                      { label: 'Earnings', val: 0, prefix: '', section: true },
                      {
                        label: 'Basic Salary',
                        val: s.basicSalary,
                        prefix: '₹',
                      },
                      {
                        label: 'Earned Basic',
                        val: s.earnedBasic,
                        prefix: '₹',
                      },
                      {
                        label: 'Allowances / Bonus',
                        val: s.otherAllowances,
                        prefix: '₹',
                      },
                      { label: 'Overtime Pay', val: s.otPay, prefix: '₹' },
                      {
                        label: 'Gross Salary',
                        val: s.grossSalary,
                        prefix: '₹',
                        bold: true,
                      },
                      {
                        label: 'Deductions',
                        val: 0,
                        prefix: '',
                        section: true,
                      },
                      {
                        label: `Absent (${s.absentDays || 0} days)`,
                        val: s.absentDeduction,
                        prefix: '-₹',
                        color: C.danger,
                      },
                      {
                        label: 'Late Deduction',
                        val: s.lateDeductionAmount,
                        prefix: '-₹',
                        color: C.danger,
                      },
                      {
                        label: 'Half-Day Deduction',
                        val: s.halfDayDeduction,
                        prefix: '-₹',
                        color: C.danger,
                      },
                      {
                        label: 'Penalty',
                        val: s.penaltyAmount,
                        prefix: '-₹',
                        color: C.danger,
                      },
                      {
                        label: 'Loan / Advance EMI',
                        val: s.loanDeduction,
                        prefix: '-₹',
                        color: C.danger,
                      },
                      {
                        label: 'Total Deductions',
                        val: s.totalDeductions,
                        prefix: '-₹',
                        color: C.danger,
                        bold: true,
                      },
                      { label: 'Summary', val: 0, prefix: '', section: true },
                      { label: 'Days Worked', val: s.presentDays, prefix: '' },
                      { label: 'Working Days', val: s.workingDays, prefix: '' },
                      {
                        label: 'Hours Worked',
                        val: s.totalWorkHours,
                        prefix: '',
                      },
                      {
                        label: 'Net Salary',
                        val: s.netSalary,
                        prefix: '₹',
                        color: C.success,
                        bold: true,
                        large: true,
                      },
                    ];
                    return rows;
                  })().map((row, i) => {
                    if (row.section) {
                      return (
                        <View key={i} style={styles.detailSection}>
                          <Text style={styles.detailSectionLabel}>
                            {row.label}
                          </Text>
                        </View>
                      );
                    }
                    const val = row.val || 0;
                    const display =
                      typeof val === 'number' && !Number.isInteger(val)
                        ? val.toFixed(2)
                        : val.toLocaleString();
                    return (
                      <View key={i} style={styles.detailRow}>
                        <Text style={styles.detailLabel}>{row.label}</Text>
                        <Text
                          style={[
                            styles.detailVal,
                            row.bold && { fontWeight: '400' },
                            row.color ? { color: row.color } : {},
                            row.large ? { fontSize: 20 } : {},
                            val === 0 && { color: C.textMuted },
                          ]}
                        >
                          {val === 0 ? '—' : `${row.prefix}${display}`}
                        </Text>
                      </View>
                    );
                  })}
                  <TouchableOpacity
                    style={styles.shareBtn}
                    onPress={() => handleSharePayslip(selected)}
                  >
                    <Share2 size={16} color={C.white} />
                    <Text style={styles.processBtnText}>Share Payslip</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.pdfBtn}
                    onPress={() => handlePrintPayslip(selected)}
                  >
                    <FileText size={16} color={C.white} />
                    <Text style={styles.processBtnText}>
                      Download / Print PDF
                    </Text>
                  </TouchableOpacity>

                  {!isEmployee &&
                    (selected as any).status === 'paid' &&
                    ((selected as any).slipReceivedAt ? (
                      <View style={styles.slipReceivedBadge}>
                        <CheckCircle2 size={16} color={C.success} />
                        <Text style={styles.slipReceivedText}>
                          Slip acknowledged ·{' '}
                          {new Date(
                            (selected as any).slipReceivedAt,
                          ).toLocaleDateString('en-IN')}
                        </Text>
                      </View>
                    ) : (
                      <TouchableOpacity
                        style={styles.slipBtn}
                        onPress={async () => {
                          try {
                            await payrollAPI.markSlipReceived(
                              (selected as any)._id,
                            );
                            setSelected(null);
                            load();
                          } catch (e: any) {
                            Alert.alert('Error', e.message);
                          }
                        }}
                      >
                        <CheckCircle2 size={16} color={C.white} />
                        <Text style={styles.processBtnText}>
                          Mark Slip Received
                        </Text>
                      </TouchableOpacity>
                    ))}
                </ScrollView>
              </SafeAreaView>
            )}
          </View>
        </View>
      </Modal>

      {isEmployee && (
        <Modal
          visible={showTaxModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowTaxModal(false)}
        >
          <View style={CENTER.overlay}>
            <View style={CENTER.card}>
              <SafeAreaView style={styles.safe} edges={[]}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Investment Declarations</Text>
                  <TouchableOpacity onPress={() => setShowTaxModal(false)}>
                    <X size={24} color={C.black} />
                  </TouchableOpacity>
                </View>
                <ScrollView
                  contentContainerStyle={{ padding: 20, gap: 16 }}
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={false}
                >
                  <View style={styles.genNote}>
                    <Text style={styles.genNoteText}>
                      Submit investment details under Section 80C, 80D and HRA
                      Rent for verification.
                    </Text>
                  </View>

                  <View>
                    <Text style={styles.fieldLabel}>
                      Section 80C (PPF, LIC, ELSS) *
                    </Text>
                    <TextInput
                      style={styles.fieldInput}
                      value={declarations.sec80C}
                      onChangeText={v =>
                        setDeclarations(p => ({ ...p, sec80C: v }))
                      }
                      keyboardType="numeric"
                      placeholder="e.g. 150000"
                      placeholderTextColor={C.textLight}
                    />
                    <Text
                      style={{ fontSize: 11, color: C.textMuted, marginTop: 4 }}
                    >
                      Maximum deduction limit is ₹1,50,000
                    </Text>
                  </View>

                  <View>
                    <Text style={styles.fieldLabel}>
                      Section 80D (Medical Insurance) *
                    </Text>
                    <TextInput
                      style={styles.fieldInput}
                      value={declarations.sec80D}
                      onChangeText={v =>
                        setDeclarations(p => ({ ...p, sec80D: v }))
                      }
                      keyboardType="numeric"
                      placeholder="e.g. 25000"
                      placeholderTextColor={C.textLight}
                    />
                  </View>

                  <View>
                    <Text style={styles.fieldLabel}>
                      House Rent Allowance (HRA Rent Paid) *
                    </Text>
                    <TextInput
                      style={styles.fieldInput}
                      value={declarations.hra}
                      onChangeText={v =>
                        setDeclarations(p => ({ ...p, hra: v }))
                      }
                      keyboardType="numeric"
                      placeholder="e.g. 120000"
                      placeholderTextColor={C.textLight}
                    />
                  </View>

                  <TouchableOpacity
                    style={styles.submitBtn}
                    onPress={() => {
                      Alert.alert(
                        'Success',
                        'Declarations submitted successfully for verification.',
                      );
                      setShowTaxModal(false);
                    }}
                  >
                    <Text style={styles.submitBtnText}>
                      Submit Declarations
                    </Text>
                  </TouchableOpacity>
                </ScrollView>
              </SafeAreaView>
            </View>
          </View>
        </Modal>
      )}
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

  // Compact Staff Card
  colWrapper: { gap: 10 },
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
    padding: 12,
    gap: 10,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  empPhoto: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: C.black,
  },
  empAvatar: {
    width: 40,
    height: 40,
    backgroundColor: C.primary,
    borderWidth: 2,
    borderRadius: 20,
    borderColor: C.black,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empAvatarText: { color: C.white, fontSize: 15, fontWeight: '400' },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  codeChip: {
    fontSize: 10,
    fontWeight: '400',
    color: C.primary,
    backgroundColor: C.primary + '18',
    borderWidth: 1.5,
    borderColor: C.primary,
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  empName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '400',
    color: C.black,
  },
  empSub: {
    fontSize: 11,
    color: C.textMuted,
    fontWeight: '400',
    marginTop: 2,
  },
  statusGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statusBadge: {
    borderWidth: 1.5,
    borderRadius: 999,
    borderColor: C.black,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  statusBadgeText: {
    textTransform: 'capitalize',
    fontSize: 10,
    fontWeight: '400',
  },

  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
  },
  adjChip: {
    borderWidth: 1.5,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  adjText: { fontSize: 10, fontWeight: '400' },

  // Clean 3-column salary strip (no heavy double-nested boxes)
  salaryStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderWidth: 1.5,
    borderColor: C.black,
    borderRadius: 6,
    paddingVertical: 7,
  },
  salaryCol: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  salaryDivider: {
    width: 1.5,
    height: 22,
    backgroundColor: '#E5E7EB',
  },
  salaryLabel: {
    fontSize: 9,
    fontWeight: '400',
    color: C.textMuted,
    letterSpacing: 0.4,
  },
  salaryVal: {
    fontSize: 13,
    fontWeight: '400',
    color: C.black,
    marginTop: 2,
  },

  processBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: C.primary,
    borderWidth: 2,
    borderRadius: 6,
    borderColor: C.black,
    paddingVertical: 7,
  },
  paidBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: C.success,
    borderWidth: 2,
    borderRadius: 6,
    borderColor: C.black,
    paddingVertical: 7,
  },
  processBtnText: {
    color: C.white,
    fontSize: 12,
    fontWeight: '400',
  },

  taxCard: {
    backgroundColor: C.white,
    borderWidth: 2,
    borderRadius: 8,
    borderRightWidth: 4,
    borderBottomWidth: 4,
    borderRightColor: '#0A0A0A',
    borderBottomColor: '#0A0A0A',
    borderColor: C.black,
    padding: 12,
    marginHorizontal: 16,
    marginTop: 12,
  },
  taxTitle: {
    fontSize: 13,
    fontWeight: '400',
    color: C.black,
  },
  taxBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: C.primary,
    borderWidth: 1.5,
    borderRadius: 6,
    borderColor: C.black,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  taxBtnText: {
    color: C.white,
    fontSize: 11,
    fontWeight: '400',
  },

  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyText: { fontSize: 14, fontWeight: '400', color: C.textMuted },

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
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: C.black,
  },
  detailSection: {
    borderBottomWidth: 2,
    borderBottomColor: C.black,
    backgroundColor: '#F3F4F6',
    paddingVertical: 6,
    paddingHorizontal: 2,
    marginTop: 4,
    marginBottom: 2,
  },
  detailSectionLabel: {
    fontSize: 14,
    fontWeight: '400',
    color: C.black,
  },
  detailLabel: { fontSize: 13, fontWeight: '400', color: C.textMuted },
  detailVal: { fontSize: 15, fontWeight: '400', color: C.black },
  genNote: {
    borderWidth: 2,
    borderRightWidth: 4,
    borderBottomWidth: 4,
    borderRightColor: '#0A0A0A',
    borderBottomColor: '#0A0A0A',
    borderRadius: 8,
    borderColor: C.success,
    backgroundColor: '#F0FDF4',
    padding: 12,
  },
  genNoteText: { fontSize: 13, fontWeight: '400', color: C.black },
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
    justifyContent: 'center',
    marginTop: 12,
  },
  submitBtnText: {
    color: C.white,
    fontWeight: '400',
    fontSize: 13,
  },
  genSubmitBtn: {
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
    paddingVertical: 16,
    marginTop: 8,
  },
  genSubmitBtnText: {
    color: C.white,
    fontWeight: '400',
    fontSize: 14,
  },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: C.primary,
    borderWidth: 2,
    borderRadius: 8,
    borderRightWidth: 4,
    borderBottomWidth: 4,
    borderRightColor: '#0A0A0A',
    borderBottomColor: '#0A0A0A',
    borderColor: C.black,
    paddingVertical: 12,
    marginTop: 16,
  },
  slipBtn: {
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
    paddingVertical: 12,
    marginTop: 12,
  },
  slipReceivedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 2,
    borderRightWidth: 4,
    borderBottomWidth: 4,
    borderRightColor: '#0A0A0A',
    borderBottomColor: '#0A0A0A',
    borderRadius: 8,
    borderColor: C.success,
    backgroundColor: '#F0FDF4',
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginTop: 12,
    justifyContent: 'center',
  },
  slipReceivedText: { fontSize: 12, fontWeight: '400', color: C.success },
  pdfBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#1D4ED8',
    borderWidth: 2,
    borderRadius: 8,
    borderRightWidth: 4,
    borderBottomWidth: 4,
    borderRightColor: '#0A0A0A',
    borderBottomColor: '#0A0A0A',
    borderColor: C.black,
    paddingVertical: 12,
    marginTop: 12,
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderRadius: 8,
    borderRightWidth: 4,
    borderBottomWidth: 4,
    borderRightColor: '#0A0A0A',
    borderBottomColor: '#0A0A0A',
    borderColor: C.black,
    padding: 12,
    backgroundColor: C.white,
  },
});

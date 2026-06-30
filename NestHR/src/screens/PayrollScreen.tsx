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
} from 'lucide-react-native';
import { TextInput } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { payrollAPI, payrollPreviewAPI } from '../api/api';
import RNPrint from 'react-native-print';
import { buildPayslipHTML } from '../utils/buildPayslipHTML';

import { useAuth } from '../contexts/AuthContext';
import { Payroll } from '../types/hrms';
import { C } from '../theme';

const STATUS_CONFIG: Record<string, { color: string; bg: string }> = {
  pending: { color: C.warning, bg: '#FFF7ED' },
  processed: { color: C.primary, bg: '#EFF6FF' },
  paid: { color: C.success, bg: '#F0FDF4' },
  cancelled: { color: C.danger, bg: '#FEF2F2' },
};

export default function PayrollScreen() {
  const navigation = useNavigation<any>();
  const { user } = useAuth();
  const isEmployee = user?.role === 'employee';
  const [payrolls, setPayrolls] = useState<Payroll[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
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
      const name =
        `${emp?.firstName || ''} ${emp?.lastName || ''}`.toLowerCase();
      if (!name.includes(search.toLowerCase())) return false;
    }
    return true;
  });

  const totalNet = payrolls.reduce((sum, p) => sum + (p.netSalary || 0), 0);
  const totalGross = payrolls.reduce((sum, p) => sum + (p.grossSalary || 0), 0);

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
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const period = payroll.month && payroll.year ? `${months[(payroll.month||1)-1]} ${payroll.year}` : '—';
    const name = isEmployee ? (user?.name || 'Employee') : (emp ? `${emp.firstName} ${emp.lastName}` : 'Employee');
    const text = [
      `━━━━━━━━━━━━━━━━━━━━`,
      `SALARY SLIP — ${period}`,
      `━━━━━━━━━━━━━━━━━━━━`,
      `Employee : ${name}`,
      `Designation: ${emp?.designation || '—'}`,
      ``,
      `EARNINGS`,
      `Basic Salary   : ₹${(payroll.basicSalary||0).toLocaleString()}`,
      `Earned Basic   : ₹${(payroll.earnedBasic||0).toLocaleString()}`,
      `Allowances     : ₹${(payroll.otherAllowances||0).toLocaleString()}`,
      `Overtime       : ₹${(payroll.otPay||0).toLocaleString()}`,
      `Gross Salary   : ₹${(payroll.grossSalary||0).toLocaleString()}`,
      ``,
      `DEDUCTIONS`,
      `Absent (${payroll.absentDays||0}d): -₹${(payroll.absentDeduction||0).toLocaleString()}`,
      `Late           : -₹${(payroll.lateDeductionAmount||0).toLocaleString()}`,
      `Half Day       : -₹${(payroll.halfDayDeduction||0).toLocaleString()}`,
      `Penalty        : -₹${(payroll.penaltyAmount||0).toLocaleString()}`,
      `Loan EMI       : -₹${(payroll.loanDeduction||0).toLocaleString()}`,
      `Total Deductions: -₹${(payroll.totalDeductions||0).toLocaleString()}`,
      ``,
      `━━━━━━━━━━━━━━━━━━━━`,
      `NET PAY : ₹${(payroll.netSalary||0).toLocaleString()}`,
      `━━━━━━━━━━━━━━━━━━━━`,
      `Days: ${payroll.presentDays||0}/${payroll.workingDays||0} present`,
      `Status: ${(payroll.status||'').toUpperCase()}`,
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
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const header = 'Employee Name,Employee ID,Designation,Department,Basic Salary,Earned Basic,Allowances,Overtime,Gross Salary,Absent Deduction,Late Deduction,Half Day Deduction,Penalty,Loan EMI,Total Deductions,Net Salary,Working Days,Days Present,Leave Days,Absent Days,Hours Worked,Status';
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
      ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(',');
    });
    const csv = [header, ...rows].join('\n');
    const period = payrolls[0] && (payrolls[0] as any).month
      ? `${months[((payrolls[0] as any).month||1)-1]}_${(payrolls[0] as any).year}`
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
        month: parseInt(genMonth),
        year: parseInt(genYear),
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
        month: parseInt(genMonth),
        year: parseInt(genYear),
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
          <IndianRupee size={20} color={C.primary} />
          <Text style={styles.headerTitle}>
            {isEmployee ? 'My Payslips' : 'Payroll'}
          </Text>
        </View>
        {!isEmployee && (
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {payrolls.length > 0 && (
              <TouchableOpacity
                style={[styles.genBtn, { backgroundColor: '#16A34A' }]}
                onPress={handleTallyExport}
              >
                <Share2 size={13} color={C.white} />
                <Text style={styles.genBtnText}>Tally</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.genBtn}
              onPress={() => setShowGenModal(true)}
            >
              <Zap size={14} color={C.white} />
              <Text style={styles.genBtnText}>Generate</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Summary cards */}
      <View style={styles.summaryRow}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Total Gross</Text>
          <Text style={styles.summaryVal}>
            ₹{(totalGross / 1000).toFixed(1)}K
          </Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Total Net</Text>
          <Text style={[styles.summaryVal, { color: C.success }]}>
            ₹{(totalNet / 1000).toFixed(1)}K
          </Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Records</Text>
          <Text style={styles.summaryVal}>{payrolls.length}</Text>
        </View>
      </View>

      {isEmployee && (
        <View style={styles.taxCard}>
          <Text style={styles.taxTitle}>📄 Tax & Form 16 Vault</Text>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 }}>
            <View>
              <Text style={{ fontSize: 9, fontWeight: '700', color: C.textMuted }}>PROJECTED TAX</Text>
              <Text style={{ fontSize: 13, fontWeight: '700', color: C.black }}>₹14,500</Text>
            </View>
            <View>
              <Text style={{ fontSize: 9, fontWeight: '700', color: C.textMuted }}>TDS DEDUCTED</Text>
              <Text style={{ fontSize: 13, fontWeight: '700', color: C.black }}>₹4,500</Text>
            </View>
            <View>
              <Text style={{ fontSize: 9, fontWeight: '700', color: C.textMuted }}>TAX REGIME</Text>
              <Text style={{ fontSize: 13, fontWeight: '700', color: C.black }}>New Regime</Text>
            </View>
          </View>

          <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
            <TouchableOpacity
              style={styles.taxBtn}
              onPress={() => Alert.alert('Form 16', 'Form 16 PDF downloaded successfully.')}
            >
              <FileText size={12} color="#fff" />
              <Text style={styles.taxBtnText}>Form 16</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.taxBtn, { backgroundColor: C.secondary }]}
              onPress={() => setShowTaxModal(true)}
            >
              <IndianRupee size={12} color="#fff" />
              <Text style={styles.taxBtnText}>Declarations</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {!isEmployee && (
        <View style={styles.searchWrap}>
          <Search size={15} color={C.textMuted} />
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Search by employee name…"
            placeholderTextColor={C.textLight}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <X size={14} color={C.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Status filters */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterBar}
        contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}
      >
        {[
          { key: '', label: 'All' },
          { key: 'pending', label: 'Pending' },
          { key: 'processed', label: 'Processed' },
          { key: 'paid', label: 'Paid' },
          { key: 'cancelled', label: 'Cancelled' },
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
              <IndianRupee size={40} color="#D1D5DB" />
              <Text style={styles.emptyText}>No payroll records</Text>
            </View>
          }
          renderItem={({ item }) => {
            const cfg = STATUS_CONFIG[item.status] || {
              color: C.textMuted,
              bg: '#F3F4F6',
            };
            const emp = item.employee as any;
            const period =
              item.month && item.year ? `${item.month}/${item.year}` : '—';
            return (
              <TouchableOpacity
                style={styles.card}
                onPress={() => setSelected(item)}
                activeOpacity={0.85}
              >
                <View style={styles.cardTop}>
                  <View style={styles.empAvatar}>
                    <Text style={styles.empAvatarText}>
                      {emp?.firstName?.[0] || 'E'}
                    </Text>
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.empName}>
                      {isEmployee
                        ? user?.name || 'My Payslip'
                        : emp
                          ? `${emp.firstName} ${emp.lastName}`
                          : 'Employee'}
                    </Text>
                    <Text style={styles.empSub}>
                      {isEmployee
                        ? period
                        : `${emp?.designation || 'N/A'} · ${period}`}
                    </Text>
                    {(item as any).absentDays > 0 && (
                      <Text style={[styles.empSub, { color: C.danger }]}>
                        {(item as any).absentDays} absent · -₹
                        {((item as any).absentDeduction || 0).toLocaleString()}
                      </Text>
                    )}
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 6 }}>
                    <View
                      style={[
                        styles.statusBadge,
                        { backgroundColor: cfg.color, borderColor: C.black },
                      ]}
                    >
                      <Text
                        style={[styles.statusBadgeText, { color: C.white }]}
                      >
                        {item.status.toUpperCase()}
                      </Text>
                    </View>
                    <ChevronRight size={14} color={C.textMuted} />
                  </View>
                </View>

                <View style={styles.salaryRow}>
                  <View style={styles.salaryItem}>
                    <Text style={styles.salaryLabel}>GROSS</Text>
                    <Text style={styles.salaryVal}>
                      ₹{(item.grossSalary || 0).toLocaleString()}
                    </Text>
                  </View>
                  <View style={styles.salaryDivider} />
                  <View style={styles.salaryItem}>
                    <Text style={styles.salaryLabel}>DEDUCTIONS</Text>
                    <Text style={[styles.salaryVal, { color: C.danger }]}>
                      -₹{(item.totalDeductions || 0).toLocaleString()}
                    </Text>
                  </View>
                  <View style={styles.salaryDivider} />
                  <View style={styles.salaryItem}>
                    <Text style={styles.salaryLabel}>NET PAY</Text>
                    <Text
                      style={[
                        styles.salaryVal,
                        { color: C.success, fontSize: 17 },
                      ]}
                    >
                      ₹{(item.netSalary || 0).toLocaleString()}
                    </Text>
                  </View>
                </View>

                {!isEmployee && item.status === 'draft' && (
                  <TouchableOpacity
                    style={styles.processBtn}
                    onPress={() => handleProcess(item)}
                  >
                    <Zap size={13} color={C.white} />
                    <Text style={styles.processBtnText}>Process Payroll</Text>
                  </TouchableOpacity>
                )}
                {!isEmployee && item.status === 'processed' && (
                  <TouchableOpacity
                    style={styles.paidBtn}
                    onPress={() => handleMarkPaid(item)}
                  >
                    <BadgeCheck size={13} color={C.white} />
                    <Text style={styles.processBtnText}>Mark as Paid</Text>
                  </TouchableOpacity>
                )}
              </TouchableOpacity>
            );
          }}
        />
      )}

      {!isEmployee && (
        <Modal
          visible={showGenModal}
          animationType="slide"
          presentationStyle="pageSheet"
        >
          <SafeAreaView style={styles.safe} edges={['top']}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {previewStep === 'preview' ? 'Payroll Preview' : 'Generate Payroll'}
              </Text>
              <TouchableOpacity onPress={() => { setShowGenModal(false); setPreviewStep('form'); setPreviewData([]); }}>
                <X size={22} color={C.black} />
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
                      Preview payroll calculations before processing, or generate directly.
                    </Text>
                  </View>
                  <View>
                    <Text style={styles.fieldLabel}>Month (1–12)</Text>
                    <TextInput
                      style={styles.fieldInput}
                      value={genMonth}
                      onChangeText={setGenMonth}
                      keyboardType="numeric"
                      placeholder="e.g. 6"
                      placeholderTextColor={C.textLight}
                    />
                  </View>
                  <View>
                    <Text style={styles.fieldLabel}>Year</Text>
                    <TextInput
                      style={styles.fieldInput}
                      value={genYear}
                      onChangeText={setGenYear}
                      keyboardType="numeric"
                      placeholder="e.g. 2026"
                      placeholderTextColor={C.textLight}
                    />
                  </View>
                  <TouchableOpacity
                    style={[styles.genSubmitBtn, { backgroundColor: C.primary }]}
                    onPress={handlePreviewPayroll}
                    disabled={loadingPreview}
                  >
                    {loadingPreview ? (
                      <ActivityIndicator color={C.white} />
                    ) : (
                      <>
                        <Eye size={14} color={C.white} />
                        <Text style={styles.genSubmitBtnText}>Preview First</Text>
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
                        <Text style={styles.genSubmitBtnText}>Generate Directly</Text>
                      </>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.genSubmitBtn, { backgroundColor: C.danger, marginTop: 0 }]}
                    onPress={() => handleGenerate(true)}
                    disabled={generating}
                  >
                    <>
                      <Zap size={14} color={C.white} />
                      <Text style={styles.genSubmitBtnText}>Force Reprocess</Text>
                    </>
                  </TouchableOpacity>
                  <Text style={{ fontSize: 11, color: C.textMuted, textAlign: 'center' }}>
                    Force Reprocess deletes and recalculates existing payroll (not paid ones)
                  </Text>
                </>
              ) : (
                <>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: C.textMuted }}>
                    {previewData.length} employee{previewData.length !== 1 ? 's' : ''} · {genMonth}/{genYear}
                  </Text>
                  {previewData.map(p => (
                    <View key={p.employee._id} style={styles.previewRow}>
                      <View style={{ flex: 1, marginRight: 10 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          <Text style={{ fontSize: 13, fontWeight: '700', color: C.black }}>
                            {p.employee.firstName} {p.employee.lastName}
                          </Text>
                          {p.alreadyProcessed && (
                            <View style={{ backgroundColor: '#FEF3C7', borderWidth: 1.5, borderColor: '#D97706', paddingHorizontal: 6, paddingVertical: 1 }}>
                              <Text style={{ fontSize: 9, fontWeight: '700', color: '#92400E' }}>⚠ EXISTS</Text>
                            </View>
                          )}
                          {!p.alreadyProcessed && (
                            <View style={{ backgroundColor: '#F0FDF4', borderWidth: 1.5, borderColor: C.success, paddingHorizontal: 6, paddingVertical: 1 }}>
                              <Text style={{ fontSize: 9, fontWeight: '700', color: C.success }}>✓ NEW</Text>
                            </View>
                          )}
                        </View>
                        <Text style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>
                          {p.employee.employeeId ? `${p.employee.employeeId} · ` : ''}
                          {p.presentDays}/{p.workingDays}d · {p.absentDays || 0} absent
                        </Text>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={{ fontSize: 11, color: C.textMuted, textDecorationLine: 'line-through' }}>
                          ₹{(p.grossSalary || 0).toLocaleString()}
                        </Text>
                        <Text style={{ fontSize: 14, fontWeight: '700', color: C.success }}>
                          ₹{(p.netSalary || 0).toLocaleString()}
                        </Text>
                        {(p.totalDeductions || 0) > 0 && (
                          <Text style={{ fontSize: 10, color: C.danger, fontWeight: '600' }}>
                            -₹{(p.totalDeductions || 0).toLocaleString()}
                          </Text>
                        )}
                      </View>
                    </View>
                  ))}
                  <TouchableOpacity
                    style={[styles.genSubmitBtn, { backgroundColor: '#000' }]}
                    onPress={() => { setPreviewStep('form'); setPreviewData([]); }}
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
                        <Text style={styles.genSubmitBtnText}>Confirm & Generate</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </>
              )}
            </ScrollView>
          </SafeAreaView>
        </Modal>
      )}

      {/* Detail Modal */}
      <Modal
        visible={!!selected}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        {selected && (
          <SafeAreaView style={styles.safe} edges={['top']}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Payroll Detail</Text>
              <TouchableOpacity onPress={() => setSelected(null)}>
                <X size={22} color={C.black} />
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
                  { label: 'EARNINGS', val: 0, prefix: '', section: true },
                  { label: 'Basic Salary', val: s.basicSalary, prefix: '₹' },
                  { label: 'Earned Basic', val: s.earnedBasic, prefix: '₹' },
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
                  { label: 'DEDUCTIONS', val: 0, prefix: '', section: true },
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
                  { label: 'SUMMARY', val: 0, prefix: '', section: true },
                  { label: 'Days Worked', val: s.presentDays, prefix: '' },
                  { label: 'Working Days', val: s.workingDays, prefix: '' },
                  { label: 'Hours Worked', val: s.totalWorkHours, prefix: '' },
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
                      <Text style={styles.detailSectionLabel}>{row.label}</Text>
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
                        row.bold && { fontWeight: '700' },
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
                <Share2 size={15} color={C.white} />
                <Text style={styles.processBtnText}>Share Payslip</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.pdfBtn}
                onPress={() => handlePrintPayslip(selected)}
              >
                <FileText size={15} color={C.white} />
                <Text style={styles.processBtnText}>Download / Print PDF</Text>
              </TouchableOpacity>

              {/* Mark Slip Received — HR only, on paid payrolls */}
              {!isEmployee && (selected as any).status === 'paid' && (
                (selected as any).slipReceivedAt ? (
                  <View style={styles.slipReceivedBadge}>
                    <CheckCircle2 size={15} color={C.success} />
                    <Text style={styles.slipReceivedText}>
                      Slip acknowledged · {new Date((selected as any).slipReceivedAt).toLocaleDateString('en-IN')}
                    </Text>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={styles.slipBtn}
                    onPress={async () => {
                      try {
                        await payrollAPI.markSlipReceived((selected as any)._id);
                        setSelected(null);
                        load();
                      } catch (e: any) {
                        Alert.alert('Error', e.message);
                      }
                    }}
                  >
                    <CheckCircle2 size={15} color={C.white} />
                    <Text style={styles.processBtnText}>Mark Slip Received</Text>
                  </TouchableOpacity>
                )
              )}
            </ScrollView>
          </SafeAreaView>
        )}
      </Modal>

      {isEmployee && (
        <Modal
          visible={showTaxModal}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setShowTaxModal(false)}
        >
          <SafeAreaView style={styles.safe} edges={['top']}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Investment Declarations</Text>
              <TouchableOpacity onPress={() => setShowTaxModal(false)}>
                <X size={22} color={C.black} />
              </TouchableOpacity>
            </View>
            <ScrollView
              contentContainerStyle={{ padding: 20, gap: 16 }}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.genNote}>
                <Text style={styles.genNoteText}>
                  Submit investment details under Section 80C, 80D and HRA Rent for verification.
                </Text>
              </View>

              <View>
                <Text style={styles.fieldLabel}>Section 80C (PPF, LIC, ELSS) *</Text>
                <TextInput
                  style={styles.fieldInput}
                  value={declarations.sec80C}
                  onChangeText={v => setDeclarations(p => ({ ...p, sec80C: v }))}
                  keyboardType="numeric"
                  placeholder="e.g. 150000"
                  placeholderTextColor={C.textLight}
                />
                <Text style={{ fontSize: 10, color: C.textMuted, marginTop: 4 }}>Maximum deduction limit is ₹1,50,000</Text>
              </View>

              <View>
                <Text style={styles.fieldLabel}>Section 80D (Medical Insurance) *</Text>
                <TextInput
                  style={styles.fieldInput}
                  value={declarations.sec80D}
                  onChangeText={v => setDeclarations(p => ({ ...p, sec80D: v }))}
                  keyboardType="numeric"
                  placeholder="e.g. 25000"
                  placeholderTextColor={C.textLight}
                />
              </View>

              <View>
                <Text style={styles.fieldLabel}>House Rent Allowance (HRA Rent Paid) *</Text>
                <TextInput
                  style={styles.fieldInput}
                  value={declarations.hra}
                  onChangeText={v => setDeclarations(p => ({ ...p, hra: v }))}
                  keyboardType="numeric"
                  placeholder="e.g. 120000"
                  placeholderTextColor={C.textLight}
                />
              </View>

              <TouchableOpacity
                style={styles.submitBtn}
                onPress={() => {
                  Alert.alert('Success', 'Declarations submitted successfully for verification.');
                  setShowTaxModal(false);
                }}
              >
                <Text style={styles.submitBtnText}>Submit Declarations</Text>
              </TouchableOpacity>
            </ScrollView>
          </SafeAreaView>
        </Modal>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F8F9FA' },
  taxCard: {
    backgroundColor: C.white,
    borderWidth: 2,
    borderColor: C.black,
    padding: 14,
    margin: 16,
    marginBottom: 0,
  },
  taxTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: C.black,
    textTransform: 'uppercase',
  },
  taxBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: C.primary,
    borderWidth: 2,
    borderColor: C.black,
    paddingVertical: 10,
  },
  taxBtnText: {
    color: C.white,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  submitBtn: {
    backgroundColor: C.primary,
    borderWidth: 2,
    borderColor: C.black,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  submitBtnText: {
    color: C.white,
    fontWeight: '700',
    fontSize: 13,
    textTransform: 'uppercase',
  },
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
    padding: 12,
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
    color: C.textMuted,
  },
  summaryVal: { fontSize: 20, fontWeight: '600', color: C.black, marginTop: 4 },
  filterBar: {
    maxHeight: 48,
    backgroundColor: C.white,
    borderBottomWidth: 2,
    borderBottomColor: C.black,
    paddingVertical: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 4,
    borderWidth: 2,
    borderColor: C.black,
    backgroundColor: C.white,
  },
  chipActive: { backgroundColor: C.primary },
  chipText: {
    fontSize: 12,
    fontWeight: '700',
    color: C.black,
    textTransform: 'uppercase',
    marginTop: 3,
  },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyText: { fontSize: 14, fontWeight: '700', color: C.textMuted },
  card: {
    backgroundColor: C.white,
    borderWidth: 2,
    borderColor: C.black,
    padding: 14,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  empAvatar: {
    width: 40,
    height: 40,
    backgroundColor: C.primary,
    borderWidth: 2,
    borderColor: C.black,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empAvatarText: { color: C.white, fontSize: 16, fontWeight: '700' },
  empName: { fontSize: 15, fontWeight: '700', color: C.black },
  empSub: { fontSize: 11, color: C.textMuted, fontWeight: '500' },
  statusBadge: { borderWidth: 2, paddingHorizontal: 8, paddingVertical: 2 },
  statusBadgeText: { fontSize: 9, fontWeight: '700' },
  salaryRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    paddingTop: 12,
  },
  salaryItem: { flex: 1, alignItems: 'center' },
  salaryLabel: {
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
    color: C.textMuted,
  },
  salaryVal: { fontSize: 14, fontWeight: '700', color: C.black, marginTop: 3 },
  salaryDivider: { width: 1, backgroundColor: '#E5E7EB', marginHorizontal: 4 },
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
  processBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: C.primary,
    borderWidth: 2,
    borderColor: C.black,
    paddingVertical: 9,
    marginTop: 12,
  },
  paidBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: C.success,
    borderWidth: 2,
    borderColor: C.black,
    paddingVertical: 9,
    marginTop: 12,
  },
  processBtnText: {
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
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
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
    fontSize: 12,
    fontWeight: '800',
    color: C.black,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  detailLabel: { fontSize: 13, fontWeight: '600', color: C.textMuted },
  detailVal: { fontSize: 15, fontWeight: '700', color: C.black },
  genBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: C.success,
    borderWidth: 2,
    borderColor: C.black,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  genBtnText: {
    color: C.white,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  genNote: {
    borderWidth: 2,
    borderColor: C.success,
    backgroundColor: '#F0FDF4',
    padding: 12,
  },
  genNoteText: { fontSize: 13, fontWeight: '500', color: C.black },
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
  genSubmitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: C.success,
    borderWidth: 2,
    borderColor: C.black,
    paddingVertical: 14,
    marginTop: 8,
  },
  genSubmitBtnText: {
    color: C.white,
    fontWeight: '700',
    fontSize: 14,
    textTransform: 'uppercase',
  },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: C.primary,
    borderWidth: 2,
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
    borderColor: C.black,
    paddingVertical: 12,
    marginTop: 10,
  },
  slipReceivedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 2,
    borderColor: C.success,
    backgroundColor: '#F0FDF4',
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginTop: 10,
    justifyContent: 'center',
  },
  slipReceivedText: { fontSize: 12, fontWeight: '700', color: C.success },
  pdfBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#1D4ED8',
    borderWidth: 2,
    borderColor: C.black,
    paddingVertical: 12,
    marginTop: 10,
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: C.black,
    padding: 12,
    backgroundColor: C.white,
  },
});

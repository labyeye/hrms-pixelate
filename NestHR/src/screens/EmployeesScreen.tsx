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
  Switch,
  Image,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Search,
  Plus,
  Trash2,
  Mail,
  Phone,
  Briefcase,
  X,
  Check,
  Users,
  Edit2,
  ClipboardList,
  Receipt,
  Landmark,
  Wallet,
  TrendingUp,
  AlertTriangle,
  Timer,
  IndianRupee,
  CalendarDays,
  KeyRound,
  LogIn,
  LogOut,
} from 'lucide-react-native';
import { launchImageLibrary, launchCamera } from 'react-native-image-picker';
import {
  employeeAPI,
  departmentAPI,
  shiftAPI,
  transactionAPI,
  loanAPI,
  payrollAPI,
  attendanceAPI,
  leaveAPI,
} from '../api/api';
import { Employee } from '../types/hrms';
import { C } from '../theme';

const STATUS_COLOR: Record<string, string> = {
  active: C.success,
  inactive: '#9CA3AF',
  terminated: C.danger,
  on_leave: C.warning,
};

const STATUS_CONFIG: Record<string, { color: string; bg: string }> = {
  active: { color: C.success, bg: '#F0FDF4' },
  inactive: { color: '#9CA3AF', bg: '#F9FAFB' },
  on_leave: { color: C.warning, bg: '#FFF7ED' },
  terminated: { color: C.danger, bg: '#FEF2F2' },
};
const EMP_TYPES = ['full_time', 'part_time', 'contract', 'intern'];
const GENDERS = ['male', 'female', 'other'];
const WORK_DAYS = [5, 6, 7];
const STATUSES = ['active', 'inactive', 'on_leave', 'terminated'];

const EMPTY_FORM = {
  // Tab 1 Basic Info
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  designation: '',
  joiningDate: '',
  gender: '',
  department: '',
  employmentType: 'full_time',
  status: 'active',
  defaultPassword: '',
  // Tab 2 Attendance
  workDaysPerWeek: 5,
  enableOvertime: false,
  otRate: '',
  biometricUserId: '',
  shift: '',
  // Tab 3 Salary
  monthlySalary: '',
  pfNumber: '',
  uanNumber: '',
  esicNumber: '',
  // Tab 4 Other Info
  dateOfBirth: '',
  emergencyContact: '',
  address: '',
  panNumber: '',
  aadharNumber: '',
  accountHolderName: '',
  bankAccountNumber: '',
  ifscCode: '',
  bankName: '',
};

const TABS = ['Basic Info', 'Attendance', 'Salary', 'Other Info'];

export default function EmployeesScreen() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [filtered, setFiltered] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [departments, setDepartments] = useState<any[]>([]);
  const [shifts, setShifts] = useState<any[]>([]);
  const [editingEmp, setEditingEmp] = useState<Employee | null>(null);
  const [form, setForm] = useState<typeof EMPTY_FORM>({ ...EMPTY_FORM });
  const [activeTab, setActiveTab] = useState(0);
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [detailEmp, setDetailEmp] = useState<Employee | null>(null);
  const [actionModal, setActionModal] = useState<string | null>(null);
  const [actionForm, setActionForm] = useState<Record<string, any>>({});
  const [actionLoading, setActionLoading] = useState(false);
  const [actionRecords, setActionRecords] = useState<any[]>([]);
  const [actionRecordsLoading, setActionRecordsLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await employeeAPI.getAll();
      const data: Employee[] = res.data || [];
      setEmployees(data);
      setFiltered(data);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMeta = useCallback(async () => {
    try {
      const [deptRes, shiftRes] = await Promise.all([
        departmentAPI.getAll(),
        shiftAPI.getAll(),
      ]);
      setDepartments(deptRes.data || []);
      setShifts(shiftRes.data || []);
    } catch {}
  }, []);

  useEffect(() => {
    load();
    loadMeta();
  }, [load, loadMeta]);

  useEffect(() => {
    let list = employees;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        e =>
          `${e.firstName} ${e.lastName}`.toLowerCase().includes(q) ||
          e.employeeId?.toLowerCase().includes(q) ||
          e.email?.toLowerCase().includes(q),
      );
    }
    if (statusFilter) list = list.filter(e => e.status === statusFilter);
    setFiltered(list);
  }, [search, statusFilter, employees]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const pickPhoto = () => {
    Alert.alert('Update Photo', 'Choose source', [
      {
        text: 'Camera',
        onPress: () =>
          launchCamera(
            { mediaType: 'photo', quality: 0.7, includeBase64: true },
            r => {
              if (r.assets?.[0]?.base64)
                setAvatarUri(`data:image/jpeg;base64,${r.assets[0].base64}`);
            },
          ),
      },
      {
        text: 'Gallery',
        onPress: () =>
          launchImageLibrary(
            { mediaType: 'photo', quality: 0.7, includeBase64: true },
            r => {
              if (r.assets?.[0]?.base64)
                setAvatarUri(`data:image/jpeg;base64,${r.assets[0].base64}`);
            },
          ),
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const openCreate = () => {
    setEditingEmp(null);
    setForm({ ...EMPTY_FORM });
    setAvatarUri(null);
    setActiveTab(0);
    setShowForm(true);
  };

  const openEdit = (emp: Employee) => {
    setEditingEmp(emp);
    setForm({
      firstName: emp.firstName || '',
      lastName: emp.lastName || '',
      email: emp.email || '',
      phone: (emp as any).phone || '',
      designation: emp.designation || '',
      joiningDate: emp.joiningDate ? emp.joiningDate.split('T')[0] : '',
      gender: (emp as any).gender || '',
      department:
        typeof emp.department === 'object'
          ? (emp.department as any)?._id
          : emp.department || '',
      employmentType: emp.employmentType || 'full_time',
      status: emp.status || 'active',
      defaultPassword: '',
      workDaysPerWeek: (emp as any).workDaysPerWeek || 5,
      enableOvertime: !!(emp as any).enableOvertime,
      otRate: String((emp as any).otRate ?? ''),
      biometricUserId: (emp as any).biometricUserId || '',
      shift: (emp as any).shift || '',
      monthlySalary: String(
        (emp as any).monthlySalary || (emp as any).salary || '',
      ),
      pfNumber: (emp as any).pfNumber || '',
      uanNumber: (emp as any).uanNumber || '',
      esicNumber: (emp as any).esicNumber || '',
      dateOfBirth: (emp as any).dateOfBirth
        ? (emp as any).dateOfBirth.split('T')[0]
        : '',
      emergencyContact: (emp as any).emergencyContact || '',
      address: (emp as any).address || '',
      panNumber: (emp as any).panNumber || '',
      aadharNumber: (emp as any).aadharNumber || '',
      accountHolderName: (emp as any).accountHolderName || '',
      bankAccountNumber: (emp as any).bankAccountNumber || '',
      ifscCode: (emp as any).ifscCode || '',
      bankName: (emp as any).bankName || '',
    });
    setAvatarUri((emp as any).avatar || null);
    setActiveTab(0);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.firstName.trim() || !form.lastName.trim() || !form.email.trim()) {
      Alert.alert('Validation', 'First name, last name and email are required');
      return;
    }
    setSaving(true);
    try {
      const body: any = {
        ...form,
        monthlySalary: form.monthlySalary
          ? parseFloat(form.monthlySalary)
          : undefined,
        otRate: form.otRate ? parseFloat(form.otRate) : undefined,
        salary: form.monthlySalary ? parseFloat(form.monthlySalary) : undefined,
        ...(avatarUri ? { avatar: avatarUri } : {}),
      };
      if (!editingEmp && !body.defaultPassword) delete body.defaultPassword;
      if (editingEmp) {
        await employeeAPI.update(editingEmp._id, body);
        await load();
      } else {
        const res = await employeeAPI.create(body);
        setEmployees(prev => [res.data, ...prev]);
      }
      setShowForm(false);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (emp: Employee) => {
    Alert.alert(
      'Delete Employee',
      `Remove ${emp.firstName} ${emp.lastName}? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await employeeAPI.delete(emp._id);
              setEmployees(prev => prev.filter(e => e._id !== emp._id));
            } catch (e: any) {
              Alert.alert('Error', e.message);
            }
          },
        },
      ],
    );
  };

  const openAction = async (action: string) => {
    if (!detailEmp) return;
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const month = now.getMonth() + 1;
    const year = now.getFullYear();
    setActionForm({ date: todayStr, month: String(month), year: String(year) });
    setActionRecords([]);
    setActionModal(action);

    if (
      action === 'attendance' ||
      action === 'payroll' ||
      action === 'leaves'
    ) {
      setActionRecordsLoading(true);
      try {
        if (action === 'attendance') {
          const res = await attendanceAPI.getAll({ employeeId: detailEmp._id });
          setActionRecords((res.data || []).slice(0, 10));
        } else if (action === 'payroll') {
          const res = await payrollAPI.getAll({ employee: detailEmp._id });
          setActionRecords((res.data || []).slice(0, 10));
        } else if (action === 'leaves') {
          const res = await leaveAPI.getAll({ employee: detailEmp._id });
          setActionRecords(res.data || []);
        }
      } catch {}
      setActionRecordsLoading(false);
    }
  };

  const submitAction = async () => {
    if (!detailEmp) return;
    setActionLoading(true);
    try {
      if (
        actionModal === 'allowance' ||
        actionModal === 'penalty' ||
        actionModal === 'overtime'
      ) {
        const payload: any = {
          employee: detailEmp._id,
          type: actionModal,
          date: actionForm.date,
          remark: actionForm.remark || '',
        };
        if (actionModal === 'overtime') {
          payload.hours = parseFloat(actionForm.hours || '0');
          payload.amount = 0;
        } else {
          payload.amount = parseFloat(actionForm.amount || '0');
        }
        await transactionAPI.create(payload);
        const label =
          actionModal === 'allowance'
            ? 'Allowance/Bonus'
            : actionModal === 'overtime'
              ? 'Overtime'
              : 'Penalty';
        Alert.alert('Success', `${label} added successfully`);
      } else if (actionModal === 'loan' || actionModal === 'advance') {
        await loanAPI.create({
          employee: detailEmp._id,
          type: actionModal,
          amount: parseFloat(actionForm.amount || '0'),
          remainingBalance: parseFloat(actionForm.amount || '0'),
          monthlyEmi: parseFloat(actionForm.monthlyEmi || '0'),
          reason: actionForm.reason || '',
        });
        Alert.alert(
          'Success',
          `${actionModal === 'loan' ? 'Loan' : 'Advance'} added`,
        );
        await load();
      } else if (actionModal === 'salary') {
        const month = parseInt(actionForm.month || '1');
        const year = parseInt(actionForm.year || '2025');
        const res = await payrollAPI.process({
          employees: [detailEmp._id],
          month,
          year,
        });
        const payrollId = res.data?.[0]?._id || res.data?._id;
        if (payrollId) await payrollAPI.markPaid(payrollId);
        Alert.alert('Success', 'Salary processed and marked paid');
      } else if (actionModal === 'credentials') {
        if (!actionForm.password || actionForm.password.length < 6) {
          Alert.alert('Validation', 'Password must be at least 6 characters');
          setActionLoading(false);
          return;
        }
        await employeeAPI.resetPassword(detailEmp._id, actionForm.password);
        Alert.alert('Success', 'Password reset successfully');
      }
      setActionModal(null);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setActionLoading(false);
    }
  };

  const ACTION_ITEMS = [
    {
      key: 'attendance',
      label: 'Attendance Log',
      icon: ClipboardList,
      color: C.primary,
    },
    {
      key: 'payroll',
      label: 'Payment History',
      icon: Receipt,
      color: '#7C3AED',
    },
    { key: 'loan', label: 'Add Loan', icon: Landmark, color: C.warning },
    { key: 'advance', label: 'Add Advance', icon: Wallet, color: '#0891B2' },
    {
      key: 'allowance',
      label: 'Allowance / Bonus',
      icon: TrendingUp,
      color: C.success,
    },
    { key: 'penalty', label: 'Penalty', icon: AlertTriangle, color: C.danger },
    { key: 'overtime', label: 'Overtime', icon: Timer, color: '#EA580C' },
    { key: 'salary', label: 'Pay Salary', icon: IndianRupee, color: '#059669' },
    {
      key: 'leaves',
      label: 'Leave Balance',
      icon: CalendarDays,
      color: '#DB2777',
    },
    {
      key: 'credentials',
      label: 'Credentials',
      icon: KeyRound,
      color: '#4F46E5',
    },
  ];

  const F = (label: string, key: keyof typeof EMPTY_FORM, props: any = {}) => (
    <View>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={[
          styles.fieldInput,
          props.multiline && { minHeight: 70, textAlignVertical: 'top' },
        ]}
        value={String(form[key] ?? '')}
        onChangeText={(v: string) => setForm(p => ({ ...p, [key]: v }))}
        placeholderTextColor={C.textLight}
        {...props}
      />
    </View>
  );

  const Select = (
    label: string,
    key: keyof typeof EMPTY_FORM,
    options: { value: any; label: string }[],
  ) => (
    <View>
      <Text style={styles.fieldLabel}>{label}</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8, marginTop: 4 }}
      >
        {options.map(o => (
          <TouchableOpacity
            key={String(o.value)}
            style={[
              styles.selChip,
              form[key] === o.value && styles.selChipActive,
            ]}
            onPress={() => setForm(p => ({ ...p, [key]: o.value }))}
          >
            <Text
              style={[
                styles.selChipText,
                form[key] === o.value && { color: C.white },
              ]}
            >
              {o.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );

  const getDeptName = (dept: any) => {
    if (!dept) return 'No department';
    if (typeof dept === 'string')
      return departments.find(d => d._id === dept)?.name || 'N/A';
    return dept.name;
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Users size={20} color={C.primary} />
          <Text style={styles.headerTitle}>Employees</Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={openCreate}>
          <Plus size={14} color={C.white} />
          <Text style={styles.addBtnText}>Add</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.searchWrap}>
        <Search size={15} color={C.textMuted} />
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search by name, ID or email…"
          placeholderTextColor={C.textLight}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <X size={14} color={C.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterBar}
        contentContainerStyle={styles.filterContent}
      >
        {/* ALL pill */}
        <TouchableOpacity
          style={[
            styles.summaryPill,
            {
              backgroundColor: statusFilter === '' ? C.primary : '#F3F4F6',
              borderColor: C.primary,
            },
          ]}
          onPress={() => setStatusFilter('')}
          activeOpacity={0.8}
        >
          <Text
            style={[
              styles.summaryCount,
              { color: statusFilter === '' ? C.white : C.primary },
            ]}
          >
            {employees.length}
          </Text>
          <Text
            style={[
              styles.summaryStatus,
              { color: statusFilter === '' ? C.white : C.primary },
            ]}
          >
            All
          </Text>
        </TouchableOpacity>

        {Object.entries(STATUS_CONFIG).map(([status, cfg]) => {
          const count = employees.filter(e => e.status === status).length;
          const active = statusFilter === status;
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
              <Users size={40} color="#D1D5DB" />
              <Text style={styles.emptyText}>No employees found</Text>
            </View>
          }
          renderItem={({ item }) => {
            const statusColor = STATUS_COLOR[item.status] || '#9CA3AF';
            return (
              <TouchableOpacity
                style={styles.card}
                onPress={() => setDetailEmp(item)}
                activeOpacity={0.85}
              >
                <View style={styles.cardTop}>
                  {(item as any).avatar ? (
                    <Image
                      source={{ uri: (item as any).avatar }}
                      style={[styles.avatarImg, { borderColor: statusColor }]}
                    />
                  ) : (
                    <View
                      style={[
                        styles.avatar,
                        {
                          backgroundColor: C.primary,
                          borderColor: statusColor,
                        },
                      ]}
                    >
                      <Text style={styles.avatarText}>
                        {item.firstName[0]}
                        {item.lastName[0]}
                      </Text>
                    </View>
                  )}
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.empName}>
                      {item.firstName} {item.lastName}
                    </Text>
                    <Text style={styles.empId}>{item.employeeId}</Text>
                    <Text style={styles.empDesig} numberOfLines={1}>
                      {item.designation || getDeptName(item.department)}
                    </Text>
                    {(item as any).loanBalance > 0 && (
                      <View style={styles.loanBadge}>
                        <Text style={styles.loanBadgeText}>
                          Loan: ₹{((item as any).loanBalance / 1000).toFixed(1)}
                          K
                        </Text>
                      </View>
                    )}
                  </View>
                  <View
                    style={[
                      styles.statusBadge,
                      { backgroundColor: statusColor, borderColor: C.black },
                    ]}
                  >
                    <Text style={[styles.statusText, { color: C.white }]}>
                      {item.status.replace('_', ' ').toUpperCase()}
                    </Text>
                  </View>
                </View>
                <View style={styles.cardMeta}>
                  {item.email && (
                    <View style={styles.metaItem}>
                      <Mail size={11} color={C.textMuted} />
                      <Text style={styles.metaText} numberOfLines={1}>
                        {item.email}
                      </Text>
                    </View>
                  )}
                  {(item as any).phone && (
                    <View style={styles.metaItem}>
                      <Phone size={11} color={C.textMuted} />
                      <Text style={styles.metaText}>{(item as any).phone}</Text>
                    </View>
                  )}
                  {(item.salary || (item as any).monthlySalary) && (
                    <View style={styles.metaItem}>
                      <Briefcase size={11} color={C.textMuted} />
                      <Text style={styles.metaText}>
                        ₹
                        {(
                          (item as any).monthlySalary ||
                          item.salary ||
                          0
                        ).toLocaleString()}
                        /mo
                      </Text>
                    </View>
                  )}
                </View>
                <View style={styles.cardBottom}>
                  <View style={styles.typePill}>
                    <Text style={styles.typePillText}>
                      {item.employmentType.replace('_', ' ').toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    <TouchableOpacity
                      onPress={e => {
                        e.stopPropagation?.();
                        openEdit(item);
                      }}
                      style={styles.editBtn}
                    >
                      <Edit2 size={13} color={C.primary} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={e => {
                        e.stopPropagation?.();
                        handleDelete(item);
                      }}
                      style={styles.deleteBtn}
                    >
                      <Trash2 size={13} color={C.danger} />
                    </TouchableOpacity>
                  </View>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}

      {/* ── Employee Detail Modal (single modal, view-stack inside) ── */}
      <Modal
        visible={!!detailEmp}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => {
          if (actionModal) {
            setActionModal(null);
          } else {
            setDetailEmp(null);
          }
        }}
      >
        {detailEmp && (
          <SafeAreaView style={styles.safe} edges={['top']}>
            {/* Header — changes based on current view */}
            <View style={styles.modalHeader}>
              {actionModal ? (
                <TouchableOpacity
                  onPress={() => setActionModal(null)}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
                >
                  <X
                    size={18}
                    color={C.black}
                    style={{ transform: [{ rotate: '180deg' }] }}
                  />
                  <Text style={[styles.modalTitle, { fontSize: 16 }]}>
                    {ACTION_ITEMS.find(a => a.key === actionModal)?.label}
                  </Text>
                </TouchableOpacity>
              ) : (
                <Text style={styles.modalTitle}>Employee Detail</Text>
              )}
              <TouchableOpacity
                onPress={() => {
                  setActionModal(null);
                  setDetailEmp(null);
                }}
              >
                <X size={22} color={C.black} />
              </TouchableOpacity>
            </View>

            {/* ── MAIN DETAIL VIEW ── */}
            {!actionModal && (
              <ScrollView
                contentContainerStyle={{
                  padding: 16,
                  gap: 14,
                  paddingBottom: 40,
                }}
                showsVerticalScrollIndicator={false}
              >
                {/* Profile header */}
                <View
                  style={{ alignItems: 'center', paddingVertical: 12, gap: 8 }}
                >
                  {(detailEmp as any).avatar ? (
                    <Image
                      source={{ uri: (detailEmp as any).avatar }}
                      style={{
                        width: 80,
                        height: 80,
                        borderRadius: 40,
                        borderWidth: 3,
                        borderColor: STATUS_COLOR[detailEmp.status] || C.black,
                      }}
                    />
                  ) : (
                    <View
                      style={{
                        width: 80,
                        height: 80,
                        borderRadius: 40,
                        backgroundColor: C.primary,
                        borderWidth: 3,
                        borderColor: STATUS_COLOR[detailEmp.status] || C.black,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Text
                        style={{
                          color: C.white,
                          fontSize: 26,
                          fontWeight: '700',
                        }}
                      >
                        {detailEmp.firstName[0]}
                        {detailEmp.lastName[0]}
                      </Text>
                    </View>
                  )}
                  <Text
                    style={{ fontSize: 20, fontWeight: '700', color: C.black }}
                  >
                    {detailEmp.firstName} {detailEmp.lastName}
                  </Text>
                  <Text
                    style={{
                      fontSize: 12,
                      color: C.textMuted,
                      fontFamily: 'monospace',
                    }}
                  >
                    {detailEmp.employeeId}
                  </Text>
                  <View
                    style={[
                      styles.statusBadge,
                      {
                        backgroundColor:
                          STATUS_COLOR[detailEmp.status] || '#9CA3AF',
                        borderColor: C.black,
                      },
                    ]}
                  >
                    <Text style={[styles.statusText, { color: C.white }]}>
                      {detailEmp.status.replace('_', ' ').toUpperCase()}
                    </Text>
                  </View>
                </View>

                {/* Info table */}
                <View
                  style={{
                    borderWidth: 2,
                    borderColor: C.black,
                    backgroundColor: C.white,
                  }}
                >
                  {(
                    [
                      ['Designation', detailEmp.designation || '—'],
                      ['Department', getDeptName(detailEmp.department)],
                      [
                        'Employment Type',
                        detailEmp.employmentType
                          ?.replace('_', ' ')
                          .toUpperCase() || '—',
                      ],
                      [
                        'Joining Date',
                        detailEmp.joiningDate
                          ? new Date(detailEmp.joiningDate).toLocaleDateString(
                              'en-IN',
                              {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric',
                              },
                            )
                          : '—',
                      ],
                      ['Email', detailEmp.email || '—'],
                      ['Phone', (detailEmp as any).phone || '—'],
                      ...(detailEmp.salary || (detailEmp as any).monthlySalary
                        ? [
                            [
                              'Monthly Salary',
                              `₹${((detailEmp as any).monthlySalary || detailEmp.salary || 0).toLocaleString()}`,
                            ],
                          ]
                        : []),
                      ...((detailEmp as any).loanBalance > 0
                        ? [
                            [
                              'Loan Balance',
                              `₹${(detailEmp as any).loanBalance.toLocaleString()}`,
                            ],
                          ]
                        : []),
                      ...((detailEmp as any).advanceBalance > 0
                        ? [
                            [
                              'Advance Balance',
                              `₹${(detailEmp as any).advanceBalance.toLocaleString()}`,
                            ],
                          ]
                        : []),
                    ] as [string, string][]
                  ).map(([label, value], i, arr) => (
                    <View
                      key={label}
                      style={{
                        flexDirection: 'row',
                        paddingHorizontal: 14,
                        paddingVertical: 11,
                        borderBottomWidth: i < arr.length - 1 ? 1 : 0,
                        borderBottomColor: '#F3F4F6',
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 11,
                          fontWeight: '700',
                          color: C.textMuted,
                          textTransform: 'uppercase',
                          width: 130,
                        }}
                      >
                        {label}
                      </Text>
                      <Text
                        style={{
                          fontSize: 13,
                          fontWeight: '500',
                          color: C.black,
                          flex: 1,
                        }}
                      >
                        {value}
                      </Text>
                    </View>
                  ))}
                </View>

                {/* Action grid */}
                <View>
                  <Text style={styles.sectionDividerText}>Quick Actions</Text>
                  <View style={styles.actionGrid}>
                    {ACTION_ITEMS.map(({ key, label, icon: Icon, color }) => (
                      <TouchableOpacity
                        key={key}
                        style={styles.actionCell}
                        onPress={() => openAction(key)}
                        activeOpacity={0.75}
                      >
                        <View
                          style={[
                            styles.actionIcon,
                            {
                              backgroundColor: color + '18',
                              borderColor: color,
                            },
                          ]}
                        >
                          <Icon size={20} color={color} />
                        </View>
                        <Text style={styles.actionLabel}>{label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* Contact Information */}
                <View style={styles.infoSection}>
                  <View style={styles.infoSectionHeader}>
                    <Phone size={14} color={C.primary} />
                    <Text style={styles.infoSectionTitle}>
                      Contact Information
                    </Text>
                  </View>
                  {(
                    [
                      ['Email', detailEmp.email || '—'],
                      ['Phone', (detailEmp as any).phone || '—'],
                      ['Gender', (detailEmp as any).gender || '—'],
                      [
                        'Date of Birth',
                        (detailEmp as any).dateOfBirth
                          ? new Date(
                              (detailEmp as any).dateOfBirth,
                            ).toLocaleDateString('en-IN', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                            })
                          : '—',
                      ],
                      [
                        'Emergency Contact',
                        (detailEmp as any).emergencyContact || '—',
                      ],
                      ['Address', (detailEmp as any).address || '—'],
                    ] as [string, string][]
                  ).map(([label, value], i, arr) => (
                    <View
                      key={label}
                      style={{
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        paddingVertical: 9,
                        paddingHorizontal: 14,
                        borderBottomWidth: i < arr.length - 1 ? 1 : 0,
                        borderBottomColor: '#F3F4F6',
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 10,
                          fontWeight: '700',
                          color: C.textMuted,
                          textTransform: 'uppercase',
                        }}
                      >
                        {label}
                      </Text>
                      <Text
                        style={{
                          fontSize: 12,
                          fontWeight: '600',
                          color: C.black,
                          textAlign: 'right',
                          flex: 1,
                          marginLeft: 12,
                        }}
                      >
                        {value}
                      </Text>
                    </View>
                  ))}
                </View>

                {/* Banking & Compliance */}
                <View style={styles.infoSection}>
                  <View style={styles.infoSectionHeader}>
                    <Briefcase size={14} color={C.primary} />
                    <Text style={styles.infoSectionTitle}>
                      Banking & Compliance
                    </Text>
                  </View>
                  {(
                    [
                      ['Bank', (detailEmp as any).bankName || '—'],
                      [
                        'Account No.',
                        (detailEmp as any).bankAccountNumber || '—',
                      ],
                      [
                        'Account Holder',
                        (detailEmp as any).accountHolderName || '—',
                      ],
                      ['IFSC', (detailEmp as any).ifscCode || '—'],
                      ['PAN', (detailEmp as any).panNumber || '—'],
                      ['Aadhar', (detailEmp as any).aadharNumber || '—'],
                      ['PF No.', (detailEmp as any).pfNumber || '—'],
                      ['UAN', (detailEmp as any).uanNumber || '—'],
                      ['ESIC', (detailEmp as any).esicNumber || '—'],
                    ] as [string, string][]
                  ).map(([label, value], i, arr) => (
                    <View
                      key={label}
                      style={{
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        paddingVertical: 9,
                        paddingHorizontal: 14,
                        borderBottomWidth: i < arr.length - 1 ? 1 : 0,
                        borderBottomColor: '#F3F4F6',
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 10,
                          fontWeight: '700',
                          color: C.textMuted,
                          textTransform: 'uppercase',
                        }}
                      >
                        {label}
                      </Text>
                      <Text
                        style={{
                          fontSize: 12,
                          fontWeight: '600',
                          color: C.black,
                          textAlign: 'right',
                          flex: 1,
                          marginLeft: 12,
                        }}
                      >
                        {value}
                      </Text>
                    </View>
                  ))}
                </View>

                {/* Edit profile button */}
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <TouchableOpacity
                    style={[styles.submitBtn, { flex: 1 }]}
                    onPress={() => {
                      setDetailEmp(null);
                      openEdit(detailEmp);
                    }}
                  >
                    <Edit2 size={14} color={C.white} />
                    <Text style={styles.submitBtnText}>Edit Profile</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.navBtn, { flex: 1 }]}
                    onPress={() => setDetailEmp(null)}
                  >
                    <Text style={styles.navBtnText}>Close</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            )}

            {/* ── ACTION VIEW (replaces detail content in-place) ── */}
            {!!actionModal && (
              <ScrollView
                contentContainerStyle={{
                  padding: 20,
                  gap: 14,
                  paddingBottom: 40,
                }}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                {/* Employee badge */}
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 10,
                    padding: 12,
                    backgroundColor: C.primary + '12',
                    borderWidth: 2,
                    borderColor: C.primary,
                  }}
                >
                  <View
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 18,
                      backgroundColor: C.primary,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Text
                      style={{
                        color: C.white,
                        fontWeight: '700',
                        fontSize: 13,
                      }}
                    >
                      {detailEmp.firstName[0]}
                      {detailEmp.lastName[0]}
                    </Text>
                  </View>
                  <View>
                    <Text
                      style={{
                        fontSize: 14,
                        fontWeight: '700',
                        color: C.black,
                      }}
                    >
                      {detailEmp.firstName} {detailEmp.lastName}
                    </Text>
                    <Text style={{ fontSize: 11, color: C.textMuted }}>
                      {detailEmp.employeeId}
                    </Text>
                  </View>
                </View>

                {/* ALLOWANCE / PENALTY / OVERTIME */}
                {(actionModal === 'allowance' ||
                  actionModal === 'penalty' ||
                  actionModal === 'overtime') && (
                  <>
                    {actionModal === 'overtime' ? (
                      <View>
                        <Text style={styles.fieldLabel}>Hours *</Text>
                        <TextInput
                          style={styles.fieldInput}
                          keyboardType="numeric"
                          placeholder="e.g. 2.5"
                          placeholderTextColor={C.textLight}
                          value={actionForm.hours || ''}
                          onChangeText={v =>
                            setActionForm((p: any) => ({ ...p, hours: v }))
                          }
                        />
                      </View>
                    ) : (
                      <View>
                        <Text style={styles.fieldLabel}>Amount (₹) *</Text>
                        <TextInput
                          style={styles.fieldInput}
                          keyboardType="numeric"
                          placeholder="e.g. 500"
                          placeholderTextColor={C.textLight}
                          value={actionForm.amount || ''}
                          onChangeText={v =>
                            setActionForm((p: any) => ({ ...p, amount: v }))
                          }
                        />
                      </View>
                    )}
                    <View>
                      <Text style={styles.fieldLabel}>Date *</Text>
                      <TextInput
                        style={styles.fieldInput}
                        placeholder="YYYY-MM-DD"
                        placeholderTextColor={C.textLight}
                        value={actionForm.date || ''}
                        onChangeText={v =>
                          setActionForm((p: any) => ({ ...p, date: v }))
                        }
                      />
                    </View>
                    <View>
                      <Text style={styles.fieldLabel}>Remark</Text>
                      <TextInput
                        style={[styles.fieldInput, { minHeight: 70 }]}
                        multiline
                        placeholder="Optional note…"
                        placeholderTextColor={C.textLight}
                        value={actionForm.remark || ''}
                        onChangeText={v =>
                          setActionForm((p: any) => ({ ...p, remark: v }))
                        }
                      />
                    </View>
                  </>
                )}

                {/* LOAN */}
                {actionModal === 'loan' && (
                  <>
                    <View>
                      <Text style={styles.fieldLabel}>Loan Amount (₹) *</Text>
                      <TextInput
                        style={styles.fieldInput}
                        keyboardType="numeric"
                        placeholder="e.g. 10000"
                        placeholderTextColor={C.textLight}
                        value={actionForm.amount || ''}
                        onChangeText={v =>
                          setActionForm((p: any) => ({ ...p, amount: v }))
                        }
                      />
                    </View>
                    <View>
                      <Text style={styles.fieldLabel}>Monthly EMI (₹)</Text>
                      <TextInput
                        style={styles.fieldInput}
                        keyboardType="numeric"
                        placeholder="e.g. 1000"
                        placeholderTextColor={C.textLight}
                        value={actionForm.monthlyEmi || ''}
                        onChangeText={v =>
                          setActionForm((p: any) => ({ ...p, monthlyEmi: v }))
                        }
                      />
                    </View>
                    <View>
                      <Text style={styles.fieldLabel}>Reason</Text>
                      <TextInput
                        style={[styles.fieldInput, { minHeight: 70 }]}
                        multiline
                        placeholder="Loan purpose…"
                        placeholderTextColor={C.textLight}
                        value={actionForm.reason || ''}
                        onChangeText={v =>
                          setActionForm((p: any) => ({ ...p, reason: v }))
                        }
                      />
                    </View>
                  </>
                )}

                {/* ADVANCE */}
                {actionModal === 'advance' && (
                  <>
                    <View>
                      <Text style={styles.fieldLabel}>
                        Advance Amount (₹) *
                      </Text>
                      <TextInput
                        style={styles.fieldInput}
                        keyboardType="numeric"
                        placeholder="e.g. 2000"
                        placeholderTextColor={C.textLight}
                        value={actionForm.amount || ''}
                        onChangeText={v =>
                          setActionForm((p: any) => ({ ...p, amount: v }))
                        }
                      />
                    </View>
                    <View>
                      <Text style={styles.fieldLabel}>Reason</Text>
                      <TextInput
                        style={[styles.fieldInput, { minHeight: 70 }]}
                        multiline
                        placeholder="Advance purpose…"
                        placeholderTextColor={C.textLight}
                        value={actionForm.reason || ''}
                        onChangeText={v =>
                          setActionForm((p: any) => ({ ...p, reason: v }))
                        }
                      />
                    </View>
                  </>
                )}

                {/* PAY SALARY */}
                {actionModal === 'salary' && (
                  <>
                    <View style={{ flexDirection: 'row', gap: 12 }}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.fieldLabel}>Month *</Text>
                        <TextInput
                          style={styles.fieldInput}
                          keyboardType="numeric"
                          placeholder="1–12"
                          placeholderTextColor={C.textLight}
                          value={actionForm.month || ''}
                          onChangeText={v =>
                            setActionForm((p: any) => ({ ...p, month: v }))
                          }
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.fieldLabel}>Year *</Text>
                        <TextInput
                          style={styles.fieldInput}
                          keyboardType="numeric"
                          placeholder="2025"
                          placeholderTextColor={C.textLight}
                          value={actionForm.year || ''}
                          onChangeText={v =>
                            setActionForm((p: any) => ({ ...p, year: v }))
                          }
                        />
                      </View>
                    </View>
                    <View
                      style={{
                        padding: 12,
                        backgroundColor: '#FFF7ED',
                        borderWidth: 1,
                        borderColor: C.warning,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 12,
                          color: C.warning,
                          fontWeight: '600',
                        }}
                      >
                        This will process and mark salary as paid for the
                        selected month.
                      </Text>
                    </View>
                  </>
                )}

                {/* CREDENTIALS */}
                {actionModal === 'credentials' && (
                  <View>
                    <Text style={styles.fieldLabel}>New Password *</Text>
                    <TextInput
                      style={styles.fieldInput}
                      secureTextEntry
                      placeholder="Min 6 characters"
                      placeholderTextColor={C.textLight}
                      value={actionForm.password || ''}
                      onChangeText={v =>
                        setActionForm((p: any) => ({ ...p, password: v }))
                      }
                    />
                  </View>
                )}

                {/* ATTENDANCE LOG */}
                {actionModal === 'attendance' &&
                  (actionRecordsLoading ? (
                    <ActivityIndicator color={C.primary} />
                  ) : actionRecords.length === 0 ? (
                    <Text
                      style={{
                        color: C.textMuted,
                        textAlign: 'center',
                        marginTop: 20,
                      }}
                    >
                      No attendance records found
                    </Text>
                  ) : (
                    <View style={{ gap: 8 }}>
                      {actionRecords.map((r: any) => (
                        <View
                          key={r._id}
                          style={{
                            borderWidth: 1,
                            borderColor: '#E5E7EB',
                            padding: 12,
                            backgroundColor: C.white,
                            flexDirection: 'row',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                          }}
                        >
                          <View>
                            <Text
                              style={{
                                fontSize: 13,
                                fontWeight: '700',
                                color: C.black,
                              }}
                            >
                              {r.date
                                ? new Date(r.date).toLocaleDateString('en-IN', {
                                    day: '2-digit',
                                    month: 'short',
                                    year: 'numeric',
                                  })
                                : '—'}
                            </Text>
                            <View
                              style={{
                                flexDirection: 'row',
                                gap: 8,
                                marginTop: 4,
                              }}
                            >
                              {r.checkIn && (
                                <View
                                  style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    gap: 3,
                                  }}
                                >
                                  <LogIn size={10} color={C.success} />
                                  <Text
                                    style={{ fontSize: 11, color: C.textMuted }}
                                  >
                                    {new Date(r.checkIn).toLocaleTimeString(
                                      [],
                                      { hour: '2-digit', minute: '2-digit' },
                                    )}
                                  </Text>
                                </View>
                              )}
                              {r.checkOut && (
                                <View
                                  style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    gap: 3,
                                  }}
                                >
                                  <LogOut size={10} color={C.danger} />
                                  <Text
                                    style={{ fontSize: 11, color: C.textMuted }}
                                  >
                                    {new Date(r.checkOut).toLocaleTimeString(
                                      [],
                                      { hour: '2-digit', minute: '2-digit' },
                                    )}
                                  </Text>
                                </View>
                              )}
                            </View>
                          </View>
                          <View
                            style={{
                              paddingHorizontal: 8,
                              paddingVertical: 3,
                              borderWidth: 1,
                              borderColor: C.black,
                            }}
                          >
                            <Text
                              style={{
                                fontSize: 10,
                                fontWeight: '700',
                                color: C.black,
                              }}
                            >
                              {r.status?.toUpperCase()}
                            </Text>
                          </View>
                        </View>
                      ))}
                    </View>
                  ))}

                {/* PAYMENT HISTORY */}
                {actionModal === 'payroll' &&
                  (actionRecordsLoading ? (
                    <ActivityIndicator color={C.primary} />
                  ) : actionRecords.length === 0 ? (
                    <Text
                      style={{
                        color: C.textMuted,
                        textAlign: 'center',
                        marginTop: 20,
                      }}
                    >
                      No payroll records found
                    </Text>
                  ) : (
                    <View style={{ gap: 8 }}>
                      {actionRecords.map((r: any) => (
                        <View
                          key={r._id}
                          style={{
                            borderWidth: 1,
                            borderColor: '#E5E7EB',
                            padding: 12,
                            backgroundColor: C.white,
                            flexDirection: 'row',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                          }}
                        >
                          <View>
                            <Text
                              style={{
                                fontSize: 13,
                                fontWeight: '700',
                                color: C.black,
                              }}
                            >
                              {r.month}/{r.year}
                            </Text>
                            <Text
                              style={{
                                fontSize: 12,
                                color: C.textMuted,
                                marginTop: 2,
                              }}
                            >
                              Net: ₹{(r.netSalary || 0).toLocaleString()}
                            </Text>
                          </View>
                          <View
                            style={{
                              paddingHorizontal: 8,
                              paddingVertical: 3,
                              borderWidth: 1,
                              borderColor:
                                r.status === 'paid' ? C.success : C.warning,
                              backgroundColor:
                                r.status === 'paid' ? '#F0FDF4' : '#FFF7ED',
                            }}
                          >
                            <Text
                              style={{
                                fontSize: 10,
                                fontWeight: '700',
                                color:
                                  r.status === 'paid' ? C.success : C.warning,
                              }}
                            >
                              {r.status?.toUpperCase()}
                            </Text>
                          </View>
                        </View>
                      ))}
                    </View>
                  ))}

                {/* LEAVE BALANCE */}
                {actionModal === 'leaves' &&
                  (actionRecordsLoading ? (
                    <ActivityIndicator color={C.primary} />
                  ) : (
                    <View style={{ gap: 8 }}>
                      {(['pending', 'approved', 'rejected'] as const).map(
                        status => {
                          const count = actionRecords.filter(
                            (l: any) => l.status === status,
                          ).length;
                          const colors: Record<string, string> = {
                            pending: C.warning,
                            approved: C.success,
                            rejected: C.danger,
                          };
                          return (
                            <View
                              key={status}
                              style={{
                                flexDirection: 'row',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                padding: 14,
                                borderWidth: 2,
                                borderColor: colors[status],
                                backgroundColor: colors[status] + '10',
                              }}
                            >
                              <Text
                                style={{
                                  fontSize: 13,
                                  fontWeight: '700',
                                  color: colors[status],
                                  textTransform: 'uppercase',
                                }}
                              >
                                {status}
                              </Text>
                              <Text
                                style={{
                                  fontSize: 22,
                                  fontWeight: '800',
                                  color: colors[status],
                                }}
                              >
                                {count}
                              </Text>
                            </View>
                          );
                        },
                      )}
                      {actionRecords.length === 0 && (
                        <Text
                          style={{
                            color: C.textMuted,
                            textAlign: 'center',
                            marginTop: 20,
                          }}
                        >
                          No leave records found
                        </Text>
                      )}
                    </View>
                  ))}

                {/* Submit for form actions */}
                {[
                  'allowance',
                  'penalty',
                  'overtime',
                  'loan',
                  'advance',
                  'salary',
                  'credentials',
                ].includes(actionModal) && (
                  <TouchableOpacity
                    style={styles.submitBtn}
                    onPress={submitAction}
                    disabled={actionLoading}
                  >
                    {actionLoading ? (
                      <ActivityIndicator color={C.white} />
                    ) : (
                      <Text style={styles.submitBtnText}>Confirm</Text>
                    )}
                  </TouchableOpacity>
                )}
              </ScrollView>
            )}
          </SafeAreaView>
        )}
      </Modal>

      <Modal
        visible={showForm}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <SafeAreaView style={styles.safe} edges={['top']}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {editingEmp ? 'Edit Employee' : 'Add Employee'}
            </Text>
            <TouchableOpacity onPress={() => setShowForm(false)}>
              <X size={22} color={C.black} />
            </TouchableOpacity>
          </View>

          {/* Tabs */}
          <View style={styles.tabBar}>
            {TABS.map((tab, i) => (
              <TouchableOpacity
                key={tab}
                style={[
                  styles.tabItem,
                  activeTab === i && styles.tabItemActive,
                ]}
                onPress={() => setActiveTab(i)}
              >
                <Text
                  style={[
                    styles.tabText,
                    activeTab === i && styles.tabTextActive,
                  ]}
                  numberOfLines={1}
                >
                  {tab}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: 20, gap: 16 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* ── Tab 1: Basic Info ── */}
            {activeTab === 0 && (
              <>
                {/* Photo picker */}
                <View style={styles.photoPicker}>
                  <TouchableOpacity
                    onPress={pickPhoto}
                    style={styles.photoWrap}
                    activeOpacity={0.8}
                  >
                    {avatarUri ? (
                      <Image
                        source={{ uri: avatarUri }}
                        style={styles.photoImg}
                      />
                    ) : (
                      <View style={styles.photoPlaceholder}>
                        <Text style={styles.photoInitials}>
                          {form.firstName
                            ? form.firstName[0].toUpperCase()
                            : '?'}
                          {form.lastName ? form.lastName[0].toUpperCase() : ''}
                        </Text>
                      </View>
                    )}
                    <View style={styles.photoEditBadge}>
                      <Text style={styles.photoEditText}>EDIT</Text>
                    </View>
                  </TouchableOpacity>
                  <Text style={styles.photoHint}>Tap to update photo</Text>
                </View>

                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <View style={{ flex: 1 }}>
                    {F('First Name *', 'firstName', { placeholder: 'John' })}
                  </View>
                  <View style={{ flex: 1 }}>
                    {F('Last Name *', 'lastName', { placeholder: 'Doe' })}
                  </View>
                </View>
                {F('Work Email *', 'email', {
                  placeholder: 'john@company.com',
                  keyboardType: 'email-address',
                  autoCapitalize: 'none',
                })}
                {F('Mobile', 'phone', {
                  placeholder: '+91 9876543210',
                  keyboardType: 'phone-pad',
                })}
                {F('Designation', 'designation', {
                  placeholder: 'e.g. Software Engineer',
                })}
                {F('Joining Date', 'joiningDate', {
                  placeholder: 'YYYY-MM-DD',
                })}
                {Select(
                  'Gender',
                  'gender',
                  GENDERS.map(g => ({
                    value: g,
                    label: g.charAt(0).toUpperCase() + g.slice(1),
                  })),
                )}
                <View>
                  <Text style={styles.fieldLabel}>Department</Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ gap: 8, marginTop: 4 }}
                  >
                    {departments.map(d => (
                      <TouchableOpacity
                        key={d._id}
                        style={[
                          styles.selChip,
                          form.department === d._id && styles.selChipActive,
                        ]}
                        onPress={() =>
                          setForm(p => ({
                            ...p,
                            department: p.department === d._id ? '' : d._id,
                          }))
                        }
                      >
                        <Text
                          style={[
                            styles.selChipText,
                            form.department === d._id && { color: C.white },
                          ]}
                        >
                          {d.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
                {Select(
                  'Employment Type',
                  'employmentType',
                  EMP_TYPES.map(t => ({
                    value: t,
                    label: t.replace('_', ' ').toUpperCase(),
                  })),
                )}
                {editingEmp &&
                  Select(
                    'Status',
                    'status',
                    STATUSES.map(s => ({
                      value: s,
                      label: s.replace('_', ' ').toUpperCase(),
                    })),
                  )}
                {!editingEmp &&
                  F('Default Password', 'defaultPassword', {
                    placeholder: 'Leave blank to auto-generate',
                    secureTextEntry: true,
                  })}
              </>
            )}

            {/* ── Tab 2: Attendance ── */}
            {activeTab === 1 && (
              <>
                <View>
                  <Text style={styles.fieldLabel}>Work Days Per Week</Text>
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
                    {WORK_DAYS.map(d => (
                      <TouchableOpacity
                        key={d}
                        style={[
                          styles.selChip,
                          form.workDaysPerWeek === d && styles.selChipActive,
                        ]}
                        onPress={() =>
                          setForm(p => ({ ...p, workDaysPerWeek: d }))
                        }
                      >
                        <Text
                          style={[
                            styles.selChipText,
                            form.workDaysPerWeek === d && { color: C.white },
                          ]}
                        >
                          {d} Days
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
                <View style={styles.toggleRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.fieldLabel}>Enable Overtime</Text>
                    <Text style={styles.toggleHint}>
                      Allow OT calculation for this employee
                    </Text>
                  </View>
                  <Switch
                    value={form.enableOvertime}
                    onValueChange={v =>
                      setForm(p => ({ ...p, enableOvertime: v }))
                    }
                    trackColor={{ true: C.primary, false: '#D1D5DB' }}
                    thumbColor={C.white}
                  />
                </View>
                {form.enableOvertime &&
                  F('OT Rate (₹/hr)', 'otRate', {
                    keyboardType: 'numeric',
                    placeholder: '50',
                  })}
                {F('Biometric User ID', 'biometricUserId', {
                  placeholder: 'Device user ID',
                  keyboardType: 'numeric',
                })}
                <View>
                  <Text style={styles.fieldLabel}>Shift</Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ gap: 8, marginTop: 4 }}
                  >
                    <TouchableOpacity
                      style={[
                        styles.selChip,
                        !form.shift && styles.selChipActive,
                      ]}
                      onPress={() => setForm(p => ({ ...p, shift: '' }))}
                    >
                      <Text
                        style={[
                          styles.selChipText,
                          !form.shift && { color: C.white },
                        ]}
                      >
                        None
                      </Text>
                    </TouchableOpacity>
                    {shifts.map(sh => (
                      <TouchableOpacity
                        key={sh._id}
                        style={[
                          styles.selChip,
                          form.shift === sh._id && styles.selChipActive,
                        ]}
                        onPress={() => setForm(p => ({ ...p, shift: sh._id }))}
                      >
                        <Text
                          style={[
                            styles.selChipText,
                            form.shift === sh._id && { color: C.white },
                          ]}
                        >
                          {sh.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              </>
            )}

            {/* ── Tab 3: Salary ── */}
            {activeTab === 2 && (
              <>
                {F('Monthly Salary (₹)', 'monthlySalary', {
                  keyboardType: 'numeric',
                  placeholder: '50000',
                })}
                {F('PF Number', 'pfNumber', {
                  placeholder: 'PF account number',
                  autoCapitalize: 'characters',
                })}
                {F('UAN Number', 'uanNumber', {
                  placeholder: 'Universal Account Number',
                  keyboardType: 'numeric',
                })}
                {F('ESIC Number', 'esicNumber', {
                  placeholder: 'ESIC account number',
                })}
              </>
            )}

            {/* ── Tab 4: Other Info ── */}
            {activeTab === 3 && (
              <>
                {F('Date of Birth', 'dateOfBirth', {
                  placeholder: 'YYYY-MM-DD',
                })}
                {F('Emergency Contact', 'emergencyContact', {
                  placeholder: 'Name & phone number',
                })}
                {F('Address', 'address', {
                  placeholder: 'Full residential address',
                  multiline: true,
                })}
                {F('PAN Number', 'panNumber', {
                  placeholder: 'ABCDE1234F',
                  autoCapitalize: 'characters',
                })}
                {F('Aadhar Number', 'aadharNumber', {
                  placeholder: '12-digit Aadhar',
                  keyboardType: 'numeric',
                })}
                <View style={styles.sectionDivider}>
                  <Text style={styles.sectionDividerText}>Bank Details</Text>
                </View>
                {F('Account Holder Name', 'accountHolderName', {
                  placeholder: 'As per bank records',
                })}
                {F('Bank Account Number', 'bankAccountNumber', {
                  placeholder: 'Account number',
                  keyboardType: 'numeric',
                })}
                {F('IFSC Code', 'ifscCode', {
                  placeholder: 'e.g. SBIN0001234',
                  autoCapitalize: 'characters',
                })}
                {F('Bank Name', 'bankName', {
                  placeholder: 'e.g. State Bank of India',
                })}
              </>
            )}

            {/* Nav + Submit */}
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
              {activeTab > 0 && (
                <TouchableOpacity
                  style={styles.navBtn}
                  onPress={() => setActiveTab(p => p - 1)}
                >
                  <Text style={styles.navBtnText}>← Previous</Text>
                </TouchableOpacity>
              )}
              {activeTab < TABS.length - 1 ? (
                <TouchableOpacity
                  style={[styles.submitBtn, { flex: 1 }]}
                  onPress={() => setActiveTab(p => p + 1)}
                >
                  <Text style={styles.submitBtnText}>Next →</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={[styles.submitBtn, { flex: 1 }]}
                  onPress={handleSave}
                  disabled={saving}
                >
                  {saving ? (
                    <ActivityIndicator color={C.white} />
                  ) : (
                    <>
                      <Check size={16} color={C.white} />
                      <Text style={styles.submitBtnText}>
                        {editingEmp ? 'Update Employee' : 'Create Employee'}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              )}
            </View>
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
  countBadge: {
    backgroundColor: C.primary,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderWidth: 2,
    borderColor: C.black,
  },
  countText: { color: C.white, fontSize: 10, fontWeight: '700' },
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
  filterBar: {
    flexShrink: 0,
    backgroundColor: C.white,
    borderBottomWidth: 2,
    borderBottomColor: C.black,
  },
  filterContent: {
    paddingHorizontal: 12,
    paddingVertical: 10,
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
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyText: { fontSize: 14, fontWeight: '700', color: C.textMuted },
  card: {
    backgroundColor: C.white,
    borderWidth: 2,
    borderColor: C.black,
    padding: 14,
  },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start' },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: C.black,
  },
  avatarImg: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: C.black,
  },
  avatarText: { color: C.white, fontWeight: '700', fontSize: 14 },
  empName: { fontSize: 15, fontWeight: '700', color: C.black },
  empId: { fontSize: 11, color: C.textMuted, fontFamily: 'monospace' },
  empDesig: {
    fontSize: 12,
    color: C.textMuted,
    fontWeight: '500',
    marginTop: 1,
  },
  statusBadge: { borderWidth: 2, paddingHorizontal: 6, paddingVertical: 2 },
  statusText: { fontSize: 9, fontWeight: '700' },
  editBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
    borderColor: C.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
    borderColor: C.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardMeta: { marginTop: 10, gap: 4 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaText: { fontSize: 12, color: C.textMuted, fontWeight: '500', flex: 1 },
  cardBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  typePill: {
    borderWidth: 2,
    borderColor: C.primary,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  typePillText: { fontSize: 9, fontWeight: '700', color: C.primary },
  joinDate: { fontSize: 11, color: C.textMuted, fontWeight: '500' },
  loanBadge: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: C.danger,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginTop: 4,
    alignSelf: 'flex-start',
  },
  loanBadgeText: { fontSize: 10, fontWeight: '700', color: C.danger },
  // Modal
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: C.white,
    borderBottomWidth: 2,
    borderBottomColor: C.black,
  },
  modalTitle: { fontSize: 20, fontWeight: '600', color: C.black },
  tabBar: {
    flexDirection: 'row',
    height: 40,
    backgroundColor: C.white,
    borderBottomWidth: 2,
    borderBottomColor: C.black,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  tabItemActive: { borderBottomColor: C.primary },
  tabText: {
    fontSize: 10,
    fontWeight: '700',
    color: C.textMuted,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  tabTextActive: { color: C.primary, fontWeight: '700' },
  photoPicker: { alignItems: 'center', paddingVertical: 8 },
  photoWrap: { position: 'relative' },
  photoImg: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 2,
    borderColor: C.black,
  },
  photoPlaceholder: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: C.primary,
    borderWidth: 2,
    borderColor: C.black,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoInitials: { color: C.white, fontSize: 28, fontWeight: '700' },
  photoEditBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    backgroundColor: C.black,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoEditText: { color: C.white, fontSize: 7, fontWeight: '700' },
  photoHint: { fontSize: 11, color: C.black, fontWeight: '500', marginTop: 8 },
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
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    backgroundColor: C.white,
  },
  toggleHint: {
    fontSize: 11,
    color: C.textMuted,
    fontWeight: '500',
    marginTop: 1,
  },
  sectionDivider: {
    borderBottomWidth: 2,
    borderBottomColor: C.black,
    paddingBottom: 6,
  },
  sectionDividerText: {
    fontSize: 11,
    fontWeight: '700',
    color: C.black,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  navBtn: {
    borderWidth: 2,
    borderColor: C.black,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.white,
  },
  navBtnText: { fontWeight: '700', fontSize: 13, color: C.black },
  submitBtn: {
    backgroundColor: C.primary,
    borderWidth: 2,
    borderColor: C.black,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  submitBtnText: {
    color: C.white,
    fontWeight: '700',
    fontSize: 14,
    textTransform: 'uppercase',
  },
  actionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 8,
  },
  actionCell: {
    width: '47%',
    borderWidth: 2,
    borderColor: C.black,
    backgroundColor: C.white,
    padding: 12,
    alignItems: 'center',
    gap: 8,
  },
  actionIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: C.black,
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  infoSection: {
    borderWidth: 2,
    borderColor: C.black,
    backgroundColor: C.white,
  },
  infoSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 2,
    borderBottomColor: C.black,
    backgroundColor: C.primary + '10',
  },
  infoSectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: C.black,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});

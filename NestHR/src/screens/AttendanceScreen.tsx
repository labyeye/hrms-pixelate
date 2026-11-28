import { sentence } from '../utils/text';
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
  Linking,
  LayoutAnimation,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { requestSelfMarkPermissions } from '../utils/location';
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
  Camera,
  MapPin,
  Building2,
  Fingerprint,
  ScanFace,
  CreditCard,
  KeyRound,
  ListChecks,
  SlidersHorizontal,
  Ellipsis,
  Download,
  AlarmClock,
  Contrast,
  TreePalm,
  CircleDashed,
  Moon,
  PartyPopper,
  Activity,
  Users,
  Timer,
  StickyNote,
  EllipsisVertical,
  ChevronDown,
  ChevronUp,
  Hourglass,
  ScanFace,
} from 'lucide-react-native';
import AttendanceFacesModal, {
  AttendanceFaces,
} from '../components/AttendanceFacesModal';
import {
  attendanceAPI,
  employeeAPI,
  settingsAPI,
  attendanceCorrectionAPI,
  preferencesAPI,
} from '../api/api';
import { useAuth } from '../contexts/AuthContext';
import { AttendanceRecord, Employee } from '../types/hrms';
import { C, useResponsive } from '../theme';
import { CENTER } from '../components/common/centerModal';
import { chooseExport } from '../utils/exporters';
import SlideInCard from '../components/motion/SlideInCard';
import Reveal from '../components/motion/Reveal';
import HeaderIconBtn from '../components/common/HeaderIconBtn';
import SearchModal from '../components/common/SearchModal';
import FilterSortModal from '../components/common/FilterSortModal';
import DashStatCard, { dashStatRow } from '../components/common/DashStatCard';
import { TimePickerField } from '../components/common/DatePickerField';

// Icon-only attendance table: fixed widths for the narrow columns, the employee column takes the rest.
const T_ATT_PHONE = {
  status: 34,
  time: 56,
  hrs: 0,
  ot: 0,
  method: 0,
  loc: 0,
  act: 56,
};
const T_ATT_TABLET = {
  status: 44,
  time: 82,
  hrs: 54,
  ot: 46,
  method: 82,
  loc: 40,
  act: 32,
};

function openLocationInMaps(loc: { lat: number; lng: number }) {
  Linking.openURL(
    `https://www.google.com/maps/search/?api=1&query=${loc.lat},${loc.lng}`,
  );
}

function showLocationOptions(item: AttendanceRecord) {
  const buttons: any[] = [];
  if (item.checkInLocation) {
    buttons.push({
      text: 'Check-in location',
      onPress: () => openLocationInMaps(item.checkInLocation!),
    });
  }
  if (item.checkOutLocation) {
    buttons.push({
      text: 'Check-out location',
      onPress: () => openLocationInMaps(item.checkOutLocation!),
    });
  }
  buttons.push({ text: 'Cancel', style: 'cancel' });
  Alert.alert('View Location', 'Open in Google Maps', buttons);
}

const STATUS_CONFIG: Record<string, { color: string; bg: string; icon: any }> =
  {
    present: { color: C.success, bg: '#E7F9F1', icon: CheckCircle2 },
    absent: { color: C.danger, bg: '#FDEBEB', icon: XCircle },
    late: { color: C.warning, bg: '#FEF3E2', icon: AlarmClock },
    half_day: { color: C.secondary, bg: '#FEEEE3', icon: Contrast },
    on_leave: { color: C.primary, bg: '#E8F0FB', icon: TreePalm },
    not_checked_in: { color: '#6B7280', bg: '#F3F4F6', icon: CircleDashed },
    weekend: { color: '#6B7280', bg: '#F3F4F6', icon: Moon },
    holiday: { color: '#A855F7', bg: '#F4EBFC', icon: PartyPopper },
  };

const VERIFY_MODE_LABELS: Record<string, string> = {
  fingerprint: 'Fingerprint',
  card: 'Card',
  face: 'Face',
  geo_camera: 'Face',
  password: 'Password',
  auto: 'Auto',
};

const VERIFY_MODE_ICONS: Record<string, any> = {
  fingerprint: Fingerprint,
  card: CreditCard,
  face: ScanFace,
  geo_camera: ScanFace,
  password: KeyRound,
  auto: Clock,
};

function isWeekendForEmployee(dateStr: string, emp: any): boolean {
  const date = new Date(dateStr + 'T00:00:00');
  const day = date.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  if (emp.workScheduleType === 'custom') {
    const working: number[] = emp.customWorkDays || [];
    return !working.includes(day);
  }
  const days = emp.workDaysPerWeek ?? 6;
  if (days === 5) return day === 0 || day === 6;
  if (days === 6) return day === 0;
  return false;
}

function toDateStr(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function timeToISO(dateStr: string, timeStr: string): string | undefined {
  if (!timeStr) return undefined;
  return `${dateStr}T${timeStr}:00+05:30`;
}

function isoToTime(iso: string | undefined): string {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

export default function AttendanceScreen({ navigation }: any) {
  const { user } = useAuth();
  const isEmployee = user?.role === 'employee';
  // Everyone except the super admin marks their own attendance (HR managers and department heads too).
  const hasSelfAttendance = !!user && user.role !== 'super_admin';
  const { isTablet, maxContentWidth } = useResponsive();
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [facesView, setFacesView] = useState<AttendanceFaces | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState(toDateStr(new Date()));
  const [statusFilter, setStatusFilter] = useState('');
  // Default view: whoever checked in first is on top; people with no check-in yet sink to the bottom.
  const [sortKey, setSortKey] = useState('checkin');
  const [searchOpen, setSearchOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [rowMenu, setRowMenu] = useState<any>(null);
  // This admin's saved filter + sort (kept in the database, so it follows them to any device)
  useEffect(() => {
    if (isEmployee) return;
    preferencesAPI
      .get('attendance.view')
      .then((r: any) => {
        const v = r?.data;
        if (v && typeof v === 'object') {
          setStatusFilter(typeof v.status === 'string' ? v.status : '');
          setSortKey(typeof v.sort === 'string' ? v.sort : 'checkin');
        }
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEmployee]);
  const saveMyView = async () => {
    try {
      await preferencesAPI.set(
        'attendance.view',
        { status: statusFilter, sort: sortKey },
        true,
      );
      Alert.alert(
        'Saved',
        'This filter and sort will open by default for you.',
      );
    } catch (e: any) {
      Alert.alert('Could not save', e?.message || 'Please try again');
    }
  };
  // Phone table: rows opened with the arrow to show times, hours, method and location
  const [expandedAtt, setExpandedAtt] = useState<string[]>([]);
  const toggleExpandAtt = (id: string) => {
    setExpandedAtt(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id],
    );
  };
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedEmpId, setSelectedEmpId] = useState('');
  const [editRecord, setEditRecord] = useState<AttendanceRecord | null>(null);
  const [form, setForm] = useState({
    status: 'present',
    checkIn: '',
    checkOut: '',
    notes: '',
    overtime: '',
    verifyMode: 'manual',
  });

  // Calendar modal state
  const [showCalendar, setShowCalendar] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState({
    year: new Date().getFullYear(),
    month: new Date().getMonth(),
  });

  // Bulk modal state
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkStatus, setBulkStatus] = useState('present');
  const [bulkSelected, setBulkSelected] = useState<string[]>([]);
  const [bulkSaving, setBulkSaving] = useState(false);

  // Correction states
  const [showCorrectionModal, setShowCorrectionModal] = useState(false);
  const [correctionForm, setCorrectionForm] = useState({
    date: toDateStr(new Date()),
    type: 'regularization',
    checkIn: '',
    checkOut: '',
    reason: '',
  });
  const [submittingCorrection, setSubmittingCorrection] = useState(false);

  // Self check-in/out (geofenced mobile attendance)
  const [myEmployee, setMyEmployee] = useState<Employee | null>(null);
  const [selfMarking, setSelfMarking] = useState<'checkin' | 'checkout' | null>(
    null,
  );

  const [canResetFace, setCanResetFace] = useState(false);
  const loadMyEmployee = useCallback(() => {
    if (!hasSelfAttendance) return;
    settingsAPI
      .get()
      .then(res => setCanResetFace(res.data?.allowEmployeeFaceReset === true))
      .catch(() => {});
    employeeAPI
      .getMe()
      .then(res => setMyEmployee(res.data || null))
      .catch(() => {});
  }, [hasSelfAttendance]);

  useEffect(() => {
    loadMyEmployee();
  }, [loadMyEmployee]);

  const hasFaceEnrolled =
    Array.isArray(myEmployee?.faceDescriptor) &&
    myEmployee!.faceDescriptor!.length === 128;

  const todayStr = toDateStr(new Date());
  const todayRecord =
    dateFilter !== todayStr
      ? undefined
      : isEmployee
      ? records[0]
      : hasSelfAttendance && myEmployee
      ? records.find(
          (r: any) =>
            String(r.employee?._id || r.employee) === String(myEmployee._id),
        )
      : undefined;

  const handleEnrollFace = async () => {
    const ok = await requestSelfMarkPermissions();
    if (!ok) {
      Alert.alert(
        'Permission Required',
        'Camera access is required to enroll your face.',
      );
      return;
    }
    navigation.navigate('FaceEnroll');
  };

  const handleResetFace = () => {
    Alert.alert(
      'Reset Face?',
      'Your enrolled face will be removed and you must enroll again before checking in.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            try {
              await employeeAPI.resetMyFace();
              loadMyEmployee();
            } catch (e: any) {
              Alert.alert('Error', e.message || 'Could not reset face.');
            }
          },
        },
      ],
    );
  };

  const handleSelfMark = async (action: 'checkin' | 'checkout') => {
    setSelfMarking(action);
    try {
      const ok = await requestSelfMarkPermissions();
      if (!ok) {
        Alert.alert(
          'Permission Required',
          'Camera and location access are required to mark attendance.',
        );
        return;
      }
      navigation.navigate('FaceCheckIn', { action });
    } finally {
      setSelfMarking(null);
    }
  };

  const handleCreateCorrection = async () => {
    if (!correctionForm.reason.trim()) {
      Alert.alert('Validation', 'Please provide a reason');
      return;
    }
    setSubmittingCorrection(true);
    try {
      let checkInISO = undefined;
      let checkOutISO = undefined;

      if (correctionForm.checkIn) {
        checkInISO = new Date(
          `${correctionForm.date}T${correctionForm.checkIn}:00`,
        ).toISOString();
      }
      if (correctionForm.checkOut) {
        checkOutISO = new Date(
          `${correctionForm.date}T${correctionForm.checkOut}:00`,
        ).toISOString();
      }

      await attendanceCorrectionAPI.create({
        date: correctionForm.date,
        type: correctionForm.type,
        checkIn: checkInISO,
        checkOut: checkOutISO,
        reason: correctionForm.reason.trim(),
      });
      Alert.alert('Success', 'Attendance correction request submitted.');
      setShowCorrectionModal(false);
      setCorrectionForm({
        date: toDateStr(new Date()),
        type: 'regularization',
        checkIn: '',
        checkOut: '',
        reason: '',
      });
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to submit request');
    } finally {
      setSubmittingCorrection(false);
    }
  };

  const load = useCallback(
    async (showLoader = true) => {
      if (showLoader) {
        setLoading(true);
        setRecords([]);
      }
      try {
        const d = new Date(dateFilter + 'T00:00:00');
        const res = await attendanceAPI.getAll({
          month: String(d.getMonth() + 1),
          year: String(d.getFullYear()),
          limit: '200',
        });
        const all: AttendanceRecord[] = res.data || [];
        const forDate = all.filter(r =>
          r.date ? toDateStr(new Date(r.date)) === dateFilter : false,
        );
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

  useFocusEffect(
    useCallback(() => {
      if (hasSelfAttendance) {
        load(false);
        loadMyEmployee();
      }
    }, [hasSelfAttendance, load, loadMyEmployee]),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load(false);
    setRefreshing(false);
  };

  const openNew = () => {
    setEditRecord(null);
    setSelectedEmpId('');
    setForm({
      status: 'present',
      checkIn: '',
      checkOut: '',
      notes: '',
      overtime: '',
      verifyMode: 'manual',
    });
    setShowModal(true);
  };

  const openMarkForEmp = (empId: string) => {
    setEditRecord(null);
    setSelectedEmpId(empId);
    setForm({
      status: 'present',
      checkIn: '',
      checkOut: '',
      notes: '',
      overtime: '',
      verifyMode: 'manual',
    });
    setShowModal(true);
  };

  const markAbsent = (empId: string) => {
    Alert.alert(
      'Mark Absent',
      `Mark this employee as absent for ${dateFilter}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Mark Absent',
          style: 'destructive',
          onPress: async () => {
            try {
              await attendanceAPI.mark({
                employee: empId,
                date: dateFilter,
                status: 'absent',
              });
              await load();
            } catch (e: any) {
              Alert.alert('Error', e.message);
            }
          },
        },
      ],
    );
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
      overtime:
        (record as any).overtime > 0 ? String((record as any).overtime) : '',
      verifyMode: (record as any).verifyMode || 'manual',
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditRecord(null);
  };

  const mergedRows = isEmployee
    ? records
    : (() => {
        const recordByEmpId = new Map(
          records.map(r => [(r.employee as any)?._id, r]),
        );
        return employees.map(emp => {
          const existing = recordByEmpId.get(emp._id);
          if (existing) return existing;
          const weekend = isWeekendForEmployee(dateFilter, emp);
          return {
            _id: `v_${emp._id}`,
            employee: emp,
            date: dateFilter,
            status: weekend ? 'weekend' : 'not_checked_in',
          } as any as AttendanceRecord;
        });
      })();

  const filtered = mergedRows.filter(r => {
    const emp = r.employee as any;
    const name = emp
      ? `${emp.firstName || ''} ${emp.lastName || ''}`.toLowerCase()
      : '';
    if (search && !name.includes(search.toLowerCase())) return false;
    if (statusFilter) {
      const pending = r.status === 'late' && !!(r as any).approvalPending;
      if (statusFilter === 'pending_approval') {
        if (!pending) return false;
      } else if (statusFilter === 'late') {
        if (r.status !== 'late' || pending) return false;
      } else if (r.status !== statusFilter) return false;
    }
    return true;
  });
  if (sortKey) {
    const nm = (r: any) =>
      `${r.employee?.firstName || ''} ${
        r.employee?.lastName || ''
      }`.toLowerCase();
    const t = (v: any) => (v ? new Date(v).getTime() : Infinity);
    filtered.sort((a: any, b: any) =>
      sortKey === 'name'
        ? nm(a).localeCompare(nm(b))
        : sortKey === 'name_desc'
        ? nm(b).localeCompare(nm(a))
        : t(a.checkIn) - t(b.checkIn),
    );
  }

  const handleSave = async () => {
    setSaving(true);
    try {
      if (editRecord) {
        await attendanceAPI.update(editRecord._id, {
          status: form.status,
          checkIn: timeToISO(dateFilter, form.checkIn),
          checkOut: timeToISO(dateFilter, form.checkOut),
          notes: form.notes,
          verifyMode: form.verifyMode,
          ...(form.overtime.trim() !== ''
            ? { overtime: parseFloat(form.overtime) || 0 }
            : {}),
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
          verifyMode: form.verifyMode,
          ...(form.overtime.trim() !== ''
            ? { overtime: parseFloat(form.overtime) || 0 }
            : {}),
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
  let pendingApprovalCount = 0;
  mergedRows.forEach(r => {
    // Late beyond the allowance waits for HR/Admin: count it separately, not as Late.
    if (r.status === 'late' && (r as any).approvalPending) {
      pendingApprovalCount++;
      return;
    }
    if (r.status in summary) summary[r.status]++;
  });

  const exportCols = [
    {
      header: 'Emp Code',
      value: (r: any) => r.employee?.employeeId,
    },
    {
      header: 'Employee',
      value: (r: any) =>
        `${r.employee?.firstName || ''} ${r.employee?.lastName || ''}`.trim(),
    },
    { header: 'Date', value: () => dateFilter },
    {
      header: 'Check In',
      value: (r: any) =>
        r.checkIn
          ? new Date(r.checkIn).toLocaleTimeString('en-IN', {
              hour: '2-digit',
              minute: '2-digit',
            })
          : '',
    },
    {
      header: 'Check Out',
      value: (r: any) =>
        r.checkOut
          ? new Date(r.checkOut).toLocaleTimeString('en-IN', {
              hour: '2-digit',
              minute: '2-digit',
            })
          : '',
    },
    {
      header: 'Hours',
      value: (r: any) => (r.workHours ? Number(r.workHours).toFixed(1) : ''),
    },
    {
      header: 'Status',
      value: (r: any) => String(r.status || '').replace(/_/g, ' '),
    },
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
          <Clock size={20} color={C.primary} />
          <Text style={styles.headerTitle}>Attendance</Text>
        </View>

        {!isEmployee ? (
          <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
            <HeaderIconBtn
              label="Search"
              icon={<Search size={22} color={C.black} />}
              dot={!!search}
              onPress={() => setSearchOpen(true)}
            />
            <HeaderIconBtn
              label="Filter and sort"
              icon={<SlidersHorizontal size={22} color={C.black} />}
              dot={!!statusFilter || sortKey !== 'checkin'}
              onPress={() => setFilterOpen(true)}
            />
            <HeaderIconBtn
              label="More actions"
              icon={<Ellipsis size={22} color={C.black} />}
              onPress={() => setMenuOpen(true)}
            />
            <TouchableOpacity
              style={styles.addBtn}
              onPress={openNew}
              accessibilityLabel="Mark"
              hitSlop={8}
            >
              <CheckCircle2 size={24} color={C.primary} />
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => setShowCorrectionModal(true)}
            accessibilityLabel="Correction"
            hitSlop={8}
          >
            <Clock size={24} color={C.primary} />
          </TouchableOpacity>
        )}
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
                  icon: ScanFace,
                  label: 'Face attendance kiosk',
                  onPress: () => {
                    setMenuOpen(false);
                    navigation.navigate('FaceKiosk');
                  },
                },
                {
                  icon: ListChecks,
                  label: 'Bulk mark attendance',
                  onPress: () => {
                    setMenuOpen(false);
                    setBulkSelected([]);
                    setBulkStatus('present');
                    setShowBulkModal(true);
                  },
                },
                {
                  icon: Download,
                  label: 'Export attendance',
                  onPress: () => {
                    setMenuOpen(false);
                    chooseExport(
                      `attendance_${dateFilter}`,
                      exportCols,
                      filtered,
                    );
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

      <View
        style={[
          styles.dateRow,
          isTablet && {
            maxWidth: maxContentWidth,
            width: '100%',
            alignSelf: 'center',
          },
        ]}
      >
        <TouchableOpacity
          onPress={() => shiftDate(-1)}
          style={styles.dateBtnArrow}
        >
          <Text style={styles.dateBtnArrowText}>‹</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.dateCurrent}
          onPress={() => {
            const d = new Date(dateFilter + 'T00:00:00');
            setCalendarMonth({ year: d.getFullYear(), month: d.getMonth() });
            setShowCalendar(true);
          }}
          activeOpacity={0.7}
        >
          <Calendar size={14} color={C.primary} />
          <Text style={styles.dateCurrentText}>
            {new Date(dateFilter + 'T00:00:00').toLocaleDateString('en-IN', {
              weekday: 'short',
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            })}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => shiftDate(1)}
          style={styles.dateBtnArrow}
        >
          <Text style={styles.dateBtnArrowText}>›</Text>
        </TouchableOpacity>
      </View>

      {hasSelfAttendance && todayRecord?.approvalPending && (
        <View style={styles.approvalBanner}>
          <AlertCircle size={14} color={C.warning} />
          <Text style={styles.approvalBannerText}>
            Today's attendance is pending HR approval (late check-in exceeded
            your monthly allowance)
          </Text>
        </View>
      )}

      {hasSelfAttendance &&
        myEmployee?.geofenceAttendanceEnabled &&
        dateFilter === todayStr && (
          <View style={styles.selfMarkCard}>
            <View style={styles.selfMarkHeader}>
              <MapPin size={14} color={C.primary} />
              <Text style={styles.selfMarkHeaderText}>
                Geofenced Mobile Check-in
              </Text>
            </View>
            {!hasFaceEnrolled ? (
              <>
                <Text style={styles.selfMarkNoteText}>
                  Enroll your face first using the camera — this is required
                  before you can check in from the app.
                </Text>
                <TouchableOpacity
                  style={styles.selfMarkBtn}
                  onPress={handleEnrollFace}
                >
                  <Camera size={16} color={C.white} />
                  <Text style={styles.selfMarkBtnText}>Enroll My Face</Text>
                </TouchableOpacity>
              </>
            ) : !todayRecord?.checkIn ? (
              <TouchableOpacity
                style={styles.selfMarkBtn}
                onPress={() => handleSelfMark('checkin')}
                disabled={selfMarking !== null}
              >
                {selfMarking === 'checkin' ? (
                  <ActivityIndicator color={C.white} />
                ) : (
                  <>
                    <Camera size={16} color={C.white} />
                    <Text style={styles.selfMarkBtnText}>
                      Check In with Camera
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            ) : !todayRecord?.checkOut ? (
              <TouchableOpacity
                style={[styles.selfMarkBtn, { backgroundColor: C.danger }]}
                onPress={() => handleSelfMark('checkout')}
                disabled={selfMarking !== null}
              >
                {selfMarking === 'checkout' ? (
                  <ActivityIndicator color={C.white} />
                ) : (
                  <>
                    <Camera size={16} color={C.white} />
                    <Text style={styles.selfMarkBtnText}>
                      Check Out with Camera
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            ) : (
              <View style={styles.selfMarkDoneRow}>
                <CheckCircle2 size={16} color={C.success} />
                <Text style={styles.selfMarkDoneText}>
                  Checked in and out for today
                </Text>
              </View>
            )}
            {hasFaceEnrolled && canResetFace && (
              <TouchableOpacity
                onPress={handleResetFace}
                style={{ marginTop: 12 }}
              >
                <Text
                  style={[
                    styles.selfMarkNoteText,
                    { textDecorationLine: 'underline' },
                  ]}
                >
                  Reset my face
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}

      {!isEmployee && (
        <>
          <SearchModal
            visible={searchOpen}
            onClose={() => setSearchOpen(false)}
            value={search}
            onChange={setSearch}
            placeholder="Search by employee…"
            items={mergedRows.map((r: any) => ({
              key: String(r._id || r.employee?._id),
              title: `${r.employee?.firstName || ''} ${
                r.employee?.lastName || ''
              }`.trim(),
              subtitle: r.employee?.employeeId,
            }))}
          />
          <FilterSortModal
            visible={filterOpen}
            onClose={() => setFilterOpen(false)}
            filterTitle="Status"
            filterOptions={[
              { key: '', label: 'All' },
              ...Object.keys(summary).map(k => ({
                key: k,
                label: `${k} (${summary[k]})`,
              })),
            ]}
            filterValue={statusFilter}
            onFilter={setStatusFilter}
            sortOptions={[
              { key: 'checkin', label: 'Checked in first' },
              { key: 'name', label: 'Name A–Z' },
              { key: 'name_desc', label: 'Name Z–A' },
              { key: '', label: 'Employee order' },
            ]}
            sortValue={sortKey}
            onSort={setSortKey}
            onReset={() => {
              setStatusFilter('');
              setSortKey('checkin');
            }}
            onSave={isEmployee ? undefined : saveMyView}
          />
        </>
      )}

      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={C.primary} />
        </View>
      ) : (
        <FlatList
          key={isTablet ? 'tablet-table' : 'mobile-table'}
          data={filtered}
          keyExtractor={item => item._id}
          style={{ flex: 1 }}
          contentContainerStyle={[
            { padding: 16, paddingBottom: 32 },
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
            <>
              {!isEmployee ? (
                <View style={dashStatRow}>
                  <DashStatCard
                    index={0}
                    label="Present"
                    value={summary.present}
                    icon={STATUS_CONFIG.present.icon}
                    color={STATUS_CONFIG.present.color}
                  />
                  <DashStatCard
                    index={1}
                    label="Absent"
                    value={summary.absent}
                    icon={STATUS_CONFIG.absent.icon}
                    color={STATUS_CONFIG.absent.color}
                  />
                  <DashStatCard
                    index={2}
                    label="Late"
                    value={summary.late}
                    icon={STATUS_CONFIG.late.icon}
                    color={STATUS_CONFIG.late.color}
                  />
                  <DashStatCard
                    index={3}
                    label="Half Day"
                    value={summary.half_day}
                    icon={STATUS_CONFIG.half_day.icon}
                    color={STATUS_CONFIG.half_day.color}
                  />
                  {pendingApprovalCount > 0 && (
                    <DashStatCard
                      index={4}
                      label="Pending"
                      value={pendingApprovalCount}
                      icon={Clock}
                      color="#A16207"
                    />
                  )}
                </View>
              ) : null}
              {(() => {
                const W = isTablet ? T_ATT_TABLET : T_ATT_PHONE;
                const hc = (width: number, icon: React.ReactNode) => (
                  <View style={{ width, alignItems: 'center' }}>{icon}</View>
                );
                return (
                  <View style={styles.tHead}>
                    <View style={{ flex: 2.4, minWidth: 0 }}>
                      <Users size={15} color={C.textMuted} />
                    </View>
                    {isTablet &&
                      hc(W.status, <Activity size={15} color={C.textMuted} />)}
                    {hc(W.time, <LogIn size={15} color={C.success} />)}
                    {hc(W.time, <LogOut size={15} color={C.danger} />)}
                    {isTablet && (
                      <>
                        {hc(W.hrs, <Timer size={15} color={C.textMuted} />)}
                        {hc(W.ot, <Hourglass size={15} color={C.warning} />)}
                        {hc(
                          W.method,
                          <Fingerprint size={15} color="#7C3AED" />,
                        )}
                        {hc(W.loc, <MapPin size={15} color={C.primary} />)}
                        <View style={{ flex: 1, minWidth: 40 }}>
                          <StickyNote size={15} color={C.textMuted} />
                        </View>
                      </>
                    )}
                    <View style={{ width: W.act }} />
                  </View>
                );
              })()}
            </>
          }
          ListFooterComponent={
            filtered.length ? <View style={styles.tFoot} /> : null
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Clock size={40} color="#D1D5DB" />
              <Text style={styles.emptyText}>No records for this date</Text>
            </View>
          }
          renderItem={({ item }) => {
            const W = isTablet ? T_ATT_TABLET : T_ATT_PHONE;
            const emp = item.employee as any;
            // Late beyond the allowance waits for HR/Admin: show it as pending, not as Late.
            const isPending = item.status === 'late' && !!item.approvalPending;
            const statusLabel = isPending
              ? 'Pending approval'
              : sentence(item.status);
            const cfg = isPending
              ? { color: '#A16207', bg: '#FEF9C3', icon: Clock }
              : STATUS_CONFIG[item.status] || {
                  color: C.textMuted,
                  bg: '#F3F4F6',
                  icon: AlertCircle,
                };
            const StatusIcon = cfg.icon;
            const fmtTime = (d?: string) =>
              d
                ? new Date(d).toLocaleTimeString([], {
                    hour: 'numeric',
                    minute: '2-digit',
                  })
                : null;
            const ciTime = fmtTime(item.checkIn as any);
            const coTime = fmtTime(item.checkOut as any);
            const workHours = (item as any).workingHours;
            const overtime = (item as any).overtime;
            const earlyLeaving = (item as any).earlyLeaving;
            const verifyMode = (item as any).verifyMode;
            const VerifyIcon = verifyMode
              ? VERIFY_MODE_ICONS[verifyMode]
              : null;
            const hasLoc = !!(item.checkInLocation || item.checkOutLocation);
            const isVirtual = item._id.startsWith('v_');
            const canMenu =
              !isEmployee && !(isVirtual && item.status === 'weekend');
            const initials = emp
              ? `${emp.firstName?.[0] || ''}${
                  emp.lastName?.[0] || ''
                }`.toUpperCase()
              : '?';
            const sub = isEmployee
              ? new Date(item.date).toLocaleDateString('en-IN', {
                  weekday: 'short',
                  day: 'numeric',
                  month: 'short',
                })
              : emp?.designation || '';
            const fmtDay = (d?: string) =>
              d
                ? new Date(d).toLocaleDateString('en-IN', {
                    day: '2-digit',
                    month: 'short',
                  })
                : '';
            const timeCell = (t: string | null, day?: string) => (
              <View style={{ width: W.time, alignItems: 'center' }}>
                <Text
                  style={t ? styles.tTime : styles.tTimeEmpty}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                >
                  {t || '–'}
                </Text>
                {isTablet && !!t && !!day && (
                  <Text style={styles.tSub}>{day}</Text>
                )}
              </View>
            );
            // Phone only: the arrow opens the columns the tablet table shows, plus method and location.
            const isOpen = !isTablet && expandedAtt.includes(item._id);
            const panel = (
              <Reveal open={isOpen}>
                <View style={styles.tDetail}>
                  <View style={[styles.tDetailItem, { width: '100%' }]}>
                    <View
                      style={[
                        styles.tStatusIcon,
                        { backgroundColor: cfg.bg, borderColor: cfg.color },
                      ]}
                    >
                      <StatusIcon size={14} color={cfg.color} />
                    </View>
                    <Text style={[styles.tTime, { color: cfg.color }]}>
                      {statusLabel}
                    </Text>
                  </View>
                  <View style={styles.tDetailItem}>
                    <LogIn size={15} color={C.success} />
                    <Text style={styles.tTime}>{ciTime || '–'}</Text>
                    {!!item.checkIn && (
                      <Text style={styles.tSub}>
                        {fmtDay(item.checkIn as any)}
                      </Text>
                    )}
                  </View>
                  <View style={styles.tDetailItem}>
                    <LogOut size={15} color={C.danger} />
                    <Text style={styles.tTime}>{coTime || '–'}</Text>
                    {!!item.checkOut && (
                      <Text style={styles.tSub}>
                        {fmtDay(item.checkOut as any)}
                      </Text>
                    )}
                  </View>
                  {(!!workHours || overtime > 0 || earlyLeaving) && (
                    <View style={styles.tDetailItem}>
                      <Timer size={15} color={C.textMuted} />
                      {!!workHours && (
                        <Text style={styles.tTime}>{workHours}h</Text>
                      )}
                      {overtime > 0 && (
                        <Text style={[styles.tOt, { color: C.warning }]}>
                          +{overtime}
                        </Text>
                      )}
                      {earlyLeaving && <LogOut size={12} color={C.primary} />}
                    </View>
                  )}
                  {!!verifyMode && VerifyIcon && (
                    <View style={styles.tDetailItem}>
                      <VerifyIcon size={15} color="#7C3AED" />
                      <Text style={styles.tTime}>
                        {VERIFY_MODE_LABELS[verifyMode] || sentence(verifyMode)}
                      </Text>
                    </View>
                  )}
                  {hasLoc && (
                    <TouchableOpacity
                      style={[styles.tDetailItem, { width: '100%' }]}
                      onPress={() => showLocationOptions(item)}
                    >
                      <MapPin size={15} color={C.primary} />
                      <Text style={[styles.tTime, { color: C.primary }]}>
                        Open location
                      </Text>
                    </TouchableOpacity>
                  )}
                  {!!(
                    (item as any).checkInSelfie || (item as any).checkOutSelfie
                  ) && (
                    <TouchableOpacity
                      style={[styles.tDetailItem, { width: '100%' }]}
                      onPress={() =>
                        setFacesView({
                          name: emp
                            ? `${emp.firstName} ${emp.lastName}`
                            : undefined,
                          date: String(item.date).slice(0, 10),
                          checkIn: item.checkIn as any,
                          checkOut: item.checkOut as any,
                          checkInPhoto: (item as any).checkInSelfie,
                          checkOutPhoto: (item as any).checkOutSelfie,
                        })
                      }
                    >
                      <ScanFace size={15} color={C.primary} />
                      <Text style={[styles.tTime, { color: C.primary }]}>
                        View face photos
                      </Text>
                    </TouchableOpacity>
                  )}
                  {!!item.notes && (
                    <View style={[styles.tDetailItem, { width: '100%' }]}>
                      <StickyNote size={15} color="#6B7280" />
                      <Text style={[styles.tSub, { flex: 1 }]}>
                        {item.notes}
                      </Text>
                    </View>
                  )}
                </View>
              </Reveal>
            );
            return (
              <View>
                <View style={styles.tRow}>
                  {/* Employee: avatar, name, then a line of small icons (method, location, note) */}
                  <View style={styles.tEmpCell}>
                    {emp?.avatar ? (
                      <Image
                        source={{ uri: emp.avatar }}
                        style={[
                          styles.tAvatar,
                          { borderColor: isTablet ? C.primary : cfg.color },
                        ]}
                      />
                    ) : (
                      <View
                        style={[
                          styles.tAvatar,
                          styles.empPhotoFallback,
                          {
                            backgroundColor: C.primary + '1A',
                            borderColor: isTablet ? C.primary : cfg.color,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.empPhotoInitials,
                            { color: C.primary, fontSize: 11 },
                          ]}
                        >
                          {initials}
                        </Text>
                      </View>
                    )}
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.tName} numberOfLines={2}>
                        {emp ? `${emp.firstName} ${emp.lastName}` : 'Unknown'}
                      </Text>
                      <View style={styles.tSubRow}>
                        {!!sub && (
                          <Text style={styles.tSub} numberOfLines={1}>
                            {sub}
                          </Text>
                        )}
                      </View>
                    </View>
                  </View>

                  {/* Status: icon only (tablet). On the phone the avatar border shows it. */}
                  {isTablet && (
                    <View style={{ width: W.status, alignItems: 'center' }}>
                      <View
                        accessibilityLabel={statusLabel}
                        style={[
                          styles.tStatusIcon,
                          { backgroundColor: cfg.bg, borderColor: cfg.color },
                        ]}
                      >
                        <StatusIcon size={14} color={cfg.color} />
                      </View>
                    </View>
                  )}

                  {timeCell(ciTime, fmtDay(item.checkIn as any))}
                  {timeCell(coTime, fmtDay(item.checkOut as any))}

                  {isTablet && (
                    <>
                      {/* Hours (+ a small icon when they left early) */}
                      <View style={{ width: W.hrs, alignItems: 'center' }}>
                        {workHours ? (
                          <Text
                            style={styles.tTime}
                            numberOfLines={1}
                            adjustsFontSizeToFit
                          >
                            {workHours}h
                          </Text>
                        ) : (
                          <Text style={styles.tTimeEmpty}>–</Text>
                        )}
                        {earlyLeaving && (
                          <LogOut
                            size={11}
                            color={C.primary}
                            style={{ marginTop: 2 }}
                          />
                        )}
                      </View>

                      {/* Overtime */}
                      <View style={{ width: W.ot, alignItems: 'center' }}>
                        {overtime > 0 ? (
                          <Text style={[styles.tTime, { color: C.warning }]}>
                            {overtime}h
                          </Text>
                        ) : (
                          <Text style={styles.tTimeEmpty}>–</Text>
                        )}
                      </View>

                      {/* Method */}
                      <View
                        style={{
                          width: W.method,
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 4,
                        }}
                      >
                        {VerifyIcon ? (
                          <>
                            <VerifyIcon size={13} color="#7C3AED" />
                            <Text style={styles.tSub} numberOfLines={1}>
                              {VERIFY_MODE_LABELS[verifyMode] ||
                                sentence(verifyMode)}
                            </Text>
                          </>
                        ) : (
                          <Text style={styles.tTimeEmpty}>–</Text>
                        )}
                      </View>

                      {/* Location */}
                      <View style={{ width: W.loc, alignItems: 'center' }}>
                        {hasLoc ? (
                          <TouchableOpacity
                            onPress={() => showLocationOptions(item)}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          >
                            <MapPin size={16} color={C.primary} />
                          </TouchableOpacity>
                        ) : (
                          <Text style={styles.tTimeEmpty}>–</Text>
                        )}
                      </View>

                      {/* Note (takes the leftover width) */}
                      <View style={{ flex: 1, minWidth: 40 }}>
                        {item.notes ? (
                          <Text style={styles.tSub} numberOfLines={2}>
                            {item.notes}
                          </Text>
                        ) : (
                          <Text style={styles.tTimeEmpty}>–</Text>
                        )}
                      </View>
                    </>
                  )}

                  {/* ⋮ menu: edit a record, or mark present / absent for someone with no record */}
                  <View
                    style={{
                      width: W.act,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: isTablet ? 'center' : 'flex-end',
                      gap: 8,
                    }}
                  >
                    {canMenu && (
                      <TouchableOpacity
                        onPress={() => setRowMenu(item)}
                        hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
                        accessibilityLabel="More actions"
                      >
                        <EllipsisVertical size={18} color="#475569" />
                      </TouchableOpacity>
                    )}
                    {!isTablet && (
                      <TouchableOpacity
                        onPress={() => toggleExpandAtt(item._id)}
                        hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
                        accessibilityLabel={
                          isOpen ? 'Hide details' : 'Show details'
                        }
                      >
                        {isOpen ? (
                          <ChevronUp size={18} color={C.primary} />
                        ) : (
                          <ChevronDown size={18} color={C.primary} />
                        )}
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
                {panel}
              </View>
            );
          }}
        />
      )}

      {/* Row ⋮ menu */}
      <Modal
        visible={!!rowMenu}
        transparent
        animationType="fade"
        onRequestClose={() => setRowMenu(null)}
      >
        <TouchableOpacity
          style={styles.rowMenuOverlay}
          activeOpacity={1}
          onPress={() => setRowMenu(null)}
        >
          <View style={styles.rowMenuSheet}>
            {rowMenu && (
              <Text style={styles.rowMenuTitle} numberOfLines={1}>
                {(rowMenu.employee as any)?.firstName}{' '}
                {(rowMenu.employee as any)?.lastName}
              </Text>
            )}
            {rowMenu && rowMenu._id.startsWith('v_') ? (
              <>
                <TouchableOpacity
                  style={styles.rowMenuItem}
                  onPress={() => {
                    const id = (rowMenu.employee as any)?._id;
                    setRowMenu(null);
                    openMarkForEmp(id);
                  }}
                >
                  <CheckCircle2 size={18} color={C.success} />
                  <Text style={styles.rowMenuText}>Mark present</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.rowMenuItem}
                  onPress={() => {
                    const id = (rowMenu.employee as any)?._id;
                    setRowMenu(null);
                    markAbsent(id);
                  }}
                >
                  <XCircle size={18} color={C.danger} />
                  <Text style={styles.rowMenuText}>Mark absent</Text>
                </TouchableOpacity>
              </>
            ) : (
              <TouchableOpacity
                style={styles.rowMenuItem}
                onPress={() => {
                  const rec = rowMenu;
                  setRowMenu(null);
                  if (rec) openEdit(rec);
                }}
              >
                <Pencil size={18} color={C.primary} />
                <Text style={styles.rowMenuText}>Edit</Text>
              </TouchableOpacity>
            )}
          </View>
        </TouchableOpacity>
      </Modal>

      <AttendanceFacesModal
        data={facesView}
        onClose={() => setFacesView(null)}
      />

      {/* Calendar picker modal */}
      <Modal
        visible={showCalendar}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCalendar(false)}
      >
        <TouchableOpacity
          style={styles.calOverlay}
          activeOpacity={1}
          onPress={() => setShowCalendar(false)}
        >
          <TouchableOpacity activeOpacity={1} style={styles.calSheet}>
            <View style={styles.calNavRow}>
              <TouchableOpacity
                style={styles.calNavBtn}
                onPress={() =>
                  setCalendarMonth(p => {
                    if (p.month === 0) return { year: p.year - 1, month: 11 };
                    return { ...p, month: p.month - 1 };
                  })
                }
              >
                <Text style={styles.calNavArrow}>‹</Text>
              </TouchableOpacity>
              <Text style={styles.calMonthLabel}>
                {new Date(
                  calendarMonth.year,
                  calendarMonth.month,
                  1,
                ).toLocaleDateString('en-IN', {
                  month: 'long',
                  year: 'numeric',
                })}
              </Text>
              <TouchableOpacity
                style={styles.calNavBtn}
                onPress={() =>
                  setCalendarMonth(p => {
                    if (p.month === 11) return { year: p.year + 1, month: 0 };
                    return { ...p, month: p.month + 1 };
                  })
                }
              >
                <Text style={styles.calNavArrow}>›</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.calDowRow}>
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                <Text key={d} style={styles.calDowText}>
                  {d}
                </Text>
              ))}
            </View>

            {(() => {
              const { year, month } = calendarMonth;
              const firstDay = new Date(year, month, 1).getDay();
              const daysInMonth = new Date(year, month + 1, 0).getDate();
              const currentTodayStr = toDateStr(new Date());
              const cells: number[] = [];
              for (let i = 0; i < firstDay; i++) cells.push(0);
              for (let d = 1; d <= daysInMonth; d++) cells.push(d);
              while (cells.length % 7 !== 0) cells.push(0);
              const rows: number[][] = [];
              for (let i = 0; i < cells.length; i += 7)
                rows.push(cells.slice(i, i + 7));
              return rows.map((row, ri) => (
                <View key={ri} style={styles.calGridRow}>
                  {row.map((day, ci) => {
                    if (day === 0)
                      return <View key={ci} style={styles.calCell} />;
                    const dayStr = `${year}-${String(month + 1).padStart(
                      2,
                      '0',
                    )}-${String(day).padStart(2, '0')}`;
                    const isSelected = dayStr === dateFilter;
                    const isToday = dayStr === currentTodayStr;
                    return (
                      <TouchableOpacity
                        key={ci}
                        style={[
                          styles.calCell,
                          isSelected && styles.calCellSelected,
                          !isSelected && isToday && styles.calCellToday,
                        ]}
                        onPress={() => {
                          setDateFilter(dayStr);
                          setShowCalendar(false);
                        }}
                        activeOpacity={0.7}
                      >
                        <Text
                          style={[
                            styles.calCellText,
                            isSelected && styles.calCellTextSelected,
                            !isSelected && isToday && { color: C.primary },
                          ]}
                        >
                          {day}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ));
            })()}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Bulk attendance modal */}
      {!isEmployee && (
        <Modal
          visible={showBulkModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowBulkModal(false)}
        >
          <View style={CENTER.overlay}>
            <View style={CENTER.card}>
              <SafeAreaView style={styles.safe} edges={[]}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Bulk Attendance</Text>
                  <TouchableOpacity onPress={() => setShowBulkModal(false)}>
                    <X size={24} color={C.black} />
                  </TouchableOpacity>
                </View>
                <ScrollView
                  contentContainerStyle={{
                    padding: 16,
                    gap: 16,
                    paddingBottom: 32,
                  }}
                  showsVerticalScrollIndicator={false}
                >
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
                      {Object.keys(STATUS_CONFIG)
                        .filter(s => s !== 'not_checked_in' && s !== 'weekend')
                        .map(s => (
                          <TouchableOpacity
                            key={s}
                            style={[
                              styles.selChip,
                              bulkStatus === s && styles.selChipActive,
                            ]}
                            onPress={() => setBulkStatus(s)}
                          >
                            <Text
                              style={[
                                styles.selChipText,
                                bulkStatus === s && { color: C.white },
                              ]}
                            >
                              {sentence(s)}
                            </Text>
                          </TouchableOpacity>
                        ))}
                    </View>
                  </View>

                  <TouchableOpacity
                    style={styles.bulkSelectAllRow}
                    onPress={() => {
                      const eligible = employees.filter(
                        e => !isWeekendForEmployee(dateFilter, e),
                      );
                      if (bulkSelected.length === eligible.length) {
                        setBulkSelected([]);
                      } else {
                        setBulkSelected(eligible.map(e => e._id));
                      }
                    }}
                  >
                    <View style={styles.bulkCheckbox}>
                      {bulkSelected.length ===
                        employees.filter(
                          e => !isWeekendForEmployee(dateFilter, e),
                        ).length &&
                        employees.filter(
                          e => !isWeekendForEmployee(dateFilter, e),
                        ).length > 0 && (
                          <View style={styles.bulkCheckboxInner} />
                        )}
                    </View>
                    <Text style={styles.bulkSelectAllText}>Select All</Text>
                  </TouchableOpacity>

                  {employees.map(emp => {
                    const isWeekend = isWeekendForEmployee(dateFilter, emp);
                    if (isWeekend) return null;
                    const checked = bulkSelected.includes(emp._id);
                    return (
                      <TouchableOpacity
                        key={emp._id}
                        style={styles.bulkEmpRow}
                        onPress={() =>
                          setBulkSelected(p =>
                            checked
                              ? p.filter(id => id !== emp._id)
                              : [...p, emp._id],
                          )
                        }
                        activeOpacity={0.7}
                      >
                        <View
                          style={[
                            styles.bulkCheckbox,
                            checked && styles.bulkCheckboxChecked,
                          ]}
                        >
                          {checked && <View style={styles.bulkCheckboxInner} />}
                        </View>
                        <View style={{ flex: 1, marginLeft: 12 }}>
                          <Text style={styles.empOptionName}>
                            {emp.firstName} {emp.lastName}
                          </Text>
                          <Text style={styles.empOptionId}>
                            {emp.employeeId}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>

                <View
                  style={{
                    padding: 16,
                    backgroundColor: C.white,
                    borderTopWidth: 2,
                    borderTopColor: C.black,
                  }}
                >
                  <TouchableOpacity
                    style={[
                      styles.submitBtn,
                      bulkSelected.length === 0 && { opacity: 0.5 },
                    ]}
                    disabled={bulkSelected.length === 0 || bulkSaving}
                    onPress={async () => {
                      if (bulkSelected.length === 0) return;
                      setBulkSaving(true);
                      try {
                        await attendanceAPI.bulkMark({
                          records: bulkSelected.map(id => ({
                            employee: id,
                            date: dateFilter,
                            status: bulkStatus,
                          })),
                        });
                        setShowBulkModal(false);
                        await load();
                      } catch (e: any) {
                        Alert.alert('Error', e.message);
                      } finally {
                        setBulkSaving(false);
                      }
                    }}
                  >
                    {bulkSaving ? (
                      <ActivityIndicator color={C.white} />
                    ) : (
                      <Text style={styles.submitBtnText}>
                        Mark Selected ({bulkSelected.length})
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
              </SafeAreaView>
            </View>
          </View>
        </Modal>
      )}

      {!isEmployee && (
        <Modal visible={showModal} transparent animationType="fade">
          <View style={CENTER.overlay}>
            <View style={CENTER.card}>
              <SafeAreaView style={styles.safe} edges={[]}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>
                    {editRecord ? 'Edit Attendance' : 'Mark Attendance'}
                  </Text>
                  <TouchableOpacity onPress={closeModal}>
                    <X size={24} color={C.black} />
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
                      <ScrollView
                        style={{ maxHeight: 180 }}
                        nestedScrollEnabled
                      >
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
                      {Object.keys(STATUS_CONFIG)
                        .filter(s => s !== 'not_checked_in')
                        .map(s => (
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
                              {sentence(s)}
                            </Text>
                          </TouchableOpacity>
                        ))}
                    </View>
                  </View>

                  <View style={{ flexDirection: 'row', gap: 12 }}>
                    <View style={{ flex: 1 }}>
                      <TimePickerField
                        label="Check In"
                        value={form.checkIn}
                        onChange={v => setForm(p => ({ ...p, checkIn: v }))}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <TimePickerField
                        label="Check Out"
                        value={form.checkOut}
                        onChange={v => setForm(p => ({ ...p, checkOut: v }))}
                      />
                    </View>
                  </View>

                  <View>
                    <Text style={styles.fieldLabel}>
                      Overtime Hours (Optional)
                    </Text>
                    <TextInput
                      style={styles.fieldInput}
                      keyboardType="decimal-pad"
                      value={form.overtime}
                      onChangeText={v =>
                        setForm(p => ({
                          ...p,
                          overtime: v.replace(/[^0-9.]/g, ''),
                        }))
                      }
                      placeholder="e.g. 1.5 (blank = auto from shift)"
                      placeholderTextColor={C.textLight}
                    />
                  </View>

                  <View>
                    <Text style={styles.fieldLabel}>Via (Verify Mode)</Text>
                    <View
                      style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}
                    >
                      {[
                        ['manual', 'Manual'],
                        ['fingerprint', 'Fingerprint'],
                        ['face', 'Face'],
                        ['card', 'Card'],
                        ['password', 'Password'],
                      ].map(([v, l]) => (
                        <TouchableOpacity
                          key={v}
                          style={[
                            styles.selChip,
                            form.verifyMode === v && styles.selChipActive,
                          ]}
                          onPress={() =>
                            setForm(p => ({ ...p, verifyMode: v }))
                          }
                        >
                          <Text
                            style={[
                              styles.selChipText,
                              form.verifyMode === v && { color: C.white },
                            ]}
                          >
                            {l}
                          </Text>
                        </TouchableOpacity>
                      ))}
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
            </View>
          </View>
        </Modal>
      )}

      {isEmployee && (
        <Modal
          visible={showCorrectionModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowCorrectionModal(false)}
        >
          <View style={CENTER.overlay}>
            <View style={CENTER.card}>
              <SafeAreaView style={styles.safe} edges={[]}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Request Correction</Text>
                  <TouchableOpacity
                    onPress={() => setShowCorrectionModal(false)}
                  >
                    <X size={24} color={C.black} />
                  </TouchableOpacity>
                </View>
                <ScrollView
                  contentContainerStyle={{ padding: 20, gap: 16 }}
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={false}
                >
                  <View>
                    <Text style={styles.fieldLabel}>Date *</Text>
                    <TextInput
                      style={styles.fieldInput}
                      value={correctionForm.date}
                      onChangeText={v =>
                        setCorrectionForm(p => ({ ...p, date: v }))
                      }
                      placeholder="YYYY-MM-DD"
                      placeholderTextColor={C.textLight}
                    />
                  </View>

                  <View>
                    <Text style={styles.fieldLabel}>Correction Type *</Text>
                    <View
                      style={{ flexDirection: 'row', gap: 12, marginTop: 6 }}
                    >
                      {['regularization', 'missed_punch'].map(t => (
                        <TouchableOpacity
                          key={t}
                          style={[
                            styles.selChip,
                            correctionForm.type === t && styles.selChipActive,
                          ]}
                          onPress={() =>
                            setCorrectionForm(p => ({ ...p, type: t }))
                          }
                        >
                          <Text
                            style={[
                              styles.selChipText,
                              correctionForm.type === t && { color: C.white },
                            ]}
                          >
                            {sentence(t)}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  <View style={{ flexDirection: 'row', gap: 12 }}>
                    <View style={{ flex: 1 }}>
                      <TimePickerField
                        label="Proposed Check In"
                        value={correctionForm.checkIn}
                        onChange={v =>
                          setCorrectionForm(p => ({ ...p, checkIn: v }))
                        }
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <TimePickerField
                        label="Proposed Check Out"
                        value={correctionForm.checkOut}
                        onChange={v =>
                          setCorrectionForm(p => ({ ...p, checkOut: v }))
                        }
                      />
                    </View>
                  </View>

                  <View>
                    <Text style={styles.fieldLabel}>Reason *</Text>
                    <TextInput
                      style={[styles.fieldInput, { minHeight: 80 }]}
                      value={correctionForm.reason}
                      onChangeText={v =>
                        setCorrectionForm(p => ({ ...p, reason: v }))
                      }
                      placeholder="Explain the correction request details..."
                      placeholderTextColor={C.textLight}
                      multiline
                    />
                  </View>

                  <TouchableOpacity
                    style={styles.submitBtn}
                    onPress={handleCreateCorrection}
                    disabled={submittingCorrection}
                  >
                    {submittingCorrection ? (
                      <ActivityIndicator color={C.white} />
                    ) : (
                      <Text style={styles.submitBtnText}>Submit Request</Text>
                    )}
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
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: C.white,
    borderBottomWidth: 2,
    borderBottomColor: C.black,
    paddingVertical: 12,
  },
  dateBtnArrow: { width: 44, alignItems: 'center' },
  dateBtnArrowText: { fontSize: 24, fontWeight: '400', color: C.black },
  dateCurrent: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dateCurrentText: { fontSize: 13, fontWeight: '400', color: C.black },
  approvalBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF3E2',
    borderBottomWidth: 2,
    borderBottomColor: C.warning,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  approvalBannerText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '400',
    color: '#92400E',
  },
  selfMarkCard: {
    backgroundColor: C.white,
    borderBottomWidth: 2,
    borderBottomColor: C.black,
    padding: 16,
    gap: 12,
  },
  selfMarkHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  selfMarkHeaderText: {
    fontSize: 11,
    fontWeight: '400',
    color: C.primary,
  },
  selfMarkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: C.primary,
    borderWidth: 2,
    borderRadius: 8,
    borderRightWidth: 4,
    borderBottomWidth: 4,
    borderRightColor: '#0A0A0A',
    borderBottomColor: '#0A0A0A',
    borderColor: C.black,
    paddingVertical: 12,
  },
  selfMarkBtnText: {
    color: C.white,
    fontSize: 13,
    fontWeight: '400',
  },
  selfMarkDoneRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  selfMarkDoneText: { fontSize: 13, fontWeight: '400', color: C.success },
  selfMarkNoteText: {
    fontSize: 12,
    color: C.textMuted,
    fontWeight: '400',
    marginBottom: 4,
  },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyText: { fontSize: 14, fontWeight: '400', color: C.textMuted },
  colWrapper: { gap: 12 },
  // Attendance table
  tHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 9,
    marginTop: 8,
    backgroundColor: '#F1F5F9',
    borderWidth: 2,
    borderColor: C.black,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
  },
  tRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 10,
    backgroundColor: C.white,
    borderLeftWidth: 2,
    borderRightWidth: 2,
    borderColor: C.black,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  tFoot: {
    height: 8,
    backgroundColor: C.white,
    borderWidth: 2,
    borderTopWidth: 0,
    borderColor: C.black,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
  },
  tDetail: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    padding: 12,
    backgroundColor: '#F8FAFC',
    borderLeftWidth: 2,
    borderRightWidth: 2,
    borderColor: C.black,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  tDetailItem: {
    width: '47%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  tEmpCell: {
    flex: 2.4,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  tAvatar: { width: 32, height: 32, borderRadius: 16, borderWidth: 2 },
  tName: { fontSize: 13, color: C.black, fontWeight: '400' },
  tSubRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  tSub: { fontSize: 10, color: '#6B7280', flexShrink: 1 },
  tStatusIcon: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tTime: { fontSize: 12, color: C.black, fontWeight: '400' },
  tTimeEmpty: { fontSize: 12, color: '#D1D5DB' },
  tOt: { fontSize: 10, fontWeight: '400' },
  rowMenuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  rowMenuSheet: {
    minWidth: 230,
    borderWidth: 2,
    borderRadius: 8,
    borderRightWidth: 4,
    borderBottomWidth: 4,
    borderColor: C.black,
    backgroundColor: C.white,
    paddingVertical: 4,
  },
  rowMenuTitle: {
    fontSize: 12,
    color: C.textMuted,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 4,
    textTransform: 'capitalize',
    letterSpacing: 0.5,
  },
  rowMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  rowMenuText: { fontSize: 14, color: C.black },
  cardCol: { flex: 1 },
  card: {
    backgroundColor: C.white,
    borderWidth: 2,
    borderColor: C.black,
    borderRadius: 8,
    borderRightWidth: 4,
    borderBottomWidth: 4,
    borderRightColor: '#0A0A0A',
    borderBottomColor: '#0A0A0A',
    padding: 16,
  },
  cardRow: { flexDirection: 'row', alignItems: 'center' },
  cardActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  photoWrap: { position: 'relative', width: 48, height: 48 },
  empPhoto: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: '#000000ff',
  },
  empPhotoFallback: { alignItems: 'center', justifyContent: 'center' },
  empPhotoInitials: { fontSize: 16, fontWeight: '400' },
  statusBadgeOverlay: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 8,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empDeptRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  empDeptText: { fontSize: 11, color: '#6B7280', fontWeight: '400' },
  cardDivider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginTop: 12,
    marginBottom: 12,
  },
  statsRow: { flexDirection: 'row', alignItems: 'flex-start' },
  statCol: { flex: 1, gap: 4 },
  statDivider: { width: 1, backgroundColor: '#F3F4F6', marginHorizontal: 12 },
  statLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statIconWrap: {
    width: 22,
    height: 22,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statLabel: {
    fontSize: 11,
    color: '#6B7280',
    fontWeight: '400',
  },
  statValue: { fontSize: 15, fontWeight: '400', color: C.black },
  statSub: { fontSize: 11, color: '#B0B4BA', fontWeight: '400' },
  empName: {
    fontSize: 15,
    fontWeight: '400',
    color: C.black,
    letterSpacing: 0.2,
  },
  empSub: { fontSize: 11, color: '#6B7280', fontWeight: '400', marginTop: 2 },
  statusTag: {
    borderWidth: 1.5,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  statusTagText: { fontSize: 11, fontWeight: '400' },
  editBtn: {
    borderWidth: 1.5,
    borderColor: C.primary,
    padding: 4,
    backgroundColor: '#ffffff',
  },
  markBtn: {
    borderWidth: 1.5,
    borderColor: C.primary,
    borderRadius: 8,
    padding: 8,
    backgroundColor: C.primary,
  },
  absentBtn: {
    borderWidth: 1.5,
    borderColor: C.danger,
    borderRadius: 8,
    padding: 8,
    backgroundColor: C.danger,
  },
  timeRow: { flexDirection: 'row', gap: 8, marginTop: 12, flexWrap: 'wrap' },
  timePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 2,
    borderRightWidth: 4,
    borderBottomWidth: 4,
    borderRightColor: '#0A0A0A',
    borderBottomColor: '#0A0A0A',
    borderColor: C.black,
  },
  timeText: { fontSize: 12, fontWeight: '400', color: C.black },
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
  modalTitle: { fontSize: 20, fontWeight: '400', color: C.black },
  editInfoBox: {
    borderWidth: 2,
    borderRightWidth: 4,
    borderBottomWidth: 4,
    borderRightColor: '#0A0A0A',
    borderBottomColor: '#0A0A0A',
    borderRadius: 8,
    borderColor: C.primary,
    backgroundColor: '#EFF6FF',
    padding: 12,
  },
  editInfoLabel: {
    fontSize: 12,
    fontWeight: '400',
    color: C.primary,
    marginBottom: 4,
  },
  editInfoValue: { fontSize: 15, fontWeight: '400', color: C.black },
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
  empOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderWidth: 2,
    borderColor: C.black,
    marginBottom: 4,
    backgroundColor: C.white,
  },
  empOptionActive: { backgroundColor: C.primary, borderColor: C.primary },
  empOptionName: { fontSize: 13, fontWeight: '400', color: C.black },
  empOptionId: { fontSize: 11, color: C.textMuted },
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
  bulkSelectAllRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: C.black,
    gap: 12,
  },
  bulkSelectAllText: {
    fontSize: 13,
    fontWeight: '400',
    color: C.black,
  },
  bulkEmpRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: C.black,
  },
  bulkCheckbox: {
    width: 22,
    height: 22,
    borderWidth: 2,
    borderColor: C.black,
    backgroundColor: C.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bulkCheckboxChecked: {
    borderColor: C.primary,
    backgroundColor: C.primary,
  },
  bulkCheckboxInner: {
    width: 10,
    height: 10,
    backgroundColor: C.white,
  },
  calOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: 20,
  },
  calSheet: {
    backgroundColor: C.white,
    borderWidth: 2,
    borderColor: C.black,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 32,
  },
  calNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  calNavBtn: { width: 36, alignItems: 'center' },
  calNavArrow: { fontSize: 24, fontWeight: '400', color: C.black },
  calMonthLabel: { fontSize: 15, fontWeight: '400', color: C.black },
  calDowRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  calDowText: {
    flex: 1,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '400',
    color: C.textMuted,
  },
  calGridRow: {
    flexDirection: 'row',
    marginBottom: 2,
  },
  calCell: {
    flex: 1,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    margin: 1,
  },
  calCellSelected: {
    backgroundColor: C.primary,
    borderWidth: 2,
    borderRadius: 8,
    borderRightWidth: 4,
    borderBottomWidth: 4,
    borderRightColor: '#0A0A0A',
    borderBottomColor: '#0A0A0A',
    borderColor: C.black,
  },
  calCellToday: {
    borderWidth: 2,
    borderRightWidth: 4,
    borderBottomWidth: 4,
    borderRightColor: '#0A0A0A',
    borderBottomColor: '#0A0A0A',
    borderRadius: 8,
    borderColor: C.primary,
  },
  calCellText: {
    fontSize: 13,
    fontWeight: '400',
    color: C.black,
  },
  calCellTextSelected: {
    color: C.white,
    fontWeight: '400',
  },
});

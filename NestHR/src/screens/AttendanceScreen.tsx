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
  PermissionsAndroid,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { launchCamera } from 'react-native-image-picker';
import Geolocation from '@react-native-community/geolocation';
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
} from 'lucide-react-native';
import { attendanceAPI, employeeAPI, attendanceCorrectionAPI } from '../api/api';
import { useAuth } from '../contexts/AuthContext';
import { AttendanceRecord, Employee } from '../types/hrms';
import { C } from '../theme';
import { TimePickerField } from '../components/common/DatePickerField';

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

async function requestSelfMarkPermissions(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  const results = await PermissionsAndroid.requestMultiple([
    PermissionsAndroid.PERMISSIONS.CAMERA,
    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
  ]);
  return (
    results[PermissionsAndroid.PERMISSIONS.CAMERA] === PermissionsAndroid.RESULTS.GRANTED &&
    results[PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION] ===
      PermissionsAndroid.RESULTS.GRANTED
  );
}

function getCurrentPosition(): Promise<{ latitude: number; longitude: number; accuracy: number }> {
  return new Promise((resolve, reject) => {
    Geolocation.getCurrentPosition(
      pos => resolve(pos.coords),
      err => reject(new Error(err.message || 'Could not get your location')),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  });
}

const STATUS_CONFIG: Record<string, { color: string; bg: string; icon: any }> =
  {
    present: { color: C.success, bg: '#F0FDF4', icon: CheckCircle2 },
    absent: { color: C.danger, bg: '#FEF2F2', icon: XCircle },
    late: { color: C.warning, bg: '#FFF7ED', icon: AlertCircle },
    half_day: { color: C.secondary, bg: '#FFF7ED', icon: AlertCircle },
    on_leave: { color: C.primary, bg: '#EFF6FF', icon: Calendar },
    not_checked_in: { color: '#9CA3AF', bg: '#F3F4F6', icon: Clock },
    weekend: { color: '#9CA3AF', bg: '#F3F4F6', icon: Calendar },
    holiday: { color: '#A855F7', bg: '#FAF5FF', icon: Calendar },
  };

const VERIFY_MODE_LABELS: Record<string, string> = {
  fingerprint: 'FINGERPRINT',
  card: 'CARD',
  face: 'FACE',
  geo_camera: 'FACE',
  password: 'PASSWORD',
  auto: 'AUTO',
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
  const [selfMarking, setSelfMarking] = useState<'checkin' | 'checkout' | null>(null);
  const [enrolling, setEnrolling] = useState(false);

  const loadMyEmployee = useCallback(() => {
    if (!isEmployee) return;
    employeeAPI
      .getMe()
      .then(res => setMyEmployee(res.data || null))
      .catch(() => {});
  }, [isEmployee]);

  useEffect(() => {
    loadMyEmployee();
  }, [loadMyEmployee]);

  const hasFaceEnrolled =
    Array.isArray(myEmployee?.faceDescriptor) &&
    myEmployee!.faceDescriptor!.length === 128;

  const todayStr = toDateStr(new Date());
  const todayRecord =
    isEmployee && dateFilter === todayStr ? records[0] : undefined;

  const handleEnrollFace = async () => {
    const ok = await requestSelfMarkPermissions();
    if (!ok) {
      Alert.alert('Permission Required', 'Camera access is required to enroll your face.');
      return;
    }

    launchCamera(
      {
        mediaType: 'photo',
        quality: 0.8,
        cameraType: 'front',
        saveToPhotos: false,
        maxWidth: 1280,
        maxHeight: 1280,
      },
      async result => {
        const asset = result.assets?.[0];
        if (!asset?.uri) return;

        setEnrolling(true);
        try {
          await employeeAPI.enrollMyFace(
            asset.uri,
            asset.type || 'image/jpeg',
            asset.fileName || `face_${Date.now()}.jpg`,
          );
          Alert.alert('Success', 'Face enrolled — you can now check in via the app.');
          loadMyEmployee();
        } catch (e: any) {
          Alert.alert('Error', e.message || 'Face enrollment failed. Try a clear, well-lit photo.');
        } finally {
          setEnrolling(false);
        }
      },
    );
  };

  const handleSelfMark = async (action: 'checkin' | 'checkout') => {
    const ok = await requestSelfMarkPermissions();
    if (!ok) {
      Alert.alert(
        'Permission Required',
        'Camera and location access are required to mark attendance.',
      );
      return;
    }

    launchCamera(
      {
        mediaType: 'photo',
        quality: 0.7,
        cameraType: 'front',
        saveToPhotos: false,
        maxWidth: 1280,
        maxHeight: 1280,
      },
      async result => {
        const asset = result.assets?.[0];
        if (!asset?.uri) return;

        setSelfMarking(action);
        try {
          const coords = await getCurrentPosition();
          const res = await attendanceAPI.selfMark({
            action,
            lat: coords.latitude,
            lng: coords.longitude,
            accuracy: coords.accuracy,
            selfieUri: asset.uri,
            selfieType: asset.type || 'image/jpeg',
            selfieName: asset.fileName || `selfie_${Date.now()}.jpg`,
          });
          Alert.alert(
            'Success',
            action === 'checkin' ? 'Checked in successfully' : 'Checked out successfully',
          );
          if (res?.data) setRecords([res.data]);
          else await load();
        } catch (e: any) {
          Alert.alert('Error', e.message || 'Failed to mark attendance');
        } finally {
          setSelfMarking(null);
        }
      },
    );
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
        checkInISO = new Date(`${correctionForm.date}T${correctionForm.checkIn}:00`).toISOString();
      }
      if (correctionForm.checkOut) {
        checkOutISO = new Date(`${correctionForm.date}T${correctionForm.checkOut}:00`).toISOString();
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

  const openMarkForEmp = (empId: string) => {
    setEditRecord(null);
    setSelectedEmpId(empId);
    setForm({ status: 'present', checkIn: '', checkOut: '', notes: '' });
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
          notes: form.notes,
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
  mergedRows.forEach(r => {
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
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity
              style={styles.bulkBtn}
              onPress={() => {
                setBulkSelected([]);
                setBulkStatus('present');
                setShowBulkModal(true);
              }}
            >
              <CheckCircle2 size={14} color={C.primary} />
              <Text style={styles.bulkBtnText}>Bulk</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.addBtn} onPress={openNew}>
              <CheckCircle2 size={14} color={C.white} />
              <Text style={styles.addBtnText}>Mark</Text>
            </TouchableOpacity>
          </View>
        )}
        {isEmployee && (
          <TouchableOpacity style={styles.addBtn} onPress={() => setShowCorrectionModal(true)}>
            <Clock size={14} color={C.white} />
            <Text style={styles.addBtnText}>Correction</Text>
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
        <TouchableOpacity
          style={styles.dateCurrent}
          onPress={() => {
            const d = new Date(dateFilter + 'T00:00:00');
            setCalendarMonth({ year: d.getFullYear(), month: d.getMonth() });
            setShowCalendar(true);
          }}
          activeOpacity={0.7}
        >
          <Calendar size={13} color={C.primary} />
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

      {isEmployee && myEmployee?.geofenceAttendanceEnabled && dateFilter === todayStr && (
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
                disabled={enrolling}
              >
                {enrolling ? (
                  <ActivityIndicator color={C.white} />
                ) : (
                  <>
                    <Camera size={16} color={C.white} />
                    <Text style={styles.selfMarkBtnText}>Enroll My Face</Text>
                  </>
                )}
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
                  <Text style={styles.selfMarkBtnText}>Check In with Camera</Text>
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
                  <Text style={styles.selfMarkBtnText}>Check Out with Camera</Text>
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
        </View>
      )}

      {!isEmployee && (
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
      )}

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
          style={{ flex: 1 }}
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
                        {item.status === 'weekend'
                          ? new Date(dateFilter + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'long' }).toUpperCase()
                          : item.status.replace(/_/g, ' ').toUpperCase()}
                      </Text>
                    </View>
                    {!isEmployee &&
                      (item._id.startsWith('v_') ? (
                        item.status === 'weekend' ? null : (
                        <View style={{ flexDirection: 'row', gap: 6 }}>
                          <TouchableOpacity
                            style={styles.absentBtn}
                            onPress={() =>
                              markAbsent((item.employee as any)?._id)
                            }
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          >
                            <XCircle size={13} color={C.white} />
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.markBtn}
                            onPress={() =>
                              openMarkForEmp((item.employee as any)?._id)
                            }
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          >
                            <CheckCircle2 size={13} color={C.white} />
                          </TouchableOpacity>
                        </View>
                        )
                      ) : (
                        <TouchableOpacity
                          style={styles.editBtn}
                          onPress={() => openEdit(item)}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Pencil size={14} color={C.primary} />
                        </TouchableOpacity>
                      ))}
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
                            {VERIFY_MODE_LABELS[(item as any).verifyMode] ||
                              (item as any).verifyMode.toUpperCase()}
                          </Text>
                        </View>
                      )}
                    {(item as any).earlyLeaving && (
                      <View
                        style={[styles.timePill, { borderColor: C.primary }]}
                      >
                        <LogOut size={11} color={C.primary} />
                        <Text style={[styles.timeText, { color: C.primary }]}>
                          Early Leave
                        </Text>
                      </View>
                    )}
                    {(item.checkInLocation || item.checkOutLocation) && (
                      <TouchableOpacity
                        style={styles.timePill}
                        onPress={() => showLocationOptions(item)}
                      >
                        <MapPin size={11} color={C.primary} />
                        <Text style={styles.timeText}>Location</Text>
                      </TouchableOpacity>
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
            {/* Month navigation */}
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
                {new Date(calendarMonth.year, calendarMonth.month, 1).toLocaleDateString(
                  'en-IN',
                  { month: 'long', year: 'numeric' },
                )}
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

            {/* Day-of-week headers */}
            <View style={styles.calDowRow}>
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                <Text key={d} style={styles.calDowText}>{d}</Text>
              ))}
            </View>

            {/* Grid */}
            {(() => {
              const { year, month } = calendarMonth;
              const firstDay = new Date(year, month, 1).getDay();
              const daysInMonth = new Date(year, month + 1, 0).getDate();
              const todayStr = toDateStr(new Date());
              const cells: number[] = [];
              for (let i = 0; i < firstDay; i++) cells.push(0);
              for (let d = 1; d <= daysInMonth; d++) cells.push(d);
              while (cells.length % 7 !== 0) cells.push(0);
              const rows: number[][] = [];
              for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
              return rows.map((row, ri) => (
                <View key={ri} style={styles.calGridRow}>
                  {row.map((day, ci) => {
                    if (day === 0) return <View key={ci} style={styles.calCell} />;
                    const dayStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                    const isSelected = dayStr === dateFilter;
                    const isToday = dayStr === todayStr;
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
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setShowBulkModal(false)}
        >
          <SafeAreaView style={styles.safe} edges={['top']}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Bulk Attendance</Text>
              <TouchableOpacity onPress={() => setShowBulkModal(false)}>
                <X size={22} color={C.black} />
              </TouchableOpacity>
            </View>
            <ScrollView
              contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 32 }}
              showsVerticalScrollIndicator={false}
            >
              {/* Status selector */}
              <View>
                <Text style={styles.fieldLabel}>Status *</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 }}>
                  {Object.keys(STATUS_CONFIG)
                    .filter(s => s !== 'not_checked_in' && s !== 'weekend')
                    .map(s => (
                      <TouchableOpacity
                        key={s}
                        style={[styles.selChip, bulkStatus === s && styles.selChipActive]}
                        onPress={() => setBulkStatus(s)}
                      >
                        <Text style={[styles.selChipText, bulkStatus === s && { color: C.white }]}>
                          {s.replace(/_/g, ' ').toUpperCase()}
                        </Text>
                      </TouchableOpacity>
                    ))}
                </View>
              </View>

              {/* Select all toggle */}
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
                    employees.filter(e => !isWeekendForEmployee(dateFilter, e)).length &&
                    employees.filter(e => !isWeekendForEmployee(dateFilter, e)).length > 0 && (
                      <View style={styles.bulkCheckboxInner} />
                    )}
                </View>
                <Text style={styles.bulkSelectAllText}>Select All</Text>
              </TouchableOpacity>

              {/* Employee list */}
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
                        checked ? p.filter(id => id !== emp._id) : [...p, emp._id],
                      )
                    }
                    activeOpacity={0.7}
                  >
                    <View style={[styles.bulkCheckbox, checked && styles.bulkCheckboxChecked]}>
                      {checked && <View style={styles.bulkCheckboxInner} />}
                    </View>
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <Text style={styles.empOptionName}>
                        {emp.firstName} {emp.lastName}
                      </Text>
                      <Text style={styles.empOptionId}>{emp.employeeId}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Mark selected button */}
            <View style={{ padding: 16, backgroundColor: C.white, borderTopWidth: 2, borderTopColor: C.black }}>
              <TouchableOpacity
                style={[styles.submitBtn, bulkSelected.length === 0 && { opacity: 0.5 }]}
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
        </Modal>
      )}

      {!isEmployee && (
        <Modal
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
                          {s.replace(/_/g, ' ').toUpperCase()}
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
        </Modal>
      )}

      {isEmployee && (
        <Modal
          visible={showCorrectionModal}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setShowCorrectionModal(false)}
        >
          <SafeAreaView style={styles.safe} edges={['top']}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Request Correction</Text>
              <TouchableOpacity onPress={() => setShowCorrectionModal(false)}>
                <X size={22} color={C.black} />
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
                  onChangeText={v => setCorrectionForm(p => ({ ...p, date: v }))}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={C.textLight}
                />
              </View>

              <View>
                <Text style={styles.fieldLabel}>Correction Type *</Text>
                <View style={{ flexDirection: 'row', gap: 10, marginTop: 6 }}>
                  {['regularization', 'missed_punch'].map(t => (
                    <TouchableOpacity
                      key={t}
                      style={[styles.selChip, correctionForm.type === t && styles.selChipActive]}
                      onPress={() => setCorrectionForm(p => ({ ...p, type: t }))}
                    >
                      <Text style={[styles.selChipText, correctionForm.type === t && { color: C.white }]}>
                        {t.replace('_', ' ').toUpperCase()}
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
                    onChange={v => setCorrectionForm(p => ({ ...p, checkIn: v }))}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <TimePickerField
                    label="Proposed Check Out"
                    value={correctionForm.checkOut}
                    onChange={v => setCorrectionForm(p => ({ ...p, checkOut: v }))}
                  />
                </View>
              </View>

              <View>
                <Text style={styles.fieldLabel}>Reason *</Text>
                <TextInput
                  style={[styles.fieldInput, { minHeight: 80 }]}
                  value={correctionForm.reason}
                  onChangeText={v => setCorrectionForm(p => ({ ...p, reason: v }))}
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
    maxHeight: 96,
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
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  selfMarkCard: {
    backgroundColor: C.white,
    borderBottomWidth: 2,
    borderBottomColor: C.black,
    padding: 14,
    gap: 10,
  },
  selfMarkHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  selfMarkHeaderText: {
    fontSize: 11,
    fontWeight: '700',
    color: C.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  selfMarkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: C.primary,
    borderWidth: 2,
    borderColor: C.black,
    paddingVertical: 12,
  },
  selfMarkBtnText: {
    color: C.white,
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  selfMarkDoneRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  selfMarkDoneText: { fontSize: 13, fontWeight: '700', color: C.success },
  selfMarkNoteText: {
    fontSize: 12,
    color: C.textMuted,
    fontWeight: '500',
    marginBottom: 4,
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
  markBtn: {
    borderWidth: 2,
    borderColor: C.primary,
    padding: 6,
    backgroundColor: C.primary,
  },
  absentBtn: {
    borderWidth: 2,
    borderColor: C.danger,
    padding: 6,
    backgroundColor: C.danger,
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
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    color: C.primary,
    marginBottom: 4,
  },
  editInfoValue: { fontSize: 15, fontWeight: '700', color: C.black },
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
  // Bulk button
  bulkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: C.white,
    borderWidth: 2,
    borderColor: C.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  bulkBtnText: {
    color: C.primary,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  bulkSelectAllRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 2,
    borderBottomColor: C.black,
    gap: 10,
  },
  bulkSelectAllText: {
    fontSize: 13,
    fontWeight: '700',
    color: C.black,
    textTransform: 'uppercase',
  },
  bulkEmpRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
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
  // Calendar modal
  calOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  calSheet: {
    backgroundColor: C.white,
    borderTopWidth: 2,
    borderTopColor: C.black,
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
  calNavArrow: { fontSize: 26, fontWeight: '700', color: C.black },
  calMonthLabel: { fontSize: 15, fontWeight: '700', color: C.black },
  calDowRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  calDowText: {
    flex: 1,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '700',
    color: C.textMuted,
    textTransform: 'uppercase',
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
    borderColor: C.black,
  },
  calCellToday: {
    borderWidth: 2,
    borderColor: C.primary,
  },
  calCellText: {
    fontSize: 13,
    fontWeight: '600',
    color: C.black,
  },
  calCellTextSelected: {
    color: C.white,
    fontWeight: '700',
  },
});

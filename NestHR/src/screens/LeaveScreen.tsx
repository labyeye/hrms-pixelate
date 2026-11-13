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
  DeviceEventEmitter,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  DatePickerField,
  TimePickerField,
} from '../components/common/DatePickerField';
import {
  Calendar,
  Plus,
  X,
  Check,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Pencil,
  Trash2,
  Camera,
  Search,
  SlidersHorizontal,
  FileText,
} from 'lucide-react-native';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
import { leaveAPI, attendanceSettingsAPI } from '../api/api';
import ExportButton from '../components/common/ExportButton';
import { useAuth } from '../contexts/AuthContext';
import { LeaveRequest } from '../types/hrms';
import { C, useResponsive } from '../theme';
import FadeInUp from '../components/motion/FadeInUp';
import AnimatedValue from '../components/motion/AnimatedValue';
import SlideInCard from '../components/motion/SlideInCard';
import { CENTER } from '../components/common/centerModal';
import HeaderIconBtn from '../components/common/HeaderIconBtn';
import SearchModal from '../components/common/SearchModal';
import FilterSortModal from '../components/common/FilterSortModal';
import DashStatCard, { dashStatRow } from '../components/common/DashStatCard';

const STATUS_CONFIG: Record<string, { color: string; bg: string; icon: any }> =
  {
    pending: { color: C.warning, bg: '#FEF3E2', icon: Clock },
    approved: { color: C.success, bg: '#E7F9F1', icon: CheckCircle2 },
    rejected: { color: C.danger, bg: '#FDEBEB', icon: XCircle },
  };

const LEAVE_TYPES = [
  'casual',
  'sick',
  'earned',
  'maternity',
  'paternity',
  'unpaid',
  'compensatory',
  'hourly',
  'wfh',
  'outdoor_duty',
];

export default function LeaveScreen() {
  const { user } = useAuth();
  const isEmployee = user?.role === 'employee';
  const { isTablet, maxContentWidth } = useResponsive();
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [leaveTypeFilter, setLeaveTypeFilter] = useState('');
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    leaveType: 'casual',
    startDate: '',
    endDate: '',
    reason: '',
    startHour: '',
    endHour: '',
  });
  const [pickedDoc, setPickedDoc] = useState<any>(null);
  const [usageMap, setUsageMap] = useState<
    Record<string, { used: number; allowed: number }>
  >({});
  const DOC_REQUIRED_TYPES = ['sick', 'casual'];
  const [approveModal, setApproveModal] = useState<{
    visible: boolean;
    leave: LeaveRequest | null;
    deductSalary: boolean;
    comment: string;
  }>({ visible: false, leave: null, deductSalary: false, comment: '' });
  const [rejectModal, setRejectModal] = useState<{
    visible: boolean;
    leave: LeaveRequest | null;
    comment: string;
  }>({ visible: false, leave: null, comment: '' });
  const [editLeave, setEditLeave] = useState<LeaveRequest | null>(null);
  const [showEditForm, setShowEditForm] = useState(false);
  const [editForm, setEditForm] = useState({
    leaveType: 'casual',
    startDate: '',
    endDate: '',
    reason: '',
    startHour: '',
    endHour: '',
  });

  const load = useCallback(async () => {
    try {
      const res = await leaveAPI.getAll();
      setLeaves(res.data || []);
      DeviceEventEmitter.emit('leaves:changed');
      if (!isEmployee) {
        const bal: any = await attendanceSettingsAPI
          .getBalanceSummary()
          .catch(() => null);
        if (bal?.success) {
          const m: Record<string, { used: number; allowed: number }> = {};
          for (const r of bal.data) {
            const rows = (r.leaveUsed || []).filter(
              (l: any) => l.daysAllowed > 0,
            );
            m[r.employee._id] = {
              used: rows.reduce((t: number, l: any) => t + l.daysUsed, 0),
              allowed: rows.reduce((t: number, l: any) => t + l.daysAllowed, 0),
            };
          }
          setUsageMap(m);
        }
      }
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

  const filtered = leaves.filter(l => {
    if (statusFilter && l.status !== statusFilter) return false;
    if (leaveTypeFilter && l.leaveType !== leaveTypeFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      const name = `${l.employee?.firstName || ''} ${
        l.employee?.lastName || ''
      }`.toLowerCase();
      if (
        !name.includes(q) &&
        !String(l.leaveType || '')
          .toLowerCase()
          .includes(q)
      )
        return false;
    }
    return true;
  });
  if (sortKey) {
    const nm = (l: any) =>
      `${l.employee?.firstName || ''} ${
        l.employee?.lastName || ''
      }`.toLowerCase();
    filtered.sort((a: any, b: any) =>
      sortKey === 'name'
        ? nm(a).localeCompare(nm(b))
        : sortKey === 'days'
        ? (b.days || 0) - (a.days || 0)
        : new Date(a.startDate).getTime() - new Date(b.startDate).getTime(),
    );
  }

  const leaveUsage = LEAVE_TYPES.reduce((acc, t) => {
    const approved = leaves.filter(
      l => l.leaveType === t && l.status === 'approved',
    );
    const days = approved.reduce((s, l) => s + (l.days || 0), 0);
    acc[t] = days;
    return acc;
  }, {} as Record<string, number>);

  const pickDocument = () => {
    Alert.alert('Attach Document', 'Choose source', [
      {
        text: 'Camera',
        onPress: () =>
          launchCamera({ mediaType: 'photo', quality: 0.8 }, r => {
            if (r.assets?.[0]) setPickedDoc(r.assets[0]);
          }),
      },
      {
        text: 'Gallery',
        onPress: () =>
          launchImageLibrary({ mediaType: 'photo', quality: 0.8 }, r => {
            if (r.assets?.[0]) setPickedDoc(r.assets[0]);
          }),
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const handleApply = async () => {
    const isHourly = form.leaveType === 'hourly';
    if (isHourly) {
      if (
        !form.startDate ||
        !form.startHour ||
        !form.endHour ||
        !form.reason.trim()
      ) {
        Alert.alert(
          'Validation',
          'Date, start hour, end hour and reason are required',
        );
        return;
      }
    } else {
      if (!form.startDate || !form.endDate || !form.reason.trim()) {
        Alert.alert(
          'Validation',
          'Start date, end date and reason are required',
        );
        return;
      }
    }
    if (DOC_REQUIRED_TYPES.includes(form.leaveType) && !pickedDoc) {
      Alert.alert(
        'Validation',
        'A supporting document is required for sick/casual leave',
      );
      return;
    }
    setSaving(true);
    try {
      const start = new Date(form.startDate);
      const end = isHourly ? start : new Date(form.endDate);
      const days = isHourly
        ? 0.125
        : Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
      const body = {
        ...form,
        endDate: isHourly ? form.startDate : form.endDate,
        days,
      };
      const res = pickedDoc
        ? await leaveAPI.createWithDocument(body, {
            uri: pickedDoc.uri,
            type: pickedDoc.type || 'image/jpeg',
            name: pickedDoc.fileName || `leave_doc_${Date.now()}.jpg`,
          })
        : await leaveAPI.create(body);
      setShowForm(false);
      setForm({
        leaveType: 'casual',
        startDate: '',
        endDate: '',
        reason: '',
        startHour: '',
        endHour: '',
      });
      setPickedDoc(null);
      await load();
      if (res?.noBalanceLeft) {
        Alert.alert(
          'No Balance Left',
          'No remaining no-deduction balance for this leave type this month — HR/Admin will decide on salary deduction.',
        );
      }
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleAction = async (
    leave: LeaveRequest,
    action: 'approved' | 'rejected',
    deductSalary?: boolean,
  ) => {
    if (action === 'rejected') {
      setRejectModal({ visible: true, leave, comment: '' });
      return;
    }
    setApproveModal({
      visible: true,
      leave,
      deductSalary: deductSalary ?? leave.leaveType === 'unpaid',
      comment: '',
    });
  };

  const confirmApprove = async () => {
    if (!approveModal.leave) return;
    try {
      await leaveAPI.updateStatus(approveModal.leave._id, {
        status: 'approved',
        deductSalary: approveModal.deductSalary,
        comment: approveModal.comment || undefined,
      });
      setApproveModal({
        visible: false,
        leave: null,
        deductSalary: false,
        comment: '',
      });
      await load();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  const confirmReject = async () => {
    if (!rejectModal.leave) return;
    if (!rejectModal.comment.trim()) {
      Alert.alert('Required', 'Please provide a rejection reason');
      return;
    }
    try {
      await leaveAPI.updateStatus(rejectModal.leave._id, {
        status: 'rejected',
        comment: rejectModal.comment,
      });
      setRejectModal({ visible: false, leave: null, comment: '' });
      await load();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  const openEdit = (leave: LeaveRequest) => {
    setEditLeave(leave);
    setEditForm({
      leaveType: leave.leaveType || 'casual',
      startDate: leave.startDate ? leave.startDate.split('T')[0] : '',
      endDate: leave.endDate ? leave.endDate.split('T')[0] : '',
      reason: leave.reason || '',
      startHour: (leave as any).startHour || '',
      endHour: (leave as any).endHour || '',
    });
    setShowEditForm(true);
  };

  const handleUpdate = async () => {
    if (!editLeave) return;
    const isHourly = editForm.leaveType === 'hourly';
    if (isHourly) {
      if (
        !editForm.startDate ||
        !editForm.startHour ||
        !editForm.endHour ||
        !editForm.reason.trim()
      ) {
        Alert.alert(
          'Validation',
          'Date, start hour, end hour and reason are required',
        );
        return;
      }
    } else {
      if (!editForm.startDate || !editForm.endDate || !editForm.reason.trim()) {
        Alert.alert(
          'Validation',
          'Start date, end date and reason are required',
        );
        return;
      }
    }
    setSaving(true);
    try {
      const start = new Date(editForm.startDate);
      const end = isHourly ? start : new Date(editForm.endDate);
      const days = isHourly
        ? 0.125
        : Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
      await leaveAPI.update(editLeave._id, {
        ...editForm,
        endDate: isHourly ? editForm.startDate : editForm.endDate,
        days,
      });
      setShowEditForm(false);
      setEditLeave(null);
      await load();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (leave: LeaveRequest) => {
    Alert.alert('Cancel Leave', 'Cancel this leave request?', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Yes, Cancel',
        style: 'destructive',
        onPress: async () => {
          try {
            await leaveAPI.delete(leave._id);
            await load();
          } catch (e: any) {
            Alert.alert('Error', e.message);
          }
        },
      },
    ]);
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

  const calculatedDays =
    form.leaveType === 'hourly'
      ? 'Hourly'
      : form.startDate && form.endDate
      ? `${Math.max(1, daysBetween(form.startDate, form.endDate))} day(s)`
      : null;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
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
          <Calendar size={20} color={C.primary} />
          <Text style={styles.headerTitle}>Leave Requests</Text>
        </View>
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
            dot={!!statusFilter || !!leaveTypeFilter || !!sortKey}
            onPress={() => setFilterOpen(true)}
          />
          <ExportButton
            name="leave_requests"
            label=""
            rows={filtered}
            cols={[
              { header: 'Emp Code', value: (l: any) => l.employee?.employeeId },
              {
                header: 'Employee',
                value: (l: any) =>
                  `${l.employee?.firstName || ''} ${
                    l.employee?.lastName || ''
                  }`.trim(),
              },
              {
                header: 'Designation',
                value: (l: any) => l.employee?.designation,
              },
              {
                header: 'Free Leave Used',
                value: (l: any) => {
                  const u = usageMap[l.employee?._id];
                  return u ? `${u.used}/${u.allowed}` : '';
                },
              },
              { header: 'Type', value: (l: any) => l.leaveType },
              {
                header: 'From',
                value: (l: any) => String(l.startDate).slice(0, 10),
              },
              {
                header: 'To',
                value: (l: any) => String(l.endDate).slice(0, 10),
              },
              { header: 'Days', value: (l: any) => l.days },
              { header: 'Reason', value: (l: any) => l.reason },
              { header: 'Status', value: (l: any) => l.status },
              {
                header: 'Paid/Unpaid',
                value: (l: any) =>
                  l.status === 'approved'
                    ? l.deductSalary
                      ? 'Unpaid'
                      : 'Paid'
                    : '',
              },
            ]}
          />
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => {
              setPickedDoc(null);
              setShowForm(true);
            }}
            accessibilityLabel="Apply"
            hitSlop={8}
          >
            <Plus size={24} color={C.primary} />
          </TouchableOpacity>
        </View>
      </View>

      <SearchModal
        visible={searchOpen}
        onClose={() => setSearchOpen(false)}
        value={search}
        onChange={setSearch}
        placeholder="Search by employee or leave type…"
        items={leaves.map((l: any) => ({
          key: l._id,
          title:
            `${l.employee?.firstName || ''} ${
              l.employee?.lastName || ''
            }`.trim() || String(l.leaveType),
          subtitle: `${l.leaveType} · ${l.status}`,
        }))}
      />
      <FilterSortModal
        visible={filterOpen}
        onClose={() => setFilterOpen(false)}
        filterTitle="Status"
        filterOptions={[
          { key: '', label: 'All' },
          { key: 'pending', label: 'Pending' },
          { key: 'approved', label: 'Approved' },
          { key: 'rejected', label: 'Rejected' },
        ]}
        filterValue={statusFilter}
        onFilter={setStatusFilter}
        filter2Title="Leave type"
        filter2Options={[
          { key: '', label: 'All' },
          ...LEAVE_TYPES.map(t => ({ key: t, label: t })),
        ]}
        filter2Value={leaveTypeFilter}
        onFilter2={setLeaveTypeFilter}
        sortOptions={[
          { key: '', label: 'Default' },
          { key: 'date', label: 'Start date' },
          { key: 'name', label: 'Employee A–Z' },
          { key: 'days', label: 'Most days' },
        ]}
        sortValue={sortKey}
        onSort={setSortKey}
        onReset={() => {
          setStatusFilter('');
          setLeaveTypeFilter('');
          setSortKey('');
        }}
      />

      {isEmployee && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.balanceStrip}
          contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}
        >
          {LEAVE_TYPES.map((t, i) => {
            const used = leaveUsage[t] ?? 0;
            return (
              <FadeInUp
                key={t}
                delay={Math.min(i, 8) * 70}
                style={styles.balanceCard}
              >
                <Text style={styles.balanceType}>{sentence(t)}</Text>
                <AnimatedValue
                  style={[
                    styles.balanceDays,
                    { color: used > 0 ? C.primary : C.textMuted },
                  ]}
                  value={used > 0 ? `${used}d used` : '0d'}
                />
              </FadeInUp>
            );
          })}
        </ScrollView>
      )}

      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={C.primary} />
        </View>
      ) : (
        <FlatList
          key={isTablet ? 'tablet-grid-3' : 'mobile-list'}
          data={filtered}
          keyExtractor={item => item._id}
          numColumns={isTablet ? 3 : 1}
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
                label="Total"
                value={leaves.length}
                icon={Calendar}
                color={C.primary}
              />
              <DashStatCard
                index={1}
                label="Pending"
                value={counts.pending}
                icon={Clock}
                color={C.warning}
              />
              <DashStatCard
                index={2}
                label="Approved"
                value={counts.approved}
                icon={CheckCircle2}
                color={C.success}
              />
              <DashStatCard
                index={3}
                label="Rejected"
                value={counts.rejected}
                icon={XCircle}
                color={C.danger}
              />
            </View>
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Calendar size={40} color="#D1D5DB" />
              <Text style={styles.emptyText}>No leave requests</Text>
            </View>
          }
          renderItem={({ item, index }) => {
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
            const initials = emp
              ? `${emp.firstName?.[0] || ''}${
                  emp.lastName?.[0] || ''
                }`.toUpperCase()
              : '?';
            return (
              <SlideInCard
                index={index}
                style={isTablet ? styles.cardTablet : undefined}
              >
                <View style={styles.card}>
                  <View style={styles.cardRow}>
                    <View style={styles.photoWrap}>
                      {emp?.avatar ? (
                        <Image
                          source={{ uri: emp.avatar }}
                          style={styles.empPhoto}
                        />
                      ) : (
                        <View
                          style={[
                            styles.empPhoto,
                            styles.empPhotoFallback,
                            { backgroundColor: cfg.bg },
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
                          { backgroundColor: C.white, borderColor: cfg.color },
                        ]}
                      >
                        <Icon size={14} color={cfg.color} />
                      </View>
                    </View>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={styles.codeChip}>
                        {emp?.employeeId || '—'}
                      </Text>
                      <Text style={styles.empName} numberOfLines={1}>
                        {emp ? `${emp.firstName} ${emp.lastName}` : 'Unknown'}
                      </Text>
                      <Text style={styles.empSub} numberOfLines={1}>
                        {emp?.designation || '—'}
                      </Text>
                      {!isEmployee && usageMap[emp?._id]?.allowed > 0 && (
                        <Text style={styles.freeLeave}>
                          Free leave: {usageMap[emp._id].used}/
                          {usageMap[emp._id].allowed} d
                        </Text>
                      )}
                    </View>
                    <View style={{ alignItems: 'flex-end', gap: 4 }}>
                      <View style={styles.statusLine}>
                        <View
                          style={[
                            styles.statusTag,
                            { backgroundColor: cfg.bg, borderColor: cfg.color },
                          ]}
                        >
                          <Text
                            style={[styles.statusTagText, { color: cfg.color }]}
                          >
                            {sentence(item.status)}
                          </Text>
                        </View>
                        {item.status === 'approved' && (
                          <View
                            style={[
                              styles.statusTag,
                              (item as any).deductSalary
                                ? {
                                    backgroundColor: '#FFF1E6',
                                    borderColor: C.secondary,
                                  }
                                : {
                                    backgroundColor: '#E7F9F1',
                                    borderColor: C.success,
                                  },
                            ]}
                          >
                            <Text
                              style={[
                                styles.statusTagText,
                                {
                                  color: (item as any).deductSalary
                                    ? C.secondary
                                    : C.success,
                                },
                              ]}
                            >
                              {(item as any).deductSalary ? 'Unpaid' : 'Paid'}
                            </Text>
                          </View>
                        )}
                      </View>
                      <View style={styles.typeDays}>
                        <Text style={styles.typeText}>
                          {sentence(item.leaveType)}
                        </Text>
                        <Text style={styles.typeText}>
                          {days ? `${days}d` : ''}
                        </Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.cardDivider} />
                  <View style={styles.statsRow}>
                    <View style={styles.statCol}>
                      <View style={styles.statLabelRow}>
                        <View
                          style={[
                            styles.statIconWrap,
                            { backgroundColor: '#E8F0FB' },
                          ]}
                        >
                          <Calendar size={14} color={C.primary} />
                        </View>
                        <Text style={styles.statLabel}>From</Text>
                      </View>
                      <Text
                        style={styles.statValue}
                        numberOfLines={1}
                        adjustsFontSizeToFit
                      >
                        {formatDate(item.startDate)}
                      </Text>
                    </View>
                    <View style={styles.statDivider} />
                    <View style={styles.statCol}>
                      <View style={styles.statLabelRow}>
                        <View
                          style={[
                            styles.statIconWrap,
                            { backgroundColor: '#E8F0FB' },
                          ]}
                        >
                          <Calendar size={14} color={C.primary} />
                        </View>
                        <Text style={styles.statLabel}>To</Text>
                      </View>
                      <Text
                        style={styles.statValue}
                        numberOfLines={1}
                        adjustsFontSizeToFit
                      >
                        {formatDate(item.endDate)}
                      </Text>
                    </View>
                    {days && (
                      <>
                        <View style={styles.statDivider} />
                        <View style={styles.statCol}>
                          <View style={styles.statLabelRow}>
                            <View
                              style={[
                                styles.statIconWrap,
                                { backgroundColor: '#F0EBFC' },
                              ]}
                            >
                              <Clock size={14} color="#7C3AED" />
                            </View>
                            <Text style={styles.statLabel}>Duration</Text>
                          </View>
                          <Text
                            style={styles.statValue}
                            numberOfLines={1}
                            adjustsFontSizeToFit
                          >
                            {days}d
                          </Text>
                        </View>
                      </>
                    )}
                  </View>

                  {item.reason && (
                    <Text style={styles.reason}>{item.reason}</Text>
                  )}

                  {(item as any).comment && (
                    <Text style={styles.commentText}>
                      "{(item as any).comment}"
                    </Text>
                  )}

                  {item.status === 'pending' && !isEmployee && (
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
                  {item.status === 'pending' && isEmployee && (
                    <View style={styles.actionRow}>
                      <TouchableOpacity
                        style={styles.approveBtn}
                        onPress={() => openEdit(item)}
                      >
                        <Pencil size={14} color={C.white} />
                        <Text style={styles.actionBtnText}>Edit</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.rejectBtn}
                        onPress={() => handleDelete(item)}
                      >
                        <Trash2 size={14} color={C.white} />
                        <Text style={styles.actionBtnText}>Cancel</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              </SlideInCard>
            );
          }}
        />
      )}

      {/* Approve Leave Modal */}
      <Modal
        visible={approveModal.visible}
        transparent
        animationType="fade"
        onRequestClose={() =>
          setApproveModal({
            visible: false,
            leave: null,
            deductSalary: false,
            comment: '',
          })
        }
      >
        <View style={styles.overlay}>
          <View style={styles.approveModalBox}>
            <Text style={styles.approveModalTitle}>Approve Leave</Text>
            {approveModal.leave && (
              <Text style={styles.approveModalSub}>
                {(approveModal.leave.employee as any)?.firstName}{' '}
                {(approveModal.leave.employee as any)?.lastName} ·{' '}
                {sentence(approveModal.leave.leaveType)} ·{' '}
                {approveModal.leave.days ?? '?'}d
              </Text>
            )}
            <Text style={styles.approveModalLabel}>Salary Treatment</Text>
            <View style={styles.toggleRow}>
              <TouchableOpacity
                style={[
                  styles.toggleOpt,
                  !approveModal.deductSalary && styles.toggleOptActive,
                  { borderColor: '#00a36c' },
                  !approveModal.deductSalary && { backgroundColor: '#00a36c' },
                ]}
                onPress={() =>
                  setApproveModal(p => ({ ...p, deductSalary: false }))
                }
              >
                <Text
                  style={[
                    styles.toggleOptText,
                    !approveModal.deductSalary && { color: C.white },
                  ]}
                >
                  Paid Leave
                </Text>
                <Text
                  style={[
                    styles.toggleOptSub,
                    !approveModal.deductSalary && { color: C.white },
                  ]}
                >
                  No deduction
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.toggleOpt,
                  approveModal.deductSalary && styles.toggleOptActive,
                  { borderColor: '#EA580C' },
                  approveModal.deductSalary && { backgroundColor: '#EA580C' },
                ]}
                onPress={() =>
                  setApproveModal(p => ({ ...p, deductSalary: true }))
                }
              >
                <Text
                  style={[
                    styles.toggleOptText,
                    approveModal.deductSalary && { color: C.white },
                  ]}
                >
                  Unpaid Leave
                </Text>
                <Text
                  style={[
                    styles.toggleOptSub,
                    approveModal.deductSalary && { color: C.white },
                  ]}
                >
                  Deduct salary
                </Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.approveModalLabel}>Comment (optional)</Text>
            <TextInput
              style={styles.commentInput}
              value={approveModal.comment}
              onChangeText={v => setApproveModal(p => ({ ...p, comment: v }))}
              placeholder="Add a note for the employee..."
              placeholderTextColor={C.textLight}
              multiline
            />
            <View style={styles.approveModalActions}>
              <TouchableOpacity
                style={styles.approveModalCancel}
                onPress={() =>
                  setApproveModal({
                    visible: false,
                    leave: null,
                    deductSalary: false,
                    comment: '',
                  })
                }
              >
                <Text style={styles.approveModalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.approveModalConfirm}
                onPress={confirmApprove}
              >
                <Check size={14} color={C.white} />
                <Text style={styles.approveModalConfirmText}>Approve</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Reject Leave Modal */}
      <Modal
        visible={rejectModal.visible}
        transparent
        animationType="fade"
        onRequestClose={() =>
          setRejectModal({ visible: false, leave: null, comment: '' })
        }
      >
        <View style={styles.overlay}>
          <View style={styles.approveModalBox}>
            <Text style={styles.approveModalTitle}>Reject Leave</Text>
            {rejectModal.leave && (
              <Text style={styles.approveModalSub}>
                {(rejectModal.leave.employee as any)?.firstName}{' '}
                {(rejectModal.leave.employee as any)?.lastName} ·{' '}
                {sentence(rejectModal.leave.leaveType)}
              </Text>
            )}
            <Text style={styles.approveModalLabel}>Reason for rejection</Text>
            <TextInput
              style={styles.commentInput}
              value={rejectModal.comment}
              onChangeText={v => setRejectModal(p => ({ ...p, comment: v }))}
              placeholder="Reason for rejection..."
              placeholderTextColor={C.textLight}
              multiline
            />
            <View style={styles.approveModalActions}>
              <TouchableOpacity
                style={styles.approveModalCancel}
                onPress={() =>
                  setRejectModal({ visible: false, leave: null, comment: '' })
                }
              >
                <Text style={styles.approveModalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.approveModalConfirm,
                  { backgroundColor: C.danger },
                ]}
                onPress={confirmReject}
              >
                <X size={14} color={C.white} />
                <Text style={styles.approveModalConfirmText}>Reject</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Edit Leave Modal (clean horizontal pills + structured inputs) */}
      <Modal visible={showEditForm} transparent animationType="fade">
        <View style={CENTER.overlay}>
          <View style={CENTER.card}>
            <SafeAreaView style={styles.modalSafe} edges={[]}>
              <View style={styles.modalHeader}>
                <View style={styles.modalHeaderLeft}>
                  <Calendar size={18} color={C.primary} />
                  <Text style={styles.modalTitle}>Edit Leave Request</Text>
                </View>
                <TouchableOpacity
                  onPress={() => {
                    setShowEditForm(false);
                    setEditLeave(null);
                  }}
                  style={styles.closeBtn}
                >
                  <X size={20} color={C.black} />
                </TouchableOpacity>
              </View>
              <ScrollView
                contentContainerStyle={{ padding: 16, gap: 14 }}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                <View>
                  <Text style={styles.fieldLabel}>LEAVE TYPE</Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ gap: 8, paddingVertical: 2 }}
                  >
                    {LEAVE_TYPES.map(t => {
                      const active = editForm.leaveType === t;
                      return (
                        <TouchableOpacity
                          key={t}
                          style={[
                            styles.typeChip,
                            active && styles.typeChipActive,
                          ]}
                          onPress={() =>
                            setEditForm(p => ({ ...p, leaveType: t }))
                          }
                        >
                          <Text
                            style={[
                              styles.typeChipText,
                              active && styles.typeChipTextActive,
                            ]}
                          >
                            {sentence(t)}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>

                {editForm.leaveType === 'hourly' ? (
                  <DatePickerField
                    label="Date *"
                    value={editForm.startDate}
                    onChange={v => setEditForm(p => ({ ...p, startDate: v }))}
                  />
                ) : (
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <View style={{ flex: 1 }}>
                      <DatePickerField
                        label="Start Date *"
                        value={editForm.startDate}
                        onChange={v =>
                          setEditForm(p => ({ ...p, startDate: v }))
                        }
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <DatePickerField
                        label="End Date *"
                        value={editForm.endDate}
                        onChange={v => setEditForm(p => ({ ...p, endDate: v }))}
                      />
                    </View>
                  </View>
                )}

                {editForm.leaveType === 'hourly' && (
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <View style={{ flex: 1 }}>
                      <TimePickerField
                        label="Start Time *"
                        value={editForm.startHour}
                        onChange={v =>
                          setEditForm(p => ({ ...p, startHour: v }))
                        }
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <TimePickerField
                        label="End Time *"
                        value={editForm.endHour}
                        onChange={v => setEditForm(p => ({ ...p, endHour: v }))}
                      />
                    </View>
                  </View>
                )}

                <View>
                  <Text style={styles.fieldLabel}>REASON *</Text>
                  <TextInput
                    style={[styles.fieldInput, { minHeight: 80 }]}
                    value={editForm.reason}
                    onChangeText={v => setEditForm(p => ({ ...p, reason: v }))}
                    placeholder="Explain your reason…"
                    placeholderTextColor={C.textLight}
                    multiline
                    textAlignVertical="top"
                  />
                </View>

                <TouchableOpacity
                  style={styles.submitBtn}
                  onPress={handleUpdate}
                  disabled={saving}
                >
                  {saving ? (
                    <ActivityIndicator color={C.white} />
                  ) : (
                    <>
                      <Check size={16} color={C.white} />
                      <Text style={styles.submitBtnText}>
                        Update Leave Request
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </ScrollView>
            </SafeAreaView>
          </View>
        </View>
      </Modal>

      {/* Apply Leave Modal (redesigned for clean hierarchy & compact spacing) */}
      <Modal visible={showForm} transparent animationType="fade">
        <View style={CENTER.overlay}>
          <View style={CENTER.card}>
            <SafeAreaView style={styles.modalSafe} edges={[]}>
              <View style={styles.modalHeader}>
                <View style={styles.modalHeaderLeft}>
                  <Calendar size={18} color={C.primary} />
                  <Text style={styles.modalTitle}>Apply for Leave</Text>
                  {!!calculatedDays && (
                    <View style={styles.durationPill}>
                      <Text style={styles.durationPillText}>
                        {calculatedDays}
                      </Text>
                    </View>
                  )}
                </View>
                <TouchableOpacity
                  onPress={() => setShowForm(false)}
                  style={styles.closeBtn}
                >
                  <X size={20} color={C.black} />
                </TouchableOpacity>
              </View>

              <ScrollView
                contentContainerStyle={{
                  padding: 16,
                  gap: 14,
                  paddingBottom: 24,
                }}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                {/* Horizontal scrollable Leave Type chips */}
                <View>
                  <Text style={styles.fieldLabel}>LEAVE TYPE</Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ gap: 8, paddingVertical: 2 }}
                  >
                    {LEAVE_TYPES.map(t => {
                      const active = form.leaveType === t;
                      return (
                        <TouchableOpacity
                          key={t}
                          style={[
                            styles.typeChip,
                            active && styles.typeChipActive,
                          ]}
                          onPress={() => setForm(p => ({ ...p, leaveType: t }))}
                          activeOpacity={0.8}
                        >
                          <Text
                            style={[
                              styles.typeChipText,
                              active && styles.typeChipTextActive,
                            ]}
                          >
                            {sentence(t)}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>

                {/* Date / Time Pickers */}
                {form.leaveType === 'hourly' ? (
                  <DatePickerField
                    label="Date *"
                    value={form.startDate}
                    onChange={v => setForm(p => ({ ...p, startDate: v }))}
                  />
                ) : (
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <View style={{ flex: 1 }}>
                      <DatePickerField
                        label="Start Date *"
                        value={form.startDate}
                        onChange={v => setForm(p => ({ ...p, startDate: v }))}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <DatePickerField
                        label="End Date *"
                        value={form.endDate}
                        onChange={v => setForm(p => ({ ...p, endDate: v }))}
                      />
                    </View>
                  </View>
                )}

                {form.leaveType === 'hourly' && (
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <View style={{ flex: 1 }}>
                      <TimePickerField
                        label="Start Time *"
                        value={form.startHour}
                        onChange={v => setForm(p => ({ ...p, startHour: v }))}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <TimePickerField
                        label="End Time *"
                        value={form.endHour}
                        onChange={v => setForm(p => ({ ...p, endHour: v }))}
                      />
                    </View>
                  </View>
                )}

                {/* Reason */}
                <View>
                  <Text style={styles.fieldLabel}>REASON *</Text>
                  <TextInput
                    style={[styles.fieldInput, { minHeight: 80 }]}
                    value={form.reason}
                    onChangeText={v => setForm(p => ({ ...p, reason: v }))}
                    placeholder="Explain your reason…"
                    placeholderTextColor={C.textLight}
                    multiline
                    textAlignVertical="top"
                  />
                </View>

                {/* Supporting Document Upload Box */}
                <View>
                  <View style={styles.docLabelRow}>
                    <Text style={styles.fieldLabel}>
                      SUPPORTING DOCUMENT
                      {DOC_REQUIRED_TYPES.includes(form.leaveType)
                        ? ' *'
                        : ' (OPTIONAL)'}
                    </Text>
                    {pickedDoc && (
                      <TouchableOpacity
                        onPress={() => setPickedDoc(null)}
                        hitSlop={8}
                      >
                        <Text style={styles.removeDocText}>Remove</Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  <TouchableOpacity
                    style={[
                      styles.docPicker,
                      pickedDoc && styles.docPickerAttached,
                    ]}
                    onPress={pickDocument}
                    activeOpacity={0.8}
                  >
                    {pickedDoc ? (
                      <>
                        {pickedDoc.uri ? (
                          <Image
                            source={{ uri: pickedDoc.uri }}
                            style={styles.docThumb}
                          />
                        ) : (
                          <View style={styles.docIconBox}>
                            <FileText size={18} color={C.primary} />
                          </View>
                        )}
                        <View style={{ flex: 1 }}>
                          <Text style={styles.docPickerText} numberOfLines={1}>
                            {pickedDoc.fileName || 'Document attached'}
                          </Text>
                          <Text style={styles.docSubText}>
                            Tap to replace photo
                          </Text>
                        </View>
                        <CheckCircle2 size={18} color={C.success} />
                      </>
                    ) : (
                      <>
                        <View style={styles.docIconBox}>
                          <Camera size={18} color={C.primary} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.docPickerPlaceholder}>
                            Tap to attach a photo or scan
                          </Text>
                          {DOC_REQUIRED_TYPES.includes(form.leaveType) && (
                            <Text style={styles.docSubText}>
                              Required for {sentence(form.leaveType)} leave
                            </Text>
                          )}
                        </View>
                      </>
                    )}
                  </TouchableOpacity>
                </View>

                <TouchableOpacity
                  style={styles.submitBtn}
                  onPress={handleApply}
                  disabled={saving}
                  activeOpacity={0.85}
                >
                  {saving ? (
                    <ActivityIndicator color={C.white} />
                  ) : (
                    <>
                      <Check size={16} color={C.white} />
                      <Text style={styles.submitBtnText}>
                        Submit Application
                      </Text>
                    </>
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
  codeChip: {
    alignSelf: 'flex-start',
    fontSize: 11,
    fontWeight: '400',
    color: C.primary,
    backgroundColor: C.primary + '18',
    borderWidth: 1.5,
    borderColor: C.primary,
    paddingHorizontal: 6,
    paddingVertical: 1,
    marginBottom: 4,
  },
  freeLeave: {
    fontSize: 11,
    fontWeight: '400',
    color: C.primary,
    marginTop: 2,
  },
  statusLine: { flexDirection: 'row', gap: 4, alignItems: 'center' },
  typeDays: { flexDirection: 'row', gap: 6 },
  typeText: { fontSize: 11, fontWeight: '400', color: C.textMuted },
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
  balanceStrip: {
    maxHeight: 52,
    backgroundColor: C.white,
    borderBottomWidth: 2,
    borderBottomColor: C.black,
    paddingVertical: 8,
  },
  balanceCard: {
    borderWidth: 2,
    borderRadius: 8,
    borderRightWidth: 4,
    borderBottomWidth: 4,
    borderRightColor: '#0A0A0A',
    borderBottomColor: '#0A0A0A',
    borderColor: C.black,
    paddingHorizontal: 12,
    paddingVertical: 4,
    alignItems: 'center',
    minWidth: 72,
  },
  balanceType: {
    fontSize: 11,
    fontWeight: '400',
    color: C.black,
    textTransform: 'capitalize',
  },
  balanceDays: {
    fontSize: 11,
    fontWeight: '400',
    marginTop: 2,
  },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyText: { fontSize: 14, fontWeight: '400', color: C.textMuted },
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
    padding: 16,
  },
  cardRow: { flexDirection: 'row', alignItems: 'center' },
  photoWrap: { position: 'relative', width: 48, height: 48 },
  empPhoto: { width: 48, height: 48, borderRadius: 24 },
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
  empName: {
    fontSize: 15,
    fontWeight: '400',
    color: C.black,
    letterSpacing: 0.2,
  },
  empSub: { fontSize: 11, color: '#6B7280', fontWeight: '400', marginTop: 2 },
  statusTag: {
    borderWidth: 1.5,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  statusTagText: { fontSize: 11, fontWeight: '400', letterSpacing: 0.3 },
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
  statLabel: { fontSize: 11, color: '#6B7280', fontWeight: '400' },
  statValue: { fontSize: 15, fontWeight: '400', color: C.black },
  reason: {
    fontSize: 12,
    color: C.textMuted,
    fontStyle: 'italic',
    marginTop: 6,
  },
  commentInput: {
    borderWidth: 2,
    borderRadius: 8,
    borderRightWidth: 4,
    borderBottomWidth: 4,
    borderRightColor: '#0A0A0A',
    borderBottomColor: '#0A0A0A',
    borderColor: C.black,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: C.black,
    backgroundColor: C.white,
    minHeight: 60,
    marginTop: 8,
    marginBottom: 16,
  },
  commentText: {
    fontSize: 11,
    color: C.textMuted,
    fontStyle: 'italic',
    marginTop: 6,
    paddingLeft: 8,
    borderLeftWidth: 2,
    borderLeftColor: '#E5E7EB',
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
    borderRadius: 8,
    paddingVertical: 8,
  },
  rejectBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: C.danger,
    borderRadius: 8,
    paddingVertical: 8,
  },
  actionBtnText: {
    color: C.white,
    fontSize: 12,
    fontWeight: '400',
  },

  // Redesigned Apply / Edit Form Modal
  modalSafe: {
    flex: 1,
    backgroundColor: C.white,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: C.white,
    borderBottomWidth: 2,
    borderBottomColor: C.black,
  },
  modalHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '400',
    color: C.black,
  },
  durationPill: {
    backgroundColor: C.primary + '18',
    borderWidth: 1.5,
    borderColor: C.primary,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  durationPillText: {
    fontSize: 11,
    fontWeight: '400',
    color: C.primary,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: C.black,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8F9FA',
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '400',
    color: C.textMuted,
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  typeChip: {
    borderWidth: 1.5,
    borderRadius: 8,
    borderColor: C.black,
    backgroundColor: C.white,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  typeChipActive: {
    backgroundColor: C.primary,
    borderColor: C.black,
  },
  typeChipText: {
    fontSize: 12,
    fontWeight: '400',
    color: C.black,
  },
  typeChipTextActive: {
    color: C.white,
  },
  fieldInput: {
    borderWidth: 2,
    borderRadius: 8,
    borderColor: C.black,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    fontWeight: '400',
    color: C.black,
    backgroundColor: C.white,
  },
  docLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  removeDocText: {
    fontSize: 11,
    color: C.danger,
    fontWeight: '400',
    marginBottom: 6,
  },
  docPicker: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 2,
    borderRadius: 8,
    borderColor: C.black,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: '#F8F9FA',
  },
  docPickerAttached: {
    backgroundColor: '#EFF6FF',
    borderColor: C.primary,
  },
  docIconBox: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: C.white,
    borderWidth: 1.5,
    borderColor: C.black,
    alignItems: 'center',
    justifyContent: 'center',
  },
  docThumb: {
    width: 36,
    height: 36,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: C.black,
  },
  docPickerText: {
    fontSize: 13,
    fontWeight: '400',
    color: C.black,
  },
  docPickerPlaceholder: {
    fontSize: 13,
    fontWeight: '400',
    color: C.black,
  },
  docSubText: {
    fontSize: 11,
    color: C.textMuted,
    marginTop: 2,
  },
  submitBtn: {
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
    paddingVertical: 14,
    marginTop: 4,
  },
  submitBtnText: {
    color: C.white,
    fontWeight: '400',
    fontSize: 14,
  },

  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  approveModalBox: {
    backgroundColor: C.white,
    borderWidth: 2,
    borderRadius: 8,
    borderRightWidth: 4,
    borderBottomWidth: 4,
    borderRightColor: '#0A0A0A',
    borderBottomColor: '#0A0A0A',
    borderColor: C.black,
    padding: 20,
    width: '100%',
    maxWidth: 380,
  },
  approveModalTitle: { fontSize: 18, fontWeight: '400', color: C.black },
  approveModalSub: {
    fontSize: 12,
    color: C.textMuted,
    marginTop: 4,
    marginBottom: 16,
  },
  approveModalLabel: {
    fontSize: 11,
    fontWeight: '400',
    color: C.black,
    marginBottom: 8,
  },
  toggleRow: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  toggleOpt: {
    flex: 1,
    borderWidth: 2,
    borderRightWidth: 4,
    borderBottomWidth: 4,
    borderRightColor: '#0A0A0A',
    borderBottomColor: '#0A0A0A',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  toggleOptActive: {},
  toggleOptText: { fontSize: 13, fontWeight: '400', color: C.black },
  toggleOptSub: { fontSize: 11, color: C.textMuted, marginTop: 2 },
  approveModalActions: { flexDirection: 'row', gap: 12 },
  approveModalCancel: {
    flex: 1,
    borderWidth: 2,
    borderRadius: 8,
    borderRightWidth: 4,
    borderBottomWidth: 4,
    borderRightColor: '#0A0A0A',
    borderBottomColor: '#0A0A0A',
    borderColor: C.black,
    paddingVertical: 12,
    alignItems: 'center',
  },
  approveModalCancelText: { fontSize: 13, fontWeight: '400', color: C.black },
  approveModalConfirm: {
    flex: 1,
    flexDirection: 'row',
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  approveModalConfirmText: {
    fontSize: 13,
    fontWeight: '400',
    color: C.white,
  },
});

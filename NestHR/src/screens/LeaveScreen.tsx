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
import { DatePickerField, TimePickerField } from '../components/common/DatePickerField';
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
} from 'lucide-react-native';
import { leaveAPI } from '../api/api';
import { useAuth } from '../contexts/AuthContext';
import { LeaveRequest } from '../types/hrms';
import { C } from '../theme';

const STATUS_CONFIG: Record<string, { color: string; bg: string; icon: any }> =
  {
    pending: { color: C.warning, bg: '#FFF7ED', icon: Clock },
    approved: { color: C.success, bg: '#F0FDF4', icon: CheckCircle2 },
    rejected: { color: C.danger, bg: '#FEF2F2', icon: XCircle },
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
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [leaveTypeFilter, setLeaveTypeFilter] = useState('');
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

  // Change 1: filter by both status and leave type
  const filtered = leaves.filter(l => {
    if (statusFilter && l.status !== statusFilter) return false;
    if (leaveTypeFilter && l.leaveType !== leaveTypeFilter) return false;
    return true;
  });

  // Change 2: leave usage per type (for employee balance strip)
  const leaveUsage = LEAVE_TYPES.reduce((acc, t) => {
    const approved = leaves.filter(l => l.leaveType === t && l.status === 'approved');
    const days = approved.reduce((s, l) => s + (l.days || 0), 0);
    acc[t] = days;
    return acc;
  }, {} as Record<string, number>);

  const handleApply = async () => {
    const isHourly = form.leaveType === 'hourly';
    if (isHourly) {
      if (!form.startDate || !form.startHour || !form.endHour || !form.reason.trim()) {
        Alert.alert('Validation', 'Date, start hour, end hour and reason are required');
        return;
      }
    } else {
      if (!form.startDate || !form.endDate || !form.reason.trim()) {
        Alert.alert('Validation', 'Start date, end date and reason are required');
        return;
      }
    }
    setSaving(true);
    try {
      const start = new Date(form.startDate);
      const end = isHourly ? start : new Date(form.endDate);
      const days = isHourly ? 0.125 : Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
      await leaveAPI.create({
        ...form,
        endDate: isHourly ? form.startDate : form.endDate,
        days,
      });
      setShowForm(false);
      setForm({ leaveType: 'casual', startDate: '', endDate: '', reason: '', startHour: '', endHour: '' });
      await load();
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
      // Change 4: open reject modal instead of Alert
      setRejectModal({ visible: true, leave, comment: '' });
      return;
    }
    // For approval: show deductSalary modal
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
      // Change 3: pass comment to updateStatus
      await leaveAPI.updateStatus(approveModal.leave._id, {
        status: 'approved',
        deductSalary: approveModal.deductSalary,
        comment: approveModal.comment || undefined,
      });
      setApproveModal({ visible: false, leave: null, deductSalary: false, comment: '' });
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
      if (!editForm.startDate || !editForm.startHour || !editForm.endHour || !editForm.reason.trim()) {
        Alert.alert('Validation', 'Date, start hour, end hour and reason are required');
        return;
      }
    } else {
      if (!editForm.startDate || !editForm.endDate || !editForm.reason.trim()) {
        Alert.alert('Validation', 'Start date, end date and reason are required');
        return;
      }
    }
    setSaving(true);
    try {
      const start = new Date(editForm.startDate);
      const end = isHourly ? start : new Date(editForm.endDate);
      const days = isHourly ? 0.125 : Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
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

      {/* Change 2: Leave balance strip (employee only) */}
      {isEmployee && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.balanceStrip}
          contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}
        >
          {LEAVE_TYPES.map(t => {
            const used = leaveUsage[t] ?? 0;
            return (
              <View key={t} style={styles.balanceCard}>
                <Text style={styles.balanceType}>{t.toUpperCase()}</Text>
                <Text
                  style={[
                    styles.balanceDays,
                    { color: used > 0 ? C.primary : C.textMuted },
                  ]}
                >
                  {used > 0 ? `${used}d used` : '0d'}
                </Text>
              </View>
            );
          })}
        </ScrollView>
      )}

      {/* Change 1: Functional filter chips */}
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
          <TouchableOpacity
            key={f.key}
            style={[
              styles.chip,
              leaveTypeFilter === f.key && styles.chipActive,
            ]}
            onPress={() =>
              setLeaveTypeFilter(p => (p === f.key ? '' : f.key))
            }
          >
            <Text
              style={[
                styles.chipText,
                leaveTypeFilter === f.key && styles.chipTextActive,
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
                          {(emp.firstName?.[0] || '') +
                            (emp.lastName?.[0] || '')}
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

                {/* Change 4: show comment on card */}
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
                {item.status === 'pending' && isEmployee && (
                  <View style={styles.actionRow}>
                    <TouchableOpacity
                      style={styles.approveBtn}
                      onPress={() => openEdit(item)}
                    >
                      <Pencil size={13} color={C.white} />
                      <Text style={styles.actionBtnText}>Edit</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.rejectBtn}
                      onPress={() => handleDelete(item)}
                    >
                      <Trash2 size={13} color={C.white} />
                      <Text style={styles.actionBtnText}>Cancel</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            );
          }}
        />
      )}

      {/* Change 3: Approve Leave Modal with comment */}
      <Modal
        visible={approveModal.visible}
        transparent
        animationType="fade"
        onRequestClose={() =>
          setApproveModal({ visible: false, leave: null, deductSalary: false, comment: '' })
        }
      >
        <View style={styles.overlay}>
          <View style={styles.approveModalBox}>
            <Text style={styles.approveModalTitle}>Approve Leave</Text>
            {approveModal.leave && (
              <Text style={styles.approveModalSub}>
                {(approveModal.leave.employee as any)?.firstName}{' '}
                {(approveModal.leave.employee as any)?.lastName} ·{' '}
                {approveModal.leave.leaveType?.toUpperCase()} ·{' '}
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

      {/* Change 4: Reject Leave Modal */}
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
                {rejectModal.leave.leaveType?.toUpperCase()}
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
                style={[styles.approveModalConfirm, { backgroundColor: C.danger }]}
                onPress={confirmReject}
              >
                <X size={14} color={C.white} />
                <Text style={styles.approveModalConfirmText}>Reject</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Edit Leave Modal (employee only) */}
      <Modal
        visible={showEditForm}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <SafeAreaView style={styles.safe} edges={['top']}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Edit Leave Request</Text>
            <TouchableOpacity
              onPress={() => {
                setShowEditForm(false);
                setEditLeave(null);
              }}
            >
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
                      editForm.leaveType === t && styles.selChipActive,
                    ]}
                    onPress={() => setEditForm(p => ({ ...p, leaveType: t }))}
                  >
                    <Text
                      style={[
                        styles.selChipText,
                        editForm.leaveType === t && { color: C.white },
                      ]}
                    >
                      {t.toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            {editForm.leaveType === 'hourly' ? (
              <View>
                <DatePickerField
                  label="Date *"
                  value={editForm.startDate}
                  onChange={v => setEditForm(p => ({ ...p, startDate: v }))}
                />
              </View>
            ) : (
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <DatePickerField
                    label="Start Date *"
                    value={editForm.startDate}
                    onChange={v => setEditForm(p => ({ ...p, startDate: v }))}
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
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <TimePickerField
                    label="Start Time *"
                    value={editForm.startHour}
                    onChange={v => setEditForm(p => ({ ...p, startHour: v }))}
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
              <Text style={styles.fieldLabel}>Reason *</Text>
              <TextInput
                style={[styles.fieldInput, { minHeight: 100 }]}
                value={editForm.reason}
                onChangeText={v => setEditForm(p => ({ ...p, reason: v }))}
                placeholder="Explain your reason…"
                placeholderTextColor={C.textLight}
                multiline
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
                <Text style={styles.submitBtnText}>Update Leave Request</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>

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
            {form.leaveType === 'hourly' ? (
              <View>
                <DatePickerField
                  label="Date *"
                  value={form.startDate}
                  onChange={v => setForm(p => ({ ...p, startDate: v }))}
                />
              </View>
            ) : (
              <View style={{ flexDirection: 'row', gap: 12 }}>
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
              <View style={{ flexDirection: 'row', gap: 12 }}>
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
  // Leave balance strip
  balanceStrip: {
    maxHeight: 52,
    backgroundColor: C.white,
    borderBottomWidth: 2,
    borderBottomColor: C.black,
    paddingVertical: 8,
  },
  balanceCard: {
    borderWidth: 2,
    borderColor: C.black,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignItems: 'center',
    minWidth: 72,
  },
  balanceType: {
    fontSize: 9,
    fontWeight: '700',
    color: C.black,
    textTransform: 'uppercase',
  },
  balanceDays: {
    fontSize: 11,
    fontWeight: '700',
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
  chipActive: {
    backgroundColor: C.primary,
    borderColor: C.primary,
  },
  chipText: { fontSize: 12, fontWeight: '700', color: C.black },
  chipTextActive: { color: C.white },
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
  typeTagText: { fontSize: 12, fontWeight: '700' },
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
  commentInput: {
    borderWidth: 2,
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
    borderColor: C.black,
    padding: 20,
    width: '100%',
    maxWidth: 380,
  },
  approveModalTitle: { fontSize: 18, fontWeight: '700', color: C.black },
  approveModalSub: {
    fontSize: 12,
    color: C.textMuted,
    marginTop: 4,
    marginBottom: 16,
  },
  approveModalLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    color: C.black,
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  toggleRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  toggleOpt: {
    flex: 1,
    borderWidth: 2,
    padding: 12,
    alignItems: 'center',
  },
  toggleOptActive: {},
  toggleOptText: { fontSize: 13, fontWeight: '700', color: C.black },
  toggleOptSub: { fontSize: 10, color: C.textMuted, marginTop: 2 },
  approveModalActions: { flexDirection: 'row', gap: 10 },
  approveModalCancel: {
    flex: 1,
    borderWidth: 2,
    borderColor: C.black,
    paddingVertical: 12,
    alignItems: 'center',
  },
  approveModalCancelText: { fontSize: 13, fontWeight: '700', color: C.black },
  approveModalConfirm: {
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    backgroundColor: C.success,
    borderWidth: 2,
    borderColor: C.black,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  approveModalConfirmText: {
    fontSize: 13,
    fontWeight: '700',
    color: C.white,
    textTransform: 'uppercase',
  },
});

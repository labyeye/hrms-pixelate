import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  FlatList,
  Alert,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import {
  LifeBuoy,
  Plus,
  X,
  ChevronDown,
  Clock,
  AlertCircle,
  CheckCircle2,
  XCircle,
  ChevronRight,
} from 'lucide-react-native';
import { useAuth } from '../contexts/AuthContext';
import { supportAPI } from '../api/api';
import { C, S } from '../theme';

const ISSUE_TYPES = [
  { value: 'attendance', label: 'Attendance' },
  { value: 'leave', label: 'Leave Management' },
  { value: 'payroll', label: 'Payroll & Salary' },
  { value: 'employee_management', label: 'Employee Management' },
  { value: 'performance', label: 'Performance Review' },
  { value: 'recruitment', label: 'Recruitment' },
  { value: 'biometric', label: 'Biometric & Devices' },
  { value: 'billing', label: 'Billing & Subscription' },
  { value: 'reports', label: 'Reports' },
  { value: 'departments', label: 'Departments' },
  { value: 'loans', label: 'Loans & Advances' },
  { value: 'exit_management', label: 'Exit Management' },
  { value: 'settings', label: 'Settings' },
  { value: 'general', label: 'General Inquiry' },
  { value: 'other', label: 'Other' },
];

const PRIORITIES = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'critical', label: 'Critical' },
];

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  open: { label: 'Open', color: '#6B7280', bg: '#F3F4F6' },
  in_progress: { label: 'In Progress', color: C.primary, bg: '#EFF6FF' },
  resolved: { label: 'Resolved', color: C.success, bg: '#DCFCE7' },
  closed: { label: 'Closed', color: C.danger, bg: '#FEF2F2' },
};

const PRIORITY_COLORS: Record<string, string> = {
  low: C.success,
  medium: C.warning,
  high: C.secondary,
  critical: C.danger,
};

interface Ticket {
  _id: string;
  ticketNumber: string;
  subject: string;
  issueType: string;
  priority: string;
  description: string;
  status: string;
  resolvedNote?: string;
  submittedBy?: { name: string; email: string };
  createdAt: string;
}

const issueLabel = (val: string) =>
  ISSUE_TYPES.find(t => t.value === val)?.label || val;

const priorityLabel = (val: string) =>
  PRIORITIES.find(p => p.value === val)?.label || val;

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

export default function SupportScreen({ navigation }: any) {
  const { user } = useAuth();
  const isAdmin = ['super_admin', 'hr_manager', 'hr_executive'].includes(
    user?.role || '',
  );

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Create form
  const [showForm, setShowForm] = useState(false);
  const [subject, setSubject] = useState('');
  const [issueType, setIssueType] = useState('');
  const [priority, setPriority] = useState('medium');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Dropdowns
  const [showIssueTypePicker, setShowIssueTypePicker] = useState(false);
  const [showPriorityPicker, setShowPriorityPicker] = useState(false);

  // Detail view
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      const res = await supportAPI.getAll();
      setTickets(res.data || []);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to load tickets');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const resetForm = () => {
    setSubject('');
    setIssueType('');
    setPriority('medium');
    setDescription('');
  };

  const handleSubmit = async () => {
    if (!subject.trim()) {
      Alert.alert('Validation', 'Subject is required');
      return;
    }
    if (!issueType) {
      Alert.alert('Validation', 'Please select an issue type');
      return;
    }
    if (!description.trim()) {
      Alert.alert('Validation', 'Description is required');
      return;
    }
    setSubmitting(true);
    try {
      await supportAPI.create({ subject: subject.trim(), issueType, priority, description: description.trim() });
      Alert.alert('Success', 'Your ticket has been submitted. We will get back to you shortly.');
      setShowForm(false);
      resetForm();
      load();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to submit ticket');
    } finally {
      setSubmitting(false);
    }
  };

  const statusCounts = {
    open: tickets.filter(t => t.status === 'open').length,
    in_progress: tickets.filter(t => t.status === 'in_progress').length,
    resolved: tickets.filter(t => t.status === 'resolved').length,
    closed: tickets.filter(t => t.status === 'closed').length,
  };

  const renderTicket = ({ item }: { item: Ticket }) => {
    const sm = STATUS_META[item.status] || STATUS_META.open;
    const pColor = PRIORITY_COLORS[item.priority] || C.black;
    return (
      <TouchableOpacity
        style={styles.ticketCard}
        onPress={() => setSelectedTicket(item)}
        activeOpacity={0.75}
      >
        <View style={styles.ticketTop}>
          <Text style={styles.ticketNumber}>{item.ticketNumber}</Text>
          <View style={[styles.statusBadge, { backgroundColor: sm.bg, borderColor: sm.color }]}>
            <Text style={[styles.statusText, { color: sm.color }]}>{sm.label}</Text>
          </View>
        </View>
        <Text style={styles.ticketSubject} numberOfLines={1}>{item.subject}</Text>
        <Text style={styles.ticketDesc} numberOfLines={2}>{item.description}</Text>
        <View style={styles.ticketMeta}>
          <View style={[styles.priorityDot, { backgroundColor: pColor }]} />
          <Text style={styles.ticketMetaText}>{priorityLabel(item.priority)}</Text>
          <Text style={styles.ticketMetaDot}>·</Text>
          <Text style={styles.ticketMetaText}>{issueLabel(item.issueType)}</Text>
          <Text style={styles.ticketMetaDot}>·</Text>
          <Text style={styles.ticketMetaText}>{formatDate(item.createdAt)}</Text>
        </View>
        {isAdmin && item.submittedBy && (
          <Text style={styles.ticketBy}>By {item.submittedBy.name || item.submittedBy.email}</Text>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={S.pageHeader}>
        <View style={S.rowCenter}>
          <LifeBuoy size={20} color={C.primary} />
          <Text style={[S.h2, { marginLeft: 8 }]}>Support</Text>
        </View>
        <TouchableOpacity
          style={styles.newBtn}
          onPress={() => setShowForm(true)}
        >
          <Plus size={16} color={C.white} />
          <Text style={styles.newBtnText}>New Ticket</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Summary row */}
        <View style={styles.summaryRow}>
          {Object.entries(statusCounts).map(([status, count]) => {
            const sm = STATUS_META[status];
            return (
              <View key={status} style={[styles.summaryCard, { borderColor: sm.color }]}>
                <Text style={[styles.summaryCount, { color: sm.color }]}>{count}</Text>
                <Text style={styles.summaryLabel}>{sm.label}</Text>
              </View>
            );
          })}
        </View>

        {loading ? (
          <View style={S.emptyState}>
            <Text style={S.emptyText}>Loading tickets...</Text>
          </View>
        ) : tickets.length === 0 ? (
          <View style={S.emptyState}>
            <LifeBuoy size={40} color="#D1D5DB" />
            <Text style={S.emptyText}>No support tickets yet</Text>
            <Text style={[S.small, { textAlign: 'center', marginTop: 4 }]}>
              Tap "New Ticket" to report an issue
            </Text>
          </View>
        ) : (
          <FlatList
            data={tickets}
            keyExtractor={t => t._id}
            renderItem={renderTicket}
            scrollEnabled={false}
          />
        )}
      </ScrollView>

      {/* Create Ticket Modal */}
      <Modal visible={showForm} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modalSafe} edges={['top', 'bottom']}>
          <View style={styles.modalHeader}>
            <Text style={S.h3}>New Support Ticket</Text>
            <TouchableOpacity onPress={() => { setShowForm(false); resetForm(); }}>
              <X size={22} color={C.black} />
            </TouchableOpacity>
          </View>
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <ScrollView
              contentContainerStyle={styles.formContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {/* Subject */}
              <Text style={styles.fieldLabel}>Subject *</Text>
              <TextInput
                style={S.input}
                placeholder="Brief summary of the issue"
                placeholderTextColor="#9CA3AF"
                value={subject}
                onChangeText={setSubject}
                maxLength={200}
              />

              {/* Issue Type */}
              <Text style={[styles.fieldLabel, { marginTop: 16 }]}>Issue Type *</Text>
              <TouchableOpacity
                style={styles.selectBtn}
                onPress={() => setShowIssueTypePicker(true)}
              >
                <Text style={[styles.selectText, !issueType && { color: '#9CA3AF' }]}>
                  {issueType ? issueLabel(issueType) : 'Select issue type'}
                </Text>
                <ChevronDown size={16} color={C.black} />
              </TouchableOpacity>

              {/* Priority */}
              <Text style={[styles.fieldLabel, { marginTop: 16 }]}>Priority</Text>
              <TouchableOpacity
                style={styles.selectBtn}
                onPress={() => setShowPriorityPicker(true)}
              >
                <Text style={styles.selectText}>{priorityLabel(priority)}</Text>
                <ChevronDown size={16} color={C.black} />
              </TouchableOpacity>

              {/* Description */}
              <Text style={[styles.fieldLabel, { marginTop: 16 }]}>Description *</Text>
              <TextInput
                style={[S.input, styles.textArea]}
                placeholder="Describe the issue in detail — steps to reproduce, error messages, affected records, etc."
                placeholderTextColor="#9CA3AF"
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={6}
                textAlignVertical="top"
                maxLength={2000}
              />
              <Text style={styles.charCount}>{description.length}/2000</Text>

              <TouchableOpacity
                style={[S.btnPrimary, { marginTop: 24 }]}
                onPress={handleSubmit}
                disabled={submitting}
              >
                <Text style={S.btnPrimaryText}>
                  {submitting ? 'Submitting...' : 'Submit Ticket'}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

      {/* Issue Type Picker Modal */}
      <Modal visible={showIssueTypePicker} animationType="slide" transparent>
        <View style={styles.pickerOverlay}>
          <View style={styles.pickerSheet}>
            <View style={styles.pickerHeader}>
              <Text style={S.h3}>Issue Type</Text>
              <TouchableOpacity onPress={() => setShowIssueTypePicker(false)}>
                <X size={20} color={C.black} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={ISSUE_TYPES}
              keyExtractor={i => i.value}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.pickerRow,
                    item.value === issueType && styles.pickerRowActive,
                  ]}
                  onPress={() => { setIssueType(item.value); setShowIssueTypePicker(false); }}
                >
                  <Text style={[
                    styles.pickerRowText,
                    item.value === issueType && { color: C.primary, fontWeight: '700' },
                  ]}>{item.label}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>

      {/* Priority Picker Modal */}
      <Modal visible={showPriorityPicker} animationType="slide" transparent>
        <View style={styles.pickerOverlay}>
          <View style={styles.pickerSheet}>
            <View style={styles.pickerHeader}>
              <Text style={S.h3}>Priority</Text>
              <TouchableOpacity onPress={() => setShowPriorityPicker(false)}>
                <X size={20} color={C.black} />
              </TouchableOpacity>
            </View>
            {PRIORITIES.map(item => (
              <TouchableOpacity
                key={item.value}
                style={[
                  styles.pickerRow,
                  item.value === priority && styles.pickerRowActive,
                ]}
                onPress={() => { setPriority(item.value); setShowPriorityPicker(false); }}
              >
                <View style={[styles.priorityDot, { backgroundColor: PRIORITY_COLORS[item.value] }]} />
                <Text style={[
                  styles.pickerRowText,
                  item.value === priority && { color: C.primary, fontWeight: '700' },
                ]}>{item.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>

      {/* Ticket Detail Modal */}
      <Modal visible={!!selectedTicket} animationType="slide" presentationStyle="pageSheet">
        {selectedTicket && (
          <SafeAreaView style={styles.modalSafe} edges={['top', 'bottom']}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.detailTicketNum}>{selectedTicket.ticketNumber}</Text>
                <View style={[
                  styles.statusBadge,
                  {
                    backgroundColor: STATUS_META[selectedTicket.status]?.bg,
                    borderColor: STATUS_META[selectedTicket.status]?.color,
                    alignSelf: 'flex-start',
                    marginTop: 4,
                  },
                ]}>
                  <Text style={[styles.statusText, { color: STATUS_META[selectedTicket.status]?.color }]}>
                    {STATUS_META[selectedTicket.status]?.label}
                  </Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => setSelectedTicket(null)}>
                <X size={22} color={C.black} />
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={styles.detailContent} showsVerticalScrollIndicator={false}>
              <Text style={S.h3}>{selectedTicket.subject}</Text>

              <View style={styles.detailGrid}>
                <View style={styles.detailCell}>
                  <Text style={styles.detailCellLabel}>Issue Type</Text>
                  <Text style={styles.detailCellValue}>{issueLabel(selectedTicket.issueType)}</Text>
                </View>
                <View style={styles.detailCell}>
                  <Text style={styles.detailCellLabel}>Priority</Text>
                  <Text style={[styles.detailCellValue, { color: PRIORITY_COLORS[selectedTicket.priority] }]}>
                    {priorityLabel(selectedTicket.priority)}
                  </Text>
                </View>
                <View style={styles.detailCell}>
                  <Text style={styles.detailCellLabel}>Submitted</Text>
                  <Text style={styles.detailCellValue}>{formatDate(selectedTicket.createdAt)}</Text>
                </View>
                {isAdmin && selectedTicket.submittedBy && (
                  <View style={styles.detailCell}>
                    <Text style={styles.detailCellLabel}>Submitted By</Text>
                    <Text style={styles.detailCellValue}>
                      {selectedTicket.submittedBy.name || selectedTicket.submittedBy.email}
                    </Text>
                  </View>
                )}
              </View>

              <View style={S.divider} />
              <Text style={styles.detailCellLabel}>Description</Text>
              <Text style={[S.body, { marginTop: 6, lineHeight: 22 }]}>{selectedTicket.description}</Text>

              {selectedTicket.resolvedNote ? (
                <View style={styles.resolvedNote}>
                  <CheckCircle2 size={16} color={C.success} />
                  <View style={{ flex: 1, marginLeft: 8 }}>
                    <Text style={styles.resolvedNoteTitle}>Resolution Note</Text>
                    <Text style={styles.resolvedNoteText}>{selectedTicket.resolvedNote}</Text>
                  </View>
                </View>
              ) : null}
            </ScrollView>
          </SafeAreaView>
        )}
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  newBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.primary,
    borderWidth: 2,
    borderColor: C.black,
    paddingHorizontal: 12,
    paddingVertical: 7,
    gap: 5,
  },
  newBtnText: { color: C.white, fontWeight: '700', fontSize: 12, textTransform: 'uppercase' },

  // Summary
  summaryRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  summaryCard: {
    flex: 1,
    backgroundColor: C.white,
    borderWidth: 2,
    alignItems: 'center',
    paddingVertical: 10,
  },
  summaryCount: { fontSize: 20, fontWeight: '700' },
  summaryLabel: { fontSize: 9, fontWeight: '700', textTransform: 'uppercase', color: '#6B7280', marginTop: 2 },

  // Ticket card
  ticketCard: {
    backgroundColor: C.white,
    borderWidth: 2,
    borderColor: C.black,
    padding: 14,
    marginBottom: 10,
  },
  ticketTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  ticketNumber: { fontFamily: 'monospace', fontSize: 11, color: '#6B7280', fontWeight: '700' },
  statusBadge: { borderWidth: 2, paddingHorizontal: 8, paddingVertical: 2 },
  statusText: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  ticketSubject: { fontSize: 14, fontWeight: '700', color: C.black, marginBottom: 4 },
  ticketDesc: { fontSize: 12, color: '#6B7280', fontWeight: '500', lineHeight: 18, marginBottom: 8 },
  ticketMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap' },
  priorityDot: { width: 8, height: 8, borderRadius: 4 },
  ticketMetaText: { fontSize: 11, color: '#6B7280', fontWeight: '500' },
  ticketMetaDot: { fontSize: 11, color: '#D1D5DB' },
  ticketBy: { fontSize: 11, color: C.primary, fontWeight: '600', marginTop: 6 },

  // Form modal
  modalSafe: { flex: 1, backgroundColor: C.white },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 2,
    borderBottomColor: C.black,
  },
  formContent: { padding: 16, paddingBottom: 40 },
  fieldLabel: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, color: C.black, marginBottom: 6 },
  selectBtn: {
    borderWidth: 2,
    borderColor: C.black,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: C.white,
  },
  selectText: { fontSize: 14, fontWeight: '500', color: C.black },
  textArea: { height: 130, paddingTop: 10 },
  charCount: { fontSize: 11, color: '#9CA3AF', fontWeight: '500', textAlign: 'right', marginTop: 4 },

  // Picker bottom sheet
  pickerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  pickerSheet: { backgroundColor: C.white, borderTopWidth: 2, borderTopColor: C.black, maxHeight: '60%' },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 2,
    borderBottomColor: C.black,
  },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  pickerRowActive: { backgroundColor: '#EFF6FF' },
  pickerRowText: { fontSize: 14, fontWeight: '500', color: C.black },

  // Detail modal
  detailContent: { padding: 16, paddingBottom: 40 },
  detailTicketNum: { fontFamily: 'monospace', fontSize: 13, fontWeight: '700', color: '#6B7280' },
  detailGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 16, marginBottom: 16 },
  detailCell: { width: '46%' },
  detailCellLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', color: '#9CA3AF', letterSpacing: 0.5, marginBottom: 3 },
  detailCellValue: { fontSize: 14, fontWeight: '600', color: C.black },
  resolvedNote: {
    flexDirection: 'row',
    backgroundColor: '#F0FDF4',
    borderWidth: 2,
    borderColor: C.success,
    padding: 12,
    marginTop: 16,
  },
  resolvedNoteTitle: { fontSize: 12, fontWeight: '700', color: C.success, textTransform: 'uppercase', letterSpacing: 0.5 },
  resolvedNoteText: { fontSize: 13, color: '#166534', fontWeight: '500', marginTop: 4, lineHeight: 20 },
});

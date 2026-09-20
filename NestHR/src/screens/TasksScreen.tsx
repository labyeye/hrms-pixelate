import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import {
  AlertTriangle,
  Calendar,
  ChevronLeft,
  MessageSquare,
  Pencil,
  Plus,
  Send,
  Trash2,
  X,
} from 'lucide-react-native';
import { employeeAPI, taskAPI } from '../api/api';
import { useAuth } from '../contexts/AuthContext';
import { DatePickerField } from '../components/common/DatePickerField';
import ScreenLayout, { HeaderBtn } from '../components/common/ScreenLayout';
import { C, FONT } from '../theme';

// Same rule as the web page and the backend: only these roles assign/edit/delete.
const ASSIGN_ROLES = ['super_admin', 'hr_manager', 'department_head'];

const STATUSES = [
  { key: 'pending', label: 'Pending', color: C.secondary },
  { key: 'in_progress', label: 'In Progress', color: C.primary },
  { key: 'completed', label: 'Completed', color: C.success },
] as const;
const STATUS_LABEL: Record<string, string> = Object.fromEntries(
  STATUSES.map(s => [s.key, s.label]),
);
const STATUS_COLOR: Record<string, string> = Object.fromEntries(
  STATUSES.map(s => [s.key, s.color]),
);
const PRIORITY_COLOR: Record<string, string> = {
  low: C.success,
  medium: C.secondary,
  high: C.danger,
};
const PRIORITIES = ['low', 'medium', 'high'] as const;

const EMPTY_FORM = {
  title: '',
  description: '',
  assignedTo: '',
  priority: 'medium',
  dueDate: '',
};

const fmt = (d?: string) =>
  d
    ? new Date(d).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : '—';

const isLate = (t: any) =>
  t.late ||
  (t.status !== 'completed' && !!t.dueDate && new Date(t.dueDate).getTime() < Date.now());

export default function TasksScreen() {
  const navigation = useNavigation<any>();
  const { user } = useAuth();
  const canAssign = ASSIGN_ROLES.includes(user?.role || '');

  const [tasks, setTasks] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');

  const [selected, setSelected] = useState<any>(null);
  const [comment, setComment] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const r: any = await taskAPI.getAll();
      setTasks(r.data || []);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to load tasks');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    if (canAssign) {
      employeeAPI
        .getAll({ limit: '500' })
        .then((r: any) => setEmployees(r.data || []))
        .catch(() => {});
    }
  }, [load, canAssign]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tasks.filter(
      t =>
        (statusFilter === 'all' || t.status === statusFilter) &&
        (priorityFilter === 'all' || t.priority === priorityFilter) &&
        (!q || t.title.toLowerCase().includes(q)),
    );
  }, [tasks, search, statusFilter, priorityFilter]);

  const count = (s: string) => tasks.filter(t => t.status === s).length;
  const lateCount = tasks.filter(isLate).length;

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormOpen(true);
  };

  const openEdit = (t: any) => {
    setEditing(t);
    setForm({
      title: t.title,
      description: t.description || '',
      assignedTo: t.assignedTo?._id || '',
      priority: t.priority,
      dueDate: t.dueDate ? t.dueDate.slice(0, 10) : '',
    });
    setSelected(null);
    setFormOpen(true);
  };

  const save = async () => {
    if (!form.title.trim() || !form.assignedTo) {
      Alert.alert('Missing fields', 'Title and assignee are required');
      return;
    }
    setSaving(true);
    try {
      if (editing) await taskAPI.update(editing._id, form);
      else await taskAPI.create(form);
      setFormOpen(false);
      await load();
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to save task');
    } finally {
      setSaving(false);
    }
  };

  const setStatus = async (t: any, status: string) => {
    // Optimistic, like the web board; reload on failure.
    setTasks(prev => prev.map(x => (x._id === t._id ? { ...x, status } : x)));
    setSelected((s: any) => (s?._id === t._id ? { ...s, status } : s));
    try {
      await taskAPI.updateStatus(t._id, status);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to update status');
      load();
    }
  };

  const remove = (t: any) =>
    Alert.alert('Delete task', 'This moves it to Trash. You can restore it later.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await taskAPI.delete(t._id);
            setSelected(null);
            await load();
          } catch (e: any) {
            Alert.alert('Error', e?.message || 'Failed to delete task');
          }
        },
      },
    ]);

  const sendComment = async () => {
    if (!comment.trim() || !selected) return;
    try {
      const r: any = await taskAPI.addComment(selected._id, comment.trim());
      setSelected({ ...selected, comments: r.data.comments });
      setComment('');
      load();
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to add comment');
    }
  };

  return (
    <ScreenLayout
      title="Tasks"
      loading={loading}
      right={
        canAssign ? (
          <HeaderBtn label="Assign" icon={<Plus size={14} color="#fff" />} onPress={openCreate} />
        ) : undefined
      }
    >
      <View style={s.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10} style={s.back}>
          <ChevronLeft size={18} color={C.black} />
          <Text style={s.backText}>Back</Text>
        </TouchableOpacity>
      </View>

      <View style={s.kpis}>
        {STATUSES.map(st => (
          <View key={st.key} style={[s.kpi, { borderColor: st.color }]}>
            <Text style={[s.kpiValue, { color: st.color }]}>{count(st.key)}</Text>
            <Text style={s.kpiLabel}>{st.label}</Text>
          </View>
        ))}
        <View style={[s.kpi, { borderColor: C.danger }]}>
          <Text style={[s.kpiValue, { color: C.danger }]}>{lateCount}</Text>
          <Text style={s.kpiLabel}>Late</Text>
        </View>
      </View>

      <View style={s.filters}>
        <TextInput
          style={s.search}
          value={search}
          onChangeText={setSearch}
          placeholder="Search tasks..."
          placeholderTextColor="#6B7280"
        />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {[{ key: 'all', label: 'All' }, ...STATUSES].map(x => (
            <Pill key={x.key} label={x.label} on={statusFilter === x.key} onPress={() => setStatusFilter(x.key)} />
          ))}
          <View style={s.pillGap} />
          {['all', ...PRIORITIES].map(p => (
            <Pill
              key={p}
              label={p === 'all' ? 'Any priority' : p}
              on={priorityFilter === p}
              onPress={() => setPriorityFilter(p)}
            />
          ))}
        </ScrollView>
      </View>

      <FlatList
        data={shown}
        keyExtractor={t => t._id}
        contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 10 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={<Text style={s.empty}>No tasks found</Text>}
        renderItem={({ item: t }) => (
          <TouchableOpacity style={s.card} activeOpacity={0.85} onPress={() => setSelected(t)}>
            <View style={s.cardTop}>
              <Text style={s.cardTitle} numberOfLines={2}>
                {t.title}
              </Text>
              <Badge label={t.priority} color={PRIORITY_COLOR[t.priority] || C.primary} />
            </View>
            <View style={s.metaRow}>
              <Text style={s.meta}>{t.assignedTo?.name || '—'}</Text>
              <Badge label={STATUS_LABEL[t.status] || t.status} color={STATUS_COLOR[t.status] || C.primary} />
            </View>
            <View style={s.metaRow}>
              <View style={s.inline}>
                <Calendar size={12} color={C.black} />
                <Text style={s.meta}>{fmt(t.dueDate)}</Text>
              </View>
              {isLate(t) && (
                <View style={s.inline}>
                  <AlertTriangle size={12} color={C.danger} />
                  <Text style={[s.meta, { color: C.danger, fontFamily: FONT.bold }]}>LATE</Text>
                </View>
              )}
              {t.comments?.length ? (
                <View style={s.inline}>
                  <MessageSquare size={12} color={C.black} />
                  <Text style={s.meta}>{t.comments.length}</Text>
                </View>
              ) : null}
            </View>
          </TouchableOpacity>
        )}
      />

      {/* Detail */}
      <Modal visible={!!selected} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setSelected(null)}>
        <SafeAreaView edges={['top']} style={s.sheet}>
          <View style={s.sheetHeader}>
            <Text style={s.sheetTitle} numberOfLines={1}>
              Task
            </Text>
            <View style={s.headerActions}>
              {canAssign && selected && (
                <>
                  <TouchableOpacity onPress={() => openEdit(selected)} hitSlop={8}>
                    <Pencil size={18} color={C.primary} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => remove(selected)} hitSlop={8}>
                    <Trash2 size={18} color={C.danger} />
                  </TouchableOpacity>
                </>
              )}
              <TouchableOpacity onPress={() => setSelected(null)} hitSlop={8}>
                <X size={22} color={C.black} />
              </TouchableOpacity>
            </View>
          </View>
          {selected && (
            <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
              <Text style={s.detailTitle}>{selected.title}</Text>
              <View style={[s.metaRow, { marginVertical: 8 }]}>
                <Badge label={selected.priority} color={PRIORITY_COLOR[selected.priority] || C.primary} />
                <Badge label={STATUS_LABEL[selected.status] || selected.status} color={STATUS_COLOR[selected.status] || C.primary} />
                {isLate(selected) && <Badge label="Late" color={C.danger} />}
              </View>
              {selected.description ? <Text style={s.body}>{selected.description}</Text> : null}
              <Text style={s.meta}>Assigned to: {selected.assignedTo?.name || '—'}</Text>
              <Text style={s.meta}>Assigned by: {selected.assignedBy?.name || '—'}</Text>
              <Text style={s.meta}>Due: {fmt(selected.dueDate)}</Text>

              <Text style={s.section}>Update status</Text>
              <View style={s.statusRow}>
                {STATUSES.map(st => (
                  <TouchableOpacity
                    key={st.key}
                    style={[s.statusBtn, { borderColor: st.color }, selected.status === st.key && { backgroundColor: st.color }]}
                    onPress={() => setStatus(selected, st.key)}
                  >
                    <Text style={[s.statusBtnText, selected.status === st.key && { color: '#fff' }]}>{st.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={s.section}>Comments</Text>
              {(selected.comments || []).length === 0 ? (
                <Text style={s.meta}>No comments yet</Text>
              ) : (
                selected.comments.map((c: any, i: number) => (
                  <View key={i} style={s.comment}>
                    <Text style={s.commentUser}>
                      {c.user?.name || 'User'} · {fmt(c.createdAt)}
                    </Text>
                    <Text style={s.body}>{c.message}</Text>
                  </View>
                ))
              )}
              <View style={s.commentBox}>
                <TextInput
                  style={s.commentInput}
                  value={comment}
                  onChangeText={setComment}
                  placeholder="Add a comment..."
                  placeholderTextColor="#6B7280"
                  multiline
                />
                <TouchableOpacity style={s.sendBtn} onPress={sendComment} hitSlop={6}>
                  <Send size={18} color="#fff" />
                </TouchableOpacity>
              </View>

              {(selected.statusHistory || []).length > 0 && (
                <>
                  <Text style={s.section}>History</Text>
                  {selected.statusHistory.map((h: any, i: number) => (
                    <Text key={i} style={s.meta}>
                      {STATUS_LABEL[h.status] || h.status} · {h.changedBy?.name || '—'} · {fmt(h.changedAt)}
                    </Text>
                  ))}
                </>
              )}
            </ScrollView>
          )}
        </SafeAreaView>
      </Modal>

      {/* Create / edit */}
      <Modal visible={formOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setFormOpen(false)}>
        <SafeAreaView edges={['top']} style={s.sheet}>
          <View style={s.sheetHeader}>
            <Text style={s.sheetTitle}>{editing ? 'Edit Task' : 'Assign Task'}</Text>
            <TouchableOpacity onPress={() => setFormOpen(false)} hitSlop={8}>
              <X size={22} color={C.black} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
            <Text style={s.label}>Title *</Text>
            <TextInput style={s.input} value={form.title} onChangeText={v => setForm(f => ({ ...f, title: v }))} maxLength={200} />
            <Text style={s.label}>Description</Text>
            <TextInput
              style={[s.input, { height: 90, textAlignVertical: 'top' }]}
              value={form.description}
              onChangeText={v => setForm(f => ({ ...f, description: v }))}
              multiline
              maxLength={2000}
            />
            <Text style={s.label}>Assign to *</Text>
            <ScrollView style={s.pickList} nestedScrollEnabled>
              {employees
                .filter(e => e.user)
                .map(e => {
                  const on = form.assignedTo === e.user;
                  return (
                    <TouchableOpacity
                      key={e._id}
                      style={[s.pickRow, on && s.pickRowOn]}
                      onPress={() => setForm(f => ({ ...f, assignedTo: e.user }))}
                    >
                      <Text style={[s.pickText, on && { color: '#fff' }]}>
                        {e.firstName} {e.lastName}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
            </ScrollView>
            <Text style={s.label}>Priority</Text>
            <View style={s.statusRow}>
              {PRIORITIES.map(p => (
                <TouchableOpacity
                  key={p}
                  style={[s.statusBtn, { borderColor: PRIORITY_COLOR[p] }, form.priority === p && { backgroundColor: PRIORITY_COLOR[p] }]}
                  onPress={() => setForm(f => ({ ...f, priority: p }))}
                >
                  <Text style={[s.statusBtnText, form.priority === p && { color: '#fff' }]}>{p}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <DatePickerField label="Due date" value={form.dueDate} onChange={v => setForm(f => ({ ...f, dueDate: v }))} />
            <TouchableOpacity style={[s.saveBtn, saving && { opacity: 0.6 }]} onPress={save} disabled={saving}>
              <Text style={s.saveText}>{saving ? 'Saving...' : editing ? 'Save Changes' : 'Assign Task'}</Text>
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </ScreenLayout>
  );
}

function Pill({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} style={[s.pill, on && s.pillOn]}>
      <Text style={[s.pillText, on && { color: '#fff' }]}>{label}</Text>
    </TouchableOpacity>
  );
}

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <View style={[s.badge, { borderColor: color }]}>
      <Text style={[s.badgeText, { color }]}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  topBar: { paddingHorizontal: 16, paddingTop: 10 },
  back: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start' },
  backText: { fontFamily: FONT.bold, fontSize: 12, color: C.black, textTransform: 'uppercase' },
  kpis: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingTop: 10 },
  kpi: { flex: 1, borderWidth: 2, paddingVertical: 8, alignItems: 'center' },
  kpiValue: { fontFamily: FONT.bold, fontSize: 20 },
  kpiLabel: { fontFamily: FONT.bold, fontSize: 9, color: C.black, textTransform: 'uppercase' },
  filters: { paddingHorizontal: 16, paddingTop: 10, gap: 8 },
  search: {
    fontFamily: FONT.medium,
    borderWidth: 2,
    borderColor: C.black,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: C.black,
  },
  pill: { borderWidth: 2, borderColor: C.black, paddingHorizontal: 12, paddingVertical: 6 },
  pillOn: { backgroundColor: C.primary, borderColor: C.primary },
  pillText: { fontFamily: FONT.bold, fontSize: 11, color: C.black, textTransform: 'uppercase' },
  pillGap: { width: 6 },
  card: { borderWidth: 2, borderColor: C.black, padding: 12, backgroundColor: '#fff' },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  cardTitle: { flex: 1, fontFamily: FONT.bold, fontSize: 15, color: C.black },
  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8, gap: 8, flexWrap: 'wrap' },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  meta: { fontFamily: FONT.medium, fontSize: 12, color: C.black },
  empty: { textAlign: 'center', fontFamily: FONT.bold, color: '#6B7280', marginTop: 40 },
  badge: { borderWidth: 2, paddingHorizontal: 8, paddingVertical: 1 },
  badgeText: { fontFamily: FONT.bold, fontSize: 10, textTransform: 'uppercase' },
  sheet: { flex: 1, backgroundColor: '#fff' },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 2,
    borderBottomColor: C.black,
  },
  sheetTitle: { fontFamily: FONT.bold, fontSize: 17, color: C.black },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  detailTitle: { fontFamily: FONT.bold, fontSize: 18, color: C.black },
  body: { fontFamily: FONT.medium, fontSize: 14, color: C.black, marginBottom: 8 },
  section: { fontFamily: FONT.bold, fontSize: 12, color: C.black, textTransform: 'uppercase', marginTop: 18, marginBottom: 8 },
  statusRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  statusBtn: { flex: 1, borderWidth: 2, paddingVertical: 8, alignItems: 'center' },
  statusBtnText: { fontFamily: FONT.bold, fontSize: 11, color: C.black, textTransform: 'uppercase' },
  comment: { borderLeftWidth: 3, borderLeftColor: C.primary, paddingLeft: 10, marginBottom: 10 },
  commentUser: { fontFamily: FONT.bold, fontSize: 11, color: C.black },
  commentBox: { flexDirection: 'row', gap: 8, alignItems: 'flex-end', marginTop: 8 },
  commentInput: {
    flex: 1,
    fontFamily: FONT.medium,
    borderWidth: 2,
    borderColor: C.black,
    paddingHorizontal: 10,
    paddingVertical: 8,
    maxHeight: 100,
    color: C.black,
  },
  sendBtn: { backgroundColor: C.primary, borderWidth: 2, borderColor: C.black, padding: 10 },
  label: { fontFamily: FONT.bold, fontSize: 12, color: C.black, textTransform: 'uppercase', marginTop: 12, marginBottom: 6 },
  input: { fontFamily: FONT.medium, borderWidth: 2, borderColor: C.black, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: C.black },
  pickList: { borderWidth: 2, borderColor: C.black, maxHeight: 180, marginBottom: 4 },
  pickRow: { paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  pickRowOn: { backgroundColor: C.primary },
  pickText: { fontFamily: FONT.medium, fontSize: 14, color: C.black },
  saveBtn: { backgroundColor: C.primary, borderWidth: 2, borderColor: C.black, paddingVertical: 12, alignItems: 'center', marginTop: 16 },
  saveText: { fontFamily: FONT.bold, color: '#fff', fontSize: 13, textTransform: 'uppercase' },
});

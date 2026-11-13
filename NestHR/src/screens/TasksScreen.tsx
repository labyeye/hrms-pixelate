import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
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
  CheckCircle2,
  CheckSquare,
  ChevronLeft,
  Clock,
  Download,
  Ellipsis,
  FileText,
  MessageSquare,
  Pencil,
  Plus,
  Search,
  Send,
  SlidersHorizontal,
  Trash2,
  Upload,
  User,
  X,
} from 'lucide-react-native';
import { employeeAPI, taskAPI } from '../api/api';
import { useAuth } from '../contexts/AuthContext';
import { DatePickerField } from '../components/common/DatePickerField';
import HeaderIconBtn from '../components/common/HeaderIconBtn';
import SearchModal from '../components/common/SearchModal';
import FilterSortModal from '../components/common/FilterSortModal';
import DashStatCard, { dashStatRow } from '../components/common/DashStatCard';
import SlideInCard from '../components/motion/SlideInCard';
import { chooseExport } from '../utils/exporters';
import { pickSheet, shareTemplate } from '../utils/importSheet';
import { C, FONT, useResponsive } from '../theme';
import { CENTER } from '../components/common/centerModal';

// Same rule as the web page and the backend: only these roles assign/edit/delete.
const ASSIGN_ROLES = ['super_admin', 'hr_manager', 'department_head'];

const STATUSES = [
  { key: 'pending', label: 'Pending', color: C.secondary, icon: Clock },
  { key: 'in_progress', label: 'In Progress', color: C.primary, icon: Clock },
  {
    key: 'completed',
    label: 'Completed',
    color: C.success,
    icon: CheckCircle2,
  },
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

const IMPORT_HEADERS = [
  'Title',
  'Description',
  'Assignee Emp ID',
  'Priority (low/medium/high)',
  'Due Date (YYYY-MM-DD)',
];

const IMPORT_EXAMPLE = [
  'Prepare monthly report',
  'Compile HR metrics',
  'EMP0001',
  'medium',
  new Date().toISOString().slice(0, 10),
];

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
  (t.status !== 'completed' &&
    !!t.dueDate &&
    new Date(t.dueDate).getTime() < Date.now());

export default function TasksScreen() {
  const navigation = useNavigation<any>();
  const { user } = useAuth();
  const { isTablet, maxContentWidth } = useResponsive();
  const canAssign = ASSIGN_ROLES.includes(user?.role || '');

  const [tasks, setTasks] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [importing, setImporting] = useState(false);
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

  const count = (st: string) => tasks.filter(t => t.status === st).length;
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
    Alert.alert(
      'Delete task',
      'This moves it to Trash. You can restore it later.',
      [
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
      ],
    );

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
        const title = String(r.Title || '').trim();
        const code = String(r['Assignee Emp ID'] || '')
          .trim()
          .toLowerCase();
        const emp = employees.find(
          (e: any) => e.employeeId?.toLowerCase() === code,
        );
        if (!title || !emp) {
          bad.push(title || '(no title)');
          continue;
        }
        const pr = String(
          r['Priority (low/medium/high)'] || 'medium',
        ).toLowerCase();
        try {
          await taskAPI.create({
            title,
            description: String(r.Description || ''),
            assignedTo: emp.user,
            priority: ['low', 'medium', 'high'].includes(pr) ? pr : 'medium',
            dueDate: String(r['Due Date (YYYY-MM-DD)'] || '').slice(0, 10),
          } as any);
          ok++;
        } catch {
          bad.push(title);
        }
      }
      load();
      Alert.alert(
        'Import',
        `${ok} of ${rows.length} tasks imported${
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
    { header: 'Title', value: (t: any) => t.title },
    { header: 'Description', value: (t: any) => t.description },
    { header: 'Assigned To', value: (t: any) => t.assignedTo?.name },
    { header: 'Assigned By', value: (t: any) => t.assignedBy?.name },
    { header: 'Priority', value: (t: any) => t.priority },
    {
      header: 'Status',
      value: (t: any) => String(t.status || '').replace('_', ' '),
    },
    {
      header: 'Due Date',
      value: (t: any) => (t.dueDate ? String(t.dueDate).slice(0, 10) : ''),
    },
  ];

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      {/* Concise Header matching EmployeesScreen */}
      <View
        style={[
          s.header,
          isTablet && {
            maxWidth: maxContentWidth,
            width: '100%',
            alignSelf: 'center',
          },
        ]}
      >
        <View style={s.headerLeft}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={{ padding: 4, marginRight: 2 }}
            hitSlop={8}
          >
            <ChevronLeft size={22} color={C.black} />
          </TouchableOpacity>
          <CheckSquare size={20} color={C.primary} />
          <Text style={s.headerTitle}>Tasks</Text>
        </View>

        <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
          <HeaderIconBtn
            label="Search"
            icon={<Search size={22} color={C.black} />}
            dot={!!search}
            onPress={() => setSearchOpen(true)}
          />
          <HeaderIconBtn
            label="Filter"
            icon={<SlidersHorizontal size={22} color={C.black} />}
            dot={statusFilter !== 'all' || priorityFilter !== 'all'}
            onPress={() => setFilterOpen(true)}
          />
          <HeaderIconBtn
            label="More actions"
            icon={<Ellipsis size={22} color={C.black} />}
            onPress={() => setMenuOpen(true)}
          />
          {canAssign && (
            <TouchableOpacity
              style={s.addBtn}
              onPress={openCreate}
              accessibilityLabel="Assign Task"
              hitSlop={8}
            >
              <Plus size={24} color={C.primary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Overflow Menu Modal */}
      <Modal
        visible={menuOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuOpen(false)}
      >
        <TouchableOpacity
          style={s.menuOverlay}
          activeOpacity={1}
          onPress={() => setMenuOpen(false)}
        >
          <View style={s.menuSheet}>
            {[
              ...(canAssign
                ? [
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
                        shareTemplate('tasks', IMPORT_HEADERS, IMPORT_EXAMPLE);
                      },
                    },
                  ]
                : []),
              {
                icon: Download,
                label: 'Export tasks',
                onPress: () => {
                  setMenuOpen(false);
                  chooseExport('tasks', exportCols, shown);
                },
              },
            ].map(item => (
              <TouchableOpacity
                key={item.label}
                style={s.menuItem}
                onPress={item.onPress}
                disabled={importing}
              >
                <item.icon size={18} color={C.black} />
                <Text style={s.menuText}>{item.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      <SearchModal
        visible={searchOpen}
        onClose={() => setSearchOpen(false)}
        value={search}
        onChange={setSearch}
        placeholder="Search tasks…"
        items={tasks.map((t: any) => ({
          key: t._id,
          title: t.title,
          subtitle: t.assignedTo?.name,
        }))}
      />
      <FilterSortModal
        visible={filterOpen}
        onClose={() => setFilterOpen(false)}
        filterTitle="Status"
        filterOptions={[{ key: 'all', label: 'All' }, ...STATUSES]}
        filterValue={statusFilter}
        onFilter={setStatusFilter}
        filter2Title="Priority"
        filter2Options={['all', ...PRIORITIES].map(p => ({
          key: p,
          label: p === 'all' ? 'Any priority' : p,
        }))}
        filter2Value={priorityFilter}
        onFilter2={setPriorityFilter}
        onReset={() => {
          setStatusFilter('all');
          setPriorityFilter('all');
        }}
      />

      {loading ? (
        <View style={s.loader}>
          <ActivityIndicator size="large" color={C.primary} />
        </View>
      ) : (
        <FlatList
          key={isTablet ? 'tablet-grid-2' : 'mobile-list'}
          data={shown}
          keyExtractor={t => t._id}
          numColumns={isTablet ? 2 : 1}
          columnWrapperStyle={isTablet ? s.colWrapper : undefined}
          contentContainerStyle={[
            { padding: 16, paddingBottom: 40, gap: 10 },
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
                label="Pending"
                value={count('pending')}
                icon={Clock}
                color={C.secondary}
              />
              <DashStatCard
                index={1}
                label="Active"
                value={count('in_progress')}
                icon={CheckSquare}
                color={C.primary}
              />
              <DashStatCard
                index={2}
                label="Done"
                value={count('completed')}
                icon={CheckCircle2}
                color={C.success}
              />
              <DashStatCard
                index={3}
                label="Late"
                value={lateCount}
                icon={AlertTriangle}
                color={C.danger}
              />
            </View>
          }
          ListEmptyComponent={<Text style={s.empty}>No tasks found</Text>}
          renderItem={({ item: t, index }) => {
            const pColor = PRIORITY_COLOR[t.priority] || C.primary;
            const sColor = STATUS_COLOR[t.status] || C.primary;
            const late = isLate(t);
            return (
              <SlideInCard
                index={index}
                style={isTablet ? s.cardTablet : undefined}
              >
                <TouchableOpacity
                  style={[
                    s.card,
                    { borderLeftColor: sColor, borderLeftWidth: 4 },
                  ]}
                  activeOpacity={0.85}
                  onPress={() => setSelected(t)}
                >
                  {/* Row 1: Title + Priority Badge */}
                  <View style={s.cardTop}>
                    <Text style={s.cardTitle} numberOfLines={1}>
                      {t.title}
                    </Text>
                    <View
                      style={[
                        s.priorityBadge,
                        {
                          borderColor: pColor,
                          backgroundColor: pColor + '15',
                        },
                      ]}
                    >
                      <Text style={[s.priorityText, { color: pColor }]}>
                        {t.priority}
                      </Text>
                    </View>
                  </View>

                  {/* Row 2: Assignee + Due Date + Comments + Status Pill */}
                  <View style={s.metaRow}>
                    <View style={s.metaLeft}>
                      <View style={s.metaItem}>
                        <User size={12} color={C.primary} />
                        <Text style={s.metaText} numberOfLines={1}>
                          {t.assignedTo?.name || 'Unassigned'}
                        </Text>
                      </View>
                      <View style={s.metaItem}>
                        <Calendar
                          size={12}
                          color={late ? C.danger : C.textMuted}
                        />
                        <Text style={[s.metaText, late && { color: C.danger }]}>
                          {fmt(t.dueDate)}
                        </Text>
                      </View>
                      {late && (
                        <View style={s.lateChip}>
                          <Text style={s.lateChipText}>LATE</Text>
                        </View>
                      )}
                      {t.comments?.length > 0 && (
                        <View style={s.metaItem}>
                          <MessageSquare size={12} color={C.textMuted} />
                          <Text style={s.metaText}>{t.comments.length}</Text>
                        </View>
                      )}
                    </View>

                    <View
                      style={[
                        s.statusBadge,
                        { backgroundColor: sColor, borderColor: C.black },
                      ]}
                    >
                      <Text style={[s.statusBadgeText, { color: C.white }]}>
                        {STATUS_LABEL[t.status] || t.status}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              </SlideInCard>
            );
          }}
        />
      )}

      {/* Detail Modal */}
      <Modal
        visible={!!selected}
        transparent
        animationType="fade"
        onRequestClose={() => setSelected(null)}
      >
        <View style={CENTER.overlay}>
          <View style={CENTER.card}>
            <SafeAreaView edges={[]} style={s.sheet}>
              <View style={s.sheetHeader}>
                <Text style={s.sheetTitle} numberOfLines={1}>
                  Task
                </Text>
                <View style={s.headerActions}>
                  {canAssign && selected && (
                    <>
                      <TouchableOpacity
                        onPress={() => openEdit(selected)}
                        hitSlop={8}
                      >
                        <Pencil size={20} color={C.primary} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => remove(selected)}
                        hitSlop={8}
                      >
                        <Trash2 size={20} color={C.danger} />
                      </TouchableOpacity>
                    </>
                  )}
                  <TouchableOpacity
                    onPress={() => setSelected(null)}
                    hitSlop={8}
                  >
                    <X size={24} color={C.black} />
                  </TouchableOpacity>
                </View>
              </View>
              {selected && (
                <ScrollView
                  contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
                  keyboardShouldPersistTaps="handled"
                >
                  <Text style={s.detailTitle}>{selected.title}</Text>
                  <View
                    style={{
                      flexDirection: 'row',
                      gap: 8,
                      flexWrap: 'wrap',
                      marginVertical: 8,
                    }}
                  >
                    <Badge
                      label={selected.priority}
                      color={PRIORITY_COLOR[selected.priority] || C.primary}
                    />
                    <Badge
                      label={STATUS_LABEL[selected.status] || selected.status}
                      color={STATUS_COLOR[selected.status] || C.primary}
                    />
                    {isLate(selected) && (
                      <Badge label="Late" color={C.danger} />
                    )}
                  </View>
                  {selected.description ? (
                    <Text style={s.body}>{selected.description}</Text>
                  ) : null}
                  <Text style={s.meta}>
                    Assigned to: {selected.assignedTo?.name || '—'}
                  </Text>
                  <Text style={s.meta}>
                    Assigned by: {selected.assignedBy?.name || '—'}
                  </Text>
                  <Text style={s.meta}>Due: {fmt(selected.dueDate)}</Text>

                  <Text style={s.section}>Update status</Text>
                  <View style={s.statusRow}>
                    {STATUSES.map(st => (
                      <TouchableOpacity
                        key={st.key}
                        style={[
                          s.statusBtn,
                          { borderColor: st.color },
                          selected.status === st.key && {
                            backgroundColor: st.color,
                          },
                        ]}
                        onPress={() => setStatus(selected, st.key)}
                      >
                        <Text
                          style={[
                            s.statusBtnText,
                            selected.status === st.key && { color: '#fff' },
                          ]}
                        >
                          {st.label}
                        </Text>
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
                    <TouchableOpacity
                      style={s.sendBtn}
                      onPress={sendComment}
                      hitSlop={6}
                    >
                      <Send size={20} color="#fff" />
                    </TouchableOpacity>
                  </View>

                  {(selected.statusHistory || []).length > 0 && (
                    <>
                      <Text style={s.section}>History</Text>
                      {selected.statusHistory.map((h: any, i: number) => (
                        <Text key={i} style={s.meta}>
                          {STATUS_LABEL[h.status] || h.status} ·{' '}
                          {h.changedBy?.name || '—'} · {fmt(h.changedAt)}
                        </Text>
                      ))}
                    </>
                  )}
                </ScrollView>
              )}
            </SafeAreaView>
          </View>
        </View>
      </Modal>

      {/* Create / edit Modal */}
      <Modal
        visible={formOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setFormOpen(false)}
      >
        <View style={CENTER.overlay}>
          <View style={CENTER.card}>
            <SafeAreaView edges={[]} style={s.sheet}>
              <View style={s.sheetHeader}>
                <Text style={s.sheetTitle}>
                  {editing ? 'Edit Task' : 'Assign Task'}
                </Text>
                <TouchableOpacity
                  onPress={() => setFormOpen(false)}
                  hitSlop={8}
                >
                  <X size={24} color={C.black} />
                </TouchableOpacity>
              </View>
              <ScrollView
                contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
                keyboardShouldPersistTaps="handled"
              >
                <Text style={s.label}>Title *</Text>
                <TextInput
                  style={s.input}
                  value={form.title}
                  onChangeText={v => setForm(f => ({ ...f, title: v }))}
                  maxLength={200}
                />
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
                          onPress={() =>
                            setForm(f => ({ ...f, assignedTo: e.user }))
                          }
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
                      style={[
                        s.statusBtn,
                        { borderColor: PRIORITY_COLOR[p] },
                        form.priority === p && {
                          backgroundColor: PRIORITY_COLOR[p],
                        },
                      ]}
                      onPress={() => setForm(f => ({ ...f, priority: p }))}
                    >
                      <Text
                        style={[
                          s.statusBtnText,
                          form.priority === p && { color: '#fff' },
                        ]}
                      >
                        {p}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <DatePickerField
                  label="Due date"
                  value={form.dueDate}
                  onChange={v => setForm(f => ({ ...f, dueDate: v }))}
                />
                <TouchableOpacity
                  style={[s.saveBtn, saving && { opacity: 0.6 }]}
                  onPress={save}
                  disabled={saving}
                >
                  <Text style={s.saveText}>
                    {saving
                      ? 'Saving...'
                      : editing
                      ? 'Save Changes'
                      : 'Assign Task'}
                  </Text>
                </TouchableOpacity>
              </ScrollView>
            </SafeAreaView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
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
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  // Compact Task Card
  colWrapper: { gap: 10 },
  cardTablet: { flex: 1 },
  card: {
    borderWidth: 2,
    borderRadius: 8,
    borderRightWidth: 4,
    borderBottomWidth: 4,
    borderRightColor: '#0A0A0A',
    borderBottomColor: '#0A0A0A',
    borderColor: C.black,
    padding: 12,
    backgroundColor: C.white,
    gap: 8,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  cardTitle: {
    flex: 1,
    fontFamily: FONT.bold,
    fontSize: 14,
    color: C.black,
  },
  priorityBadge: {
    borderWidth: 1.5,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  priorityText: {
    fontFamily: FONT.bold,
    fontSize: 10,
    textTransform: 'uppercase',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  metaLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontFamily: FONT.medium,
    fontSize: 11,
    color: C.textMuted,
  },
  lateChip: {
    backgroundColor: C.danger + '18',
    borderWidth: 1,
    borderColor: C.danger,
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  lateChipText: {
    fontFamily: FONT.bold,
    fontSize: 9,
    color: C.danger,
  },
  statusBadge: {
    borderWidth: 1.5,
    borderRadius: 999,
    borderColor: C.black,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  statusBadgeText: {
    fontFamily: FONT.bold,
    fontSize: 10,
    textTransform: 'capitalize',
  },

  meta: { fontFamily: FONT.medium, fontSize: 12, color: C.black },
  empty: {
    textAlign: 'center',
    fontFamily: FONT.bold,
    color: '#6B7280',
    marginTop: 40,
  },
  badge: {
    borderWidth: 2,
    borderRadius: 999,
    borderColor: '#0A0A0A',
    borderRightWidth: 4,
    borderBottomWidth: 4,
    paddingHorizontal: 8,
    paddingVertical: 1,
  },
  badgeText: {
    fontFamily: FONT.bold,
    fontSize: 11,
    textTransform: 'capitalize',
  },
  sheet: { flex: 1, backgroundColor: '#fff' },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 2,
    borderBottomColor: C.black,
  },
  sheetTitle: { fontFamily: FONT.bold, fontSize: 16, color: C.black },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  detailTitle: { fontFamily: FONT.bold, fontSize: 18, color: C.black },
  body: {
    fontFamily: FONT.medium,
    fontSize: 14,
    color: C.black,
    marginBottom: 8,
  },
  section: {
    fontFamily: FONT.bold,
    fontSize: 12,
    color: C.black,
    marginTop: 20,
    marginBottom: 8,
  },
  statusRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  statusBtn: {
    flex: 1,
    borderWidth: 2,
    borderRightWidth: 4,
    borderBottomWidth: 4,
    borderRightColor: '#0A0A0A',
    borderBottomColor: '#0A0A0A',
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
  },
  statusBtnText: {
    fontFamily: FONT.bold,
    fontSize: 11,
    color: C.black,
    textTransform: 'capitalize',
  },
  comment: {
    borderLeftWidth: 3,
    borderLeftColor: C.primary,
    paddingLeft: 12,
    marginBottom: 12,
  },
  commentUser: { fontFamily: FONT.bold, fontSize: 11, color: C.black },
  commentBox: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-end',
    marginTop: 8,
  },
  commentInput: {
    flex: 1,
    fontFamily: FONT.medium,
    borderWidth: 2,
    borderRadius: 8,
    borderRightWidth: 4,
    borderBottomWidth: 4,
    borderRightColor: '#0A0A0A',
    borderBottomColor: '#0A0A0A',
    borderColor: C.black,
    paddingHorizontal: 12,
    paddingVertical: 8,
    maxHeight: 100,
    color: C.black,
  },
  sendBtn: {
    backgroundColor: C.primary,
    borderWidth: 2,
    borderRadius: 8,
    borderRightWidth: 4,
    borderBottomWidth: 4,
    borderRightColor: '#0A0A0A',
    borderBottomColor: '#0A0A0A',
    borderColor: C.black,
    padding: 12,
  },
  label: {
    fontFamily: FONT.bold,
    fontSize: 12,
    color: C.black,
    marginTop: 12,
    marginBottom: 6,
  },
  input: {
    fontFamily: FONT.medium,
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
    color: C.black,
  },
  pickList: {
    borderWidth: 2,
    borderRadius: 8,
    borderRightWidth: 4,
    borderBottomWidth: 4,
    borderRightColor: '#0A0A0A',
    borderBottomColor: '#0A0A0A',
    borderColor: C.black,
    maxHeight: 180,
    marginBottom: 4,
  },
  pickRow: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: C.black,
  },
  pickRowOn: { backgroundColor: C.primary },
  pickText: { fontFamily: FONT.medium, fontSize: 14, color: C.black },
  saveBtn: {
    backgroundColor: C.primary,
    borderWidth: 2,
    borderRadius: 8,
    borderRightWidth: 4,
    borderBottomWidth: 4,
    borderRightColor: '#0A0A0A',
    borderBottomColor: '#0A0A0A',
    borderColor: C.black,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 16,
  },
  saveText: {
    fontFamily: FONT.bold,
    color: '#fff',
    fontSize: 13,
  },
});

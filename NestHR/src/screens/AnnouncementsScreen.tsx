import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { CheckCircle2, ChevronLeft, Pin, Plus, Trash2, X } from 'lucide-react-native';
import { announcementAPI, departmentAPI } from '../api/api';
import { useAuth } from '../contexts/AuthContext';
import { DatePickerField } from '../components/common/DatePickerField';
import ScreenLayout, { HeaderBtn } from '../components/common/ScreenLayout';
import { C, FONT } from '../theme';

// The backend only lets these roles post or delete.
const ADMIN_ROLES = ['super_admin', 'hr_manager'];
const CATEGORIES = ['general', 'policy', 'urgent', 'event', 'holiday', 'hr'];
const PRIORITIES = ['low', 'medium', 'high', 'critical'];
const AUDIENCES = ['all', 'department', 'role'];
const ROLE_OPTIONS = ['hr_manager', 'hr_executive', 'department_head', 'employee'];
const PRIORITY_COLOR: Record<string, string> = {
  low: C.success,
  medium: C.primary,
  high: C.secondary,
  critical: C.danger,
};

const EMPTY_FORM = {
  title: '',
  content: '',
  category: 'general',
  priority: 'medium',
  pinned: false,
  expiryDate: '',
  targetAudience: 'all',
  departments: [] as string[],
  roles: [] as string[],
  acknowledgementRequired: false,
};

const refId = (r: any) => (typeof r === 'string' ? r : r?._id);
const includesUser = (list: any[] | undefined, id?: string) =>
  !!list?.some(r => refId(r) === id);
const fmt = (d?: string) =>
  d
    ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    : '';
const pretty = (s: string) => s.replace(/_/g, ' ');

export default function AnnouncementsScreen() {
  const navigation = useNavigation<any>();
  const { user } = useAuth();
  const isAdmin = ADMIN_ROLES.includes(user?.role || '');

  const [items, setItems] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [openId, setOpenId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const r: any = await announcementAPI.getAll();
      setItems(r.data || []);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to load announcements');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    if (isAdmin) departmentAPI.getAll().then((r: any) => setDepartments(r.data || [])).catch(() => {});
  }, [load, isAdmin]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items
      .filter(a => (category === 'all' || a.category === category) && (!q || a.title.toLowerCase().includes(q)))
      .sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned));
  }, [items, search, category]);

  const toggleOpen = async (a: any) => {
    const opening = openId !== a._id;
    setOpenId(opening ? a._id : null);
    if (opening && !includesUser(a.readBy, user?.id)) {
      try {
        await announcementAPI.markRead(a._id);
        setItems(prev => prev.map(x => (x._id === a._id ? { ...x, readBy: [...(x.readBy || []), user?.id] } : x)));
      } catch {}
    }
  };

  const acknowledge = async (a: any) => {
    try {
      await announcementAPI.acknowledge(a._id);
      setItems(prev => prev.map(x => (x._id === a._id ? { ...x, acknowledgedBy: [...(x.acknowledgedBy || []), user?.id] } : x)));
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to acknowledge');
    }
  };

  const remove = (a: any) =>
    Alert.alert('Delete announcement', 'This moves it to Trash.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await announcementAPI.delete(a._id);
            await load();
          } catch (e: any) {
            Alert.alert('Error', e?.message || 'Failed to delete');
          }
        },
      },
    ]);

  const toggleIn = (key: 'departments' | 'roles', v: string) =>
    setForm(f => ({ ...f, [key]: f[key].includes(v) ? f[key].filter(x => x !== v) : [...f[key], v] }));

  const post = async () => {
    if (!form.title.trim() || !form.content.trim()) {
      Alert.alert('Missing fields', 'Title and content are required');
      return;
    }
    if (form.targetAudience === 'department' && !form.departments.length) {
      Alert.alert('Pick departments', 'Select at least one department');
      return;
    }
    if (form.targetAudience === 'role' && !form.roles.length) {
      Alert.alert('Pick roles', 'Select at least one role');
      return;
    }
    setSaving(true);
    try {
      await announcementAPI.create(form);
      setFormOpen(false);
      setForm(EMPTY_FORM);
      await load();
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to post announcement');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScreenLayout
      title="Announcements"
      loading={loading}
      right={isAdmin ? <HeaderBtn label="Post" icon={<Plus size={14} color="#fff" />} onPress={() => setFormOpen(true)} /> : undefined}
    >
      <View style={s.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10} style={s.back}>
          <ChevronLeft size={18} color={C.black} />
          <Text style={s.backText}>Back</Text>
        </TouchableOpacity>
      </View>
      <View style={s.filters}>
        <TextInput style={s.search} value={search} onChangeText={setSearch} placeholder="Search announcements..." placeholderTextColor="#6B7280" />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {['all', ...CATEGORIES].map(c => (
            <Pill key={c} label={c} on={category === c} onPress={() => setCategory(c)} />
          ))}
        </ScrollView>
      </View>

      <FlatList
        data={shown}
        keyExtractor={a => a._id}
        contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 10 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={<Text style={s.empty}>No announcements</Text>}
        renderItem={({ item: a }) => {
          const read = includesUser(a.readBy, user?.id);
          const acked = includesUser(a.acknowledgedBy, user?.id);
          const open = openId === a._id;
          return (
            <TouchableOpacity style={[s.card, !read && s.cardUnread]} activeOpacity={0.9} onPress={() => toggleOpen(a)}>
              <View style={s.row}>
                {a.pinned ? <Pin size={14} color={C.secondary} /> : null}
                <Text style={s.title} numberOfLines={open ? undefined : 2}>
                  {a.title}
                </Text>
                {!read && <View style={s.dot} />}
              </View>
              <View style={[s.row, { marginTop: 6, flexWrap: 'wrap' }]}>
                <Tag label={a.priority} color={PRIORITY_COLOR[a.priority] || C.primary} />
                <Tag label={a.category} color="#6B7280" />
                {a.acknowledgementRequired && <Tag label={acked ? 'Acknowledged' : 'Ack required'} color={acked ? C.success : C.danger} />}
              </View>
              <Text style={s.meta}>
                {a.postedBy?.name ? `${a.postedBy.name} · ` : ''}
                {fmt(a.date || a.createdAt)}
                {a.expiryDate ? ` · expires ${fmt(a.expiryDate)}` : ''}
              </Text>
              {open && (
                <>
                  <Text style={s.content}>{a.content}</Text>
                  {isAdmin && a.acknowledgementRequired && (
                    <Text style={s.meta}>
                      Read {a.readBy?.length || 0}
                      {a.audienceCount ? ` of ${a.audienceCount}` : ''} · Acknowledged {a.acknowledgedBy?.length || 0}
                    </Text>
                  )}
                  <View style={[s.row, { marginTop: 10, justifyContent: 'space-between' }]}>
                    {a.acknowledgementRequired && !acked ? (
                      <TouchableOpacity style={s.ackBtn} onPress={() => acknowledge(a)}>
                        <CheckCircle2 size={14} color="#fff" />
                        <Text style={s.ackText}>Acknowledge</Text>
                      </TouchableOpacity>
                    ) : (
                      <View />
                    )}
                    {isAdmin && (
                      <TouchableOpacity onPress={() => remove(a)} hitSlop={8}>
                        <Trash2 size={18} color={C.danger} />
                      </TouchableOpacity>
                    )}
                  </View>
                </>
              )}
            </TouchableOpacity>
          );
        }}
      />

      <Modal visible={formOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setFormOpen(false)}>
        <SafeAreaView edges={['top']} style={s.sheet}>
          <View style={s.sheetHeader}>
            <Text style={s.sheetTitle}>New Announcement</Text>
            <TouchableOpacity onPress={() => setFormOpen(false)} hitSlop={8}>
              <X size={22} color={C.black} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
            <Text style={s.label}>Title *</Text>
            <TextInput style={s.input} value={form.title} onChangeText={v => setForm(f => ({ ...f, title: v }))} />
            <Text style={s.label}>Content *</Text>
            <TextInput
              style={[s.input, { height: 110, textAlignVertical: 'top' }]}
              value={form.content}
              onChangeText={v => setForm(f => ({ ...f, content: v }))}
              multiline
            />
            <Text style={s.label}>Category</Text>
            <Chips options={CATEGORIES} value={form.category} onChange={v => setForm(f => ({ ...f, category: v }))} />
            <Text style={s.label}>Priority</Text>
            <Chips options={PRIORITIES} value={form.priority} onChange={v => setForm(f => ({ ...f, priority: v }))} />
            <DatePickerField label="Expiry date (optional)" value={form.expiryDate} onChange={v => setForm(f => ({ ...f, expiryDate: v }))} />
            <Text style={s.label}>Audience</Text>
            <Chips options={AUDIENCES} value={form.targetAudience} onChange={v => setForm(f => ({ ...f, targetAudience: v }))} />
            {form.targetAudience === 'department' && (
              <MultiChips
                options={departments.map(d => ({ value: d._id, label: d.name }))}
                selected={form.departments}
                onToggle={v => toggleIn('departments', v)}
              />
            )}
            {form.targetAudience === 'role' && (
              <MultiChips
                options={ROLE_OPTIONS.map(r => ({ value: r, label: pretty(r) }))}
                selected={form.roles}
                onToggle={v => toggleIn('roles', v)}
              />
            )}
            <View style={s.switchRow}>
              <Text style={s.switchLabel}>Pin to top</Text>
              <Switch value={form.pinned} onValueChange={v => setForm(f => ({ ...f, pinned: v }))} trackColor={{ false: '#D1D5DB', true: C.primary }} thumbColor="#fff" />
            </View>
            <View style={s.switchRow}>
              <Text style={s.switchLabel}>Require acknowledgement</Text>
              <Switch
                value={form.acknowledgementRequired}
                onValueChange={v => setForm(f => ({ ...f, acknowledgementRequired: v }))}
                trackColor={{ false: '#D1D5DB', true: C.primary }}
                thumbColor="#fff"
              />
            </View>
            <TouchableOpacity style={[s.saveBtn, saving && { opacity: 0.6 }]} onPress={post} disabled={saving}>
              <Text style={s.saveText}>{saving ? 'Posting...' : 'Post Announcement'}</Text>
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

function Chips({ options, value, onChange }: { options: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <View style={s.chipWrap}>
      {options.map(o => (
        <Pill key={o} label={pretty(o)} on={value === o} onPress={() => onChange(o)} />
      ))}
    </View>
  );
}

function MultiChips({
  options,
  selected,
  onToggle,
}: {
  options: { value: string; label: string }[];
  selected: string[];
  onToggle: (v: string) => void;
}) {
  return (
    <View style={s.chipWrap}>
      {options.map(o => (
        <Pill key={o.value} label={o.label} on={selected.includes(o.value)} onPress={() => onToggle(o.value)} />
      ))}
    </View>
  );
}

function Tag({ label, color }: { label: string; color: string }) {
  return (
    <View style={[s.tag, { borderColor: color }]}>
      <Text style={[s.tagText, { color }]}>{pretty(label)}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  topBar: { paddingHorizontal: 16, paddingTop: 10 },
  back: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start' },
  backText: { fontFamily: FONT.bold, fontSize: 12, color: C.black, textTransform: 'uppercase' },
  filters: { paddingHorizontal: 16, paddingTop: 10, gap: 8 },
  search: { fontFamily: FONT.medium, borderWidth: 2, borderColor: C.black, paddingHorizontal: 12, paddingVertical: 8, fontSize: 14, color: C.black },
  pill: { borderWidth: 2, borderColor: C.black, paddingHorizontal: 12, paddingVertical: 6 },
  pillOn: { backgroundColor: C.primary, borderColor: C.primary },
  pillText: { fontFamily: FONT.bold, fontSize: 11, color: C.black, textTransform: 'uppercase' },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  card: { borderWidth: 2, borderColor: C.black, padding: 12, backgroundColor: '#fff' },
  cardUnread: { borderLeftWidth: 6, borderLeftColor: C.primary },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { flex: 1, fontFamily: FONT.bold, fontSize: 15, color: C.black },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: C.primary },
  tag: { borderWidth: 2, paddingHorizontal: 8, paddingVertical: 1 },
  tagText: { fontFamily: FONT.bold, fontSize: 10, textTransform: 'uppercase' },
  meta: { fontFamily: FONT.medium, fontSize: 12, color: '#374151', marginTop: 6 },
  content: { fontFamily: FONT.medium, fontSize: 14, color: C.black, marginTop: 10, lineHeight: 20 },
  ackBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.success, borderWidth: 2, borderColor: C.black, paddingHorizontal: 12, paddingVertical: 8 },
  ackText: { fontFamily: FONT.bold, fontSize: 12, color: '#fff', textTransform: 'uppercase' },
  empty: { textAlign: 'center', fontFamily: FONT.bold, color: '#6B7280', marginTop: 40 },
  sheet: { flex: 1, backgroundColor: '#fff' },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 2, borderBottomColor: C.black },
  sheetTitle: { fontFamily: FONT.bold, fontSize: 17, color: C.black },
  label: { fontFamily: FONT.bold, fontSize: 12, color: C.black, textTransform: 'uppercase', marginTop: 12, marginBottom: 6 },
  input: { fontFamily: FONT.medium, borderWidth: 2, borderColor: C.black, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: C.black },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 },
  switchLabel: { fontFamily: FONT.bold, fontSize: 13, color: C.black },
  saveBtn: { backgroundColor: C.primary, borderWidth: 2, borderColor: C.black, paddingVertical: 12, alignItems: 'center', marginTop: 20 },
  saveText: { fontFamily: FONT.bold, color: '#fff', fontSize: 13, textTransform: 'uppercase' },
});

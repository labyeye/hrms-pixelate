import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
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
import MetaChip, { CHIP } from '../components/common/MetaChip';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import {
  CheckCircle2,
  ChevronLeft,
  Download,
  Ellipsis,
  Megaphone,
  Pin,
  Plus,
  Search,
  SlidersHorizontal,
  Trash2,
  X,
} from 'lucide-react-native';
import { announcementAPI, departmentAPI } from '../api/api';
import { launchImageLibrary } from 'react-native-image-picker';
import { API_BASE_URL } from '../config/env';
import { chooseExport } from '../utils/exporters';
import { useAuth } from '../contexts/AuthContext';
import { DatePickerField } from '../components/common/DatePickerField';
import HeaderIconBtn from '../components/common/HeaderIconBtn';
import SearchModal from '../components/common/SearchModal';
import FilterSortModal from '../components/common/FilterSortModal';
import SlideInCard from '../components/motion/SlideInCard';
import { C, FONT, useResponsive } from '../theme';
import { CENTER } from '../components/common/centerModal';

const ADMIN_ROLES = ['super_admin', 'hr_manager'];
const CATEGORIES = ['general', 'policy', 'urgent', 'event', 'holiday', 'hr'];
const PRIORITIES = ['low', 'medium', 'high', 'critical'];
const AUDIENCES = ['all', 'department', 'role'];
const ROLE_OPTIONS = [
  'hr_manager',
  'hr_executive',
  'department_head',
  'employee',
];
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
    ? new Date(d).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : '';
const pretty = (s: string) => s.replace(/_/g, ' ');

export default function AnnouncementsScreen() {
  const navigation = useNavigation<any>();
  const { user } = useAuth();
  const { isTablet, maxContentWidth } = useResponsive();
  const isAdmin = ADMIN_ROLES.includes(user?.role || '');

  const [items, setItems] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [category, setCategory] = useState('all');
  const [openId, setOpenId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [poster, setPoster] = useState<{
    uri: string;
    type: string;
    name: string;
  } | null>(null);

  const serverRoot = API_BASE_URL.replace(/\/api\/?$/, '');

  const pickPoster = async () => {
    const r = await launchImageLibrary({ mediaType: 'photo', quality: 0.8 });
    const a = r.assets?.[0];
    if (!a?.uri) return;
    if ((a.fileSize || 0) > 5 * 1024 * 1024) {
      Alert.alert('Too large', 'Poster must be under 5 MB');
      return;
    }
    setPoster({
      uri: a.uri,
      type: a.type || 'image/jpeg',
      name: a.fileName || `poster_${Date.now()}.jpg`,
    });
  };

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
    if (isAdmin)
      departmentAPI
        .getAll()
        .then((r: any) => setDepartments(r.data || []))
        .catch(() => {});
  }, [load, isAdmin]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items
      .filter(
        a =>
          (category === 'all' || a.category === category) &&
          (!q || a.title.toLowerCase().includes(q)),
      )
      .sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned));
  }, [items, search, category]);

  const toggleOpen = async (a: any) => {
    const opening = openId !== a._id;
    setOpenId(opening ? a._id : null);
    if (opening && !includesUser(a.readBy, user?.id)) {
      try {
        await announcementAPI.markRead(a._id);
        setItems(prev =>
          prev.map(x =>
            x._id === a._id
              ? { ...x, readBy: [...(x.readBy || []), user?.id] }
              : x,
          ),
        );
      } catch {}
    }
  };

  const acknowledge = async (a: any) => {
    try {
      await announcementAPI.acknowledge(a._id);
      setItems(prev =>
        prev.map(x =>
          x._id === a._id
            ? { ...x, acknowledgedBy: [...(x.acknowledgedBy || []), user?.id] }
            : x,
        ),
      );
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
    setForm(f => ({
      ...f,
      [key]: f[key].includes(v) ? f[key].filter(x => x !== v) : [...f[key], v],
    }));

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
      const posterUrl = poster
        ? (
            await announcementAPI.uploadPoster(
              poster.uri,
              poster.type,
              poster.name,
            )
          ).url
        : undefined;
      await announcementAPI.create({ ...form, posterUrl });
      setFormOpen(false);
      setForm(EMPTY_FORM);
      setPoster(null);
      await load();
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to post announcement');
    } finally {
      setSaving(false);
    }
  };

  const exportCols = [
    { header: 'Title', value: (a: any) => a.title },
    { header: 'Category', value: (a: any) => a.category },
    { header: 'Priority', value: (a: any) => a.priority },
    { header: 'Posted By', value: (a: any) => a.postedBy?.name },
    {
      header: 'Date',
      value: (a: any) => String(a.date || a.createdAt || '').slice(0, 10),
    },
    { header: 'Seen', value: (a: any) => a.readBy?.length || 0 },
    { header: 'Content', value: (a: any) => a.content },
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
          <Megaphone size={20} color={C.primary} />
          <Text style={s.headerTitle}>Announcements</Text>
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
            dot={category !== 'all'}
            onPress={() => setFilterOpen(true)}
          />
          <HeaderIconBtn
            label="More actions"
            icon={<Ellipsis size={22} color={C.black} />}
            onPress={() => setMenuOpen(true)}
          />
          {isAdmin && (
            <TouchableOpacity
              style={s.addBtn}
              onPress={() => setFormOpen(true)}
              accessibilityLabel="Post Announcement"
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
            <TouchableOpacity
              style={s.menuItem}
              onPress={() => {
                setMenuOpen(false);
                chooseExport('announcements', exportCols, shown);
              }}
            >
              <Download size={18} color={C.black} />
              <Text style={s.menuText}>Export announcements</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      <SearchModal
        visible={searchOpen}
        onClose={() => setSearchOpen(false)}
        value={search}
        onChange={setSearch}
        placeholder="Search announcements…"
        items={items.map((a: any) => ({
          key: a._id,
          title: a.title,
          subtitle: a.category,
        }))}
      />
      <FilterSortModal
        visible={filterOpen}
        onClose={() => setFilterOpen(false)}
        filterTitle="Category"
        filterOptions={['all', ...CATEGORIES].map(c => ({ key: c, label: c }))}
        filterValue={category}
        onFilter={setCategory}
        onReset={() => setCategory('all')}
      />

      {loading ? (
        <View style={s.loader}>
          <ActivityIndicator size="large" color={C.primary} />
        </View>
      ) : (
        <FlatList
          key={isTablet ? 'tablet-grid-2' : 'mobile-list'}
          data={shown}
          keyExtractor={a => a._id}
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
          ListEmptyComponent={<Text style={s.empty}>No announcements</Text>}
          renderItem={({ item: a, index }) => {
            const read = includesUser(a.readBy, user?.id);
            const acked = includesUser(a.acknowledgedBy, user?.id);
            const open = openId === a._id;
            return (
              <SlideInCard
                index={index}
                style={isTablet ? s.cardTablet : undefined}
              >
                <TouchableOpacity
                  style={[s.card, !read && s.cardUnread]}
                  activeOpacity={0.9}
                  onPress={() => toggleOpen(a)}
                >
                  <View style={s.row}>
                    {a.pinned ? <Pin size={14} color={C.secondary} /> : null}
                    <Text style={s.title} numberOfLines={open ? undefined : 2}>
                      {a.title}
                    </Text>
                    {!read && <View style={s.dot} />}
                  </View>
                  <View style={[s.row, { marginTop: 6, flexWrap: 'wrap' }]}>
                    <Tag
                      label={a.priority}
                      color={PRIORITY_COLOR[a.priority] || C.primary}
                    />
                    <Tag label={a.category} color="#6B7280" />
                    {a.acknowledgementRequired && (
                      <Tag
                        label={acked ? 'Acknowledged' : 'Ack required'}
                        color={acked ? C.success : C.danger}
                      />
                    )}
                  </View>
                  <View
                    style={[s.row, { marginTop: 8, flexWrap: 'wrap', gap: 6 }]}
                  >
                    {!!a.postedBy?.name && (
                      <MetaChip text={a.postedBy.name} bg={CHIP.blue} />
                    )}
                    <MetaChip
                      text={fmt(a.date || a.createdAt)}
                      bg={CHIP.blue}
                    />
                    {!!a.expiryDate && (
                      <MetaChip
                        text={`Expires ${fmt(a.expiryDate)}`}
                        bg={CHIP.blue}
                      />
                    )}
                  </View>
                  {open && (
                    <>
                      {!!a.posterUrl && (
                        <Image
                          source={{ uri: `${serverRoot}${a.posterUrl}` }}
                          style={{
                            width: '100%',
                            height: 220,
                            marginTop: 10,
                            marginBottom: 8,
                            borderWidth: 2,
                            borderColor: C.black,
                          }}
                          resizeMode="contain"
                        />
                      )}
                      <Text style={s.content}>{a.content}</Text>
                      {isAdmin && a.acknowledgementRequired && (
                        <Text style={s.meta}>
                          Read {a.readBy?.length || 0}
                          {a.audienceCount ? ` of ${a.audienceCount}` : ''} ·
                          Acknowledged {a.acknowledgedBy?.length || 0}
                        </Text>
                      )}
                      <View
                        style={[
                          s.row,
                          { marginTop: 12, justifyContent: 'space-between' },
                        ]}
                      >
                        {a.acknowledgementRequired && !acked ? (
                          <TouchableOpacity
                            style={s.ackBtn}
                            onPress={() => acknowledge(a)}
                          >
                            <CheckCircle2 size={14} color="#fff" />
                            <Text style={s.ackText}>Acknowledge</Text>
                          </TouchableOpacity>
                        ) : (
                          <View />
                        )}
                        {isAdmin && (
                          <TouchableOpacity
                            onPress={() => remove(a)}
                            hitSlop={8}
                          >
                            <Trash2 size={20} color={C.danger} />
                          </TouchableOpacity>
                        )}
                      </View>
                    </>
                  )}
                </TouchableOpacity>
              </SlideInCard>
            );
          }}
        />
      )}

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
                <Text style={s.sheetTitle}>New Announcement</Text>
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
                />
                <Text style={s.label}>Content *</Text>
                <TextInput
                  style={[s.input, { height: 110, textAlignVertical: 'top' }]}
                  value={form.content}
                  onChangeText={v => setForm(f => ({ ...f, content: v }))}
                  multiline
                />
                <Text style={s.label}>
                  Poster (optional) · sent to every employee as a notification
                </Text>
                <TouchableOpacity style={s.input} onPress={pickPoster}>
                  <Text style={{ color: C.black, fontWeight: '400' }}>
                    {poster ? 'Change poster' : 'Choose poster image'}
                  </Text>
                </TouchableOpacity>
                {poster && (
                  <View style={{ marginBottom: 8 }}>
                    <Image
                      source={{ uri: poster.uri }}
                      style={{ width: '100%', height: 160 }}
                      resizeMode="contain"
                    />
                    <TouchableOpacity onPress={() => setPoster(null)}>
                      <Text
                        style={{
                          color: C.danger,
                          fontWeight: '400',
                          marginTop: 4,
                        }}
                      >
                        Remove poster
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
                <Text style={s.label}>Category</Text>
                <Chips
                  options={CATEGORIES}
                  value={form.category}
                  onChange={v => setForm(f => ({ ...f, category: v }))}
                />
                <Text style={s.label}>Priority</Text>
                <Chips
                  options={PRIORITIES}
                  value={form.priority}
                  onChange={v => setForm(f => ({ ...f, priority: v }))}
                />
                <DatePickerField
                  label="Expiry date (optional)"
                  value={form.expiryDate}
                  onChange={v => setForm(f => ({ ...f, expiryDate: v }))}
                />
                <Text style={s.label}>Audience</Text>
                <Chips
                  options={AUDIENCES}
                  value={form.targetAudience}
                  onChange={v => setForm(f => ({ ...f, targetAudience: v }))}
                />
                {form.targetAudience === 'department' && (
                  <MultiChips
                    options={departments.map(d => ({
                      value: d._id,
                      label: d.name,
                    }))}
                    selected={form.departments}
                    onToggle={v => toggleIn('departments', v)}
                  />
                )}
                {form.targetAudience === 'role' && (
                  <MultiChips
                    options={ROLE_OPTIONS.map(r => ({
                      value: r,
                      label: pretty(r),
                    }))}
                    selected={form.roles}
                    onToggle={v => toggleIn('roles', v)}
                  />
                )}
                <View style={s.switchRow}>
                  <Text style={s.switchLabel}>Pin to top</Text>
                  <Switch
                    value={form.pinned}
                    onValueChange={v => setForm(f => ({ ...f, pinned: v }))}
                    trackColor={{ false: '#D1D5DB', true: C.primary }}
                    thumbColor="#fff"
                  />
                </View>
                <View style={s.switchRow}>
                  <Text style={s.switchLabel}>Require acknowledgement</Text>
                  <Switch
                    value={form.acknowledgementRequired}
                    onValueChange={v =>
                      setForm(f => ({ ...f, acknowledgementRequired: v }))
                    }
                    trackColor={{ false: '#D1D5DB', true: C.primary }}
                    thumbColor="#fff"
                  />
                </View>
                <TouchableOpacity
                  style={[s.saveBtn, saving && { opacity: 0.6 }]}
                  onPress={post}
                  disabled={saving}
                >
                  <Text style={s.saveText}>
                    {saving ? 'Posting...' : 'Post Announcement'}
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

function Pill({
  label,
  on,
  onPress,
}: {
  label: string;
  on: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity onPress={onPress} style={[s.pill, on && s.pillOn]}>
      <Text style={[s.pillText, on && { color: '#fff' }]}>{label}</Text>
    </TouchableOpacity>
  );
}

function Chips({
  options,
  value,
  onChange,
}: {
  options: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <View style={s.chipWrap}>
      {options.map(o => (
        <Pill
          key={o}
          label={pretty(o)}
          on={value === o}
          onPress={() => onChange(o)}
        />
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
        <Pill
          key={o.value}
          label={o.label}
          on={selected.includes(o.value)}
          onPress={() => onToggle(o.value)}
        />
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
  pill: {
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
  pillOn: { backgroundColor: C.primary, borderColor: C.primary },
  pillText: {
    fontFamily: FONT.bold,
    fontSize: 11,
    color: C.black,
    textTransform: 'capitalize',
  },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
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
  },
  cardUnread: { borderLeftWidth: 5, borderLeftColor: C.primary },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { flex: 1, fontFamily: FONT.bold, fontSize: 14, color: C.black },
  dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: C.primary },
  tag: {
    borderWidth: 1.5,
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 1,
  },
  tagText: { fontFamily: FONT.bold, fontSize: 10, textTransform: 'capitalize' },
  meta: {
    fontFamily: FONT.medium,
    fontSize: 12,
    color: '#374151',
    marginTop: 6,
  },
  content: {
    fontFamily: FONT.medium,
    fontSize: 14,
    color: C.black,
    marginTop: 12,
    lineHeight: 20,
  },
  ackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: C.success,
    borderWidth: 2,
    borderRadius: 8,
    borderColor: C.black,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  ackText: {
    fontFamily: FONT.bold,
    fontSize: 12,
    color: C.white,
  },
  empty: {
    textAlign: 'center',
    fontFamily: FONT.bold,
    color: '#6B7280',
    marginTop: 40,
  },
  sheet: { flex: 1, backgroundColor: C.white },
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
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  switchLabel: { fontFamily: FONT.bold, fontSize: 13, color: C.black },
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
    marginTop: 20,
  },
  saveText: {
    fontFamily: FONT.bold,
    color: C.white,
    fontSize: 13,
  },
});

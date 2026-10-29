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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Plus,
  X,
  Trash2,
  Check,
  Sun,
  ChevronLeft,
  Edit2,
  ChevronRight,
  CalendarDays,
  Flag,
  Gift,
  Lock,
  CalendarClock,
} from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { holidayAPI } from '../api/api';
import { C } from '../theme';
import { CENTER } from '../components/common/centerModal';
import ExportButton from '../components/common/ExportButton';
import StatTile, { tileGrid } from '../components/common/StatTile';

const TYPE_COLOR: Record<string, string> = {
  national: C.danger,
  optional: C.secondary,
  restricted: '#EAB308',
};
const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];
const DOW = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const iso = (y: number, m: number, d: number) =>
  `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

const EMPTY_FORM = { name: '', date: '', type: 'national', description: '' };

export default function HolidaysScreen() {
  const navigation = useNavigation<any>();
  const [holidays, setHolidays] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingHoliday, setEditingHoliday] = useState<any | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [dayModal, setDayModal] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await holidayAPI.getAll({ year: String(year) });
      setHolidays(res.data || []);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
    }
  }, [year]);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const openCreate = (date = '') => {
    setEditingHoliday(null);
    setForm({ ...EMPTY_FORM, date });
    setShowForm(true);
  };

  const openEdit = (h: any) => {
    setEditingHoliday(h);
    setForm({
      name: h.name || '',
      date: h.date ? h.date.slice(0, 10) : '',
      type: h.type || 'national',
      description: h.description || '',
    });
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingHoliday(null);
    setForm(EMPTY_FORM);
  };

  const handleSubmit = async () => {
    if (!form.name.trim() || !form.date) {
      Alert.alert('Validation', 'Name and date are required');
      return;
    }
    setSaving(true);
    try {
      if (editingHoliday) {
        await holidayAPI.update(editingHoliday._id, form);
      } else {
        await holidayAPI.create(form);
      }
      closeForm();
      await load();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (h: any) => {
    Alert.alert('Delete Holiday', `Remove "${h.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await holidayAPI.delete(h._id);
            setHolidays(p => p.filter(x => x._id !== h._id));
          } catch (e: any) {
            Alert.alert('Error', e.message);
          }
        },
      },
    ]);
  };

  const upcoming = holidays.filter(h => new Date(h.date) >= new Date()).length;
  const active = holidays.filter(h => h.isActive !== false);
  const count = (t: string) => active.filter(h => h.type === t).length;
  const todayKey = iso(now.getFullYear(), now.getMonth(), now.getDate());
  const nextHoliday = [...active]
    .filter(h => String(h.date).slice(0, 10) >= todayKey)
    .sort((a, b) => String(a.date).localeCompare(String(b.date)))[0];
  const byDate: Record<string, any[]> = {};
  holidays.forEach(h => {
    const k = String(h.date).slice(0, 10);
    (byDate[k] = byDate[k] || []).push(h);
  });
  const dayHolidays = dayModal ? byDate[dayModal] || [] : [];
  const monthHolidays = holidays
    .filter(h => new Date(h.date).getMonth() === month)
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const first = new Date(year, month, 1).getDay();
  const dim = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(first).fill(null),
    ...Array.from({ length: dim }, (_, i) => i + 1),
  ];
  while (cells.length % 7) cells.push(null);
  const shiftMonth = (d: number) => {
    const dt = new Date(year, month + d, 1);
    setYear(dt.getFullYear());
    setMonth(dt.getMonth());
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={{ padding: 4, marginRight: 4 }}
          >
            <ChevronLeft size={22} color={C.black} />
          </TouchableOpacity>
          <Sun size={20} color={C.primary} />
          <Text style={styles.headerTitle}>Holidays</Text>
          <View style={styles.countBadge}>
            <Text style={styles.countText}>{upcoming} upcoming</Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <ExportButton
            name={`holidays_${year}`}
            label=""
            rows={[...holidays].sort((a, b) =>
              String(a.date).localeCompare(String(b.date)),
            )}
            cols={[
              {
                header: 'Date',
                value: (h: any) => String(h.date).slice(0, 10),
              },
              {
                header: 'Day',
                value: (h: any) =>
                  new Date(h.date).toLocaleDateString('en-IN', {
                    weekday: 'long',
                  }),
              },
              { header: 'Holiday', value: (h: any) => h.name },
              { header: 'Type', value: (h: any) => h.type },
              { header: 'Description', value: (h: any) => h.description || '' },
            ]}
          />
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => openCreate()}
            accessibilityLabel="Add"
            hitSlop={8}
          >
            <Plus size={24} color={C.primary} />
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={C.primary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 32 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={C.primary}
            />
          }
          showsVerticalScrollIndicator={false}
        >
          <View style={tileGrid}>
            <StatTile
              label={`Total ${year}`}
              value={active.length}
              icon={CalendarDays}
              color={C.primary}
            />
            <StatTile
              label="National"
              value={count('national')}
              icon={Flag}
              color={C.danger}
            />
            <StatTile
              label="Optional"
              value={count('optional')}
              icon={Gift}
              color={C.secondary}
            />
            <StatTile
              label="Restricted"
              value={count('restricted')}
              icon={Lock}
              color="#EAB308"
            />
            <StatTile
              label="Next Holiday"
              value={nextHoliday ? nextHoliday.name : 'None'}
              sub={
                nextHoliday
                  ? new Date(nextHoliday.date).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                    })
                  : undefined
              }
              icon={CalendarClock}
              color={C.success}
              width="100%"
            />
          </View>

          <View style={styles.calCard}>
            <View style={styles.calNav}>
              <TouchableOpacity
                onPress={() => shiftMonth(-1)}
                style={styles.calNavBtn}
              >
                <ChevronLeft size={18} color={C.black} />
              </TouchableOpacity>
              <Text style={styles.calTitle}>
                {MONTHS[month]} {year}
              </Text>
              <TouchableOpacity
                onPress={() => shiftMonth(1)}
                style={styles.calNavBtn}
              >
                <ChevronRight size={18} color={C.black} />
              </TouchableOpacity>
            </View>
            <View style={styles.calRow}>
              {DOW.map((d, i) => (
                <Text key={i} style={styles.calDow}>
                  {d}
                </Text>
              ))}
            </View>
            <View style={styles.calGrid}>
              {cells.map((d, i) => {
                if (!d) return <View key={i} style={styles.calCell} />;
                const key = iso(year, month, d);
                const list = byDate[key] || [];
                const isToday = key === todayKey;
                return (
                  <TouchableOpacity
                    key={i}
                    style={styles.calCell}
                    onPress={() => setDayModal(key)}
                  >
                    <View
                      style={[
                        styles.calDay,
                        isToday && { backgroundColor: C.primary },
                      ]}
                    >
                      <Text
                        style={[
                          styles.calDayText,
                          isToday && { color: C.white },
                          i % 7 === 0 && !isToday && { color: C.danger },
                        ]}
                      >
                        {d}
                      </Text>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 2, height: 6 }}>
                      {list.slice(0, 3).map(h => (
                        <View
                          key={h._id}
                          style={[
                            styles.dot,
                            {
                              backgroundColor:
                                TYPE_COLOR[h.type] || C.textMuted,
                            },
                          ]}
                        />
                      ))}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
            <View style={styles.legend}>
              {Object.keys(TYPE_COLOR).map(t => (
                <View
                  key={t}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
                >
                  <View
                    style={[styles.dot, { backgroundColor: TYPE_COLOR[t] }]}
                  />
                  <Text style={styles.legendText}>{t.toUpperCase()}</Text>
                </View>
              ))}
            </View>
          </View>

          <Text style={styles.listTitle}>{MONTHS[month]} holidays</Text>
          {monthHolidays.length === 0 ? (
            <Text style={styles.emptyText}>
              No holidays this month. Tap a date to add one.
            </Text>
          ) : (
            monthHolidays.map(item => {
              const color = TYPE_COLOR[item.type] || C.textMuted;
              const d = new Date(item.date);
              return (
                <TouchableOpacity
                  key={item._id}
                  style={styles.card}
                  onPress={() => setDayModal(String(item.date).slice(0, 10))}
                >
                  <View style={[styles.dateBadge, { backgroundColor: color }]}>
                    <Text style={styles.dateDay}>{d.getDate()}</Text>
                    <Text style={styles.dateMonth}>
                      {d.toLocaleString('en', { month: 'short' }).toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1, marginLeft: 14 }}>
                    <Text style={styles.holidayName}>{item.name}</Text>
                    <View style={styles.metaRow}>
                      <View
                        style={[
                          styles.typePill,
                          { backgroundColor: color, borderColor: C.black },
                        ]}
                      >
                        <Text style={[styles.typePillText, { color: C.white }]}>
                          {item.type?.toUpperCase()}
                        </Text>
                      </View>
                      <Text style={styles.weekday}>
                        {d.toLocaleDateString('en-IN', { weekday: 'long' })}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>
      )}

      {/* Day modal — centred: holidays on the tapped date + add */}
      <Modal
        visible={!!dayModal}
        transparent
        animationType="fade"
        onRequestClose={() => setDayModal(null)}
      >
        <View style={styles.dayOverlay}>
          <View style={styles.dayCard}>
            <View style={styles.dayHead}>
              <Text style={styles.dayHeadText}>
                {dayModal
                  ? new Date(dayModal + 'T00:00:00').toLocaleDateString(
                      'en-IN',
                      {
                        weekday: 'long',
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      },
                    )
                  : ''}
              </Text>
              <TouchableOpacity onPress={() => setDayModal(null)}>
                <X size={20} color={C.white} />
              </TouchableOpacity>
            </View>
            <ScrollView
              style={{ maxHeight: 320 }}
              contentContainerStyle={{ padding: 14, gap: 10 }}
            >
              {dayHolidays.length === 0 ? (
                <Text style={styles.emptyText}>No holiday on this date.</Text>
              ) : (
                dayHolidays.map(h => (
                  <View
                    key={h._id}
                    style={[
                      styles.dayItem,
                      { borderColor: TYPE_COLOR[h.type] || C.black },
                    ]}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.holidayName}>{h.name}</Text>
                      <Text
                        style={[
                          styles.typePillText,
                          { color: TYPE_COLOR[h.type] || C.black },
                        ]}
                      >
                        {String(h.type).toUpperCase()}
                      </Text>
                      {h.description ? (
                        <Text style={styles.desc}>{h.description}</Text>
                      ) : null}
                    </View>
                    <TouchableOpacity
                      onPress={() => {
                        setDayModal(null);
                        openEdit(h);
                      }}
                      style={styles.editBtn}
                    >
                      <Edit2 size={13} color={C.primary} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handleDelete(h)}
                      style={styles.deleteBtn}
                    >
                      <Trash2 size={13} color={C.danger} />
                    </TouchableOpacity>
                  </View>
                ))
              )}
            </ScrollView>
            <TouchableOpacity
              style={styles.dayAdd}
              onPress={() => {
                const d = dayModal || '';
                setDayModal(null);
                openCreate(d);
              }}
            >
              <Plus size={14} color={C.white} />
              <Text style={styles.addBtnText}>Add holiday on this date</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showForm} transparent animationType="fade">
        <View style={CENTER.overlay}>
          <View style={CENTER.card}>
            <SafeAreaView style={styles.safe} edges={[]}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  {editingHoliday ? 'Edit Holiday' : 'Add Holiday'}
                </Text>
                <TouchableOpacity onPress={closeForm}>
                  <X size={22} color={C.black} />
                </TouchableOpacity>
              </View>
              <ScrollView
                contentContainerStyle={{ padding: 20, gap: 16 }}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                <View>
                  <Text style={styles.fieldLabel}>Holiday Name *</Text>
                  <TextInput
                    style={styles.fieldInput}
                    value={form.name}
                    onChangeText={v => setForm(p => ({ ...p, name: v }))}
                    placeholder="Diwali"
                    placeholderTextColor={C.textLight}
                  />
                </View>
                <View>
                  <Text style={styles.fieldLabel}>Date * (YYYY-MM-DD)</Text>
                  <TextInput
                    style={styles.fieldInput}
                    value={form.date}
                    onChangeText={v => setForm(p => ({ ...p, date: v }))}
                    placeholder="2025-10-20"
                    placeholderTextColor={C.textLight}
                  />
                </View>
                <View>
                  <Text style={styles.fieldLabel}>Type</Text>
                  <View
                    style={{
                      flexDirection: 'row',
                      flexWrap: 'wrap',
                      gap: 8,
                      marginTop: 6,
                    }}
                  >
                    {Object.keys(TYPE_COLOR).map(t => (
                      <TouchableOpacity
                        key={t}
                        style={[
                          styles.selChip,
                          form.type === t && {
                            backgroundColor: TYPE_COLOR[t],
                            borderColor: TYPE_COLOR[t],
                          },
                        ]}
                        onPress={() => setForm(p => ({ ...p, type: t }))}
                      >
                        <Text
                          style={[
                            styles.selChipText,
                            form.type === t && { color: C.white },
                          ]}
                        >
                          {t.toUpperCase()}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
                <View>
                  <Text style={styles.fieldLabel}>Description</Text>
                  <TextInput
                    style={styles.fieldInput}
                    value={form.description}
                    onChangeText={v => setForm(p => ({ ...p, description: v }))}
                    placeholder="Optional description"
                    placeholderTextColor={C.textLight}
                  />
                </View>
                <TouchableOpacity
                  style={styles.submitBtn}
                  onPress={handleSubmit}
                  disabled={saving}
                >
                  {saving ? (
                    <ActivityIndicator color={C.white} />
                  ) : (
                    <>
                      <Check size={16} color={C.white} />
                      <Text style={styles.submitBtnText}>
                        {editingHoliday ? 'Save Changes' : 'Add Holiday'}
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
  calCard: {
    backgroundColor: C.white,
    borderWidth: 2,
    borderRadius: 8,
    borderRightWidth: 5,
    borderBottomWidth: 5,
    borderRightColor: '#0A0A0A',
    borderBottomColor: '#0A0A0A',
    borderColor: C.black,
    padding: 10,
  },
  calNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  calNavBtn: { borderWidth: 2, borderColor: C.black, padding: 4 },
  calTitle: { fontSize: 15, fontWeight: '400', color: C.black },
  calRow: { flexDirection: 'row' },
  calDow: {
    flex: 1,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '400',
    color: C.textMuted,
    paddingBottom: 4,
  },
  calGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  calCell: { width: '14.2857%', alignItems: 'center', paddingVertical: 4 },
  calDay: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 15,
  },
  calDayText: { fontSize: 13, fontWeight: '400', color: C.black },
  dot: { width: 6, height: 6, borderRadius: 3 },
  legend: {
    flexDirection: 'row',
    gap: 14,
    justifyContent: 'center',
    marginTop: 8,
  },
  legendText: { fontSize: 10, fontWeight: '400', color: C.black },
  listTitle: {
    fontSize: 12,
    fontWeight: '400',
    color: C.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  dayOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  dayCard: {
    backgroundColor: C.white,
    borderWidth: 2,
    borderRadius: 8,
    borderRightWidth: 5,
    borderBottomWidth: 5,
    borderRightColor: '#0A0A0A',
    borderBottomColor: '#0A0A0A',
    borderColor: C.black,
    overflow: 'hidden',
  },
  dayHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    backgroundColor: C.primary,
    borderBottomWidth: 2,
    borderBottomColor: C.black,
  },
  dayHeadText: { color: C.white, fontWeight: '400', fontSize: 14, flex: 1 },
  dayItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 2,
    padding: 10,
  },
  dayAdd: {
    margin: 14,
    marginTop: 0,
    backgroundColor: C.primary,
    borderWidth: 2,
    borderColor: C.black,
    paddingVertical: 12,
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  safe: { flex: 1, backgroundColor: '#F8F9FA' },
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
  countBadge: {
    backgroundColor: C.success + '20',
    borderWidth: 2,
    borderColor: C.success,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  countText: { fontSize: 12, fontWeight: '400', color: C.success },
  addBtn: { padding: 4 },
  addBtnText: {
    color: C.white,
    fontSize: 12,
    fontWeight: '400',
    textTransform: 'uppercase',
  },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyText: { fontSize: 14, fontWeight: '400', color: C.textMuted },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.white,
    borderWidth: 2,
    borderRadius: 8,
    borderRightWidth: 5,
    borderBottomWidth: 5,
    borderRightColor: '#0A0A0A',
    borderBottomColor: '#0A0A0A',
    borderColor: C.black,
    padding: 14,
  },
  dateBadge: {
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderRightWidth: 4,
    borderBottomWidth: 4,
    borderRightColor: '#0A0A0A',
    borderBottomColor: '#0A0A0A',
    borderRadius: 8,
    borderColor: C.black,
  },
  dateDay: { fontSize: 22, fontWeight: '400', color: C.white },
  dateMonth: { fontSize: 9, fontWeight: '400', color: C.white, marginTop: -2 },
  holidayName: { fontSize: 15, fontWeight: '400', color: C.black },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  typePill: {
    borderWidth: 2,
    borderRightWidth: 4,
    borderBottomWidth: 4,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  typePillText: { fontSize: 9, fontWeight: '400' },
  weekday: {
    fontSize: 11,
    color: C.black,
    fontWeight: '400',
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderRightWidth: 4,
    borderBottomWidth: 4,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 1,
    overflow: 'hidden',
  },
  desc: { fontSize: 11, color: C.textMuted, marginTop: 4 },
  cardActions: { flexDirection: 'column', gap: 6, marginLeft: 8 },
  editBtn: {
    width: 30,
    height: 30,
    borderWidth: 2,
    borderColor: C.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteBtn: {
    width: 30,
    height: 30,
    borderWidth: 2,
    borderColor: C.danger,
    alignItems: 'center',
    justifyContent: 'center',
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
  fieldLabel: {
    fontSize: 12,
    fontWeight: '400',
    textTransform: 'uppercase',
    color: C.black,
    marginBottom: 5,
    letterSpacing: 0.5,
  },
  fieldInput: {
    borderWidth: 2,
    borderRadius: 8,
    borderRightWidth: 5,
    borderBottomWidth: 5,
    borderRightColor: '#0A0A0A',
    borderBottomColor: '#0A0A0A',
    borderColor: C.black,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 14,
    fontWeight: '400',
    color: C.black,
    backgroundColor: C.white,
  },
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
  selChipText: { fontSize: 11, fontWeight: '400', color: C.black },
  submitBtn: {
    backgroundColor: C.primary,
    borderWidth: 2,
    borderRadius: 8,
    borderRightWidth: 5,
    borderBottomWidth: 5,
    borderRightColor: '#0A0A0A',
    borderBottomColor: '#0A0A0A',
    borderColor: C.black,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,
  },
  submitBtnText: {
    color: C.white,
    fontWeight: '400',
    fontSize: 14,
    textTransform: 'uppercase',
  },
});

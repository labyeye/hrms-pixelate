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
} from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { holidayAPI } from '../api/api';
import { C } from '../theme';

const TYPE_COLOR: Record<string, string> = {
  national: C.primary,
  regional: C.secondary,
  optional: C.warning,
  religious: C.success,
};

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

  const load = useCallback(async () => {
    try {
      const res = await holidayAPI.getAll();
      setHolidays(res.data || []);
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

  const openCreate = () => {
    setEditingHoliday(null);
    setForm(EMPTY_FORM);
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
        <TouchableOpacity style={styles.addBtn} onPress={openCreate}>
          <Plus size={14} color={C.white} />
          <Text style={styles.addBtnText}>Add</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={C.primary} />
        </View>
      ) : (
        <FlatList
          data={holidays.sort(
            (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
          )}
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
              <Sun size={40} color="#D1D5DB" />
              <Text style={styles.emptyText}>No holidays added</Text>
            </View>
          }
          renderItem={({ item }) => {
            const color = TYPE_COLOR[item.type] || C.textMuted;
            const d = new Date(item.date);
            const isPast = d < new Date();
            return (
              <View style={[styles.card, isPast && { opacity: 0.6 }]}>
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
                  {item.description && (
                    <Text style={styles.desc} numberOfLines={1}>
                      {item.description}
                    </Text>
                  )}
                </View>
                <View style={styles.cardActions}>
                  <TouchableOpacity
                    onPress={() => openEdit(item)}
                    style={styles.editBtn}
                  >
                    <Edit2 size={13} color={C.primary} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleDelete(item)}
                    style={styles.deleteBtn}
                  >
                    <Trash2 size={13} color={C.danger} />
                  </TouchableOpacity>
                </View>
              </View>
            );
          }}
        />
      )}

      <Modal
        visible={showForm}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <SafeAreaView style={styles.safe} edges={['top']}>
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
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
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
  headerTitle: { fontSize: 20, fontWeight: '700', color: C.black },
  countBadge: {
    backgroundColor: C.success + '20',
    borderWidth: 1,
    borderColor: C.success,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  countText: { fontSize: 10, fontWeight: '700', color: C.success },
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
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyText: { fontSize: 14, fontWeight: '700', color: C.textMuted },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.white,
    borderWidth: 2,
    borderColor: C.black,
    padding: 14,
  },
  dateBadge: {
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: C.black,
  },
  dateDay: { fontSize: 22, fontWeight: '700', color: C.white },
  dateMonth: { fontSize: 9, fontWeight: '700', color: C.white, marginTop: -2 },
  holidayName: { fontSize: 15, fontWeight: '700', color: C.black },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  typePill: { borderWidth: 1, paddingHorizontal: 6, paddingVertical: 2 },
  typePillText: { fontSize: 9, fontWeight: '700' },
  weekday: { fontSize: 11, color: C.textMuted, fontWeight: '500' },
  desc: { fontSize: 11, color: C.textMuted, marginTop: 4 },
  cardActions: { flexDirection: 'column', gap: 6, marginLeft: 8 },
  editBtn: {
    width: 30,
    height: 30,
    borderWidth: 1,
    borderColor: C.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteBtn: {
    width: 30,
    height: 30,
    borderWidth: 1,
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
  modalTitle: { fontSize: 20, fontWeight: '700', color: C.black },
  fieldLabel: {
    fontSize: 10,
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
  selChipText: { fontSize: 11, fontWeight: '700', color: C.black },
  submitBtn: {
    backgroundColor: C.primary,
    borderWidth: 2,
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
    fontWeight: '700',
    fontSize: 14,
    textTransform: 'uppercase',
  },
});

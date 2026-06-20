import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TimePickerField } from '../components/common/DatePickerField';
import {
  Clock,
  Plus,
  Trash2,
  Edit2,
  X,
  Check,
  ChevronLeft,
} from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { shiftAPI } from '../api/api';
import { C } from '../theme';

const EMPTY_FORM = {
  name: '',
  startTime: '09:00',
  endTime: '18:00',
  breakMinutes: '30',
  workingHours: '8',
  otAfter: '9',
};

export default function ShiftsScreen() {
  const navigation = useNavigation<any>();
  const [shifts, setShifts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await shiftAPI.getAll();
      setShifts(r.data || []);
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
    setEditing(null);
    setForm(EMPTY_FORM);
    setModal(true);
  };
  const openEdit = (s: any) => {
    setEditing(s);
    setForm({
      name: s.name || '',
      startTime: s.startTime || '09:00',
      endTime: s.endTime || '18:00',
      breakMinutes: String(s.breakMinutes ?? 30),
      workingHours: String(s.workingHours ?? 8),
      otAfter: String(s.otAfter ?? 9),
    });
    setModal(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      Alert.alert('Validation', 'Shift name is required');
      return;
    }
    setSaving(true);
    try {
      const body = {
        ...form,
        breakMinutes: Number(form.breakMinutes),
        workingHours: Number(form.workingHours),
        otAfter: Number(form.otAfter),
      };
      if (editing) await shiftAPI.update(editing._id, body);
      else await shiftAPI.create(body);
      setModal(false);
      await load();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (s: any) => {
    Alert.alert('Delete Shift', `Remove "${s.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await shiftAPI.delete(s._id);
            await load();
          } catch (e: any) {
            Alert.alert('Error', e.message);
          }
        },
      },
    ]);
  };

  const F = (label: string, key: keyof typeof EMPTY_FORM, props: any = {}) => (
    <View>
      <Text style={s.fieldLabel}>{label}</Text>
      <TextInput
        style={s.fieldInput}
        value={form[key]}
        onChangeText={v => setForm(p => ({ ...p, [key]: v }))}
        placeholderTextColor={C.textLight}
        {...props}
      />
    </View>
  );

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={{ padding: 4, marginRight: 4 }}
        >
          <ChevronLeft size={22} color={C.black} />
        </TouchableOpacity>
        <Clock size={20} color={C.primary} />
        <Text style={s.title}>Shift Timings</Text>
        <View style={{ flex: 1 }} />
        <TouchableOpacity style={s.addBtn} onPress={openCreate}>
          <Plus size={14} color={C.white} />
          <Text style={s.addBtnText}>Add Shift</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={s.loader}>
          <ActivityIndicator size="large" color={C.primary} />
        </View>
      ) : (
        <FlatList
          data={shifts}
          keyExtractor={i => i._id}
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
            <View style={s.empty}>
              <Clock size={40} color="#D1D5DB" />
              <Text style={s.emptyText}>No shifts created yet</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={s.card}>
              <View style={s.cardIconWrap}>
                <Clock size={20} color={C.primary} />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={s.shiftName}>{item.name}</Text>
                <Text style={s.shiftTime}>
                  {item.startTime} – {item.endTime}
                </Text>
                <View style={s.pillRow}>
                  <View style={s.pill}>
                    <Text style={s.pillText}>
                      Break: {item.breakMinutes ?? 30} min
                    </Text>
                  </View>
                  <View style={s.pill}>
                    <Text style={s.pillText}>
                      {item.workingHours ?? 8}h working
                    </Text>
                  </View>
                  <View style={s.pill}>
                    <Text style={s.pillText}>
                      OT after {item.otAfter ?? 9}h
                    </Text>
                  </View>
                </View>
              </View>
              <View style={{ gap: 6 }}>
                <TouchableOpacity
                  style={s.iconBtn}
                  onPress={() => openEdit(item)}
                >
                  <Edit2 size={13} color={C.primary} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.iconBtn, { borderColor: C.danger }]}
                  onPress={() => handleDelete(item)}
                >
                  <Trash2 size={13} color={C.danger} />
                </TouchableOpacity>
              </View>
            </View>
          )}
        />
      )}

      <Modal
        visible={modal}
        animationType="slide"
        presentationStyle="formSheet"
      >
        <SafeAreaView style={s.safe} edges={['top']}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>
              {editing ? 'Edit Shift' : 'New Shift'}
            </Text>
            <TouchableOpacity onPress={() => setModal(false)}>
              <X size={22} color={C.black} />
            </TouchableOpacity>
          </View>
          <ScrollView
            contentContainerStyle={{ padding: 20, gap: 16 }}
            keyboardShouldPersistTaps="handled"
          >
            {F('Shift Name *', 'name', { placeholder: 'e.g. Morning Shift' })}
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <TimePickerField
                  label="Start Time *"
                  value={form.startTime}
                  onChange={v => setForm(p => ({ ...p, startTime: v }))}
                />
              </View>
              <View style={{ flex: 1 }}>
                <TimePickerField
                  label="End Time *"
                  value={form.endTime}
                  onChange={v => setForm(p => ({ ...p, endTime: v }))}
                />
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ flex: 1 }}>
                {F('Break (min)', 'breakMinutes', {
                  keyboardType: 'numeric',
                  placeholder: '30',
                })}
              </View>
              <View style={{ flex: 1 }}>
                {F('Working Hours', 'workingHours', {
                  keyboardType: 'numeric',
                  placeholder: '8',
                })}
              </View>
            </View>
            {F('OT After (hours)', 'otAfter', {
              keyboardType: 'numeric',
              placeholder: '9',
            })}
            <TouchableOpacity
              style={s.submitBtn}
              onPress={handleSave}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color={C.white} />
              ) : (
                <>
                  <Check size={16} color={C.white} />
                  <Text style={s.submitBtnText}>
                    {editing ? 'Update Shift' : 'Create Shift'}
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

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F8F9FA' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: C.white,
    borderBottomWidth: 2,
    borderBottomColor: C.black,
  },
  title: { fontSize: 20, fontWeight: '700', color: C.black },
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
    alignItems: 'flex-start',
    backgroundColor: C.white,
    borderWidth: 2,
    borderColor: C.black,
    padding: 14,
  },
  cardIconWrap: {
    width: 40,
    height: 40,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shiftName: { fontSize: 15, fontWeight: '700', color: C.black },
  shiftTime: {
    fontSize: 13,
    fontWeight: '700',
    color: C.primary,
    marginTop: 2,
  },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  pill: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  pillText: { fontSize: 10, fontWeight: '700', color: C.black },
  iconBtn: {
    width: 30,
    height: 30,
    borderWidth: 2,
    borderColor: C.primary,
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
    marginBottom: 6,
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

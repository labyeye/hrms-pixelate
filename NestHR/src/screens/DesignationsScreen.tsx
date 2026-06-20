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
import {
  Briefcase,
  Plus,
  Trash2,
  Edit2,
  X,
  Check,
  ChevronLeft,
} from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { designationAPI, departmentAPI } from '../api/api';
import { C } from '../theme';

const EMPTY = { title: '', department: '', description: '', level: '' };

export default function DesignationsScreen() {
  const navigation = useNavigation<any>();
  const [designations, setDesignations] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<any>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [deptPicker, setDeptPicker] = useState(false);

  const load = useCallback(async () => {
    try {
      const [dr, dd] = await Promise.all([
        designationAPI.getAll(),
        departmentAPI.getAll(),
      ]);
      setDesignations(dr.data || []);
      setDepartments(dd.data || []);
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
    setForm(EMPTY);
    setModal(true);
  };
  const openEdit = (d: any) => {
    setEditing(d);
    setForm({
      title: d.title || '',
      department: d.department || '',
      description: d.description || '',
      level: String(d.level ?? ''),
    });
    setModal(true);
  };

  const handleSave = async () => {
    if (!form.title.trim()) {
      Alert.alert('Validation', 'Designation title is required');
      return;
    }
    setSaving(true);
    try {
      const body = {
        ...form,
        level: form.level ? Number(form.level) : undefined,
      };
      if (editing) await designationAPI.update(editing._id, body);
      else await designationAPI.create(body);
      setModal(false);
      await load();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (d: any) => {
    Alert.alert('Delete', `Remove "${d.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await designationAPI.delete(d._id);
            await load();
          } catch (e: any) {
            Alert.alert('Error', e.message);
          }
        },
      },
    ]);
  };

  const deptName = (id: string) =>
    departments.find(d => d._id === id)?.name || id;

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={{ padding: 4, marginRight: 4 }}
        >
          <ChevronLeft size={22} color={C.black} />
        </TouchableOpacity>
        <Briefcase size={20} color={C.primary} />
        <Text style={s.title}>Designations</Text>
        <View style={{ flex: 1 }} />
        <TouchableOpacity style={s.addBtn} onPress={openCreate}>
          <Plus size={14} color={C.white} />
          <Text style={s.addBtnText}>Add</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={s.loader}>
          <ActivityIndicator size="large" color={C.primary} />
        </View>
      ) : (
        <FlatList
          data={designations}
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
              <Briefcase size={40} color="#D1D5DB" />
              <Text style={s.emptyText}>No designations</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={s.card}>
              <View style={s.cardIcon}>
                <Briefcase size={18} color={C.primary} />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={s.desigTitle}>{item.title}</Text>
                {item.department && (
                  <Text style={s.desigSub}>{deptName(item.department)}</Text>
                )}
                {item.description ? (
                  <Text style={s.desigDesc} numberOfLines={1}>
                    {item.description}
                  </Text>
                ) : null}
                {item.level != null && (
                  <View style={s.levelBadge}>
                    <Text style={s.levelText}>Level {item.level}</Text>
                  </View>
                )}
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
              {editing ? 'Edit Designation' : 'New Designation'}
            </Text>
            <TouchableOpacity onPress={() => setModal(false)}>
              <X size={22} color={C.black} />
            </TouchableOpacity>
          </View>
          <ScrollView
            contentContainerStyle={{ padding: 20, gap: 16 }}
            keyboardShouldPersistTaps="handled"
          >
            <View>
              <Text style={s.fieldLabel}>Title *</Text>
              <TextInput
                style={s.fieldInput}
                value={form.title}
                onChangeText={v => setForm((p: any) => ({ ...p, title: v }))}
                placeholder="e.g. Senior Engineer, HR Manager"
                placeholderTextColor={C.textLight}
              />
            </View>

            <View>
              <Text style={s.fieldLabel}>Department</Text>
              <TouchableOpacity
                style={[s.fieldInput, { justifyContent: 'center' }]}
                onPress={() => setDeptPicker(true)}
              >
                <Text
                  style={{
                    color: form.department ? C.black : C.textLight,
                    fontSize: 14,
                    fontWeight: '500',
                  }}
                >
                  {form.department
                    ? deptName(form.department)
                    : 'Select department'}
                </Text>
              </TouchableOpacity>
            </View>

            <View>
              <Text style={s.fieldLabel}>Level (numeric)</Text>
              <TextInput
                style={s.fieldInput}
                value={form.level}
                onChangeText={v => setForm((p: any) => ({ ...p, level: v }))}
                keyboardType="numeric"
                placeholder="e.g. 1, 2, 3"
                placeholderTextColor={C.textLight}
              />
            </View>

            <View>
              <Text style={s.fieldLabel}>Description</Text>
              <TextInput
                style={[
                  s.fieldInput,
                  { minHeight: 80, textAlignVertical: 'top' },
                ]}
                value={form.description}
                onChangeText={v =>
                  setForm((p: any) => ({ ...p, description: v }))
                }
                placeholder="Optional role description"
                placeholderTextColor={C.textLight}
                multiline
              />
            </View>

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
                    {editing ? 'Update' : 'Create'} Designation
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Department Picker */}
      <Modal
        visible={deptPicker}
        animationType="slide"
        presentationStyle="formSheet"
      >
        <SafeAreaView style={s.safe} edges={['top']}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>Select Department</Text>
            <TouchableOpacity onPress={() => setDeptPicker(false)}>
              <X size={22} color={C.black} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: 12, gap: 8 }}>
            <TouchableOpacity
              style={[s.pickerRow, !form.department && s.pickerRowActive]}
              onPress={() => {
                setForm((p: any) => ({ ...p, department: '' }));
                setDeptPicker(false);
              }}
            >
              <Text style={s.pickerText}>— None —</Text>
            </TouchableOpacity>
            {departments.map(d => (
              <TouchableOpacity
                key={d._id}
                style={[
                  s.pickerRow,
                  form.department === d._id && s.pickerRowActive,
                ]}
                onPress={() => {
                  setForm((p: any) => ({ ...p, department: d._id }));
                  setDeptPicker(false);
                }}
              >
                <Text
                  style={[
                    s.pickerText,
                    form.department === d._id && {
                      color: C.primary,
                      fontWeight: '700',
                    },
                  ]}
                >
                  {d.name}
                </Text>
                {form.department === d._id && (
                  <Check size={16} color={C.primary} />
                )}
              </TouchableOpacity>
            ))}
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
  cardIcon: {
    width: 40,
    height: 40,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  desigTitle: { fontSize: 15, fontWeight: '700', color: C.black },
  desigSub: { fontSize: 11, color: C.primary, fontWeight: '700', marginTop: 2 },
  desigDesc: { fontSize: 11, color: C.textMuted, marginTop: 4 },
  levelBadge: {
    marginTop: 6,
    alignSelf: 'flex-start',
    borderWidth: 2,
    borderColor: C.black,
    paddingHorizontal: 8,
    paddingVertical: 2,
    backgroundColor: '#F3F4F6',
  },
  levelText: { fontSize: 9, fontWeight: '700', color: C.black },
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
    fontSize: 12,
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
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    backgroundColor: C.white,
  },
  pickerRowActive: { borderColor: C.primary, backgroundColor: '#EFF6FF' },
  pickerText: { fontSize: 14, fontWeight: '600', color: C.black },
});

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
  Building2,
  Plus,
  X,
  Users,
  Trash2,
  Check,
  ChevronLeft,
  Edit2,
} from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { departmentAPI } from '../api/api';
import { Department } from '../types/hrms';
import { C } from '../theme';

const EMPTY_FORM = {
  name: '',
  description: '',
  budget: '',
  code: '',
  shiftStartTime: '',
  shiftEndTime: '',
};

export default function DepartmentsScreen() {
  const navigation = useNavigation<any>();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingDept, setEditingDept] = useState<Department | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const load = useCallback(async () => {
    try {
      const res = await departmentAPI.getAll();
      setDepartments(res.data || []);
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
    setEditingDept(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  };

  const openEdit = (dept: any) => {
    setEditingDept(dept);
    setForm({
      name: dept.name || '',
      description: dept.description || '',
      budget: dept.budget ? String(dept.budget) : '',
      code: dept.code || '',
      shiftStartTime: dept.shiftStartTime || '',
      shiftEndTime: dept.shiftEndTime || '',
    });
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingDept(null);
    setForm(EMPTY_FORM);
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      Alert.alert('Validation', 'Department name is required');
      return;
    }
    setSaving(true);
    try {
      const payload: any = {
        name: form.name,
        description: form.description,
        budget: form.budget ? parseFloat(form.budget) : undefined,
        shiftStartTime: form.shiftStartTime || undefined,
        shiftEndTime: form.shiftEndTime || undefined,
      };
      if (!editingDept) {
        payload.code = form.code || undefined;
      }
      if (editingDept) {
        await departmentAPI.update((editingDept as any)._id, payload);
      } else {
        await departmentAPI.create(payload);
      }
      closeForm();
      await load();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (dept: Department) => {
    Alert.alert('Delete Department', `Remove "${dept.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await departmentAPI.delete(dept._id);
            setDepartments(p => p.filter(d => d._id !== dept._id));
          } catch (e: any) {
            Alert.alert('Error', e.message);
          }
        },
      },
    ]);
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
          <Building2 size={20} color={C.primary} />
          <Text style={styles.headerTitle}>Departments</Text>
          <View style={styles.countBadge}>
            <Text style={styles.countText}>{departments.length}</Text>
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
          data={departments}
          keyExtractor={item => item._id}
          contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 32 }}
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
              <Building2 size={40} color="#D1D5DB" />
              <Text style={styles.emptyText}>No departments</Text>
            </View>
          }
          renderItem={({ item }) => {
            const dept = item as any;
            const manager = dept.manager;
            const empCount = dept.headcount ?? dept.employeeCount ?? 0;
            return (
              <View style={styles.deptCard}>
                <View style={styles.cardTopRow}>
                  <View style={styles.deptIcon}>
                    <Building2 size={20} color={C.white} />
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <View style={styles.nameRow}>
                      <Text style={styles.deptName} numberOfLines={1}>
                        {item.name}
                      </Text>
                      {dept.code ? (
                        <View style={styles.codeBadge}>
                          <Text style={styles.codeText}>{dept.code}</Text>
                        </View>
                      ) : null}
                    </View>
                    {item.description ? (
                      <Text style={styles.deptDesc} numberOfLines={2}>
                        {item.description}
                      </Text>
                    ) : null}
                  </View>
                  <View style={styles.cardActions}>
                    <TouchableOpacity
                      style={styles.editBtn}
                      onPress={() => openEdit(item)}
                    >
                      <Edit2 size={13} color={C.primary} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.deleteBtn}
                      onPress={() => handleDelete(item)}
                    >
                      <Trash2 size={13} color={C.danger} />
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.deptFooter}>
                  <View style={styles.deptMeta}>
                    <Users size={11} color={C.textMuted} />
                    <Text style={styles.deptMetaText}>
                      {empCount} member{empCount !== 1 ? 's' : ''}
                    </Text>
                  </View>
                  {dept.shiftStartTime && dept.shiftEndTime ? (
                    <Text style={styles.shiftText}>
                      {dept.shiftStartTime} – {dept.shiftEndTime}
                    </Text>
                  ) : null}
                  {manager ? (
                    <Text style={styles.deptManager} numberOfLines={1}>
                      Mgr: {manager.firstName} {manager.lastName}
                    </Text>
                  ) : null}
                  {item.budget ? (
                    <Text style={styles.deptBudget}>
                      ₹{(item.budget / 1000).toFixed(0)}K
                    </Text>
                  ) : null}
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
              {editingDept ? 'Edit Department' : 'New Department'}
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
              <Text style={styles.fieldLabel}>Name *</Text>
              <TextInput
                style={styles.fieldInput}
                value={form.name}
                onChangeText={v => setForm(p => ({ ...p, name: v }))}
                placeholder="Engineering"
                placeholderTextColor={C.textLight}
              />
            </View>
            {!editingDept && (
              <View>
                <Text style={styles.fieldLabel}>Code *</Text>
                <TextInput
                  style={styles.fieldInput}
                  value={form.code}
                  onChangeText={v => setForm(p => ({ ...p, code: v }))}
                  placeholder="ENG"
                  placeholderTextColor={C.textLight}
                  autoCapitalize="characters"
                />
              </View>
            )}
            <View>
              <Text style={styles.fieldLabel}>Description</Text>
              <TextInput
                style={[styles.fieldInput, { minHeight: 80 }]}
                value={form.description}
                onChangeText={v => setForm(p => ({ ...p, description: v }))}
                placeholder="Department description…"
                placeholderTextColor={C.textLight}
                multiline
              />
            </View>
            <View>
              <Text style={styles.fieldLabel}>Annual Budget (₹)</Text>
              <TextInput
                style={styles.fieldInput}
                value={form.budget}
                onChangeText={v => setForm(p => ({ ...p, budget: v }))}
                placeholder="5000000"
                placeholderTextColor={C.textLight}
                keyboardType="numeric"
              />
            </View>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>Shift Start</Text>
                <TextInput
                  style={styles.fieldInput}
                  value={form.shiftStartTime}
                  onChangeText={v => setForm(p => ({ ...p, shiftStartTime: v }))}
                  placeholder="09:00"
                  placeholderTextColor={C.textLight}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>Shift End</Text>
                <TextInput
                  style={styles.fieldInput}
                  value={form.shiftEndTime}
                  onChangeText={v => setForm(p => ({ ...p, shiftEndTime: v }))}
                  placeholder="18:00"
                  placeholderTextColor={C.textLight}
                />
              </View>
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
                    {editingDept ? 'Save Changes' : 'Create Department'}
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
    backgroundColor: C.primary,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderWidth: 2,
    borderColor: C.black,
  },
  countText: { color: C.white, fontSize: 10, fontWeight: '700' },
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
  deptCard: {
    backgroundColor: C.white,
    borderWidth: 2,
    borderColor: C.black,
    padding: 14,
  },
  cardTopRow: { flexDirection: 'row', alignItems: 'flex-start' },
  deptIcon: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.primary,
    borderWidth: 2,
    borderColor: C.black,
    flexShrink: 0,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  deptName: { fontSize: 15, fontWeight: '700', color: C.black },
  codeBadge: {
    backgroundColor: C.primary + '18',
    borderWidth: 1,
    borderColor: C.primary,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  codeText: { fontSize: 10, fontWeight: '700', color: C.primary },
  deptDesc: { fontSize: 11, color: C.textMuted, lineHeight: 16, marginTop: 4 },
  cardActions: { flexDirection: 'row', gap: 6, marginLeft: 8 },
  editBtn: {
    width: 28,
    height: 28,
    borderWidth: 1,
    borderColor: C.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteBtn: {
    width: 28,
    height: 28,
    borderWidth: 1,
    borderColor: C.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deptFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  deptMeta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  deptMetaText: { fontSize: 12, fontWeight: '700', color: C.textMuted },
  shiftText: { fontSize: 11, fontWeight: '600', color: C.textMuted },
  deptManager: { fontSize: 11, color: C.textMuted },
  deptBudget: { fontSize: 11, fontWeight: '700', color: C.success },
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

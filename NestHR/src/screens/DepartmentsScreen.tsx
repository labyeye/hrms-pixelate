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
} from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { departmentAPI } from '../api/api';
import { Department } from '../types/hrms';
import { C } from '../theme';

export default function DepartmentsScreen() {
  const navigation = useNavigation<any>();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', budget: '' });

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

  const handleCreate = async () => {
    if (!form.name.trim()) {
      Alert.alert('Validation', 'Department name is required');
      return;
    }
    setSaving(true);
    try {
      await departmentAPI.create({
        ...form,
        budget: form.budget ? parseFloat(form.budget) : undefined,
      });
      setShowForm(false);
      setForm({ name: '', description: '', budget: '' });
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
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => setShowForm(true)}
        >
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
          numColumns={2}
          columnWrapperStyle={{ gap: 12 }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Building2 size={40} color="#D1D5DB" />
              <Text style={styles.emptyText}>No departments</Text>
            </View>
          }
          renderItem={({ item }) => {
            const dept = item as any;
            const manager = dept.manager;
            const empCount = dept.employeeCount || 0;
            return (
              <View style={styles.deptCard}>
                <View style={styles.deptIcon}>
                  <Building2 size={20} color={C.white} />
                </View>
                <Text style={styles.deptName} numberOfLines={1}>
                  {item.name}
                </Text>
                {item.description && (
                  <Text style={styles.deptDesc} numberOfLines={2}>
                    {item.description}
                  </Text>
                )}
                <View style={styles.deptMeta}>
                  <Users size={11} color={C.textMuted} />
                  <Text style={styles.deptMetaText}>
                    {empCount} member{empCount !== 1 ? 's' : ''}
                  </Text>
                </View>
                {manager && (
                  <Text style={styles.deptManager} numberOfLines={1}>
                    Manager: {manager.firstName} {manager.lastName}
                  </Text>
                )}
                {item.budget && (
                  <Text style={styles.deptBudget}>
                    Budget: ₹{(item.budget / 1000).toFixed(0)}K
                  </Text>
                )}
                <TouchableOpacity
                  style={styles.deleteBtn}
                  onPress={() => handleDelete(item)}
                >
                  <Trash2 size={13} color={C.danger} />
                </TouchableOpacity>
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
            <Text style={styles.modalTitle}>New Department</Text>
            <TouchableOpacity onPress={() => setShowForm(false)}>
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
            <TouchableOpacity
              style={styles.submitBtn}
              onPress={handleCreate}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color={C.white} />
              ) : (
                <>
                  <Check size={16} color={C.white} />
                  <Text style={styles.submitBtnText}>Create Department</Text>
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
    flex: 1,
    backgroundColor: C.white,
    borderWidth: 2,
    borderColor: C.black,
    padding: 14,
  },
  deptIcon: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    backgroundColor: C.primary,
    borderWidth: 2,
    borderColor: C.black,
  },
  deptName: { fontSize: 15, fontWeight: '700', color: C.black },
  deptDesc: { fontSize: 11, color: C.textMuted, lineHeight: 16, marginTop: 4 },
  deptMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 10,
  },
  deptMetaText: { fontSize: 12, fontWeight: '700', color: C.textMuted },
  deptManager: { fontSize: 11, color: C.textMuted, marginTop: 4 },
  deptBudget: {
    fontSize: 11,
    fontWeight: '700',
    color: C.success,
    marginTop: 2,
  },
  deleteBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 26,
    height: 26,
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

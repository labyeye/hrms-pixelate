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
  IndianRupee,
  Plus,
  Trash2,
  Edit2,
  X,
  Check,
  ChevronLeft,
} from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { salaryHeadAPI } from '../api/api';
import { C } from '../theme';

const TYPES = ['Earning', 'Deduction', 'Variable'];
const CALC_METHODS = [
  { key: 'fixed', label: 'Fixed Amount' },
  { key: 'percent_of_basic', label: '% of Basic' },
  { key: 'percent_of_gross', label: '% of Gross' },
];
const EMPTY = {
  name: '',
  type: 'Earning',
  calcMethod: 'fixed',
  amount: '',
  taxable: false,
};

const TYPE_COLOR: Record<string, string> = {
  Earning: C.success,
  Deduction: C.danger,
  Variable: C.warning,
};

export default function SalaryHeadsScreen() {
  const navigation = useNavigation<any>();
  const [heads, setHeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<any>(EMPTY);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await salaryHeadAPI.getAll();
      setHeads(r.data || []);
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
  const openEdit = (h: any) => {
    setEditing(h);
    setForm({
      name: h.name || '',
      type: h.type || 'Earning',
      calcMethod: h.calcMethod || 'fixed',
      amount: String(h.amount ?? ''),
      taxable: !!h.taxable,
    });
    setModal(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      Alert.alert('Validation', 'Component name is required');
      return;
    }
    setSaving(true);
    try {
      const body = { ...form, amount: Number(form.amount) || 0 };
      if (editing) await salaryHeadAPI.update(editing._id, body);
      else await salaryHeadAPI.create(body);
      setModal(false);
      await load();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (h: any) => {
    Alert.alert('Delete', `Remove "${h.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await salaryHeadAPI.delete(h._id);
            await load();
          } catch (e: any) {
            Alert.alert('Error', e.message);
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={{ padding: 4, marginRight: 4 }}
        >
          <ChevronLeft size={22} color={C.black} />
        </TouchableOpacity>
        <IndianRupee size={20} color={C.primary} />
        <Text style={s.title}>Salary Components</Text>
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
          data={heads}
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
              <IndianRupee size={40} color="#D1D5DB" />
              <Text style={s.emptyText}>No salary components</Text>
            </View>
          }
          renderItem={({ item }) => {
            const tc = TYPE_COLOR[item.type] || C.textMuted;
            return (
              <View style={s.card}>
                <View style={{ flex: 1 }}>
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 8,
                      marginBottom: 4,
                    }}
                  >
                    <Text style={s.headName}>{item.name}</Text>
                    <View
                      style={[
                        s.typeBadge,
                        { backgroundColor: tc + '20', borderColor: tc },
                      ]}
                    >
                      <Text style={[s.typeBadgeText, { color: tc }]}>
                        {item.type}
                      </Text>
                    </View>
                    {item.taxable && (
                      <View style={s.taxBadge}>
                        <Text style={s.taxBadgeText}>TAXABLE</Text>
                      </View>
                    )}
                  </View>
                  <Text style={s.headSub}>
                    {CALC_METHODS.find(m => m.key === item.calcMethod)?.label ||
                      item.calcMethod}{' '}
                    ·{' '}
                    {item.calcMethod === 'fixed'
                      ? `₹${item.amount || 0}`
                      : `${item.amount || 0}%`}
                  </Text>
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
            );
          }}
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
              {editing ? 'Edit Component' : 'New Component'}
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
              <Text style={s.fieldLabel}>Component Name *</Text>
              <TextInput
                style={s.fieldInput}
                value={form.name}
                onChangeText={v => setForm((p: any) => ({ ...p, name: v }))}
                placeholder="e.g. HRA, PF, Medical Allowance"
                placeholderTextColor={C.textLight}
              />
            </View>

            <View>
              <Text style={s.fieldLabel}>Type *</Text>
              <View
                style={{
                  flexDirection: 'row',
                  gap: 8,
                  flexWrap: 'wrap',
                  marginTop: 4,
                }}
              >
                {TYPES.map(t => (
                  <TouchableOpacity
                    key={t}
                    style={[
                      s.chip,
                      form.type === t && {
                        backgroundColor: TYPE_COLOR[t],
                        borderColor: TYPE_COLOR[t],
                      },
                    ]}
                    onPress={() => setForm((p: any) => ({ ...p, type: t }))}
                  >
                    <Text
                      style={[
                        s.chipText,
                        form.type === t && { color: C.white },
                      ]}
                    >
                      {t}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View>
              <Text style={s.fieldLabel}>Calculation Method</Text>
              <View style={{ gap: 6, marginTop: 4 }}>
                {CALC_METHODS.map(m => (
                  <TouchableOpacity
                    key={m.key}
                    style={[
                      s.radioRow,
                      form.calcMethod === m.key && s.radioRowActive,
                    ]}
                    onPress={() =>
                      setForm((p: any) => ({ ...p, calcMethod: m.key }))
                    }
                  >
                    <View
                      style={[
                        s.radioCircle,
                        form.calcMethod === m.key && s.radioCircleActive,
                      ]}
                    />
                    <Text
                      style={[
                        s.radioText,
                        form.calcMethod === m.key && {
                          color: C.primary,
                          fontWeight: '700',
                        },
                      ]}
                    >
                      {m.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View>
              <Text style={s.fieldLabel}>
                {form.calcMethod === 'fixed' ? 'Amount (₹)' : 'Percentage (%)'}
              </Text>
              <TextInput
                style={s.fieldInput}
                value={form.amount}
                onChangeText={v => setForm((p: any) => ({ ...p, amount: v }))}
                keyboardType="numeric"
                placeholder={form.calcMethod === 'fixed' ? '5000' : '12'}
                placeholderTextColor={C.textLight}
              />
            </View>

            <TouchableOpacity
              style={[s.checkRow, form.taxable && s.checkRowActive]}
              onPress={() =>
                setForm((p: any) => ({ ...p, taxable: !p.taxable }))
              }
            >
              <View style={[s.checkbox, form.taxable && s.checkboxActive]}>
                {form.taxable && <Check size={12} color={C.white} />}
              </View>
              <Text style={[s.checkText, form.taxable && { color: C.primary }]}>
                Taxable Component
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={s.submitBtn}
              onPress={handleSave}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color={C.white} />
              ) : (
                <Text style={s.submitBtnText}>
                  {editing ? 'Update Component' : 'Create Component'}
                </Text>
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
  headName: { fontSize: 15, fontWeight: '700', color: C.black },
  headSub: { fontSize: 12, color: C.textMuted, fontWeight: '500' },
  typeBadge: { borderWidth: 2, paddingHorizontal: 6, paddingVertical: 1 },
  typeBadgeText: { fontSize: 9, fontWeight: '700' },
  taxBadge: {
    backgroundColor: '#FEF9C3',
    borderWidth: 1,
    borderColor: '#CA8A04',
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  taxBadgeText: { fontSize: 8, fontWeight: '700', color: '#92400E' },
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
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderWidth: 2,
    borderColor: C.black,
  },
  chipText: { fontSize: 11, fontWeight: '700', color: C.black },
  radioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    backgroundColor: C.white,
  },
  radioRowActive: { borderColor: C.primary, backgroundColor: '#EFF6FF' },
  radioCircle: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#9CA3AF',
  },
  radioCircleActive: { borderColor: C.primary, backgroundColor: C.primary },
  radioText: { fontSize: 13, fontWeight: '600', color: C.black },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    backgroundColor: C.white,
  },
  checkRowActive: { borderColor: C.primary, backgroundColor: '#EFF6FF' },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderColor: '#9CA3AF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxActive: { backgroundColor: C.primary, borderColor: C.primary },
  checkText: { fontSize: 13, fontWeight: '700', color: C.black },
  submitBtn: {
    backgroundColor: C.primary,
    borderWidth: 2,
    borderColor: C.black,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  submitBtnText: {
    color: C.white,
    fontWeight: '700',
    fontSize: 14,
    textTransform: 'uppercase',
  },
});

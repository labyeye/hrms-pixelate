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
  Linking,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Receipt, Plus, X, ChevronLeft, Paperclip } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import DateTimePicker from '@react-native-community/datetimepicker';
import DocumentPicker, { types } from 'react-native-document-picker';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
import { companyExpenseAPI } from '../api/api';
import { C } from '../theme';
import { CENTER } from '../components/common/centerModal';

// Company spending ledger (admin / HR). Staff claims are on the Reimbursements screen.
const CATEGORIES: [string, string][] = [
  ['rent', 'Rent'],
  ['utilities', 'Utilities'],
  ['salaries_misc', 'Staff welfare'],
  ['marketing', 'Marketing'],
  ['software', 'Software'],
  ['office', 'Office supplies'],
  ['travel', 'Travel'],
  ['maintenance', 'Maintenance'],
  ['taxes_fees', 'Taxes & fees'],
  ['other', 'Other'],
];
const MODES: [string, string][] = [
  ['bank_transfer', 'Bank transfer'],
  ['upi', 'UPI'],
  ['cash', 'Cash'],
  ['cheque', 'Cheque'],
  ['card', 'Card'],
];
const label = (list: [string, string][], k: string) =>
  list.find(x => x[0] === k)?.[1] || k;
const fmt = (n: number) => `₹${Math.round(n || 0).toLocaleString('en-IN')}`;
const toYmd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`;
const EMPTY = {
  title: '',
  category: 'other',
  amount: '',
  date: toYmd(new Date()),
  vendor: '',
  paymentMode: 'bank_transfer',
  reference: '',
  notes: '',
};
type Picked = { uri: string; type: string; name: string };

function Chips({
  options,
  value,
  onPick,
}: {
  options: [string, string][];
  value: string;
  onPick: (v: string) => void;
}) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {options.map(([k, l]) => (
        <TouchableOpacity
          key={k}
          onPress={() => onPick(k)}
          style={[styles.chip, value === k && styles.chipOn]}
        >
          <Text style={[styles.chipText, value === k && { color: C.white }]}>
            {l}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

export default function ExpensesScreen() {
  const navigation = useNavigation<any>();
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [rows, setRows] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>({ total: 0, count: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [form, setForm] = useState<typeof EMPTY | null>(null);
  const [editing, setEditing] = useState<any>(null);
  const [bills, setBills] = useState<Picked[]>([]);
  const [saving, setSaving] = useState(false);
  const [showDate, setShowDate] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await companyExpenseAPI.getAll({
        month: String(month),
        year: String(year),
      });
      setRows(r.data);
      setSummary(r.summary);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [month, year]);
  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  const shiftMonth = (d: number) => {
    const m = month + d;
    if (m < 1) {
      setMonth(12);
      setYear(year - 1);
    } else if (m > 12) {
      setMonth(1);
      setYear(year + 1);
    } else setMonth(m);
  };

  const open = (row?: any) => {
    setEditing(row || null);
    setBills([]);
    setForm(
      row
        ? {
            title: row.title,
            category: row.category,
            amount: String(row.amount),
            date: String(row.date).slice(0, 10),
            vendor: row.vendor || '',
            paymentMode: row.paymentMode,
            reference: row.reference || '',
            notes: row.notes || '',
          }
        : { ...EMPTY },
    );
  };
  const set = (k: keyof typeof EMPTY, v: string) =>
    setForm(f => (f ? { ...f, [k]: v } : f));

  const addAsset = (a?: any) => {
    if (!a?.uri) return;
    setBills(b =>
      b.length >= 5
        ? b
        : [
            ...b,
            {
              uri: a.uri,
              type: a.type || 'image/jpeg',
              name: a.fileName || `bill_${Date.now()}.jpg`,
            },
          ],
    );
  };
  const pickPdf = async () => {
    try {
      const f = await DocumentPicker.pickSingle({
        type: [types.pdf, types.images],
        copyTo: 'cachesDirectory',
        mode: 'import',
      });
      if ((f.size || 0) > 5 * 1024 * 1024)
        return Alert.alert('Too large', 'Each bill must be under 5 MB');
      addAsset({
        uri: f.fileCopyUri || f.uri,
        type: f.type || 'application/pdf',
        name: f.name || `bill_${Date.now()}.pdf`,
        fileName: f.name,
      });
    } catch (e: any) {
      if (!DocumentPicker.isCancel(e)) Alert.alert('Error', e.message);
    }
  };
  const pickBill = () => {
    if (bills.length + (editing?.bills?.length || 0) >= 5)
      return Alert.alert('Limit', 'Up to 5 bills per entry');
    Alert.alert('Add bill', 'Choose a source', [
      {
        text: 'Camera',
        onPress: () =>
          launchCamera({ mediaType: 'photo', quality: 0.8 }, r =>
            addAsset(r.assets?.[0]),
          ),
      },
      {
        text: 'Gallery',
        onPress: () =>
          launchImageLibrary({ mediaType: 'photo', quality: 0.8 }, r =>
            addAsset(r.assets?.[0]),
          ),
      },
      { text: 'PDF / file', onPress: pickPdf },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const save = async () => {
    if (!form) return;
    if (!form.title.trim() || !(Number(form.amount) > 0))
      return Alert.alert('Missing details', 'Enter a title and an amount');
    setSaving(true);
    try {
      await companyExpenseAPI.save(form, bills, editing?._id);
      setForm(null);
      load();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = (row: any) =>
    Alert.alert('Delete expense?', row.title, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await companyExpenseAPI.remove(row._id);
            load();
          } catch (e: any) {
            Alert.alert('Error', e.message);
          }
        },
      },
    ]);

  const openBill = async (id: string, i: number) => {
    try {
      await Linking.openURL(await companyExpenseAPI.billUrl(id, i));
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.rowCenter}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={{ padding: 4, marginRight: 2 }}
            hitSlop={8}
          >
            <ChevronLeft size={22} color={C.black} />
          </TouchableOpacity>
          <Receipt size={20} color={C.primary} />
          <Text style={styles.headerTitle}>Expenses</Text>
        </View>
        <TouchableOpacity onPress={() => open()} hitSlop={8}>
          <Plus size={24} color={C.primary} />
        </TouchableOpacity>
      </View>

      <View style={styles.monthBar}>
        <TouchableOpacity onPress={() => shiftMonth(-1)} hitSlop={10}>
          <ChevronLeft size={20} color={C.black} />
        </TouchableOpacity>
        <Text style={styles.monthText}>
          {new Date(year, month - 1, 1).toLocaleString('en-IN', {
            month: 'long',
            year: 'numeric',
          })}
        </Text>
        <TouchableOpacity
          onPress={() => shiftMonth(1)}
          hitSlop={10}
          style={{ transform: [{ rotate: '180deg' }] }}
        >
          <ChevronLeft size={20} color={C.black} />
        </TouchableOpacity>
      </View>

      <View style={styles.summary}>
        <Text style={styles.sub}>Total this month · {summary.count} entries</Text>
        <Text style={styles.total}>{fmt(summary.total)}</Text>
        <Text style={styles.sub}>
          Company spending. Staff claims are under Reimbursements.
        </Text>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={C.primary} />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={r => r._id}
          contentContainerStyle={{ padding: 16, gap: 10 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                load();
              }}
            />
          }
          ListEmptyComponent={
            <Text style={[styles.sub, { textAlign: 'center', marginTop: 30 }]}>
              No expenses this month
            </Text>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() => open(item)}
              onLongPress={() => remove(item)}
            >
              <View style={styles.rowBetween}>
                <Text style={styles.cardTitle} numberOfLines={1}>
                  {item.title}
                </Text>
                <Text style={styles.cardAmt}>{fmt(item.amount)}</Text>
              </View>
              <Text style={styles.sub}>
                {label(CATEGORIES, item.category)} ·{' '}
                {new Date(item.date).toLocaleDateString('en-IN')} ·{' '}
                {label(MODES, item.paymentMode)}
                {item.vendor ? ` · ${item.vendor}` : ''}
              </Text>
              {item.bills?.length > 0 && (
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                  {item.bills.map((_: string, i: number) => (
                    <TouchableOpacity
                      key={i}
                      style={styles.billBtn}
                      onPress={() => openBill(item._id, i)}
                    >
                      <Paperclip size={12} color={C.primary} />
                      <Text style={styles.billText}>Bill {i + 1}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </TouchableOpacity>
          )}
        />
      )}

      <Modal visible={!!form} transparent animationType="fade">
        <View style={CENTER.overlay}>
          <View style={CENTER.card}>
            <SafeAreaView style={{ flex: 1 }} edges={[]}>
              <View style={[styles.header, { borderBottomWidth: 2 }]}>
                <Text style={styles.headerTitle}>
                  {editing ? 'Edit expense' : 'Add expense'}
                </Text>
                <TouchableOpacity onPress={() => setForm(null)}>
                  <X size={24} color={C.black} />
                </TouchableOpacity>
              </View>
              {form && (
                <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
                  <TextInput
                    style={styles.input}
                    placeholder="Title (e.g. Office rent)"
                    placeholderTextColor="#9CA3AF"
                    maxLength={120}
                    value={form.title}
                    onChangeText={v => set('title', v)}
                  />
                  <TextInput
                    style={styles.input}
                    placeholder="Amount (₹)"
                    placeholderTextColor="#9CA3AF"
                    keyboardType="numeric"
                    value={form.amount}
                    onChangeText={v => set('amount', v)}
                  />
                  <TouchableOpacity
                    style={styles.input}
                    onPress={() => setShowDate(true)}
                  >
                    <Text style={{ color: C.black, fontSize: 14 }}>
                      {new Date(form.date + 'T00:00:00').toLocaleDateString(
                        'en-IN',
                      )}
                    </Text>
                  </TouchableOpacity>
                  {showDate && (
                    <DateTimePicker
                      value={new Date(form.date + 'T00:00:00')}
                      mode="date"
                      display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                      onChange={(e: any, d?: Date) => {
                        if (Platform.OS !== 'ios') setShowDate(false);
                        if (e.type !== 'dismissed' && d) set('date', toYmd(d));
                      }}
                    />
                  )}
                  {showDate && Platform.OS === 'ios' && (
                    <TouchableOpacity
                      onPress={() => setShowDate(false)}
                      style={{ alignSelf: 'flex-end', padding: 6 }}
                    >
                      <Text style={{ color: C.primary }}>Done</Text>
                    </TouchableOpacity>
                  )}
                  <Text style={styles.label}>Category</Text>
                  <Chips
                    options={CATEGORIES}
                    value={form.category}
                    onPick={v => set('category', v)}
                  />
                  <Text style={styles.label}>Paid via</Text>
                  <Chips
                    options={MODES}
                    value={form.paymentMode}
                    onPick={v => set('paymentMode', v)}
                  />
                  <TextInput
                    style={styles.input}
                    placeholder="Vendor"
                    placeholderTextColor="#9CA3AF"
                    value={form.vendor}
                    onChangeText={v => set('vendor', v)}
                  />
                  <TextInput
                    style={styles.input}
                    placeholder="Reference / Txn ID"
                    placeholderTextColor="#9CA3AF"
                    value={form.reference}
                    onChangeText={v => set('reference', v)}
                  />
                  <TextInput
                    style={[styles.input, { height: 70 }]}
                    placeholder="Notes"
                    placeholderTextColor="#9CA3AF"
                    multiline
                    maxLength={500}
                    value={form.notes}
                    onChangeText={v => set('notes', v)}
                  />
                  <Text style={styles.label}>Bills (up to 5)</Text>
                  {editing?.bills?.length > 0 && (
                    <Text style={styles.sub}>
                      {editing.bills.length} bill(s) already attached; new ones
                      are added.
                    </Text>
                  )}
                  {bills.map((b, i) => (
                    <View key={i} style={styles.billRow}>
                      <Text style={{ flex: 1 }} numberOfLines={1}>
                        {b.name}
                      </Text>
                      <TouchableOpacity
                        onPress={() => setBills(bills.filter((_, j) => j !== i))}
                      >
                        <X size={16} color={C.danger} />
                      </TouchableOpacity>
                    </View>
                  ))}
                  <TouchableOpacity style={styles.addBill} onPress={pickBill}>
                    <Paperclip size={16} color={C.primary} />
                    <Text style={{ color: C.primary }}>Attach bill</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.saveBtn, saving && { opacity: 0.6 }]}
                    disabled={saving}
                    onPress={save}
                  >
                    {saving ? (
                      <ActivityIndicator color={C.white} />
                    ) : (
                      <Text style={styles.saveText}>
                        {editing ? 'Save changes' : 'Add expense'}
                      </Text>
                    )}
                  </TouchableOpacity>
                  {editing && (
                    <TouchableOpacity
                      onPress={() => {
                        setForm(null);
                        remove(editing);
                      }}
                    >
                      <Text
                        style={{
                          color: C.danger,
                          textAlign: 'center',
                          padding: 8,
                        }}
                      >
                        Delete expense
                      </Text>
                    </TouchableOpacity>
                  )}
                </ScrollView>
              )}
            </SafeAreaView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
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
  headerTitle: { fontSize: 20, fontWeight: '400', color: C.black, marginLeft: 8 },
  rowCenter: { flexDirection: 'row', alignItems: 'center' },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  monthBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  monthText: { fontSize: 15, color: C.black },
  summary: {
    marginHorizontal: 16,
    padding: 14,
    backgroundColor: C.white,
    borderWidth: 2,
    borderColor: C.black,
    borderRadius: 8,
  },
  total: { fontSize: 26, color: C.black, marginVertical: 2 },
  sub: { fontSize: 12, color: '#6B7280' },
  card: {
    backgroundColor: C.white,
    borderWidth: 2,
    borderColor: C.black,
    borderRadius: 8,
    padding: 12,
  },
  cardTitle: { fontSize: 15, color: C.black, flex: 1, marginRight: 8 },
  cardAmt: { fontSize: 15, color: C.black, fontWeight: '600' },
  billBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: C.primary,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  billText: { fontSize: 12, color: C.primary },
  input: {
    borderWidth: 2,
    borderColor: C.black,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: C.black,
    backgroundColor: C.white,
  },
  label: { fontSize: 12, color: C.black, marginBottom: -4 },
  chip: {
    borderWidth: 1.5,
    borderColor: C.black,
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: C.white,
  },
  chipOn: { backgroundColor: C.primary },
  chipText: { fontSize: 12, color: C.black },
  billRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 6,
    padding: 8,
  },
  addBill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: C.primary,
    borderRadius: 8,
    padding: 10,
  },
  saveBtn: {
    backgroundColor: C.primary,
    borderWidth: 2,
    borderColor: C.black,
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  saveText: { color: C.white, fontSize: 15 },
});

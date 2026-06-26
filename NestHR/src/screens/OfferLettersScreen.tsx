import React, { useState, useCallback } from 'react';
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
import { useFocusEffect } from '@react-navigation/native';
import { DatePickerField } from '../components/common/DatePickerField';
import {
  FileText,
  Plus,
  Trash2,
  Eye,
  X,
  Send,
  ChevronLeft,
  Pencil,
  CheckCircle2,
  XCircle,
  Clock,
} from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { offerLetterAPI, employeeAPI, companyAPI } from '../api/api';
import { useAuth } from '../contexts/AuthContext';
import { C } from '../theme';
import RNPrint from 'react-native-print';

const STATUS_CONFIG: Record<string, { color: string; bg: string; label: string }> = {
  draft: { color: '#6B7280', bg: '#F9FAFB', label: 'Draft' },
  sent: { color: C.primary, bg: '#EFF6FF', label: 'Sent' },
  accepted: { color: C.success, bg: '#F0FDF4', label: 'Accepted' },
  rejected: { color: C.danger, bg: '#FEF2F2', label: 'Rejected' },
  expired: { color: C.warning, bg: '#FFF7ED', label: 'Expired' },
};

const EMP_TYPES = ['Full-time', 'Part-time', 'Contract', 'Internship', 'Freelance'];

const EMPTY_FORM = {
  candidateName: '',
  candidateEmail: '',
  designation: '',
  department: '',
  joiningDate: '',
  employmentType: 'Full-time',
  ctc: '',
  location: '',
  validityDays: '7',
};

function buildOfferLetterHTML(data: any): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<style>
  body { font-family: Arial, sans-serif; margin: 40px; color: #111; font-size: 13px; }
  h1 { font-size: 22px; font-weight: 900; border-bottom: 3px solid #024BAB; padding-bottom: 8px; margin-bottom: 20px; }
  .header { display: flex; justify-content: space-between; margin-bottom: 30px; }
  .company { font-weight: 900; font-size: 16px; color: #024BAB; }
  .date { color: #666; }
  table { width: 100%; border-collapse: collapse; margin-top: 16px; }
  th { background: #024BAB; color: white; padding: 8px 10px; text-align: left; font-size: 11px; text-transform: uppercase; }
  td { padding: 8px 10px; border-bottom: 1px solid #eee; font-size: 13px; }
  .footer { margin-top: 40px; border-top: 2px solid #024BAB; padding-top: 20px; }
  .sig-line { margin-top: 50px; border-top: 1px solid #333; width: 200px; font-size: 10px; color: #666; padding-top: 4px; }
</style>
</head>
<body>
<div class="header">
  <div class="company">${data.companyName || 'Company Name'}</div>
  <div class="date">Date: ${new Date().toLocaleDateString('en-IN')}</div>
</div>
<h1>Offer Letter</h1>
<p>Dear <strong>${data.candidateName}</strong>,</p>
<p>We are pleased to offer you the position of <strong>${data.designation}</strong> at <strong>${data.companyName || 'our company'}</strong>.</p>
<table>
  <tr><th>Detail</th><th>Information</th></tr>
  <tr><td>Position</td><td>${data.designation}</td></tr>
  <tr><td>Department</td><td>${data.department || '—'}</td></tr>
  <tr><td>Start Date</td><td>${data.joiningDate || '—'}</td></tr>
  <tr><td>Employment Type</td><td>${data.employmentType || 'Full-time'}</td></tr>
  <tr><td>Monthly CTC</td><td>₹${Number(data.ctc || 0).toLocaleString('en-IN')}</td></tr>
  <tr><td>Work Location</td><td>${data.location || 'Office'}</td></tr>
</table>
<p style="margin-top:20px">This offer is valid for <strong>${data.validityDays || 7} days</strong> from the date of issue.</p>
<div class="footer">
  <p>We look forward to welcoming you to our team.</p>
  <div class="sig-line">Authorised Signatory</div>
  <div class="sig-line" style="margin-top:40px">Candidate Acceptance</div>
</div>
</body>
</html>`;
}

export default function OfferLettersScreen() {
  const navigation = useNavigation<any>();
  const { user } = useAuth();
  const isHR = user?.role !== 'employee';

  const [letters, setLetters] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<any>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [company, setCompany] = useState('');
  const [printing, setPrinting] = useState<string | null>(null);
  const [showEmpTypePicker, setShowEmpTypePicker] = useState(false);

  const load = useCallback(async () => {
    try {
      const [letRes, compRes] = await Promise.all([
        offerLetterAPI.getAll(),
        companyAPI.getMe(),
      ]);
      setLetters(letRes.data || []);
      setCompany(compRes.data?.name || compRes.name || '');
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  };

  const openEdit = (letter: any) => {
    setEditing(letter);
    setForm({
      candidateName: letter.candidateName || '',
      candidateEmail: letter.candidateEmail || '',
      designation: letter.designation || '',
      department: letter.department || '',
      joiningDate: letter.joiningDate ? letter.joiningDate.split('T')[0] : '',
      employmentType: letter.employmentType || 'Full-time',
      ctc: String(letter.ctc || ''),
      location: letter.location || '',
      validityDays: String(letter.validityDays || '7'),
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.candidateName.trim() || !form.designation.trim()) {
      Alert.alert('Validation', 'Candidate name and designation are required');
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await offerLetterAPI.update(editing._id, { ...form, ctc: Number(form.ctc) || 0 });
      } else {
        await offerLetterAPI.create({ ...form, ctc: Number(form.ctc) || 0 });
      }
      setShowForm(false);
      setEditing(null);
      load();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (id: string, name: string) => {
    Alert.alert('Delete Offer Letter', `Delete offer letter for "${name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await offerLetterAPI.delete(id);
            setLetters(prev => prev.filter(l => l._id !== id));
          } catch (e: any) {
            Alert.alert('Error', e.message);
          }
        },
      },
    ]);
  };

  const handlePrint = async (letter: any) => {
    setPrinting(letter._id);
    try {
      const html = buildOfferLetterHTML({ ...letter, companyName: company });
      await RNPrint.print({ html });
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setPrinting(null);
    }
  };

  const F = (label: string, key: string, props: any = {}) => (
    <View key={key}>
      <Text style={s.fieldLabel}>{label}</Text>
      <TextInput
        style={s.fieldInput}
        value={form[key]}
        onChangeText={(v: string) => setForm((p: any) => ({ ...p, [key]: v }))}
        placeholderTextColor="#9CA3AF"
        {...props}
      />
    </View>
  );

  const renderItem = ({ item }: { item: any }) => {
    const cfg = STATUS_CONFIG[item.status] || STATUS_CONFIG.draft;
    return (
      <View style={s.card}>
        <View style={s.cardTop}>
          <View style={s.cardIcon}><FileText size={18} color={C.primary} /></View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={s.cardName}>{item.candidateName}</Text>
            <Text style={s.cardSub}>{item.designation}{item.department ? ` · ${item.department}` : ''}</Text>
            {item.joiningDate && (
              <Text style={s.cardDate}>
                Joining: {new Date(item.joiningDate).toLocaleDateString('en-IN')}
              </Text>
            )}
            {item.ctc > 0 && (
              <Text style={s.cardDate}>CTC: ₹{Number(item.ctc).toLocaleString('en-IN')}/mo</Text>
            )}
          </View>
          <View style={[s.badge, { backgroundColor: cfg.bg, borderColor: cfg.color }]}>
            <Text style={[s.badgeText, { color: cfg.color }]}>{cfg.label.toUpperCase()}</Text>
          </View>
        </View>

        <View style={s.cardActions}>
          <TouchableOpacity
            style={s.actionBtn}
            onPress={() => handlePrint(item)}
            disabled={printing === item._id}
          >
            {printing === item._id ? (
              <ActivityIndicator size="small" color={C.primary} />
            ) : (
              <>
                <Eye size={12} color={C.primary} />
                <Text style={s.actionBtnText}>Print</Text>
              </>
            )}
          </TouchableOpacity>

          {isHR && (
            <>
              <TouchableOpacity style={s.actionBtn} onPress={() => openEdit(item)}>
                <Pencil size={12} color={C.primary} />
                <Text style={s.actionBtnText}>Edit</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.actionBtn, { borderColor: C.danger }]}
                onPress={() => handleDelete(item._id, item.candidateName)}
              >
                <Trash2 size={12} color={C.danger} />
                <Text style={[s.actionBtnText, { color: C.danger }]}>Delete</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 4, marginRight: 4 }}>
          <ChevronLeft size={22} color={C.black} />
        </TouchableOpacity>
        <FileText size={20} color={C.primary} />
        <Text style={s.title}>Offer Letters</Text>
        <View style={{ flex: 1 }} />
        {isHR && (
          <TouchableOpacity style={s.addBtn} onPress={openCreate}>
            <Plus size={14} color={C.white} />
            <Text style={s.addBtnText}>New</Text>
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <View style={s.loader}><ActivityIndicator size="large" color={C.primary} /></View>
      ) : (
        <FlatList
          data={letters}
          keyExtractor={i => i._id}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 32 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} />}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={s.empty}>
              <FileText size={40} color="#D1D5DB" />
              <Text style={s.emptyText}>No offer letters yet</Text>
              {isHR && <Text style={s.emptyHint}>Tap "New" to create an offer letter</Text>}
            </View>
          }
        />
      )}

      {/* Create / Edit Modal */}
      <Modal visible={showForm} animationType="slide" presentationStyle="formSheet">
        <SafeAreaView style={s.safe} edges={['top']}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>{editing ? 'Edit Offer Letter' : 'New Offer Letter'}</Text>
            <TouchableOpacity onPress={() => setShowForm(false)}><X size={22} color={C.black} /></TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }} keyboardShouldPersistTaps="handled">
            {F('Candidate Name *', 'candidateName', { placeholder: 'Full name' })}
            {F('Email', 'candidateEmail', { placeholder: 'candidate@email.com', keyboardType: 'email-address', autoCapitalize: 'none' })}
            {F('Designation *', 'designation', { placeholder: 'e.g. Software Engineer' })}
            {F('Department', 'department', { placeholder: 'e.g. Engineering' })}

            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <DatePickerField
                  label="Joining Date"
                  value={form.joiningDate}
                  onChange={v => setForm((p: any) => ({ ...p, joiningDate: v }))}
                />
              </View>
              <View style={{ flex: 1 }}>
                {F('Monthly CTC (₹)', 'ctc', { keyboardType: 'numeric', placeholder: '50000' })}
              </View>
            </View>

            <View>
              <Text style={s.fieldLabel}>Employment Type</Text>
              <TouchableOpacity
                style={s.selectBtn}
                onPress={() => setShowEmpTypePicker(true)}
              >
                <Text style={s.selectBtnText}>{form.employmentType}</Text>
              </TouchableOpacity>
            </View>

            {F('Work Location', 'location', { placeholder: 'e.g. Mumbai' })}
            {F('Validity (days)', 'validityDays', { keyboardType: 'numeric', placeholder: '7' })}

            <TouchableOpacity style={s.submitBtn} onPress={handleSave} disabled={saving}>
              {saving ? (
                <ActivityIndicator color={C.white} />
              ) : (
                <>
                  <Send size={16} color={C.white} />
                  <Text style={s.submitBtnText}>{editing ? 'Update Offer Letter' : 'Create Offer Letter'}</Text>
                </>
              )}
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Employment Type Picker */}
      <Modal visible={showEmpTypePicker} animationType="slide" transparent>
        <View style={s.pickerOverlay}>
          <View style={s.pickerSheet}>
            <View style={s.pickerSheetHeader}>
              <Text style={s.pickerSheetTitle}>Employment Type</Text>
              <TouchableOpacity onPress={() => setShowEmpTypePicker(false)}><X size={20} color={C.black} /></TouchableOpacity>
            </View>
            {EMP_TYPES.map(t => (
              <TouchableOpacity
                key={t}
                style={[s.sheetOption, form.employmentType === t && s.sheetOptionActive]}
                onPress={() => { setForm((p: any) => ({ ...p, employmentType: t })); setShowEmpTypePicker(false); }}
              >
                <Text style={[s.sheetOptionText, form.employmentType === t && { color: C.primary }]}>{t}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
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
  addBtnText: { color: C.white, fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { alignItems: 'center', paddingTop: 60, gap: 8 },
  emptyText: { fontSize: 14, fontWeight: '700', color: '#9CA3AF' },
  emptyHint: { fontSize: 12, color: '#D1D5DB', fontWeight: '500' },
  card: {
    backgroundColor: C.white,
    borderWidth: 2,
    borderColor: C.black,
    padding: 14,
  },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 },
  cardIcon: {
    width: 40,
    height: 40,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: C.black,
  },
  cardName: { fontSize: 14, fontWeight: '700', color: C.black },
  cardSub: { fontSize: 11, color: C.primary, fontWeight: '700', marginTop: 2 },
  cardDate: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  badge: { borderWidth: 2, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  cardActions: { flexDirection: 'row', gap: 8, borderTopWidth: 1, borderTopColor: '#F3F4F6', paddingTop: 10 },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 2,
    borderColor: C.primary,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  actionBtnText: { color: C.primary, fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: C.white,
    borderBottomWidth: 2,
    borderBottomColor: C.black,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: C.black },
  fieldLabel: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', color: C.black, marginBottom: 6, letterSpacing: 0.5 },
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
  selectBtn: {
    borderWidth: 2,
    borderColor: C.black,
    paddingHorizontal: 12,
    paddingVertical: 11,
    backgroundColor: C.white,
  },
  selectBtnText: { fontSize: 14, fontWeight: '500', color: C.black },
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
  submitBtnText: { color: C.white, fontWeight: '700', fontSize: 14, textTransform: 'uppercase' },
  pickerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  pickerSheet: { backgroundColor: C.white, borderTopWidth: 2, borderTopColor: C.black },
  pickerSheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 2, borderBottomColor: C.black },
  pickerSheetTitle: { fontSize: 16, fontWeight: '700', color: C.black },
  sheetOption: { paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  sheetOptionActive: { backgroundColor: '#EFF6FF' },
  sheetOptionText: { fontSize: 15, fontWeight: '600', color: C.black },
});

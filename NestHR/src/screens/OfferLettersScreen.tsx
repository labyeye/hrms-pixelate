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
import { DatePickerField } from '../components/common/DatePickerField';
import {
  FileText,
  Plus,
  Trash2,
  Eye,
  X,
  Send,
  ChevronLeft,
} from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { employeeAPI } from '../api/api';
import { C } from '../theme';
import RNPrint from 'react-native-print';

function buildOfferLetterHTML(data: any): string {
  return `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<style>
  body { font-family: Arial, sans-serif; margin: 40px; color: #111; font-size: 13px; }
  h1 { font-size: 22px; font-weight: 900; border-bottom: 3px solid #024BAB; padding-bottom: 8px; margin-bottom: 20px; }
  .header { display: flex; justify-content: space-between; margin-bottom: 30px; }
  .company { font-weight: 900; font-size: 16px; color: #024BAB; }
  .date { color: #666; }
  .section { margin-bottom: 16px; }
  .label { font-weight: 900; font-size: 11px; text-transform: uppercase; color: #555; letter-spacing: 0.5px; }
  .value { margin-top: 2px; font-size: 13px; }
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
  <div class="date">Date: ${data.date || new Date().toLocaleDateString('en-IN')}</div>
</div>
<h1>Offer Letter</h1>
<div class="section">
  <div class="label">To</div>
  <div class="value"><strong>${data.candidateName}</strong><br/>${data.candidateEmail || ''}</div>
</div>
<p>Dear <strong>${data.candidateName}</strong>,</p>
<p>We are pleased to offer you the position of <strong>${data.designation}</strong> at <strong>${data.companyName || 'our company'}</strong>. This offer is contingent upon successful completion of pre-employment checks.</p>
<table>
  <tr><th>Detail</th><th>Information</th></tr>
  <tr><td>Position</td><td>${data.designation}</td></tr>
  <tr><td>Department</td><td>${data.department || '—'}</td></tr>
  <tr><td>Start Date</td><td>${data.joiningDate || '—'}</td></tr>
  <tr><td>Employment Type</td><td>${data.employmentType || 'Full-time'}</td></tr>
  <tr><td>Monthly CTC</td><td>₹${Number(data.ctc || 0).toLocaleString('en-IN')}</td></tr>
  <tr><td>Work Location</td><td>${data.location || 'Office'}</td></tr>
</table>
<p style="margin-top:20px">This offer is valid for <strong>7 days</strong> from the date of issue. Please sign and return the acceptance letter by the deadline.</p>
<div class="footer">
  <p>We look forward to welcoming you to our team.</p>
  <div class="sig-line">Authorised Signatory</div>
  <div class="sig-line" style="margin-top:40px">Candidate Acceptance</div>
</div>
</body>
</html>`;
}

const EMPTY_FORM = {
  candidateName: '',
  candidateEmail: '',
  designation: '',
  department: '',
  joiningDate: '',
  employmentType: 'Full-time',
  ctc: '',
  location: '',
};

export default function OfferLettersScreen() {
  const navigation = useNavigation<any>();
  const [letters, setLetters] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState<any>(EMPTY_FORM);
  const [generating, setGenerating] = useState(false);
  const [company, setCompany] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await employeeAPI.getAll();
      setEmployees(res.data || []);
      const saved = (res.data || [])
        .filter((e: any) => e.offerLetterSent)
        .map((e: any) => ({
          _id: e._id,
          name: `${e.firstName} ${e.lastName}`,
          designation: e.designation,
          joiningDate: e.joiningDate,
          sentAt: e.createdAt,
        }));
      setLetters(saved);
    } catch (e: any) {
      Alert.alert('Error', (e as any).message);
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

  const F = (label: string, key: keyof typeof EMPTY_FORM, props: any = {}) => (
    <View>
      <Text style={s.fieldLabel}>{label}</Text>
      <TextInput
        style={[
          s.fieldInput,
          props.multiline && { minHeight: 70, textAlignVertical: 'top' },
        ]}
        value={form[key]}
        onChangeText={(v: string) => setForm((p: any) => ({ ...p, [key]: v }))}
        placeholderTextColor={C.textLight}
        {...props}
      />
    </View>
  );

  const handleGenerate = async () => {
    if (!form.candidateName.trim() || !form.designation.trim()) {
      Alert.alert('Validation', 'Candidate name and designation are required');
      return;
    }
    setGenerating(true);
    try {
      const html = buildOfferLetterHTML({ ...form, companyName: company });
      await RNPrint.print({ html });
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setGenerating(false);
    }
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
        <FileText size={20} color={C.primary} />
        <Text style={s.title}>Offer Letters</Text>
        <View style={{ flex: 1 }} />
        <TouchableOpacity
          style={s.addBtn}
          onPress={() => {
            setForm(EMPTY_FORM);
            setModal(true);
          }}
        >
          <Plus size={14} color={C.white} />
          <Text style={s.addBtnText}>Generate</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={s.loader}>
          <ActivityIndicator size="large" color={C.primary} />
        </View>
      ) : (
        <FlatList
          data={letters}
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
              <FileText size={40} color="#D1D5DB" />
              <Text style={s.emptyText}>No offer letters generated</Text>
              <Text style={s.emptyHint}>
                Tap "Generate" to create a new offer letter
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={s.card}>
              <View style={s.cardIcon}>
                <FileText size={18} color={C.primary} />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={s.cardName}>{item.name}</Text>
                <Text style={s.cardSub}>{item.designation}</Text>
                {item.joiningDate && (
                  <Text style={s.cardDate}>
                    Joining:{' '}
                    {new Date(item.joiningDate).toLocaleDateString('en-IN')}
                  </Text>
                )}
              </View>
              <TouchableOpacity
                style={s.viewBtn}
                onPress={async () => {
                  const e = employees.find(emp => emp._id === item._id);
                  if (e) {
                    const html = buildOfferLetterHTML({
                      candidateName: `${e.firstName} ${e.lastName}`,
                      candidateEmail: e.email,
                      designation: e.designation,
                      department: e.department,
                      joiningDate: e.joiningDate,
                      ctc: e.monthlySalary,
                      companyName: company,
                    });
                    await RNPrint.print({ html });
                  }
                }}
              >
                <Eye size={12} color={C.primary} />
                <Text style={s.viewBtnText}>View</Text>
              </TouchableOpacity>
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
            <Text style={s.modalTitle}>Generate Offer Letter</Text>
            <TouchableOpacity onPress={() => setModal(false)}>
              <X size={22} color={C.black} />
            </TouchableOpacity>
          </View>
          <ScrollView
            contentContainerStyle={{ padding: 20, gap: 16 }}
            keyboardShouldPersistTaps="handled"
          >
            {F('Candidate Name *', 'candidateName', {
              placeholder: 'Full name',
            })}
            {F('Email', 'candidateEmail', {
              placeholder: 'candidate@email.com',
              keyboardType: 'email-address',
              autoCapitalize: 'none',
            })}
            {F('Designation *', 'designation', {
              placeholder: 'e.g. Software Engineer',
            })}
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
                {F('Monthly CTC (₹)', 'ctc', {
                  keyboardType: 'numeric',
                  placeholder: '50000',
                })}
              </View>
            </View>
            {F('Employment Type', 'employmentType', {
              placeholder: 'Full-time',
            })}
            {F('Work Location', 'location', { placeholder: 'e.g. Mumbai' })}

            <TouchableOpacity
              style={s.submitBtn}
              onPress={handleGenerate}
              disabled={generating}
            >
              {generating ? (
                <ActivityIndicator color={C.white} />
              ) : (
                <>
                  <Send size={16} color={C.white} />
                  <Text style={s.submitBtnText}>Generate & Print</Text>
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
  empty: { alignItems: 'center', paddingTop: 60, gap: 8 },
  emptyText: { fontSize: 14, fontWeight: '700', color: C.textMuted },
  emptyHint: { fontSize: 12, color: C.textLight, fontWeight: '500' },
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
  cardName: { fontSize: 14, fontWeight: '700', color: C.black },
  cardSub: { fontSize: 11, color: C.primary, fontWeight: '700' },
  cardDate: { fontSize: 10, color: C.textMuted, marginTop: 2 },
  viewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 2,
    borderColor: C.primary,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  viewBtnText: {
    color: C.primary,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
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

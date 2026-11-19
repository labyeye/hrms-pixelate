import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, FileText, Printer } from 'lucide-react-native';
import RNPrint from 'react-native-print';
import { taxAPI } from '../api/api';
import { useAuth } from '../contexts/AuthContext';
import { C } from '../theme';

const MONTHS = 'Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec'.split(' ');
const inr = (n: number) => `₹${Math.round(n || 0).toLocaleString('en-IN')}`;
const nowFY = () => {
  const d = new Date();
  return d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
};
const FIELDS: [string, string][] = [
  ['sec80C', 'Section 80C (PF, ELSS, LIC, PPF…) - max ₹1,50,000'],
  ['sec80D', 'Section 80D (health insurance)'],
  ['hraRentPaid', 'Annual rent paid (for HRA)'],
  ['homeLoanInterest', 'Home loan interest (max ₹2,00,000)'],
  ['otherDeductions', 'Other Chapter VI-A deductions (80G, NPS 80CCD…)'],
];
const STATUS_COLOR: Record<string, string> = {
  submitted: '#EA580C',
  verified: '#16A34A',
  rejected: '#DC2626',
};
const esc = (s: any) =>
  String(s ?? '').replace(
    /[&<>"']/g,
    c =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[
        c
      ] as string),
  );

function form16Html(d: any) {
  const rows = d.months
    .map(
      (m: any) =>
        `<tr><td>${MONTHS[m.month - 1]} ${m.year}</td><td class="r">${inr(
          m.gross,
        )}</td><td class="r">${inr(m.pf)}</td><td class="r">${inr(
          m.esi,
        )}</td><td class="r">${inr(m.tds)}</td></tr>`,
    )
    .join('');
  const fyLabel = `${d.fy}-${String(d.fy + 1).slice(2)}`;
  return `<html><head><style>
    body{font-family:Arial,sans-serif;padding:24px;color:#000}
    h1{font-size:18px;margin:0}table{border-collapse:collapse;width:100%;margin:12px 0}
    td,th{border:1px solid #000;padding:6px 8px;font-size:12px;text-align:left}.r{text-align:right}
    .note{font-size:10px;color:#444;margin-top:16px}</style></head><body>
    <h1>Annual Tax Statement (Form 16 Part B format)</h1>
    <p>Financial Year ${fyLabel} · ${
    d.regime === 'old' ? 'Old' : 'New'
  } tax regime${
    d.declarationVerified ? '' : ' (no verified declaration - defaults applied)'
  }</p>
    <table><tr><th>Employer</th><td>${esc(d.company?.name)}<br>${esc(
    d.company?.address,
  )}<br>PAN: ${esc(d.company?.panNumber || '-')}</td></tr>
    <tr><th>Employee</th><td>${esc(d.employee.name)} (${esc(
    d.employee.employeeId,
  )})<br>${esc(d.employee.designation)}<br>PAN: ${esc(
    d.employee.pan || '-',
  )}</td></tr></table>
    <table><tr><th>Month</th><th class="r">Gross</th><th class="r">PF</th><th class="r">ESI</th><th class="r">TDS deducted</th></tr>${rows}
    <tr><th>Total</th><th class="r">${inr(
      d.totals.gross,
    )}</th><th class="r">${inr(d.totals.pf)}</th><th class="r">${inr(
    d.totals.esi,
  )}</th><th class="r">${inr(d.totals.tds)}</th></tr></table>
    <table><tr><td>Gross salary</td><td class="r">${inr(
      d.totals.gross,
    )}</td></tr>
    <tr><td>Less: standard deduction</td><td class="r">${inr(
      d.taxable.standardDeduction,
    )}</td></tr>
    <tr><td>Less: Chapter VI-A deductions</td><td class="r">${inr(
      d.taxable.chapterVIA,
    )}</td></tr>
    <tr><td>Less: home loan interest</td><td class="r">${inr(
      d.taxable.homeLoanInterest,
    )}</td></tr>
    <tr><th>Taxable income (estimate)</th><th class="r">${inr(
      d.taxable.income,
    )}</th></tr>
    <tr><th>Total TDS deducted</th><th class="r">${inr(
      d.totals.tds,
    )}</th></tr></table>
    <p class="note">Generated from company payroll records. This is not the TRACES-issued Form 16 (Part A, with TDS deposit challans, comes from the TRACES portal).</p>
    </body></html>`;
}

export default function TaxScreen({ navigation }: any) {
  const { user } = useAuth();
  const isHR = user?.role === 'super_admin' || user?.role === 'hr_manager';
  const [fy, setFy] = useState(nowFY());
  const [form, setForm] = useState<any>({ regime: 'new', proofNote: '' });
  const [status, setStatus] = useState('');
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectRemark, setRejectRemark] = useState('');

  const load = useCallback(async () => {
    try {
      const r = await taxAPI.getMine(fy);
      setForm(r.data || { regime: 'new', proofNote: '' });
      setStatus(r.data?.status || '');
    } catch {
      // HR accounts without an employee record just see the review list
      setForm({ regime: 'new', proofNote: '' });
      setStatus('');
    }
    if (isHR) {
      try {
        const r = await taxAPI.list(fy);
        setList(r.data || []);
      } catch (e: any) {
        Alert.alert('Error', e.message);
      }
    }
    setLoading(false);
    setRefreshing(false);
  }, [fy, isHR]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  const locked = status === 'verified';

  const save = async () => {
    setSaving(true);
    try {
      await taxAPI.saveMine(fy, form);
      Alert.alert('Submitted', 'Declaration sent for HR verification');
      await load();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setSaving(false);
    }
  };

  const review = async (id: string, s: string, remark = '') => {
    try {
      await taxAPI.review(id, s, remark);
      await load();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  const form16 = async (employee?: string) => {
    try {
      const r = await taxAPI.form16(fy, employee);
      await RNPrint.print({ html: form16Html(r.data) });
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not generate statement');
    }
  };

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <View style={s.headerLeft}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={{ padding: 4, marginRight: 4 }}
          >
            <ChevronLeft size={24} color={C.black} />
          </TouchableOpacity>
          <FileText size={20} color={C.primary} />
          <Text style={s.headerTitle}>Tax & Form 16</Text>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={C.primary} />
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 60 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                load();
              }}
            />
          }
        >
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8 }}
          >
            {[0, 1, 2, 3].map(i => {
              const y = nowFY() - i;
              return (
                <TouchableOpacity
                  key={y}
                  style={[s.chip, fy === y && s.chipActive]}
                  onPress={() => setFy(y)}
                >
                  <Text style={[s.chipText, fy === y && { color: C.white }]}>
                    FY {y}-{String(y + 1).slice(2)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <View style={s.card}>
            <View style={s.rowBetween}>
              <Text style={s.cardTitle}>My declaration</Text>
              {!!status && (
                <Text
                  style={[
                    s.badge,
                    {
                      color: STATUS_COLOR[status],
                      borderColor: STATUS_COLOR[status],
                    },
                  ]}
                >
                  {status.toUpperCase()}
                </Text>
              )}
            </View>
            {!!form.remark && (
              <Text style={{ color: '#B91C1C', fontSize: 12 }}>
                HR remark: {form.remark}
              </Text>
            )}
            <Text style={s.label}>Tax regime</Text>
            <View style={{ gap: 8 }}>
              {[
                ['new', 'New tax regime (no deductions)'],
                ['old', 'Old tax regime (with deductions)'],
              ].map(([v, l]) => (
                <TouchableOpacity
                  key={v}
                  disabled={locked}
                  style={[s.chip, form.regime === v && s.chipActive]}
                  onPress={() => setForm({ ...form, regime: v })}
                >
                  <Text
                    style={[
                      s.chipText,
                      form.regime === v && { color: C.white },
                    ]}
                  >
                    {l}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {form.regime === 'old' &&
              FIELDS.map(([k, label]) => (
                <View key={k}>
                  <Text style={s.label}>{label}</Text>
                  <TextInput
                    style={s.input}
                    editable={!locked}
                    keyboardType="numeric"
                    value={String(form[k] ?? '')}
                    onChangeText={v =>
                      setForm({ ...form, [k]: v.replace(/[^0-9.]/g, '') })
                    }
                    placeholder="0"
                    placeholderTextColor={C.textLight}
                  />
                </View>
              ))}
            <Text style={s.label}>Proof details (Optional)</Text>
            <TextInput
              style={[s.input, { minHeight: 70, textAlignVertical: 'top' }]}
              multiline
              maxLength={500}
              editable={!locked}
              value={form.proofNote || ''}
              onChangeText={v => setForm({ ...form, proofNote: v })}
              placeholder="Policy numbers, receipts you will hand over…"
              placeholderTextColor={C.textLight}
            />
            <TouchableOpacity
              style={[s.primaryBtn, locked && { opacity: 0.4 }]}
              disabled={locked || saving}
              onPress={save}
            >
              {saving ? (
                <ActivityIndicator color={C.white} />
              ) : (
                <Text style={s.primaryBtnText}>Submit declaration</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity style={s.outlineBtn} onPress={() => form16()}>
              <Printer size={16} color={C.black} />
              <Text style={s.outlineBtnText}>Download Form 16 statement</Text>
            </TouchableOpacity>
          </View>

          {isHR && (
            <>
              <Text style={s.section}>
                Employee declarations ({list.length})
              </Text>
              {list.length === 0 ? (
                <View style={[s.card, { alignItems: 'center' }]}>
                  <FileText size={28} color={C.textLight} />
                  <Text style={{ color: C.textMuted, marginTop: 6 }}>
                    No declarations for this year
                  </Text>
                </View>
              ) : (
                list.map(d => (
                  <View key={d._id} style={s.card}>
                    <View style={s.rowBetween}>
                      <Text style={s.cardTitle}>
                        {d.employee?.firstName} {d.employee?.lastName} (
                        {d.employee?.employeeId})
                      </Text>
                      <Text
                        style={[
                          s.badge,
                          {
                            color: STATUS_COLOR[d.status],
                            borderColor: STATUS_COLOR[d.status],
                          },
                        ]}
                      >
                        {String(d.status).toUpperCase()}
                      </Text>
                    </View>
                    <Text style={{ fontSize: 12, color: C.textMuted }}>
                      {d.regime === 'old'
                        ? `Old regime · 80C ${inr(d.sec80C)} · 80D ${inr(
                            d.sec80D,
                          )} · Rent ${inr(d.hraRentPaid)} · Home loan ${inr(
                            d.homeLoanInterest,
                          )} · Other ${inr(d.otherDeductions)}`
                        : 'New regime'}
                    </Text>
                    {!!d.proofNote && (
                      <Text style={{ fontSize: 12, color: C.textMuted }}>
                        {d.proofNote}
                      </Text>
                    )}
                    <View
                      style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}
                    >
                      {d.status !== 'verified' && (
                        <TouchableOpacity
                          style={[s.smallBtn, { backgroundColor: '#16A34A' }]}
                          onPress={() => review(d._id, 'verified')}
                        >
                          <Text style={{ color: C.white }}>Verify</Text>
                        </TouchableOpacity>
                      )}
                      {d.status === 'submitted' && (
                        <TouchableOpacity
                          style={s.smallBtn}
                          onPress={() => {
                            setRejectId(d._id);
                            setRejectRemark('');
                          }}
                        >
                          <Text style={{ color: '#B91C1C' }}>Reject</Text>
                        </TouchableOpacity>
                      )}
                      {d.status === 'verified' && (
                        <TouchableOpacity
                          style={s.smallBtn}
                          onPress={() => review(d._id, 'submitted')}
                        >
                          <Text>Reopen</Text>
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity
                        style={s.smallBtn}
                        onPress={() => form16(d.employee?._id)}
                      >
                        <Text>Form 16</Text>
                      </TouchableOpacity>
                    </View>
                    {rejectId === d._id && (
                      <View style={{ gap: 8 }}>
                        <TextInput
                          style={s.input}
                          value={rejectRemark}
                          onChangeText={setRejectRemark}
                          placeholder="Reason for rejection *"
                          placeholderTextColor={C.textLight}
                        />
                        <TouchableOpacity
                          style={s.primaryBtn}
                          onPress={() => {
                            if (!rejectRemark.trim()) {
                              Alert.alert('Required', 'Enter a reason');
                              return;
                            }
                            const id = rejectId;
                            setRejectId(null);
                            review(
                              id as string,
                              'rejected',
                              rejectRemark.trim(),
                            );
                          }}
                        >
                          <Text style={s.primaryBtnText}>Confirm reject</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                ))
              )}
            </>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F8F9FA' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: C.white,
    borderBottomWidth: 2,
    borderBottomColor: C.black,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle: { fontSize: 20, fontWeight: '400', color: C.black },
  card: {
    backgroundColor: C.white,
    borderWidth: 2,
    borderColor: C.black,
    padding: 14,
    gap: 10,
  },
  cardTitle: { fontSize: 14, fontWeight: '600', color: C.black, flexShrink: 1 },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  badge: {
    fontSize: 10,
    fontWeight: '700',
    borderWidth: 2,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  section: {
    fontSize: 12,
    fontWeight: '700',
    color: C.textMuted,
    textTransform: 'uppercase',
  },
  label: { fontSize: 12, color: C.black },
  input: {
    borderWidth: 2,
    borderColor: C.black,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: C.black,
    backgroundColor: C.white,
  },
  chip: {
    borderWidth: 2,
    borderColor: C.black,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: C.white,
  },
  chipActive: { backgroundColor: C.primary },
  chipText: { fontSize: 13, color: C.black },
  primaryBtn: {
    backgroundColor: C.primary,
    borderWidth: 2,
    borderColor: C.black,
    padding: 12,
    alignItems: 'center',
  },
  primaryBtnText: { color: C.white, fontWeight: '600' },
  outlineBtn: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: C.black,
    padding: 12,
    backgroundColor: C.white,
  },
  outlineBtnText: { color: C.black, fontWeight: '600' },
  smallBtn: {
    borderWidth: 2,
    borderColor: C.black,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: C.white,
  },
});

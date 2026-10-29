import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  CreditCard,
  CheckCircle2,
  Calendar,
  ChevronLeft,
  Crown,
  Users,
  AlertCircle,
  Check,
  Download,
  IndianRupee,
  Zap,
} from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import RNPrint from 'react-native-print';
import { buildInvoiceHTML } from '../utils/buildInvoiceHTML';
import { billingAPI } from '../api/api';
import { useAuth } from '../contexts/AuthContext';
import { C } from '../theme';

const fmtDate = (
  d?: string | Date | null,
  opts?: Intl.DateTimeFormatOptions,
) =>
  d
    ? new Date(d).toLocaleDateString(
        'en-IN',
        opts || { day: 'numeric', month: 'short', year: 'numeric' },
      )
    : '—';

/**
 * Read-only billing summary, same as the web app: plans are changed by Pixelate Nest, so there is no checkout here.
 * Every field is read defensively - the subscription/invoice payloads are optional and shaped by the backend plan model.
 */
export default function BillingScreen() {
  const navigation = useNavigation<any>();
  const { user } = useAuth();
  const [subscription, setSubscription] = useState<any>(null);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);

  const load = async () => {
    const [subRes, invRes]: any[] = await Promise.all([
      billingAPI.getSubscription().catch(() => null),
      billingAPI.getInvoices().catch(() => null),
    ]);
    setSubscription(subRes?.data || null);
    setInvoices(Array.isArray(invRes?.data) ? invRes.data : []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const downloadInvoice = async (inv: any) => {
    setDownloading(inv._id);
    try {
      await RNPrint.print({ html: buildInvoiceHTML(inv) });
    } catch (e: any) {
      if (e?.message !== 'cancelled') {
        Alert.alert('Error', 'Could not generate invoice PDF.');
      }
    } finally {
      setDownloading(null);
    }
  };

  const sub: any = subscription || user?.subscription || null;
  const planName = String(sub?.customPlanName || sub?.plan || '—');
  const isTrial = !!sub?.isTrial;
  const isActive =
    sub?.status === 'active' || sub?.status === 'pending_renewal';
  const isCancelled = sub?.status === 'cancelled';
  const expiry = isTrial ? sub?.trialEndDate : sub?.renewalDate;
  const daysLeft = expiry
    ? Math.max(
        0,
        Math.ceil((new Date(expiry).getTime() - Date.now()) / 86400000),
      )
    : null;
  const empUsed = Number(sub?.currentEmployeeCount ?? 0);
  const empMax = Number(sub?.maxEmployees ?? 0);
  const unlimited = empMax === 999;
  const empPct =
    empMax > 0 && !unlimited
      ? Math.min(100, Math.round((empUsed / empMax) * 100))
      : 0;
  const features: string[] =
    Array.isArray(sub?.customFeatures) && sub.customFeatures.length
      ? sub.customFeatures
      : [
          `Up to ${unlimited ? 'unlimited' : empMax || '—'} employees`,
          'Employee management, departments & documents',
          'Attendance with biometric device support',
          'Leave, holidays & late approvals',
          'Payroll, loans & payslips',
          'Performance, tasks & announcements',
          'Web & mobile app access',
          ...(String(sub?.tier || '').includes('whatsapp')
            ? ['WhatsApp notifications & OTP']
            : []),
        ];
  const accent =
    isTrial || isCancelled ? C.warning : isActive ? C.success : C.danger;

  const Header = (
    <View style={s.header}>
      <TouchableOpacity
        onPress={() => navigation.goBack()}
        style={{ padding: 4, marginRight: 4 }}
      >
        <ChevronLeft size={22} color={C.black} />
      </TouchableOpacity>
      <CreditCard size={20} color={C.primary} />
      <Text style={s.headerTitle}>Billing</Text>
    </View>
  );

  if (loading)
    return (
      <SafeAreaView style={s.safe} edges={['top']}>
        {Header}
        <View style={s.loader}>
          <ActivityIndicator size="large" color={C.primary} />
        </View>
      </SafeAreaView>
    );

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      {Header}
      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 40 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={C.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {isTrial && (
          <View style={s.trialBanner}>
            <Zap size={14} color={C.warning} />
            <Text style={s.trialBannerText}>
              Free trial — {daysLeft ?? 0} days remaining. To continue after the
              trial, contact Pixelate Nest.
            </Text>
          </View>
        )}
        {!isActive && !isTrial && (
          <View
            style={[
              s.trialBanner,
              { borderColor: C.danger, backgroundColor: '#FEF2F2' },
            ]}
          >
            <AlertCircle size={14} color={C.danger} />
            <Text style={[s.trialBannerText, { color: C.danger }]}>
              No active subscription. Please contact Pixelate Nest to activate
              your plan.
            </Text>
          </View>
        )}

        <View style={[s.statusCard, { borderColor: accent }]}>
          <View style={[s.statusIcon, { backgroundColor: C.primary }]}>
            <Crown size={20} color={C.white} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.statusPlan}>{planName.toUpperCase()} PLAN</Text>
            <View style={s.statusRow}>
              {isActive && !isTrial ? (
                <CheckCircle2 size={12} color={C.success} />
              ) : (
                <AlertCircle size={12} color={accent} />
              )}
              <Text style={[s.statusLabel, { color: accent }]}>
                {isTrial
                  ? `Free trial — ${daysLeft ?? 0} days left`
                  : isCancelled
                    ? 'Cancelling'
                    : isActive
                      ? 'Paid & Active'
                      : 'Inactive'}
              </Text>
            </View>
          </View>
          {!!expiry && (
            <View style={s.nextBill}>
              <Calendar size={11} color={C.textMuted} />
              <Text style={s.nextBillText}>
                {fmtDate(expiry, { day: 'numeric', month: 'short' })}
              </Text>
            </View>
          )}
        </View>

        <View style={s.invoiceCard}>
          <View style={[s.invoiceRow, { alignItems: 'center' }]}>
            <Users size={16} color={C.primary} />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={s.invoicePlan}>
                Employees: {empUsed} / {unlimited ? '∞' : empMax || '—'}
              </Text>
              <View
                style={{
                  height: 8,
                  marginTop: 6,
                  backgroundColor: '#DBEAFE',
                  borderWidth: 1,
                  borderColor: C.black,
                }}
              >
                <View
                  style={{
                    width: `${unlimited ? 10 : empPct}%`,
                    height: '100%',
                    backgroundColor: empPct > 85 ? C.danger : C.primary,
                  }}
                />
              </View>
            </View>
          </View>
        </View>

        <View>
          <Text style={s.sectionTitle}>What's included</Text>
          <View style={s.invoiceCard}>
            {features.map((f, i) => (
              <View
                key={`${i}-${f}`}
                style={[
                  s.invoiceRow,
                  i > 0 && s.invoiceBorder,
                  { alignItems: 'center', gap: 8 },
                ]}
              >
                <Check size={14} color={C.success} />
                <Text style={[s.invoiceDate, { flex: 1, color: C.black }]}>
                  {f}
                </Text>
              </View>
            ))}
          </View>
          <Text style={[s.invoiceDate, { marginTop: 8 }]}>
            Need a different plan or more employees? Contact Pixelate Nest at
            support@pixelatenest.com.
          </Text>
        </View>

        <View>
          <Text style={s.sectionTitle}>Invoice History</Text>
          {invoices.length === 0 ? (
            <View style={s.emptyPlans}>
              <Text style={s.emptyPlansText}>No invoices found</Text>
            </View>
          ) : (
            <View style={s.invoiceCard}>
              {invoices.slice(0, 20).map((inv: any, i: number) => (
                <View
                  key={inv._id || i}
                  style={[s.invoiceRow, i > 0 && s.invoiceBorder]}
                >
                  <View style={s.invoiceLeft}>
                    <Text style={s.invoicePlan}>
                      {String(inv.invoiceNumber || inv.plan || 'Invoice')}
                    </Text>
                    <Text style={s.invoiceDate}>
                      {fmtDate(inv.paidAt || inv.createdAt || inv.date)}
                      {inv.billingCycle ? ` · ${inv.billingCycle}` : ''}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 6 }}>
                    <View style={s.invoiceAmount}>
                      <IndianRupee size={11} color={C.black} />
                      <Text style={s.invoiceAmountText}>
                        {Number(inv.amount || 0).toLocaleString('en-IN')}
                      </Text>
                    </View>
                    <View style={s.invoiceBottomRow}>
                      <View
                        style={[
                          s.invStatus,
                          {
                            backgroundColor:
                              inv.status === 'paid' ? C.success : C.warning,
                          },
                        ]}
                      >
                        <Text style={s.invStatusText}>
                          {String(inv.status || 'paid').toUpperCase()}
                        </Text>
                      </View>
                      <TouchableOpacity
                        style={s.downloadBtn}
                        onPress={() => downloadInvoice(inv)}
                        disabled={downloading === inv._id}
                      >
                        {downloading === inv._id ? (
                          <ActivityIndicator size="small" color={C.white} />
                        ) : (
                          <Download size={11} color={C.white} />
                        )}
                        <Text style={s.downloadBtnText}>PDF</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: C.white,
    borderBottomWidth: 2,
    borderBottomColor: C.black,
    gap: 8,
  },
  headerTitle: { fontSize: 20, fontWeight: '400', color: C.black },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.white,
    borderWidth: 2,
    borderRightWidth: 4,
    borderBottomWidth: 4,
    borderRightColor: '#0A0A0A',
    borderBottomColor: '#0A0A0A',
    borderRadius: 8,
    padding: 14,
    gap: 12,
  },
  statusIcon: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderRightWidth: 4,
    borderBottomWidth: 4,
    borderRightColor: '#0A0A0A',
    borderBottomColor: '#0A0A0A',
    borderRadius: 8,
    borderColor: C.black,
  },
  statusPlan: {
    borderWidth: 2,
    borderRadius: 999,
    borderColor: '#0A0A0A',
    borderRightWidth: 4,
    borderBottomWidth: 4,
    fontSize: 14,
    fontWeight: '400',
    color: C.black,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  statusLabel: { fontSize: 12, fontWeight: '400' },
  nextBill: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  nextBillText: { fontSize: 11, fontWeight: '400', color: C.textMuted },
  trialBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFF7ED',
    borderWidth: 2,
    borderRightWidth: 4,
    borderBottomWidth: 4,
    borderRightColor: '#0A0A0A',
    borderBottomColor: '#0A0A0A',
    borderRadius: 8,
    borderColor: C.warning,
    padding: 12,
  },
  trialBannerText: {
    fontSize: 12,
    fontWeight: '400',
    color: '#92400E',
    flex: 1,
  },
  cycleRow: {
    flexDirection: 'row',
    backgroundColor: C.white,
    borderWidth: 2,
    borderRadius: 8,
    borderRightWidth: 5,
    borderBottomWidth: 5,
    borderRightColor: '#0A0A0A',
    borderBottomColor: '#0A0A0A',
    borderColor: C.black,
  },
  cycleBtn: { flex: 1, paddingVertical: 10, alignItems: 'center' },
  cycleBtnActive: { backgroundColor: C.primary },
  cycleBtnText: {
    fontSize: 12,
    fontWeight: '400',
    color: C.black,
    textTransform: 'uppercase',
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '400',
    textTransform: 'uppercase',
    color: C.black,
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  emptyPlans: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: 20,
    backgroundColor: C.white,
    borderWidth: 2,
    borderRightWidth: 4,
    borderBottomWidth: 4,
    borderRightColor: '#0A0A0A',
    borderBottomColor: '#0A0A0A',
    borderRadius: 8,
    borderColor: C.black,
  },
  emptyPlansText: { fontSize: 13, fontWeight: '400', color: C.textMuted },
  planCard: {
    backgroundColor: C.white,
    borderWidth: 2,
    borderRadius: 8,
    borderRightWidth: 5,
    borderBottomWidth: 5,
    borderRightColor: '#0A0A0A',
    borderBottomColor: '#0A0A0A',
    borderColor: C.black,
    padding: 14,
  },
  currentBadge: {
    borderWidth: 2,
    borderRadius: 999,
    borderColor: '#0A0A0A',
    borderRightWidth: 4,
    borderBottomWidth: 4,
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginBottom: 10,
  },
  currentBadgeText: {
    textTransform: 'uppercase',
    fontSize: 9,
    fontWeight: '400',
    color: C.white,
    letterSpacing: 1,
  },
  planTop: { flexDirection: 'row', alignItems: 'center' },
  planIcon: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderRightWidth: 4,
    borderBottomWidth: 4,
    borderRightColor: '#0A0A0A',
    borderBottomColor: '#0A0A0A',
    borderRadius: 8,
    borderColor: C.black,
  },
  planName: { fontSize: 14, fontWeight: '400', color: C.black },
  planDesc: {
    fontSize: 11,
    color: C.textMuted,
    fontWeight: '400',
    marginTop: 2,
  },
  priceRow: { flexDirection: 'row', alignItems: 'center' },
  price: { fontSize: 20, fontWeight: '400', color: C.black },
  priceCycle: {
    fontSize: 12,
    fontWeight: '400',
    color: C.textMuted,
    marginTop: 2,
  },
  featureList: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 2,
    borderTopColor: C.black,
    gap: 5,
  },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  featureText: { fontSize: 12, fontWeight: '400', color: C.black },
  upgradeBtn: {
    marginTop: 12,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderRadius: 8,
    borderRightWidth: 5,
    borderBottomWidth: 5,
    borderRightColor: '#0A0A0A',
    borderBottomColor: '#0A0A0A',
    borderColor: C.black,
  },
  upgradeBtnText: {
    fontSize: 13,
    fontWeight: '400',
    color: C.white,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  invoiceCard: {
    backgroundColor: C.white,
    borderWidth: 2,
    borderRadius: 8,
    borderRightWidth: 5,
    borderBottomWidth: 5,
    borderRightColor: '#0A0A0A',
    borderBottomColor: '#0A0A0A',
    borderColor: C.black,
  },
  invoiceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  invoiceBorder: { borderTopWidth: 2, borderTopColor: C.black },
  invoiceLeft: { flex: 1 },
  invoicePlan: { fontSize: 12, fontWeight: '400', color: C.black },
  invoiceDate: {
    fontSize: 11,
    color: C.textMuted,
    fontWeight: '400',
    marginTop: 2,
  },
  invoiceAmount: { flexDirection: 'row', alignItems: 'center' },
  invoiceAmountText: { fontSize: 15, fontWeight: '400', color: C.black },
  invStatus: {
    borderWidth: 2,
    borderRadius: 999,
    borderColor: '#0A0A0A',
    borderRightWidth: 4,
    borderBottomWidth: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginTop: 4,
  },
  invStatusText: {
    textTransform: 'uppercase',
    fontSize: 8,
    fontWeight: '400',
    color: C.white,
  },
  invoiceBottomRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  downloadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: C.primary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 2,
    borderRadius: 8,
    borderRightWidth: 5,
    borderBottomWidth: 5,
    borderRightColor: '#0A0A0A',
    borderBottomColor: '#0A0A0A',
    borderColor: C.black,
  },
  downloadBtnText: { fontSize: 8, fontWeight: '400', color: C.white },
});

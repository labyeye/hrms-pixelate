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
  Zap,
  Calendar,
  ChevronLeft,
  Star,
  Shield,
  Users,
  IndianRupee,
  AlertCircle,
  Check,
  Download,
} from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import RNPrint from 'react-native-print';
import { buildInvoiceHTML } from '../utils/buildInvoiceHTML';
import { billingAPI } from '../api/api';
import { useAuth } from '../contexts/AuthContext';
import { C } from '../theme';

const PLAN_COLOR: Record<string, string> = {
  free: '#9CA3AF',
  starter: C.primary,
  professional: C.secondary,
  enterprise: C.success,
};

const PLAN_ICON: Record<string, any> = {
  free: Shield,
  starter: Zap,
  professional: Star,
  enterprise: Users,
};

const BILLING_CYCLES = [
  { key: 'monthly', label: 'Monthly' },
  { key: 'yearly', label: 'Yearly (Save 20%)' },
];

export default function BillingScreen() {
  const navigation = useNavigation<any>();
  const { user } = useAuth();
  const [billing, setBilling] = useState<any>(null);
  const [plans, setPlans] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [cycle, setCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [upgrading, setUpgrading] = useState<string | null>(null);

  const load = async () => {
    try {
      const [subRes, plansRes, invRes] = await Promise.all([
        billingAPI.getSubscription(),
        billingAPI.getPlans(),
        billingAPI.getInvoices().catch(() => ({ data: [] })),
      ]);
      setBilling(subRes.data || subRes);
      setPlans(plansRes.data || []);
      setInvoices(invRes.data || []);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);
  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const handleUpgrade = async (planId: string) => {
    const currentPlan = billing?.plan || 'free';
    if (planId === currentPlan) {
      Alert.alert('Current Plan', 'You are already on this plan.');
      return;
    }

    setUpgrading(planId);
    try {
      const res = await billingAPI.createOrder(planId, cycle, 'razorpay');
      const order = res.data;

      const options = {
        key: order.key || '',
        amount: order.amount,
        currency: order.currency || 'INR',
        name: 'NestHR',
        description: `${
          planId.charAt(0).toUpperCase() + planId.slice(1)
        } Plan — ${cycle}`,
        order_id: order.orderId,
        prefill: {
          name: user?.name || '',
          email: user?.email || '',
          contact: user?.phone || '',
        },
        theme: { color: C.primary },
      };

      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const Razorpay = require('react-native-razorpay').default;
      const payment = await Razorpay.open(options);
      await billingAPI.verifyRazorpay({
        razorpayOrderId: payment.razorpay_order_id,
        razorpayPaymentId: payment.razorpay_payment_id,
        razorpaySignature: payment.razorpay_signature,
      });
      Alert.alert('Success', `${planId} plan activated!`);
      await load();
    } catch (e: any) {
      if (e?.code !== 'PAYMENT_CANCELLED') {
        Alert.alert('Payment Failed', e.message || 'Something went wrong');
      }
    } finally {
      setUpgrading(null);
    }
  };

  const [downloading, setDownloading] = useState<string | null>(null);

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

  const currentPlanId = billing?.plan || 'free';
  const isActive = billing?.status === 'active';
  const daysLeft = billing?.trialEndsAt
    ? Math.max(
        0,
        Math.ceil(
          (new Date(billing.trialEndsAt).getTime() - Date.now()) / 86400000,
        ),
      )
    : null;

  if (loading)
    return (
      <SafeAreaView style={s.safe} edges={['top']}>
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
        <View style={s.loader}>
          <ActivityIndicator size="large" color={C.primary} />
        </View>
      </SafeAreaView>
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
        <CreditCard size={20} color={C.primary} />
        <Text style={s.headerTitle}>Billing</Text>
      </View>

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
        {/* Current status card */}
        <View
          style={[
            s.statusCard,
            { borderColor: PLAN_COLOR[currentPlanId] || C.primary },
          ]}
        >
          <View
            style={[
              s.statusIcon,
              { backgroundColor: PLAN_COLOR[currentPlanId] || C.primary },
            ]}
          >
            {(() => {
              const Icon = PLAN_ICON[currentPlanId] || Zap;
              return <Icon size={20} color={C.white} />;
            })()}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.statusPlan}>{currentPlanId.toUpperCase()} PLAN</Text>
            <View style={s.statusRow}>
              {isActive ? (
                <>
                  <CheckCircle2 size={12} color={C.success} />
                  <Text style={[s.statusLabel, { color: C.success }]}>
                    Active
                  </Text>
                </>
              ) : billing?.status === 'trial' ? (
                <>
                  <AlertCircle size={12} color={C.warning} />
                  <Text style={[s.statusLabel, { color: C.warning }]}>
                    Trial{daysLeft !== null ? ` — ${daysLeft} days left` : ''}
                  </Text>
                </>
              ) : (
                <>
                  <AlertCircle size={12} color={C.danger} />
                  <Text style={[s.statusLabel, { color: C.danger }]}>
                    Inactive
                  </Text>
                </>
              )}
            </View>
          </View>
          {billing?.nextBillingDate && (
            <View style={s.nextBill}>
              <Calendar size={11} color={C.textMuted} />
              <Text style={s.nextBillText}>
                {new Date(billing.nextBillingDate).toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                })}
              </Text>
            </View>
          )}
        </View>

        {/* Trial banner */}
        {billing?.status === 'trial' && daysLeft !== null && daysLeft <= 7 && (
          <View style={s.trialBanner}>
            <AlertCircle size={14} color={C.warning} />
            <Text style={s.trialBannerText}>
              Trial ends in {daysLeft} day{daysLeft !== 1 ? 's' : ''}. Upgrade
              to keep access.
            </Text>
          </View>
        )}

        {/* Billing cycle toggle */}
        <View style={s.cycleRow}>
          {BILLING_CYCLES.map(c => (
            <TouchableOpacity
              key={c.key}
              style={[s.cycleBtn, cycle === c.key && s.cycleBtnActive]}
              onPress={() => setCycle(c.key as any)}
            >
              <Text
                style={[s.cycleBtnText, cycle === c.key && { color: C.white }]}
              >
                {c.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Plans */}
        <View>
          <Text style={s.sectionTitle}>Choose Your Plan</Text>
          <View style={{ gap: 10 }}>
            {plans.length === 0 ? (
              <View style={s.emptyPlans}>
                <ActivityIndicator color={C.primary} />
                <Text style={s.emptyPlansText}>Loading plans…</Text>
              </View>
            ) : (
              plans.map(plan => {
                const pid = plan.planType || plan._id;
                const isCurrent = pid === currentPlanId;
                const price =
                  cycle === 'yearly'
                    ? plan.yearlyPrice || plan.monthlyPrice * 10
                    : plan.monthlyPrice;
                const color = PLAN_COLOR[pid] || C.primary;
                const PlanIcon = PLAN_ICON[pid] || Zap;
                return (
                  <View
                    key={pid}
                    style={[
                      s.planCard,
                      isCurrent && { borderColor: color, borderWidth: 3 },
                    ]}
                  >
                    {isCurrent && (
                      <View
                        style={[s.currentBadge, { backgroundColor: color }]}
                      >
                        <Text style={s.currentBadgeText}>CURRENT PLAN</Text>
                      </View>
                    )}
                    <View style={s.planTop}>
                      <View style={[s.planIcon, { backgroundColor: color }]}>
                        <PlanIcon size={18} color={C.white} />
                      </View>
                      <View style={{ flex: 1, marginLeft: 12 }}>
                        <Text style={s.planName}>
                          {(plan.name || pid).toUpperCase()}
                        </Text>
                        <Text style={s.planDesc} numberOfLines={1}>
                          {plan.description || ''}
                        </Text>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <View style={s.priceRow}>
                          <IndianRupee size={14} color={C.black} />
                          <Text style={s.price}>
                            {(price || 0).toLocaleString()}
                          </Text>
                        </View>
                        <Text style={s.priceCycle}>
                          /{cycle === 'yearly' ? 'yr' : 'mo'}
                        </Text>
                      </View>
                    </View>

                    {plan.features && plan.features.length > 0 && (
                      <View style={s.featureList}>
                        {plan.features
                          .slice(0, 4)
                          .map((f: string, i: number) => (
                            <View key={i} style={s.featureRow}>
                              <Check size={12} color={color} />
                              <Text style={s.featureText}>{f}</Text>
                            </View>
                          ))}
                      </View>
                    )}

                    <TouchableOpacity
                      style={[
                        s.upgradeBtn,
                        { backgroundColor: isCurrent ? '#F3F4F6' : color },
                      ]}
                      onPress={() => handleUpgrade(pid)}
                      disabled={isCurrent || upgrading === pid}
                    >
                      {upgrading === pid ? (
                        <ActivityIndicator
                          color={isCurrent ? C.textMuted : C.white}
                          size="small"
                        />
                      ) : (
                        <Text
                          style={[
                            s.upgradeBtnText,
                            isCurrent && { color: C.textMuted },
                          ]}
                        >
                          {isCurrent ? 'Current Plan' : 'Upgrade Now'}
                        </Text>
                      )}
                    </TouchableOpacity>
                  </View>
                );
              })
            )}
          </View>
        </View>

        {/* Invoices */}
        {invoices.length > 0 && (
          <View>
            <Text style={s.sectionTitle}>Invoice History</Text>
            <View style={s.invoiceCard}>
              {invoices.slice(0, 5).map((inv: any, i: number) => (
                <View
                  key={inv._id || i}
                  style={[s.invoiceRow, i > 0 && s.invoiceBorder]}
                >
                  <View style={s.invoiceLeft}>
                    <Text style={s.invoicePlan}>
                      {(inv.plan || 'Plan').toUpperCase()}
                    </Text>
                    <Text style={s.invoiceDate}>
                      {new Date(inv.createdAt || inv.date).toLocaleDateString(
                        'en-IN',
                        { day: 'numeric', month: 'short', year: 'numeric' },
                      )}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 6 }}>
                    <View style={s.invoiceAmount}>
                      <IndianRupee size={11} color={C.black} />
                      <Text style={s.invoiceAmountText}>
                        {(inv.amount || 0).toLocaleString()}
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
                          {(inv.status || 'paid').toUpperCase()}
                        </Text>
                      </View>
                      <TouchableOpacity
                        style={s.downloadBtn}
                        onPress={() => downloadInvoice(inv)}
                        disabled={downloading === inv._id}
                      >
                        {downloading === inv._id ? (
                          <ActivityIndicator size={10} color={C.white} />
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
          </View>
        )}
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
  headerTitle: { fontSize: 20, fontWeight: '700', color: C.black },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.white,
    borderWidth: 2,
    padding: 14,
    gap: 12,
  },
  statusIcon: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: C.black,
  },
  statusPlan: { fontSize: 14, fontWeight: '700', color: C.black },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  statusLabel: { fontSize: 12, fontWeight: '600' },
  nextBill: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  nextBillText: { fontSize: 11, fontWeight: '600', color: C.textMuted },
  trialBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFF7ED',
    borderWidth: 2,
    borderColor: C.warning,
    padding: 12,
  },
  trialBannerText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#92400E',
    flex: 1,
  },
  cycleRow: {
    flexDirection: 'row',
    backgroundColor: C.white,
    borderWidth: 2,
    borderColor: C.black,
  },
  cycleBtn: { flex: 1, paddingVertical: 10, alignItems: 'center' },
  cycleBtnActive: { backgroundColor: C.primary },
  cycleBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: C.black,
    textTransform: 'uppercase',
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
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
    borderColor: C.black,
  },
  emptyPlansText: { fontSize: 13, fontWeight: '600', color: C.textMuted },
  planCard: {
    backgroundColor: C.white,
    borderWidth: 2,
    borderColor: C.black,
    padding: 14,
  },
  currentBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 2,
    borderColor: C.black,
    marginBottom: 10,
  },
  currentBadgeText: {
    fontSize: 9,
    fontWeight: '700',
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
    borderColor: C.black,
  },
  planName: { fontSize: 14, fontWeight: '700', color: C.black },
  planDesc: {
    fontSize: 11,
    color: C.textMuted,
    fontWeight: '500',
    marginTop: 2,
  },
  priceRow: { flexDirection: 'row', alignItems: 'center' },
  price: { fontSize: 20, fontWeight: '700', color: C.black },
  priceCycle: {
    fontSize: 12,
    fontWeight: '600',
    color: C.textMuted,
    marginTop: 2,
  },
  featureList: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    gap: 5,
  },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  featureText: { fontSize: 12, fontWeight: '500', color: C.black },
  upgradeBtn: {
    marginTop: 12,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: C.black,
  },
  upgradeBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: C.white,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  invoiceCard: {
    backgroundColor: C.white,
    borderWidth: 2,
    borderColor: C.black,
  },
  invoiceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  invoiceBorder: { borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  invoiceLeft: { flex: 1 },
  invoicePlan: { fontSize: 12, fontWeight: '700', color: C.black },
  invoiceDate: {
    fontSize: 11,
    color: C.textMuted,
    fontWeight: '500',
    marginTop: 2,
  },
  invoiceAmount: { flexDirection: 'row', alignItems: 'center' },
  invoiceAmountText: { fontSize: 15, fontWeight: '700', color: C.black },
  invStatus: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 2,
    borderColor: C.black,
    marginTop: 4,
  },
  invStatusText: { fontSize: 8, fontWeight: '700', color: C.white },
  invoiceBottomRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  downloadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: C.primary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 2,
    borderColor: C.black,
  },
  downloadBtnText: { fontSize: 8, fontWeight: '700', color: C.white },
});

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Image,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Users,
  CheckCircle2,
  CalendarOff,
  Clock,
  Building2,
  Briefcase,
  TrendingUp,
  LogOut,
  RefreshCw,
  Bell,
  WifiOff,
} from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../contexts/AuthContext';
import { dashboardAPI, cachedRequest, localNotificationsAPI } from '../api/api';
import { C } from '../theme';

const CARD_WIDTH = (Dimensions.get('window').width - 32 - 10) / 2;

interface StatConfig {
  label: string;
  key: string;
  icon: any;
  color: string;
  bg: string;
}

const STATS: StatConfig[] = [
  {
    label: 'Total Employees',
    key: 'totalEmployees',
    icon: Users,
    color: C.primary,
    bg: '',
  },
  {
    label: 'Present Today',
    key: 'todayPresent',
    icon: CheckCircle2,
    color: C.success,
    bg: '',
  },
  {
    label: 'On Leave',
    key: 'todayOnLeave',
    icon: CalendarOff,
    color: C.warning,
    bg: '',
  },
  {
    label: 'Pending Leaves',
    key: 'pendingLeaves',
    icon: Clock,
    color: C.danger,
    bg: '',
  },
  {
    label: 'Departments',
    key: 'departments',
    icon: Building2,
    color: C.primary,
    bg: '',
  },
  {
    label: 'Open Positions',
    key: 'openPositions',
    icon: Briefcase,
    color: C.secondary,
    bg: '',
  },
];

export default function DashboardScreen() {
  const { user, logout } = useAuth();
  const navigation = useNavigation<any>();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fromCache, setFromCache] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const loadUnread = useCallback(async () => {
    const all = await localNotificationsAPI.getAll();
    setUnreadCount(all.filter(n => !n.read).length);
  }, []);

  const load = useCallback(async () => {
    setError(null);
    try {
      const { data: res, fromCache: cached } = await cachedRequest(
        'dashboard_stats',
        () => dashboardAPI.getStats(),
      );
      setFromCache(cached);
      const payload = res.data || res;
      setStats({
        ...payload.stats,
        recentActivity: payload.recentHires,
        deptHeadcounts: payload.deptHeadcounts,
        attTrend: payload.attTrend,
      });
    } catch (e: any) {
      setError(e.message || 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUnread();
  }, [loadUnread]);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const greet = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good Morning';
    if (h < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  const isAdmin = user?.role !== 'employee';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerAvatarWrap}>
          {user?.avatar ? (
            <Image source={{ uri: user.avatar }} style={styles.headerAvatar} />
          ) : (
            <View style={[styles.headerAvatar, styles.headerAvatarFallback]}>
              <Text style={styles.headerAvatarText}>
                {(user?.name || 'U')[0].toUpperCase()}
              </Text>
            </View>
          )}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.greet}>{greet()},</Text>
          <Text style={styles.name}>{user?.name || 'User'}</Text>
          {user?.company?.name && (
            <Text style={styles.company}>{user.company.name}</Text>
          )}
        </View>
        <View style={styles.headerRight}>
          <View style={styles.headerIcons}>
            <TouchableOpacity
              onPress={() => navigation.navigate('Notifications')}
              style={styles.bellBtn}
            >
              <Bell size={25} color={C.black} />
              {unreadCount > 0 && (
                <View style={styles.bellBadge}>
                  <Text style={styles.bellBadgeText}>
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {loading ? (
        <View style={styles.loaderWrap}>
          <ActivityIndicator size="large" color={C.primary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={C.primary}
            />
          }
          showsVerticalScrollIndicator={false}
        >
          {fromCache && (
            <View style={styles.cacheBanner}>
              <WifiOff size={12} color={C.warning} />
              <Text style={styles.cacheText}>
                Showing cached data — pull to refresh
              </Text>
            </View>
          )}
          {error && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity onPress={load}>
                <RefreshCw size={14} color={C.danger} />
              </TouchableOpacity>
            </View>
          )}

          {/* Stats Grid */}
          <Text style={styles.sectionLabel}>Overview</Text>
          <View style={styles.grid}>
            {STATS.map(s => {
              const Icon = s.icon;
              const val = stats?.[s.key] ?? '—';
              return (
                <View key={s.key} style={styles.statCard}>
                  <View
                    style={[styles.statIconWrap, { backgroundColor: s.color }]}
                  >
                    <Icon size={18} color={C.white} />
                  </View>
                  <Text style={styles.statValue}>{val}</Text>
                  <Text style={styles.statLabel}>{s.label}</Text>
                </View>
              );
            })}
          </View>

          {/* Attendance */}
          {/* {isAdmin && stats && (
            <>
              <Text style={styles.sectionLabel}>Today's Attendance</Text>
              <View style={styles.attendGrid}>
                {[
                  { label: 'Present', val: stats.todayPresent ?? 0, color: C.success, icon: CheckCircle2 },
                  { label: 'Absent',  val: stats.todayAbsent  ?? 0, color: C.danger,  icon: CalendarOff  },
                  { label: 'On Leave',val: stats.todayOnLeave ?? 0, color: C.warning, icon: Clock        },
                  { label: 'Late',    val: stats.todayLate    ?? 0, color: C.secondary,icon: TrendingUp  },
                ].map(item => {
                  const Icon = item.icon;
                  return (
                    <View key={item.label} style={styles.attendCard}>
                      <View style={[styles.attendIconWrap, { backgroundColor: item.color }]}>
                        <Icon size={14} color={C.white} />
                      </View>
                      <Text style={styles.attendVal}>{item.val}</Text>
                      <Text style={styles.attendLabel}>{item.label}</Text>
                    </View>
                  );
                })}
              </View>
            </>
          )} */}

          {/* Recent Hires */}
          {/* {isAdmin && stats?.recentActivity?.length > 0 && (
            <>
              <Text style={styles.sectionLabel}>Recent Hires</Text>
              <View style={styles.card}>
                {stats.recentActivity.slice(0, 5).map((item: any, i: number) => (
                  <View key={i} style={[styles.activityRow, i > 0 && styles.activityBorder]}>
                    <View style={[styles.activityDot, { backgroundColor: C.success }]} />
                    <Text style={styles.activityText} numberOfLines={1}>
                      {item.firstName} {item.lastName} — {item.designation || item.department?.name || 'New Employee'}
                    </Text>
                    <Text style={styles.activityTime}>
                      {item.joiningDate ? new Date(item.joiningDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : ''}
                    </Text>
                  </View>
                ))}
              </View>
            </>
          )} */}

          {/* Quick Stats */}
          {isAdmin && stats && (
            <>
              <Text style={styles.sectionLabel}>This Month</Text>
              <View style={styles.card}>
                {[
                  {
                    label: 'Payroll Processed',
                    val: stats.monthlyPayroll ?? '—',
                    icon: <TrendingUp size={14} color={C.success} />,
                  },
                  {
                    label: 'New Hires',
                    val: stats.newHires ?? '—',
                    icon: <Users size={14} color={C.primary} />,
                  },
                  {
                    label: 'Leave Requests',
                    val: stats.pendingLeaves ?? '—',
                    icon: <Clock size={14} color={C.warning} />,
                  },
                ].map((item, i) => (
                  <View
                    key={item.label}
                    style={[styles.quickRow, i > 0 && styles.quickBorder]}
                  >
                    <View style={styles.quickIcon}>{item.icon}</View>
                    <Text style={styles.quickLabel}>{item.label}</Text>
                    <Text style={styles.quickVal}>{item.val}</Text>
                  </View>
                ))}
              </View>
            </>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: C.white,
    borderBottomWidth: 2,
    borderBottomColor: C.black,
  },
  greet: { fontSize: 12, color: C.textMuted, fontWeight: '500' },
  name: { fontSize: 20, fontWeight: '700', color: C.black },
  company: { fontSize: 11, color: C.textMuted, fontWeight: '500' },
  headerRight: { alignItems: 'center', gap: 6, justifyContent: 'center' },
  roleText: { color: C.white, fontSize: 9, fontWeight: '700' },
  logoutBtn: { padding: 4 },
  headerIcons: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  bellBtn: { padding: 4, position: 'relative', marginTop: 12 },
  bellBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: C.danger,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  bellBadgeText: { color: C.white, fontSize: 9, fontWeight: '700' },
  cacheBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFBEB',
    borderWidth: 2,
    borderColor: C.warning,
    padding: 8,
    marginBottom: 12,
  },
  cacheText: { fontSize: 11, color: C.warning, fontWeight: '600', flex: 1 },
  loaderWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: 16, paddingBottom: 32 },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FEF2F2',
    borderWidth: 2,
    borderColor: C.danger,
    padding: 10,
    marginBottom: 16,
  },
  errorText: { fontSize: 12, color: C.danger, fontWeight: '700', flex: 1 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    color: C.textMuted,
    marginBottom: 10,
    marginTop: 4,
    letterSpacing: 0.5,
  },
  headerAvatarWrap: { marginRight: 10 , marginTop: 8},
  headerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: C.black,
  },
  headerAvatarFallback: {
    backgroundColor: C.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerAvatarText: { color: C.white, fontSize: 18, fontWeight: '700' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 8 },
  statCard: {
    width: CARD_WIDTH,
    borderWidth: 2,
    borderColor: C.black,
    backgroundColor: C.white,
    padding: 14,
  },
  statIconWrap: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    borderWidth: 2,
    borderColor: C.black,
  },
  statValue: { fontSize: 28, fontWeight: '700', color: C.black },
  statLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: C.black,
    marginTop: 2,
  },
  card: {
    backgroundColor: C.white,
    borderWidth: 2,
    borderColor: C.black,
    padding: 16,
    marginBottom: 8,
  },
  attendGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 8,
  },
  attendCard: {
    width: '47%',
    backgroundColor: C.white,
    borderWidth: 2,
    borderColor: C.black,
    padding: 14,
  },
  attendIconWrap: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: C.black,
    marginBottom: 8,
  },
  attendVal: { fontSize: 26, fontWeight: '700', color: C.black },
  attendLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: C.black,
    marginTop: 2,
  },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
    gap: 10,
  },
  activityBorder: { borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  activityDot: { width: 6, height: 6, borderRadius: 3 },
  activityText: { flex: 1, fontSize: 13, fontWeight: '500', color: C.black },
  activityTime: { fontSize: 11, color: C.textLight },
  quickRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 10,
  },
  quickBorder: { borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  quickIcon: {
    width: 28,
    height: 28,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickLabel: { flex: 1, fontSize: 13, fontWeight: '600', color: C.black },
  quickVal: { fontSize: 16, fontWeight: '700', color: C.black },
});

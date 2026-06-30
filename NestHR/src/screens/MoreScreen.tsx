import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { localNotificationsAPI, employeeAPI } from '../api/api';
import {
  IndianRupee,
  Briefcase,
  TrendingUp,
  Building2,
  Sun,
  CreditCard,
  BarChart2,
  Settings,
  ChevronRight,
  LogOut as LogOutIcon,
  Grid,
  KeyRound,
  Settings2,
  User,
  Cpu,
  Bell,
  ShieldAlert,
  Shield,
  LifeBuoy,
  FolderOpen,
  DoorOpen,
  MapPin,
} from 'lucide-react-native';
import { useAuth } from '../contexts/AuthContext';
import { C } from '../theme';

const MENU_ITEMS = [
  {
    key: 'Payroll',
    label: 'Payroll',
    icon: IndianRupee,
    desc: 'Manage salaries & payslips',
  },
  {
    key: 'Recruitment',
    label: 'Recruitment',
    icon: Briefcase,
    desc: 'Jobs & candidate pipeline',
  },
  {
    key: 'Performance',
    label: 'Performance',
    icon: TrendingUp,
    desc: 'Reviews & goals tracking',
  },
  {
    key: 'Departments',
    label: 'Departments',
    icon: Building2,
    desc: 'Manage teams & org structure',
  },
  {
    key: 'Holidays',
    label: 'Holidays',
    icon: Sun,
    desc: 'Company holidays calendar',
  },
  {
    key: 'Loans',
    label: 'Loans',
    icon: CreditCard,
    desc: 'Employee loan management',
  },
  {
    key: 'Reports',
    label: 'Reports',
    icon: BarChart2,
    desc: 'Analytics & export data',
  },
  {
    key: 'Documents',
    label: 'Document Vault',
    icon: FolderOpen,
    desc: 'Employee documents & files',
  },
  {
    key: 'Credentials',
    label: 'Credentials',
    icon: KeyRound,
    desc: 'Reset employee passwords',
  },
  {
    key: 'Manage',
    label: 'Manage',
    icon: Settings2,
    desc: 'Shifts, salary heads, designations',
  },
  {
    key: 'BiometricDevices',
    label: 'Biometric Devices',
    icon: Cpu,
    desc: 'Manage fingerprint & NFC machines',
  },
  {
    key: 'NfcManager',
    label: 'NFC Cards',
    icon: CreditCard,
    desc: 'Assign access cards to employees',
  },
  {
    key: 'PayrollSettings',
    label: 'Payroll Settings',
    icon: ShieldAlert,
    desc: 'Late & deduction rules',
  },
  {
    key: 'Notifications',
    label: 'Notifications',
    icon: Bell,
    desc: 'View recent alerts & activity',
  },
  {
    key: 'AuditLog',
    label: 'Audit Log',
    icon: Shield,
    desc: 'Track who changed what & when',
  },
  {
    key: 'Settings',
    label: 'Settings',
    icon: Settings,
    desc: 'Company & app configuration',
  },
  {
    key: 'Billing',
    label: 'Billing',
    icon: CreditCard,
    desc: 'Subscription & invoices',
  },
  {
    key: 'Support',
    label: 'Support',
    icon: LifeBuoy,
    desc: 'Report issues & track tickets',
  },
  {
    key: 'ExitManagement',
    label: 'Exit Management',
    icon: DoorOpen,
    desc: 'Offboarding, FnF & clearance',
  },
  {
    key: 'Branches',
    label: 'Branches',
    icon: MapPin,
    desc: 'Manage office locations & branches',
  },
  {
    key: 'Assets',
    label: 'My Assets',
    icon: Cpu,
    desc: 'Track company hardware',
  },
];

const EMPLOYEE_MENU_KEYS = new Set([
  'Payroll',
  'Holidays',
  'Notifications',
  'Support',
  'Documents',
  'Assets',
]);

export default function MoreScreen({ navigation }: any) {
  const { user, logout } = useAuth();
  const isEmployee = user?.role === 'employee';
  const [unreadCount, setUnreadCount] = useState(0);
  const [empProfile, setEmpProfile] = useState<any>(null);

  useEffect(() => {
    if (isEmployee) {
      employeeAPI
        .getMe()
        .then(res => setEmpProfile(res?.data || res))
        .catch(() => {});
    }
  }, [isEmployee]);

  const avatarUri = empProfile?.avatar || user?.avatar;

  useFocusEffect(
    useCallback(() => {
      localNotificationsAPI.getAll().then(all => {
        setUnreadCount(all.filter(n => !n.read).length);
      });
    }, []),
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Grid size={20} color={C.primary} />
          <Text style={styles.headerTitle}>More</Text>
        </View>
        <TouchableOpacity
          style={styles.bellBtn}
          onPress={() => navigation.navigate('Notifications')}
        >
          <Bell size={20} color={C.black} />
          {unreadCount > 0 && (
            <View style={styles.bellBadge}>
              <Text style={styles.bellBadgeText}>
                {unreadCount > 9 ? '9+' : unreadCount}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* User info strip */}
      <TouchableOpacity
        style={styles.userStrip}
        onPress={() => navigation.navigate('Profile')}
        activeOpacity={0.8}
      >
        {user?.avatar ? (
          <Image source={{ uri: user.avatar }} style={styles.userAvatar} />
        ) : (
          <View style={[styles.userAvatar]}>
            <Text style={styles.userAvatarText}>
              {(user?.name || 'U')[0].toUpperCase()}
            </Text>
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={styles.userName}>{user?.name || 'User'}</Text>
          <Text style={styles.userRole}>
            {user?.role?.replace(/_/g, ' ').toUpperCase() || 'EMPLOYEE'}
          </Text>
        </View>
        <View style={styles.profileBtn}>
          <User size={14} color={C.primary} />
          <Text style={styles.profileBtnText}>Edit</Text>
        </View>
        <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
          <LogOutIcon size={16} color={C.danger} />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </TouchableOpacity>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.menuCard}>
          {MENU_ITEMS.filter(
            item => !isEmployee || EMPLOYEE_MENU_KEYS.has(item.key),
          ).map((item, i, arr) => {
            const Icon = item.icon;
            const label =
              isEmployee && item.key === 'Payroll' ? 'My Payslips' : item.label;
            const desc =
              isEmployee && item.key === 'Payroll'
                ? 'View your salary payslips'
                : item.desc;
            return (
              <TouchableOpacity
                key={item.key}
                style={[
                  styles.menuRow,
                  i < arr.length - 1 && styles.menuBorder,
                ]}
                onPress={() => navigation.navigate(item.key)}
                activeOpacity={0.7}
              >
                <View style={styles.menuIconWrap}>
                  <Icon size={18} color={C.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.menuLabel}>{label}</Text>
                  <Text style={styles.menuDesc}>{desc}</Text>
                </View>
                <ChevronRight size={16} color="#D1D5DB" />
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={styles.versionText}>NestHR v1.0.0</Text>
      </ScrollView>
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
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle: { fontSize: 20, fontWeight: '700', color: C.black },
  userStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.white,
    borderBottomWidth: 2,
    borderBottomColor: C.black,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  userAvatar: {
    width: 44,
    height: 44,
    backgroundColor: C.primary,
    borderWidth: 2,
    borderColor: C.black,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userAvatarText: { color: C.white, fontSize: 18, fontWeight: '700' },
  userAvatarPhoto: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: C.black,
  },
  userName: { fontSize: 15, fontWeight: '700', color: C.black },
  userRole: {
    fontSize: 12,
    fontWeight: '700',
    color: C.textMuted,
    letterSpacing: 0.5,
    marginTop: 2,
  },
  profileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 2,
    borderColor: C.primary,
    paddingHorizontal: 8,
    paddingVertical: 6,
    marginRight: 8,
  },
  profileBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: C.primary,
    textTransform: 'uppercase',
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 2,
    borderColor: C.danger,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  logoutText: {
    fontSize: 12,
    fontWeight: '700',
    color: C.danger,
    textTransform: 'uppercase',
  },
  menuCard: { backgroundColor: C.white, borderWidth: 2, borderColor: C.black },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 14,
  },
  menuBorder: { borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  menuIconWrap: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EFF6FF',
    borderWidth: 2,
    borderColor: C.black,
  },
  menuLabel: { fontSize: 14, fontWeight: '700', color: C.black },
  menuDesc: {
    fontSize: 11,
    color: C.textMuted,
    fontWeight: '500',
    marginTop: 2,
  },
  versionText: {
    textAlign: 'center',
    fontSize: 11,
    color: C.textLight,
    fontWeight: '500',
    marginTop: 20,
  },
  bellBtn: { padding: 4, position: 'relative' },
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
});

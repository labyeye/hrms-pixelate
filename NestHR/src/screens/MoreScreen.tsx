import { sentence } from '../utils/text';
import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  StatusBar,
} from 'react-native';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { localNotificationsAPI, employeeAPI } from '../api/api';
import {
  IndianRupee,
  TrendingUp,
  Building2,
  Sun,
  CreditCard,
  Coins,
  BarChart2,
  Settings,
  LogOut as LogOutIcon,
  Search,
  KeyRound,
  Settings2,
  User,
  Cpu,
  Bell,
  ShieldAlert,
  AlertOctagon,
  Shield,
  LifeBuoy,
  FolderOpen,
  DoorOpen,
  ListChecks,
  Megaphone,
  Trash2,
  Receipt,
  LayoutGrid,
  Crown,
} from 'lucide-react-native';
import { useAuth } from '../contexts/AuthContext';
import { C, useResponsive } from '../theme';
import HeaderIconBtn from '../components/common/HeaderIconBtn';
import SearchModal from '../components/common/SearchModal';
import SlideInCard from '../components/motion/SlideInCard';

const MENU_ITEMS = [
  { key: 'Payroll', label: 'Payroll', icon: IndianRupee },
  { key: 'Performance', label: 'Performance', icon: TrendingUp },
  { key: 'Departments', label: 'Departments', icon: Building2 },
  { key: 'Holidays', label: 'Holidays', icon: Sun },
  { key: 'Loans', label: 'Loans', icon: CreditCard },
  { key: 'Expenses', label: 'Expenses', icon: Receipt },
  { key: 'Reports', label: 'Reports', icon: BarChart2 },
  { key: 'Documents', label: 'Document Vault', icon: FolderOpen },
  { key: 'Credentials', label: 'Credentials', icon: KeyRound },
  { key: 'Manage', label: 'Manage', icon: Settings2 },
  { key: 'BiometricDevices', label: 'Biometric Devices', icon: Cpu },
  { key: 'NfcManager', label: 'NFC Cards', icon: CreditCard },
  {
    key: 'AttendanceSettings',
    label: 'Attendance Settings',
    icon: ShieldAlert,
  },
  { key: 'LateApprovals', label: 'Late Approvals', icon: AlertOctagon },
  { key: 'Notifications', label: 'Notifications', icon: Bell },
  { key: 'AuditLog', label: 'Audit Log', icon: Shield },
  { key: 'AccountSecurity', label: 'Account Security', icon: Shield },
  { key: 'Settings', label: 'Settings', icon: Settings },
  { key: 'Billing', label: 'Billing', icon: CreditCard },
  { key: 'Credits', label: 'WhatsApp Credits', icon: Coins },
  { key: 'Support', label: 'Support', icon: LifeBuoy },
  { key: 'ExitManagement', label: 'Exit Management', icon: DoorOpen },
  { key: 'Assets', label: 'My Assets', icon: Cpu },
  { key: 'Tasks', label: 'Tasks', icon: ListChecks },
  { key: 'Announcements', label: 'Announcements', icon: Megaphone },
  { key: 'Trash', label: 'Trash', icon: Trash2 },
];

// Only these roles may open Trash (matches the backend).
const TRASH_ROLES = ['super_admin', 'hr_manager'];

const GROUPS: { title: string; color: string; keys: string[] }[] = [
  {
    title: 'People & Work',
    color: C.primary,
    keys: [
      'Departments',
      'Branches',
      'Tasks',
      'Announcements',
      'Holidays',
      'Assets',
    ],
  },
  {
    title: 'Payroll & Growth',
    color: '#22c55e',
    keys: ['Payroll', 'Loans', 'Expenses', 'Performance', 'Reports'],
  },
  {
    title: 'Attendance',
    color: '#FF751F',
    keys: [
      'AttendanceSettings',
      'LateApprovals',
      'BiometricDevices',
      'NfcManager',
      'Manage',
    ],
  },
  {
    title: 'Documents & Exit',
    color: C.primary,
    keys: ['Documents', 'ExitManagement', 'Credentials'],
  },
  {
    title: 'Account',
    color: '#FF751F',
    keys: [
      'Notifications',
      'AccountSecurity',
      'Settings',
      'Billing',
      'Credits',
      'Support',
    ],
  },
  { title: 'Admin', color: '#000000', keys: ['AuditLog', 'Trash'] },
];

export default function MoreScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { isTablet, maxContentWidth } = useResponsive();

  const { user, logout } = useAuth();
  const isEmployee = user?.role === 'employee';
  const [unreadCount, setUnreadCount] = useState(0);
  const [empProfile, setEmpProfile] = useState<any>(null);
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);

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

  const q = query.trim().toLowerCase();
  const visible = MENU_ITEMS.filter(
    item => item.key !== 'Trash' || TRASH_ROLES.includes(user?.role || ''),
  ).map(item => ({
    ...item,
    label:
      isEmployee && item.key === 'Payroll'
        ? 'My Payslips'
        : isEmployee && item.key === 'Loans'
        ? 'My Loans'
        : item.label,
  }));

  const sections = GROUPS.map(g => ({
    ...g,
    items: g.keys
      .map(k => visible.find(i => i.key === k))
      .filter(
        (i): i is (typeof visible)[number] =>
          !!i && (!q || i.label.toLowerCase().includes(q)),
      ),
  })).filter(g => g.items.length > 0);

  const handleLogout = () =>
    Alert.alert('Logout', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', style: 'destructive', onPress: () => logout() },
    ]);

  let cardIdx = 1;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor={C.white} />

      {/* Header matching EmployeesScreen */}
      <View
        style={[
          styles.header,
          isTablet && {
            maxWidth: maxContentWidth,
            width: '100%',
            alignSelf: 'center',
          },
        ]}
      >
        <View style={styles.headerLeft}>
          <LayoutGrid size={20} color={C.primary} />
          <Text style={styles.headerTitle}>More</Text>
        </View>

        <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
          <HeaderIconBtn
            label="Search"
            icon={<Search size={22} color={C.black} />}
            dot={!!query}
            onPress={() => setSearchOpen(true)}
          />

          <TouchableOpacity
            style={styles.bellBtn}
            onPress={() => navigation.navigate('Notifications')}
            accessibilityLabel="Notifications"
            hitSlop={8}
          >
            <Bell size={22} color={C.black} />
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

      {/* SearchModal matching EmployeesScreen */}
      <SearchModal
        visible={searchOpen}
        onClose={() => setSearchOpen(false)}
        value={query}
        onChange={setQuery}
        placeholder="Search features…"
        items={visible.map(item => ({
          key: item.key,
          title: item.label,
          subtitle:
            GROUPS.find(g => g.keys.includes(item.key))?.title || undefined,
        }))}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: insets.bottom + 32 },
          isTablet && {
            maxWidth: maxContentWidth,
            width: '100%',
            alignSelf: 'center',
          },
        ]}
      >
        {/* Profile hero wrapped in SlideInCard with Premium badge */}
        <SlideInCard index={0}>
          <View style={styles.hero}>
            <View style={styles.heroRow}>
              <View style={styles.avatarWrap}>
                {avatarUri ? (
                  <Image
                    source={{ uri: avatarUri }}
                    style={styles.userAvatar}
                  />
                ) : (
                  <View style={styles.userAvatar}>
                    <Text style={styles.userAvatarText}>
                      {(user?.name || 'U')[0].toUpperCase()}
                    </Text>
                  </View>
                )}
                <View style={styles.premiumAvatarBadge}>
                  <Crown size={12} color="#000" fill="#ffffff" />
                </View>
              </View>

              <View style={{ flex: 1 }}>
                <Text style={styles.profileName} numberOfLines={1}>
                  {user?.name || 'User'}
                </Text>
                {!!user?.email && (
                  <Text style={styles.profileEmail} numberOfLines={1}>
                    {user.email}
                  </Text>
                )}
                <View style={styles.premiumPill}>
                  <Text style={styles.premiumPillText}>{user?.role}</Text>
                </View>
              </View>

              {/* Right-side icon-only action buttons */}
              <View style={styles.heroActions}>
                <TouchableOpacity
                  style={[styles.iconBtn, { backgroundColor: '#eff6ff' }]}
                  onPress={() => navigation.navigate('Profile')}
                  activeOpacity={0.8}
                >
                  <User size={18} color={C.primary} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.iconBtn, { backgroundColor: '#fef2f2' }]}
                  onPress={handleLogout}
                  activeOpacity={0.8}
                >
                  <LogOutIcon size={18} color={C.danger} />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </SlideInCard>

        {/* Grouped 3-column tiles with staggered SlideInCard */}
        {sections.map(g => (
          <View key={g.title}>
            <View style={styles.grid}>
              {g.items.map(item => {
                const Icon = item.icon;
                const currentIdx = cardIdx++;
                return (
                  <SlideInCard
                    key={item.key}
                    index={currentIdx}
                    style={styles.tileWrap}
                  >
                    <TouchableOpacity
                      style={styles.tile}
                      activeOpacity={0.8}
                      onPress={() => navigation.navigate(item.key)}
                    >
                      <View
                        style={[
                          styles.tileIcon,
                          {
                            backgroundColor: g.color + '1A',
                            borderColor: g.color,
                          },
                        ]}
                      >
                        <Icon size={22} color={g.color} />
                      </View>
                      <Text style={styles.tileLabel} numberOfLines={1}>
                        {item.label}
                      </Text>
                    </TouchableOpacity>
                  </SlideInCard>
                );
              })}
            </View>
          </View>
        ))}

        {sections.length === 0 && (
          <View style={styles.empty}>
            <Search size={36} color="#cbd5e1" />
            <Text style={styles.emptyText}>No features match "{query}"</Text>
          </View>
        )}

        <Text style={styles.versionText}>NestHR v1.0.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const box = {
  borderWidth: 2,
  borderRadius: 8,
  borderRightWidth: 4,
  borderBottomWidth: 4,
  borderRightColor: '#0A0A0A',
  borderBottomColor: '#0A0A0A',
  borderColor: C.black,
} as const;

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
  headerTitle: { fontSize: 20, fontWeight: '400', color: C.black },
  scroll: { padding: 16, gap: 16 },

  hero: { ...box, backgroundColor: C.white, padding: 14 },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatarWrap: {
    position: 'relative',
  },
  userAvatar: {
    width: 56,
    height: 56,
    backgroundColor: C.primary,
    borderWidth: 2,
    borderRightWidth: 4,
    borderBottomWidth: 4,
    borderRightColor: '#0A0A0A',
    borderBottomColor: '#0A0A0A',
    borderRadius: 8,
    borderColor: C.black,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userAvatarText: { color: C.white, fontSize: 22, fontWeight: '400' },
  premiumAvatarBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#FFDE00',
    borderWidth: 2,
    borderColor: C.black,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileName: { fontSize: 16, fontWeight: '400', color: C.black },
  profileEmail: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '400',
    marginTop: 2,
  },
  premiumPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
    backgroundColor: '#ffffff',
    borderWidth: 2,
    borderColor: C.black,
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  premiumPillText: {
    fontSize: 10,
    fontWeight: '400',
    color: C.black,
  },
  heroActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconBtn: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: C.black,
    borderRadius: 8,
  },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tileWrap: {
    width: '31.3%',
  },
  tile: {
    ...box,
    backgroundColor: C.white,
    width: '100%',
    paddingVertical: 12,
    paddingHorizontal: 6,
    gap: 6,
    alignItems: 'center',
  },
  tileIcon: {
    width: 42,
    height: 42,
    borderWidth: 2,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  tileLabel: {
    fontSize: 12,
    fontWeight: '400',
    color: C.black,
    textAlign: 'center',
  },
  empty: { alignItems: 'center', paddingVertical: 40, gap: 8 },
  emptyText: { fontSize: 14, fontWeight: '400', color: '#6B7280' },
  versionText: {
    textAlign: 'center',
    fontSize: 11,
    color: C.textLight,
    fontWeight: '400',
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
    paddingHorizontal: 4,
  },
  bellBadgeText: { color: C.white, fontSize: 11, fontWeight: '400' },
});

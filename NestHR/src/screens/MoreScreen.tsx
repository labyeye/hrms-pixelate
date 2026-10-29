import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  TextInput,
  Alert,
  Dimensions,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
  X,
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
  MapPin,
  ListChecks,
  Megaphone,
  Trash2,
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
    key: 'AttendanceSettings',
    label: 'Attendance Settings',
    icon: ShieldAlert,
    desc: 'Shift, late & leave allowance rules',
  },
  {
    key: 'LateApprovals',
    label: 'Late Approvals',
    icon: AlertOctagon,
    desc: 'Resolve late check-ins over allowance',
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
    key: 'AccountSecurity',
    label: 'Account Security',
    icon: Shield,
    desc: 'Passkey, devices, backup codes & verification',
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
    key: 'Credits',
    label: 'WhatsApp Credits',
    icon: Coins,
    desc: 'Balance & message usage',
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
    key: 'Assets',
    label: 'My Assets',
    icon: Cpu,
    desc: 'Track company hardware',
  },
  {
    key: 'Tasks',
    label: 'Tasks',
    icon: ListChecks,
    desc: 'Assign & track work',
  },
  {
    key: 'Announcements',
    label: 'Announcements',
    icon: Megaphone,
    desc: 'Company news & notices',
  },
  {
    key: 'Trash',
    label: 'Trash',
    icon: Trash2,
    desc: 'Restore deleted items',
  },
];

// Only these roles may open Trash (matches the backend).
const TRASH_ROLES = ['super_admin', 'hr_manager'];

const EMPLOYEE_MENU_KEYS = new Set([
  'AccountSecurity',
  'Payroll',
  'Holidays',
  'Loans',
  'Notifications',
  'Support',
  'Documents',
  'Assets',
  'Tasks',
  'Announcements',
]);

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
    keys: ['Payroll', 'Loans', 'Performance', 'Reports'],
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

const TILE_W = (Dimensions.get('window').width - 32 - 12) / 2;

export default function MoreScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();
  const isEmployee = user?.role === 'employee';
  const [unreadCount, setUnreadCount] = useState(0);
  const [empProfile, setEmpProfile] = useState<any>(null);
  const [query, setQuery] = useState('');

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
    item =>
      (!isEmployee || EMPLOYEE_MENU_KEYS.has(item.key)) &&
      (item.key !== 'Trash' || TRASH_ROLES.includes(user?.role || '')),
  ).map(item => ({
    ...item,
    label:
      isEmployee && item.key === 'Payroll'
        ? 'My Payslips'
        : isEmployee && item.key === 'Loans'
          ? 'My Loans'
          : item.label,
    desc:
      isEmployee && item.key === 'Payroll'
        ? 'View your salary payslips'
        : isEmployee && item.key === 'Loans'
          ? 'Request a loan or salary advance'
          : item.desc,
  }));

  const sections = GROUPS.map(g => ({
    ...g,
    items: g.keys
      .map(k => visible.find(i => i.key === k))
      .filter(
        (i): i is (typeof visible)[number] =>
          !!i &&
          (!q ||
            i.label.toLowerCase().includes(q) ||
            i.desc.toLowerCase().includes(q)),
      ),
  })).filter(g => g.items.length > 0);

  const handleLogout = () =>
    Alert.alert('Logout', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', style: 'destructive', onPress: () => logout() },
    ]);

  return (
    <View style={[styles.safe, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>More</Text>
        <TouchableOpacity
          style={styles.bellBtn}
          onPress={() => navigation.navigate('Notifications')}
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

      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: insets.bottom + 32 },
        ]}
      >
        {/* Profile hero */}
        <View style={styles.hero}>
          <View style={styles.heroTop}>
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={styles.userAvatar} />
            ) : (
              <View style={styles.userAvatar}>
                <Text style={styles.userAvatarText}>
                  {(user?.name || 'U')[0].toUpperCase()}
                </Text>
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={styles.profileName} numberOfLines={1}>
                {user?.name || 'User'}
              </Text>
              {!!user?.email && (
                <Text style={styles.profileEmail} numberOfLines={1}>
                  {user.email}
                </Text>
              )}
              <View style={styles.rolePill}>
                <Text style={styles.roleText}>
                  {(user?.role || 'employee').replace(/_/g, ' ').toUpperCase()}
                </Text>
              </View>
            </View>
          </View>
          <View style={styles.heroBtns}>
            <TouchableOpacity
              style={[styles.heroBtn, { backgroundColor: '#eff6ff' }]}
              onPress={() => navigation.navigate('Profile')}
            >
              <User size={15} color={C.primary} />
              <Text style={[styles.heroBtnText, { color: C.primary }]}>
                Profile
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.heroBtn, { backgroundColor: '#fef2f2' }]}
              onPress={handleLogout}
            >
              <LogOutIcon size={15} color={C.danger} />
              <Text style={[styles.heroBtnText, { color: C.danger }]}>
                Logout
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Search */}
        <View style={styles.searchBox}>
          <Search size={16} color="#000" />
          <TextInput
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder="Search features..."
            placeholderTextColor="#64748b"
            autoCapitalize="none"
            autoCorrect={false}
          />
          {!!query && (
            <TouchableOpacity onPress={() => setQuery('')} hitSlop={8}>
              <X size={16} color="#000" />
            </TouchableOpacity>
          )}
        </View>

        {/* Grouped tiles */}
        {sections.map(g => (
          <View key={g.title}>
            <View style={styles.sectionHead}>
              <Text style={styles.sectionTitle}>{g.title.toUpperCase()}</Text>
              <View style={styles.sectionLine} />
            </View>
            <View style={styles.grid}>
              {g.items.map(item => {
                const Icon = item.icon;
                return (
                  <TouchableOpacity
                    key={item.key}
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
                    <Text style={styles.tileSub} numberOfLines={2}>
                      {item.desc}
                    </Text>
                  </TouchableOpacity>
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
    </View>
  );
}

const box = {
  borderWidth: 2,
  borderRadius: 8,
  borderRightWidth: 5,
  borderBottomWidth: 5,
  borderRightColor: '#0A0A0A',
  borderBottomColor: '#0A0A0A',
  borderColor: '#000',
} as const;

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  header: {
    height: 56,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  headerTitle: { fontSize: 24, fontWeight: '400', color: '#000' },
  scroll: { padding: 16, gap: 18 },

  hero: { ...box, backgroundColor: '#fff', padding: 14, gap: 14 },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  userAvatar: {
    width: 64,
    height: 64,
    backgroundColor: C.primary,
    borderWidth: 2,
    borderRightWidth: 4,
    borderBottomWidth: 4,
    borderRightColor: '#0A0A0A',
    borderBottomColor: '#0A0A0A',
    borderRadius: 8,
    borderColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  userAvatarText: { color: '#fff', fontSize: 26, fontWeight: '400' },
  profileName: { fontSize: 18, fontWeight: '400', color: '#000' },
  profileEmail: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '400',
    marginTop: 2,
  },
  rolePill: {
    alignSelf: 'flex-start',
    marginTop: 8,
    backgroundColor: '#FFDE00',
    borderWidth: 2,
    borderColor: '#000',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  roleText: { fontSize: 10, fontWeight: '400', color: '#000' },
  heroBtns: { flexDirection: 'row', gap: 10 },
  heroBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderWidth: 2,
    borderColor: '#000',
    borderRadius: 8,
  },
  heroBtnText: { fontSize: 13, fontWeight: '400' },

  searchBox: {
    ...box,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    backgroundColor: '#fff',
  },
  searchInput: {
    flex: 1,
    paddingVertical: 11,
    fontSize: 14,
    color: '#000',
    fontWeight: '400',
  },

  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '400',
    color: '#000',
    letterSpacing: 1,
  },
  sectionLine: {
    flex: 1,
    height: 2,
    backgroundColor: '#000',
    marginLeft: 4,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  tile: {
    ...box,
    width: TILE_W,
    backgroundColor: '#fff',
    padding: 12,
    gap: 6,
    minHeight: 124,
  },
  tileIcon: {
    width: 44,
    height: 44,
    borderWidth: 2,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  tileLabel: { fontSize: 14, fontWeight: '400', color: '#000' },
  tileSub: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '400',
    lineHeight: 15,
  },

  empty: { alignItems: 'center', paddingVertical: 40, gap: 8 },
  emptyText: { fontSize: 14, fontWeight: '400', color: '#64748b' },
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
    paddingHorizontal: 3,
  },
  bellBadgeText: { color: '#fff', fontSize: 9, fontWeight: '400' },
});

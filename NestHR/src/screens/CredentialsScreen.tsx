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
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  KeyRound,
  Search,
  X,
  Eye,
  EyeOff,
  RefreshCw,
  Users,
  ChevronLeft,
} from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { employeeAPI } from '../api/api';
import HeaderIconBtn from '../components/common/HeaderIconBtn';
import SearchModal from '../components/common/SearchModal';
import SlideInCard from '../components/motion/SlideInCard';
import { C, useResponsive } from '../theme';
import { CENTER } from '../components/common/centerModal';

function genPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789@#$!';
  return Array.from(
    { length: 12 },
    () => chars[Math.floor(Math.random() * chars.length)],
  ).join('');
}

export default function CredentialsScreen() {
  const navigation = useNavigation<any>();
  const { isTablet, maxContentWidth } = useResponsive();
  const [employees, setEmployees] = useState<any[]>([]);
  const [filtered, setFiltered] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [modal, setModal] = useState<{ emp: any } | null>(null);
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await employeeAPI.getAll();
      setEmployees(res.data || []);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const q = search.toLowerCase();
    setFiltered(
      q
        ? employees.filter(
            e =>
              `${e.firstName} ${e.lastName}`.toLowerCase().includes(q) ||
              (e.email || '').toLowerCase().includes(q) ||
              (e.employeeId || '').toLowerCase().includes(q),
          )
        : employees,
    );
  }, [search, employees]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const openReset = (emp: any) => {
    setPassword('');
    setShowPw(false);
    setModal({ emp });
  };

  const handleReset = async () => {
    if (!modal || !password.trim()) {
      Alert.alert('Validation', 'Password is required (min 6 chars)');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Validation', 'Password must be at least 6 characters');
      return;
    }
    setSaving(true);
    try {
      await employeeAPI.resetPassword(modal.emp._id, password);
      Alert.alert(
        'Success',
        `Password reset for ${modal.emp.firstName} ${modal.emp.lastName}`,
      );
      setModal(null);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View
        style={[
          s.header,
          isTablet && {
            maxWidth: maxContentWidth,
            width: '100%',
            alignSelf: 'center',
          },
        ]}
      >
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={{ padding: 4, marginRight: 2 }}
          hitSlop={8}
        >
          <ChevronLeft size={22} color={C.black} />
        </TouchableOpacity>
        <KeyRound size={20} color={C.primary} />
        <Text style={s.title}>Credentials</Text>
        <View style={{ flex: 1 }} />
        <HeaderIconBtn
          label="Search"
          icon={<Search size={22} color={C.black} />}
          dot={!!search}
          onPress={() => setSearchOpen(true)}
        />
      </View>

      <SearchModal
        visible={searchOpen}
        onClose={() => setSearchOpen(false)}
        value={search}
        onChange={setSearch}
        placeholder="Search by name, email or ID…"
        items={employees.map(e => ({
          key: e._id,
          title: `${e.firstName} ${e.lastName}`.trim(),
          subtitle: [e.employeeId, e.email].filter(Boolean).join(' · '),
        }))}
      />

      {loading ? (
        <View style={s.loader}>
          <ActivityIndicator size="large" color={C.primary} />
        </View>
      ) : (
        <FlatList
          key={isTablet ? 'tablet-grid-2' : 'mobile-list'}
          data={filtered}
          keyExtractor={item => item._id}
          numColumns={isTablet ? 2 : 1}
          columnWrapperStyle={isTablet ? s.colWrapper : undefined}
          contentContainerStyle={[
            { padding: 16, gap: 10, paddingBottom: 32 },
            isTablet && {
              maxWidth: maxContentWidth,
              width: '100%',
              alignSelf: 'center',
            },
          ]}
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
              <Users size={40} color="#D1D5DB" />
              <Text style={s.emptyText}>No employees found</Text>
            </View>
          }
          renderItem={({ item, index }) => (
            <SlideInCard
              index={index}
              style={isTablet ? s.cardTablet : undefined}
            >
              <View style={s.card}>
                {item.avatar ? (
                  <Image source={{ uri: item.avatar }} style={s.photoCircle} />
                ) : (
                  <View style={s.cardAvatar}>
                    <Text style={s.cardAvatarText}>
                      {item.firstName?.[0]}
                      {item.lastName?.[0]}
                    </Text>
                  </View>
                )}

                <View style={{ flex: 1, marginLeft: 10 }}>
                  <View style={s.nameRow}>
                    {!!item.employeeId && (
                      <Text style={s.codeChip}>{item.employeeId}</Text>
                    )}
                    <Text style={s.empName} numberOfLines={1}>
                      {item.firstName} {item.lastName}
                    </Text>
                  </View>
                  <Text style={s.empSub} numberOfLines={1}>
                    {item.email}
                  </Text>
                  <Text style={s.empMeta} numberOfLines={1}>
                    {item.designation || 'Staff'} · Updated{' '}
                    {new Date(
                      item.updatedAt || item.joinDate || Date.now(),
                    ).toLocaleDateString('en-IN', {
                      day: '2-digit',
                      month: 'short',
                    })}
                  </Text>
                </View>

                <TouchableOpacity
                  style={s.resetBtn}
                  onPress={() => openReset(item)}
                  activeOpacity={0.8}
                >
                  <RefreshCw size={13} color={C.white} />
                  <Text style={s.resetBtnText}>Reset</Text>
                </TouchableOpacity>
              </View>
            </SlideInCard>
          )}
        />
      )}

      <Modal visible={!!modal} transparent animationType="fade">
        <View style={CENTER.overlay}>
          <View style={CENTER.card}>
            <SafeAreaView style={s.safe} edges={['top']}>
              <View style={s.modalHeader}>
                <Text style={s.modalTitle}>Reset Password</Text>
                <TouchableOpacity onPress={() => setModal(null)}>
                  <X size={24} color={C.black} />
                </TouchableOpacity>
              </View>
              <ScrollView
                contentContainerStyle={{ padding: 20, gap: 16 }}
                keyboardShouldPersistTaps="handled"
              >
                {modal && (
                  <View style={s.empInfoBox}>
                    {modal.emp.avatar ? (
                      <Image
                        source={{ uri: modal.emp.avatar }}
                        style={s.photoCircle}
                      />
                    ) : (
                      <View style={s.cardAvatar}>
                        <Text style={s.cardAvatarText}>
                          {modal.emp.firstName?.[0]}
                          {modal.emp.lastName?.[0]}
                        </Text>
                      </View>
                    )}
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={s.empName}>
                        {modal.emp.firstName} {modal.emp.lastName}
                      </Text>
                      <Text style={s.empSub}>{modal.emp.email}</Text>
                    </View>
                  </View>
                )}

                <View>
                  <Text style={s.fieldLabel}>New Password *</Text>
                  <View style={s.pwRow}>
                    <TextInput
                      style={[s.fieldInput, { flex: 1 }]}
                      value={password}
                      onChangeText={setPassword}
                      placeholder="Min 6 characters"
                      placeholderTextColor={C.textLight}
                      secureTextEntry={!showPw}
                      autoCapitalize="none"
                    />
                    <TouchableOpacity
                      style={s.eyeBtn}
                      onPress={() => setShowPw(p => !p)}
                    >
                      {showPw ? (
                        <EyeOff size={20} color={C.textMuted} />
                      ) : (
                        <Eye size={20} color={C.textMuted} />
                      )}
                    </TouchableOpacity>
                  </View>
                </View>

                <TouchableOpacity
                  style={s.genBtn}
                  onPress={() => {
                    setPassword(genPassword());
                    setShowPw(true);
                  }}
                >
                  <RefreshCw size={14} color={C.primary} />
                  <Text style={s.genBtnText}>Generate Strong Password</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={s.submitBtn}
                  onPress={handleReset}
                  disabled={saving}
                >
                  {saving ? (
                    <ActivityIndicator color={C.white} />
                  ) : (
                    <Text style={s.submitBtnText}>Reset Password</Text>
                  )}
                </TouchableOpacity>
              </ScrollView>
            </SafeAreaView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
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
  title: { fontSize: 20, fontWeight: '400', color: C.black },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyText: { fontSize: 14, fontWeight: '400', color: C.textMuted },
  colWrapper: { gap: 10 },
  cardTablet: { flex: 1 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.white,
    borderWidth: 2,
    borderRadius: 8,
    borderRightWidth: 4,
    borderBottomWidth: 4,
    borderRightColor: '#0A0A0A',
    borderBottomColor: '#0A0A0A',
    borderColor: C.black,
    padding: 12,
  },
  cardAvatar: {
    width: 40,
    height: 40,
    backgroundColor: C.primary,
    borderWidth: 2,
    borderRadius: 20,
    borderColor: C.black,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardAvatarText: { color: C.white, fontSize: 13, fontWeight: '400' },
  photoCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: C.black,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  codeChip: {
    fontSize: 10,
    fontWeight: '400',
    color: C.primary,
    backgroundColor: C.primary + '18',
    borderWidth: 1.5,
    borderColor: C.primary,
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  empName: { flex: 1, fontSize: 14, fontWeight: '400', color: C.black },
  empSub: { fontSize: 11, color: C.textMuted, fontWeight: '400', marginTop: 2 },
  empMeta: {
    fontSize: 10,
    color: C.textLight,
    marginTop: 2,
  },
  resetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: C.primary,
    borderWidth: 2,
    borderRadius: 6,
    borderColor: C.black,
    paddingHorizontal: 10,
    paddingVertical: 7,
    marginLeft: 8,
  },
  resetBtnText: {
    color: C.white,
    fontSize: 11,
    fontWeight: '400',
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
  modalTitle: { fontSize: 20, fontWeight: '400', color: C.black },
  empInfoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    borderWidth: 2,
    borderRightWidth: 4,
    borderBottomWidth: 4,
    borderRightColor: '#0A0A0A',
    borderBottomColor: '#0A0A0A',
    borderRadius: 8,
    borderColor: C.primary,
    padding: 16,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '400',
    color: C.black,
    marginBottom: 6,
  },
  fieldInput: {
    borderWidth: 2,
    borderRadius: 8,
    borderRightWidth: 4,
    borderBottomWidth: 4,
    borderRightColor: '#0A0A0A',
    borderBottomColor: '#0A0A0A',
    borderColor: C.black,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 14,
    fontWeight: '400',
    color: C.black,
    backgroundColor: C.white,
  },
  pwRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  eyeBtn: {
    borderWidth: 2,
    borderRadius: 8,
    borderRightWidth: 4,
    borderBottomWidth: 4,
    borderRightColor: '#0A0A0A',
    borderBottomColor: '#0A0A0A',
    borderColor: C.black,
    padding: 12,
    backgroundColor: C.white,
  },
  genBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 2,
    borderRightWidth: 4,
    borderBottomWidth: 4,
    borderRightColor: '#0A0A0A',
    borderBottomColor: '#0A0A0A',
    borderRadius: 8,
    borderColor: C.primary,
    backgroundColor: '#EFF6FF',
    paddingVertical: 12,
  },
  genBtnText: { color: C.primary, fontWeight: '400', fontSize: 13 },
  submitBtn: {
    backgroundColor: C.primary,
    borderWidth: 2,
    borderRadius: 8,
    borderRightWidth: 4,
    borderBottomWidth: 4,
    borderRightColor: '#0A0A0A',
    borderBottomColor: '#0A0A0A',
    borderColor: C.black,
    paddingVertical: 16,
    alignItems: 'center',
  },
  submitBtnText: {
    color: C.white,
    fontWeight: '400',
    fontSize: 14,
  },
});

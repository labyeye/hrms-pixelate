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
  Plus,
  Users,
  ChevronLeft,
} from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { employeeAPI } from '../api/api';
import { C } from '../theme';

function genPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789@#$!';
  return Array.from(
    { length: 12 },
    () => chars[Math.floor(Math.random() * chars.length)],
  ).join('');
}

export default function CredentialsScreen() {
  const navigation = useNavigation<any>();
  const [employees, setEmployees] = useState<any[]>([]);
  const [filtered, setFiltered] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
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
      <View style={s.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={{ padding: 4, marginRight: 4 }}
        >
          <ChevronLeft size={22} color={C.black} />
        </TouchableOpacity>
        <KeyRound size={20} color={C.primary} />
        <Text style={s.title}>Employee Credentials</Text>
      </View>

      <View style={s.searchWrap}>
        <Search size={15} color={C.textMuted} />
        <TextInput
          style={s.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search by name, email or ID…"
          placeholderTextColor={C.textLight}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <X size={14} color={C.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <View style={s.loader}>
          <ActivityIndicator size="large" color={C.primary} />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item._id}
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
              <Users size={40} color="#D1D5DB" />
              <Text style={s.emptyText}>No employees found</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={s.card}>
              {item.avatar
                ? <Image source={{ uri: item.avatar }} style={s.photoCircle} />
                : <View style={s.cardAvatar}><Text style={s.cardAvatarText}>{item.firstName?.[0]}{item.lastName?.[0]}</Text></View>
              }
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={s.empName}>
                  {item.firstName} {item.lastName}
                </Text>
                <Text style={s.empSub}>{item.email}</Text>
                <Text style={s.empId}>{item.employeeId}</Text>
              </View>
              <TouchableOpacity
                style={s.resetBtn}
                onPress={() => openReset(item)}
              >
                <RefreshCw size={12} color={C.white} />
                <Text style={s.resetBtnText}>Reset</Text>
              </TouchableOpacity>
            </View>
          )}
        />
      )}

      <Modal
        visible={!!modal}
        animationType="slide"
        presentationStyle="formSheet"
      >
        <SafeAreaView style={s.safe} edges={['top']}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>Reset Password</Text>
            <TouchableOpacity onPress={() => setModal(null)}>
              <X size={22} color={C.black} />
            </TouchableOpacity>
          </View>
          <ScrollView
            contentContainerStyle={{ padding: 20, gap: 16 }}
            keyboardShouldPersistTaps="handled"
          >
            {modal && (
              <View style={s.empInfoBox}>
                {modal.emp.avatar
                  ? <Image source={{ uri: modal.emp.avatar }} style={s.photoCircle} />
                  : <View style={s.cardAvatar}><Text style={s.cardAvatarText}>{modal.emp.firstName?.[0]}{modal.emp.lastName?.[0]}</Text></View>
                }
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
                    <EyeOff size={18} color={C.textMuted} />
                  ) : (
                    <Eye size={18} color={C.textMuted} />
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
              <RefreshCw size={13} color={C.primary} />
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
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: C.white,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  searchInput: { flex: 1, fontSize: 14, fontWeight: '500', color: C.black },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyText: { fontSize: 14, fontWeight: '700', color: C.textMuted },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.white,
    borderWidth: 2,
    borderColor: C.black,
    padding: 14,
  },
  cardAvatar: {
    width: 40,
    height: 40,
    backgroundColor: C.primary,
    borderWidth: 2,
    borderColor: C.black,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardAvatarText: { color: C.white, fontSize: 13, fontWeight: '700' },
  photoCircle: { width: 44, height: 44, borderRadius: 22, borderWidth: 2, borderColor: C.black },
  empName: { fontSize: 14, fontWeight: '700', color: C.black },
  empSub: { fontSize: 11, color: C.textMuted, fontWeight: '500' },
  empId: {
    fontSize: 10,
    color: C.textLight,
    fontFamily: 'monospace',
    marginTop: 1,
  },
  resetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: C.primary,
    borderWidth: 2,
    borderColor: C.black,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  resetBtnText: {
    color: C.white,
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
  empInfoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    borderWidth: 2,
    borderColor: C.primary,
    padding: 14,
  },
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
  pwRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  eyeBtn: {
    borderWidth: 2,
    borderColor: C.black,
    padding: 11,
    backgroundColor: C.white,
  },
  genBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 2,
    borderColor: C.primary,
    backgroundColor: '#EFF6FF',
    paddingVertical: 11,
  },
  genBtnText: { color: C.primary, fontWeight: '700', fontSize: 13 },
  submitBtn: {
    backgroundColor: C.primary,
    borderWidth: 2,
    borderColor: C.black,
    paddingVertical: 14,
    alignItems: 'center',
  },
  submitBtnText: {
    color: C.white,
    fontWeight: '700',
    fontSize: 14,
    textTransform: 'uppercase',
  },
});

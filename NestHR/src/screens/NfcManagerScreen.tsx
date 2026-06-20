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
  Modal,
  RefreshControl,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  CreditCard,
  Search,
  Plus,
  X,
  Save,
  ChevronLeft,
  User,
  Trash2,
  Check,
} from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { biometricAPI, employeeAPI } from '../api/api';
import { C } from '../theme';

interface Employee {
  _id: string;
  firstName: string;
  lastName: string;
  employeeId: string;
  avatar?: string;
  department?: { name: string } | string;
}

interface NfcCard {
  uid: string;
  label?: string;
  employee: {
    _id: string;
    firstName: string;
    lastName: string;
    employeeId: string;
  };
  assignedAt: string;
}

interface Device {
  _id: string;
  name: string;
  location: { name: string };
  nfcCards: NfcCard[];
}

export default function NfcManagerScreen() {
  const navigation = useNavigation<any>();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');

  const [modal, setModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(
    null,
  );
  const [empSearch, setEmpSearch] = useState('');
  const [assignForm, setAssignForm] = useState({
    uid: '',
    deviceId: '',
    label: '',
  });
  const [assigning, setAssigning] = useState(false);
  const [step, setStep] = useState<'selectEmp' | 'fillCard'>('selectEmp');

  const fetchData = useCallback(async () => {
    try {
      const [empRes, devRes] = await Promise.all([
        employeeAPI.getAll(),
        biometricAPI.getDevices(),
      ]);
      setEmployees(empRes.data || []);
      setDevices(devRes.data || []);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Build employee → cards map
  const cardsByEmployee = new Map<
    string,
    Array<NfcCard & { deviceName: string; locationName: string }>
  >();
  for (const dev of devices) {
    for (const card of dev.nfcCards) {
      const key = card.employee._id;
      if (!cardsByEmployee.has(key)) cardsByEmployee.set(key, []);
      cardsByEmployee.get(key)!.push({
        ...card,
        deviceName: dev.name,
        locationName: dev.location?.name || '',
      });
    }
  }

  const filtered = employees.filter(e => {
    const q = search.toLowerCase();
    return (
      e.firstName.toLowerCase().includes(q) ||
      e.lastName.toLowerCase().includes(q) ||
      e.employeeId.toLowerCase().includes(q)
    );
  });

  const openAssign = () => {
    if (devices.length === 0) {
      Alert.alert(
        'No Devices',
        'Add a biometric device first before assigning NFC cards.',
      );
      return;
    }
    setStep('selectEmp');
    setSelectedEmployee(null);
    setEmpSearch('');
    setAssignForm({ uid: '', deviceId: devices[0]._id, label: '' });
    setModal(true);
  };

  const selectEmployee = (emp: Employee) => {
    setSelectedEmployee(emp);
    setStep('fillCard');
  };

  const assign = async () => {
    if (!assignForm.uid.trim()) {
      Alert.alert('Validation', 'NFC card UID is required');
      return;
    }
    if (!assignForm.deviceId) {
      Alert.alert('Validation', 'Please select a device');
      return;
    }
    if (!selectedEmployee) return;
    setAssigning(true);
    try {
      await biometricAPI.assignNfc(assignForm.deviceId, {
        uid: assignForm.uid.trim(),
        employeeId: selectedEmployee._id,
        label: assignForm.label.trim() || undefined,
      });
      setModal(false);
      fetchData();
      Alert.alert(
        'Success',
        `NFC card assigned to ${selectedEmployee.firstName} ${selectedEmployee.lastName}`,
      );
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setAssigning(false);
    }
  };

  const removeCard = (deviceId: string, uid: string, empName: string) => {
    Alert.alert('Remove NFC Card', `Remove card from ${empName}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await biometricAPI.removeNfc(deviceId, uid);
            fetchData();
          } catch (e: any) {
            Alert.alert('Error', e.message);
          }
        },
      },
    ]);
  };

  const empModalFiltered = employees.filter(e => {
    const q = empSearch.toLowerCase();
    return (
      e.firstName.toLowerCase().includes(q) ||
      e.lastName.toLowerCase().includes(q) ||
      e.employeeId.toLowerCase().includes(q)
    );
  });

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={C.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={{ padding: 4, marginRight: 4 }}
          >
            <ChevronLeft size={22} color={C.black} />
          </TouchableOpacity>
          <CreditCard size={20} color={C.primary} />
          <Text style={styles.headerTitle}>NFC Cards</Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={openAssign}>
          <Plus size={14} color={C.white} />
          <Text style={styles.addBtnText}>Assign</Text>
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={styles.searchRow}>
        <Search size={14} color="#9CA3AF" style={{ marginLeft: 12 }} />
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search employees..."
          placeholderTextColor="#9CA3AF"
        />
        {search ? (
          <TouchableOpacity
            onPress={() => setSearch('')}
            style={{ padding: 10 }}
          >
            <X size={14} color="#9CA3AF" />
          </TouchableOpacity>
        ) : null}
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              fetchData();
            }}
            tintColor={C.primary}
          />
        }
      >
        {filtered.length === 0 ? (
          <View style={styles.empty}>
            <User size={32} color="#D1D5DB" />
            <Text style={styles.emptyText}>No employees found</Text>
          </View>
        ) : (
          <View style={styles.card}>
            {filtered.map((emp, i) => {
              const cards = cardsByEmployee.get(emp._id) || [];
              return (
                <View
                  key={emp._id}
                  style={[styles.empRow, i > 0 && styles.rowBorder]}
                >
                  {emp.avatar ? (
                    <Image
                      source={{ uri: emp.avatar }}
                      style={styles.avatarPhoto}
                    />
                  ) : (
                    <View style={styles.avatar}>
                      <Text style={styles.avatarText}>
                        {(emp.firstName[0] || '') + (emp.lastName[0] || '')}
                      </Text>
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={styles.empName}>
                      {emp.firstName} {emp.lastName}
                    </Text>
                    <Text style={styles.empId}>{emp.employeeId}</Text>
                    {cards.length > 0 ? (
                      <View style={{ marginTop: 6, gap: 4 }}>
                        {cards.map(card => (
                          <View key={card.uid} style={styles.cardChip}>
                            <CreditCard size={10} color={C.primary} />
                            <Text style={styles.cardChipText}>{card.uid}</Text>
                            {card.label ? (
                              <Text style={styles.cardChipLabel}>
                                {' '}
                                · {card.label}
                              </Text>
                            ) : null}
                            <Text style={styles.cardChipDev}>
                              {card.deviceName}
                            </Text>
                            <TouchableOpacity
                              onPress={() => {
                                const dev = devices.find(d =>
                                  d.nfcCards.some(c => c.uid === card.uid),
                                );
                                if (dev)
                                  removeCard(
                                    dev._id,
                                    card.uid,
                                    `${emp.firstName} ${emp.lastName}`,
                                  );
                              }}
                              style={{ marginLeft: 4 }}
                            >
                              <X size={10} color={C.danger} />
                            </TouchableOpacity>
                          </View>
                        ))}
                      </View>
                    ) : (
                      <Text style={styles.noCard}>No NFC card assigned</Text>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Assign Modal */}
      <Modal visible={modal} transparent animationType="slide">
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {step === 'selectEmp'
                  ? 'Select Employee'
                  : `Assign Card — ${selectedEmployee?.firstName} ${selectedEmployee?.lastName}`}
              </Text>
              <TouchableOpacity onPress={() => setModal(false)}>
                <X size={20} color={C.black} />
              </TouchableOpacity>
            </View>

            {step === 'selectEmp' ? (
              <>
                <View style={styles.searchRow}>
                  <Search
                    size={14}
                    color="#9CA3AF"
                    style={{ marginLeft: 12 }}
                  />
                  <TextInput
                    style={styles.searchInput}
                    value={empSearch}
                    onChangeText={setEmpSearch}
                    placeholder="Search employees..."
                    placeholderTextColor="#9CA3AF"
                    autoFocus
                  />
                </View>
                <ScrollView style={{ maxHeight: 300 }}>
                  {empModalFiltered.map((emp, i) => (
                    <TouchableOpacity
                      key={emp._id}
                      style={[styles.empOption, i > 0 && styles.rowBorder]}
                      onPress={() => selectEmployee(emp)}
                    >
                      {emp.avatar ? (
                        <Image
                          source={{ uri: emp.avatar }}
                          style={[
                            styles.avatarPhoto,
                            { width: 32, height: 32, borderRadius: 16 },
                          ]}
                        />
                      ) : (
                        <View
                          style={[styles.avatar, { width: 32, height: 32 }]}
                        >
                          <Text style={[styles.avatarText, { fontSize: 11 }]}>
                            {emp.firstName[0]}
                            {emp.lastName[0]}
                          </Text>
                        </View>
                      )}
                      <View>
                        <Text style={styles.empName}>
                          {emp.firstName} {emp.lastName}
                        </Text>
                        <Text style={styles.empId}>{emp.employeeId}</Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </>
            ) : (
              <>
                <TouchableOpacity
                  style={styles.backBtn}
                  onPress={() => setStep('selectEmp')}
                >
                  <ChevronLeft size={14} color={C.primary} />
                  <Text style={styles.backBtnText}>Change Employee</Text>
                </TouchableOpacity>

                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>Card UID *</Text>
                  <TextInput
                    style={styles.fieldInput}
                    value={assignForm.uid}
                    onChangeText={v => setAssignForm(p => ({ ...p, uid: v }))}
                    placeholder="e.g. A1B2C3D4"
                    placeholderTextColor="#9CA3AF"
                    autoCapitalize="characters"
                  />
                </View>

                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>Label (optional)</Text>
                  <TextInput
                    style={styles.fieldInput}
                    value={assignForm.label}
                    onChangeText={v => setAssignForm(p => ({ ...p, label: v }))}
                    placeholder="e.g. Blue Card"
                    placeholderTextColor="#9CA3AF"
                  />
                </View>

                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>Device *</Text>
                  {devices.map(dev => (
                    <TouchableOpacity
                      key={dev._id}
                      style={[
                        styles.locOption,
                        assignForm.deviceId === dev._id &&
                          styles.locOptionSelected,
                      ]}
                      onPress={() =>
                        setAssignForm(p => ({ ...p, deviceId: dev._id }))
                      }
                    >
                      {assignForm.deviceId === dev._id && (
                        <Check size={12} color={C.primary} />
                      )}
                      <View>
                        <Text
                          style={[
                            styles.locOptionText,
                            assignForm.deviceId === dev._id && {
                              color: C.primary,
                            },
                          ]}
                        >
                          {dev.name}
                        </Text>
                        <Text style={styles.empId}>{dev.location?.name}</Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>

                <TouchableOpacity
                  style={styles.saveBtn}
                  onPress={assign}
                  disabled={assigning}
                >
                  {assigning ? (
                    <ActivityIndicator size="small" color={C.white} />
                  ) : (
                    <>
                      <CreditCard size={14} color={C.white} />
                      <Text style={styles.saveBtnText}>Assign Card</Text>
                    </>
                  )}
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F8F9FA' },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
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
  headerTitle: { fontSize: 18, fontWeight: '700', color: C.black },
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
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.white,
    borderBottomWidth: 2,
    borderBottomColor: C.black,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 10,
    fontSize: 14,
    fontWeight: '500',
    color: C.black,
  },
  card: { backgroundColor: C.white, borderWidth: 2, borderColor: C.black },
  empRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 14,
    gap: 12,
  },
  rowBorder: { borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  avatar: {
    width: 40,
    height: 40,
    backgroundColor: C.primary,
    borderWidth: 2,
    borderColor: C.black,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarPhoto: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: C.black,
  },
  avatarText: { color: C.white, fontSize: 13, fontWeight: '700' },
  empName: { fontSize: 14, fontWeight: '700', color: C.black },
  empId: { fontSize: 11, color: '#6B7280', marginTop: 1 },
  noCard: { fontSize: 11, color: '#9CA3AF', fontStyle: 'italic', marginTop: 4 },
  cardChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: C.primary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignSelf: 'flex-start',
  },
  cardChipText: { fontSize: 11, fontWeight: '700', color: C.primary },
  cardChipLabel: { fontSize: 11, color: '#6B7280' },
  cardChipDev: { fontSize: 12, color: '#9CA3AF' },
  empty: { alignItems: 'center', paddingVertical: 60, gap: 8 },
  emptyText: { fontSize: 14, fontWeight: '700', color: '#6B7280' },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modal: {
    backgroundColor: C.white,
    borderTopWidth: 2,
    borderTopColor: C.black,
    padding: 20,
    paddingBottom: 40,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: C.black,
    flex: 1,
    marginRight: 10,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 16,
  },
  backBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: C.primary,
    textTransform: 'uppercase',
  },
  field: { marginBottom: 14 },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    color: '#6B7280',
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  fieldInput: {
    borderWidth: 2,
    borderColor: C.black,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    fontWeight: '500',
    color: C.black,
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: C.primary,
    borderWidth: 2,
    borderColor: C.black,
    paddingVertical: 14,
    marginTop: 4,
  },
  saveBtnText: {
    color: C.white,
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  locOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 10,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    marginBottom: 6,
  },
  locOptionSelected: { borderColor: C.primary, backgroundColor: '#EFF6FF' },
  locOptionText: { fontSize: 14, fontWeight: '600', color: C.black },
  empOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
});

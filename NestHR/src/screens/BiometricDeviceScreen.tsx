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
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Cpu,
  MapPin,
  Plus,
  Trash2,
  Edit2,
  ChevronLeft,
  X,
  Save,
  Wifi,
  WifiOff,
  Check,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Radio,
  Upload,
  UserCheck,
  Fingerprint,
  Scan,
  CreditCard,
  Hash,
  AlertTriangle,
  Terminal,
  CheckCircle2,
} from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { biometricAPI, employeeAPI } from '../api/api';
import { C } from '../theme';

interface Location {
  _id: string;
  name: string;
  address?: string;
  description?: string;
  isActive: boolean;
}

interface Device {
  _id: string;
  name: string;
  location: { _id: string; name: string };
  activated: boolean;
  activationCode?: string;
  isActive: boolean;
  lastSeenAt?: string;
}

interface Employee {
  _id: string;
  firstName: string;
  lastName: string;
  employeeId: string;
  biometricUserId?: string;
  rfidCard?: string;
  deviceFaceTemplate?: string;
  status?: string;
}

interface Command {
  _id: string;
  cmdId: number;
  type: string;
  command: string;
  status: 'pending' | 'sent' | 'done' | 'failed';
  employee?: { firstName: string; lastName: string };
  createdAt: string;
}

const EMPTY_LOC = { name: '', address: '', description: '' };
const EMPTY_DEV = { name: '', location: '' };

export default function BiometricDeviceScreen() {
  const navigation = useNavigation<any>();
  const [tab, setTab] = useState<'locations' | 'devices' | 'adms'>('locations');
  const [locations, setLocations] = useState<Location[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Location form
  const [locModal, setLocModal] = useState(false);
  const [locForm, setLocForm] = useState(EMPTY_LOC);
  const [editLocId, setEditLocId] = useState<string | null>(null);
  const [locSaving, setLocSaving] = useState(false);

  // Device form
  const [devModal, setDevModal] = useState(false);
  const [devForm, setDevForm] = useState(EMPTY_DEV);
  const [editDevId, setEditDevId] = useState<string | null>(null);
  const [devSaving, setDevSaving] = useState(false);

  const [expandedDev, setExpandedDev] = useState<string | null>(null);

  // ADMS state
  const [admsDevice, setAdmsDevice] = useState<Device | null>(null);
  const [admsSerial, setAdmsSerial] = useState('');
  const [serialSaving, setSerialSaving] = useState(false);
  const [admsEmployees, setAdmsEmployees] = useState<Employee[]>([]);
  const [admsEmpLoading, setAdmsEmpLoading] = useState(false);
  const [syncingAll, setSyncingAll] = useState(false);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [fpEnrollingId, setFpEnrollingId] = useState<string | null>(null);
  const [faceEnrollingId, setFaceEnrollingId] = useState<string | null>(null);
  const [commands, setCommands] = useState<Command[]>([]);
  const [cmdLoading, setCmdLoading] = useState(false);
  const [editBioIdEmp, setEditBioIdEmp] = useState<string | null>(null);
  const [editBioIdVal, setEditBioIdVal] = useState('');
  const [rfidModal, setRfidModal] = useState<Employee | null>(null);
  const [rfidVal, setRfidVal] = useState('');
  const [rfidSaving, setRfidSaving] = useState(false);

  const fetchAll = useCallback(async () => {
    try {
      const [locRes, devRes] = await Promise.all([
        biometricAPI.getLocations(),
        biometricAPI.getDevices(),
      ]);
      setLocations(locRes.data || []);
      setDevices(devRes.data || []);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const fetchAdmsEmployees = useCallback(async () => {
    setAdmsEmpLoading(true);
    try {
      const res = await employeeAPI.getAll();
      setAdmsEmployees(
        (res.data || []).filter((e: Employee) => e.status !== 'terminated'),
      );
    } catch {}
    setAdmsEmpLoading(false);
  }, []);

  const fetchCommands = useCallback(async (deviceId: string) => {
    setCmdLoading(true);
    try {
      const res = await biometricAPI.getDeviceCommands(deviceId);
      setCommands(res.data || []);
    } catch {}
    setCmdLoading(false);
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  useEffect(() => {
    if (tab === 'adms') {
      fetchAll();
      fetchAdmsEmployees();
    }
  }, [tab, fetchAll, fetchAdmsEmployees]);

  useEffect(() => {
    if (admsDevice) {
      setAdmsSerial((admsDevice as any).serialNumber || '');
      fetchCommands(admsDevice._id);
    }
  }, [admsDevice, fetchCommands]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchAll();
    if (tab === 'adms') fetchAdmsEmployees();
  };

  // ── ADMS handlers ──────────────────────────────────────────────────────────
  const handleSaveSerial = async () => {
    if (!admsDevice || !admsSerial.trim() || serialSaving) return;
    setSerialSaving(true);
    try {
      const res = await biometricAPI.setDeviceSerial(
        admsDevice._id,
        admsSerial.trim().toUpperCase(),
      );
      setAdmsDevice(res.data);
      Alert.alert('Saved', `Device linked to SN: ${admsSerial.toUpperCase()}`);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
    setSerialSaving(false);
  };

  const handleSyncEmployee = async (emp: Employee) => {
    if (!admsDevice || !(admsDevice as any).serialNumber) {
      Alert.alert('No Serial', 'Register the ADMS serial number first.');
      return;
    }
    setSyncingId(emp._id);
    try {
      await biometricAPI.syncEmployeeToDevice(admsDevice._id, emp._id);
      Alert.alert('Queued', `${emp.firstName} will sync on next device poll`);
      fetchCommands(admsDevice._id);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
    setSyncingId(null);
  };

  const handleSyncAll = async () => {
    if (!admsDevice || !(admsDevice as any).serialNumber) {
      Alert.alert('No Serial', 'Register the ADMS serial number first.');
      return;
    }
    if (syncingAll) return;
    setSyncingAll(true);
    try {
      await biometricAPI.syncAllToDevice(admsDevice._id);
      Alert.alert('Queued', 'All employees queued for sync');
      fetchCommands(admsDevice._id);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
    setSyncingAll(false);
  };

  const handleEnrollFp = async (emp: Employee) => {
    if (!admsDevice) return;
    setFpEnrollingId(emp._id);
    try {
      await biometricAPI.enrollFpOnDevice(admsDevice._id, emp._id);
      Alert.alert(
        'Queued',
        'Fingerprint enrollment queued — employee should place finger on device',
      );
      fetchCommands(admsDevice._id);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
    setFpEnrollingId(null);
  };

  const handleEnrollFace = async (emp: Employee) => {
    if (!admsDevice) return;
    setFaceEnrollingId(emp._id);
    try {
      await biometricAPI.enrollFaceOnDevice(admsDevice._id, emp._id);
      Alert.alert(
        'Queued',
        'Face enrollment queued — employee should look at device',
      );
      fetchCommands(admsDevice._id);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
    setFaceEnrollingId(null);
  };

  const handleSaveBioId = async (emp: Employee) => {
    if (!editBioIdVal.trim()) {
      setEditBioIdEmp(null);
      return;
    }
    try {
      await employeeAPI.update(emp._id, {
        biometricUserId: editBioIdVal.trim(),
      });
      setAdmsEmployees(prev =>
        prev.map(e =>
          e._id === emp._id
            ? { ...e, biometricUserId: editBioIdVal.trim() }
            : e,
        ),
      );
      setEditBioIdEmp(null);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  const handleSaveRfid = async () => {
    if (!rfidModal || !rfidVal.trim() || rfidSaving) return;
    setRfidSaving(true);
    try {
      await biometricAPI.saveRfidCard(rfidModal._id, rfidVal.trim());
      setAdmsEmployees(prev =>
        prev.map(e =>
          e._id === rfidModal._id ? { ...e, rfidCard: rfidVal.trim() } : e,
        ),
      );
      setRfidModal(null);
      setRfidVal('');
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
    setRfidSaving(false);
  };

  // ── Locations ──────────────────────────────────────────────────────────────
  const openLocCreate = () => {
    setEditLocId(null);
    setLocForm(EMPTY_LOC);
    setLocModal(true);
  };

  const openLocEdit = (loc: Location) => {
    setEditLocId(loc._id);
    setLocForm({
      name: loc.name,
      address: loc.address || '',
      description: loc.description || '',
    });
    setLocModal(true);
  };

  const saveLocation = async () => {
    if (!locForm.name.trim()) {
      Alert.alert('Validation', 'Location name is required');
      return;
    }
    setLocSaving(true);
    try {
      if (editLocId) {
        await biometricAPI.updateLocation(editLocId, locForm);
      } else {
        await biometricAPI.createLocation(locForm);
      }
      setLocModal(false);
      fetchAll();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setLocSaving(false);
    }
  };

  const deleteLocation = (loc: Location) => {
    Alert.alert('Delete Location', `Delete "${loc.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await biometricAPI.deleteLocation(loc._id);
            fetchAll();
          } catch (e: any) {
            Alert.alert('Error', e.message);
          }
        },
      },
    ]);
  };

  // ── Devices ────────────────────────────────────────────────────────────────
  const openDevCreate = () => {
    if (locations.length === 0) {
      Alert.alert(
        'No Locations',
        'Create a location first before adding a device.',
      );
      return;
    }
    setEditDevId(null);
    setDevForm({ name: '', location: locations[0]._id });
    setDevModal(true);
  };

  const saveDevice = async () => {
    if (!devForm.name.trim()) {
      Alert.alert('Validation', 'Device name is required');
      return;
    }
    if (!devForm.location) {
      Alert.alert('Validation', 'Please select a location');
      return;
    }
    setDevSaving(true);
    try {
      if (editDevId) {
        await biometricAPI.updateDevice(editDevId, devForm);
      } else {
        await biometricAPI.createDevice(devForm);
      }
      setDevModal(false);
      fetchAll();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setDevSaving(false);
    }
  };

  const deleteDevice = (dev: Device) => {
    Alert.alert('Delete Device', `Delete "${dev.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await biometricAPI.deleteDevice(dev._id);
            fetchAll();
          } catch (e: any) {
            Alert.alert('Error', e.message);
          }
        },
      },
    ]);
  };

  const handleSync = async (deviceId: string) => {
    Alert.alert('Sync Device', 'Sync all employees to this device?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sync',
        onPress: async () => {
          try {
            await biometricAPI.syncAll(deviceId);
            Alert.alert('Success', 'Employees synced to device successfully');
          } catch (e: any) {
            Alert.alert('Error', e.message);
          }
        },
      },
    ]);
  };

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
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={{ padding: 4, marginRight: 4 }}
          >
            <ChevronLeft size={22} color={C.black} />
          </TouchableOpacity>
          <Cpu size={20} color={C.primary} />
          <Text style={styles.headerTitle}>Biometric Devices</Text>
        </View>
        {tab !== 'adms' && (
          <TouchableOpacity
            style={styles.addBtn}
            onPress={tab === 'locations' ? openLocCreate : openDevCreate}
          >
            <Plus size={14} color={C.white} />
            <Text style={styles.addBtnText}>
              {tab === 'locations' ? 'Location' : 'Device'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        {(
          [
            { id: 'locations', label: `Locations (${locations.length})` },
            { id: 'devices', label: `Devices (${devices.length})` },
            { id: 'adms', label: 'ADMS Sync' },
          ] as const
        ).map(t => (
          <TouchableOpacity
            key={t.id}
            style={[styles.tab, tab === t.id && styles.tabActive]}
            onPress={() => setTab(t.id)}
          >
            <Text
              style={[styles.tabText, tab === t.id && styles.tabTextActive]}
            >
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={C.primary}
          />
        }
      >
        {tab === 'locations' ? (
          locations.length === 0 ? (
            <View style={styles.empty}>
              <MapPin size={32} color="#D1D5DB" />
              <Text style={styles.emptyText}>No locations yet</Text>
              <Text style={styles.emptySub}>
                Tap + to add your first location
              </Text>
            </View>
          ) : (
            <View style={styles.card}>
              {locations.map((loc, i) => (
                <View
                  key={loc._id}
                  style={[styles.row, i > 0 && styles.rowBorder]}
                >
                  <View style={styles.locIcon}>
                    <MapPin size={16} color={C.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowTitle}>{loc.name}</Text>
                    {loc.address ? (
                      <Text style={styles.rowSub}>{loc.address}</Text>
                    ) : null}
                  </View>
                  <View
                    style={[
                      styles.statusDot,
                      { backgroundColor: loc.isActive ? C.success : '#D1D5DB' },
                    ]}
                  />
                  <TouchableOpacity
                    onPress={() => openLocEdit(loc)}
                    style={styles.iconBtn}
                  >
                    <Edit2 size={14} color={C.primary} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => deleteLocation(loc)}
                    style={styles.iconBtn}
                  >
                    <Trash2 size={14} color={C.danger} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )
        ) : devices.length === 0 ? (
          <View style={styles.empty}>
            <Cpu size={32} color="#D1D5DB" />
            <Text style={styles.emptyText}>No devices yet</Text>
            <Text style={styles.emptySub}>
              Add a biometric device to a location
            </Text>
          </View>
        ) : (
          <View style={styles.card}>
            {devices.map((dev, i) => (
              <View key={dev._id}>
                <TouchableOpacity
                  style={[styles.row, i > 0 && styles.rowBorder]}
                  onPress={() =>
                    setExpandedDev(expandedDev === dev._id ? null : dev._id)
                  }
                  activeOpacity={0.8}
                >
                  <View style={styles.locIcon}>
                    <Cpu size={16} color={C.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowTitle}>{dev.name}</Text>
                    <Text style={styles.rowSub}>
                      {dev.location?.name || '—'}
                    </Text>
                  </View>
                  {dev.activated ? (
                    <View style={styles.badge}>
                      <Wifi size={10} color={C.success} />
                      <Text style={[styles.badgeText, { color: C.success }]}>
                        Active
                      </Text>
                    </View>
                  ) : (
                    <View style={[styles.badge, { borderColor: '#D1D5DB' }]}>
                      <WifiOff size={10} color="#9CA3AF" />
                      <Text style={[styles.badgeText, { color: '#9CA3AF' }]}>
                        Pending
                      </Text>
                    </View>
                  )}
                  {expandedDev === dev._id ? (
                    <ChevronUp size={14} color="#9CA3AF" />
                  ) : (
                    <ChevronDown size={14} color="#9CA3AF" />
                  )}
                </TouchableOpacity>

                {expandedDev === dev._id && (
                  <View style={styles.devDetail}>
                    {dev.activationCode && !dev.activated && (
                      <View style={styles.codeBox}>
                        <Text style={styles.codeLabel}>ACTIVATION CODE</Text>
                        <Text style={styles.codeValue}>
                          {dev.activationCode}
                        </Text>
                        <Text style={styles.codeSub}>
                          Enter this code on the physical device to pair it
                        </Text>
                      </View>
                    )}
                    {dev.lastSeenAt && (
                      <Text style={styles.lastSeen}>
                        Last seen: {new Date(dev.lastSeenAt).toLocaleString()}
                      </Text>
                    )}
                    <View style={styles.devActions}>
                      <TouchableOpacity
                        style={styles.devActionBtn}
                        onPress={() => deleteDevice(dev)}
                      >
                        <Trash2 size={13} color={C.danger} />
                        <Text
                          style={[styles.devActionText, { color: C.danger }]}
                        >
                          Delete
                        </Text>
                      </TouchableOpacity>
                    </View>
                    <TouchableOpacity
                      style={styles.syncBtn}
                      onPress={() => handleSync(dev._id)}
                    >
                      <RefreshCw size={13} color={C.white} />
                      <Text style={styles.syncBtnText}>Sync All Employees</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* ── ADMS / ESSL Sync tab ──────────────────────────────────────────── */}
      {tab === 'adms' && (
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={C.primary}
            />
          }
        >
          {/* Step 1 — Select Device */}
          <View style={admsS.section}>
            <View style={admsS.stepRow}>
              <View style={admsS.stepBadge}>
                <Text style={admsS.stepNum}>1</Text>
              </View>
              <Text style={admsS.stepTitle}>Select Device (ESSL / ZKTeco)</Text>
            </View>
            {devices.length === 0 ? (
              <Text style={admsS.hint}>
                No devices — create one in the Devices tab first.
              </Text>
            ) : (
              devices.map(d => (
                <TouchableOpacity
                  key={d._id}
                  style={[
                    admsS.deviceCard,
                    admsDevice?._id === d._id && admsS.deviceCardActive,
                  ]}
                  onPress={() => setAdmsDevice(d)}
                  activeOpacity={0.8}
                >
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 8,
                    }}
                  >
                    <Cpu
                      size={15}
                      color={admsDevice?._id === d._id ? C.primary : C.black}
                    />
                    <Text
                      style={[
                        admsS.deviceName,
                        admsDevice?._id === d._id && { color: C.primary },
                      ]}
                    >
                      {d.name}
                    </Text>
                    {(d as any).serialNumber && (
                      <View style={admsS.snBadge}>
                        <Text style={admsS.snBadgeText}>
                          SN: {(d as any).serialNumber}
                        </Text>
                      </View>
                    )}
                  </View>
                  <Text style={admsS.deviceSub}>{d.location?.name}</Text>
                </TouchableOpacity>
              ))
            )}
          </View>

          {admsDevice && (
            <>
              {/* Step 2 — Register Serial */}
              <View style={admsS.section}>
                <View style={admsS.stepRow}>
                  <View style={admsS.stepBadge}>
                    <Text style={admsS.stepNum}>2</Text>
                  </View>
                  <Text style={admsS.stepTitle}>
                    Register ADMS Serial Number
                  </Text>
                </View>
                <Text style={admsS.hint}>
                  Find it on the device:{' '}
                  <Text style={{ fontWeight: '700' }}>
                    Menu → System Info → Device SN
                  </Text>
                </Text>
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                  <TextInput
                    style={[
                      styles.fieldInput,
                      { flex: 1, fontFamily: 'monospace' },
                    ]}
                    value={admsSerial}
                    onChangeText={v => setAdmsSerial(v.toUpperCase())}
                    placeholder="e.g. EUF7254500727"
                    placeholderTextColor="#9CA3AF"
                    autoCapitalize="characters"
                  />
                  <TouchableOpacity
                    style={[
                      admsS.saveSerialBtn,
                      (!admsSerial.trim() || serialSaving) && { opacity: 0.4 },
                    ]}
                    onPress={handleSaveSerial}
                    disabled={!admsSerial.trim() || serialSaving}
                  >
                    {serialSaving ? (
                      <ActivityIndicator size="small" color={C.white} />
                    ) : (
                      <>
                        <Check size={14} color={C.white} />
                        <Text style={admsS.saveSerialBtnText}>Save</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
                {(admsDevice as any).serialNumber && (
                  <View style={admsS.serialRegistered}>
                    <CheckCircle2 size={13} color={C.success} />
                    <Text style={admsS.serialRegisteredText}>
                      Currently registered: {(admsDevice as any).serialNumber}
                    </Text>
                  </View>
                )}
              </View>

              {/* Step 3 — Employees */}
              <View
                style={[admsS.section, { paddingHorizontal: 0, paddingTop: 0 }]}
              >
                <View style={[admsS.empHeader]}>
                  <View>
                    <View style={[admsS.stepRow, { marginBottom: 2 }]}>
                      <View style={admsS.stepBadge}>
                        <Text style={admsS.stepNum}>3</Text>
                      </View>
                      <Text style={admsS.stepTitle}>
                        Employees — Assign IDs & Sync
                      </Text>
                    </View>
                    <Text style={[admsS.hint, { paddingHorizontal: 16 }]}>
                      Set Device User ID, assign RFID, then sync.
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={[
                      admsS.syncAllBtn,
                      (syncingAll || !(admsDevice as any).serialNumber) && {
                        opacity: 0.4,
                      },
                    ]}
                    onPress={handleSyncAll}
                    disabled={syncingAll || !(admsDevice as any).serialNumber}
                  >
                    {syncingAll ? (
                      <ActivityIndicator size="small" color={C.white} />
                    ) : (
                      <>
                        <Upload size={13} color={C.white} />
                        <Text style={admsS.syncAllBtnText}>Sync All</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>

                {admsEmpLoading ? (
                  <View style={{ padding: 32, alignItems: 'center' }}>
                    <ActivityIndicator size="large" color={C.primary} />
                  </View>
                ) : admsEmployees.length === 0 ? (
                  <Text style={[admsS.hint, { padding: 16 }]}>
                    No employees found.
                  </Text>
                ) : (
                  admsEmployees.map((emp, i) => (
                    <View
                      key={emp._id}
                      style={[admsS.empRow, i > 0 && admsS.empRowBorder]}
                    >
                      {/* Name */}
                      <View style={{ minWidth: 110 }}>
                        <Text style={admsS.empName}>
                          {emp.firstName} {emp.lastName}
                        </Text>
                        <Text style={admsS.empId}>{emp.employeeId}</Text>
                      </View>

                      {/* Bio ID */}
                      {editBioIdEmp === emp._id ? (
                        <View style={admsS.bioIdEdit}>
                          <TextInput
                            style={admsS.bioIdInput}
                            value={editBioIdVal}
                            onChangeText={setEditBioIdVal}
                            keyboardType="number-pad"
                            autoFocus
                            onSubmitEditing={() => handleSaveBioId(emp)}
                          />
                          <TouchableOpacity
                            onPress={() => handleSaveBioId(emp)}
                          >
                            <Check size={14} color={C.success} />
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() => setEditBioIdEmp(null)}
                          >
                            <X size={14} color="#9CA3AF" />
                          </TouchableOpacity>
                        </View>
                      ) : (
                        <TouchableOpacity
                          style={[
                            admsS.idChip,
                            emp.biometricUserId
                              ? admsS.idChipSet
                              : admsS.idChipUnset,
                          ]}
                          onPress={() => {
                            setEditBioIdEmp(emp._id);
                            setEditBioIdVal(emp.biometricUserId || '');
                          }}
                        >
                          <Hash
                            size={10}
                            color={emp.biometricUserId ? C.success : '#9CA3AF'}
                          />
                          <Text
                            style={[
                              admsS.idChipText,
                              emp.biometricUserId
                                ? { color: C.success }
                                : { color: '#9CA3AF' },
                            ]}
                          >
                            {emp.biometricUserId || 'Set ID'}
                          </Text>
                        </TouchableOpacity>
                      )}

                      {/* RFID */}
                      <TouchableOpacity
                        style={[
                          admsS.idChip,
                          emp.rfidCard ? admsS.rfidChipSet : admsS.idChipUnset,
                        ]}
                        onPress={() => {
                          setRfidModal(emp);
                          setRfidVal(emp.rfidCard || '');
                        }}
                      >
                        <CreditCard
                          size={10}
                          color={emp.rfidCard ? C.primary : '#9CA3AF'}
                        />
                        <Text
                          style={[
                            admsS.idChipText,
                            emp.rfidCard
                              ? { color: C.primary }
                              : { color: '#9CA3AF' },
                          ]}
                        >
                          {emp.rfidCard ? emp.rfidCard.slice(0, 8) : 'RFID'}
                        </Text>
                      </TouchableOpacity>

                      {/* Actions */}
                      <View style={{ flexDirection: 'row', gap: 4 }}>
                        {emp.biometricUserId ? (
                          <>
                            <TouchableOpacity
                              style={admsS.actionBtn}
                              onPress={() => handleEnrollFp(emp)}
                              disabled={fpEnrollingId === emp._id}
                            >
                              {fpEnrollingId === emp._id ? (
                                <ActivityIndicator
                                  size="small"
                                  color={C.black}
                                />
                              ) : (
                                <>
                                  <Fingerprint size={11} color={C.black} />
                                  <Text style={admsS.actionBtnText}>FP</Text>
                                </>
                              )}
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={[
                                admsS.actionBtn,
                                {
                                  borderColor: '#16A34A',
                                  backgroundColor: '#F0FDF4',
                                },
                              ]}
                              onPress={() => handleEnrollFace(emp)}
                              disabled={faceEnrollingId === emp._id}
                            >
                              {faceEnrollingId === emp._id ? (
                                <ActivityIndicator
                                  size="small"
                                  color="#16A34A"
                                />
                              ) : (
                                <>
                                  <Scan size={11} color="#16A34A" />
                                  <Text
                                    style={[
                                      admsS.actionBtnText,
                                      { color: '#16A34A' },
                                    ]}
                                  >
                                    Face
                                  </Text>
                                </>
                              )}
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={[
                                admsS.actionBtn,
                                {
                                  backgroundColor: C.primary,
                                  borderColor: C.black,
                                },
                              ]}
                              onPress={() => handleSyncEmployee(emp)}
                              disabled={
                                syncingId === emp._id ||
                                !(admsDevice as any).serialNumber
                              }
                            >
                              {syncingId === emp._id ? (
                                <ActivityIndicator
                                  size="small"
                                  color={C.white}
                                />
                              ) : (
                                <>
                                  <UserCheck size={11} color={C.white} />
                                  <Text
                                    style={[
                                      admsS.actionBtnText,
                                      { color: C.white },
                                    ]}
                                  >
                                    Sync
                                  </Text>
                                </>
                              )}
                            </TouchableOpacity>
                          </>
                        ) : (
                          <View
                            style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              gap: 3,
                            }}
                          >
                            <AlertTriangle size={11} color="#9CA3AF" />
                            <Text style={{ fontSize: 12, color: '#9CA3AF' }}>
                              Set ID
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>
                  ))
                )}
              </View>

              {/* Command Queue */}
              <View
                style={[admsS.section, { paddingHorizontal: 0, paddingTop: 0 }]}
              >
                <View style={admsS.cmdHeader}>
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <Terminal size={14} color={C.black} />
                    <Text style={admsS.stepTitle}>Command Queue</Text>
                  </View>
                  <TouchableOpacity
                    style={admsS.refreshBtn}
                    onPress={() => fetchCommands(admsDevice._id)}
                  >
                    <RefreshCw size={12} color={C.black} />
                    <Text style={admsS.refreshBtnText}>Refresh</Text>
                  </TouchableOpacity>
                </View>
                {cmdLoading ? (
                  <View style={{ padding: 24, alignItems: 'center' }}>
                    <ActivityIndicator color={C.primary} />
                  </View>
                ) : commands.length === 0 ? (
                  <Text style={[admsS.hint, { padding: 16 }]}>
                    No commands — sync an employee to create one.
                  </Text>
                ) : (
                  commands.map(cmd => (
                    <View key={cmd._id} style={admsS.cmdRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={admsS.cmdType}>{cmd.type}</Text>
                        {cmd.employee && (
                          <Text style={admsS.cmdEmp}>
                            {cmd.employee.firstName} {cmd.employee.lastName}
                          </Text>
                        )}
                        <Text style={admsS.cmdTime}>
                          {new Date(cmd.createdAt).toLocaleString()}
                        </Text>
                      </View>
                      <View
                        style={[
                          admsS.cmdStatus,
                          cmd.status === 'done' && admsS.cmdDone,
                          cmd.status === 'pending' && admsS.cmdPending,
                          cmd.status === 'sent' && admsS.cmdSent,
                          cmd.status === 'failed' && admsS.cmdFailed,
                        ]}
                      >
                        <Text
                          style={[
                            admsS.cmdStatusText,
                            cmd.status === 'done' && { color: C.success },
                            cmd.status === 'pending' && { color: '#FA731C' },
                            cmd.status === 'sent' && { color: C.primary },
                            cmd.status === 'failed' && { color: C.danger },
                          ]}
                        >
                          {cmd.status}
                        </Text>
                      </View>
                    </View>
                  ))
                )}
              </View>
            </>
          )}
        </ScrollView>
      )}

      {/* RFID Modal */}
      <Modal visible={!!rfidModal} transparent animationType="slide">
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Assign RFID Card</Text>
              <TouchableOpacity onPress={() => setRfidModal(null)}>
                <X size={20} color={C.black} />
              </TouchableOpacity>
            </View>
            {rfidModal && (
              <View style={admsS.rfidEmpBox}>
                <Text style={admsS.rfidEmpName}>
                  {rfidModal.firstName} {rfidModal.lastName}
                </Text>
                <Text style={admsS.rfidEmpId}>{rfidModal.employeeId}</Text>
              </View>
            )}
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Card Number</Text>
              <TextInput
                style={styles.fieldInput}
                value={rfidVal}
                onChangeText={setRfidVal}
                placeholder="e.g. A3F2B1C0"
                placeholderTextColor="#9CA3AF"
                autoCapitalize="characters"
              />
            </View>
            <TouchableOpacity
              style={[
                styles.saveBtn,
                (!rfidVal.trim() || rfidSaving) && { opacity: 0.4 },
              ]}
              onPress={handleSaveRfid}
              disabled={!rfidVal.trim() || rfidSaving}
            >
              {rfidSaving ? (
                <ActivityIndicator size="small" color={C.white} />
              ) : (
                <>
                  <Save size={14} color={C.white} />
                  <Text style={styles.saveBtnText}>Save RFID Card</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Location Modal */}
      <Modal visible={locModal} transparent animationType="slide">
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editLocId ? 'Edit Location' : 'Add Location'}
              </Text>
              <TouchableOpacity onPress={() => setLocModal(false)}>
                <X size={20} color={C.black} />
              </TouchableOpacity>
            </View>
            {[
              { label: 'Name *', key: 'name', placeholder: 'Head Office' },
              {
                label: 'Address',
                key: 'address',
                placeholder: '123 Main St, Mumbai',
              },
              {
                label: 'Description',
                key: 'description',
                placeholder: 'Optional description',
              },
            ].map(f => (
              <View key={f.key} style={styles.field}>
                <Text style={styles.fieldLabel}>{f.label}</Text>
                <TextInput
                  style={styles.fieldInput}
                  value={(locForm as any)[f.key]}
                  onChangeText={v => setLocForm(p => ({ ...p, [f.key]: v }))}
                  placeholder={f.placeholder}
                  placeholderTextColor="#9CA3AF"
                />
              </View>
            ))}
            <TouchableOpacity
              style={styles.saveBtn}
              onPress={saveLocation}
              disabled={locSaving}
            >
              {locSaving ? (
                <ActivityIndicator size="small" color={C.white} />
              ) : (
                <>
                  <Save size={14} color={C.white} />
                  <Text style={styles.saveBtnText}>Save Location</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Device Modal */}
      <Modal visible={devModal} transparent animationType="slide">
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Device</Text>
              <TouchableOpacity onPress={() => setDevModal(false)}>
                <X size={20} color={C.black} />
              </TouchableOpacity>
            </View>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Device Name *</Text>
              <TextInput
                style={styles.fieldInput}
                value={devForm.name}
                onChangeText={v => setDevForm(p => ({ ...p, name: v }))}
                placeholder="Main Gate Scanner"
                placeholderTextColor="#9CA3AF"
              />
            </View>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Location *</Text>
              {locations.map(loc => (
                <TouchableOpacity
                  key={loc._id}
                  style={[
                    styles.locOption,
                    devForm.location === loc._id && styles.locOptionSelected,
                  ]}
                  onPress={() => setDevForm(p => ({ ...p, location: loc._id }))}
                >
                  {devForm.location === loc._id && (
                    <Check size={12} color={C.primary} />
                  )}
                  <Text
                    style={[
                      styles.locOptionText,
                      devForm.location === loc._id && { color: C.primary },
                    ]}
                  >
                    {loc.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity
              style={styles.saveBtn}
              onPress={saveDevice}
              disabled={devSaving}
            >
              {devSaving ? (
                <ActivityIndicator size="small" color={C.white} />
              ) : (
                <>
                  <Save size={14} color={C.white} />
                  <Text style={styles.saveBtnText}>Save Device</Text>
                </>
              )}
            </TouchableOpacity>
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
  tabs: {
    flexDirection: 'row',
    backgroundColor: C.white,
    borderBottomWidth: 2,
    borderBottomColor: C.black,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  tabActive: { borderBottomColor: C.primary },
  tabText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#9CA3AF',
    textTransform: 'uppercase',
  },
  tabTextActive: { color: C.primary },
  card: { backgroundColor: C.white, borderWidth: 2, borderColor: C.black },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 10,
  },
  rowBorder: { borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  rowTitle: { fontSize: 14, fontWeight: '700', color: C.black },
  rowSub: { fontSize: 11, color: '#6B7280', marginTop: 2 },
  locIcon: {
    width: 36,
    height: 36,
    backgroundColor: '#EFF6FF',
    borderWidth: 2,
    borderColor: C.black,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  iconBtn: { padding: 8 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderWidth: 2,
    borderColor: C.success,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  badgeText: { fontSize: 9, fontWeight: '700', textTransform: 'uppercase' },
  devDetail: {
    backgroundColor: '#F8F9FA',
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    padding: 14,
  },
  codeBox: {
    backgroundColor: C.white,
    borderWidth: 2,
    borderColor: C.black,
    padding: 12,
    marginBottom: 10,
  },
  codeLabel: {
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
    color: '#6B7280',
    letterSpacing: 0.5,
  },
  codeValue: {
    fontSize: 24,
    fontWeight: '700',
    color: C.primary,
    letterSpacing: 4,
    marginVertical: 4,
  },
  codeSub: { fontSize: 11, color: '#6B7280' },
  lastSeen: { fontSize: 11, color: '#6B7280', marginBottom: 8 },
  devActions: { flexDirection: 'row', gap: 8 },
  devActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 2,
    borderColor: C.danger,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  devActionText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  syncBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: C.primary,
    borderWidth: 2,
    borderColor: C.black,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 8,
  },
  syncBtnText: {
    color: C.white,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  empty: { alignItems: 'center', paddingVertical: 60, gap: 8 },
  emptyText: { fontSize: 14, fontWeight: '700', color: '#6B7280' },
  emptySub: { fontSize: 12, color: '#9CA3AF' },
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
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: C.black },
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
});

const admsS = StyleSheet.create({
  section: {
    backgroundColor: C.white,
    borderWidth: 2,
    borderColor: C.black,
    padding: 16,
    marginBottom: 12,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  stepBadge: {
    width: 22,
    height: 22,
    backgroundColor: C.black,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNum: { color: C.white, fontSize: 11, fontWeight: '700' },
  stepTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: C.black,
    textTransform: 'uppercase',
  },
  hint: { fontSize: 11, color: '#6B7280', lineHeight: 16 },
  deviceCard: {
    borderWidth: 2,
    borderColor: C.black,
    padding: 12,
    marginBottom: 8,
    backgroundColor: '#FAFAFA',
  },
  deviceCardActive: { borderColor: C.primary, backgroundColor: '#EFF6FF' },
  deviceName: { fontSize: 13, fontWeight: '800', color: C.black },
  deviceSub: { fontSize: 11, color: '#6B7280', marginTop: 2 },
  snBadge: {
    marginLeft: 'auto',
    borderWidth: 2,
    borderColor: C.success,
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  snBadgeText: { fontSize: 9, fontWeight: '700', color: C.success },
  saveSerialBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: C.primary,
    borderWidth: 2,
    borderColor: C.black,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  saveSerialBtnText: {
    color: C.white,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  serialRegistered: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 8,
  },
  serialRegisteredText: { fontSize: 11, color: C.success, fontWeight: '700' },
  empHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 2,
    borderBottomColor: C.black,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  syncAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: C.primary,
    borderWidth: 2,
    borderColor: C.black,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  syncAllBtnText: {
    color: C.white,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  empRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexWrap: 'wrap',
  },
  empRowBorder: { borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  empName: { fontSize: 12, fontWeight: '700', color: C.black },
  empId: {
    fontSize: 12,
    color: '#6B7280',
    fontFamily: 'monospace',
    marginTop: 1,
  },
  bioIdEdit: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  bioIdInput: {
    width: 60,
    borderWidth: 2,
    borderColor: C.primary,
    paddingHorizontal: 6,
    paddingVertical: 4,
    fontSize: 12,
    fontFamily: 'monospace',
    color: C.black,
  },
  idChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 2,
    paddingHorizontal: 7,
    paddingVertical: 4,
  },
  idChipSet: { borderColor: C.success, backgroundColor: '#F0FDF4' },
  idChipUnset: { borderColor: '#D1D5DB', borderStyle: 'dashed' },
  rfidChipSet: { borderColor: C.primary, backgroundColor: '#EFF6FF' },
  idChipText: { fontSize: 12, fontWeight: '700' },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderWidth: 2,
    borderColor: C.black,
    paddingHorizontal: 7,
    paddingVertical: 5,
    backgroundColor: C.white,
  },
  actionBtnText: { fontSize: 12, fontWeight: '700', color: C.black },
  cmdHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: C.black,
  },
  refreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 2,
    borderColor: C.black,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  refreshBtnText: { fontSize: 11, fontWeight: '700', color: C.black },
  cmdRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  cmdType: {
    fontSize: 11,
    fontWeight: '700',
    color: C.black,
    textTransform: 'uppercase',
  },
  cmdEmp: { fontSize: 11, color: '#6B7280', marginTop: 1 },
  cmdTime: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  cmdStatus: {
    borderWidth: 2,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  cmdDone: { borderColor: C.success, backgroundColor: '#F0FDF4' },
  cmdPending: { borderColor: '#FA731C', backgroundColor: '#FFF7ED' },
  cmdSent: { borderColor: C.primary, backgroundColor: '#EFF6FF' },
  cmdFailed: { borderColor: C.danger, backgroundColor: '#FEF2F2' },
  cmdStatusText: { fontSize: 9, fontWeight: '800', textTransform: 'uppercase' },
  rfidEmpBox: {
    backgroundColor: '#EFF6FF',
    borderWidth: 2,
    borderColor: '#BFDBFE',
    padding: 12,
    marginBottom: 14,
  },
  rfidEmpName: { fontSize: 14, fontWeight: '700', color: C.black },
  rfidEmpId: { fontSize: 11, color: '#6B7280', marginTop: 2 },
});

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
} from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { biometricAPI } from '../api/api';
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

const EMPTY_LOC = { name: '', address: '', description: '' };
const EMPTY_DEV = { name: '', location: '' };

export default function BiometricDeviceScreen() {
  const navigation = useNavigation<any>();
  const [tab, setTab] = useState<'locations' | 'devices'>('locations');
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

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const onRefresh = () => { setRefreshing(true); fetchAll(); };

  // ── Locations ──────────────────────────────────────────────────────────────
  const openLocCreate = () => {
    setEditLocId(null);
    setLocForm(EMPTY_LOC);
    setLocModal(true);
  };

  const openLocEdit = (loc: Location) => {
    setEditLocId(loc._id);
    setLocForm({ name: loc.name, address: loc.address || '', description: loc.description || '' });
    setLocModal(true);
  };

  const saveLocation = async () => {
    if (!locForm.name.trim()) { Alert.alert('Validation', 'Location name is required'); return; }
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
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try {
            await biometricAPI.deleteLocation(loc._id);
            fetchAll();
          } catch (e: any) { Alert.alert('Error', e.message); }
        },
      },
    ]);
  };

  // ── Devices ────────────────────────────────────────────────────────────────
  const openDevCreate = () => {
    if (locations.length === 0) { Alert.alert('No Locations', 'Create a location first before adding a device.'); return; }
    setEditDevId(null);
    setDevForm({ name: '', location: locations[0]._id });
    setDevModal(true);
  };

  const saveDevice = async () => {
    if (!devForm.name.trim()) { Alert.alert('Validation', 'Device name is required'); return; }
    if (!devForm.location) { Alert.alert('Validation', 'Please select a location'); return; }
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
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try {
            await biometricAPI.deleteDevice(dev._id);
            fetchAll();
          } catch (e: any) { Alert.alert('Error', e.message); }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.loader}><ActivityIndicator size="large" color={C.primary} /></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 4, marginRight: 4 }}>
            <ChevronLeft size={22} color={C.black} />
          </TouchableOpacity>
          <Cpu size={20} color={C.primary} />
          <Text style={styles.headerTitle}>Biometric Devices</Text>
        </View>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={tab === 'locations' ? openLocCreate : openDevCreate}
        >
          <Plus size={14} color={C.white} />
          <Text style={styles.addBtnText}>{tab === 'locations' ? 'Location' : 'Device'}</Text>
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        {(['locations', 'devices'] as const).map(t => (
          <TouchableOpacity
            key={t}
            style={[styles.tab, tab === t && styles.tabActive]}
            onPress={() => setTab(t)}
          >
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
              {t === 'locations' ? `Locations (${locations.length})` : `Devices (${devices.length})`}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} />}
      >
        {tab === 'locations' ? (
          locations.length === 0 ? (
            <View style={styles.empty}>
              <MapPin size={32} color="#D1D5DB" />
              <Text style={styles.emptyText}>No locations yet</Text>
              <Text style={styles.emptySub}>Tap + to add your first location</Text>
            </View>
          ) : (
            <View style={styles.card}>
              {locations.map((loc, i) => (
                <View key={loc._id} style={[styles.row, i > 0 && styles.rowBorder]}>
                  <View style={styles.locIcon}>
                    <MapPin size={16} color={C.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowTitle}>{loc.name}</Text>
                    {loc.address ? <Text style={styles.rowSub}>{loc.address}</Text> : null}
                  </View>
                  <View style={[styles.statusDot, { backgroundColor: loc.isActive ? C.success : '#D1D5DB' }]} />
                  <TouchableOpacity onPress={() => openLocEdit(loc)} style={styles.iconBtn}>
                    <Edit2 size={14} color={C.primary} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => deleteLocation(loc)} style={styles.iconBtn}>
                    <Trash2 size={14} color={C.danger} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )
        ) : (
          devices.length === 0 ? (
            <View style={styles.empty}>
              <Cpu size={32} color="#D1D5DB" />
              <Text style={styles.emptyText}>No devices yet</Text>
              <Text style={styles.emptySub}>Add a biometric device to a location</Text>
            </View>
          ) : (
            <View style={styles.card}>
              {devices.map((dev, i) => (
                <View key={dev._id}>
                  <TouchableOpacity
                    style={[styles.row, i > 0 && styles.rowBorder]}
                    onPress={() => setExpandedDev(expandedDev === dev._id ? null : dev._id)}
                    activeOpacity={0.8}
                  >
                    <View style={styles.locIcon}>
                      <Cpu size={16} color={C.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.rowTitle}>{dev.name}</Text>
                      <Text style={styles.rowSub}>{dev.location?.name || '—'}</Text>
                    </View>
                    {dev.activated
                      ? <View style={styles.badge}><Wifi size={10} color={C.success} /><Text style={[styles.badgeText, { color: C.success }]}>Active</Text></View>
                      : <View style={[styles.badge, { borderColor: '#D1D5DB' }]}><WifiOff size={10} color="#9CA3AF" /><Text style={[styles.badgeText, { color: '#9CA3AF' }]}>Pending</Text></View>
                    }
                    {expandedDev === dev._id ? <ChevronUp size={14} color="#9CA3AF" /> : <ChevronDown size={14} color="#9CA3AF" />}
                  </TouchableOpacity>

                  {expandedDev === dev._id && (
                    <View style={styles.devDetail}>
                      {dev.activationCode && !dev.activated && (
                        <View style={styles.codeBox}>
                          <Text style={styles.codeLabel}>ACTIVATION CODE</Text>
                          <Text style={styles.codeValue}>{dev.activationCode}</Text>
                          <Text style={styles.codeSub}>Enter this code on the physical device to pair it</Text>
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
                          <Text style={[styles.devActionText, { color: C.danger }]}>Delete</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                </View>
              ))}
            </View>
          )
        )}
      </ScrollView>

      {/* Location Modal */}
      <Modal visible={locModal} transparent animationType="slide">
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editLocId ? 'Edit Location' : 'Add Location'}</Text>
              <TouchableOpacity onPress={() => setLocModal(false)}><X size={20} color={C.black} /></TouchableOpacity>
            </View>
            {[
              { label: 'Name *', key: 'name', placeholder: 'Head Office' },
              { label: 'Address', key: 'address', placeholder: '123 Main St, Mumbai' },
              { label: 'Description', key: 'description', placeholder: 'Optional description' },
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
            <TouchableOpacity style={styles.saveBtn} onPress={saveLocation} disabled={locSaving}>
              {locSaving ? <ActivityIndicator size="small" color={C.white} /> : (
                <><Save size={14} color={C.white} /><Text style={styles.saveBtnText}>Save Location</Text></>
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
              <TouchableOpacity onPress={() => setDevModal(false)}><X size={20} color={C.black} /></TouchableOpacity>
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
                  style={[styles.locOption, devForm.location === loc._id && styles.locOptionSelected]}
                  onPress={() => setDevForm(p => ({ ...p, location: loc._id }))}
                >
                  {devForm.location === loc._id && <Check size={12} color={C.primary} />}
                  <Text style={[styles.locOptionText, devForm.location === loc._id && { color: C.primary }]}>
                    {loc.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity style={styles.saveBtn} onPress={saveDevice} disabled={devSaving}>
              {devSaving ? <ActivityIndicator size="small" color={C.white} /> : (
                <><Save size={14} color={C.white} /><Text style={styles.saveBtnText}>Save Device</Text></>
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
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14, backgroundColor: C.white,
    borderBottomWidth: 2, borderBottomColor: C.black,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: C.black },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: C.primary, borderWidth: 2, borderColor: C.black,
    paddingHorizontal: 12, paddingVertical: 8,
  },
  addBtnText: { color: C.white, fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
  tabs: { flexDirection: 'row', backgroundColor: C.white, borderBottomWidth: 2, borderBottomColor: C.black },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center', borderBottomWidth: 3, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: C.primary },
  tabText: { fontSize: 12, fontWeight: '700', color: '#9CA3AF', textTransform: 'uppercase' },
  tabTextActive: { color: C.primary },
  card: { backgroundColor: C.white, borderWidth: 2, borderColor: C.black },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 14, gap: 10 },
  rowBorder: { borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  rowTitle: { fontSize: 14, fontWeight: '700', color: C.black },
  rowSub: { fontSize: 11, color: '#6B7280', marginTop: 2 },
  locIcon: {
    width: 36, height: 36, backgroundColor: '#EFF6FF',
    borderWidth: 2, borderColor: C.black, alignItems: 'center', justifyContent: 'center',
  },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  iconBtn: { padding: 8 },
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    borderWidth: 2, borderColor: C.success, paddingHorizontal: 6, paddingVertical: 3,
  },
  badgeText: { fontSize: 9, fontWeight: '700', textTransform: 'uppercase' },
  devDetail: { backgroundColor: '#F8F9FA', borderTopWidth: 1, borderTopColor: '#F3F4F6', padding: 14 },
  codeBox: { backgroundColor: C.white, borderWidth: 2, borderColor: C.black, padding: 12, marginBottom: 10 },
  codeLabel: { fontSize: 9, fontWeight: '700', textTransform: 'uppercase', color: '#6B7280', letterSpacing: 0.5 },
  codeValue: { fontSize: 24, fontWeight: '700', color: C.primary, letterSpacing: 4, marginVertical: 4 },
  codeSub: { fontSize: 11, color: '#6B7280' },
  lastSeen: { fontSize: 11, color: '#6B7280', marginBottom: 8 },
  devActions: { flexDirection: 'row', gap: 8 },
  devActionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 2, borderColor: C.danger, paddingHorizontal: 10, paddingVertical: 6 },
  devActionText: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  empty: { alignItems: 'center', paddingVertical: 60, gap: 8 },
  emptyText: { fontSize: 14, fontWeight: '700', color: '#6B7280' },
  emptySub: { fontSize: 12, color: '#9CA3AF' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modal: { backgroundColor: C.white, borderTopWidth: 2, borderTopColor: C.black, padding: 20, paddingBottom: 40 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: C.black },
  field: { marginBottom: 14 },
  fieldLabel: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', color: '#6B7280', marginBottom: 6, letterSpacing: 0.5 },
  fieldInput: { borderWidth: 2, borderColor: C.black, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, fontWeight: '500', color: C.black },
  saveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: C.primary, borderWidth: 2, borderColor: C.black, paddingVertical: 14, marginTop: 4,
  },
  saveBtnText: { color: C.white, fontSize: 13, fontWeight: '700', textTransform: 'uppercase' },
  locOption: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 10, borderWidth: 2, borderColor: '#E5E7EB', marginBottom: 6 },
  locOptionSelected: { borderColor: C.primary, backgroundColor: '#EFF6FF' },
  locOptionText: { fontSize: 14, fontWeight: '600', color: C.black },
});

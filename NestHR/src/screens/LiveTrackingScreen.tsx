import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Linking,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Navigation,
  ChevronLeft,
  MapPin,
  Battery,
  Clock,
  ExternalLink,
  ShieldAlert,
} from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { trackingAPI } from '../api/api';
import { C, useResponsive, tabletContainerStyle } from '../theme';

export default function LiveTrackingScreen() {
  const navigation = useNavigation<any>();
  const { isTablet } = useResponsive();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [trackedStaff, setTrackedStaff] = useState<any[]>([]);

  const load = useCallback(async () => {
    try {
      const res = await trackingAPI.getLive();
      setTrackedStaff(res.data || []);
    } catch {
      // Ignore load error
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 30000); // Poll every 30 seconds
    return () => clearInterval(interval);
  }, [load]);

  const openInMap = (lat: number, lng: number, label: string) => {
    const scheme = Platform.select({
      ios: `maps:0,0?q=${label}@${lat},${lng}`,
      android: `geo:0,0?q=${lat},${lng}(${label})`,
    });
    const url = scheme || `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
    Linking.openURL(url).catch(() => {
      Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`);
    });
  };

  const renderItem = ({ item }: { item: any }) => {
    const emp = item.employee;
    const loc = item.lastLocation;
    const empName = emp ? `${emp.firstName} ${emp.lastName}` : 'Employee';
    const timeStr = loc?.updatedAt
      ? new Date(loc.updatedAt).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        })
      : 'Recently';

    return (
      <View style={[styles.card, isTablet && styles.cardTablet]}>
        <View style={styles.cardHeader}>
          <View style={styles.iconBox}>
            <Navigation size={18} color={C.primary} />
          </View>
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={styles.name}>{empName}</Text>
            <Text style={styles.sub}>
              {emp?.designation || 'Staff'} {emp?.department ? `· ${emp.department}` : ''}
            </Text>
          </View>
          <View style={styles.liveBadge}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>ON DUTY</Text>
          </View>
        </View>

        <View style={styles.metaRow}>
          <View style={styles.metaItem}>
            <Clock size={13} color="#6B7280" />
            <Text style={styles.metaText}>{timeStr}</Text>
          </View>
          <View style={styles.metaItem}>
            <MapPin size={13} color="#6B7280" />
            <Text style={styles.metaText}>{item.totalDistanceKm || 0} km today</Text>
          </View>
          {loc?.battery != null && (
            <View style={styles.metaItem}>
              <Battery size={13} color={loc.battery < 20 ? C.danger : '#6B7280'} />
              <Text style={styles.metaText}>{loc.battery}%</Text>
            </View>
          )}
        </View>

        {loc?.latitude && loc?.longitude ? (
          <TouchableOpacity
            style={styles.mapBtn}
            onPress={() => openInMap(loc.latitude, loc.longitude, empName)}
            activeOpacity={0.8}
          >
            <ExternalLink size={14} color={C.white} />
            <Text style={styles.mapBtnText}>View on Google Maps</Text>
          </TouchableOpacity>
        ) : (
          <Text style={styles.noLocText}>Waiting for location fix...</Text>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
        >
          <ChevronLeft size={22} color={C.black} />
        </TouchableOpacity>
        <Navigation size={20} color={C.primary} />
        <Text style={styles.headerTitle}>Live Field Tracking</Text>
        <View style={{ flex: 1 }} />
      </View>

      <View style={styles.banner}>
        <ShieldAlert size={16} color={C.primary} />
        <Text style={styles.bannerText}>
          Tracking is active only during duty hours (between punch-in and punch-out).
        </Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={C.primary} />
        </View>
      ) : (
        <View style={[{ flex: 1 }, tabletContainerStyle(isTablet)]}>
          <FlatList
            key={isTablet ? 'tablet-grid-2' : 'mobile-list'}
            data={trackedStaff}
            keyExtractor={item => item._id}
            numColumns={isTablet ? 2 : 1}
            columnWrapperStyle={isTablet ? styles.colWrapper : undefined}
            renderItem={renderItem}
            contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => {
                  setRefreshing(true);
                  load();
                }}
                tintColor={C.primary}
              />
            }
            ListEmptyComponent={
              <View style={styles.center}>
                <Navigation size={42} color="#D1D5DB" />
                <Text style={styles.emptyTitle}>No field staff active</Text>
                <Text style={styles.emptySubtitle}>
                  Employees with live tracking enabled will appear here after punching in.
                </Text>
              </View>
            }
          />
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
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
  backBtn: { padding: 4, marginRight: 2 },
  headerTitle: { fontSize: 20, fontWeight: '400', color: C.black },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#EFF6FF',
    borderBottomWidth: 1,
    borderBottomColor: '#DBEAFE',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  bannerText: {
    fontSize: 12,
    color: '#1E40AF',
    flex: 1,
  },
  card: {
    backgroundColor: C.white,
    borderWidth: 2,
    borderRadius: 8,
    borderRightWidth: 5,
    borderBottomWidth: 5,
    borderRightColor: '#0A0A0A',
    borderBottomColor: '#0A0A0A',
    borderColor: C.black,
    padding: 14,
  },
  cardTablet: {
    flex: 1,
  },
  colWrapper: {
    gap: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  iconBox: {
    width: 36,
    height: 36,
    backgroundColor: '#EFF6FF',
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
  name: { fontSize: 14, fontWeight: '400', color: C.black },
  sub: { fontSize: 11, color: '#6B7280', marginTop: 2 },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#DCFCE7',
    borderWidth: 1,
    borderColor: '#86EFAC',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: C.success,
  },
  liveText: {
    fontSize: 9,
    fontWeight: '600',
    color: '#166534',
    letterSpacing: 0.5,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 12,
    paddingVertical: 6,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#F3F4F6',
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 12,
    color: '#4B5563',
  },
  mapBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: C.primary,
    borderWidth: 2,
    borderRadius: 6,
    borderRightWidth: 4,
    borderBottomWidth: 4,
    borderRightColor: '#0A0A0A',
    borderBottomColor: '#0A0A0A',
    borderColor: C.black,
    paddingVertical: 10,
    marginTop: 4,
  },
  mapBtnText: {
    color: C.white,
    fontSize: 12,
    fontWeight: '500',
    textTransform: 'uppercase',
  },
  noLocText: {
    fontSize: 12,
    color: '#9CA3AF',
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 6,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '500',
    color: '#4B5563',
    marginTop: 6,
  },
  emptySubtitle: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'center',
    maxWidth: 260,
  },
});


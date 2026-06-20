import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
  PermissionsAndroid,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import {
  Bell,
  ChevronLeft,
  CheckCheck,
  Trash2,
  Info,
  Calendar,
  IndianRupee,
  Users,
  Clock,
} from 'lucide-react-native';
import { localNotificationsAPI, LocalNotification } from '../api/api';
import { C } from '../theme';

function relativeTime(ts: number) {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function getIcon(title: string) {
  const t = title.toLowerCase();
  if (t.includes('leave') || t.includes('holiday')) return Calendar;
  if (t.includes('payroll') || t.includes('salary') || t.includes('pay'))
    return IndianRupee;
  if (t.includes('employee') || t.includes('hire')) return Users;
  if (t.includes('attendance') || t.includes('check')) return Clock;
  return Info;
}

// Demo notifications seeded on first open so the screen isn't empty
const DEMO_NOTIFICATIONS: Omit<LocalNotification, 'id' | 'ts' | 'read'>[] = [
  {
    title: 'Leave Approved',
    body: 'Your leave request for Jun 15-16 has been approved.',
  },
  {
    title: 'Payroll Processed',
    body: 'May 2026 payroll has been successfully processed for 24 employees.',
  },
  {
    title: 'New Employee Added',
    body: 'Priya Sharma has been added to the Engineering department.',
  },
  {
    title: 'Attendance Alert',
    body: '5 employees have not checked in yet today.',
  },
];

export default function NotificationsScreen() {
  const navigation = useNavigation<any>();
  const [notifications, setNotifications] = useState<LocalNotification[]>([]);
  const [loading, setLoading] = useState(true);

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    try {
      let all = await localNotificationsAPI.getAll();
      if (all.length === 0) {
        for (const n of DEMO_NOTIFICATIONS) {
          await localNotificationsAPI.add(n);
        }
        all = await localNotificationsAPI.getAll();
      }
      setNotifications(all);
      if (Platform.OS === 'android' && Platform.Version >= 33) {
        try {
          await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
            {
              title: 'Notification Permission',
              message:
                'NestHR needs permission to send you attendance and leave notifications.',
              buttonPositive: 'Allow',
              buttonNegative: 'Deny',
            },
          );
        } catch {}
      }
      if (Platform.OS === 'ios' && all.length === 0) {
        Alert.alert(
          'Enable Notifications',
          'Enable notifications in Settings to get real-time check-in and leave alerts.',
        );
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadNotifications();
    }, [loadNotifications]),
  );

  const markAllRead = async () => {
    await localNotificationsAPI.markAllRead();
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const clearAll = () => {
    Alert.alert('Clear All', 'Remove all notifications?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: async () => {
          await localNotificationsAPI.clear();
          setNotifications([]);
        },
      },
    ]);
  };

  const markRead = async (id: string) => {
    await localNotificationsAPI.markRead(id);
    setNotifications(prev =>
      prev.map(n => (n.id === id ? { ...n, read: true } : n)),
    );
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  const renderItem = ({ item }: { item: LocalNotification }) => {
    const Icon = getIcon(item.title);
    return (
      <TouchableOpacity
        style={[styles.notifRow, !item.read && styles.notifUnread]}
        onPress={() => markRead(item.id)}
        activeOpacity={0.8}
      >
        <View style={[styles.iconWrap, !item.read && styles.iconWrapActive]}>
          <Icon size={16} color={!item.read ? C.white : '#6B7280'} />
        </View>
        <View style={{ flex: 1 }}>
          <View style={styles.notifHeader}>
            <Text
              style={[styles.notifTitle, !item.read && styles.notifTitleUnread]}
            >
              {item.title}
            </Text>
            <Text style={styles.notifTime}>{relativeTime(item.ts)}</Text>
          </View>
          <Text style={styles.notifBody} numberOfLines={2}>
            {item.body}
          </Text>
        </View>
        {!item.read && <View style={styles.unreadDot} />}
      </TouchableOpacity>
    );
  };

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
          <Bell size={20} color={C.primary} />
          <Text style={styles.headerTitle}>Notifications</Text>
          {unreadCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{unreadCount}</Text>
            </View>
          )}
        </View>
        <View style={styles.headerActions}>
          {unreadCount > 0 && (
            <TouchableOpacity onPress={markAllRead} style={styles.actionBtn}>
              <CheckCheck size={14} color={C.primary} />
            </TouchableOpacity>
          )}
          {notifications.length > 0 && (
            <TouchableOpacity onPress={clearAll} style={styles.actionBtn}>
              <Trash2 size={14} color={C.danger} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={C.primary} />
        </View>
      ) : notifications.length === 0 ? (
        <View style={styles.empty}>
          <Bell size={40} color="#D1D5DB" />
          <Text style={styles.emptyTitle}>All caught up!</Text>
          <Text style={styles.emptySub}>
            New notifications will appear here
          </Text>
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={n => n.id}
          renderItem={renderItem}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          contentContainerStyle={{ paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <View>
              <View style={styles.infoBanner}>
                <Text style={styles.infoBannerText}>
                  Real-time check-in/check-out and leave request notifications
                  appear here.
                </Text>
              </View>
              {unreadCount > 0 && (
                <View style={styles.listHeader}>
                  <Text style={styles.listHeaderText}>
                    {unreadCount} unread
                  </Text>
                </View>
              )}
            </View>
          }
        />
      )}
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
  badge: {
    backgroundColor: C.danger,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  badgeText: { color: C.white, fontSize: 12, fontWeight: '700' },
  headerActions: { flexDirection: 'row', gap: 4 },
  actionBtn: {
    padding: 8,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    backgroundColor: C.white,
  },
  infoBanner: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#FFFBEB',
    borderBottomWidth: 2,
    borderBottomColor: C.black,
  },
  infoBannerText: { fontSize: 11, fontWeight: '600', color: '#92400E' },
  listHeader: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#EFF6FF',
    borderBottomWidth: 1,
    borderBottomColor: '#DBEAFE',
  },
  listHeaderText: {
    fontSize: 11,
    fontWeight: '700',
    color: C.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  notifRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: C.white,
  },
  notifUnread: { backgroundColor: '#FAFBFF' },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 0,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapActive: { backgroundColor: C.primary, borderColor: C.black },
  notifHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 3,
  },
  notifTitle: { fontSize: 13, fontWeight: '600', color: '#6B7280', flex: 1 },
  notifTitleUnread: { color: C.black, fontWeight: '700' },
  notifTime: {
    fontSize: 12,
    color: '#9CA3AF',
    fontWeight: '500',
    marginLeft: 8,
  },
  notifBody: { fontSize: 12, color: '#6B7280', lineHeight: 18 },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: C.primary,
    marginTop: 4,
  },
  separator: { height: 1, backgroundColor: '#F3F4F6' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: C.black },
  emptySub: { fontSize: 13, color: '#9CA3AF' },
});

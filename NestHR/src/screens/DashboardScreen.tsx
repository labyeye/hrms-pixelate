import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Image,
  Dimensions,
  Modal,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Users,
  CheckCircle2,
  CalendarOff,
  Clock,
  Building2,
  Briefcase,
  TrendingUp,
  RefreshCw,
  Bell,
  IndianRupee,
  Calendar,
  AlertCircle,
  LogIn,
  Camera,
  Trash2,
  X,
} from 'lucide-react-native';
import { useAuth } from '../contexts/AuthContext';
import {
  dashboardAPI,
  localNotificationsAPI,
  employeeAPI,
  attendanceAPI,
  payrollAPI,
  authAPI,
  announcementAPI,
} from '../api/api';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
import { C, S } from '../theme';

const CARD_WIDTH = (Dimensions.get('window').width - 32 - 10) / 2;

// ─── Admin Dashboard ──────────────────────────────────────────────────────────

const ADMIN_STATS = [
  {
    label: 'Total Employees',
    key: 'totalEmployees',
    icon: Users,
    color: C.primary,
  },
  {
    label: 'Present Today',
    key: 'todayPresent',
    icon: CheckCircle2,
    color: C.success,
  },
  {
    label: 'On Leave',
    key: 'todayOnLeave',
    icon: CalendarOff,
    color: C.warning,
  },
  {
    label: 'Pending Leaves',
    key: 'pendingLeaves',
    icon: Clock,
    color: C.danger,
  },
  {
    label: 'Departments',
    key: 'departments',
    icon: Building2,
    color: C.primary,
  },
  {
    label: 'Open Positions',
    key: 'openPositions',
    icon: Briefcase,
    color: C.secondary,
  },
];

function AdminDashboard({ navigation }: any) {
  const { user } = useAuth();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);

  const loadUnread = useCallback(async () => {
    const all = await localNotificationsAPI.getAll();
    setUnreadCount(all.filter(n => !n.read).length);
  }, []);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await dashboardAPI.getStats();
      const payload = res.data || res;
      setStats({ ...payload.stats, recentActivity: payload.recentHires });
    } catch (e: any) {
      setError(e.message || 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUnread();
  }, [loadUnread]);
  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const greet = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good Morning';
    if (h < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  const handleCardPress = (key: string) => {
    if (key === 'totalEmployees') navigation.navigate('Employees');
    else if (key === 'todayPresent') navigation.navigate('Attendance');
    else if (key === 'todayOnLeave' || key === 'pendingLeaves')
      navigation.navigate('Leave');
    else if (key === 'departments')
      navigation.navigate('More', { screen: 'Departments' });
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.headerAvatarWrap}>
          {user?.avatar ? (
            <Image source={{ uri: user.avatar }} style={styles.headerAvatar} />
          ) : (
            <View style={[styles.headerAvatar, styles.headerAvatarFallback]}>
              <Text style={styles.headerAvatarText}>
                {(user?.name || 'U')[0].toUpperCase()}
              </Text>
            </View>
          )}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.greet}>{greet()},</Text>
          <Text style={styles.name}>{user?.name || 'User'}</Text>
          {user?.company?.name && (
            <Text style={styles.company}>{user.company.name}</Text>
          )}
        </View>
        <TouchableOpacity
          onPress={() =>
            navigation.navigate('More', { screen: 'Notifications' })
          }
          style={styles.bellBtn}
        >
          <Bell size={25} color={C.black} />
          {unreadCount > 0 && (
            <View style={styles.bellBadge}>
              <Text style={styles.bellBadgeText}>
                {unreadCount > 9 ? '9+' : unreadCount}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loaderWrap}>
          <ActivityIndicator size="large" color={C.primary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={C.primary}
            />
          }
          showsVerticalScrollIndicator={false}
        >
          {error && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity onPress={load}>
                <RefreshCw size={14} color={C.danger} />
              </TouchableOpacity>
            </View>
          )}

          <Text style={styles.sectionLabel}>Overview</Text>
          <View style={styles.grid}>
            {ADMIN_STATS.map(s => {
              const Icon = s.icon;
              return (
                <TouchableOpacity
                  key={s.key}
                  style={styles.statCard}
                  activeOpacity={0.8}
                  onPress={() => handleCardPress(s.key)}
                >
                  <View
                    style={[styles.statIconWrap, { backgroundColor: s.color }]}
                  >
                    <Icon size={18} color={C.white} />
                  </View>
                  <Text style={styles.statValue}>{stats?.[s.key] ?? '—'}</Text>
                  <Text style={styles.statLabel}>{s.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={styles.sectionLabel}>This Month</Text>
          <View style={styles.card}>
            {[
              {
                label: 'Payroll Processed',
                val: stats?.monthlyPayroll ?? '—',
                icon: <TrendingUp size={14} color={C.success} />,
              },
              {
                label: 'New Hires',
                val: stats?.newHires ?? '—',
                icon: <Users size={14} color={C.primary} />,
              },
              {
                label: 'Leave Requests',
                val: stats?.pendingLeaves ?? '—',
                icon: <Clock size={14} color={C.warning} />,
              },
            ].map((item, i) => (
              <View
                key={item.label}
                style={[styles.quickRow, i > 0 && styles.quickBorder]}
              >
                <View style={styles.quickIcon}>{item.icon}</View>
                <Text style={styles.quickLabel}>{item.label}</Text>
                <Text style={styles.quickVal}>{item.val}</Text>
              </View>
            ))}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

// ─── Employee Dashboard ───────────────────────────────────────────────────────

function localDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function fmtTime(iso: string) {
  const d = new Date(iso);
  let h = d.getHours(), m = d.getMinutes();
  const ampm = h < 12 ? 'AM' : 'PM';
  const hh = h % 12 || 12;
  return `${hh}:${m.toString().padStart(2, '0')} ${ampm}`;
}

const STATUS_COLOR: Record<string, string> = {
  present: C.success,
  late: C.warning,
  absent: C.danger,
  half_day: '#7C3AED',
  on_leave: C.primary,
  holiday: '#0891B2',
};

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const TAB_DAYS = [
  { label: 'Today', offset: 0 },
  { label: 'Yesterday', offset: 1 },
  { label: '2 Days Ago', offset: 2 },
];

function EmployeeDashboard({ navigation }: any) {
  const { user, updateUser } = useAuth();
  const [empProfile, setEmpProfile] = useState<any>(null);
  const [myAttendance, setMyAttendance] = useState<any[]>([]);
  const [latestPayroll, setLatestPayroll] = useState<any>(null);
  const [essStats, setEssStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [activeTab, setActiveTab] = useState(0);
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [photoSaving, setPhotoSaving] = useState(false);

  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  const loadUnread = useCallback(async () => {
    const all = await localNotificationsAPI.getAll();
    setUnreadCount(all.filter(n => !n.read).length);
  }, []);

  const load = useCallback(async () => {
    try {
      const [profileRes, attRes, payRes, essRes] = await Promise.allSettled([
        employeeAPI.getMe(),
        attendanceAPI.getAll({ month: String(month), year: String(year), limit: '200' }),
        payrollAPI.getMy(),
        dashboardAPI.getEmployeeStats(),
      ]);
      if (profileRes.status === 'fulfilled') {
        setEmpProfile(profileRes.value?.data || profileRes.value);
      }
      if (attRes.status === 'fulfilled') {
        setMyAttendance(attRes.value?.data || []);
      }
      if (payRes.status === 'fulfilled') {
        const pays = payRes.value?.data || [];
        setLatestPayroll(pays[0] || null);
      }
      if (essRes.status === 'fulfilled') {
        setEssStats(essRes.value?.data || essRes.value);
      }
    } catch {
    } finally {
      setLoading(false);
    }
  }, [month, year]);

  useEffect(() => { loadUnread(); }, [loadUnread]);
  useEffect(() => { load(); }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const greet = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good Morning';
    if (h < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  const avatarUri = empProfile?.avatar || user?.avatar;

  const savePhoto = async (uri: string) => {
    setPhotoSaving(true);
    try {
      await authAPI.updateProfile({ avatar: uri });
      updateUser({ avatar: uri });
      setEmpProfile((p: any) => ({ ...p, avatar: uri }));
      setShowPhotoModal(false);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setPhotoSaving(false);
    }
  };

  const handlePickPhoto = () => {
    Alert.alert('Update Photo', 'Choose source', [
      {
        text: 'Camera',
        onPress: () =>
          launchCamera({ mediaType: 'photo', quality: 0.7, includeBase64: true }, r => {
            if (r.assets?.[0]?.base64)
              savePhoto(`data:image/jpeg;base64,${r.assets[0].base64}`);
          }),
      },
      {
        text: 'Gallery',
        onPress: () =>
          launchImageLibrary({ mediaType: 'photo', quality: 0.7, includeBase64: true }, r => {
            if (r.assets?.[0]?.base64)
              savePhoto(`data:image/jpeg;base64,${r.assets[0].base64}`);
          }),
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const handleRemovePhoto = () => {
    Alert.alert('Remove Photo', 'Remove your profile photo?', [
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          setPhotoSaving(true);
          try {
            await authAPI.updateProfile({ avatar: '' });
            updateUser({ avatar: undefined });
            setEmpProfile((p: any) => ({ ...p, avatar: undefined }));
            setShowPhotoModal(false);
          } catch (e: any) {
            Alert.alert('Error', e.message);
          } finally {
            setPhotoSaving(false);
          }
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  // Month stats
  const presentDays = myAttendance.filter(
    a => ['present', 'late', 'half_day'].includes(a.status) || a.checkIn,
  ).length;
  const absentDays = myAttendance.filter(a => a.status === 'absent').length;
  const lateDays = myAttendance.filter(a => a.status === 'late').length;
  const totalMarked = presentDays + absentDays;
  const attPct = totalMarked > 0 ? Math.round((presentDays / totalMarked) * 100) : 100;

  // Record for each tab day
  const recordFor = (offset: number) => {
    const d = new Date(now);
    d.setDate(d.getDate() - offset);
    const ds = localDateStr(d);
    return myAttendance.find(a => localDateStr(new Date(a.date)) === ds);
  };

  const tabDate = (offset: number) => {
    const d = new Date(now);
    d.setDate(d.getDate() - offset);
    return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
  };

  const activeRecord = recordFor(activeTab);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerAvatarWrap}>
          {avatarUri ? (
            <Image source={{ uri: avatarUri }} style={styles.headerAvatar} />
          ) : (
            <View style={[styles.headerAvatar, styles.headerAvatarFallback]}>
              <Text style={styles.headerAvatarText}>
                {(user?.name || 'U')[0].toUpperCase()}
              </Text>
            </View>
          )}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.greet}>{greet()},</Text>
          <Text style={styles.name}>{user?.name || 'User'}</Text>
          {empProfile?.designation || empProfile?.department?.name ? (
            <Text style={styles.company}>
              {[empProfile?.designation, empProfile?.department?.name]
                .filter(Boolean)
                .join(' · ')}
            </Text>
          ) : null}
        </View>
        <TouchableOpacity
          onPress={() => navigation.navigate('More', { screen: 'Notifications' })}
          style={styles.bellBtn}
        >
          <Bell size={25} color={C.black} />
          {unreadCount > 0 && (
            <View style={styles.bellBadge}>
              <Text style={styles.bellBadgeText}>
                {unreadCount > 9 ? '9+' : unreadCount}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loaderWrap}>
          <ActivityIndicator size="large" color={C.primary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} />
          }
          showsVerticalScrollIndicator={false}
        >
          {/* Profile banner */}
          <View style={styles.profileBanner}>
            <View style={styles.profileBannerLeft}>
              <TouchableOpacity onPress={() => setShowPhotoModal(true)} activeOpacity={0.8}>
                {avatarUri ? (
                  <Image source={{ uri: avatarUri }} style={styles.profileBannerAvatar} />
                ) : (
                  <View style={[styles.profileBannerAvatar, styles.profileBannerAvatarFb]}>
                    <Text style={styles.profileBannerAvatarText}>
                      {(user?.name || 'U')
                        .split(' ')
                        .map((n: string) => n[0])
                        .join('')
                        .toUpperCase()
                        .slice(0, 2)}
                    </Text>
                  </View>
                )}
                <View style={styles.photoEditBadge}>
                  <Camera size={10} color={C.white} />
                </View>
              </TouchableOpacity>
              <View style={{ flex: 1 }}>
                <Text style={styles.profileBannerName}>{user?.name}</Text>
                <Text style={styles.profileBannerRole}>
                  {[empProfile?.designation, empProfile?.department?.name]
                    .filter(Boolean)
                    .join(' · ') ||
                    user?.role?.replace(/_/g, ' ') ||
                    'Employee'}
                </Text>
                {empProfile?.employeeId ? (
                  <Text style={styles.profileBannerEmpId}>{empProfile.employeeId}</Text>
                ) : null}
              </View>
            </View>
            <View style={styles.profileBannerStats}>
              <View style={styles.profileBannerStat}>
                <IndianRupee size={12} color={C.primary} />
                <Text style={styles.profileBannerStatVal}>
                  {empProfile?.salary || latestPayroll?.basicSalary
                    ? `₹${(empProfile?.salary || latestPayroll?.basicSalary || 0).toLocaleString()}`
                    : 'Not set'}
                </Text>
                <Text style={styles.profileBannerStatLabel}>Monthly CTC</Text>
              </View>
              <View style={[styles.profileBannerStat, { borderLeftWidth: 1, borderLeftColor: '#E5E7EB' }]}>
                <Calendar size={12} color={C.success} />
                <Text style={styles.profileBannerStatVal}>
                  {empProfile?.joinDate
                    ? new Date(empProfile.joinDate).toLocaleDateString('en-IN', {
                        day: '2-digit', month: 'short', year: 'numeric',
                      })
                    : '—'}
                </Text>
                <Text style={styles.profileBannerStatLabel}>Joined</Text>
              </View>
            </View>
          </View>

          {/* ESS Overview Alerts & Cards */}
          {essStats && (
            <View style={{ marginBottom: 16 }}>
              {/* Birthday & Anniversary Banners */}
              {(essStats.birthdayWishes?.isTodayUserBirthday ||
                (essStats.birthdayWishes?.todayBirthdays && essStats.birthdayWishes.todayBirthdays.length > 0) ||
                essStats.workAnniversary?.isTodayUserAnniversary ||
                (essStats.workAnniversary?.todayAnniversaries && essStats.workAnniversary.todayAnniversaries.length > 0)) && (
                <View style={styles.essWishCard}>
                  {essStats.birthdayWishes?.isTodayUserBirthday && (
                    <Text style={styles.essWishTitle}>🎂 Happy Birthday to You! 🎉</Text>
                  )}
                  {essStats.birthdayWishes?.todayBirthdays?.map((b: any) => (
                    <Text key={b._id} style={styles.essWishText}>
                      It is {b.firstName} {b.lastName}'s birthday today! 🎁
                    </Text>
                  ))}
                  {essStats.workAnniversary?.isTodayUserAnniversary && (
                    <Text style={[styles.essWishTitle, { marginTop: 8 }]}>🎖️ Happy Work Anniversary! 👏</Text>
                  )}
                  {essStats.workAnniversary?.todayAnniversaries?.map((a: any) => (
                    <Text key={a._id} style={styles.essWishText}>
                      Happy Work Anniversary to {a.firstName} {a.lastName}! 🎖️
                    </Text>
                  ))}
                </View>
              )}

              {/* Shift, Approvals, Unpaid Payroll Info */}
              <View style={styles.essGrid}>
                <View style={styles.essGridCard}>
                  <Clock size={16} color={C.primary} />
                  <Text style={styles.essGridCardLabel}>TODAY'S SHIFT</Text>
                  <Text style={styles.essGridCardVal}>{essStats.todayShift?.name || "General"}</Text>
                  <Text style={styles.essGridCardSub}>
                    {essStats.todayShift?.startTime} - {essStats.todayShift?.endTime}
                  </Text>
                </View>

                <View style={styles.essGridCard}>
                  <CheckCircle2 size={16} color={C.warning} />
                  <Text style={styles.essGridCardLabel}>APPROVALS</Text>
                  <Text style={styles.essGridCardVal}>
                    {essStats.pendingApprovalsCount > 0 ? `${essStats.pendingApprovalsCount} Pending` : "None"}
                  </Text>
                  <Text style={styles.essGridCardSub}>Requires action</Text>
                </View>

                <View style={styles.essGridCard}>
                  <IndianRupee size={16} color={C.success} />
                  <Text style={styles.essGridCardLabel}>UNPAID SALARY</Text>
                  <Text style={styles.essGridCardVal}>
                    {essStats.pendingSalary?.length > 0 ? `${essStats.pendingSalary.length} Slips` : "None"}
                  </Text>
                  <Text style={styles.essGridCardSub}>Pending release</Text>
                </View>
              </View>

              {/* Announcements List */}
              {essStats.announcements?.length > 0 && (
                <View style={styles.essAnnounceCard}>
                  <Text style={styles.essSectionTitle}>📢 Announcements</Text>
                  {essStats.announcements.map((a: any) => {
                    const isRead = a.readBy?.some((id: string) => id === user?.id);
                    const acked = a.acknowledgedBy?.some((id: string) => id === user?.id);
                    return (
                      <TouchableOpacity
                        key={a._id}
                        style={styles.essAnnounceRow}
                        activeOpacity={0.7}
                        onPress={() => {
                          if (!isRead) {
                            announcementAPI.markRead(a._id).catch(() => {});
                            setEssStats((prev: any) => ({
                              ...prev,
                              announcements: prev.announcements.map((x: any) =>
                                x._id === a._id
                                  ? { ...x, readBy: [...(x.readBy || []), user?.id] }
                                  : x,
                              ),
                            }));
                          }
                        }}
                      >
                        <View style={S.rowBetween}>
                          <View style={S.rowCenter}>
                            {a.pinned && <Text style={{ marginRight: 4 }}>📌</Text>}
                            {!!a.priority && a.priority !== 'medium' && (
                              <View
                                style={[
                                  styles.essAnnounceBadge,
                                  {
                                    borderColor:
                                      a.priority === 'critical' || a.priority === 'high'
                                        ? C.danger
                                        : C.success,
                                  },
                                ]}
                              >
                                <Text
                                  style={[
                                    styles.essAnnounceBadgeText,
                                    {
                                      color:
                                        a.priority === 'critical' || a.priority === 'high'
                                          ? C.danger
                                          : C.success,
                                    },
                                  ]}
                                >
                                  {a.priority}
                                </Text>
                              </View>
                            )}
                          </View>
                          {!isRead && <View style={styles.essAnnounceDot} />}
                        </View>
                        <Text style={styles.essAnnounceTitle}>{a.title}</Text>
                        <Text style={styles.essAnnounceBody}>{a.content}</Text>
                        <Text style={styles.essAnnounceDate}>{new Date(a.date).toLocaleDateString('en-IN')}</Text>
                        {a.acknowledgementRequired && (
                          <TouchableOpacity
                            disabled={acked}
                            onPress={() => {
                              announcementAPI.acknowledge(a._id).catch(() => {});
                              setEssStats((prev: any) => ({
                                ...prev,
                                announcements: prev.announcements.map((x: any) =>
                                  x._id === a._id
                                    ? { ...x, acknowledgedBy: [...(x.acknowledgedBy || []), user?.id] }
                                    : x,
                                ),
                              }));
                            }}
                            style={[styles.essAckBtn, acked && { opacity: 0.5 }]}
                          >
                            <Text style={styles.essAckBtnText}>
                              {acked ? '✓ Acknowledged' : 'Acknowledge'}
                            </Text>
                          </TouchableOpacity>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}


            </View>
          )}

          {/* 3-Day Attendance Tabs */}
          <Text style={styles.sectionLabel}>Attendance</Text>
          <View style={styles.tabBar}>
            {TAB_DAYS.map((t, i) => (
              <TouchableOpacity
                key={t.label}
                style={[styles.tabBtn, activeTab === i && styles.tabBtnActive]}
                onPress={() => setActiveTab(i)}
                activeOpacity={0.8}
              >
                <Text style={[styles.tabBtnText, activeTab === i && styles.tabBtnTextActive]}>
                  {t.label}
                </Text>
                <Text style={[styles.tabBtnDate, activeTab === i && styles.tabBtnDateActive]}>
                  {tabDate(t.offset)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.attDayCard}>
            {activeRecord ? (
              <>
                <View style={[
                  styles.attDayStatusBadge,
                  { backgroundColor: STATUS_COLOR[activeRecord.status] || C.textMuted },
                ]}>
                  <Text style={styles.attDayStatusText}>
                    {activeRecord.status.replace(/_/g, ' ').toUpperCase()}
                  </Text>
                </View>
                <View style={styles.attDayRow}>
                  <View style={styles.attDayItem}>
                    <LogIn size={16} color={C.success} />
                    <Text style={styles.attDayItemLabel}>Check In</Text>
                    <Text style={styles.attDayItemVal}>
                      {activeRecord.checkIn ? fmtTime(activeRecord.checkIn) : '—'}
                    </Text>
                  </View>
                  <View style={styles.attDayDivider} />
                  <View style={styles.attDayItem}>
                    <LogIn size={16} color={C.danger} style={{ transform: [{ scaleX: -1 }] }} />
                    <Text style={styles.attDayItemLabel}>Check Out</Text>
                    <Text style={styles.attDayItemVal}>
                      {activeRecord.checkOut ? fmtTime(activeRecord.checkOut) : '—'}
                    </Text>
                  </View>
                  <View style={styles.attDayDivider} />
                  <View style={styles.attDayItem}>
                    <Clock size={16} color={C.primary} />
                    <Text style={styles.attDayItemLabel}>Hours</Text>
                    <Text style={styles.attDayItemVal}>
                      {activeRecord.workHours > 0 ? `${activeRecord.workHours.toFixed(1)}h` : '—'}
                    </Text>
                  </View>
                </View>
              </>
            ) : (
              <View style={styles.attDayEmpty}>
                <AlertCircle size={28} color={C.textMuted} />
                <Text style={styles.attDayEmptyText}>No attendance record</Text>
                <Text style={styles.attDayEmptyDate}>{tabDate(activeTab)}</Text>
              </View>
            )}
          </View>

          {/* This month stats */}
          <Text style={styles.sectionLabel}>{`${MONTHS[month - 1]} ${year} — Attendance`}</Text>
          <View style={styles.monthStats}>
            {[
              { label: 'Present', val: presentDays, color: C.success, icon: CheckCircle2 },
              { label: 'Absent', val: absentDays, color: C.danger, icon: CalendarOff },
              { label: 'Late', val: lateDays, color: C.warning, icon: Clock },
              { label: 'Att %', val: `${attPct}%`, color: C.primary, icon: TrendingUp },
            ].map(item => {
              const Icon = item.icon;
              return (
                <View key={item.label} style={styles.monthStatCard}>
                  <View style={[styles.monthStatIcon, { backgroundColor: item.color }]}>
                    <Icon size={14} color={C.white} />
                  </View>
                  <Text style={[styles.monthStatVal, { color: item.color }]}>{item.val}</Text>
                  <Text style={styles.monthStatLabel}>{item.label}</Text>
                </View>
              );
            })}
          </View>

          {/* Latest payslip */}
          {latestPayroll && (
            <>
              <Text style={styles.sectionLabel}>Latest Payslip</Text>
              <TouchableOpacity
                style={styles.payslipCard}
                onPress={() => navigation.navigate('More', { screen: 'Payroll' })}
                activeOpacity={0.8}
              >
                <View style={styles.payslipLeft}>
                  <IndianRupee size={20} color={C.primary} />
                  <View>
                    <Text style={styles.payslipMonth}>
                      {MONTHS[(latestPayroll.month || 1) - 1]} {latestPayroll.year}
                    </Text>
                    <Text style={styles.payslipStatus}>{latestPayroll.status?.toUpperCase()}</Text>
                  </View>
                </View>
                <Text style={styles.payslipNet}>
                  ₹{(latestPayroll.netSalary || 0).toLocaleString()}
                </Text>
              </TouchableOpacity>
            </>
          )}

          {/* Quick actions */}
          <Text style={styles.sectionLabel}>Quick Actions</Text>
          <View style={styles.quickActions}>
            <TouchableOpacity
              style={[styles.quickActionBtn, { backgroundColor: C.primary }]}
              onPress={() => navigation.navigate('Leave')}
            >
              <Calendar size={16} color={C.white} />
              <Text style={styles.quickActionText}>Apply Leave</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.quickActionBtn, { backgroundColor: '#7C3AED' }]}
              onPress={() => navigation.navigate('More', { screen: 'Payroll' })}
            >
              <IndianRupee size={16} color={C.white} />
              <Text style={styles.quickActionText}>My Payslips</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}

      {/* Photo Modal */}
      <Modal visible={showPhotoModal} transparent animationType="fade">
        <View style={styles.photoOverlay}>
          <TouchableOpacity style={styles.photoOverlayClose} onPress={() => setShowPhotoModal(false)}>
            <X size={24} color={C.white} />
          </TouchableOpacity>

          <View style={styles.photoModalBox}>
            {avatarUri ? (
              <Image
                source={{ uri: avatarUri }}
                style={styles.photoModalImg}
                resizeMode="cover"
              />
            ) : (
              <View style={styles.photoModalPlaceholder}>
                <Text style={styles.photoModalInitials}>
                  {(user?.name || 'U')
                    .split(' ')
                    .map((n: string) => n[0])
                    .join('')
                    .toUpperCase()
                    .slice(0, 2)}
                </Text>
              </View>
            )}
          </View>

          {photoSaving ? (
            <ActivityIndicator color={C.white} style={{ marginTop: 24 }} />
          ) : (
            <View style={styles.photoModalBtns}>
              <TouchableOpacity style={styles.photoModalEditBtn} onPress={handlePickPhoto}>
                <Camera size={18} color={C.white} />
                <Text style={styles.photoModalBtnText}>Edit Photo</Text>
              </TouchableOpacity>
              {!!avatarUri && (
                <TouchableOpacity style={styles.photoModalRemoveBtn} onPress={handleRemovePhoto}>
                  <Trash2 size={18} color={C.white} />
                  <Text style={styles.photoModalBtnText}>Remove</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ─── Root export ──────────────────────────────────────────────────────────────

export default function DashboardScreen({ navigation }: any) {
  const { user } = useAuth();
  const isEmployee = user?.role === 'employee';
  return isEmployee ? (
    <EmployeeDashboard navigation={navigation} />
  ) : (
    <AdminDashboard navigation={navigation} />
  );
}

// ─── Shared styles ────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: C.white,
    borderBottomWidth: 2,
    borderBottomColor: C.black,
  },
  greet: { fontSize: 12, color: C.textMuted, fontWeight: '500' },
  name: { fontSize: 20, fontWeight: '700', color: C.black },
  company: { fontSize: 11, color: C.textMuted, fontWeight: '500' },
  headerAvatarWrap: { marginRight: 10, marginTop: 8 },
  headerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: C.black,
  },
  headerAvatarFallback: {
    backgroundColor: C.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerAvatarText: { color: C.white, fontSize: 18, fontWeight: '700' },
  bellBtn: { padding: 4, position: 'relative', marginTop: 12 },
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
  essWishCard: {
    backgroundColor: '#FDF2F8',
    borderWidth: 2,
    borderColor: C.black,
    padding: 12,
    marginBottom: 12,
  },
  essWishTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: C.black,
  },
  essWishText: {
    fontSize: 12,
    color: C.black,
    marginTop: 2,
    fontWeight: '500',
  },
  essGrid: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  essGridCard: {
    flex: 1,
    backgroundColor: C.white,
    borderWidth: 2,
    borderColor: C.black,
    padding: 10,
  },
  essGridCardLabel: {
    fontSize: 8,
    fontWeight: '800',
    color: C.textMuted,
    marginTop: 4,
  },
  essGridCardVal: {
    fontSize: 12,
    fontWeight: '700',
    color: C.black,
    marginTop: 2,
  },
  essGridCardSub: {
    fontSize: 9,
    color: C.textMuted,
    marginTop: 1,
  },
  essAnnounceCard: {
    backgroundColor: C.white,
    borderWidth: 2,
    borderColor: C.black,
    padding: 12,
    marginBottom: 12,
  },
  essSectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: C.black,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  essAnnounceRow: {
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    paddingBottom: 8,
    marginBottom: 8,
  },
  essAnnounceTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: C.black,
  },
  essAnnounceBody: {
    fontSize: 11,
    color: C.textMuted,
    marginTop: 2,
  },
  essAnnounceDate: {
    fontSize: 9,
    color: C.textLight,
    marginTop: 4,
    fontFamily: 'monospace',
  },
  essAnnounceBadge: {
    borderWidth: 1.5,
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  essAnnounceBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  essAnnounceDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: C.primary,
  },
  essAckBtn: {
    marginTop: 8,
    alignSelf: 'flex-start',
    backgroundColor: C.danger,
    borderWidth: 2,
    borderColor: C.black,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  essAckBtnText: {
    color: C.white,
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },

  loaderWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: 16, paddingBottom: 40 },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FEF2F2',
    borderWidth: 2,
    borderColor: C.danger,
    padding: 10,
    marginBottom: 16,
  },
  errorText: { fontSize: 12, color: C.danger, fontWeight: '700', flex: 1 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    color: C.textMuted,
    marginBottom: 10,
    marginTop: 16,
    letterSpacing: 0.5,
  },

  // Admin grid
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 8 },
  statCard: {
    width: CARD_WIDTH,
    borderWidth: 2,
    borderColor: C.black,
    backgroundColor: C.white,
    padding: 14,
  },
  statIconWrap: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    borderWidth: 2,
    borderColor: C.black,
  },
  statValue: { fontSize: 28, fontWeight: '700', color: C.black },
  statLabel: { fontSize: 11, fontWeight: '700', color: C.black, marginTop: 2 },

  // Shared card
  card: {
    backgroundColor: C.white,
    borderWidth: 2,
    borderColor: C.black,
    marginBottom: 4,
  },
  quickRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 10,
    paddingHorizontal: 16,
  },
  quickBorder: { borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  quickIcon: {
    width: 28,
    height: 28,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickLabel: { flex: 1, fontSize: 13, fontWeight: '600', color: C.black },
  quickVal: { fontSize: 16, fontWeight: '700', color: C.black },

  // Employee: Profile banner
  profileBanner: {
    backgroundColor: C.white,
    borderWidth: 2,
    borderColor: C.black,
    marginBottom: 4,
  },
  profileBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  profileBannerAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: C.black,
  },
  profileBannerAvatarFb: {
    backgroundColor: C.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileBannerAvatarText: { color: C.white, fontSize: 22, fontWeight: '700' },
  profileBannerName: { fontSize: 16, fontWeight: '700', color: C.black },
  profileBannerRole: {
    fontSize: 12,
    color: C.textMuted,
    fontWeight: '500',
    marginTop: 2,
  },
  profileBannerEmpId: {
    fontSize: 11,
    color: C.primary,
    fontWeight: '700',
    marginTop: 2,
  },
  profileBannerStats: { flexDirection: 'row' },
  profileBannerStat: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    gap: 3,
  },
  profileBannerStatVal: { fontSize: 13, fontWeight: '700', color: C.black },
  profileBannerStatLabel: {
    fontSize: 12,
    color: C.textMuted,
    fontWeight: '500',
    textTransform: 'uppercase',
  },

  // Employee: Today card
  todayCard: {
    backgroundColor: C.white,
    borderWidth: 2,
    borderColor: C.black,
    padding: 16,
    marginBottom: 4,
  },
  todayRow: { gap: 14 },
  todayStatusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  todayStatusText: {
    color: C.white,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  todayTimes: { flexDirection: 'row', gap: 20 },
  todayTimeItem: { gap: 2, alignItems: 'center' },
  todayTimeLabel: {
    fontSize: 12,
    color: C.textMuted,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  todayTimeVal: { fontSize: 14, fontWeight: '700', color: C.black },
  todayAbsent: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  todayAbsentText: { fontSize: 13, color: C.textMuted, fontWeight: '500' },

  // Employee: Month stats
  monthStats: { flexDirection: 'row', gap: 8, marginBottom: 4 },
  monthStatCard: {
    flex: 1,
    backgroundColor: C.white,
    borderWidth: 2,
    borderColor: C.black,
    alignItems: 'center',
    paddingVertical: 14,
    gap: 6,
  },
  monthStatIcon: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: C.black,
  },
  monthStatVal: { fontSize: 22, fontWeight: '700' },
  monthStatLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: C.black,
    textTransform: 'uppercase',
  },

  // Employee: Payslip
  payslipCard: {
    backgroundColor: C.white,
    borderWidth: 2,
    borderColor: C.black,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 4,
  },
  payslipLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  payslipMonth: { fontSize: 15, fontWeight: '700', color: C.black },
  payslipStatus: {
    fontSize: 12,
    fontWeight: '700',
    color: C.success,
    marginTop: 2,
  },
  payslipNet: { fontSize: 22, fontWeight: '700', color: C.black },

  // Employee: Recent attendance
  attRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 11,
    gap: 10,
  },
  attBorder: { borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  attDate: { fontSize: 12, fontWeight: '600', color: C.black, width: 90 },
  attBadge: { paddingHorizontal: 8, paddingVertical: 3 },
  attBadgeText: { fontSize: 9, fontWeight: '700' },
  attTimes: { flex: 1, alignItems: 'flex-end' },
  attTime: { fontSize: 11, fontWeight: '600', color: C.black },

  // Employee: 3-day tabs
  tabBar: {
    flexDirection: 'row',
    borderWidth: 2,
    borderColor: C.black,
    backgroundColor: C.white,
    marginBottom: 0,
  },
  tabBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRightWidth: 1,
    borderRightColor: C.black,
  },
  tabBtnActive: { backgroundColor: C.primary },
  tabBtnText: { fontSize: 11, fontWeight: '700', color: C.black, textTransform: 'uppercase' },
  tabBtnTextActive: { color: C.white },
  tabBtnDate: { fontSize: 10, color: C.textMuted, fontWeight: '500', marginTop: 2 },
  tabBtnDateActive: { color: '#93C5FD' },

  // Employee: Attendance day card
  attDayCard: {
    backgroundColor: C.white,
    borderWidth: 2,
    borderTopWidth: 0,
    borderColor: C.black,
    padding: 20,
    marginBottom: 4,
    minHeight: 110,
  },
  attDayStatusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginBottom: 16,
  },
  attDayStatusText: { color: C.white, fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  attDayRow: { flexDirection: 'row', alignItems: 'center' },
  attDayItem: { flex: 1, alignItems: 'center', gap: 5 },
  attDayItemLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: C.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  attDayItemVal: { fontSize: 15, fontWeight: '700', color: C.black },
  attDayDivider: { width: 1, height: 48, backgroundColor: '#E5E7EB' },
  attDayEmpty: { alignItems: 'center', gap: 6, paddingVertical: 10 },
  attDayEmptyText: { fontSize: 13, fontWeight: '700', color: C.textMuted },
  attDayEmptyDate: { fontSize: 11, color: C.textLight, fontWeight: '500' },

  // Employee: Quick actions
  quickActions: { flexDirection: 'row', gap: 10, marginBottom: 4 },
  quickActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderWidth: 2,
    borderColor: C.black,
  },
  quickActionText: {
    color: C.white,
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
  },

  // Photo edit badge on avatar
  photoEditBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: C.primary,
    borderWidth: 2,
    borderColor: C.white,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Photo modal
  photoOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.88)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  photoOverlayClose: {
    position: 'absolute',
    top: 52,
    right: 20,
    padding: 8,
  },
  photoModalBox: {
    width: 260,
    height: 260,
    borderRadius: 130,
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: C.white,
    marginBottom: 36,
  },
  photoModalImg: { width: '100%', height: '100%' },
  photoModalPlaceholder: {
    flex: 1,
    backgroundColor: C.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoModalInitials: { fontSize: 72, fontWeight: '700', color: C.white },
  photoModalBtns: { flexDirection: 'row', gap: 16 },
  photoModalEditBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: C.primary,
    borderWidth: 2,
    borderColor: C.white,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  photoModalRemoveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: C.danger,
    borderWidth: 2,
    borderColor: C.white,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  photoModalBtnText: { color: C.white, fontSize: 13, fontWeight: '700' },
});

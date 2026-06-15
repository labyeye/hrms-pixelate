import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Modal,
  ScrollView,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  TrendingUp,
  Plus,
  X,
  Star,
  User,
  Target,
  CheckCircle2,
  Clock,
  ChevronLeft,
} from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { performanceAPI } from '../api/api';
import { PerformanceReview } from '../types/hrms';
import { C } from '../theme';

const RATING_COLORS: Record<number, string> = {
  1: C.danger,
  2: C.warning,
  3: '#F59E0B',
  4: C.primary,
  5: C.success,
};

const STATUS_CONFIG: Record<string, { color: string; bg: string }> = {
  draft: { color: C.textMuted, bg: '#F3F4F6' },
  submitted: { color: C.warning, bg: '#FFF7ED' },
  reviewed: { color: C.primary, bg: '#EFF6FF' },
  completed: { color: C.success, bg: '#F0FDF4' },
};

export default function PerformanceScreen() {
  const navigation = useNavigation<any>();
  const [reviews, setReviews] = useState<PerformanceReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    reviewPeriod: '',
    rating: '3',
    feedback: '',
    goals: '',
  });

  const load = useCallback(async () => {
    try {
      const res = await performanceAPI.getAll();
      setReviews(res.data || []);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);
  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const filtered = statusFilter
    ? reviews.filter(r => r.status === statusFilter)
    : reviews;

  const handleCreate = async () => {
    if (!form.reviewPeriod.trim()) {
      Alert.alert('Validation', 'Review period is required');
      return;
    }
    setSaving(true);
    try {
      await performanceAPI.create({ ...form, rating: parseFloat(form.rating) });
      setShowForm(false);
      setForm({ reviewPeriod: '', rating: '3', feedback: '', goals: '' });
      await load();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setSaving(false);
    }
  };

  const avgRating =
    reviews.length > 0
      ? (
          reviews.reduce((s, r) => s + (r.rating || 0), 0) / reviews.length
        ).toFixed(1)
      : '—';

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
          <TrendingUp size={20} color={C.primary} />
          <Text style={styles.headerTitle}>Performance</Text>
        </View>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => setShowForm(true)}
        >
          <Plus size={14} color={C.white} />
          <Text style={styles.addBtnText}>Add Review</Text>
        </TouchableOpacity>
      </View>

      {/* Summary */}
      <View style={styles.summaryRow}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryVal}>{reviews.length}</Text>
          <Text style={styles.summaryLabel}>Total Reviews</Text>
        </View>
        <View style={styles.summaryCard}>
          <View style={styles.ratingWrap}>
            <Star size={14} color="#F59E0B" />
            <Text style={[styles.summaryVal, { color: '#F59E0B' }]}>
              {avgRating}
            </Text>
          </View>
          <Text style={styles.summaryLabel}>Avg Rating</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={[styles.summaryVal, { color: C.warning }]}>
            {reviews.filter(r => r.status === 'in_review').length}
          </Text>
          <Text style={styles.summaryLabel}>Pending</Text>
        </View>
      </View>

      {/* Status filters */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterBar}
        contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}
      >
        {[
          { key: '', label: 'All' },
          { key: 'draft', label: 'Draft' },
          { key: 'submitted', label: 'Submitted' },
          { key: 'reviewed', label: 'Reviewed' },
          { key: 'completed', label: 'Completed' },
        ].map(f => (
          <TouchableOpacity
            key={f.key}
            style={[styles.chip, statusFilter === f.key && styles.chipActive]}
            onPress={() => setStatusFilter(f.key)}
          >
            <Text
              style={[
                styles.chipText,
                statusFilter === f.key && { color: C.white },
              ]}
            >
              {f.label.toUpperCase()}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? (
        <View style={styles.loader}>
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
            <View style={styles.empty}>
              <TrendingUp size={40} color="#D1D5DB" />
              <Text style={styles.emptyText}>No performance reviews</Text>
            </View>
          }
          renderItem={({ item }) => {
            const cfg = STATUS_CONFIG[item.status] || {
              color: C.textMuted,
              bg: '#F3F4F6',
            };
            const emp = item.employee as any;
            const ratingColor =
              RATING_COLORS[Math.round(item.rating || 3)] || C.textMuted;
            return (
              <View style={styles.card}>
                <View style={styles.cardTop}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>
                      {emp?.firstName?.[0] || 'E'}
                    </Text>
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.empName}>
                      {emp ? `${emp.firstName} ${emp.lastName}` : 'Employee'}
                    </Text>
                    <Text style={styles.reviewPeriod}>
                      {(item as any).reviewPeriod || item.reviewDate || '—'}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 6 }}>
                    <View
                      style={[
                        styles.statusBadge,
                        { backgroundColor: cfg.color, borderColor: C.black },
                      ]}
                    >
                      <Text
                        style={[styles.statusBadgeText, { color: C.white }]}
                      >
                        {item.status?.toUpperCase()}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Rating stars */}
                <View style={styles.ratingRow}>
                  {[1, 2, 3, 4, 5].map(n => (
                    <Star
                      key={n}
                      size={18}
                      color={
                        n <= Math.round(item.rating || 0)
                          ? '#F59E0B'
                          : '#E5E7EB'
                      }
                      fill={
                        n <= Math.round(item.rating || 0)
                          ? '#F59E0B'
                          : 'transparent'
                      }
                    />
                  ))}
                  <Text style={[styles.ratingNum, { color: ratingColor }]}>
                    {item.rating?.toFixed(1) || '—'}/5
                  </Text>
                </View>

                {(item.comments || (item as any).feedback) && (
                  <Text style={styles.feedbackText} numberOfLines={2}>
                    {item.comments || (item as any).feedback}
                  </Text>
                )}

                {(item as any).goals && (
                  <View style={styles.goalsRow}>
                    <Target size={12} color={C.primary} />
                    <Text style={styles.goalsText} numberOfLines={1}>
                      {(item as any).goals}
                    </Text>
                  </View>
                )}
              </View>
            );
          }}
        />
      )}

      {/* Add Review Modal */}
      <Modal
        visible={showForm}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <SafeAreaView style={styles.safe} edges={['top']}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Add Review</Text>
            <TouchableOpacity onPress={() => setShowForm(false)}>
              <X size={22} color={C.black} />
            </TouchableOpacity>
          </View>
          <ScrollView
            contentContainerStyle={{ padding: 20, gap: 16 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View>
              <Text style={styles.fieldLabel}>Review Period *</Text>
              <TextInput
                style={styles.fieldInput}
                value={form.reviewPeriod}
                onChangeText={v => setForm(p => ({ ...p, reviewPeriod: v }))}
                placeholder="Q4 2024 / Jan-Mar 2025"
                placeholderTextColor={C.textLight}
              />
            </View>
            <View>
              <Text style={styles.fieldLabel}>Rating (1–5)</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
                {['1', '2', '3', '4', '5'].map(n => (
                  <TouchableOpacity
                    key={n}
                    style={[
                      styles.ratingBtn,
                      form.rating === n && {
                        backgroundColor: RATING_COLORS[parseInt(n)],
                        borderColor: RATING_COLORS[parseInt(n)],
                      },
                    ]}
                    onPress={() => setForm(p => ({ ...p, rating: n }))}
                  >
                    <Star
                      size={14}
                      color={form.rating === n ? C.white : '#F59E0B'}
                    />
                    <Text
                      style={[
                        styles.ratingBtnText,
                        form.rating === n && { color: C.white },
                      ]}
                    >
                      {n}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            <View>
              <Text style={styles.fieldLabel}>Feedback</Text>
              <TextInput
                style={[styles.fieldInput, { minHeight: 90 }]}
                value={form.feedback}
                onChangeText={v => setForm(p => ({ ...p, feedback: v }))}
                placeholder="Performance feedback…"
                placeholderTextColor={C.textLight}
                multiline
              />
            </View>
            <View>
              <Text style={styles.fieldLabel}>Goals</Text>
              <TextInput
                style={[styles.fieldInput, { minHeight: 70 }]}
                value={form.goals}
                onChangeText={v => setForm(p => ({ ...p, goals: v }))}
                placeholder="Goals for next period…"
                placeholderTextColor={C.textLight}
                multiline
              />
            </View>
            <TouchableOpacity
              style={styles.submitBtn}
              onPress={handleCreate}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color={C.white} />
              ) : (
                <Text style={styles.submitBtnText}>Save Review</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F8F9FA' },
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
  headerTitle: { fontSize: 20, fontWeight: '700', color: C.black },
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
  summaryRow: {
    flexDirection: 'row',
    backgroundColor: C.white,
    borderBottomWidth: 2,
    borderBottomColor: C.black,
    padding: 12,
    gap: 10,
  },
  summaryCard: {
    flex: 1,
    borderWidth: 2,
    borderColor: C.black,
    padding: 10,
    alignItems: 'center',
  },
  summaryVal: { fontSize: 22, fontWeight: '700', color: C.black },
  summaryLabel: {
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
    color: C.textMuted,
    marginTop: 2,
  },
  ratingWrap: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  filterBar: {
    maxHeight: 48,
    backgroundColor: C.white,
    borderBottomWidth: 2,
    borderBottomColor: C.black,
    paddingVertical: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderWidth: 2,
    borderColor: C.black,
    backgroundColor: C.white,
  },
  chipActive: { backgroundColor: C.primary },
  chipText: { fontSize: 10, fontWeight: '700', color: C.black },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyText: { fontSize: 14, fontWeight: '700', color: C.textMuted },
  card: {
    backgroundColor: C.white,
    borderWidth: 2,
    borderColor: C.black,
    padding: 14,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  avatar: {
    width: 40,
    height: 40,
    backgroundColor: C.primary,
    borderWidth: 2,
    borderColor: C.black,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: C.white, fontWeight: '700', fontSize: 16 },
  empName: { fontSize: 15, fontWeight: '700', color: C.black },
  reviewPeriod: {
    fontSize: 11,
    color: C.textMuted,
    fontWeight: '500',
    marginTop: 1,
  },
  statusBadge: { borderWidth: 2, paddingHorizontal: 8, paddingVertical: 3 },
  statusBadgeText: { fontSize: 9, fontWeight: '700' },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 10,
  },
  ratingNum: { fontSize: 14, fontWeight: '700', marginLeft: 6 },
  feedbackText: { fontSize: 12, color: C.textMuted, lineHeight: 18 },
  goalsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  goalsText: { fontSize: 12, color: C.primary, fontWeight: '600', flex: 1 },
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
  fieldLabel: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    color: C.black,
    marginBottom: 5,
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
  ratingBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderWidth: 2,
    borderColor: '#F59E0B',
    paddingVertical: 8,
  },
  ratingBtnText: { fontSize: 13, fontWeight: '700', color: '#F59E0B' },
  submitBtn: {
    backgroundColor: C.primary,
    borderWidth: 2,
    borderColor: C.black,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  submitBtnText: {
    color: C.white,
    fontWeight: '700',
    fontSize: 14,
    textTransform: 'uppercase',
  },
});

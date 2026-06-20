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
  Briefcase,
  Plus,
  X,
  User,
  CheckCircle2,
  Clock,
  XCircle,
  Search,
  ChevronRight,
  Star,
  ChevronLeft,
} from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { recruitmentAPI } from '../api/api';
import { Job, Candidate } from '../types/hrms';
import { C } from '../theme';

const JOB_STATUS_CONFIG: Record<string, { color: string; bg: string }> = {
  open: { color: C.success, bg: '#F0FDF4' },
  closed: { color: C.danger, bg: '#FEF2F2' },
  draft: { color: C.textMuted, bg: '#F3F4F6' },
  paused: { color: C.warning, bg: '#FFF7ED' },
};

const CAND_STATUS_CONFIG: Record<string, { color: string }> = {
  applied: { color: C.primary },
  screening: { color: C.warning },
  interview: { color: C.secondary },
  offer: { color: C.primary },
  hired: { color: C.success },
  rejected: { color: C.danger },
};

export default function RecruitmentScreen() {
  const navigation = useNavigation<any>();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<'jobs' | 'candidates'>('jobs');
  const [showJobForm, setShowJobForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [jobForm, setJobForm] = useState({
    title: '',
    department: '',
    location: '',
    type: 'full_time',
    description: '',
    requirements: '',
    salary: '',
  });

  const load = useCallback(async () => {
    try {
      const jobsRes = await recruitmentAPI.getAll();
      const jobList: Job[] = jobsRes.data || [];
      setJobs(jobList);
      // Extract all candidates embedded in jobs
      const allCands: Candidate[] = jobList.flatMap(j => j.candidates || []);
      setCandidates(allCands);
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

  const filteredJobs = jobs.filter(
    j =>
      !search ||
      j.title?.toLowerCase().includes(search.toLowerCase()) ||
      j.department?.toString().toLowerCase().includes(search.toLowerCase()),
  );
  const filteredCands = candidates.filter(
    c =>
      !search ||
      c.name?.toLowerCase().includes(search.toLowerCase()) ||
      c.email?.toLowerCase().includes(search.toLowerCase()),
  );

  const handleCreateJob = async () => {
    if (!jobForm.title.trim()) {
      Alert.alert('Validation', 'Job title is required');
      return;
    }
    setSaving(true);
    try {
      await recruitmentAPI.create({
        ...jobForm,
        salary: jobForm.salary ? parseFloat(jobForm.salary) : undefined,
      });
      setShowJobForm(false);
      setJobForm({
        title: '',
        department: '',
        location: '',
        type: 'full_time',
        description: '',
        requirements: '',
        salary: '',
      });
      await load();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setSaving(false);
    }
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
          <Briefcase size={20} color={C.primary} />
          <Text style={styles.headerTitle}>Recruitment</Text>
        </View>
        {tab === 'jobs' && (
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => setShowJobForm(true)}
          >
            <Plus size={14} color={C.white} />
            <Text style={styles.addBtnText}>New Job</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Summary */}
      <View style={styles.summaryRow}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryVal}>
            {jobs.filter(j => j.status === 'open').length}
          </Text>
          <Text style={styles.summaryLabel}>Open Jobs</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={[styles.summaryVal, { color: C.warning }]}>
            {candidates.filter(c => c.stage === 'interview').length}
          </Text>
          <Text style={styles.summaryLabel}>Interviews</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={[styles.summaryVal, { color: C.success }]}>
            {candidates.filter(c => c.stage === 'hired').length}
          </Text>
          <Text style={styles.summaryLabel}>Hired</Text>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabRow}>
        {(['jobs', 'candidates'] as const).map(t => (
          <TouchableOpacity
            key={t}
            style={[styles.tab, tab === t && styles.tabActive]}
            onPress={() => setTab(t)}
          >
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
              {t.toUpperCase()}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Search */}
      <View style={styles.searchWrap}>
        <Search size={15} color={C.textMuted} />
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder={`Search ${tab}…`}
          placeholderTextColor={C.textLight}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <X size={14} color={C.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={C.primary} />
        </View>
      ) : tab === 'jobs' ? (
        <FlatList
          data={filteredJobs}
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
              <Briefcase size={40} color="#D1D5DB" />
              <Text style={styles.emptyText}>No job postings</Text>
            </View>
          }
          renderItem={({ item }) => {
            const j = item as any;
            const cfg = JOB_STATUS_CONFIG[j.status] || {
              color: C.textMuted,
              bg: '#F3F4F6',
            };
            const appCount = (j.candidates || []).length;
            return (
              <View style={styles.card}>
                <View style={styles.cardTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.jobTitle}>{j.title}</Text>
                    <Text style={styles.jobMeta}>
                      {j.location || 'Remote'} · {j.type?.replace('_', ' ')}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.statusBadge,
                      { backgroundColor: cfg.color, borderColor: C.black },
                    ]}
                  >
                    <Text style={[styles.statusBadgeText, { color: C.white }]}>
                      {j.status?.toUpperCase()}
                    </Text>
                  </View>
                </View>
                {j.description && (
                  <Text style={styles.jobDesc} numberOfLines={2}>
                    {j.description}
                  </Text>
                )}
                <View style={styles.cardBottom}>
                  <View style={styles.appsPill}>
                    <User size={11} color={C.primary} />
                    <Text style={styles.appsPillText}>
                      {appCount} applicant{appCount !== 1 ? 's' : ''}
                    </Text>
                  </View>
                  {j.salary && (
                    <Text style={styles.salaryText}>
                      ₹{j.salary.toLocaleString()}
                    </Text>
                  )}
                </View>
              </View>
            );
          }}
        />
      ) : (
        <FlatList
          data={filteredCands}
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
              <User size={40} color="#D1D5DB" />
              <Text style={styles.emptyText}>No candidates</Text>
            </View>
          }
          renderItem={({ item }) => {
            const c = item as any;
            const stage: string = c.stage || c.status || 'applied';
            const cfg = CAND_STATUS_CONFIG[stage] || { color: C.textMuted };
            return (
              <View style={styles.card}>
                <View style={styles.cardTop}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>
                      {(c.name || c.firstName || 'C')[0]}
                    </Text>
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.candName}>
                      {c.name ||
                        `${c.firstName || ''} ${c.lastName || ''}`.trim()}
                    </Text>
                    <Text style={styles.candEmail}>{c.email}</Text>
                    {c.position && (
                      <Text style={styles.candPos}>{c.position}</Text>
                    )}
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 4 }}>
                    <View
                      style={[
                        styles.statusBadge,
                        { backgroundColor: cfg.color, borderColor: C.black },
                      ]}
                    >
                      <Text
                        style={[styles.statusBadgeText, { color: C.white }]}
                      >
                        {stage.toUpperCase()}
                      </Text>
                    </View>
                    {c.rating && (
                      <View style={styles.ratingRow}>
                        <Star size={10} color="#F59E0B" />
                        <Text style={styles.ratingText}>{c.rating}</Text>
                      </View>
                    )}
                  </View>
                </View>
              </View>
            );
          }}
        />
      )}

      {/* New Job Modal */}
      <Modal
        visible={showJobForm}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <SafeAreaView style={styles.safe} edges={['top']}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Post New Job</Text>
            <TouchableOpacity onPress={() => setShowJobForm(false)}>
              <X size={22} color={C.black} />
            </TouchableOpacity>
          </View>
          <ScrollView
            contentContainerStyle={{ padding: 20, gap: 16 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {[
              {
                label: 'Job Title *',
                key: 'title',
                placeholder: 'Senior Engineer',
              },
              {
                label: 'Department',
                key: 'department',
                placeholder: 'Engineering',
              },
              {
                label: 'Location',
                key: 'location',
                placeholder: 'Remote / Mumbai',
              },
              {
                label: 'Salary (₹)',
                key: 'salary',
                placeholder: '800000',
                numeric: true,
              },
            ].map(f => (
              <View key={f.key}>
                <Text style={styles.fieldLabel}>{f.label}</Text>
                <TextInput
                  style={styles.fieldInput}
                  value={(jobForm as any)[f.key]}
                  onChangeText={v => setJobForm(p => ({ ...p, [f.key]: v }))}
                  placeholder={f.placeholder}
                  placeholderTextColor={C.textLight}
                  keyboardType={f.numeric ? 'numeric' : 'default'}
                />
              </View>
            ))}
            <View>
              <Text style={styles.fieldLabel}>Type</Text>
              <View
                style={{
                  flexDirection: 'row',
                  flexWrap: 'wrap',
                  gap: 8,
                  marginTop: 6,
                }}
              >
                {['full_time', 'part_time', 'contract', 'intern'].map(t => (
                  <TouchableOpacity
                    key={t}
                    style={[
                      styles.selChip,
                      jobForm.type === t && styles.selChipActive,
                    ]}
                    onPress={() => setJobForm(p => ({ ...p, type: t }))}
                  >
                    <Text
                      style={[
                        styles.selChipText,
                        jobForm.type === t && { color: C.white },
                      ]}
                    >
                      {t.replace('_', ' ').toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            <View>
              <Text style={styles.fieldLabel}>Description</Text>
              <TextInput
                style={[styles.fieldInput, { minHeight: 80 }]}
                value={jobForm.description}
                onChangeText={v => setJobForm(p => ({ ...p, description: v }))}
                placeholder="Job description…"
                placeholderTextColor={C.textLight}
                multiline
              />
            </View>
            <TouchableOpacity
              style={styles.submitBtn}
              onPress={handleCreateJob}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color={C.white} />
              ) : (
                <Text style={styles.submitBtnText}>Post Job</Text>
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
  tabRow: {
    flexDirection: 'row',
    backgroundColor: C.white,
    borderBottomWidth: 2,
    borderBottomColor: C.black,
  },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  tabActive: { borderBottomWidth: 3, borderBottomColor: C.primary },
  tabText: { fontSize: 12, fontWeight: '700', color: C.textMuted },
  tabTextActive: { color: C.primary },
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
    backgroundColor: C.white,
    borderWidth: 2,
    borderColor: C.black,
    padding: 14,
  },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start' },
  jobTitle: { fontSize: 15, fontWeight: '700', color: C.black },
  jobMeta: {
    fontSize: 11,
    color: C.textMuted,
    fontWeight: '500',
    marginTop: 2,
  },
  jobDesc: { fontSize: 12, color: C.textMuted, marginTop: 8, lineHeight: 18 },
  cardBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  appsPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: C.primary,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  appsPillText: { fontSize: 11, fontWeight: '700', color: C.primary },
  salaryText: { fontSize: 13, fontWeight: '700', color: C.success },
  statusBadge: { borderWidth: 2, paddingHorizontal: 8, paddingVertical: 3 },
  statusBadgeText: { fontSize: 9, fontWeight: '700' },
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
  candName: { fontSize: 15, fontWeight: '700', color: C.black },
  candEmail: {
    fontSize: 11,
    color: C.textMuted,
    fontWeight: '500',
    marginTop: 1,
  },
  candPos: { fontSize: 12, color: C.primary, fontWeight: '700', marginTop: 2 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  ratingText: { fontSize: 11, fontWeight: '700', color: '#F59E0B' },
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
    fontSize: 12,
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
  selChip: {
    borderWidth: 2,
    borderColor: C.black,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  selChipActive: { backgroundColor: C.primary },
  selChipText: { fontSize: 11, fontWeight: '700', color: C.black },
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

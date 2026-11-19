import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, ShieldCheck } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { C } from '../theme';

// Same read-only permission matrix as the web Manage → User Roles page.
const COLUMNS = [
  ['dashboard', 'Dashboard'],
  ['employee', 'Employee'],
  ['salary', 'Salary'],
  ['reports', 'Reports'],
  ['manage', 'Manage'],
  ['settings', 'Settings'],
] as const;

const ROLES: Record<string, string>[] = [
  {
    role: 'Super Admin',
    dashboard: 'Full',
    employee: 'Full',
    salary: 'Full',
    reports: 'Full',
    manage: 'Full',
    settings: 'Full',
  },
  {
    role: 'HR Manager',
    dashboard: 'Full',
    employee: 'Full',
    salary: 'Full',
    reports: 'Read',
    manage: 'Partial',
    settings: 'Partial',
  },
  {
    role: 'HR Executive',
    dashboard: 'Read',
    employee: 'Full',
    salary: 'Read',
    reports: 'Read',
    manage: 'None',
    settings: 'None',
  },
  {
    role: 'Dept Head',
    dashboard: 'Read',
    employee: 'Read',
    salary: 'None',
    reports: 'None',
    manage: 'None',
    settings: 'None',
  },
  {
    role: 'Employee',
    dashboard: 'Self',
    employee: 'Self',
    salary: 'Self',
    reports: 'None',
    manage: 'None',
    settings: 'None',
  },
];

const LEVEL: Record<string, { fg: string; bg: string }> = {
  Full: { fg: '#00A36C', bg: '#E7F9F1' },
  Partial: { fg: '#FA731C', bg: '#FFF1E6' },
  Read: { fg: C.primary, bg: '#E8F0FB' },
  Self: { fg: '#A855F7', bg: '#F5EBFF' },
  None: { fg: '#6B7280', bg: '#F3F4F6' },
};

export default function RolesScreen() {
  const navigation = useNavigation<any>();
  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={{ padding: 4, marginRight: 4 }}
        >
          <ChevronLeft size={24} color={C.black} />
        </TouchableOpacity>
        <ShieldCheck size={20} color={C.primary} />
        <Text style={s.title}>User Roles & Permissions</Text>
      </View>
      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 60 }}
      >
        {ROLES.map(r => (
          <View key={r.role} style={s.card}>
            <Text style={s.role}>{r.role}</Text>
            <View style={s.grid}>
              {COLUMNS.map(([k, label]) => {
                const lv = LEVEL[r[k]] || LEVEL.None;
                return (
                  <View key={k} style={s.cell}>
                    <Text style={s.cellLabel}>{label}</Text>
                    <Text
                      style={[
                        s.pill,
                        {
                          color: lv.fg,
                          backgroundColor: lv.bg,
                          borderColor: lv.fg,
                        },
                      ]}
                    >
                      {r[k]}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        ))}
      </ScrollView>
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
    paddingVertical: 16,
    backgroundColor: C.white,
    borderBottomWidth: 2,
    borderBottomColor: C.black,
  },
  title: { fontSize: 18, fontWeight: '400', color: C.black },
  card: {
    backgroundColor: C.white,
    borderWidth: 2,
    borderColor: C.black,
    padding: 14,
    gap: 10,
  },
  role: { fontSize: 15, fontWeight: '600', color: C.black },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  cell: { width: '30%', gap: 4 },
  cellLabel: { fontSize: 11, color: C.textMuted },
  pill: {
    alignSelf: 'flex-start',
    fontSize: 11,
    fontWeight: '600',
    borderWidth: 2,
    paddingHorizontal: 8,
    paddingVertical: 2,
    overflow: 'hidden',
  },
});

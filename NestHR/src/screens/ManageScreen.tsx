import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Clock,
  IndianRupee,
  Briefcase,
  FileText,
  ChevronRight,
  Settings2,
  ChevronLeft,
} from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { C } from '../theme';

const TILES = [
  {
    key: 'Shifts',
    icon: Clock,
    label: 'Shift Timings',
    desc: 'Create and manage work shift schedules',
  },
  {
    key: 'SalaryHeads',
    icon: IndianRupee,
    label: 'Salary Components',
    desc: 'Configure earnings, deductions & variables',
  },
  {
    key: 'Designations',
    icon: Briefcase,
    label: 'Designations',
    desc: 'Manage job titles and role hierarchy',
  },
  {
    key: 'OfferLetters',
    icon: FileText,
    label: 'Offer Letters',
    desc: 'Generate and manage offer letter templates',
  },
];

export default function ManageScreen() {
  const navigation = useNavigation<any>();

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={{ padding: 4, marginRight: 4 }}
        >
          <ChevronLeft size={22} color={C.black} />
        </TouchableOpacity>
        <Settings2 size={20} color={C.primary} />
        <Text style={s.title}>Manage</Text>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 12 }}
        showsVerticalScrollIndicator={false}
      >
        <Text style={s.sectionLabel}>Configuration</Text>
        {TILES.map(({ key, icon: Icon, label, desc }) => (
          <TouchableOpacity
            key={key}
            style={s.tile}
            onPress={() => navigation.navigate(key)}
          >
            <View style={s.tileIcon}>
              <Icon size={22} color={C.primary} />
            </View>
            <View style={{ flex: 1, marginLeft: 14 }}>
              <Text style={s.tileLabel}>{label}</Text>
              <Text style={s.tileDesc}>{desc}</Text>
            </View>
            <ChevronRight size={18} color={C.textMuted} />
          </TouchableOpacity>
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
    paddingVertical: 14,
    backgroundColor: C.white,
    borderBottomWidth: 2,
    borderBottomColor: C.black,
  },
  title: { fontSize: 20, fontWeight: '700', color: C.black },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    color: C.textMuted,
    letterSpacing: 1,
    marginBottom: 4,
  },
  tile: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.white,
    borderWidth: 2,
    borderColor: C.black,
    padding: 16,
  },
  tileIcon: {
    width: 48,
    height: 48,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: C.black,
  },
  tileLabel: { fontSize: 15, fontWeight: '700', color: C.black },
  tileDesc: {
    fontSize: 11,
    color: C.textMuted,
    fontWeight: '500',
    marginTop: 2,
  },
});

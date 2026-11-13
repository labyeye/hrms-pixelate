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
  Settings2,
  ChevronLeft,
} from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import SlideInCard from '../components/motion/SlideInCard';
import { C, useResponsive } from '../theme';

const TILES = [
  {
    key: 'Shifts',
    icon: Clock,
    color: C.primary,
    label: 'Shift Timings',
    desc: 'Work shift schedules',
  },
  {
    key: 'SalaryHeads',
    icon: IndianRupee,
    color: '#22c55e',
    label: 'Salary Components',
    desc: 'Earnings & deductions',
  },
  {
    key: 'Designations',
    icon: Briefcase,
    color: '#FF751F',
    label: 'Designations',
    desc: 'Job titles & hierarchy',
  },
  {
    key: 'OfferLetters',
    icon: FileText,
    color: '#7C3AED',
    label: 'Offer Letters',
    desc: 'Letter templates',
  },
];

export default function ManageScreen() {
  const navigation = useNavigation<any>();
  const { isTablet, maxContentWidth } = useResponsive();

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View
        style={[
          s.header,
          isTablet && {
            maxWidth: maxContentWidth,
            width: '100%',
            alignSelf: 'center',
          },
        ]}
      >
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={{ padding: 4, marginRight: 2 }}
          hitSlop={8}
        >
          <ChevronLeft size={22} color={C.black} />
        </TouchableOpacity>
        <Settings2 size={20} color={C.primary} />
        <Text style={s.title}>Manage</Text>
      </View>

      <ScrollView
        contentContainerStyle={[
          { padding: 16, gap: 12 },
          isTablet && {
            maxWidth: maxContentWidth,
            width: '100%',
            alignSelf: 'center',
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={s.sectionLabel}>Configuration</Text>
        <View style={s.grid}>
          {TILES.map(({ key, icon: Icon, color, label, desc }, idx) => (
            <SlideInCard key={key} index={idx} style={s.tileWrap}>
              <TouchableOpacity
                style={s.tile}
                onPress={() => navigation.navigate(key)}
                activeOpacity={0.8}
              >
                <View
                  style={[
                    s.tileIcon,
                    {
                      backgroundColor: color + '1A',
                      borderColor: color,
                    },
                  ]}
                >
                  <Icon size={22} color={color} />
                </View>
                <Text style={s.tileLabel} numberOfLines={1}>
                  {label}
                </Text>
                <Text style={s.tileDesc} numberOfLines={1}>
                  {desc}
                </Text>
              </TouchableOpacity>
            </SlideInCard>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
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
  title: { fontSize: 20, fontWeight: '400', color: C.black },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '400',
    color: C.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  tileWrap: {
    width: '48.3%',
  },
  tile: {
    backgroundColor: C.white,
    borderWidth: 2,
    borderRadius: 8,
    borderRightWidth: 4,
    borderBottomWidth: 4,
    borderRightColor: '#0A0A0A',
    borderBottomColor: '#0A0A0A',
    borderColor: C.black,
    paddingVertical: 16,
    paddingHorizontal: 10,
    alignItems: 'center',
    gap: 6,
  },
  tileIcon: {
    width: 44,
    height: 44,
    borderWidth: 2,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  tileLabel: {
    fontSize: 13,
    fontWeight: '400',
    color: C.black,
    textAlign: 'center',
  },
  tileDesc: {
    fontSize: 11,
    color: C.textMuted,
    fontWeight: '400',
    textAlign: 'center',
  },
});

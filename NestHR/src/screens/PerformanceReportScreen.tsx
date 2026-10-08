import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { dashboardAPI } from '../api/api';
import PerformanceList from '../components/common/PerformanceList';
import { C, FONT } from '../theme';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export default function PerformanceReportScreen() {
  const navigation = useNavigation<any>();
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [data, setData] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const isCurrent = month === now.getMonth() + 1 && year === now.getFullYear();

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res: any = await dashboardAPI.getMonthlyPerformance(month, year);
      setData((res.data || res).performance || []);
    } catch (e: any) {
      setError(e.message || 'Failed to load report');
      setData(null);
    }
    setLoading(false);
  }, [month, year]);

  useEffect(() => {
    load();
  }, [load]);

  const shift = (d: number) => {
    let m = month + d;
    let y = year;
    if (m < 1) { m = 12; y -= 1; }
    if (m > 12) { m = 1; y += 1; }
    setMonth(m);
    setYear(y);
  };

  const avg =
    data && data.length
      ? Math.round(data.reduce((s, p) => s + p.percent, 0) / data.length)
      : null;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 4 }}>
          <ChevronLeft size={22} color={C.black} />
        </TouchableOpacity>
        <Text style={styles.title}>Performance Report</Text>
      </View>

      <View style={styles.picker}>
        <TouchableOpacity onPress={() => shift(-1)} style={styles.arrow}>
          <ChevronLeft size={20} color={C.black} />
        </TouchableOpacity>
        <View style={{ alignItems: 'center' }}>
          <Text style={styles.monthText}>
            {MONTHS[month - 1]} {year}
          </Text>
          {isCurrent && <Text style={styles.sub}>1–{now.getDate()} (till now)</Text>}
        </View>
        <TouchableOpacity
          onPress={() => shift(1)}
          disabled={isCurrent}
          style={[styles.arrow, isCurrent && { opacity: 0.3 }]}
        >
          <ChevronRight size={20} color={C.black} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16 }}>
        {loading ? (
          <ActivityIndicator color={C.primary} style={{ marginTop: 40 }} />
        ) : error ? (
          <Text style={styles.empty}>{error}</Text>
        ) : data && data.length ? (
          <>
            <Text style={styles.sub}>
              {data.length} staff · Average {avg}%
            </Text>
            <View style={styles.card}>
              <PerformanceList data={data} />
            </View>
          </>
        ) : (
          <Text style={styles.empty}>No attendance data for this month</Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.white },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 2,
    borderBottomColor: C.black,
  },
  title: { fontFamily: FONT.bold, fontSize: 18, color: C.black },
  picker: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.12)',
  },
  arrow: { padding: 6, borderWidth: 1, borderColor: C.black, borderRadius: 8 },
  monthText: { fontFamily: FONT.bold, fontSize: 16, color: C.black },
  sub: { fontFamily: FONT.medium, fontSize: 12, color: C.black, marginBottom: 8 },
  card: { borderWidth: 2, borderRadius: 8, borderRightWidth: 5, borderBottomWidth: 5, borderRightColor: '#0A0A0A', borderBottomColor: '#0A0A0A', borderColor: C.black, overflow: 'hidden', backgroundColor: C.white },
  empty: { fontFamily: FONT.medium, fontSize: 13, color: C.black, padding: 14 },
});

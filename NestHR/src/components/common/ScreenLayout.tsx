import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { C } from '../../theme';

interface Props {
  children: React.ReactNode;
  title: string;
  right?: React.ReactNode;
  loading?: boolean;
}

export default function ScreenLayout({
  children,
  title,
  right,
  loading,
}: Props) {
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        {right && <View>{right}</View>}
      </View>
      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={C.primary} />
        </View>
      ) : (
        <View style={styles.body}>{children}</View>
      )}
    </SafeAreaView>
  );
}

export function HeaderBtn({
  label,
  onPress,
  color = C.primary,
  icon,
}: {
  label: string;
  onPress: () => void;
  color?: string;
  icon?: React.ReactNode;
}) {
  return (
    <TouchableOpacity
      style={[styles.headerBtn, { borderColor: color, backgroundColor: color }]}
      onPress={onPress}
    >
      {icon}
      <Text style={styles.headerBtnText}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#fff',
    borderBottomWidth: 2,
    borderBottomColor: '#000',
  },
  title: { fontSize: 20, fontWeight: '700', color: '#000' },
  body: { flex: 1 },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  headerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 2,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  headerBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
});

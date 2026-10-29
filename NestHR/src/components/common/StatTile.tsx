import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { C } from '../../theme';

interface Props {
  label: string;
  value: string | number;
  color?: string;
  icon?: React.ComponentType<{ size?: number; color?: string }>;
  sub?: string;
  /** Percentage of the row the tile should take, default two tiles per row. */
  width?: `${number}%`;
}

/** Summary card in the same look as the Dashboard stat cards (tinted icon chip + big number + caps label). */
export default function StatTile({
  label,
  value,
  color = C.primary,
  icon: Icon,
  sub,
  width = '48.5%',
}: Props) {
  return (
    <View style={[styles.card, { width }]}>
      {Icon ? (
        <View
          style={[
            styles.chip,
            { backgroundColor: color + '1A', borderColor: color },
          ]}
        >
          <Icon size={18} color={color} />
        </View>
      ) : null}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.label} numberOfLines={1}>
          {label}
        </Text>
        <Text style={styles.value} numberOfLines={1}>
          {value}
        </Text>
        {sub ? (
          <Text style={styles.sub} numberOfLines={1}>
            {sub}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

export const tileGrid = {
  flexDirection: 'row',
  flexWrap: 'wrap',
  gap: 10,
} as const;

const styles = StyleSheet.create({
  card: {
    borderWidth: 2,
    borderRadius: 8,
    borderRightWidth: 5,
    borderBottomWidth: 5,
    borderRightColor: '#0A0A0A',
    borderBottomColor: '#0A0A0A',
    borderColor: C.black,
    backgroundColor: C.white,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  chip: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderRightWidth: 4,
    borderBottomWidth: 4,
    borderRightColor: '#0A0A0A',
    borderBottomColor: '#0A0A0A',
    borderRadius: 8,
  },
  value: { fontSize: 22, fontWeight: '400', color: C.black },
  label: {
    fontSize: 10,
    fontWeight: '400',
    color: C.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sub: { fontSize: 10, color: C.textMuted },
});

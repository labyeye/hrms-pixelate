import React, { useState } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { C, FONT } from '../../theme';

// Ranked staff list: photo, name, plain bordered progress bar, percent.
// Shows the top `initialCount` rows with a View more / Show less toggle.
export default function PerformanceList({
  data,
  initialCount = 5,
}: {
  data: any[];
  initialCount?: number;
}) {
  const [showAll, setShowAll] = useState(false);
  const rows = showAll ? data : data.slice(0, initialCount);

  return (
    <View>
      {rows.map((p, i) => (
        <View
          key={p.employee._id}
          style={[styles.row, i > 0 && styles.rowBorder]}
        >
          <Text style={styles.rank}>{i + 1}</Text>
          {p.employee.avatar ? (
            <Image source={{ uri: p.employee.avatar }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}>
              <Text style={styles.avatarText}>
                {(p.employee.firstName || '?')[0].toUpperCase()}
              </Text>
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={styles.name} numberOfLines={1}>
              {p.employee.firstName} {p.employee.lastName}
            </Text>
            <View style={styles.track}>
              <View
                style={[
                  styles.fill,
                  {
                    width: `${p.percent}%`,
                    backgroundColor: p.percent === 100 ? C.success : C.primary,
                  },
                ]}
              />
            </View>
          </View>
          <Text style={styles.percent}>{p.percent}%</Text>
        </View>
      ))}
      {data.length > initialCount && (
        <TouchableOpacity
          style={styles.more}
          onPress={() => setShowAll(v => !v)}
        >
          <Text style={styles.moreText}>
            {showAll ? 'Show less' : `View more (${data.length - initialCount})`}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  rowBorder: { borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.12)' },
  rank: { width: 18, fontFamily: FONT.bold, fontSize: 13, color: C.black },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.3)',
  },
  avatarFallback: {
    backgroundColor: C.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: C.white, fontSize: 14, fontWeight: '700' },
  name: { fontFamily: FONT.bold, fontSize: 14, color: C.black },
  track: {
    height: 8,
    borderWidth: 1,
    borderColor: C.black,
    borderRadius: 4,
    marginTop: 4,
    overflow: 'hidden',
    backgroundColor: C.white,
  },
  fill: { height: '100%' },
  percent: {
    width: 42,
    textAlign: 'right',
    fontFamily: FONT.bold,
    fontSize: 12,
    color: C.black,
  },
  more: {
    paddingVertical: 12,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.12)',
  },
  moreText: { fontFamily: FONT.bold, fontSize: 13, color: C.primary },
});

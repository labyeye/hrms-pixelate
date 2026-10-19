import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { Download } from 'lucide-react-native';
import { C } from '../../theme';
import { chooseExport, ExportCol } from '../../utils/exporters';

interface Props<T> {
  name: string;
  cols: ExportCol<T>[];
  rows: T[];
  label?: string;
}

/** "Export" pill -> Excel (CSV) or PDF. */
export default function ExportButton<T>({ name, cols, rows, label = 'Export' }: Props<T>) {
  return (
    <TouchableOpacity style={styles.btn} onPress={() => chooseExport(name, cols, rows)}>
      <Download size={13} color={C.black} />
      <Text style={styles.text}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: C.white,
    borderWidth: 2,
    borderRadius: 8,
    borderRightWidth: 4,
    borderBottomWidth: 4,
    borderRightColor: '#0A0A0A',
    borderBottomColor: '#0A0A0A',
    borderColor: C.black,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  text: { color: C.black, fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
});

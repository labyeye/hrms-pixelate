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
export default function ExportButton<T>({
  name,
  cols,
  rows,
  label = 'Export',
}: Props<T>) {
  return (
    <TouchableOpacity
      style={styles.btn}
      onPress={() => chooseExport(name, cols, rows)}
    >
      <Download size={20} color={C.black} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  text: {
    color: C.black,
    fontSize: 12,
    fontWeight: '400',
    textTransform: 'uppercase',
  },
});

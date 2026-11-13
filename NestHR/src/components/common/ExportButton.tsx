import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { Download } from 'lucide-react-native';
import { C } from '../../theme';
import { chooseExport, ExportCol } from '../../utils/exporters';
import { MenuItem, useHeaderMenu } from './HeaderMenu';

interface Props<T> {
  name: string;
  cols: ExportCol<T>[];
  rows: T[];
  label?: string;
}

/** Export icon -> Excel (CSV) or PDF. Inside a HeaderMenu it is a menu row instead. */
export default function ExportButton<T>({
  name,
  cols,
  rows,
  label = 'Export',
}: Props<T>) {
  const inMenu = useHeaderMenu();
  if (inMenu)
    return (
      <MenuItem
        icon={Download}
        label={label || 'Export'}
        onPress={() => chooseExport(name, cols, rows)}
      />
    );
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
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  text: {
    color: C.black,
    fontSize: 12,
    fontWeight: '400',
  },
});

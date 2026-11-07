import React, { useState } from 'react';
import {
  Alert,
  ActivityIndicator,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { Upload, FileText } from 'lucide-react-native';
import { C } from '../../theme';
import { pickSheet, shareTemplate } from '../../utils/importSheet';

interface Props {
  name: string;
  headers: string[];
  example: (string | number)[];
  /** Receives header-keyed rows; resolve with a short result message. */
  onRows: (rows: Record<string, string>[]) => Promise<string | void>;
}

/** Import (pick Excel/CSV) + Sample (share template) pair, mirrors the web ImportButton. */
export default function ImportButton({ name, headers, example, onRows }: Props) {
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    try {
      const rows = await pickSheet();
      if (!rows) return;
      if (!rows.length) return Alert.alert('Import', 'File is empty');
      const msg = await onRows(rows);
      if (msg) Alert.alert('Import', msg);
    } catch (e: any) {
      Alert.alert('Import failed', e?.message || 'Could not import file');
    } finally {
      setBusy(false);
    }
  };
  return (
    <View style={styles.row}>
      <TouchableOpacity style={styles.btn} onPress={run} disabled={busy}>
        {busy ? (
          <ActivityIndicator size="small" color={C.black} />
        ) : (
          <Upload size={20} color={C.black} />
        )}
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.btn}
        onPress={() => shareTemplate(name, headers, example)}
      >
        <FileText size={18} color={C.black} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  btn: { paddingHorizontal: 8, paddingVertical: 7 },
});

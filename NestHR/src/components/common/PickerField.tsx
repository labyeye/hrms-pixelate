import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, FlatList, Pressable, StyleSheet } from 'react-native';
import { ChevronDown, Check } from 'lucide-react-native';
import { C } from '../../theme';

interface Props {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  title?: string;
}

/** Dropdown-style picker: a field that opens a centred list card (used for gender, state, ...). */
export default function PickerField({ value, onChange, options, placeholder = 'Select', title }: Props) {
  const [open, setOpen] = useState(false);
  const current = options.find(o => o.value === value);
  return (
    <>
      <TouchableOpacity style={styles.field} onPress={() => setOpen(true)} activeOpacity={0.8}>
        <Text style={[styles.fieldText, !current && { color: '#6B7280' }]} numberOfLines={1}>
          {current?.label || placeholder}
        </Text>
        <ChevronDown size={16} color={C.black} />
      </TouchableOpacity>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.overlay} onPress={() => setOpen(false)}>
          <Pressable style={styles.card} onPress={() => {}}>
            {title ? <Text style={styles.title}>{title}</Text> : null}
            <FlatList
              data={options}
              keyExtractor={o => o.value}
              style={{ maxHeight: 360 }}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.option, item.value === value && styles.optionActive]}
                  onPress={() => {
                    onChange(item.value);
                    setOpen(false);
                  }}
                >
                  <Text style={styles.optionText}>{item.label}</Text>
                  {item.value === value ? <Check size={16} color={C.primary} /> : null}
                </TouchableOpacity>
              )}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

export const modalCenter = {
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 24 },
  card: {
    backgroundColor: C.white,
    borderWidth: 2,
    borderRadius: 8,
    borderRightWidth: 5,
    borderBottomWidth: 5,
    borderRightColor: '#0A0A0A',
    borderBottomColor: '#0A0A0A',
    borderColor: C.black,
  },
} as const;

const styles = StyleSheet.create({
  field: {
    borderWidth: 2,
    borderRadius: 8,
    borderRightWidth: 5,
    borderBottomWidth: 5,
    borderRightColor: '#0A0A0A',
    borderBottomColor: '#0A0A0A',
    borderColor: C.black,
    paddingHorizontal: 12,
    paddingVertical: 11,
    backgroundColor: C.white,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  fieldText: { fontSize: 14, fontWeight: '500', color: C.black, flex: 1 },
  overlay: modalCenter.overlay,
  card: modalCenter.card,
  title: {
    fontSize: 14,
    fontWeight: '700',
    padding: 14,
    borderBottomWidth: 2,
    borderBottomColor: C.black,
    textTransform: 'uppercase',
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  optionActive: { backgroundColor: '#EFF6FF' },
  optionText: { fontSize: 15, fontWeight: '600', color: C.black },
});

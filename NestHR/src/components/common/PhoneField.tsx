import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  FlatList,
  Pressable,
  StyleSheet,
} from 'react-native';
import { C } from '../../theme';
import { modalCenter } from './PickerField';

// Emoji flags render natively on Android and iOS, so no image assets are needed in the app.
export const COUNTRIES = [
  { flag: '🇮🇳', dial: '+91', name: 'India' },
  { flag: '🇦🇪', dial: '+971', name: 'UAE' },
  { flag: '🇺🇸', dial: '+1', name: 'USA' },
  { flag: '🇬🇧', dial: '+44', name: 'UK' },
  { flag: '🇸🇦', dial: '+966', name: 'Saudi Arabia' },
  { flag: '🇶🇦', dial: '+974', name: 'Qatar' },
  { flag: '🇳🇵', dial: '+977', name: 'Nepal' },
  { flag: '🇧🇩', dial: '+880', name: 'Bangladesh' },
  { flag: '🇱🇰', dial: '+94', name: 'Sri Lanka' },
  { flag: '🇸🇬', dial: '+65', name: 'Singapore' },
  { flag: '🇦🇺', dial: '+61', name: 'Australia' },
  { flag: '🇨🇦', dial: '+1', name: 'Canada' },
];

/** "+919876543210" -> [country, national digits]; bare numbers default to India. */
export function splitPhone(v: string): [(typeof COUNTRIES)[number], string] {
  const s = (v || '').replace(/[^\d+]/g, '');
  const hit = [...COUNTRIES].sort((a, b) => b.dial.length - a.dial.length).find(c => s.startsWith(c.dial));
  return hit ? [hit, s.slice(hit.dial.length)] : [COUNTRIES[0], s.replace(/^\+/, '').slice(-10)];
}

interface Props {
  value: string;
  onChange: (full: string) => void;
  placeholder?: string;
}

/** Country-code picker (flag + dial code) with the number input. Value is "<dial><digits>". */
export default function PhoneField({ value, onChange, placeholder = 'Phone number' }: Props) {
  const [open, setOpen] = useState(false);
  const [country, digits] = splitPhone(value);
  const set = (c: typeof country, d: string) => onChange(d ? `${c.dial}${d}` : '');
  return (
    <>
      <View style={styles.row}>
        <TouchableOpacity style={styles.code} onPress={() => setOpen(true)}>
          <Text style={styles.flag}>{country.flag}</Text>
          <Text style={styles.dial}>{country.dial}</Text>
        </TouchableOpacity>
        <TextInput
          style={styles.input}
          value={digits}
          onChangeText={t => set(country, t.replace(/\D/g, '').slice(0, 12))}
          placeholder={placeholder}
          placeholderTextColor="#6B7280"
          keyboardType="phone-pad"
        />
      </View>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={modalCenter.overlay} onPress={() => setOpen(false)}>
          <Pressable style={modalCenter.card} onPress={() => {}}>
            <Text style={styles.title}>Country code</Text>
            <FlatList
              data={COUNTRIES}
              keyExtractor={c => c.name}
              style={{ maxHeight: 360 }}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.option}
                  onPress={() => {
                    set(item, digits);
                    setOpen(false);
                  }}
                >
                  <Text style={styles.flag}>{item.flag}</Text>
                  <Text style={styles.optName}>{item.name}</Text>
                  <Text style={styles.optDial}>{item.dial}</Text>
                </TouchableOpacity>
              )}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    borderWidth: 2,
    borderRadius: 8,
    borderRightWidth: 5,
    borderBottomWidth: 5,
    borderRightColor: '#0A0A0A',
    borderBottomColor: '#0A0A0A',
    borderColor: C.black,
    backgroundColor: C.white,
    overflow: 'hidden',
  },
  code: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    backgroundColor: '#F3F4F6',
    borderRightWidth: 2,
    borderRightColor: C.black,
  },
  flag: { fontSize: 20 },
  dial: { fontSize: 14, fontWeight: '700', color: C.black },
  input: { flex: 1, paddingHorizontal: 12, paddingVertical: 11, fontSize: 14, fontWeight: '500', color: C.black },
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
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  optName: { flex: 1, fontSize: 15, fontWeight: '600', color: C.black },
  optDial: { fontSize: 14, color: '#6B7280', fontWeight: '600' },
});

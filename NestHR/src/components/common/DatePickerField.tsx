import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Platform,
  StyleSheet,
  Modal,
} from 'react-native';
import DateTimePicker, {
  DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { C } from '../../theme';

interface DatePickerFieldProps {
  label: string;
  value: string; // YYYY-MM-DD
  onChange: (val: string) => void;
  required?: boolean;
  maximumDate?: Date;
  minimumDate?: Date;
}

export function DatePickerField({
  label,
  value,
  onChange,
  required,
  maximumDate,
  minimumDate,
}: DatePickerFieldProps) {
  const [show, setShow] = useState(false);

  const parsed = value ? new Date(value) : new Date();
  const isValid = !!value && !isNaN(parsed.getTime());

  const handleChange = (_: DateTimePickerEvent, selected?: Date) => {
    if (Platform.OS === 'android') setShow(false);
    if (selected) {
      const y = selected.getFullYear();
      const m = String(selected.getMonth() + 1).padStart(2, '0');
      const d = String(selected.getDate()).padStart(2, '0');
      onChange(`${y}-${m}-${d}`);
    }
  };

  const displayValue = isValid
    ? parsed.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    : `Select ${label.replace(' *', '')}`;

  if (Platform.OS === 'android') {
    return (
      <View>
        <Text style={styles.label}>{label}</Text>
        <TouchableOpacity style={styles.input} onPress={() => setShow(true)}>
          <Text style={[styles.inputText, !isValid && styles.placeholder]}>
            {displayValue}
          </Text>
        </TouchableOpacity>
        {show && (
          <DateTimePicker
            value={isValid ? parsed : new Date()}
            mode="date"
            display="default"
            onChange={handleChange}
            maximumDate={maximumDate}
            minimumDate={minimumDate}
          />
        )}
      </View>
    );
  }

  // iOS — show inline in a modal
  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      <TouchableOpacity style={styles.input} onPress={() => setShow(true)}>
        <Text style={[styles.inputText, !isValid && styles.placeholder]}>
          {displayValue}
        </Text>
      </TouchableOpacity>
      <Modal visible={show} transparent animationType="slide">
        <View style={styles.iosOverlay}>
          <View style={styles.iosSheet}>
            <View style={styles.iosHeader}>
              <TouchableOpacity onPress={() => setShow(false)}>
                <Text style={styles.iosDone}>Done</Text>
              </TouchableOpacity>
            </View>
            <DateTimePicker
              value={isValid ? parsed : new Date()}
              mode="date"
              display="spinner"
              onChange={handleChange}
              maximumDate={maximumDate}
              minimumDate={minimumDate}
              style={{ width: '100%' }}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

interface TimePickerFieldProps {
  label: string;
  value: string; // HH:MM
  onChange: (val: string) => void;
}

export function TimePickerField({ label, value, onChange }: TimePickerFieldProps) {
  const [show, setShow] = useState(false);

  const toDate = (hhmm: string) => {
    const [h, m] = (hhmm || '09:00').split(':').map(Number);
    const d = new Date();
    d.setHours(h, m, 0, 0);
    return d;
  };

  const handleChange = (_: DateTimePickerEvent, selected?: Date) => {
    if (Platform.OS === 'android') setShow(false);
    if (selected) {
      const h = String(selected.getHours()).padStart(2, '0');
      const m = String(selected.getMinutes()).padStart(2, '0');
      onChange(`${h}:${m}`);
    }
  };

  if (Platform.OS === 'android') {
    return (
      <View>
        <Text style={styles.label}>{label}</Text>
        <TouchableOpacity style={styles.input} onPress={() => setShow(true)}>
          <Text style={[styles.inputText, !value && styles.placeholder]}>
            {value || `Select ${label.replace(' *', '')}`}
          </Text>
        </TouchableOpacity>
        {show && (
          <DateTimePicker
            value={toDate(value)}
            mode="time"
            is24Hour
            display="default"
            onChange={handleChange}
          />
        )}
      </View>
    );
  }

  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      <TouchableOpacity style={styles.input} onPress={() => setShow(true)}>
        <Text style={[styles.inputText, !value && styles.placeholder]}>
          {value || `Select ${label.replace(' *', '')}`}
        </Text>
      </TouchableOpacity>
      <Modal visible={show} transparent animationType="slide">
        <View style={styles.iosOverlay}>
          <View style={styles.iosSheet}>
            <View style={styles.iosHeader}>
              <TouchableOpacity onPress={() => setShow(false)}>
                <Text style={styles.iosDone}>Done</Text>
              </TouchableOpacity>
            </View>
            <DateTimePicker
              value={toDate(value)}
              mode="time"
              is24Hour
              display="spinner"
              onChange={handleChange}
              style={{ width: '100%' }}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    fontSize: 11,
    fontWeight: '700',
    color: C.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
    marginTop: 12,
  },
  input: {
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 13,
    backgroundColor: '#fff',
  },
  inputText: {
    fontSize: 14,
    color: C.text,
    fontWeight: '500',
  },
  placeholder: {
    color: C.textLight,
  },
  iosOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  iosSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: 30,
  },
  iosHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  iosDone: {
    fontSize: 16,
    fontWeight: '700',
    color: C.primary,
  },
});

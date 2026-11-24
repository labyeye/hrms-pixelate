import React from 'react';
import { Image, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ScanFace, X } from 'lucide-react-native';
import { C } from '../theme';

export type AttendanceFaces = {
  name?: string;
  date?: string;
  checkIn?: string;
  checkOut?: string;
  checkInPhoto?: string;
  checkOutPhoto?: string;
};

export const hasFacePhotos = (r?: { checkInPhoto?: string; checkOutPhoto?: string }) =>
  !!(r?.checkInPhoto || r?.checkOutPhoto);

const fmt = (iso?: string) =>
  iso
    ? new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    : '—';

function Shot({ title, time, uri }: { title: string; time?: string; uri?: string }) {
  return (
    <View style={s.shot}>
      <Text style={s.shotTitle}>{title}</Text>
      <View style={s.frame}>
        {uri ? (
          <Image source={{ uri }} style={s.img} resizeMode="cover" />
        ) : (
          <Text style={s.none}>No photo</Text>
        )}
      </View>
      <Text style={s.time}>{fmt(time)}</Text>
    </View>
  );
}

// Face photos captured when the student's face was scanned to check in / out.
export default function AttendanceFacesModal({
  data,
  onClose,
}: {
  data: AttendanceFaces | null;
  onClose: () => void;
}) {
  return (
    <Modal visible={!!data} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={s.backdrop} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={s.card}>
          <View style={s.head}>
            <ScanFace size={20} color={C.primary} />
            <View style={{ flex: 1 }}>
              <Text style={s.title}>Face attendance</Text>
              <Text style={s.sub}>
                {[data?.name, data?.date].filter(Boolean).join(' · ')}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={10}>
              <X size={20} color="#111827" />
            </TouchableOpacity>
          </View>
          <View style={s.row}>
            <Shot title="Check-in face" time={data?.checkIn} uri={data?.checkInPhoto} />
            <Shot title="Check-out face" time={data?.checkOut} uri={data?.checkOutPhoto} />
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  card: { width: '100%', maxWidth: 380, backgroundColor: '#fff', borderRadius: 16, padding: 16 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  title: { fontSize: 16, fontWeight: '700', color: '#111827' },
  sub: { fontSize: 12, color: '#6b7280' },
  row: { flexDirection: 'row', gap: 12 },
  shot: { flex: 1 },
  shotTitle: { fontSize: 10, fontWeight: '700', color: '#6b7280', textTransform: 'uppercase', marginBottom: 4 },
  frame: { aspectRatio: 3 / 4, borderRadius: 10, backgroundColor: '#f3f4f6', overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  img: { width: '100%', height: '100%' },
  none: { fontSize: 12, color: '#9ca3af' },
  time: { marginTop: 4, fontSize: 14, fontWeight: '700', color: '#111827' },
});

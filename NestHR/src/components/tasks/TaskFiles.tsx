import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  Alert,
  Linking,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import {
  Paperclip,
  X,
  FileText,
  Film,
  Image as ImageIcon,
  Trash2,
} from 'lucide-react-native';
import DocumentPicker, { types } from 'react-native-document-picker';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
import { taskAPI, PickedFile } from '../../api/api';
import { C } from '../../theme';

export const MAX_FILES = 10;
const MAX_MB = 100;

export type TaskAttachment = {
  _id: string;
  name: string;
  mime: string;
  size: number;
  kind: 'image' | 'video' | 'document';
  purpose: 'reference' | 'work';
  uploadedBy?: { _id?: string; name?: string } | string;
};

export const fmtSize = (n: number) =>
  n >= 1048576
    ? `${(n / 1048576).toFixed(1)} MB`
    : `${Math.max(1, Math.round((n || 0) / 1024))} KB`;

/** Camera / gallery (photos + videos) / any file. Calls onAdd with validated files. */
export function pickTaskFiles(
  current: number,
  onAdd: (f: PickedFile[]) => void,
) {
  const room = MAX_FILES - current;
  if (room <= 0) return Alert.alert('Limit', `Up to ${MAX_FILES} files at a time`);
  const add = (list: PickedFile[]) => {
    const ok = list
      .filter(f => {
        if ((f.size || 0) > MAX_MB * 1048576) {
          Alert.alert('Too large', `${f.name} is over ${MAX_MB} MB`);
          return false;
        }
        return true;
      })
      .slice(0, room);
    if (ok.length) onAdd(ok);
  };
  const fromAssets = (r: any) =>
    add(
      (r.assets || []).map((a: any) => ({
        uri: a.uri,
        type: a.type || 'image/jpeg',
        name: a.fileName || `file_${Date.now()}`,
        size: a.fileSize,
      })),
    );
  Alert.alert('Add files', 'Choose a source', [
    {
      text: 'Camera (photo/video)',
      onPress: () => launchCamera({ mediaType: 'mixed', quality: 0.8 }, fromAssets),
    },
    {
      text: 'Gallery (photos/videos)',
      onPress: () =>
        launchImageLibrary(
          { mediaType: 'mixed', quality: 0.8, selectionLimit: room },
          fromAssets,
        ),
    },
    {
      text: 'Documents / other files',
      onPress: async () => {
        try {
          const files = await DocumentPicker.pickMultiple({
            type: [types.allFiles],
            copyTo: 'cachesDirectory',
            mode: 'import',
          });
          add(
            files.map(f => ({
              uri: f.fileCopyUri || f.uri,
              type: f.type || 'application/octet-stream',
              name: f.name || `file_${Date.now()}`,
              size: f.size || undefined,
            })),
          );
        } catch (e: any) {
          if (!DocumentPicker.isCancel(e)) Alert.alert('Error', e.message);
        }
      },
    },
    { text: 'Cancel', style: 'cancel' },
  ]);
}

const kindOf = (t: string) =>
  t.startsWith('image/') ? 'image' : t.startsWith('video/') ? 'video' : 'doc';

/** Files chosen but not yet uploaded (used in the create/edit form). */
export function PendingFiles({
  files,
  onChange,
  label = 'Reference files (images, videos, documents)',
}: {
  files: PickedFile[];
  onChange: (f: PickedFile[]) => void;
  label?: string;
}) {
  return (
    <View>
      <Text style={st.label}>{label}</Text>
      {files.map((f, i) => {
        const k = kindOf(f.type);
        return (
          <View key={f.uri + i} style={st.pendingRow}>
            {k === 'image' ? (
              <Image source={{ uri: f.uri }} style={st.thumbSm} />
            ) : k === 'video' ? (
              <Film size={22} color="#7C3AED" />
            ) : (
              <FileText size={22} color={C.primary} />
            )}
            <Text style={{ flex: 1, color: C.black }} numberOfLines={1}>
              {f.name}
            </Text>
            {!!f.size && <Text style={st.sub}>{fmtSize(f.size)}</Text>}
            <TouchableOpacity onPress={() => onChange(files.filter((_, j) => j !== i))}>
              <X size={18} color={C.danger} />
            </TouchableOpacity>
          </View>
        );
      })}
      <TouchableOpacity
        style={st.addBtn}
        onPress={() => pickTaskFiles(files.length, n => onChange([...files, ...n]))}
      >
        <Paperclip size={16} color={C.primary} />
        <Text style={{ color: C.primary }}>Attach photos, videos or documents</Text>
      </TouchableOpacity>
    </View>
  );
}

function Attachment({
  taskId,
  att,
  canDelete,
  onDelete,
}: {
  taskId: string;
  att: TaskAttachment;
  canDelete: boolean;
  onDelete: () => void;
}) {
  const [url, setUrl] = useState('');
  const previewImg = att.kind === 'image' && !att.mime.includes('hei');
  useEffect(() => {
    if (!previewImg) return;
    let live = true;
    taskAPI.fileUrl(taskId, att._id).then(u => live && setUrl(u)).catch(() => {});
    return () => {
      live = false;
    };
  }, [taskId, att._id, previewImg]);

  const open = async (download = false) => {
    try {
      await Linking.openURL(await taskAPI.fileUrl(taskId, att._id, download));
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not open file');
    }
  };
  return (
    <View style={st.card}>
      <TouchableOpacity onPress={() => open(false)} style={st.preview}>
        {previewImg && url ? (
          <Image source={{ uri: url }} style={st.thumb} resizeMode="cover" />
        ) : att.kind === 'video' ? (
          <Film size={28} color="#7C3AED" />
        ) : att.kind === 'image' ? (
          <ImageIcon size={28} color="#00C48C" />
        ) : (
          <FileText size={28} color={C.primary} />
        )}
      </TouchableOpacity>
      <Text style={st.name} numberOfLines={1}>
        {att.name}
      </Text>
      <Text style={st.sub}>
        {fmtSize(att.size)}
        {typeof att.uploadedBy === 'object' && att.uploadedBy?.name
          ? ` · ${att.uploadedBy.name}`
          : ''}
      </Text>
      <View style={{ flexDirection: 'row', gap: 12, marginTop: 4 }}>
        <TouchableOpacity onPress={() => open(false)}>
          <Text style={st.link}>{att.kind === 'video' ? 'Play' : 'Open'}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => open(true)}>
          <Text style={st.link}>Download</Text>
        </TouchableOpacity>
        {canDelete && (
          <TouchableOpacity onPress={onDelete} style={{ marginLeft: 'auto' }}>
            <Trash2 size={16} color={C.danger} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

export function TaskFilesPanel({
  taskId,
  attachments,
  isManager,
  isAssignee,
  meId,
  onUpdated,
}: {
  taskId: string;
  attachments: TaskAttachment[];
  isManager: boolean;
  isAssignee: boolean;
  meId?: string;
  onUpdated: (task: any) => void;
}) {
  const [pending, setPending] = useState<PickedFile[]>([]);
  const [busy, setBusy] = useState(false);
  const [purpose, setPurpose] = useState<'reference' | 'work'>(
    isManager ? 'reference' : 'work',
  );
  const refs = attachments.filter(a => a.purpose === 'reference');
  const work = attachments.filter(a => a.purpose === 'work');
  const mine = (a: TaskAttachment) =>
    isManager ||
    (typeof a.uploadedBy === 'object' ? a.uploadedBy?._id : a.uploadedBy) === meId;

  const upload = async () => {
    setBusy(true);
    try {
      const r: any = await taskAPI.addFiles(taskId, pending, purpose);
      onUpdated(r.data);
      setPending([]);
    } catch (e: any) {
      Alert.alert('Upload failed', e.message || 'Try again');
    } finally {
      setBusy(false);
    }
  };
  const remove = (a: TaskAttachment) =>
    Alert.alert('Remove file?', a.name, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            const r: any = await taskAPI.deleteFile(taskId, a._id);
            onUpdated(r.data);
          } catch (e: any) {
            Alert.alert('Error', e.message);
          }
        },
      },
    ]);

  const group = (title: string, list: TaskAttachment[]) => (
    <View style={{ marginTop: 6 }}>
      <Text style={st.section}>
        {title} ({list.length})
      </Text>
      {list.length === 0 ? (
        <Text style={st.sub}>None yet</Text>
      ) : (
        <View style={st.grid}>
          {list.map(a => (
            <Attachment
              key={a._id}
              taskId={taskId}
              att={a}
              canDelete={mine(a)}
              onDelete={() => remove(a)}
            />
          ))}
        </View>
      )}
    </View>
  );

  return (
    <View>
      {group('Reference files', refs)}
      {group('Submitted work', work)}
      {(isManager || isAssignee) && (
        <View style={st.uploadBox}>
          {isManager && (
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
              {(['reference', 'work'] as const).map(p => (
                <TouchableOpacity
                  key={p}
                  onPress={() => setPurpose(p)}
                  style={[st.seg, purpose === p && { backgroundColor: C.primary }]}
                >
                  <Text style={{ color: purpose === p ? '#fff' : C.black, fontSize: 12 }}>
                    {p === 'reference' ? 'Add reference' : 'Add as work'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
          <PendingFiles
            files={pending}
            onChange={setPending}
            label={isManager && purpose === 'reference' ? 'Add reference files' : 'Upload your work / proof'}
          />
          {pending.length > 0 && (
            <TouchableOpacity
              style={[st.uploadBtn, busy && { opacity: 0.6 }]}
              disabled={busy}
              onPress={upload}
            >
              {busy ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={{ color: '#fff' }}>
                  Upload {pending.length} file{pending.length > 1 ? 's' : ''}
                </Text>
              )}
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}

const st = StyleSheet.create({
  label: { fontSize: 12, color: C.black, marginTop: 12, marginBottom: 6 },
  section: { fontSize: 13, color: C.black, fontWeight: '600', marginBottom: 6 },
  sub: { fontSize: 11, color: '#6B7280' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  card: {
    width: '48%',
    borderWidth: 1.5,
    borderColor: C.black,
    borderRadius: 8,
    padding: 6,
    backgroundColor: C.white,
  },
  preview: {
    height: 80,
    borderRadius: 6,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  thumb: { width: '100%', height: '100%' },
  thumbSm: { width: 32, height: 32, borderRadius: 4 },
  name: { fontSize: 12, color: C.black, marginTop: 4 },
  link: { fontSize: 12, color: C.primary },
  pendingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 6,
    padding: 6,
    marginBottom: 6,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: C.primary,
    borderRadius: 8,
    padding: 10,
  },
  uploadBox: {
    marginTop: 12,
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 10,
    backgroundColor: '#F8FAFF',
  },
  seg: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 6,
    borderWidth: 1.5,
    borderColor: C.black,
    borderRadius: 6,
    backgroundColor: C.white,
  },
  uploadBtn: {
    backgroundColor: C.primary,
    borderWidth: 2,
    borderColor: C.black,
    borderRadius: 8,
    padding: 10,
    alignItems: 'center',
    marginTop: 8,
  },
});

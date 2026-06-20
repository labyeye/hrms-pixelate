import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  User,
  Mail,
  Phone,
  Lock,
  Eye,
  EyeOff,
  Save,
  ChevronLeft,
  Shield,
  Camera,
} from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
import { useAuth } from '../contexts/AuthContext';
import { authAPI } from '../api/api';
import { C } from '../theme';

export default function ProfileScreen() {
  const navigation = useNavigation<any>();
  const { user, updateUser } = useAuth();

  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [avatarUri, setAvatarUri] = useState<string | null>(
    (user as any)?.avatar || null,
  );
  const [saving, setSaving] = useState(false);

  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [changingPw, setChangingPw] = useState(false);

  const initials = (user?.name || 'U')
    .split(' ')
    .map((n: string) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const pickPhoto = () => {
    Alert.alert('Update Photo', 'Choose source', [
      {
        text: 'Camera',
        onPress: () =>
          launchCamera(
            { mediaType: 'photo', quality: 0.7, includeBase64: true },
            r => {
              if (r.assets?.[0]?.base64)
                setAvatarUri(`data:image/jpeg;base64,${r.assets[0].base64}`);
            },
          ),
      },
      {
        text: 'Gallery',
        onPress: () =>
          launchImageLibrary(
            { mediaType: 'photo', quality: 0.7, includeBase64: true },
            r => {
              if (r.assets?.[0]?.base64)
                setAvatarUri(`data:image/jpeg;base64,${r.assets[0].base64}`);
            },
          ),
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const handleSaveProfile = async () => {
    if (!name.trim()) {
      Alert.alert('Validation', 'Name is required');
      return;
    }
    setSaving(true);
    try {
      await authAPI.updateProfile({
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        ...(avatarUri ? { avatar: avatarUri } : {}),
      });
      updateUser({
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        avatar: avatarUri || undefined,
      });
      Alert.alert('Success', 'Profile updated successfully');
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (!currentPw || !newPw || !confirmPw) {
      Alert.alert('Validation', 'All password fields are required');
      return;
    }
    if (newPw.length < 6) {
      Alert.alert('Validation', 'New password must be at least 6 characters');
      return;
    }
    if (newPw !== confirmPw) {
      Alert.alert('Validation', 'New passwords do not match');
      return;
    }
    setChangingPw(true);
    try {
      await authAPI.updateProfile({
        currentPassword: currentPw,
        newPassword: newPw,
      });
      setCurrentPw('');
      setNewPw('');
      setConfirmPw('');
      Alert.alert('Success', 'Password changed successfully');
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to change password');
    } finally {
      setChangingPw(false);
    }
  };

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={{ padding: 4, marginRight: 4 }}
        >
          <ChevronLeft size={22} color={C.black} />
        </TouchableOpacity>
        <User size={20} color={C.primary} />
        <Text style={s.headerTitle}>My Profile</Text>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={{ padding: 16, gap: 20, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Avatar block */}
          <View style={s.avatarBlock}>
            <TouchableOpacity
              onPress={pickPhoto}
              activeOpacity={0.8}
              style={s.avatarWrap}
            >
              {avatarUri ? (
                <Image source={{ uri: avatarUri }} style={s.avatarImg} />
              ) : (
                <View style={s.avatar}>
                  <Text style={s.avatarText}>{initials}</Text>
                </View>
              )}
              <View style={s.cameraBadge}>
                <Camera size={13} color={C.white} />
              </View>
            </TouchableOpacity>
            <Text style={s.avatarName}>{user?.name || 'User'}</Text>
            <View style={s.roleBadge}>
              <Text style={s.roleText}>
                {(user?.role || 'employee').replace(/_/g, ' ').toUpperCase()}
              </Text>
            </View>
            <Text style={s.tapHint}>Tap photo to change</Text>
          </View>

          {/* Profile info */}
          <View>
            <View style={s.sectionHeader}>
              <User size={14} color={C.primary} />
              <Text style={s.sectionTitle}>Personal Information</Text>
            </View>
            <View style={s.card}>
              {[
                {
                  label: 'Full Name',
                  value: name,
                  setter: setName,
                  icon: <User size={14} color={C.textMuted} />,
                  placeholder: 'John Doe',
                  keyboard: 'default' as const,
                },
                {
                  label: 'Email Address',
                  value: email,
                  setter: setEmail,
                  icon: <Mail size={14} color={C.textMuted} />,
                  placeholder: 'you@company.com',
                  keyboard: 'email-address' as const,
                  autoCapitalize: 'none',
                },
                {
                  label: 'Phone Number',
                  value: phone,
                  setter: setPhone,
                  icon: <Phone size={14} color={C.textMuted} />,
                  placeholder: '+91 9876543210',
                  keyboard: 'phone-pad' as const,
                },
              ].map((f, i) => (
                <View
                  key={f.label}
                  style={[s.fieldRow, i > 0 && s.fieldBorder]}
                >
                  <View style={s.fieldIcon}>{f.icon}</View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.fieldLabel}>{f.label}</Text>
                    <TextInput
                      style={s.fieldInput}
                      value={f.value}
                      onChangeText={f.setter}
                      placeholder={f.placeholder}
                      placeholderTextColor={C.textLight}
                      keyboardType={f.keyboard}
                      autoCapitalize={(f as any).autoCapitalize || 'words'}
                    />
                  </View>
                </View>
              ))}
            </View>

            <TouchableOpacity
              style={s.saveBtn}
              onPress={handleSaveProfile}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color={C.white} />
              ) : (
                <>
                  <Save size={15} color={C.white} />
                  <Text style={s.saveBtnText}>Save Profile</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          {/* Change password */}
          <View>
            <View style={s.sectionHeader}>
              <Shield size={14} color={C.primary} />
              <Text style={s.sectionTitle}>Change Password</Text>
            </View>
            <View style={s.card}>
              {[
                {
                  label: 'Current Password',
                  value: currentPw,
                  setter: setCurrentPw,
                  show: showCurrent,
                  toggle: () => setShowCurrent(p => !p),
                },
                {
                  label: 'New Password',
                  value: newPw,
                  setter: setNewPw,
                  show: showNew,
                  toggle: () => setShowNew(p => !p),
                },
                {
                  label: 'Confirm New Password',
                  value: confirmPw,
                  setter: setConfirmPw,
                  show: showConfirm,
                  toggle: () => setShowConfirm(p => !p),
                },
              ].map((f, i) => (
                <View
                  key={f.label}
                  style={[s.fieldRow, i > 0 && s.fieldBorder]}
                >
                  <View style={s.fieldIcon}>
                    <Lock size={14} color={C.textMuted} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.fieldLabel}>{f.label}</Text>
                    <View style={s.pwRow}>
                      <TextInput
                        style={[s.fieldInput, { flex: 1 }]}
                        value={f.value}
                        onChangeText={f.setter}
                        placeholder="••••••••"
                        placeholderTextColor={C.textLight}
                        secureTextEntry={!f.show}
                        autoCapitalize="none"
                      />
                      <TouchableOpacity onPress={f.toggle} style={s.eyeBtn}>
                        {f.show ? (
                          <EyeOff size={14} color={C.textMuted} />
                        ) : (
                          <Eye size={14} color={C.textMuted} />
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              ))}
            </View>

            <TouchableOpacity
              style={[s.saveBtn, { backgroundColor: C.secondary }]}
              onPress={handleChangePassword}
              disabled={changingPw}
            >
              {changingPw ? (
                <ActivityIndicator color={C.white} />
              ) : (
                <>
                  <Shield size={15} color={C.white} />
                  <Text style={s.saveBtnText}>Change Password</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: C.white,
    borderBottomWidth: 2,
    borderBottomColor: C.black,
    gap: 8,
  },
  headerTitle: { fontSize: 20, fontWeight: '700', color: C.black },
  avatarBlock: { alignItems: 'center', paddingVertical: 8, gap: 8 },
  avatarWrap: { position: 'relative' },
  avatar: {
    width: 88,
    height: 88,
    backgroundColor: C.primary,
    borderWidth: 2,
    borderColor: C.black,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImg: { width: 88, height: 88, borderWidth: 2, borderColor: C.black },
  avatarText: { fontSize: 30, fontWeight: '900', color: C.white },
  cameraBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 26,
    height: 26,
    backgroundColor: C.secondary,
    borderWidth: 2,
    borderColor: C.black,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarName: { fontSize: 20, fontWeight: '700', color: C.black },
  roleBadge: {
    backgroundColor: C.primary,
    borderWidth: 2,
    borderColor: C.black,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  roleText: {
    fontSize: 12,
    fontWeight: '700',
    color: C.white,
    letterSpacing: 1,
  },
  tapHint: { fontSize: 11, color: C.textMuted, fontWeight: '500' },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    color: C.black,
    letterSpacing: 0.5,
  },
  card: { backgroundColor: C.white, borderWidth: 2, borderColor: C.black },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  fieldBorder: { borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  fieldIcon: { paddingTop: 4, marginRight: 10 },
  fieldLabel: {
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
    color: C.textMuted,
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  fieldInput: {
    fontSize: 14,
    fontWeight: '500',
    color: C.black,
    paddingVertical: 0,
  },
  pwRow: { flexDirection: 'row', alignItems: 'center' },
  eyeBtn: { padding: 4, marginLeft: 4 },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: C.primary,
    borderWidth: 2,
    borderColor: C.black,
    paddingVertical: 14,
    marginTop: 10,
  },
  saveBtnText: {
    color: C.white,
    fontWeight: '700',
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});

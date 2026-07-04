import React, { useState, useEffect } from 'react';
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
  CreditCard,
  Cpu,
  Heart,
  BookOpen,
  Award,
  Briefcase,
} from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
import { useAuth } from '../contexts/AuthContext';
import { authAPI, employeeAPI } from '../api/api';
import { C } from '../theme';

function AccordionSection({ title, isOpen, onToggle, children, icon: Icon }: any) {
  return (
    <View style={{ borderBottomWidth: 1, borderBottomColor: '#E5E7EB', marginTop: 10 }}>
      <TouchableOpacity
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingVertical: 12,
          paddingHorizontal: 14,
          backgroundColor: '#F9FAFB',
          borderWidth: 2,
          borderColor: C.black,
        }}
        onPress={onToggle}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {Icon && <Icon size={16} color={C.primary} />}
          <Text style={{ fontSize: 13, fontWeight: '700', color: C.black }}>{title}</Text>
        </View>
        <Text style={{ fontSize: 16, fontWeight: '700', color: C.textMuted }}>{isOpen ? '−' : '+'}</Text>
      </TouchableOpacity>
      {isOpen && (
        <View style={{ padding: 14, backgroundColor: C.white, borderWidth: 2, borderTopWidth: 0, borderColor: C.black }}>
          {children}
        </View>
      )}
    </View>
  );
}

export default function ProfileScreen() {
  const navigation = useNavigation<any>();
  const { user, updateUser } = useAuth();

  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [avatarUri, setAvatarUri] = useState<string | null>(
    (user as any)?.avatar || null,
  );

  const [empProfile, setEmpProfile] = useState<any>(null);
  const [panNumber, setPanNumber] = useState('');
  const [bankAccount, setBankAccount] = useState('');
  const [ifscCode, setIfscCode] = useState('');
  const [emergencyContact, setEmergencyContact] = useState('');
  const [nominees, setNominees] = useState<any[]>([]);
  const [familyDetails, setFamilyDetails] = useState<any[]>([]);
  const [education, setEducation] = useState<any[]>([]);
  const [experience, setExperience] = useState<any[]>([]);
  const [skills, setSkills] = useState<string[]>([]);
  const [certificates, setCertificates] = useState<any[]>([]);

  const [openSection, setOpenSection] = useState<string | null>(null);
  const [newSkill, setNewSkill] = useState('');

  useEffect(() => {
    employeeAPI.getMe()
      .then(res => {
        const emp = res?.data || res;
        setEmpProfile(emp);
        const uri = emp?.avatar || (user as any)?.avatar || null;
        if (uri) setAvatarUri(uri);

        setPanNumber(emp?.panNumber || '');
        setBankAccount(emp?.bankAccount || '');
        setIfscCode(emp?.ifscCode || '');
        setEmergencyContact(emp?.emergencyContact || '');
        setNominees(emp?.nominees || []);
        setFamilyDetails(emp?.familyDetails || []);
        setEducation(emp?.education || []);
        setExperience(emp?.experience || []);
        setSkills(emp?.skills || []);
        setCertificates(emp?.certificates || []);
      })
      .catch(() => {});
  }, []);
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
      if (empProfile?._id) {
        await employeeAPI.update(empProfile._id, {
          panNumber,
          bankAccount,
          ifscCode,
          emergencyContact,
          nominees,
          familyDetails,
          education,
          experience,
          skills,
          certificates,
        });
      }
      updateUser({
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        avatar: avatarUri || undefined,
      });
      Alert.alert('Success', 'Profile details updated successfully');
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

          {/* ESS Collapsible Sections */}
          <View>
            {/* Section: Bank & ID */}
            <AccordionSection
              title="Bank & Identification"
              isOpen={openSection === 'bank'}
              onToggle={() => setOpenSection(openSection === 'bank' ? null : 'bank')}
              icon={CreditCard}
            >
              <View style={{ gap: 10 }}>
                <Text style={s.fieldLabel}>PAN Number</Text>
                <TextInput
                  style={{ borderWidth: 1, borderColor: '#D1D5DB', padding: 8, fontSize: 13, color: C.black }}
                  value={panNumber}
                  onChangeText={setPanNumber}
                  placeholder="ABCDE1234F"
                  placeholderTextColor={C.textLight}
                />
                <Text style={s.fieldLabel}>Bank Account Number</Text>
                <TextInput
                  style={{ borderWidth: 1, borderColor: '#D1D5DB', padding: 8, fontSize: 13, color: C.black }}
                  value={bankAccount}
                  onChangeText={setBankAccount}
                  placeholder="Account Number"
                  placeholderTextColor={C.textLight}
                />
                <Text style={s.fieldLabel}>IFSC Code</Text>
                <TextInput
                  style={{ borderWidth: 1, borderColor: '#D1D5DB', padding: 8, fontSize: 13, color: C.black }}
                  value={ifscCode}
                  onChangeText={setIfscCode}
                  placeholder="IFSC Code"
                  placeholderTextColor={C.textLight}
                />
              </View>
            </AccordionSection>

            {/* Section: Nominees */}
            <AccordionSection
              title="Emergency & Nominees"
              isOpen={openSection === 'nominees'}
              onToggle={() => setOpenSection(openSection === 'nominees' ? null : 'nominees')}
              icon={Heart}
            >
              <View style={{ gap: 12 }}>
                <Text style={s.fieldLabel}>Emergency Contact</Text>
                <TextInput
                  style={{ borderWidth: 1, borderColor: '#D1D5DB', padding: 8, fontSize: 13, color: C.black }}
                  value={emergencyContact}
                  onChangeText={setEmergencyContact}
                  placeholder="Contact Name & Phone"
                  placeholderTextColor={C.textLight}
                />

                <Text style={[s.fieldLabel, { borderTopWidth: 1, borderTopColor: '#E5E7EB', paddingTop: 8, marginTop: 8 }]}>Nominees List</Text>
                {nominees.map((n, i) => (
                  <View key={i} style={{ borderWidth: 1, borderColor: '#E5E7EB', padding: 10, gap: 8, backgroundColor: '#F9FAFB' }}>
                    <TextInput
                      style={{ borderWidth: 1, borderColor: '#D1D5DB', padding: 6, fontSize: 12, backgroundColor: '#fff', color: C.black }}
                      value={n.name}
                      onChangeText={val => {
                        const updated = [...nominees];
                        updated[i].name = val;
                        setNominees(updated);
                      }}
                      placeholder="Nominee Name"
                      placeholderTextColor={C.textLight}
                    />
                    <TextInput
                      style={{ borderWidth: 1, borderColor: '#D1D5DB', padding: 6, fontSize: 12, backgroundColor: '#fff', color: C.black }}
                      value={n.relationship}
                      onChangeText={val => {
                        const updated = [...nominees];
                        updated[i].relationship = val;
                        setNominees(updated);
                      }}
                      placeholder="Relationship"
                      placeholderTextColor={C.textLight}
                    />
                    <TextInput
                      style={{ borderWidth: 1, borderColor: '#D1D5DB', padding: 6, fontSize: 12, backgroundColor: '#fff', color: C.black }}
                      value={String(n.percentage || '')}
                      keyboardType="numeric"
                      onChangeText={val => {
                        const updated = [...nominees];
                        updated[i].percentage = Number(val) || 0;
                        setNominees(updated);
                      }}
                      placeholder="Share Percentage"
                      placeholderTextColor={C.textLight}
                    />
                    <TouchableOpacity
                      onPress={() => setNominees(nominees.filter((_, idx) => idx !== i))}
                      style={{ alignSelf: 'flex-end', backgroundColor: C.danger, paddingHorizontal: 10, paddingVertical: 4 }}
                    >
                      <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}>Remove</Text>
                    </TouchableOpacity>
                  </View>
                ))}
                <TouchableOpacity
                  onPress={() => setNominees([...nominees, { name: '', relationship: '', percentage: 100 }])}
                  style={{ borderWidth: 1, borderStyle: 'dashed', borderColor: C.black, padding: 8, alignItems: 'center', marginTop: 4 }}
                >
                  <Text style={{ fontSize: 11, fontWeight: '700', color: C.black }}>+ Add Nominee</Text>
                </TouchableOpacity>
              </View>
            </AccordionSection>

            {/* Section: Family */}
            <AccordionSection
              title="Family Details"
              isOpen={openSection === 'family'}
              onToggle={() => setOpenSection(openSection === 'family' ? null : 'family')}
              icon={Heart}
            >
              <View style={{ gap: 12 }}>
                {familyDetails.map((f, i) => (
                  <View key={i} style={{ borderWidth: 1, borderColor: '#E5E7EB', padding: 10, gap: 8, backgroundColor: '#F9FAFB' }}>
                    <TextInput
                      style={{ borderWidth: 1, borderColor: '#D1D5DB', padding: 6, fontSize: 12, backgroundColor: '#fff', color: C.black }}
                      value={f.name}
                      onChangeText={val => {
                        const updated = [...familyDetails];
                        updated[i].name = val;
                        setFamilyDetails(updated);
                      }}
                      placeholder="Member Name"
                      placeholderTextColor={C.textLight}
                    />
                    <TextInput
                      style={{ borderWidth: 1, borderColor: '#D1D5DB', padding: 6, fontSize: 12, backgroundColor: '#fff', color: C.black }}
                      value={f.relationship}
                      onChangeText={val => {
                        const updated = [...familyDetails];
                        updated[i].relationship = val;
                        setFamilyDetails(updated);
                      }}
                      placeholder="Relationship"
                      placeholderTextColor={C.textLight}
                    />
                    <TextInput
                      style={{ borderWidth: 1, borderColor: '#D1D5DB', padding: 6, fontSize: 12, backgroundColor: '#fff', color: C.black }}
                      value={f.phone}
                      onChangeText={val => {
                        const updated = [...familyDetails];
                        updated[i].phone = val;
                        setFamilyDetails(updated);
                      }}
                      placeholder="Phone"
                      placeholderTextColor={C.textLight}
                    />
                    <TouchableOpacity
                      onPress={() => setFamilyDetails(familyDetails.filter((_, idx) => idx !== i))}
                      style={{ alignSelf: 'flex-end', backgroundColor: C.danger, paddingHorizontal: 10, paddingVertical: 4 }}
                    >
                      <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}>Remove</Text>
                    </TouchableOpacity>
                  </View>
                ))}
                <TouchableOpacity
                  onPress={() => setFamilyDetails([...familyDetails, { name: '', relationship: '', phone: '' }])}
                  style={{ borderWidth: 1, borderStyle: 'dashed', borderColor: C.black, padding: 8, alignItems: 'center', marginTop: 4 }}
                >
                  <Text style={{ fontSize: 11, fontWeight: '700', color: C.black }}>+ Add Family Member</Text>
                </TouchableOpacity>
              </View>
            </AccordionSection>

            {/* Section: Education */}
            <AccordionSection
              title="Education Records"
              isOpen={openSection === 'education'}
              onToggle={() => setOpenSection(openSection === 'education' ? null : 'education')}
              icon={BookOpen}
            >
              <View style={{ gap: 12 }}>
                {education.map((e, i) => (
                  <View key={i} style={{ borderWidth: 1, borderColor: '#E5E7EB', padding: 10, gap: 8, backgroundColor: '#F9FAFB' }}>
                    <TextInput
                      style={{ borderWidth: 1, borderColor: '#D1D5DB', padding: 6, fontSize: 12, backgroundColor: '#fff', color: C.black }}
                      value={e.degree}
                      onChangeText={val => {
                        const updated = [...education];
                        updated[i].degree = val;
                        setEducation(updated);
                      }}
                      placeholder="Degree / Course"
                      placeholderTextColor={C.textLight}
                    />
                    <TextInput
                      style={{ borderWidth: 1, borderColor: '#D1D5DB', padding: 6, fontSize: 12, backgroundColor: '#fff', color: C.black }}
                      value={e.school}
                      onChangeText={val => {
                        const updated = [...education];
                        updated[i].school = val;
                        setEducation(updated);
                      }}
                      placeholder="School / University"
                      placeholderTextColor={C.textLight}
                    />
                    <TextInput
                      style={{ borderWidth: 1, borderColor: '#D1D5DB', padding: 6, fontSize: 12, backgroundColor: '#fff', color: C.black }}
                      value={String(e.passYear || '')}
                      keyboardType="numeric"
                      onChangeText={val => {
                        const updated = [...education];
                        updated[i].passYear = Number(val) || 0;
                        setEducation(updated);
                      }}
                      placeholder="Pass Year"
                      placeholderTextColor={C.textLight}
                    />
                    <TouchableOpacity
                      onPress={() => setEducation(education.filter((_, idx) => idx !== i))}
                      style={{ alignSelf: 'flex-end', backgroundColor: C.danger, paddingHorizontal: 10, paddingVertical: 4 }}
                    >
                      <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}>Remove</Text>
                    </TouchableOpacity>
                  </View>
                ))}
                <TouchableOpacity
                  onPress={() => setEducation([...education, { degree: '', school: '', passYear: 2020 }])}
                  style={{ borderWidth: 1, borderStyle: 'dashed', borderColor: C.black, padding: 8, alignItems: 'center', marginTop: 4 }}
                >
                  <Text style={{ fontSize: 11, fontWeight: '700', color: C.black }}>+ Add Education Record</Text>
                </TouchableOpacity>
              </View>
            </AccordionSection>

            {/* Section: Experience */}
            <AccordionSection
              title="Work Experience"
              isOpen={openSection === 'experience'}
              onToggle={() => setOpenSection(openSection === 'experience' ? null : 'experience')}
              icon={Briefcase}
            >
              <View style={{ gap: 12 }}>
                {experience.map((exp, i) => (
                  <View key={i} style={{ borderWidth: 1, borderColor: '#E5E7EB', padding: 10, gap: 8, backgroundColor: '#F9FAFB' }}>
                    <TextInput
                      style={{ borderWidth: 1, borderColor: '#D1D5DB', padding: 6, fontSize: 12, backgroundColor: '#fff', color: C.black }}
                      value={exp.company}
                      onChangeText={val => {
                        const updated = [...experience];
                        updated[i].company = val;
                        setExperience(updated);
                      }}
                      placeholder="Company"
                      placeholderTextColor={C.textLight}
                    />
                    <TextInput
                      style={{ borderWidth: 1, borderColor: '#D1D5DB', padding: 6, fontSize: 12, backgroundColor: '#fff', color: C.black }}
                      value={exp.role}
                      onChangeText={val => {
                        const updated = [...experience];
                        updated[i].role = val;
                        setExperience(updated);
                      }}
                      placeholder="Role"
                      placeholderTextColor={C.textLight}
                    />
                    <View style={{ flexDirection: 'row', gap: 6 }}>
                      <TextInput
                        style={{ flex: 1, borderWidth: 1, borderColor: '#D1D5DB', padding: 6, fontSize: 12, backgroundColor: '#fff', color: C.black }}
                        value={exp.start}
                        onChangeText={val => {
                          const updated = [...experience];
                          updated[i].start = val;
                          setExperience(updated);
                        }}
                        placeholder="Start Date"
                        placeholderTextColor={C.textLight}
                      />
                      <TextInput
                        style={{ flex: 1, borderWidth: 1, borderColor: '#D1D5DB', padding: 6, fontSize: 12, backgroundColor: '#fff', color: C.black }}
                        value={exp.end}
                        onChangeText={val => {
                          const updated = [...experience];
                          updated[i].end = val;
                          setExperience(updated);
                        }}
                        placeholder="End Date"
                        placeholderTextColor={C.textLight}
                      />
                    </View>
                    <TouchableOpacity
                      onPress={() => setExperience(experience.filter((_, idx) => idx !== i))}
                      style={{ alignSelf: 'flex-end', backgroundColor: C.danger, paddingHorizontal: 10, paddingVertical: 4 }}
                    >
                      <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}>Remove</Text>
                    </TouchableOpacity>
                  </View>
                ))}
                <TouchableOpacity
                  onPress={() => setExperience([...experience, { company: '', role: '', start: '', end: '' }])}
                  style={{ borderWidth: 1, borderStyle: 'dashed', borderColor: C.black, padding: 8, alignItems: 'center', marginTop: 4 }}
                >
                  <Text style={{ fontSize: 11, fontWeight: '700', color: C.black }}>+ Add Experience Record</Text>
                </TouchableOpacity>
              </View>
            </AccordionSection>

            {/* Section: Skills */}
            <AccordionSection
              title="Skills Tags"
              isOpen={openSection === 'skills'}
              onToggle={() => setOpenSection(openSection === 'skills' ? null : 'skills')}
              icon={Award}
            >
              <View style={{ gap: 10 }}>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TextInput
                    style={{ flex: 1, borderWidth: 1, borderColor: '#D1D5DB', padding: 8, fontSize: 13, color: C.black }}
                    value={newSkill}
                    onChangeText={setNewSkill}
                    placeholder="e.g. React Native, Swift"
                    placeholderTextColor={C.textLight}
                  />
                  <TouchableOpacity
                    onPress={() => {
                      if (newSkill.trim() && !skills.includes(newSkill.trim())) {
                        setSkills([...skills, newSkill.trim()]);
                        setNewSkill('');
                      }
                    }}
                    style={{ backgroundColor: C.black, paddingHorizontal: 16, justifyContent: 'center' }}
                  >
                    <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>Add</Text>
                  </TouchableOpacity>
                </View>

                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                  {skills.map((s, idx) => (
                    <View key={idx} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: C.black, paddingHorizontal: 8, paddingVertical: 4, gap: 4 }}>
                      <Text style={{ fontSize: 11, fontWeight: '700', color: C.black }}>{s}</Text>
                      <TouchableOpacity onPress={() => setSkills(skills.filter((_, i) => i !== idx))}>
                        <Text style={{ color: C.danger, fontWeight: '700', fontSize: 13 }}>×</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                  {skills.length === 0 && <Text style={{ fontSize: 11, color: C.textMuted }}>No skills tags listed.</Text>}
                </View>
              </View>
            </AccordionSection>

            {/* Section: Certificates */}
            <AccordionSection
              title="Certificates"
              isOpen={openSection === 'certificates'}
              onToggle={() => setOpenSection(openSection === 'certificates' ? null : 'certificates')}
              icon={Award}
            >
              <View style={{ gap: 12 }}>
                {certificates.map((cert, i) => (
                  <View key={i} style={{ borderWidth: 1, borderColor: '#E5E7EB', padding: 10, gap: 8, backgroundColor: '#F9FAFB' }}>
                    <TextInput
                      style={{ borderWidth: 1, borderColor: '#D1D5DB', padding: 6, fontSize: 12, backgroundColor: '#fff', color: C.black }}
                      value={cert.name}
                      onChangeText={val => {
                        const updated = [...certificates];
                        updated[i].name = val;
                        setCertificates(updated);
                      }}
                      placeholder="Certificate Name"
                      placeholderTextColor={C.textLight}
                    />
                    <TextInput
                      style={{ borderWidth: 1, borderColor: '#D1D5DB', padding: 6, fontSize: 12, backgroundColor: '#fff', color: C.black }}
                      value={cert.issuer}
                      onChangeText={val => {
                        const updated = [...certificates];
                        updated[i].issuer = val;
                        setCertificates(updated);
                      }}
                      placeholder="Issuer"
                      placeholderTextColor={C.textLight}
                    />
                    <TextInput
                      style={{ borderWidth: 1, borderColor: '#D1D5DB', padding: 6, fontSize: 12, backgroundColor: '#fff', color: C.black }}
                      value={cert.docUrl}
                      onChangeText={val => {
                        const updated = [...certificates];
                        updated[i].docUrl = val;
                        setCertificates(updated);
                      }}
                      placeholder="Certificate URL Link"
                      placeholderTextColor={C.textLight}
                    />
                    <TouchableOpacity
                      onPress={() => setCertificates(certificates.filter((_, idx) => idx !== i))}
                      style={{ alignSelf: 'flex-end', backgroundColor: C.danger, paddingHorizontal: 10, paddingVertical: 4 }}
                    >
                      <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}>Remove</Text>
                    </TouchableOpacity>
                  </View>
                ))}
                <TouchableOpacity
                  onPress={() => setCertificates([...certificates, { name: '', issuer: '', docUrl: '' }])}
                  style={{ borderWidth: 1, borderStyle: 'dashed', borderColor: C.black, padding: 8, alignItems: 'center', marginTop: 4 }}
                >
                  <Text style={{ fontSize: 11, fontWeight: '700', color: C.black }}>+ Add Certificate Record</Text>
                </TouchableOpacity>
              </View>
            </AccordionSection>
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
  avatarText: { fontSize: 30, fontWeight: '700', color: C.white },
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

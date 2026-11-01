import { useState, useEffect, useRef } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { authAPI } from "@/services/api";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2,
  Save,
  Eye,
  EyeOff,
  UserCircle,
  Lock,
  Camera,
  X,
  Upload,
} from "lucide-react";
import PasswordChecklist from "@/components/PasswordChecklist";

export default function ProfilePage() {
  const { user, updateUser } = useAuth();
  const { toast } = useToast();

  // Profile state
  const [profileName, setProfileName] = useState("");
  const [profilePhone, setProfilePhone] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [pwForm, setPwForm] = useState({ current: "", next: "", confirm: "" });
  const [showPw, setShowPw] = useState({
    current: false,
    next: false,
    confirm: false,
  });
  const [pwSaving, setPwSaving] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setProfileName(user?.name || "");
    setProfilePhone((user as any)?.phone || "");
  }, [user]);

  const handleSaveProfile = async () => {
    setProfileSaving(true);
    try {
      const res = (await authAPI.updateProfile({
        name: profileName.trim(),
        phone: profilePhone.trim(),
      })) as any;
      updateUser({
        name: res.data?.name || profileName.trim(),
        phone: res.data?.phone || profilePhone.trim(),
      });
      toast({ title: "Profile saved", description: "Name and phone updated." });
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Failed to save",
        variant: "destructive",
      });
    } finally {
      setProfileSaving(false);
    }
  };

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please choose an image under 3 MB",
        variant: "destructive",
      });
      return;
    }
    setPhotoUploading(true);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      let finalBase64 = base64;
      if (base64.length > 500_000) {
        const img = new Image();
        img.src = base64;
        await new Promise<void>((r) => {
          img.onload = () => r();
        });
        const canvas = document.createElement("canvas");
        const MAX = 400;
        const scale = Math.min(MAX / img.width, MAX / img.height, 1);
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        canvas
          .getContext("2d")!
          .drawImage(img, 0, 0, canvas.width, canvas.height);
        finalBase64 = canvas.toDataURL("image/jpeg", 0.8);
      }
      await authAPI.updateProfile({ avatar: finalBase64 });
      updateUser({ avatar: finalBase64 });
      toast({ title: "Photo updated" });
    } catch (err: any) {
      toast({
        title: "Upload failed",
        description: err.message || "Could not save photo",
        variant: "destructive",
      });
    } finally {
      setPhotoUploading(false);
      if (photoInputRef.current) photoInputRef.current.value = "";
    }
  };

  const handleRemovePhoto = async () => {
    setPhotoUploading(true);
    try {
      await authAPI.updateProfile({ avatar: "" });
      updateUser({ avatar: "" });
      toast({ title: "Photo removed" });
    } catch (err: any) {
      toast({
        title: "Failed",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setPhotoUploading(false);
    }
  };

  const handleChangePassword = async () => {
    if (pwForm.next !== pwForm.confirm) {
      toast({ title: "Passwords don't match", variant: "destructive" });
      return;
    }
    setPwSaving(true);
    try {
      await authAPI.updateProfile({
        currentPassword: pwForm.current,
        password: pwForm.next,
      });
      setPwForm({ current: "", next: "", confirm: "" });
      toast({
        title: "Password changed",
        description: "Your new password is active.",
      });
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Failed to change password",
        variant: "destructive",
      });
    } finally {
      setPwSaving(false);
    }
  };

  return (
    <AppLayout title="My Profile">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-display font-bold text-black">
            My Profile
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Your photo, contact details and password
          </p>
        </div>
        <div className="border-2 border-black bg-white">
                <div className="p-6 space-y-6">
                  {/* Avatar */}
                  <div className="border-2 border-black p-5 flex flex-col items-center gap-4">
                    <div className="relative group">
                      <div className="w-24 h-24 border-2 border-black bg-[#024BAB] flex items-center justify-center text-2xl font-bold text-white overflow-hidden">
                        {user?.avatar ? (
                          <img
                            src={user.avatar}
                            alt="avatar"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span>{user?.name?.[0]?.toUpperCase()}</span>
                        )}
                      </div>
                      <button
                        onClick={() => photoInputRef.current?.click()}
                        disabled={photoUploading}
                        className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                      >
                        {photoUploading ? (
                          <Loader2 className="w-4 h-4 text-white animate-spin" />
                        ) : (
                          <Camera className="w-4 h-4 text-white" />
                        )}
                      </button>
                    </div>
                    <div className="flex gap-3">
                      <button
                        onClick={() => photoInputRef.current?.click()}
                        disabled={photoUploading}
                        className="flex items-center gap-1.5 bg-[#024BAB] text-white border-2 border-black px-4 py-2 text-xs font-bold uppercase disabled:opacity-50"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        {photoUploading ? "Uploading..." : "Upload Photo"}
                      </button>
                      {user?.avatar && (
                        <button
                          onClick={handleRemovePhoto}
                          disabled={photoUploading}
                          className="flex items-center gap-1.5 bg-white text-[#EF4444] border-2 border-[#EF4444] px-4 py-2 text-xs font-bold uppercase disabled:opacity-50"
                        >
                          <X className="w-3.5 h-3.5" /> Remove
                        </button>
                      )}
                    </div>
                    <input
                      ref={photoInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handlePhotoChange}
                    />
                  </div>

                  {/* Edit Info */}
                  <div className="border-2 border-black overflow-hidden">
                    <div className="px-4 py-3 bg-[#024BAB] border-b-2 border-black flex items-center gap-2">
                      <UserCircle className="w-4 h-4 text-white" />
                      <p className="text-xs font-bold uppercase tracking-wider text-white">
                        Edit Profile
                      </p>
                    </div>
                    <div className="p-5 grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs font-bold uppercase mb-1.5">
                          Display Name
                        </label>
                        <input
                          value={profileName}
                          onChange={(e) => setProfileName(e.target.value)}
                          className="w-full border-2 border-black px-3 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#024BAB]"
                          placeholder="Your full name"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold uppercase mb-1.5">
                          Phone Number
                        </label>
                        <input
                          value={profilePhone}
                          onChange={(e) => setProfilePhone(e.target.value)}
                          className="w-full border-2 border-black px-3 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#024BAB]"
                          placeholder="+91 XXXXX XXXXX"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold uppercase mb-1.5">
                          Email
                        </label>
                        <input
                          value={user?.email || ""}
                          disabled
                          className="w-full border-2 border-black/30 px-3 py-2.5 text-sm font-medium bg-gray-50 text-gray-400 cursor-not-allowed"
                        />
                        <p className="text-[10px] text-muted-foreground mt-1">
                          Email cannot be changed.
                        </p>
                      </div>
                      <button
                        onClick={handleSaveProfile}
                        disabled={profileSaving}
                        className="flex items-center gap-2 bg-[#024BAB] text-white border-2 border-black px-6 py-2.5 text-xs font-bold uppercase disabled:opacity-50"
                      >
                        {profileSaving ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Save className="w-4 h-4" />
                        )}
                        {profileSaving ? "Saving..." : "Save Changes"}
                      </button>
                    </div>
                  </div>

                  {/* Change Password */}
                  <div className="border-2 border-black overflow-hidden">
                    <div className="px-4 py-3 bg-[#024BAB] border-b-2 border-black flex items-center gap-2">
                      <Lock className="w-4 h-4 text-white" />
                      <p className="text-xs font-bold uppercase tracking-wider text-white">
                        Change Password
                      </p>
                    </div>
                    <div className="p-5 grid grid-cols-1 sm:grid-cols-3 gap-4">
                      {[
                        { key: "current", label: "Current Password" },
                        { key: "next", label: "New Password" },
                        { key: "confirm", label: "Confirm New Password" },
                      ].map(({ key, label }) => (
                        <div key={key}>
                          <label className="block text-xs font-bold uppercase mb-1.5">
                            {label}
                          </label>
                          <div className="relative">
                            <input
                              type={
                                showPw[key as keyof typeof showPw]
                                  ? "text"
                                  : "password"
                              }
                              value={pwForm[key as keyof typeof pwForm]}
                              onChange={(e) =>
                                setPwForm((p) => ({
                                  ...p,
                                  [key]: e.target.value,
                                }))
                              }
                              className="w-full border-2 border-black px-3 py-2.5 pr-9 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#024BAB]"
                              placeholder="Enter Password"
                            />
                            <button
                              type="button"
                              onClick={() =>
                                setShowPw((p) => ({
                                  ...p,
                                  [key]: !p[key as keyof typeof p],
                                }))
                              }
                              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-black"
                            >
                              {showPw[key as keyof typeof showPw] ? (
                                <EyeOff className="w-4 h-4" />
                              ) : (
                                <Eye className="w-4 h-4" />
                              )}
                            </button>
                          </div>
                          {key === "next" && pwForm.next && (
                            <PasswordChecklist password={pwForm.next} />
                          )}
                        </div>
                      ))}
                      <div className="sm:col-span-3">
                        <button
                          onClick={handleChangePassword}
                          disabled={
                            pwSaving ||
                            !pwForm.current ||
                            !pwForm.next ||
                            !pwForm.confirm
                          }
                          className="flex items-center gap-2 bg-[#FA731C] text-white border-2 border-black px-6 py-2.5 text-xs font-bold uppercase disabled:opacity-50"
                        >
                          {pwSaving ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Lock className="w-4 h-4" />
                          )}
                          {pwSaving ? "Changing..." : "Change Password"}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

        </div>
      </div>
    </AppLayout>
  );
}

import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getUserProfile, updateUserProfile } from '../../api/user';
import type { User } from '../../types';
import { Camera, Loader2, Save, Edit2, Mail, Phone, Calendar, MapPin, User as UserIcon, Shield, X, Activity } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button } from '../../components/ui/Button';
import { ProfileCompletion } from '../../components/ProfileCompletion';

export function UserProfile() {
    const { setUser } = useAuth();

    const [profile, setProfile] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isEditing, setIsEditing] = useState(false);

    // Profile form state
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [addressLine1, setAddressLine1] = useState('');
    const [addressLine2, setAddressLine2] = useState('');
    const [dob, setDob] = useState('');
    const [gender, setGender] = useState('');
    const [weight, setWeight] = useState('');
    const [height, setHeight] = useState('');

    // Profile image
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);

    // ===============================
    // FETCH PROFILE
    // ===============================
    useEffect(() => {
        const fetchAll = async () => {
            try {
                const profileRes = await getUserProfile();
                if (profileRes.success && profileRes.userData) {
                    const userData = profileRes.userData;
                    setProfile(userData);
                    setUser(userData);

                    setName(userData.name || '');
                    setPhone(userData.phone || '');
                    setAddressLine1(userData.address?.line1 || '');
                    setAddressLine2(userData.address?.line2 || '');
                    setDob(userData.dob || '');
                    setGender(userData.gender || '');
                    setWeight(userData.weight || '');
                    setHeight(userData.height || '');
                }
            } catch {
                toast.error('Failed to load profile');
            } finally {
                setIsLoading(false);
            }
        };

        fetchAll();
    }, [setUser]);

    // ===============================
    // IMAGE HANDLER
    // ===============================
    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setImageFile(file);
        const reader = new FileReader();
        reader.onloadend = () => setImagePreview(reader.result as string);
        reader.readAsDataURL(file);
    };

    // ===============================
    // PROFILE UPDATE
    // ===============================
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);

        try {
            const formData = new FormData();
            formData.append('name', name);
            formData.append('phone', phone);
            formData.append('address', JSON.stringify({
                line1: addressLine1,
                line2: addressLine2,
            }));
            formData.append('dob', dob);
            formData.append('gender', gender);
            formData.append('weight', weight);
            formData.append('height', height);

            if (imageFile) {
                formData.append('image', imageFile);
            }

            const response = await updateUserProfile(formData);

            if (response.success) {
                toast.success('Profile updated successfully');
                setIsEditing(false);

                const refreshed = await getUserProfile();
                if (refreshed.success && refreshed.userData) {
                    setProfile(refreshed.userData);
                    setUser(refreshed.userData);
                }
            } else {
                toast.error(response.message || 'Update failed');
            }
        } catch {
            toast.error('Failed to update profile');
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh] bg-[#EEF2FF]">
                <Loader2 className="animate-spin text-[#7886C7]" size={48} />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#EEF2FF] p-4 lg:p-6 flex items-center justify-center">
            <div className={`w-full max-w-6xl transition-all duration-500 ${isEditing ? 'scale-[1.01]' : ''}`}>

                {/* Header Actions */}
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h1 className="text-2xl font-bold text-[#2D336B] tracking-tight flex items-center gap-2">
                            <UserIcon className="text-[#7886C7]" size={28} />
                            My Profile
                        </h1>
                        <p className="text-[#2D336B]/60 text-sm font-medium ml-9">Manage your personal information</p>
                    </div>
                    {!isEditing ? (
                        <Button
                            onClick={() => setIsEditing(true)}
                            className="bg-[#2D336B] text-white hover:bg-[#2D336B]/90 shadow-lg shadow-[#2D336B]/20 transition-all hover:scale-105 rounded-xl"
                        >
                            <Edit2 size={16} className="mr-2" />
                            Edit Details
                        </Button>
                    ) : (
                        <div className="flex items-center gap-3">
                            <Button
                                variant="secondary"
                                onClick={() => setIsEditing(false)}
                                disabled={isSaving}
                                className="bg-white text-[#2D336B] hover:bg-red-50 hover:text-red-500 border border-[#A9B5DF]/30 rounded-xl"
                            >
                                <X size={16} className="mr-2" />
                                Cancel
                            </Button>
                            <Button
                                onClick={handleSubmit}
                                isLoading={isSaving}
                                className="bg-[#7886C7] text-white hover:bg-[#6876bf] shadow-lg shadow-[#7886C7]/30 rounded-xl"
                            >
                                <Save size={16} className="mr-2" />
                                Save Changes
                            </Button>
                        </div>
                    )}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

                    {/* Left Column: ID Card style */}
                    <div className="lg:col-span-4 flex flex-col gap-6">
                        <div className="relative overflow-hidden bg-white/70 backdrop-blur-xl border border-[#A9B5DF]/40 rounded-[2rem] p-8 shadow-xl shadow-[#2D336B]/5 text-center group hover:shadow-2xl hover:shadow-[#7886C7]/10 transition-all duration-300">
                            <div className="absolute top-0 left-0 w-full h-24 bg-gradient-to-br from-[#7886C7] to-[#2D336B] opacity-10" />

                            <div className="relative z-10 mx-auto w-40 h-40 mb-4">
                                <div className="w-full h-full rounded-full p-1 bg-white ring-4 ring-[#A9B5DF]/30 shadow-lg overflow-hidden relative">
                                    {imagePreview || profile?.image ? (
                                        <img
                                            src={imagePreview || profile?.image}
                                            alt={name}
                                            className="w-full h-full rounded-full object-cover transition-transform duration-500 group-hover:scale-110"
                                        />
                                    ) : (
                                        <div className="w-full h-full rounded-full bg-[#EEF2FF] flex items-center justify-center text-[#7886C7] text-5xl font-bold">
                                            {name.charAt(0) || 'U'}
                                        </div>
                                    )}
                                    {isEditing && (
                                        <label className="absolute bottom-1 right-3 p-3 rounded-full bg-[#7886C7] text-white cursor-pointer hover:bg-[#2D336B] transition-all shadow-lg hover:scale-110 z-20">
                                            <Camera size={20} />
                                            <input
                                                type="file"
                                                accept="image/*"
                                                onChange={handleImageChange}
                                                className="hidden"
                                            />
                                        </label>
                                    )}
                                </div>
                            </div>

                            <h2 className="text-2xl font-bold text-[#2D336B] mb-1">{profile?.name || 'User'}</h2>
                            <p className="text-[#2D336B]/60 text-sm mb-4 font-medium">{profile?.email}</p>

                            <div className="flex flex-wrap justify-center gap-2 mb-6">
                                <span className="px-3 py-1 bg-[#7886C7]/10 text-[#7886C7] text-xs font-bold rounded-full border border-[#7886C7]/20">
                                    PATIENT
                                </span>
                                <span className="px-3 py-1 bg-[#2D336B]/5 text-[#2D336B] text-xs font-bold rounded-full border border-[#2D336B]/10">
                                    ID: {profile?._id?.slice(-6).toUpperCase()}
                                </span>
                            </div>

                            {/* Stat items */}
                            <div className="grid grid-cols-2 gap-3 pt-6 border-t border-[#A9B5DF]/20">
                                <div className="text-center">
                                    <p className="text-xs text-[#2D336B]/50 font-semibold uppercase tracking-wider mb-1">Status</p>
                                    <p className="text-[#2D336B] font-bold flex items-center justify-center gap-1">
                                        <Shield size={14} className="text-green-500" /> Active
                                    </p>
                                </div>
                                <div className="text-center border-l border-[#A9B5DF]/20">
                                    <p className="text-xs text-[#2D336B]/50 font-semibold uppercase tracking-wider mb-1">Joined</p>
                                    <p className="text-[#2D336B] font-bold">2024</p>
                                </div>
                            </div>

                            {/* Profile Completion */}
                            <ProfileCompletion completion={profile?.profile_completion_percentage || 0} />
                        </div>

                        {/* Quick Contact Card (Left column part 2) w/ Map aesthetic */}
                        <div className="relative overflow-hidden bg-[#2D336B] text-white rounded-[2rem] p-6 shadow-xl shadow-[#2D336B]/10">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-2xl -mr-16 -mt-16" />
                            <div className="relative z-10">
                                <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                                    <MapPin size={18} className="text-[#A9B5DF]" />
                                    Location
                                </h3>
                                <div className="space-y-4 text-sm text-[#A9B5DF]">
                                    <p>
                                        <span className="block text-xs uppercase opacity-50 mb-0.5">Primary Address</span>
                                        <span className="text-white font-medium text-base">
                                            {addressLine1 || "Not set"}
                                        </span>
                                    </p>
                                    <p>
                                        <span className="block text-xs uppercase opacity-50 mb-0.5">City / State</span>
                                        <span className="text-white font-medium text-base">
                                            {addressLine2 || "Not set"}
                                        </span>
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Editable Details Form */}
                    <div className="lg:col-span-8">
                        <div className="bg-white/70 backdrop-blur-xl border border-[#A9B5DF]/40 rounded-[2rem] p-8 shadow-xl shadow-[#2D336B]/5 h-full relative overflow-hidden">
                            {/* Form Section Header */}
                            <div className="flex items-center gap-3 mb-8 pb-4 border-b border-[#A9B5DF]/20">
                                <div className="p-3 bg-[#EEF2FF] rounded-xl text-[#7886C7]">
                                    <UserIcon size={24} />
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold text-[#2D336B]">Personal Details</h3>
                                    <p className="text-sm text-[#2D336B]/50 font-medium">Update your information to keep your profile current</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                                {/* Name Input */}
                                <div className="space-y-2 group">
                                    <label className="text-xs font-bold text-[#2D336B] ml-1 uppercase tracking-wider group-focus-within:text-[#7886C7] transition-colors">
                                        Full Name
                                    </label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            value={name}
                                            onChange={(e) => setName(e.target.value)}
                                            disabled={!isEditing}
                                            className="w-full h-14 rounded-xl border border-[#A9B5DF]/50 bg-white/50 px-4 text-[#2D336B] text-lg font-semibold focus:border-[#7886C7] focus:ring-4 focus:ring-[#7886C7]/10 outline-none transition-all disabled:opacity-70 disabled:bg-transparent disabled:border-transparent disabled:px-0 disabled:text-[#2D336B]/80"
                                        />
                                        {isEditing && <Edit2 size={16} className="absolute right-4 top-4.5 text-[#A9B5DF]" />}
                                    </div>
                                </div>

                                {/* Email Input (Read Only) */}
                                <div className="space-y-2 group">
                                    <label className="text-xs font-bold text-[#2D336B] ml-1 uppercase tracking-wider opacity-60">
                                        Email Address
                                    </label>
                                    <div className="relative">
                                        <input
                                            type="email"
                                            value={profile?.email || ''}
                                            disabled
                                            className="w-full h-14 rounded-xl border-dashed border-[#A9B5DF]/40 bg-[#EEF2FF]/30 px-4 text-[#2D336B]/60 text-lg font-medium outline-none cursor-not-allowed"
                                        />
                                        <Mail size={16} className="absolute right-4 top-4.5 text-[#2D336B]/20" />
                                    </div>
                                </div>

                                {/* Phone Input */}
                                <div className="space-y-2 group">
                                    <label className="text-xs font-bold text-[#2D336B] ml-1 uppercase tracking-wider group-focus-within:text-[#7886C7] transition-colors">
                                        Phone Number
                                    </label>
                                    <div className="relative">
                                        <input
                                            type="tel"
                                            value={phone}
                                            onChange={(e) => setPhone(e.target.value)}
                                            disabled={!isEditing}
                                            placeholder={isEditing ? "+1 234 567 890" : "• • •"}
                                            className="w-full h-14 rounded-xl border border-[#A9B5DF]/50 bg-white/50 px-4 text-[#2D336B] text-lg font-semibold focus:border-[#7886C7] focus:ring-4 focus:ring-[#7886C7]/10 outline-none transition-all disabled:opacity-70 disabled:bg-transparent disabled:border-transparent disabled:px-0 disabled:text-[#2D336B]/80"
                                        />
                                        {isEditing && <Phone size={16} className="absolute right-4 top-4.5 text-[#A9B5DF]" />}
                                    </div>
                                </div>

                                {/* DOB Input */}
                                <div className="space-y-2 group">
                                    <label className="text-xs font-bold text-[#2D336B] ml-1 uppercase tracking-wider group-focus-within:text-[#7886C7] transition-colors">
                                        Date of Birth
                                    </label>
                                    <div className="relative">
                                        <input
                                            type="date"
                                            value={dob}
                                            onChange={(e) => setDob(e.target.value)}
                                            disabled={!isEditing}
                                            className="w-full h-14 rounded-xl border border-[#A9B5DF]/50 bg-white/50 px-4 text-[#2D336B] text-lg font-semibold focus:border-[#7886C7] focus:ring-4 focus:ring-[#7886C7]/10 outline-none transition-all disabled:opacity-70 disabled:bg-transparent disabled:border-transparent disabled:px-0 disabled:text-[#2D336B]/80"
                                        />
                                        {isEditing && <Calendar size={16} className="absolute right-4 top-4.5 text-[#A9B5DF] pointer-events-none" />}
                                    </div>
                                </div>

                                {/* Gender Select */}
                                <div className="space-y-2 group">
                                    <label className="text-xs font-bold text-[#2D336B] ml-1 uppercase tracking-wider group-focus-within:text-[#7886C7] transition-colors">
                                        Gender
                                    </label>
                                    <div className="relative">
                                        <select
                                            value={gender}
                                            onChange={(e) => setGender(e.target.value)}
                                            disabled={!isEditing}
                                            className="w-full h-14 rounded-xl border border-[#A9B5DF]/50 bg-white/50 px-4 text-[#2D336B] text-lg font-semibold focus:border-[#7886C7] focus:ring-4 focus:ring-[#7886C7]/10 outline-none transition-all appearance-none disabled:opacity-70 disabled:bg-transparent disabled:border-transparent disabled:px-0 disabled:text-[#2D336B]/80"
                                        >
                                            <option value="">Select Gender</option>
                                            <option value="Male">Male</option>
                                            <option value="Female">Female</option>
                                            <option value="Other">Other</option>
                                        </select>
                                    </div>
                                </div>

                                {/* Weight Input */}
                                <div className="space-y-2 group">
                                    <label className="text-xs font-bold text-[#2D336B] ml-1 uppercase tracking-wider group-focus-within:text-[#7886C7] transition-colors">
                                        Weight (kg)
                                    </label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            value={weight}
                                            onChange={(e) => setWeight(e.target.value)}
                                            disabled={!isEditing}
                                            placeholder="-- kg"
                                            className="w-full h-14 rounded-xl border border-[#A9B5DF]/50 bg-white/50 px-4 text-[#2D336B] text-lg font-semibold focus:border-[#7886C7] focus:ring-4 focus:ring-[#7886C7]/10 outline-none transition-all disabled:opacity-70 disabled:bg-transparent disabled:border-transparent disabled:px-0 disabled:text-[#2D336B]/80"
                                        />
                                        {isEditing && <Activity size={16} className="absolute right-4 top-4.5 text-[#A9B5DF]" />}
                                    </div>
                                </div>

                                {/* Height Input */}
                                <div className="space-y-2 group">
                                    <label className="text-xs font-bold text-[#2D336B] ml-1 uppercase tracking-wider group-focus-within:text-[#7886C7] transition-colors">
                                        Height (cm)
                                    </label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            value={height}
                                            onChange={(e) => setHeight(e.target.value)}
                                            disabled={!isEditing}
                                            placeholder="-- cm"
                                            className="w-full h-14 rounded-xl border border-[#A9B5DF]/50 bg-white/50 px-4 text-[#2D336B] text-lg font-semibold focus:border-[#7886C7] focus:ring-4 focus:ring-[#7886C7]/10 outline-none transition-all disabled:opacity-70 disabled:bg-transparent disabled:border-transparent disabled:px-0 disabled:text-[#2D336B]/80"
                                        />
                                        {isEditing && <Activity size={16} className="absolute right-4 top-4.5 text-[#A9B5DF]" />}
                                    </div>
                                </div>
                            </div>

                            {/* Address Section in Form (visible edit mode) or Compact display */}
                            <div className="mt-8 pt-6 border-t border-[#A9B5DF]/20">
                                <h4 className="text-sm font-bold text-[#2D336B] uppercase tracking-wider mb-4 flex items-center gap-2">
                                    <MapPin size={16} /> Address Details
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2 group">
                                        <label className="text-xs font-medium text-[#2D336B]/60 ml-1">Street</label>
                                        <input
                                            type="text"
                                            value={addressLine1}
                                            onChange={(e) => setAddressLine1(e.target.value)}
                                            disabled={!isEditing}
                                            placeholder={isEditing ? "e.g. 123 Main St" : "Not set"}
                                            className="w-full h-12 rounded-xl border border-[#A9B5DF]/50 bg-white/50 px-4 text-[#2D336B] font-medium focus:border-[#7886C7] focus:ring-4 focus:ring-[#7886C7]/10 outline-none transition-all disabled:bg-transparent disabled:border-transparent disabled:px-0"
                                        />
                                    </div>
                                    <div className="space-y-2 group">
                                        <label className="text-xs font-medium text-[#2D336B]/60 ml-1">City / State</label>
                                        <input
                                            type="text"
                                            value={addressLine2}
                                            onChange={(e) => setAddressLine2(e.target.value)}
                                            disabled={!isEditing}
                                            placeholder={isEditing ? "e.g. New York, NY" : "Not set"}
                                            className="w-full h-12 rounded-xl border border-[#A9B5DF]/50 bg-white/50 px-4 text-[#2D336B] font-medium focus:border-[#7886C7] focus:ring-4 focus:ring-[#7886C7]/10 outline-none transition-all disabled:bg-transparent disabled:border-transparent disabled:px-0"
                                        />
                                    </div>
                                </div>
                            </div>

                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

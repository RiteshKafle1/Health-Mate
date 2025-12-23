import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getUserProfile, updateUserProfile } from '../../api/user';
import type { User } from '../../types';
import { Camera, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

export function UserProfile() {
    const { setUser } = useAuth();
    const [profile, setProfile] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isEditing, setIsEditing] = useState(false);

    // Form state
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [addressLine1, setAddressLine1] = useState('');
    const [addressLine2, setAddressLine2] = useState('');
    const [dob, setDob] = useState('');
    const [gender, setGender] = useState('');
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);

    useEffect(() => {
        const fetchProfile = async () => {
            try {
                const response = await getUserProfile();
                if (response.success && response.userData) {
                    const userData = response.userData;
                    setProfile(userData);
                    setUser(userData);

                    // Initialize form values
                    setName(userData.name || '');
                    setPhone(userData.phone || '');
                    setAddressLine1(userData.address?.line1 || '');
                    setAddressLine2(userData.address?.line2 || '');
                    setDob(userData.dob || '');
                    setGender(userData.gender || '');
                }
            } catch (error) {
                toast.error('Failed to load profile');
            } finally {
                setIsLoading(false);
            }
        };

        fetchProfile();
    }, [setUser]);

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setImageFile(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setImagePreview(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);

        try {
            const formData = new FormData();
            formData.append('name', name);
            formData.append('phone', phone);
            formData.append('address', JSON.stringify({ line1: addressLine1, line2: addressLine2 }));
            formData.append('dob', dob);
            formData.append('gender', gender);

            if (imageFile) {
                formData.append('image', imageFile);
            }

            const response = await updateUserProfile(formData);

            if (response.success) {
                toast.success('Profile updated successfully');
                setIsEditing(false);

                // Refresh profile
                const profileRes = await getUserProfile();
                if (profileRes.success && profileRes.userData) {
                    setProfile(profileRes.userData);
                    setUser(profileRes.userData);
                }
            } else {
                toast.error(response.message || 'Failed to update profile');
            }
        } catch (error: any) {
            toast.error(error.response?.data?.detail?.message || 'Failed to update profile');
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <Loader2 className="animate-spin text-primary-500" size={48} />
            </div>
        );
    }

    return (
        <div className="max-w-2xl mx-auto">
            <h1 className="text-2xl font-bold text-dark-50 mb-8">My Profile</h1>

            <form onSubmit={handleSubmit} className="glass-card p-8">
                {/* Profile Image */}
                <div className="flex justify-center mb-8">
                    <div className="relative">
                        <div className="w-32 h-32 rounded-2xl overflow-hidden bg-dark-700">
                            {imagePreview || profile?.image ? (
                                <img
                                    src={imagePreview || profile?.image}
                                    alt={name}
                                    className="w-full h-full object-cover"
                                />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary-500 to-secondary-500">
                                    <span className="text-4xl font-bold text-white">{name.charAt(0) || 'U'}</span>
                                </div>
                            )}
                        </div>
                        {isEditing && (
                            <label className="absolute bottom-2 right-2 p-2 rounded-lg bg-primary-500 text-white cursor-pointer hover:bg-primary-600 transition-colors">
                                <Camera size={16} />
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

                {/* Form Fields */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="input-label">Full Name</label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            disabled={!isEditing}
                            className="input-field disabled:opacity-60"
                        />
                    </div>

                    <div>
                        <label className="input-label">Email</label>
                        <input
                            type="email"
                            value={profile?.email || ''}
                            disabled
                            className="input-field opacity-60"
                        />
                    </div>

                    <div>
                        <label className="input-label">Phone</label>
                        <input
                            type="tel"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            disabled={!isEditing}
                            className="input-field disabled:opacity-60"
                        />
                    </div>

                    <div>
                        <label className="input-label">Date of Birth</label>
                        <input
                            type="date"
                            value={dob}
                            onChange={(e) => setDob(e.target.value)}
                            disabled={!isEditing}
                            className="input-field disabled:opacity-60"
                        />
                    </div>

                    <div>
                        <label className="input-label">Gender</label>
                        <select
                            value={gender}
                            onChange={(e) => setGender(e.target.value)}
                            disabled={!isEditing}
                            className="input-field disabled:opacity-60"
                        >
                            <option value="">Select Gender</option>
                            <option value="Male">Male</option>
                            <option value="Female">Female</option>
                            <option value="Other">Other</option>
                        </select>
                    </div>

                    <div className="md:col-span-2">
                        <label className="input-label">Address Line 1</label>
                        <input
                            type="text"
                            value={addressLine1}
                            onChange={(e) => setAddressLine1(e.target.value)}
                            disabled={!isEditing}
                            className="input-field disabled:opacity-60"
                            placeholder="Street address"
                        />
                    </div>

                    <div className="md:col-span-2">
                        <label className="input-label">Address Line 2</label>
                        <input
                            type="text"
                            value={addressLine2}
                            onChange={(e) => setAddressLine2(e.target.value)}
                            disabled={!isEditing}
                            className="input-field disabled:opacity-60"
                            placeholder="City, State, ZIP"
                        />
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="flex justify-end gap-4 mt-8">
                    {isEditing ? (
                        <>
                            <button
                                type="button"
                                onClick={() => setIsEditing(false)}
                                className="btn-secondary"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={isSaving}
                                className="btn-primary flex items-center gap-2"
                            >
                                {isSaving ? (
                                    <>
                                        <Loader2 className="animate-spin" size={18} />
                                        Saving...
                                    </>
                                ) : (
                                    'Save Changes'
                                )}
                            </button>
                        </>
                    ) : (
                        <button
                            type="button"
                            onClick={() => setIsEditing(true)}
                            className="btn-primary"
                        >
                            Edit Profile
                        </button>
                    )}
                </div>
            </form>
        </div>
    );
}

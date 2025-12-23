import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getDoctorProfile, updateDoctorProfile, changeDoctorAvailability } from '../../api/doctor';
import type { Doctor } from '../../types';
import { Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

export function DoctorProfile() {
    const { setUser } = useAuth();
    const [profile, setProfile] = useState<Doctor | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isEditing, setIsEditing] = useState(false);

    // Form state
    const [fees, setFees] = useState<number>(0);
    const [about, setAbout] = useState('');
    const [addressLine1, setAddressLine1] = useState('');
    const [addressLine2, setAddressLine2] = useState('');

    useEffect(() => {
        const fetchProfile = async () => {
            try {
                const response = await getDoctorProfile();
                if (response.success && response.profileData) {
                    const profileData = response.profileData;
                    setProfile(profileData);
                    setUser(profileData);

                    // Initialize form values
                    setFees(profileData.fees || 0);
                    setAbout(profileData.about || '');
                    setAddressLine1(profileData.address?.line1 || '');
                    setAddressLine2(profileData.address?.line2 || '');
                }
            } catch (error) {
                toast.error('Failed to load profile');
            } finally {
                setIsLoading(false);
            }
        };

        fetchProfile();
    }, [setUser]);

    const handleToggleAvailability = async () => {
        try {
            const response = await changeDoctorAvailability();
            if (response.success) {
                toast.success('Availability updated');
                // Refresh profile
                const profileRes = await getDoctorProfile();
                if (profileRes.success && profileRes.profileData) {
                    setProfile(profileRes.profileData);
                    setUser(profileRes.profileData);
                }
            } else {
                toast.error(response.message || 'Failed to update availability');
            }
        } catch (error: any) {
            toast.error(error.response?.data?.detail?.message || 'Failed to update availability');
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);

        try {
            const response = await updateDoctorProfile({
                fees,
                about,
                address: { line1: addressLine1, line2: addressLine2 },
            });

            if (response.success) {
                toast.success('Profile updated successfully');
                setIsEditing(false);

                // Refresh profile
                const profileRes = await getDoctorProfile();
                if (profileRes.success && profileRes.profileData) {
                    setProfile(profileRes.profileData);
                    setUser(profileRes.profileData);
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
        <div className="max-w-3xl mx-auto">
            <h1 className="text-2xl font-bold text-dark-50 mb-8">My Profile</h1>

            {/* Profile Header */}
            <div className="glass-card p-8 mb-8">
                <div className="flex flex-col md:flex-row gap-6">
                    <div className="w-32 h-32 rounded-2xl overflow-hidden bg-dark-700 flex-shrink-0">
                        {profile?.image ? (
                            <img src={profile.image} alt={profile.name} className="w-full h-full object-cover" />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-emerald-500 to-teal-500">
                                <span className="text-4xl font-bold text-white">{profile?.name?.charAt(0) || 'D'}</span>
                            </div>
                        )}
                    </div>
                    <div className="flex-1">
                        <h2 className="text-2xl font-bold text-dark-50">Dr. {profile?.name}</h2>
                        <p className="text-primary-400 mt-1">{profile?.speciality}</p>
                        <p className="text-dark-400 text-sm mt-1">{profile?.degree} • {profile?.experience}</p>
                        <p className="text-dark-400 text-sm">{profile?.email}</p>
                    </div>

                    {/* Availability Toggle */}
                    <div className="flex flex-col items-end gap-2">
                        <span className="text-sm text-dark-400">Availability</span>
                        <button
                            onClick={handleToggleAvailability}
                            className={`
                relative w-14 h-7 rounded-full transition-colors duration-200
                ${profile?.available ? 'bg-emerald-500' : 'bg-dark-600'}
              `}
                        >
                            <div className={`
                absolute top-1 w-5 h-5 rounded-full bg-white transition-transform duration-200
                ${profile?.available ? 'translate-x-8' : 'translate-x-1'}
              `} />
                        </button>
                        <span className={`text-sm ${profile?.available ? 'text-emerald-400' : 'text-dark-400'}`}>
                            {profile?.available ? 'Available' : 'Unavailable'}
                        </span>
                    </div>
                </div>
            </div>

            {/* Editable Form */}
            <form onSubmit={handleSubmit} className="glass-card p-8">
                <h3 className="text-lg font-semibold text-dark-100 mb-6">Profile Details</h3>

                <div className="space-y-6">
                    {/* Consultation Fee */}
                    <div>
                        <label className="input-label">Consultation Fee (₹)</label>
                        <input
                            type="number"
                            value={fees}
                            onChange={(e) => setFees(Number(e.target.value))}
                            disabled={!isEditing}
                            className="input-field disabled:opacity-60"
                            min="0"
                        />
                    </div>

                    {/* About */}
                    <div>
                        <label className="input-label">About</label>
                        <textarea
                            value={about}
                            onChange={(e) => setAbout(e.target.value)}
                            disabled={!isEditing}
                            rows={4}
                            className="input-field disabled:opacity-60 resize-none"
                            placeholder="Tell patients about yourself..."
                        />
                    </div>

                    {/* Address */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="input-label">Address Line 1</label>
                            <input
                                type="text"
                                value={addressLine1}
                                onChange={(e) => setAddressLine1(e.target.value)}
                                disabled={!isEditing}
                                className="input-field disabled:opacity-60"
                                placeholder="Clinic/Hospital name"
                            />
                        </div>
                        <div>
                            <label className="input-label">Address Line 2</label>
                            <input
                                type="text"
                                value={addressLine2}
                                onChange={(e) => setAddressLine2(e.target.value)}
                                disabled={!isEditing}
                                className="input-field disabled:opacity-60"
                                placeholder="City, State"
                            />
                        </div>
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

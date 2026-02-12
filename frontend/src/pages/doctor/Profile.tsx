import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getDoctorProfile, updateDoctorProfile, changeDoctorAvailability } from '../../api/doctor';
import type { Doctor } from '../../types';
import { Loader2, Clock } from 'lucide-react';
import toast from '../../utils/soundToast';

const DAYS_OF_WEEK = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const TIME_SLOTS = [
    '9:00 AM', '9:30 AM', '10:00 AM', '10:30 AM', '11:00 AM', '11:30 AM',
    '12:00 PM', '12:30 PM', '1:00 PM', '1:30 PM', '2:00 PM', '2:30 PM',
    '3:00 PM', '3:30 PM', '4:00 PM', '4:30 PM', '5:00 PM', '5:30 PM',
    '6:00 PM', '6:30 PM', '7:00 PM', '7:30 PM', '8:00 PM'
];

export function DoctorProfile() {
    const { setUser } = useAuth();
    const [profile, setProfile] = useState<Doctor | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isEditing, setIsEditing] = useState(false);

    // Form state
    const [about, setAbout] = useState('');
    const [addressLine1, setAddressLine1] = useState('');
    const [addressLine2, setAddressLine2] = useState('');
    const [availabilitySchedule, setAvailabilitySchedule] = useState<Record<string, string[]>>({});

    useEffect(() => {
        const fetchProfile = async () => {
            try {
                const response = await getDoctorProfile();
                if (response.success && response.profileData) {
                    const profileData = response.profileData;
                    setProfile(profileData);
                    setUser(profileData);

                    // Initialize form values
                    setAbout(profileData.about || '');
                    setAddressLine1(profileData.address?.line1 || '');
                    setAddressLine2(profileData.address?.line2 || '');
                    setAvailabilitySchedule(profileData.availability_schedule || {});
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

    const toggleTimeSlot = (day: string, time: string) => {
        if (!isEditing) return;

        setAvailabilitySchedule(prev => {
            const daySlots = prev[day] || [];
            if (daySlots.includes(time)) {
                return { ...prev, [day]: daySlots.filter(t => t !== time) };
            } else {
                return {
                    ...prev, [day]: [...daySlots, time].sort((a, b) => {
                        const timeToMinutes = (t: string) => {
                            const [hourMin, period] = t.split(' ');
                            let [hours, mins] = hourMin.split(':').map(Number);
                            if (period === 'PM' && hours !== 12) hours += 12;
                            if (period === 'AM' && hours === 12) hours = 0;
                            return hours * 60 + mins;
                        };
                        return timeToMinutes(a) - timeToMinutes(b);
                    })
                };
            }
        });
    };

    const selectAllForDay = (day: string) => {
        if (!isEditing) return;
        setAvailabilitySchedule(prev => ({ ...prev, [day]: [...TIME_SLOTS] }));
    };

    const clearDay = (day: string) => {
        if (!isEditing) return;
        setAvailabilitySchedule(prev => ({ ...prev, [day]: [] }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);

        try {
            const response = await updateDoctorProfile({
                about,
                address: { line1: addressLine1, line2: addressLine2 },
                availability_schedule: availabilitySchedule,
            });

            if (response.success) {
                toast.success('Profile updated successfully');
                setIsEditing(false);

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
        <div className="max-w-4xl mx-auto">
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
                            className={`relative w-14 h-7 rounded-full transition-colors duration-200
                                ${profile?.available ? 'bg-emerald-500' : 'bg-dark-600'}`}
                        >
                            <div className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-transform duration-200
                                ${profile?.available ? 'translate-x-8' : 'translate-x-1'}`} />
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

                    {/* Availability Schedule */}
                    <div>
                        <div className="flex items-center gap-2 mb-4">
                            <Clock className="text-primary-500" size={20} />
                            <label className="input-label mb-0">Weekly Availability Schedule</label>
                        </div>
                        <p className="text-dark-400 text-sm mb-4">
                            {isEditing ? 'Click on time slots to toggle availability for each day.' : 'Edit profile to modify your schedule.'}
                        </p>

                        <div className="space-y-4 max-h-96 overflow-y-auto">
                            {DAYS_OF_WEEK.map(day => (
                                <div key={day} className="bg-dark-700/30 rounded-xl p-4">
                                    <div className="flex items-center justify-between mb-3">
                                        <h4 className="font-semibold text-dark-100 capitalize">{day}</h4>
                                        {isEditing && (
                                            <div className="flex gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => selectAllForDay(day)}
                                                    className="text-xs text-primary-400 hover:text-primary-300"
                                                >
                                                    Select All
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => clearDay(day)}
                                                    className="text-xs text-red-400 hover:text-red-300"
                                                >
                                                    Clear
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {TIME_SLOTS.map(time => {
                                            const isSelected = (availabilitySchedule[day] || []).includes(time);
                                            return (
                                                <button
                                                    key={time}
                                                    type="button"
                                                    onClick={() => toggleTimeSlot(day, time)}
                                                    disabled={!isEditing}
                                                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all
                                                        ${isSelected
                                                            ? 'bg-emerald-500 text-white'
                                                            : 'bg-dark-600 text-dark-300 hover:bg-dark-500'}
                                                        ${!isEditing && 'cursor-default opacity-75'}`}
                                                >
                                                    {time}
                                                </button>
                                            );
                                        })}
                                    </div>
                                    {(availabilitySchedule[day] || []).length === 0 && (
                                        <p className="text-dark-500 text-xs mt-2 italic">No slots selected - not available on this day</p>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="flex justify-end gap-4 mt-8">
                    {isEditing ? (
                        <>
                            <button
                                type="button"
                                onClick={() => {
                                    setIsEditing(false);
                                    // Reset to profile values
                                    setAvailabilitySchedule(profile?.availability_schedule || {});
                                    setAbout(profile?.about || '');
                                    setAddressLine1(profile?.address?.line1 || '');
                                    setAddressLine2(profile?.address?.line2 || '');
                                }}
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

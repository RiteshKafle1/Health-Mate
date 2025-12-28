import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getUserProfile, updateUserProfile, uploadMyFile, getMyFile } from '../../api/user';
import type { User } from '../../types';
import { Camera, Loader2, Save, Edit2, Upload, FileText } from 'lucide-react';
import toast from 'react-hot-toast';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';

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

    // Profile image
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);

    // Lab Report file (NEW from friend)
    const [reportFile, setReportFile] = useState<File | null>(null);
    const [reportUrl, setReportUrl] = useState<string | null>(null);
    const [isUploadingReport, setIsUploadingReport] = useState(false);

    // ===============================
    // FETCH PROFILE + REPORT FILE
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
                }

                // Fetch uploaded report
                try {
                    const fileRes = await getMyFile();
                    if (fileRes.success && fileRes.data?.fileUrl) {
                        setReportUrl(fileRes.data.fileUrl);
                    }
                } catch {
                    // Report not found, that's okay
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
    // REPORT FILE HANDLER (NEW)
    // ===============================
    const handleReportUpload = async () => {
        if (!reportFile) return;

        setIsUploadingReport(true);
        try {
            const res = await uploadMyFile(reportFile);
            if (res.success && res.data?.fileUrl) {
                setReportUrl(res.data.fileUrl);
                toast.success('Lab report uploaded successfully');
            } else {
                toast.error(res.message || 'Upload failed');
            }
        } catch {
            toast.error('Failed to upload report');
        } finally {
            setIsUploadingReport(false);
        }
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

            if (imageFile) {
                formData.append('image', imageFile);
            }

            const response = await updateUserProfile(formData);

            if (response.success) {
                toast.success('Profile updated');
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

    // ===============================
    // LOADER
    // ===============================
    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <Loader2 className="animate-spin text-primary" size={48} />
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-text">My Profile</h1>
                    <p className="text-text-muted mt-1">Manage your personal information and account settings</p>
                </div>
                {!isEditing && (
                    <Button onClick={() => setIsEditing(true)} className="gap-2">
                        <Edit2 size={16} />
                        Edit Profile
                    </Button>
                )}
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                {/* Profile Header Card */}
                <Card className="p-8">
                    <div className="flex flex-col md:flex-row items-center gap-8">
                        <div className="relative">
                            <div className="w-32 h-32 rounded-full overflow-hidden bg-surface ring-4 ring-white shadow-soft">
                                {imagePreview || profile?.image ? (
                                    <img
                                        src={imagePreview || profile?.image}
                                        alt={name}
                                        className="w-full h-full object-cover"
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center bg-primary/10">
                                        <span className="text-4xl font-bold text-primary">{name.charAt(0) || 'U'}</span>
                                    </div>
                                )}
                            </div>
                            {isEditing && (
                                <label className="absolute bottom-1 right-1 p-2.5 rounded-full bg-primary text-white cursor-pointer hover:bg-primary-hover transition-all shadow-md">
                                    <Camera size={18} />
                                    <input
                                        type="file"
                                        accept="image/*"
                                        onChange={handleImageChange}
                                        className="hidden"
                                    />
                                </label>
                            )}
                        </div>

                        <div className="text-center md:text-left flex-1">
                            <h2 className="text-2xl font-bold text-text">{profile?.name || 'User'}</h2>
                            <p className="text-text-muted mb-4">{profile?.email}</p>
                            <div className="flex flex-wrap justify-center md:justify-start gap-2">
                                <Badge variant="neutral">Patient ID: #{profile?._id?.slice(-6).toUpperCase()}</Badge>
                                <Badge variant="info">Active Member</Badge>
                            </div>
                        </div>
                    </div>
                </Card>

                {/* Personal Information */}
                <Card className="p-6">
                    <h3 className="text-lg font-semibold text-text mb-6 pb-2 border-b border-surface/50">
                        Personal Information
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Input
                            label="Full Name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            disabled={!isEditing}
                        />

                        <Input
                            label="Email"
                            type="email"
                            value={profile?.email || ''}
                            disabled
                            helperText="Email cannot be changed"
                        />

                        <Input
                            label="Phone Number"
                            type="tel"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            disabled={!isEditing}
                        />

                        <Input
                            label="Date of Birth"
                            type="date"
                            value={dob}
                            onChange={(e) => setDob(e.target.value)}
                            disabled={!isEditing}
                        />

                        <div>
                            <label className="mb-2 block text-sm font-medium text-text-muted">Gender</label>
                            <select
                                value={gender}
                                onChange={(e) => setGender(e.target.value)}
                                disabled={!isEditing}
                                className="flex h-11 w-full rounded-lg border border-surface bg-white/50 px-4 py-2 text-sm text-text focus:border-primary focus:bg-white focus:outline-none focus:ring-4 focus:ring-primary/10 disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-200"
                            >
                                <option value="">Select Gender</option>
                                <option value="Male">Male</option>
                                <option value="Female">Female</option>
                                <option value="Other">Other</option>
                            </select>
                        </div>
                    </div>
                </Card>

                {/* Address Information */}
                <Card className="p-6">
                    <h3 className="text-lg font-semibold text-text mb-6 pb-2 border-b border-surface/50">
                        Address Details
                    </h3>

                    <div className="grid grid-cols-1 gap-6">
                        <Input
                            label="Address Line 1"
                            value={addressLine1}
                            onChange={(e) => setAddressLine1(e.target.value)}
                            disabled={!isEditing}
                            placeholder="Street address"
                        />

                        <Input
                            label="Address Line 2"
                            value={addressLine2}
                            onChange={(e) => setAddressLine2(e.target.value)}
                            disabled={!isEditing}
                            placeholder="City, State, ZIP"
                        />
                    </div>
                </Card>

                {/* Lab Report Upload (NEW - from friend) */}
                <Card className="p-6">
                    <h3 className="text-lg font-semibold text-text mb-6 pb-2 border-b border-surface/50">
                        Lab Reports & Medical Documents
                    </h3>

                    {reportUrl && (
                        <a
                            href={reportUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 text-primary hover:text-primary-hover mb-4 transition-colors"
                        >
                            <FileText size={18} />
                            View Uploaded Report
                        </a>
                    )}

                    <div className="flex flex-col sm:flex-row gap-3">
                        <input
                            type="file"
                            onChange={(e) => setReportFile(e.target.files?.[0] || null)}
                            className="flex h-11 w-full rounded-lg border border-surface bg-white/50 px-4 py-2 text-sm text-text file:mr-4 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
                            accept="image/*,video/*,.pdf,.doc,.docx"
                        />

                        <Button
                            type="button"
                            onClick={handleReportUpload}
                            disabled={isUploadingReport || !reportFile}
                            isLoading={isUploadingReport}
                            className="gap-2 whitespace-nowrap"
                        >
                            <Upload size={16} />
                            Upload Report
                        </Button>
                    </div>
                    <p className="text-xs text-text-muted mt-2">
                        Supported formats: Images, Videos, PDF, DOC
                    </p>
                </Card>

                {/* Action Buttons */}
                {isEditing && (
                    <div className="flex items-center justify-end gap-4 sticky bottom-4 bg-white/80 p-4 rounded-xl backdrop-blur-md shadow-lg border border-surface/50">
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={() => setIsEditing(false)}
                            disabled={isSaving}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            isLoading={isSaving}
                            className="gap-2"
                        >
                            <Save size={18} />
                            Save Changes
                        </Button>
                    </div>
                )}
            </form>
        </div>
    );
}

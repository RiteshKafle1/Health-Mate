import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { addDoctor } from '../../api/admin';
import {
    Camera,
    Loader2,
    Plus,
    User,
    Mail,
    Lock,
    Stethoscope,
    GraduationCap,
    Clock,
    Banknote,
    MapPin,
    Building2,
    FileText,
    Upload,
    X
} from 'lucide-react';
import toast from 'react-hot-toast';

const specialities = [
    'General physician',
    'Gynecologist',
    'Dermatologist',
    'Pediatricians',
    'Neurologist',
    'Gastroenterologist',
];

export function AddDoctor() {
    const navigate = useNavigate();
    const [isLoading, setIsLoading] = useState(false);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [imageFile, setImageFile] = useState<File | null>(null);

    // Form state
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [speciality, setSpeciality] = useState('');
    const [degree, setDegree] = useState('');
    const [experience, setExperience] = useState('');
    const [about, setAbout] = useState('');
    const [fees, setFees] = useState('');
    const [addressLine1, setAddressLine1] = useState('');
    const [addressLine2, setAddressLine2] = useState('');

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

    const removeImage = () => {
        setImageFile(null);
        setImagePreview(null);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Validation
        if (!name || !email || !password || !speciality || !degree || !experience || !about || !fees) {
            toast.error('Please fill in all required fields');
            return;
        }

        setIsLoading(true);

        try {
            const formData = new FormData();
            formData.append('name', name);
            formData.append('email', email);
            formData.append('password', password);
            formData.append('speciality', speciality);
            formData.append('degree', degree);
            formData.append('experience', experience);
            formData.append('about', about);
            formData.append('fees', fees);
            formData.append('address', JSON.stringify({ line1: addressLine1, line2: addressLine2 }));

            if (imageFile) {
                formData.append('image', imageFile);
            }

            const response = await addDoctor(formData);

            if (response.success) {
                toast.success('Doctor added successfully!');
                navigate('/admin/doctors');
            } else {
                toast.error(response.message || 'Failed to add doctor');
            }
        } catch (error: any) {
            toast.error(error.response?.data?.detail?.message || 'Failed to add doctor');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="max-w-5xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-dark-50">Add New Doctor</h1>
                    <p className="text-dark-400 mt-1">Create a new doctor profile for the platform</p>
                </div>
                <button
                    onClick={() => navigate('/admin/doctors')}
                    className="px-4 py-2 text-sm font-medium text-dark-400 hover:text-dark-200 transition-colors"
                >
                    Cancel
                </button>
            </div>

            <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Left Column: Image Upload */}
                <div className="lg:col-span-4 space-y-6">
                    <div className="glass-card p-6 flex flex-col items-center text-center">
                        <div className="relative group mb-4">
                            <div className={`w-40 h-40 rounded-2xl overflow-hidden flex items-center justify-center transition-all duration-300 ${imagePreview ? 'bg-dark-800' : 'bg-dark-700/50 border-2 border-dashed border-dark-600 hover:border-primary-500/50'}`}>
                                {imagePreview ? (
                                    <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                                ) : (
                                    <div className="flex flex-col items-center gap-2 p-4">
                                        <div className="p-3 bg-dark-700 rounded-full">
                                            <Upload className="text-dark-400" size={24} />
                                        </div>
                                        <span className="text-xs text-dark-400">Upload Photo</span>
                                    </div>
                                )}
                            </div>

                            {/* Actions Overlay */}
                            <div className="absolute -bottom-2 -right-2 flex gap-2">
                                <label className="p-2.5 rounded-xl bg-primary-500 hover:bg-primary-600 text-white shadow-lg cursor-pointer transition-transform hover:scale-105 active:scale-95">
                                    <Camera size={18} />
                                    <input
                                        type="file"
                                        accept="image/*"
                                        onChange={handleImageChange}
                                        className="hidden"
                                    />
                                </label>
                                {imagePreview && (
                                    <button
                                        type="button"
                                        onClick={removeImage}
                                        className="p-2.5 rounded-xl bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white shadow-lg transition-all hover:scale-105 active:scale-95 border border-red-500/20"
                                    >
                                        <X size={18} />
                                    </button>
                                )}
                            </div>
                        </div>
                        <h3 className="font-medium text-dark-100">Profile Photo</h3>
                        <p className="text-xs text-dark-400 mt-1 max-w-[200px]">
                            Upload a professional headshot. Recommended size: 500x500px.
                        </p>
                    </div>

                    <div className="glass-card p-6 bg-gradient-to-br from-primary-500/5 to-secondary-500/5 border-primary-500/10">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 bg-primary-500/10 rounded-lg">
                                <Plus className="text-primary-500" size={20} />
                            </div>
                            <h3 className="font-semibold text-primary-500">Quick Tips</h3>
                        </div>
                        <ul className="space-y-2 text-sm text-dark-300 list-disc list-inside marker:text-primary-500">
                            <li>Use full formal name (e.g. Dr. Sarah Smith)</li>
                            <li>Ensure email is unique for login</li>
                            <li>Set a strong temporary password</li>
                            <li>Verify degree and experience details</li>
                        </ul>
                    </div>
                </div>

                {/* Right Column: Form Fields */}
                <div className="lg:col-span-8 space-y-6">
                    {/* Account Information */}
                    <div className="glass-card p-6">
                        <h2 className="text-lg font-semibold text-dark-100 mb-6 flex items-center gap-2">
                            <User className="text-primary-400" size={20} />
                            Account Information
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-xs font-medium text-dark-400 uppercase tracking-wider">Full Name</label>
                                <div className="relative">
                                    <User className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-500" size={18} />
                                    <input
                                        type="text"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        className="w-full pl-10 pr-4 py-2.5 bg-dark-800/50 border border-dark-700 rounded-xl text-dark-100 placeholder-dark-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
                                        placeholder="Dr. John Doe"
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-medium text-dark-400 uppercase tracking-wider">Email Address</label>
                                <div className="relative">
                                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-500" size={18} />
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="w-full pl-10 pr-4 py-2.5 bg-dark-800/50 border border-dark-700 rounded-xl text-dark-100 placeholder-dark-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
                                        placeholder="doctor@example.com"
                                    />
                                </div>
                            </div>
                            <div className="space-y-2 md:col-span-2">
                                <label className="text-xs font-medium text-dark-400 uppercase tracking-wider">Password</label>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-500" size={18} />
                                    <input
                                        type="password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="w-full pl-10 pr-4 py-2.5 bg-dark-800/50 border border-dark-700 rounded-xl text-dark-100 placeholder-dark-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
                                        placeholder="Create a strong password"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Professional Details */}
                    <div className="glass-card p-6">
                        <h2 className="text-lg font-semibold text-dark-100 mb-6 flex items-center gap-2">
                            <Stethoscope className="text-primary-400" size={20} />
                            Professional Details
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-xs font-medium text-dark-400 uppercase tracking-wider">Speciality</label>
                                <div className="relative">
                                    <Stethoscope className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-500" size={18} />
                                    <select
                                        value={speciality}
                                        onChange={(e) => setSpeciality(e.target.value)}
                                        className="w-full pl-10 pr-4 py-2.5 bg-dark-800/50 border border-dark-700 rounded-xl text-dark-100 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all appearance-none cursor-pointer"
                                    >
                                        <option value="" disabled>Select Speciality</option>
                                        {specialities.map((spec) => (
                                            <option key={spec} value={spec} className="bg-dark-800">{spec}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-medium text-dark-400 uppercase tracking-wider">Degree</label>
                                <div className="relative">
                                    <GraduationCap className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-500" size={18} />
                                    <input
                                        type="text"
                                        value={degree}
                                        onChange={(e) => setDegree(e.target.value)}
                                        className="w-full pl-10 pr-4 py-2.5 bg-dark-800/50 border border-dark-700 rounded-xl text-dark-100 placeholder-dark-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
                                        placeholder="MBBS, MD"
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-medium text-dark-400 uppercase tracking-wider">Experience</label>
                                <div className="relative">
                                    <Clock className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-500" size={18} />
                                    <input
                                        type="text"
                                        value={experience}
                                        onChange={(e) => setExperience(e.target.value)}
                                        className="w-full pl-10 pr-4 py-2.5 bg-dark-800/50 border border-dark-700 rounded-xl text-dark-100 placeholder-dark-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
                                        placeholder="e.g. 5 Years"
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-medium text-dark-400 uppercase tracking-wider">Consultation Fee</label>
                                <div className="relative">
                                    <Banknote className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-500" size={18} />
                                    <input
                                        type="number"
                                        value={fees}
                                        onChange={(e) => setFees(e.target.value)}
                                        className="w-full pl-10 pr-4 py-2.5 bg-dark-800/50 border border-dark-700 rounded-xl text-dark-100 placeholder-dark-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
                                        placeholder="e.g. 500"
                                        min="0"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Clinic Address & About */}
                    <div className="glass-card p-6">
                        <h2 className="text-lg font-semibold text-dark-100 mb-6 flex items-center gap-2">
                            <Building2 className="text-primary-400" size={20} />
                            Clinic Details
                        </h2>
                        <div className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-xs font-medium text-dark-400 uppercase tracking-wider">Clinic Name</label>
                                    <div className="relative">
                                        <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-500" size={18} />
                                        <input
                                            type="text"
                                            value={addressLine1}
                                            onChange={(e) => setAddressLine1(e.target.value)}
                                            className="w-full pl-10 pr-4 py-2.5 bg-dark-800/50 border border-dark-700 rounded-xl text-dark-100 placeholder-dark-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
                                            placeholder="Health Center Name"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-medium text-dark-400 uppercase tracking-wider">City / State</label>
                                    <div className="relative">
                                        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-500" size={18} />
                                        <input
                                            type="text"
                                            value={addressLine2}
                                            onChange={(e) => setAddressLine2(e.target.value)}
                                            className="w-full pl-10 pr-4 py-2.5 bg-dark-800/50 border border-dark-700 rounded-xl text-dark-100 placeholder-dark-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
                                            placeholder="City, State"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-medium text-dark-400 uppercase tracking-wider">About Doctor</label>
                                <div className="relative">
                                    <FileText className="absolute left-3 top-3 text-dark-500" size={18} />
                                    <textarea
                                        value={about}
                                        onChange={(e) => setAbout(e.target.value)}
                                        rows={4}
                                        className="w-full pl-10 pr-4 py-3 bg-dark-800/50 border border-dark-700 rounded-xl text-dark-100 placeholder-dark-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all resize-none"
                                        placeholder="Write a brief professional bio..."
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Submit Area */}
                    <div className="flex items-center justify-end gap-4 pt-4">
                        <button
                            type="button"
                            onClick={() => navigate('/admin/doctors')}
                            className="px-6 py-2.5 rounded-xl border border-dark-700 text-dark-300 font-medium hover:bg-dark-800 hover:text-dark-100 transition-all"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="btn-primary flex items-center gap-2 px-8 py-2.5 rounded-xl shadow-lg shadow-primary-500/20 hover:shadow-primary-500/40 transition-all"
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 className="animate-spin" size={20} />
                                    Adding Doctor...
                                </>
                            ) : (
                                <>
                                    <Plus size={20} />
                                    Add Doctor
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </form>
        </div>
    );
}
